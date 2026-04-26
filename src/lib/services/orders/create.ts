import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { createOrderSchema } from "@/lib/validators";
import { formatZodError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { getShopStatus, setBusyMode } from "@/lib/shop-status";
import { calculatePrepTime } from "@/lib/dynamic-prep-time";
import { getNextDailyNumber, ensureCustomerNumber } from "@/lib/services/numbering.service";
import { sendOrderConfirmationEmail } from "@/lib/emails/order-confirmation";
import { logger } from "@/lib/logger";

type CreateErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "SERVICE_DISABLED"
  | "CAPACITY_EXCEEDED"
  | "PRODUCTS_MISSING"
  | "STOCK_INSUFFICIENT";

export type CreateOrderResult =
  | { ok: true; order: unknown; status: 200 | 201 }
  | { ok: false; code: CreateErrorCode; message: string; details?: Record<string, string[]> | { missingProductIds: string[] } };

/**
 * Create a new order — called from POST /api/orders (Clerk users) and
 * POST /api/checkout/guest (anonymous users with shadow Prisma User).
 *
 * Handles idempotency, pricing, stock, throttling, slot validation, auto-cancel timer,
 * numbering and fire-and-forget notifications.
 *
 * @param body - Raw JSON body (already parsed from request)
 * @param userOrClerkId - Either a Clerk id string (Clerk-authenticated path) or
 *                       a pre-resolved Prisma User (guest checkout path).
 */
export async function createOrder(
  body: unknown,
  userOrClerkId: string | { id: string; firstName: string; lastName: string; email: string; role: string; clerkId: string | null }
): Promise<CreateOrderResult> {
  const bodyRecord = (body ?? {}) as Record<string, unknown>;

  // Idempotency check (anti double-commande)
  const idempotencyKey = typeof bodyRecord.idempotencyKey === "string" ? bodyRecord.idempotencyKey : null;
  if (idempotencyKey) {
    const existing = await prisma.order.findUnique({
      where: { idempotencyKey },
      include: {
        items: true,
        shop: { select: { id: true, name: true, slug: true } },
      },
    });
    if (existing) return { ok: true, order: existing, status: 200 };
  }

  const parseResult = createOrderSchema.safeParse(body);
  if (!parseResult.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Donnees invalides",
      details: formatZodError(parseResult.error),
    };
  }
  const data = parseResult.data;

  // ── Phase 1: Parallel fetch — user + shop + products ──
  // Guest path passes a pre-resolved Prisma User; Clerk path passes a clerkId string.
  const productIds = data.items.map((i) => i.productId);
  const userPromise =
    typeof userOrClerkId === "string" ? getOrCreateUser(userOrClerkId) : Promise.resolve(userOrClerkId);
  const [user, shop, products] = await Promise.all([
    userPromise,
    prisma.shop.findUnique({
      where: { id: data.shopId },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        phone: true,
        status: true,
        autoAccept: true,
        acceptTimeoutMin: true,
        busyMode: true,
        busyExtraMin: true,
        prepTimeMin: true,
        maxOrdersPerSlot: true,
        maxOrdersPerHour: true,
        autoBusyThreshold: true,
        minOrderCents: true,
        commissionPct: true,
        commissionEnabled: true,
        vatRate: true,
      },
    }),
    prisma.product.findMany({
      where: { id: { in: productIds }, shopId: data.shopId },
    }),
  ]);

  if (!user) {
    return { ok: false, code: "NOT_FOUND", message: "Utilisateur introuvable" };
  }
  if (!shop) {
    return { ok: false, code: "NOT_FOUND", message: "Boucherie introuvable" };
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
    return {
      ok: false,
      code: "SERVICE_DISABLED",
      message: messages[currentStatus] || "Boutique indisponible",
    };
  }

  if (ordersLastHour >= shop.maxOrdersPerHour) {
    return { ok: false, code: "CAPACITY_EXCEEDED", message: "La boutique est temporairement surchargée" };
  }

  if (data.pickupSlotStart && ordersInSlot >= shop.maxOrdersPerSlot) {
    return { ok: false, code: "CAPACITY_EXCEEDED", message: "Ce créneau est complet" };
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
    if (product.isAntiGaspi && product.antiGaspiStock !== null && item.quantity > product.antiGaspiStock) {
      unavailableProducts.push(`${product.name} (stock limite: ${product.antiGaspiStock})`);
    }
    if (product.isFlashSale && product.flashSaleStock !== null && item.quantity > product.flashSaleStock) {
      unavailableProducts.push(`${product.name} (stock limite: ${product.flashSaleStock})`);
    }
  }

  if (missingProductIds.length > 0) {
    return {
      ok: false,
      code: "PRODUCTS_MISSING",
      message: `${missingProductIds.length} produit(s) introuvable(s) — ils ont peut-etre ete supprimes. Veuillez actualiser votre panier.`,
      details: { missingProductIds },
    };
  }

  if (unavailableProducts.length > 0) {
    return {
      ok: false,
      code: "STOCK_INSUFFICIENT",
      message: `${unavailableProducts.join(", ")} — produit(s) indisponible(s)`,
    };
  }

  // ── Calculate totalCents with promo + weight ──
  let totalCents = 0;
  const orderItems = data.items.map((item) => {
    const product = productMap.get(item.productId)!;
    let unitPrice = isPro && product.proPriceCents ? product.proPriceCents : product.priceCents;

    if (item.cutPriceCents) {
      unitPrice = item.cutPriceCents;
    }

    if (
      product.promoPct &&
      product.promoType !== "FIXED_AMOUNT" &&
      product.promoEnd &&
      new Date(product.promoEnd) > new Date()
    ) {
      unitPrice = Math.round(unitPrice * (1 - product.promoPct / 100));
    }
    if (product.promoType === "FIXED_AMOUNT" && product.promoFixedCents) {
      unitPrice = Math.max(0, unitPrice - product.promoFixedCents);
    }

    const weightGrams = item.weightGrams ?? null;
    let itemTotal: number;
    if (product.unit === "KG" && weightGrams) {
      itemTotal = Math.round(unitPrice * (weightGrams / 1000) * item.quantity);
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
      variant: item.variant ?? null,
      pieceCount: item.pieceCount ?? null,
      pieceLabel: item.pieceLabel ?? null,
      cutOption: item.cutOption ?? null,
      cutPriceCents: item.cutPriceCents ?? null,
      estimatedPriceCents: itemTotal,
    };
  });

  // ── Resolve offer/loyalty (read-only here — actual mutation happens inside the
  // transaction below to keep coupon-consumption + order.create atomic) ──
  let discountCents = 0;
  let discountSource: string | null = null;
  let offerId: string | null = null;
  let loyaltyRewardId: string | null = null;

  if (data.offerId && data.discountCents) {
    const offer = await prisma.offer.findUnique({ where: { id: data.offerId } });
    if (offer && offer.status === "ACTIVE" && new Date() >= offer.startDate && new Date() <= offer.endDate) {
      discountCents = Math.min(data.discountCents, totalCents);
      discountSource = offer.shopId ? "SHOP" : "PLATFORM";
      offerId = offer.id;
    }
  } else if (data.loyaltyRewardId && data.discountCents) {
    const reward = await prisma.loyaltyReward.findUnique({ where: { id: data.loyaltyRewardId } });
    if (reward && !reward.usedAt && reward.userId === user.id) {
      discountCents = Math.min(data.discountCents, totalCents);
      discountSource = "LOYALTY";
      loyaltyRewardId = reward.id;
    }
  }

  const finalTotalCents = Math.max(0, totalCents - discountCents);

  // ── Min order check (on original total before discount) ──
  if (shop.minOrderCents > 0 && totalCents < shop.minOrderCents) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: `Commande minimum de ${(shop.minOrderCents / 100).toFixed(2)}€ requise`,
    };
  }

  // ── Commission calc (on final total after discount) ──
  const commissionCents = shop.commissionEnabled
    ? Math.round(finalTotalCents * (shop.commissionPct / 100))
    : 0;

  // ── Phase 3: Parallel — orderNumber + ticket numbering + prep time ──
  const year = new Date().getFullYear();
  const prefix = `KG-${year}-`;
  const itemCount = data.items.reduce((sum, i) => sum + i.quantity, 0);

  const [dailyResult, _customerNumber, prepMinutes] = await Promise.all([
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

  const { dailyNumber, displayNumber } = dailyResult;

  // Scheduled order detection (notification purposes — NOT auto-accepted)
  const isScheduled = !!data.pickupSlotStart && new Date(data.pickupSlotStart).getTime() > Date.now();

  // Auto-cancel timer (Uber Eats style)
  const expiresAt = new Date(Date.now() + shop.acceptTimeoutMin * 60 * 1000);
  const initialStatus = shop.autoAccept ? "ACCEPTED" : "PENDING";

  const qrCode = initialStatus === "ACCEPTED" ? randomUUID() : null;
  const estimatedReady = shop.autoAccept
    ? isScheduled
      ? new Date(data.pickupSlotStart!)
      : new Date(Date.now() + prepMinutes * 60_000)
    : null;

  // ── Race-safe orderNumber generation ──
  // Under concurrent load, two simultaneous creates can compute the same next
  // orderNumber and collide on the @unique constraint (P2002). We retry up to
  // MAX_RETRIES times, recomputing the number from the latest DB row each pass.
  const MAX_RETRIES = 3;
  let order: Awaited<ReturnType<typeof createOrderRow>> | null = null;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const lastOrder = await prisma.order.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });
    const nextNum = lastOrder ? parseInt(lastOrder.orderNumber.slice(prefix.length), 10) + 1 : 1;
    const orderNumber = `${prefix}${String(nextNum + attempt).padStart(5, "0")}`;
    try {
      // Atomic: consume coupon/loyalty + create order in a single transaction.
      // If the order.create fails, the offer/loyalty mutations roll back automatically.
      order = await prisma.$transaction(async (tx) => {
        if (offerId) {
          await tx.offer.update({
            where: { id: offerId },
            data: { currentUses: { increment: 1 } },
          });
        }
        if (loyaltyRewardId) {
          await tx.loyaltyReward.update({
            where: { id: loyaltyRewardId },
            data: { usedAt: new Date() },
          });
        }
        return createOrderRow(
          {
            orderNumber,
            dailyNumber,
            displayNumber,
            userId: user.id,
            isPro,
            shopId: data.shopId,
            initialStatus,
            requestedTime: data.requestedTime,
            customerNote: data.customerNote,
            finalTotalCents,
            commissionCents,
            discountCents,
            discountSource,
            offerId,
            loyaltyRewardId,
            expiresAt: initialStatus === "PENDING" ? expiresAt : null,
            idempotencyKey,
            pickupSlotStart: data.pickupSlotStart ? new Date(data.pickupSlotStart) : null,
            pickupSlotEnd: data.pickupSlotEnd ? new Date(data.pickupSlotEnd) : null,
            qrCode,
            estimatedReady,
            paymentMethod: data.paymentMethod ?? "ON_PICKUP",
            items: orderItems,
          },
          tx
        );
      });
      break;
    } catch (err) {
      lastErr = err;
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        attempt < MAX_RETRIES - 1
      ) {
        logger.warn("[orders/create] orderNumber collision, retrying", { attempt, orderNumber });
        continue;
      }
      throw err;
    }
  }
  if (!order) {
    logger.error("[orders/create] orderNumber retry exhausted", { err: lastErr });
    return { ok: false, code: "VALIDATION_ERROR", message: "Conflit de numéro de commande, réessayez" };
  }

  // ── Fire-and-forget: notifications + email + auto-busy ──
  const pickupTimeStr = isScheduled
    ? new Date(data.pickupSlotStart!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : undefined;

  Promise.all([
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
    prisma.order
      .count({
        where: {
          shopId: shop.id,
          status: { in: ["PENDING", "ACCEPTED", "PREPARING"] },
        },
      })
      .then((activeOrders) => {
        if (activeOrders >= shop.autoBusyThreshold && !shop.busyMode) {
          return setBusyMode(shop.id, { extraMin: 15, durationMin: 30 });
        }
      }),
  ]).catch((err) => logger.error("[orders/create] background error", { err }));

  return { ok: true, order, status: 201 };
}

interface CreateOrderRowInput {
  orderNumber: string;
  dailyNumber: number;
  displayNumber: string;
  userId: string;
  isPro: boolean;
  shopId: string;
  initialStatus: "PENDING" | "ACCEPTED";
  requestedTime?: string;
  customerNote?: string;
  finalTotalCents: number;
  commissionCents: number;
  discountCents: number;
  discountSource: string | null;
  offerId: string | null;
  loyaltyRewardId: string | null;
  expiresAt: Date | null;
  idempotencyKey: string | null;
  pickupSlotStart: Date | null;
  pickupSlotEnd: Date | null;
  qrCode: string | null;
  estimatedReady: Date | null;
  paymentMethod: "ONLINE" | "ON_PICKUP";
  // Looser typing on items: this matches the inline shape built upstream.
  items: Array<Record<string, unknown>>;
}

async function createOrderRow(
  input: CreateOrderRowInput,
  client: Prisma.TransactionClient | typeof prisma = prisma
) {
  return client.order.create({
    data: {
      orderNumber: input.orderNumber,
      dailyNumber: input.dailyNumber,
      displayNumber: input.displayNumber,
      userId: input.userId,
      isPro: input.isPro,
      shopId: input.shopId,
      status: input.initialStatus,
      requestedTime: input.requestedTime,
      customerNote: input.customerNote,
      totalCents: input.finalTotalCents,
      commissionCents: input.commissionCents,
      discountCents: input.discountCents > 0 ? input.discountCents : undefined,
      discountAmount: input.discountCents > 0 ? input.discountCents / 100 : undefined,
      discountSource: input.discountSource || undefined,
      offerId: input.offerId || undefined,
      loyaltyRewardId: input.loyaltyRewardId || undefined,
      expiresAt: input.expiresAt,
      idempotencyKey: input.idempotencyKey,
      pickupSlotStart: input.pickupSlotStart,
      pickupSlotEnd: input.pickupSlotEnd,
      qrCode: input.qrCode,
      estimatedReady: input.estimatedReady,
      paymentMethod: input.paymentMethod,
      items: { create: input.items as unknown as Prisma.OrderItemCreateWithoutOrderInput[] },
    },
    include: {
      items: true,
      shop: { select: { id: true, name: true, slug: true } },
    },
  });
}
