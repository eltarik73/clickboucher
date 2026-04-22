// src/app/api/boucher/orders/[orderId]/action/route.ts — Unified boucher action route (Uber Eats tablette)
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { boucherActionSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";
import { canTransition } from "@/lib/order-state-machine";
import { calculatePrepTime } from "@/lib/dynamic-prep-time";
import { sendOrderReceiptEmail } from "@/lib/emails/order-receipt";

import { Prisma, type OrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/** Log an OrderEvent for audit trail */
async function logOrderEvent(
  orderId: string,
  shopId: string,
  type: string,
  actorId: string,
  payload?: Record<string, unknown>
) {
  try {
    await prisma.orderEvent.create({
      data: {
        orderId,
        shopId,
        type,
        actorId,
        ...(payload ? { payloadJson: payload as unknown as Prisma.InputJsonValue } : {}),
      },
    });
  } catch (e) {
    console.error("[order-event] Failed to log:", type, e);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { userId, shopId } = authResult;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: { include: { categories: true } } } },
        shop: {
          select: {
            id: true, ownerId: true, name: true, prepTimeMin: true,
            busyMode: true, busyExtraMin: true,
            address: true, city: true, siret: true, fullAddress: true,
            vatRate: true,
          },
        },
        user: { select: { id: true, firstName: true, lastName: true, email: true, clerkId: true, customerNumber: true } },
      },
    });

    if (!order) {
      return apiError("NOT_FOUND", "Commande introuvable");
    }
    if (order.shopId !== shopId) {
      return apiError("FORBIDDEN", "Cette commande n'appartient pas à votre boucherie");
    }

    const body = await req.json();
    const data = boucherActionSchema.parse(body);

    switch (data.action) {
      // ── ACCEPT ──────────────────────────────────
      case "accept": {
        // Idempotent: already accepted → return current state
        if (order.status === "ACCEPTED" || order.status === "PREPARING" || order.status === "READY") {
          return apiSuccess({ ...order, _idempotent: true });
        }
        if (!canTransition(order.status, "ACCEPTED")) {
          return apiError("VALIDATION_ERROR", `Impossible d'accepter (statut: ${order.status})`);
        }

        const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
        const prepMinutes = await calculatePrepTime({
          shopId: order.shop.id,
          basePrepMin: order.shop.prepTimeMin,
          busyMode: order.shop.busyMode,
          busyExtraMin: order.shop.busyExtraMin,
          itemCount,
        });

        // Scheduled orders: use pickupSlotStart as estimatedReady (no prep time selector)
        const isScheduledOrder = !!order.pickupSlotStart && new Date(order.pickupSlotStart).getTime() > Date.now();
        const estimatedMinutes = isScheduledOrder
          ? Math.round((new Date(order.pickupSlotStart!).getTime() - Date.now()) / 60_000)
          : Math.max(data.estimatedMinutes, prepMinutes);
        const estimatedReady = isScheduledOrder
          ? new Date(order.pickupSlotStart!)
          : new Date(Date.now() + estimatedMinutes * 60_000);
        const qrCode = order.qrCode || randomUUID();

        const updated = await prisma.order.update({
          where: { id: orderId },
          data: {
            status: "ACCEPTED",
            estimatedReady,
            qrCode,
            expiresAt: null,
          },
          include: { items: true },
        });

        // ── Decrement anti-gaspi + flash sale stock via $transaction ──
        const stockUpdates = [];
        const agItems = order.items.filter(i => i.product.isAntiGaspi && i.product.antiGaspiStock !== null);
        for (const item of agItems) {
          const newStock = Math.max(0, (item.product.antiGaspiStock ?? 0) - item.quantity);
          stockUpdates.push(prisma.product.update({
            where: { id: item.productId },
            data: {
              antiGaspiStock: newStock,
              ...(newStock <= 0 ? {
                isAntiGaspi: false,
                priceCents: item.product.antiGaspiOrigPriceCents ?? item.product.priceCents,
                antiGaspiOrigPriceCents: null, antiGaspiEndAt: null,
                antiGaspiReason: null, antiGaspiStock: null,
              } : {}),
            },
          }));
        }
        const flashItems = order.items.filter(i => i.product.isFlashSale && i.product.flashSaleStock !== null);
        for (const item of flashItems) {
          const newStock = Math.max(0, (item.product.flashSaleStock ?? 0) - item.quantity);
          stockUpdates.push(prisma.product.update({
            where: { id: item.productId },
            data: {
              flashSaleStock: newStock,
              ...(newStock <= 0 ? { isFlashSale: false, flashSaleEndAt: null, flashSaleStock: null } : {}),
            },
          }));
        }
        if (stockUpdates.length > 0) {
          await prisma.$transaction(stockUpdates);
        }

        await logOrderEvent(orderId, order.shop.id, "ACCEPTED", userId, { estimatedMinutes, qrCode });

        await sendNotification("ORDER_ACCEPTED", {
          userId: order.user.id,
          orderId,
          orderNumber: order.orderNumber,
          shopName: order.shop.name,
          estimatedMinutes,
          qrCode,
        });

        return apiSuccess({ ...updated, estimatedMinutes });
      }

      // ── DENY ────────────────────────────────────
      case "deny": {
        if (order.status === "DENIED") return apiSuccess({ ...order, _idempotent: true });
        if (!canTransition(order.status, "DENIED")) {
          return apiError("VALIDATION_ERROR", `Impossible de refuser (statut: ${order.status})`);
        }

        const updated = await prisma.order.update({
          where: { id: orderId },
          data: { status: "DENIED", denyReason: data.reason },
        });

        // Restore anti-gaspi/flash stock on deny (batched)
        const denyStockRestores = [];
        for (const item of order.items) {
          if (item.product.isAntiGaspi && item.product.antiGaspiStock !== null) {
            denyStockRestores.push(prisma.product.update({ where: { id: item.productId }, data: { antiGaspiStock: { increment: item.quantity } } }));
          }
          if (item.product.isFlashSale && item.product.flashSaleStock !== null) {
            denyStockRestores.push(prisma.product.update({ where: { id: item.productId }, data: { flashSaleStock: { increment: item.quantity } } }));
          }
        }
        if (denyStockRestores.length > 0) await prisma.$transaction(denyStockRestores);

        await logOrderEvent(orderId, order.shop.id, "DENIED", userId, { reason: data.reason });

        await sendNotification("ORDER_DENIED", {
          userId: order.user.id,
          orderId,
          orderNumber: order.orderNumber,
          shopName: order.shop.name,
          denyReason: data.reason,
        });

        return apiSuccess(updated);
      }

      // ── START PREPARING ─────────────────────────
      case "start_preparing": {
        if (order.status === "PREPARING") return apiSuccess({ ...order, _idempotent: true });
        if (!canTransition(order.status, "PREPARING")) {
          return apiError("VALIDATION_ERROR", `Impossible de démarrer la préparation (statut: ${order.status})`);
        }

        const updateData: { status: OrderStatus; estimatedReady?: Date } = {
          status: "PREPARING",
        };

        if (data.addMinutes && data.addMinutes > 0) {
          const base = order.estimatedReady ? new Date(order.estimatedReady) : new Date();
          updateData.estimatedReady = new Date(base.getTime() + data.addMinutes * 60_000);
        }

        const updated = await prisma.order.update({
          where: { id: orderId },
          data: updateData,
          include: { items: true },
        });

        await logOrderEvent(orderId, order.shop.id, "PREPARING", userId, { addMinutes: data.addMinutes });

        await sendNotification("ORDER_PREPARING", {
          userId: order.user.id,
          orderId,
          orderNumber: order.orderNumber,
          shopName: order.shop.name,
        });

        return apiSuccess(updated);
      }

      // ── ADD TIME ────────────────────────────────
      case "add_time": {
        if (order.status !== "PREPARING" && order.status !== "ACCEPTED") {
          return apiError("VALIDATION_ERROR", `Impossible d'ajouter du temps (statut: ${order.status})`);
        }

        const base = order.estimatedReady ? new Date(order.estimatedReady) : new Date();
        const newEstimated = new Date(base.getTime() + data.addMinutes * 60_000);

        const updated = await prisma.order.update({
          where: { id: orderId },
          data: { estimatedReady: newEstimated },
        });

        await logOrderEvent(orderId, order.shop.id, "ADD_TIME", userId, { addMinutes: data.addMinutes });

        return apiSuccess(updated);
      }

      // ── MARK READY ──────────────────────────────
      case "mark_ready": {
        if (order.status === "READY") return apiSuccess({ ...order, _idempotent: true });
        if (!canTransition(order.status, "READY")) {
          return apiError("VALIDATION_ERROR", `Impossible de marquer prêt (statut: ${order.status})`);
        }

        const updated = await prisma.order.update({
          where: { id: orderId },
          data: { status: "READY", actualReady: new Date() },
        });

        await logOrderEvent(orderId, order.shop.id, "READY", userId);

        await sendNotification("ORDER_READY", {
          userId: order.user.id,
          orderId,
          orderNumber: order.orderNumber,
          shopName: order.shop.name,
        });

        return apiSuccess(updated);
      }

      // ── ITEM UNAVAILABLE (stock-issue) ──────────
      case "item_unavailable": {
        if (order.status !== "PENDING" && order.status !== "ACCEPTED") {
          return apiError("VALIDATION_ERROR", `Impossible de signaler une rupture (statut: ${order.status})`);
        }

        // Mark unavailable
        await prisma.orderItem.updateMany({
          where: { orderId, productId: { in: data.itemIds } },
          data: { available: false },
        });

        // Auto-toggle product stock (scoped by shopId)
        await prisma.product.updateMany({
          where: { id: { in: data.itemIds }, shopId },
          data: { inStock: false },
        });

        // Find alternatives
        const unavailableOrderItems = order.items.filter(
          (item) => data.itemIds.includes(item.productId)
        );

        // Single query for all alternatives (instead of N queries per unavailable item)
        const allCatIds = unavailableOrderItems.flatMap(item =>
          item.product.categories.map((c: { id: string }) => c.id)
        );
        const allAlts = allCatIds.length > 0
          ? await prisma.product.findMany({
              where: {
                shopId: order.shop.id,
                categories: { some: { id: { in: allCatIds } } },
                inStock: true,
                id: { notIn: data.itemIds },
              },
              select: { id: true, name: true, priceCents: true, categories: { select: { id: true } } },
              orderBy: { priceCents: "asc" },
            })
          : [];

        const alternatives: Record<string, { id: string; name: string; priceCents: number }[]> = {};
        for (const item of unavailableOrderItems) {
          const itemCatIds = new Set(item.product.categories.map((c: { id: string }) => c.id));
          alternatives[item.productId] = allAlts
            .filter(alt => alt.categories.some(c => itemCatIds.has(c.id)))
            .slice(0, 3)
            .map(({ id, name, priceCents }) => ({ id, name, priceCents }));
        }

        // Recalculate total
        const availableItems = order.items.filter(
          (item) => !data.itemIds.includes(item.productId)
        );
        const newTotal = availableItems.reduce((sum, item) => sum + item.totalCents, 0);
        const allUnavailable = order.items.every(
          (item) => data.itemIds.includes(item.productId)
        );

        const updated = await prisma.order.update({
          where: { id: orderId },
          data: {
            status: allUnavailable ? "DENIED" : "PARTIALLY_DENIED",
            totalCents: allUnavailable ? 0 : newTotal,
            denyReason: allUnavailable
              ? "Tous les articles sont en rupture de stock"
              : "Certains articles sont en rupture de stock",
          },
          include: { items: { include: { product: true } } },
        });

        await logOrderEvent(orderId, order.shop.id, "ITEM_UNAVAILABLE", userId, {
          itemIds: data.itemIds,
          resultStatus: allUnavailable ? "DENIED" : "PARTIALLY_DENIED",
        });

        await sendNotification("STOCK_ISSUE", {
          userId: order.user.id,
          orderId,
          orderNumber: order.orderNumber,
          shopName: order.shop.name,
        });

        return apiSuccess({ order: updated, alternatives });
      }

      // ── ADJUST WEIGHT ───────────────────────────
      case "adjust_weight": {
        if (order.status !== "ACCEPTED" && order.status !== "PREPARING") {
          return apiError("VALIDATION_ERROR", `Impossible d'ajuster le poids (statut: ${order.status})`);
        }

        let totalDiff = 0;
        const weightUpdates = [];
        for (const adj of data.items) {
          const item = order.items.find((i) => i.id === adj.orderItemId);
          if (!item) continue;

          const newTotal = item.product.unit === "KG"
            ? Math.round(item.priceCents * (adj.actualWeightGrams / 1000))
            : item.totalCents;

          totalDiff += newTotal - item.totalCents;

          weightUpdates.push(prisma.orderItem.update({
            where: { id: adj.orderItemId },
            data: { weightGrams: adj.actualWeightGrams, totalCents: newTotal },
          }));
        }
        if (weightUpdates.length > 0) await prisma.$transaction(weightUpdates);

        const updated = await prisma.order.update({
          where: { id: orderId },
          data: { totalCents: order.totalCents + totalDiff },
          include: { items: true },
        });

        await logOrderEvent(orderId, order.shop.id, "ADJUST_WEIGHT", userId, {
          items: data.items,
          totalDiff,
        });

        return apiSuccess(updated);
      }

      // ── ADJUST PRICE ────────────────────────────
      case "adjust_price": {
        if (order.status !== "ACCEPTED" && order.status !== "PREPARING") {
          return apiError("VALIDATION_ERROR", `Impossible d'ajuster le prix (statut: ${order.status})`);
        }

        let totalDiff = 0;
        const priceUpdates = [];
        for (const adj of data.items) {
          const item = order.items.find((i) => i.id === adj.orderItemId);
          if (!item) continue;

          const newTotal = Math.round(adj.newPriceCents * item.quantity);
          totalDiff += newTotal - item.totalCents;

          priceUpdates.push(prisma.orderItem.update({
            where: { id: adj.orderItemId },
            data: { priceCents: adj.newPriceCents, totalCents: newTotal },
          }));
        }
        if (priceUpdates.length > 0) await prisma.$transaction(priceUpdates);

        const updated = await prisma.order.update({
          where: { id: orderId },
          data: { totalCents: order.totalCents + totalDiff },
          include: { items: true },
        });

        await logOrderEvent(orderId, order.shop.id, "ADJUST_PRICE", userId, {
          items: data.items,
          totalDiff,
        });

        return apiSuccess(updated);
      }

      // ── CONFIRM PICKUP (QR scan) ────────────────
      case "confirm_pickup": {
        if (order.status === "PICKED_UP" || order.status === "COMPLETED") {
          return apiSuccess({ ...order, _idempotent: true });
        }
        if (order.status !== "READY") {
          return apiError("VALIDATION_ERROR", `La commande n'est pas prête (statut: ${order.status})`);
        }

        if (data.qrCode !== order.qrCode) {
          return apiError("VALIDATION_ERROR", "QR code invalide");
        }

        const now = new Date();
        const updated = await prisma.order.update({
          where: { id: orderId },
          data: { status: "PICKED_UP", pickedUpAt: now, qrScannedAt: now },
        });

        await logOrderEvent(orderId, order.shop.id, "PICKED_UP", userId, { method: "qr" });

        await sendNotification("ORDER_PICKED_UP", {
          userId: order.user.id,
          orderId,
          orderNumber: order.orderNumber,
          shopName: order.shop.name,
        });

        sendReceiptForOrder(order, now).catch(() => {});
        // loyalty processing removed (marketing rebuild)

        return apiSuccess(updated);
      }

      // ── MANUAL PICKUP (boucher-side, no QR needed) ──
      case "manual_pickup": {
        if (order.status === "PICKED_UP" || order.status === "COMPLETED") {
          return apiSuccess({ ...order, _idempotent: true });
        }
        if (order.status !== "READY") {
          return apiError("VALIDATION_ERROR", `La commande n'est pas prête (statut: ${order.status})`);
        }

        const manualNow = new Date();
        const manualUpdated = await prisma.order.update({
          where: { id: orderId },
          data: { status: "PICKED_UP", pickedUpAt: manualNow },
        });

        await logOrderEvent(orderId, order.shop.id, "PICKED_UP", userId, { method: "manual" });

        await sendNotification("ORDER_PICKED_UP", {
          userId: order.user.id,
          orderId,
          orderNumber: order.orderNumber,
          shopName: order.shop.name,
        });

        sendReceiptForOrder(order, manualNow).catch(() => {});
        // loyalty processing removed (marketing rebuild)

        return apiSuccess(manualUpdated);
      }

      // ── CANCEL (by boucher) ─────────────────────
      case "cancel": {
        if (order.status === "CANCELLED") return apiSuccess({ ...order, _idempotent: true });
        if (!canTransition(order.status, "CANCELLED")) {
          return apiError("VALIDATION_ERROR", `Impossible d'annuler (statut: ${order.status})`);
        }

        const updated = await prisma.order.update({
          where: { id: orderId },
          data: {
            status: "CANCELLED",
            denyReason: data.reason || "Annulée par le boucher",
          },
        });

        // Restore anti-gaspi/flash stock on cancel (batched)
        const cancelStockRestores = [];
        for (const item of order.items) {
          if (item.product.isAntiGaspi && item.product.antiGaspiStock !== null) {
            cancelStockRestores.push(prisma.product.update({ where: { id: item.productId }, data: { antiGaspiStock: { increment: item.quantity } } }));
          }
          if (item.product.isFlashSale && item.product.flashSaleStock !== null) {
            cancelStockRestores.push(prisma.product.update({ where: { id: item.productId }, data: { flashSaleStock: { increment: item.quantity } } }));
          }
        }
        if (cancelStockRestores.length > 0) await prisma.$transaction(cancelStockRestores);

        await logOrderEvent(orderId, order.shop.id, "CANCELLED", userId, { reason: data.reason });

        await sendNotification("ORDER_CANCELLED", {
          userId: order.user.id,
          orderId,
          orderNumber: order.orderNumber,
          shopName: order.shop.name,
          denyReason: data.reason || "Annulée par le boucher",
        });

        return apiSuccess(updated);
      }

      // ── ADD NOTE ────────────────────────────────
      case "add_note": {
        const terminalStatuses = ["COMPLETED", "DENIED", "CANCELLED", "AUTO_CANCELLED"];
        if (terminalStatuses.includes(order.status)) {
          return apiError("VALIDATION_ERROR", `Impossible d'ajouter une note (statut: ${order.status})`);
        }

        const updated = await prisma.order.update({
          where: { id: orderId },
          data: { boucherNote: data.note },
        });

        await logOrderEvent(orderId, order.shop.id, "ADD_NOTE", userId, { note: data.note });

        await sendNotification("BOUCHER_NOTE", {
          userId: order.user.id,
          orderId,
          orderNumber: order.orderNumber,
          shopName: order.shop.name,
          note: data.note,
        });

        return apiSuccess(updated);
      }

      default:
        return apiError("VALIDATION_ERROR", "Action inconnue");
    }
  } catch (error) {
    return handleApiError(error, "boucher/orders/action");
  }
}

// ── Receipt email helper ─────────────────────
type OrderWithDetails = Prisma.OrderGetPayload<{
  include: {
    items: { include: { product: { include: { categories: true } } } };
    shop: {
      select: {
        id: true; ownerId: true; name: true; prepTimeMin: true;
        busyMode: true; busyExtraMin: true;
        address: true; city: true; siret: true; fullAddress: true;
        vatRate: true;
      };
    };
    user: { select: { id: true; firstName: true; lastName: true; email: true; clerkId: true; customerNumber: true } };
  };
}>;

async function sendReceiptForOrder(order: OrderWithDetails, pickedUpAt: Date) {
  try {
    await sendOrderReceiptEmail(order.user.email, {
      orderId: order.id,
      displayNumber: order.displayNumber || `#${order.orderNumber}`,
      customerFirstName: order.user.firstName,
      customerLastName: order.user.lastName,
      customerNumber: order.user.customerNumber || null,
      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        totalCents: item.totalCents,
        weightGrams: item.weightGrams,
        vatRate: item.product?.vatRate ?? order.shop.vatRate ?? 5.5,
      })),
      totalCents: order.totalCents,
      shopName: order.shop.name,
      shopAddress: order.shop.address,
      shopCity: order.shop.city,
      shopSiret: order.shop.siret,
      shopFullAddress: order.shop.fullAddress,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
      pickedUpAt,
    });
  } catch (e) {
    console.error("[receipt-email] Failed:", e);
  }
}
