// src/app/api/boucher/orders/[orderId]/action/route.ts — Unified boucher action route (Uber Eats tablette)
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { boucherActionSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";
import { canTransition } from "@/lib/order-state-machine";
import { calculatePrepTime } from "@/lib/dynamic-prep-time";
import { sendOrderReceiptEmail } from "@/lib/emails/order-receipt";
import type { OrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;
    const { userId } = await auth();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: { include: { category: true } } } },
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
    if (order.shop.ownerId !== userId) {
      return apiError("FORBIDDEN", "Cette commande n'appartient pas à votre boucherie");
    }

    const body = await req.json();
    const data = boucherActionSchema.parse(body);

    switch (data.action) {
      // ── ACCEPT ──────────────────────────────────
      case "accept": {
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

        const estimatedMinutes = Math.max(data.estimatedMinutes, prepMinutes);
        const estimatedReady = new Date(Date.now() + estimatedMinutes * 60_000);
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
        if (!canTransition(order.status, "DENIED")) {
          return apiError("VALIDATION_ERROR", `Impossible de refuser (statut: ${order.status})`);
        }

        const updated = await prisma.order.update({
          where: { id: orderId },
          data: { status: "DENIED", denyReason: data.reason },
        });

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

        return apiSuccess(updated);
      }

      // ── MARK READY ──────────────────────────────
      case "mark_ready": {
        if (!canTransition(order.status, "READY")) {
          return apiError("VALIDATION_ERROR", `Impossible de marquer prêt (statut: ${order.status})`);
        }

        const updated = await prisma.order.update({
          where: { id: orderId },
          data: { status: "READY", actualReady: new Date() },
        });

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

        // Auto-toggle product stock
        await prisma.product.updateMany({
          where: { id: { in: data.itemIds } },
          data: { inStock: false },
        });

        // Find alternatives
        const unavailableOrderItems = order.items.filter(
          (item) => data.itemIds.includes(item.productId)
        );

        const alternatives: Record<string, { id: string; name: string; priceCents: number }[]> = {};
        for (const item of unavailableOrderItems) {
          const alts = await prisma.product.findMany({
            where: {
              shopId: order.shop.id,
              categoryId: item.product.categoryId,
              inStock: true,
              id: { notIn: data.itemIds },
            },
            select: { id: true, name: true, priceCents: true },
            take: 3,
            orderBy: { priceCents: "asc" },
          });
          alternatives[item.productId] = alts;
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
        for (const adj of data.items) {
          const item = order.items.find((i) => i.id === adj.orderItemId);
          if (!item) continue;

          const newTotal = item.product.unit === "KG"
            ? Math.round(item.priceCents * (adj.actualWeightGrams / 1000))
            : item.totalCents;

          totalDiff += newTotal - item.totalCents;

          await prisma.orderItem.update({
            where: { id: adj.orderItemId },
            data: { weightGrams: adj.actualWeightGrams, totalCents: newTotal },
          });
        }

        const updated = await prisma.order.update({
          where: { id: orderId },
          data: { totalCents: order.totalCents + totalDiff },
          include: { items: true },
        });

        return apiSuccess(updated);
      }

      // ── ADJUST PRICE ────────────────────────────
      case "adjust_price": {
        if (order.status !== "ACCEPTED" && order.status !== "PREPARING") {
          return apiError("VALIDATION_ERROR", `Impossible d'ajuster le prix (statut: ${order.status})`);
        }

        let totalDiff = 0;
        for (const adj of data.items) {
          const item = order.items.find((i) => i.id === adj.orderItemId);
          if (!item) continue;

          const newTotal = Math.round(adj.newPriceCents * item.quantity);
          totalDiff += newTotal - item.totalCents;

          await prisma.orderItem.update({
            where: { id: adj.orderItemId },
            data: { priceCents: adj.newPriceCents, totalCents: newTotal },
          });
        }

        const updated = await prisma.order.update({
          where: { id: orderId },
          data: { totalCents: order.totalCents + totalDiff },
          include: { items: true },
        });

        return apiSuccess(updated);
      }

      // ── CONFIRM PICKUP (QR scan) ────────────────
      case "confirm_pickup": {
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

        await sendNotification("ORDER_PICKED_UP", {
          userId: order.user.id,
          orderId,
          orderNumber: order.orderNumber,
          shopName: order.shop.name,
        });

        // Send receipt email (fire-and-forget)
        sendReceiptForOrder(order, now).catch(() => {});

        return apiSuccess(updated);
      }

      // ── MANUAL PICKUP (boucher-side, no QR needed) ──
      case "manual_pickup": {
        if (order.status !== "READY") {
          return apiError("VALIDATION_ERROR", `La commande n'est pas prête (statut: ${order.status})`);
        }

        const manualNow = new Date();
        const manualUpdated = await prisma.order.update({
          where: { id: orderId },
          data: { status: "PICKED_UP", pickedUpAt: manualNow },
        });

        await sendNotification("ORDER_PICKED_UP", {
          userId: order.user.id,
          orderId,
          orderNumber: order.orderNumber,
          shopName: order.shop.name,
        });

        // Send receipt email (fire-and-forget)
        sendReceiptForOrder(order, manualNow).catch(() => {});

        return apiSuccess(manualUpdated);
      }

      // ── CANCEL (by boucher) ─────────────────────
      case "cancel": {
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendReceiptForOrder(order: any, pickedUpAt: Date) {
  try {
    await sendOrderReceiptEmail(order.user.email, {
      orderId: order.id,
      displayNumber: order.displayNumber || `#${order.orderNumber}`,
      customerFirstName: order.user.firstName,
      customerLastName: order.user.lastName,
      customerNumber: order.user.customerNumber || null,
      items: order.items.map((item: any) => ({
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
