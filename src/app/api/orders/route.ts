import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createOrderSchema, paginationSchema } from "@/lib/validators";
import { apiSuccess, apiError, apiPaginated, handleApiError } from "@/lib/api/errors";
import { generateOrderNumber, paymentService, notificationService } from "@/lib/services";

// ── GET: List orders (by userId or guestPhone) ──

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const { page, perPage } = paginationSchema.parse(params);
    const userId = req.nextUrl.searchParams.get("userId");
    const guestPhone = req.nextUrl.searchParams.get("guestPhone");
    const shopId = req.nextUrl.searchParams.get("shopId");

    if (!userId && !guestPhone && !shopId) {
      return apiError("VALIDATION_ERROR", "userId, guestPhone ou shopId requis");
    }

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (guestPhone) where.guestPhone = guestPhone;
    if (shopId) where.shopId = shopId;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          timeline: { orderBy: { createdAt: "asc" } },
          shop: { select: { id: true, name: true, slug: true, imageUrl: true } },
          payment: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.order.count({ where }),
    ]);

    return apiPaginated(orders, total, page, perPage);
  } catch (error) {
    return handleApiError(error);
  }
}

// ── POST: Create new order ───────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createOrderSchema.parse(body);

    // 1. Check shop is active
    const shop = await prisma.shop.findUnique({
      where: { id: data.shopId },
      select: { id: true, isServiceActive: true, maxOrdersPer15: true, name: true },
    });

    if (!shop) return apiError("NOT_FOUND", "Boucherie introuvable");
    if (!shop.isServiceActive) {
      return apiError("SERVICE_DISABLED", "Le service est actuellement désactivé pour cette boucherie");
    }

    // 2. Check capacity (orders in last 15 min)
    const fifteenMinAgo = new Date(Date.now() - 15 * 60_000);
    const recentOrders = await prisma.order.count({
      where: {
        shopId: data.shopId,
        createdAt: { gte: fifteenMinAgo },
        status: { notIn: ["CANCELLED", "COLLECTED"] },
      },
    });
    if (recentOrders >= shop.maxOrdersPer15) {
      return apiError("CAPACITY_EXCEEDED", "Capacité maximale atteinte, réessayez dans quelques minutes");
    }

    // 3. Resolve items and calculate prices
    let subtotalCents = 0;
    const orderItems: Array<{
      productId?: string;
      packId?: string;
      name: string;
      imageUrl: string;
      unit: "KG" | "PIECE" | "BARQUETTE";
      quantity: number;
      requestedWeight?: number;
      unitPriceCents: number;
      totalPriceCents: number;
      needsValidation: boolean;
    }> = [];

    for (const item of data.items) {
      if (item.productId) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });
        if (!product) return apiError("NOT_FOUND", `Produit ${item.productId} introuvable`);
        if (!product.isInStock) return apiError("STOCK_INSUFFICIENT", `${product.name} n'est plus en stock`);

        // Check stock qty for PIECE/BARQUETTE
        if (product.unit !== "KG" && product.stockQty !== null && product.stockQty < item.quantity) {
          return apiError("STOCK_INSUFFICIENT", `Stock insuffisant pour ${product.name} (${product.stockQty} disponibles)`);
        }

        // Determine if this is PRO pricing
        const isPro = data.userId
          ? (await prisma.user.findUnique({ where: { id: data.userId }, select: { role: true } }))?.role === "PRO"
          : false;
        const unitPrice = isPro && product.proPriceCents ? product.proPriceCents : product.priceCents;

        let total: number;
        if (product.unit === "KG" && item.weightGrams) {
          total = Math.round((item.weightGrams / 1000) * unitPrice);
        } else {
          total = unitPrice * item.quantity;
        }

        subtotalCents += total;
        orderItems.push({
          productId: product.id,
          name: product.name,
          imageUrl: product.imageUrl,
          unit: product.unit,
          quantity: item.quantity,
          requestedWeight: item.weightGrams,
          unitPriceCents: unitPrice,
          totalPriceCents: total,
          needsValidation: false,
        });
      } else if (item.packId) {
        const pack = await prisma.pack.findUnique({
          where: { id: item.packId },
          include: { items: true },
        });
        if (!pack) return apiError("NOT_FOUND", `Pack ${item.packId} introuvable`);
        if (!pack.isInStock || pack.stockQty < item.quantity) {
          return apiError("STOCK_INSUFFICIENT", `Stock insuffisant pour ${pack.name}`);
        }

        const isPro = data.userId
          ? (await prisma.user.findUnique({ where: { id: data.userId }, select: { role: true } }))?.role === "PRO"
          : false;
        const unitPrice = isPro && pack.proPriceCents ? pack.proPriceCents : pack.priceCents;
        const total = unitPrice * item.quantity;

        subtotalCents += total;
        orderItems.push({
          packId: pack.id,
          name: pack.name,
          imageUrl: pack.imageUrl,
          unit: "PIECE",
          quantity: item.quantity,
          unitPriceCents: unitPrice,
          totalPriceCents: total,
          needsValidation: false,
        });
      }
    }

    // 4. Create the order + items + initial timeline
    const orderNumber = await generateOrderNumber();

    const order = await prisma.order.create({
      data: {
        orderNumber,
        shopId: data.shopId,
        userId: data.userId,
        guestPhone: data.guestPhone,
        status: "PENDING",
        paymentStatus: "PENDING",
        paymentMethod: data.paymentMethod,
        subtotalCents,
        totalCents: subtotalCents,
        items: {
          create: orderItems,
        },
        timeline: {
          create: {
            status: "PENDING",
            message: "Commande passée",
            detail: data.guestPhone ? "Commande invité" : undefined,
          },
        },
      },
      include: {
        items: true,
        timeline: true,
        shop: { select: { name: true } },
      },
    });

    // 5. Create payment intent
    await paymentService.createPayment(order.id, subtotalCents, data.paymentMethod);

    // 6. Auto-confirm for CASH / CB_SHOP (mock)
    if (data.paymentMethod === "CB_ONLINE") {
      // In real flow, client would confirm on frontend
      // For mock, auto-confirm
      await paymentService.confirmPayment(order.id);
    }

    // 7. Send notification stub
    if (data.userId) {
      await notificationService.send({
        userId: data.userId,
        orderId: order.id,
        channel: "SMS",
        title: "Commande confirmée",
        body: `Votre commande ${orderNumber} chez ${order.shop.name} a été enregistrée.`,
      });
    }

    return apiSuccess(order, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
