import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { createOrderSchema, orderListQuerySchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError, formatZodError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { getShopStatus } from "@/lib/shop-status";
import { setBusyMode } from "@/lib/shop-status";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { calculatePrepTime } from "@/lib/dynamic-prep-time";

export const dynamic = "force-dynamic";

// ── GET /api/orders ────────────────────────────
// Role-based: client sees own orders, boucher sees shop orders, admin sees all
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

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
      where.status = query.status;
    }

    if (role === "ADMIN") {
      // Admin sees all, optionally filtered by shopId
      if (query.shopId) where.shopId = query.shopId;
    } else if (role === "BOUCHER") {
      // Boucher sees orders of their shop(s)
      const shops = await prisma.shop.findMany({
        where: { ownerId: userId },
        select: { id: true },
      });
      const shopIds = shops.map((s) => s.id);
      if (query.shopId && shopIds.includes(query.shopId)) {
        where.shopId = query.shopId;
      } else {
        where.shopId = { in: shopIds };
      }
    } else {
      // Client sees own orders
      where.userId = user.id;
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
        shop: { select: { id: true, name: true, slug: true, imageUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return apiSuccess(orders);
  } catch (error) {
    return handleApiError(error);
  }
}

// ── POST /api/orders ───────────────────────────
// Client — create a new order (Uber Eats style with throttling + auto-cancel)
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

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

    // Get internal user (auto-create if webhook hasn't fired)
    const user = await getOrCreateUser(userId);
    if (!user) {
      return apiError("NOT_FOUND", "Utilisateur introuvable");
    }

    const isPro = user.role === "CLIENT_PRO";

    // ── Check shop status via Redis-cached getShopStatus ──
    const shop = await prisma.shop.findUnique({
      where: { id: data.shopId },
      select: {
        id: true, status: true, autoAccept: true, acceptTimeoutMin: true,
        busyMode: true, busyExtraMin: true, prepTimeMin: true,
        maxOrdersPerSlot: true, maxOrdersPerHour: true, autoBusyThreshold: true,
        minOrderCents: true, commissionPct: true, commissionEnabled: true,
      },
    });
    if (!shop) {
      return apiError("NOT_FOUND", "Boucherie introuvable");
    }

    const currentStatus = await getShopStatus(shop.id);
    if (currentStatus !== "OPEN" && currentStatus !== "BUSY") {
      const messages: Record<string, string> = {
        PAUSED: "La boucherie a temporairement mis les commandes en pause",
        AUTO_PAUSED: "La boucherie est temporairement indisponible",
        CLOSED: "La boucherie est actuellement fermée",
        VACATION: "La boucherie est en vacances",
      };
      return apiError("SERVICE_DISABLED", messages[currentStatus] || "Boutique indisponible");
    }

    // ── Order throttling (Uber Eats style) ──
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const ordersLastHour = await prisma.order.count({
      where: {
        shopId: shop.id,
        createdAt: { gte: oneHourAgo },
        status: { notIn: ["CANCELLED", "AUTO_CANCELLED", "DENIED"] },
      },
    });
    if (ordersLastHour >= shop.maxOrdersPerHour) {
      return apiError("CAPACITY_EXCEEDED", "La boutique est temporairement surchargée");
    }

    // Check max orders per slot (if pickup slot specified)
    if (data.pickupSlotStart) {
      const ordersInSlot = await prisma.order.count({
        where: {
          shopId: shop.id,
          pickupSlotStart: new Date(data.pickupSlotStart),
          status: { notIn: ["CANCELLED", "AUTO_CANCELLED", "DENIED"] },
        },
      });
      if (ordersInSlot >= shop.maxOrdersPerSlot) {
        return apiError("CAPACITY_EXCEEDED", "Ce créneau est complet");
      }
    }

    // Fetch products and verify stock + snooze
    const productIds = data.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, shopId: data.shopId },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of data.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return apiError("NOT_FOUND", `Produit ${item.productId} introuvable dans cette boucherie`);
      }
      if (!product.inStock) {
        return apiError("STOCK_INSUFFICIENT", `${product.name} n'est plus en stock`);
      }
      if (product.snoozeType !== "NONE") {
        return apiError("STOCK_INSUFFICIENT", `${product.name} est temporairement indisponible`);
      }
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
      };
    });

    // ── Min order check ──
    if (shop.minOrderCents > 0 && totalCents < shop.minOrderCents) {
      return apiError(
        "VALIDATION_ERROR",
        `Commande minimum de ${(shop.minOrderCents / 100).toFixed(2)}€ requise`
      );
    }

    // ── Commission calc ──
    const commissionCents = shop.commissionEnabled
      ? Math.round(totalCents * (shop.commissionPct / 100))
      : 0;

    // Generate orderNumber: KG-YYYY-XXXXX
    const year = new Date().getFullYear();
    const prefix = `KG-${year}-`;
    const lastOrder = await prisma.order.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });
    const nextNum = lastOrder
      ? parseInt(lastOrder.orderNumber.slice(prefix.length), 10) + 1
      : 1;
    const orderNumber = `${prefix}${String(nextNum).padStart(5, "0")}`;

    // Auto-cancel timer (Uber Eats style)
    const expiresAt = new Date(Date.now() + shop.acceptTimeoutMin * 60 * 1000);
    const initialStatus = shop.autoAccept ? "ACCEPTED" : "PENDING";

    // ── Dynamic prep time + QR + estimatedReady ──
    const itemCount = data.items.reduce((sum, i) => sum + i.quantity, 0);
    const prepMinutes = await calculatePrepTime({
      shopId: shop.id,
      basePrepMin: shop.prepTimeMin,
      busyMode: shop.busyMode,
      busyExtraMin: shop.busyExtraMin,
      itemCount,
    });

    const qrCode = shop.autoAccept ? randomUUID() : null;
    const estimatedReady = shop.autoAccept
      ? new Date(Date.now() + prepMinutes * 60_000)
      : null;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: user.id,
        isPro,
        shopId: data.shopId,
        status: initialStatus,
        requestedTime: data.requestedTime,
        customerNote: data.customerNote,
        totalCents,
        commissionCents,
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

    // Notify boucher
    await sendNotification("ORDER_PENDING", {
      shopId: order.shopId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: user.firstName,
    });

    // Auto-busy if threshold reached (Uber Eats style)
    const activeOrders = await prisma.order.count({
      where: {
        shopId: shop.id,
        status: { in: ["PENDING", "ACCEPTED", "PREPARING"] },
      },
    });
    if (activeOrders >= shop.autoBusyThreshold && !shop.busyMode) {
      await setBusyMode(shop.id, { extraMin: 15, durationMin: 30 });
    }

    return apiSuccess(order, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
