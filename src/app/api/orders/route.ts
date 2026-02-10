import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { createOrderSchema, orderListQuerySchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";
import { getOrCreateUser } from "@/lib/get-or-create-user";

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
    });

    return apiSuccess(orders);
  } catch (error) {
    return handleApiError(error);
  }
}

// ── POST /api/orders ───────────────────────────
// Client — create a new order
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const body = await req.json();
    const data = createOrderSchema.parse(body);

    // Get internal user (auto-create if webhook hasn't fired)
    const user = await getOrCreateUser(userId);
    if (!user) {
      return apiError("NOT_FOUND", "Utilisateur introuvable");
    }

    const isPro = user.role === "CLIENT_PRO";

    // Verify shop exists and is open
    const shop = await prisma.shop.findUnique({
      where: { id: data.shopId },
      select: { id: true, isOpen: true, paused: true },
    });
    if (!shop) {
      return apiError("NOT_FOUND", "Boucherie introuvable");
    }
    if (!shop.isOpen || shop.paused) {
      return apiError("SERVICE_DISABLED", "La boucherie est actuellement fermée");
    }

    // Fetch products and verify stock
    const productIds = data.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, shopId: data.shopId },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Verify all products exist and are in stock
    for (const item of data.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return apiError("NOT_FOUND", `Produit ${item.productId} introuvable dans cette boucherie`);
      }
      if (!product.inStock) {
        return apiError("STOCK_INSUFFICIENT", `${product.name} n'est plus en stock`);
      }
    }

    // Calculate totalCents
    let totalCents = 0;
    const orderItems = data.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const unitPrice = isPro && product.proPriceCents ? product.proPriceCents : product.priceCents;
      const itemTotal = Math.round(unitPrice * item.quantity);
      totalCents += itemTotal;
      return {
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        unit: product.unit,
        priceCents: unitPrice,
        totalCents: itemTotal,
      };
    });

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

    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: user.id,
        isPro,
        shopId: data.shopId,
        status: "PENDING",
        requestedTime: data.requestedTime,
        customerNote: data.customerNote,
        totalCents,
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

    return apiSuccess(order, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
