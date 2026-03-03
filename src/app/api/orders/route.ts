import { NextRequest } from "next/server";

import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { createOrderSchema, orderListQuerySchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError, formatZodError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { autoApproveExpiredAdjustment } from "@/lib/price-adjustment";
import { getShopStatus } from "@/lib/shop-status";
import { setBusyMode } from "@/lib/shop-status";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { calculatePrepTime } from "@/lib/dynamic-prep-time";
import { getNextDailyNumber, ensureCustomerNumber } from "@/lib/services/numbering.service";
import { sendOrderConfirmationEmail } from "@/lib/emails/order-confirmation";
import { getServerUserId } from "@/lib/auth/server-auth";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";

export const dynamic = "force-dynamic";

// ── GET /api/orders ────────────────────────────
// Role-based: client sees own orders, boucher sees shop orders, admin sees all
export async function GET(req: NextRequest) {
  try {
    // @security: test-only — uses getServerUserId() for test mode bypass
    const userId = await getServerUserId();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    // Get user from DB to determine role
    const user = await getOrCreateUser(userId);
    if (!user) {
      return apiSuccess([]);
    }

    const role = user.role;
    const raw = Object.fromEntries(req.nextUrl.searchParams);
    const query = orderListQuerySchema.parse(raw);

    const where: Record<string, unknown> = {};

    if (query.status) {
      const validStatuses = ["PENDING", "ACCEPTED", "PREPARING", "READY", "PICKED_UP", "COMPLETED", "CANCELLED", "AUTO_CANCELLED", "DENIED"];
      if (!validStatuses.includes(query.status)) {
        return apiError("VALIDATION_ERROR", "Statut de commande invalide");
      }
      where.status = query.status;
    }

    if (role === "ADMIN") {
      // Admin sees all, optionally filtered by shopId
      if (query.shopId) where.shopId = query.shopId;
    } else if (role === "BOUCHER") {
      // Boucher sees orders of their shop(s)
      // Use getAuthenticatedBoucher() for reliable shop lookup (handles test mode + OR clause)
      const boucherAuth = await getAuthenticatedBoucher();
      if (boucherAuth.error) {
        // Fallback: search by clerkId and DB userId
        const shops = await prisma.shop.findMany({
          where: { OR: [{ ownerId: userId }, { ownerId: user.id }] },
          select: { id: true },
        });
        const shopIds = shops.map((s) => s.id);
        if (query.shopId && shopIds.includes(query.shopId)) {
          where.shopId = query.shopId;
        } else {
          where.shopId = { in: shopIds };
        }
      } else {
        const shopId = boucherAuth.shopId;
        if (query.shopId && query.shopId === shopId) {
          where.shopId = query.shopId;
        } else {
          where.shopId = shopId;
        }
      }
    } else {
      // Client sees own orders
      where.userId = user.id;
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: { include: { product: { select: { name: true, unit: true, vatRate: true, imageUrl: true } } } },
        shop: { select: { id: true, name: true, slug: true, imageUrl: true, address: true, city: true, siret: true, fullAddress: true, vatRate: true, priceAdjustmentThreshold: true } },
        user: { select: { firstName: true, lastName: true, customerNumber: true, phone: true, loyaltyBadge: true } },
        priceAdjustment: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Auto-approve expired price adjustments (batch instead of N+1)
    const expiredAdjustmentOrderIds = orders
      .filter((order) => {
        const adj = (order as Record<string, unknown>).priceAdjustment as { status?: string; autoApproveAt?: Date } | null;
        return adj?.status === "PENDING" && adj.autoApproveAt && new Date() >= new Date(adj.autoApproveAt);
      })
      .map((o) => o.id);

    if (expiredAdjustmentOrderIds.length > 0) {
      // Process all expired adjustments in parallel
      await Promise.all(expiredAdjustmentOrderIds.map((id) => autoApproveExpiredAdjustment(id)));

      // Re-fetch only the modified orders and merge
      const refreshed = await prisma.order.findMany({
        where: { id: { in: expiredAdjustmentOrderIds } },
        include: {
          items: { include: { product: { select: { name: true, unit: true, vatRate: true, imageUrl: true } } } },
          shop: { select: { id: true, name: true, slug: true, imageUrl: true, address: true, city: true, siret: true, fullAddress: true, vatRate: true, priceAdjustmentThreshold: true } },
          user: { select: { firstName: true, lastName: true, customerNumber: true, phone: true, loyaltyBadge: true } },
          priceAdjustment: true,
        },
      });
      const refreshedMap = new Map(refreshed.map((o) => [o.id, o]));
      const mergedOrders = orders.map((o) => refreshedMap.get(o.id) || o);
      return apiSuccess(mergedOrders);
    }

    return apiSuccess(orders);
  } catch (error) {
    return handleApiError(error);
  }
}

// ── POST /api/orders ───────────────────────────
// Client — create a new order (Uber Eats style with throttling + auto-cancel)
export async function POST(req: NextRequest) {
  try {
    // @security: test-only — uses getServerUserId() for test mode bypass
    const userId = await getServerUserId();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    // Rate limit check
    const rl = await checkRateLimit(rateLimits.orders, userId);
    if (!rl.success) {
      return apiError("CAPACITY_EXCEEDED", "Trop de commandes, veuillez patienter");
    }

    const body = await req.json();

    // Idempotency check (anti double-commande)
    if (body.idempotencyKey) {
      const existing = await prisma.order.findUnique({
        where: { idempotencyKey: body.idempotencyKey },
        include: {
          items: true,
          shop: { select: { id: true, name: true, slug: true } },
        },
      });
      if (existing) return apiSuccess(existing, 200);
    }

    const parseResult = createOrderSchema.safeParse(body);
    if (!parseResult.success) {
      return apiError("VALIDATION_ERROR", "Donnees invalides", formatZodError(parseResult.error));
    }
    const data = parseResult.data;

    // ── Phase 1: Parallel fetch — user + shop + products ──
    const productIds = data.items.map((i) => i.productId);
    const [user, shop, products] = await Promise.all([
      getOrCreateUser(userId),
      prisma.shop.findUnique({
        where: { id: data.shopId },
        select: {
          id: true, name: true, address: true, city: true, phone: true,
          status: true, autoAccept: true, acceptTimeoutMin: true,
          busyMode: true, busyExtraMin: true, prepTimeMin: true,
          maxOrdersPerSlot: true, maxOrdersPerHour: true, autoBusyThreshold: true,
          minOrderCents: true, commissionPct: true, commissionEnabled: true,
          vatRate: true,
        },
      }),
      prisma.product.findMany({
        where: { id: { in: productIds }, shopId: data.shopId },
      }),
    ]);

    if (!user) {
      return apiError("NOT_FOUND", "Utilisateur introuvable");
    }
    if (!shop) {
      return apiError("NOT_FOUND", "Boucherie introuvable");
    }

    const isPro = user.role === "CLIENT_PRO";

    // ── Phase 2: Parallel checks — shop status + throttling + slot ──
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const slotCheck = data.pickupSlotStart
      ? prisma.order.count({
          where: {
            shopId: shop.id,
            pickupSlotStart: new Date(data.pickupSlotStart),
            status: { notIn: ["CANCELLED", "AUTO_CANCELLED", "DENIED"] },
          },
        })
      : Promise.resolve(0);

    const [currentStatus, ordersLastHour, ordersInSlot] = await Promise.all([
      getShopStatus(shop.id),
      prisma.order.count({
        where: {
          shopId: shop.id,
          createdAt: { gte: oneHourAgo },
          status: { notIn: ["CANCELLED", "AUTO_CANCELLED", "DENIED"] },
        },
      }),
      slotCheck,
    ]);

    if (currentStatus !== "OPEN" && currentStatus !== "BUSY") {
      const messages: Record<string, string> = {
        PAUSED: "La boucherie a temporairement mis les commandes en pause",
        AUTO_PAUSED: "La boucherie est temporairement indisponible",
        CLOSED: "La boucherie est actuellement fermée",
        VACATION: "La boucherie est en vacances",
      };
      return apiError("SERVICE_DISABLED", messages[currentStatus] || "Boutique indisponible");
    }

    if (ordersLastHour >= shop.maxOrdersPerHour) {
      return apiError("CAPACITY_EXCEEDED", "La boutique est temporairement surchargée");
    }

    if (data.pickupSlotStart && ordersInSlot >= shop.maxOrdersPerSlot) {
      return apiError("CAPACITY_EXCEEDED", "Ce créneau est complet");
    }

    // Verify stock + snooze
    const productMap = new Map(products.map((p) => [p.id, p]));

    const missingProductIds: string[] = [];
    const unavailableProducts: string[] = [];

    for (const item of data.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        missingProductIds.push(item.productId);
        continue;
      }
      if (!product.inStock) {
        unavailableProducts.push(product.name);
      }
      if (product.snoozeType !== "NONE") {
        unavailableProducts.push(product.name);
      }
    }

    if (missingProductIds.length > 0) {
      return apiError(
        "PRODUCTS_MISSING",
        `${missingProductIds.length} produit(s) introuvable(s) — ils ont peut-etre ete supprimes. Veuillez actualiser votre panier.`,
        { missingProductIds }
      );
    }

    if (unavailableProducts.length > 0) {
      return apiError(
        "STOCK_INSUFFICIENT",
        `${unavailableProducts.join(", ")} — produit(s) indisponible(s)`
      );
    }

    // ── Calculate totalCents with promo + weight ──
    let totalCents = 0;
    const orderItems = data.items.map((item) => {
      const product = productMap.get(item.productId)!;
      let unitPrice = isPro && product.proPriceCents ? product.proPriceCents : product.priceCents;

      // Apply promo if active
      if (product.promoPct && product.promoEnd && new Date(product.promoEnd) > new Date()) {
        unitPrice = Math.round(unitPrice * (1 - product.promoPct / 100));
      }

      // Weight-based pricing for KG items
      const weightGrams = item.weightGrams ?? null;
      let itemTotal: number;
      if (product.unit === "KG" && weightGrams) {
        itemTotal = Math.round(unitPrice * (weightGrams / 1000));
      } else {
        itemTotal = Math.round(unitPrice * item.quantity);
      }

      totalCents += itemTotal;
      return {
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        unit: product.unit,
        priceCents: unitPrice,
        totalCents: itemTotal,
        weightGrams,
        itemNote: item.itemNote ?? null,
        sliceCount: item.sliceCount ?? null,
        sliceThickness: item.sliceThickness ?? null,
        estimatedPriceCents: itemTotal,
      };
    });

    // ── Apply promo / loyalty discount ──
    let discountCents = 0;
    let discountSource: string | null = null;
    let promotionId: string | null = null;
    let loyaltyRewardId: string | null = null;
    let promoCodeId: string | null = null;

    if (data.promoCodeId && data.discountCents) {
      // New unified PromoCode system
      const pc = await prisma.promoCode.findUnique({ where: { id: data.promoCodeId } });
      if (pc && pc.status === "ACTIVE" && new Date() >= pc.startsAt && new Date() <= pc.endsAt) {
        discountCents = Math.min(data.discountCents, totalCents);
        discountSource = pc.scope;
        promoCodeId = pc.id;
        // Increment usage + create usage record
        await Promise.all([
          prisma.promoCode.update({
            where: { id: pc.id },
            data: { currentUses: { increment: 1 } },
          }),
          prisma.promoCodeUsage.create({
            data: {
              promoCodeId: pc.id,
              userId: user.id,
              discountCents,
            },
          }),
        ]);
      }
    } else if (data.promotionId && data.discountCents && data.discountSource) {
      // Legacy Promotion system
      const promo = await prisma.promotion.findUnique({ where: { id: data.promotionId } });
      if (promo && promo.isActive && new Date() >= promo.startsAt && new Date() <= promo.endsAt) {
        discountCents = Math.min(data.discountCents, totalCents);
        discountSource = data.discountSource;
        promotionId = promo.id;
        await prisma.promotion.update({
          where: { id: promo.id },
          data: { currentUses: { increment: 1 } },
        });
      }
    } else if (data.loyaltyRewardId && data.discountCents) {
      const { markLoyaltyRewardUsed } = await import("@/lib/services/loyalty.service");
      const reward = await prisma.loyaltyReward.findUnique({ where: { id: data.loyaltyRewardId } });
      if (reward && !reward.usedAt && reward.userId === user.id) {
        discountCents = Math.min(data.discountCents, totalCents);
        discountSource = "LOYALTY";
        loyaltyRewardId = reward.id;
        markLoyaltyRewardUsed(reward.id, "pending-order").catch(() => {});
      }
    }

    const finalTotalCents = Math.max(0, totalCents - discountCents);

    // ── Min order check (on original total before discount) ──
    if (shop.minOrderCents > 0 && totalCents < shop.minOrderCents) {
      return apiError(
        "VALIDATION_ERROR",
        `Commande minimum de ${(shop.minOrderCents / 100).toFixed(2)}€ requise`
      );
    }

    // ── Commission calc (on final total after discount) ──
    const commissionCents = shop.commissionEnabled
      ? Math.round(finalTotalCents * (shop.commissionPct / 100))
      : 0;

    // ── Phase 3: Parallel — orderNumber + ticket numbering + prep time ──
    const year = new Date().getFullYear();
    const prefix = `KG-${year}-`;
    const itemCount = data.items.reduce((sum, i) => sum + i.quantity, 0);

    const [lastOrder, dailyResult, _customerNumber, prepMinutes] = await Promise.all([
      prisma.order.findFirst({
        where: { orderNumber: { startsWith: prefix } },
        orderBy: { orderNumber: "desc" },
        select: { orderNumber: true },
      }),
      getNextDailyNumber(data.shopId),
      ensureCustomerNumber(user.id, data.shopId),
      calculatePrepTime({
        shopId: shop.id,
        basePrepMin: shop.prepTimeMin,
        busyMode: shop.busyMode,
        busyExtraMin: shop.busyExtraMin,
        itemCount,
      }),
    ]);

    const nextNum = lastOrder
      ? parseInt(lastOrder.orderNumber.slice(prefix.length), 10) + 1
      : 1;
    const orderNumber = `${prefix}${String(nextNum).padStart(5, "0")}`;
    const { dailyNumber, displayNumber } = dailyResult;

    // Scheduled order detection (for notification purposes only — NOT auto-accepted)
    const isScheduled = !!data.pickupSlotStart && new Date(data.pickupSlotStart).getTime() > Date.now();

    // Auto-cancel timer (Uber Eats style)
    const expiresAt = new Date(Date.now() + shop.acceptTimeoutMin * 60 * 1000);
    const initialStatus = shop.autoAccept ? "ACCEPTED" : "PENDING";

    const qrCode = initialStatus === "ACCEPTED" ? randomUUID() : null;
    const estimatedReady = shop.autoAccept
      ? (isScheduled ? new Date(data.pickupSlotStart!) : new Date(Date.now() + prepMinutes * 60_000))
      : null;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        dailyNumber,
        displayNumber,
        userId: user.id,
        isPro,
        shopId: data.shopId,
        status: initialStatus,
        requestedTime: data.requestedTime,
        customerNote: data.customerNote,
        totalCents: finalTotalCents,
        commissionCents,
        discountCents: discountCents > 0 ? discountCents : undefined,
        discountSource: discountSource || undefined,
        promotionId: promotionId || undefined,
        loyaltyRewardId: loyaltyRewardId || undefined,
        promoCodeId: promoCodeId || undefined,
        expiresAt: initialStatus === "PENDING" ? expiresAt : null,
        idempotencyKey: body.idempotencyKey || null,
        pickupSlotStart: data.pickupSlotStart ? new Date(data.pickupSlotStart) : null,
        pickupSlotEnd: data.pickupSlotEnd ? new Date(data.pickupSlotEnd) : null,
        qrCode,
        estimatedReady,
        paymentMethod: data.paymentMethod ?? "ON_PICKUP",
        items: { create: orderItems },
      },
      include: {
        items: true,
        shop: { select: { id: true, name: true, slug: true } },
      },
    });

    // ── Fire-and-forget: notifications + email + auto-busy ──
    // These don't block the response — saves ~300-800ms
    const pickupTimeStr = isScheduled
      ? new Date(data.pickupSlotStart!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      : undefined;

    Promise.all([
      // Boucher notification: always ORDER_PENDING (scheduled orders need manual acceptance too)
      sendNotification("ORDER_PENDING", {
        shopId: order.shopId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: user.firstName,
        slot: pickupTimeStr,
      }),
      sendOrderConfirmationEmail(user.email, {
        orderId: order.id,
        displayNumber,
        customerFirstName: user.firstName,
        items: orderItems.map((oi) => ({
          name: oi.name,
          quantity: oi.quantity,
          unit: oi.unit,
          totalCents: oi.totalCents,
          weightGrams: oi.weightGrams,
        })),
        totalCents: finalTotalCents,
        shopName: shop.name,
        shopAddress: shop.address,
        shopCity: shop.city,
        prepTimeMin: isScheduled ? 0 : prepMinutes,
      }),
      // Auto-busy check
      prisma.order.count({
        where: {
          shopId: shop.id,
          status: { in: ["PENDING", "ACCEPTED", "PREPARING"] },
        },
      }).then((activeOrders) => {
        if (activeOrders >= shop.autoBusyThreshold && !shop.busyMode) {
          return setBusyMode(shop.id, { extraMin: 15, durationMin: 30 });
        }
      }),
    ]).catch((err) => console.error("[orders/POST] background error:", err));

    return apiSuccess(order, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
