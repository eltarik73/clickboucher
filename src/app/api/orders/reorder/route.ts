// POST /api/orders/reorder — Re-create an order from an existing one (1-click reorder)
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const user = await getOrCreateUser(userId);
    if (!user) return apiError("NOT_FOUND", "Utilisateur introuvable");

    const { orderId } = await req.json();
    if (!orderId) return apiError("VALIDATION_ERROR", "orderId requis");

    // Fetch original order
    const original = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        shop: { select: { id: true, name: true, slug: true, status: true, autoAccept: true, acceptTimeoutMin: true, prepTimeMin: true } },
      },
    });

    if (!original) return apiError("NOT_FOUND", "Commande originale introuvable");
    if (original.userId !== user.id) return apiError("FORBIDDEN", "Cette commande ne vous appartient pas");

    // Verify all products still available
    const productIds = original.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, shopId: original.shopId },
      select: { id: true, name: true, inStock: true, snoozeType: true, priceCents: true, proPriceCents: true, unit: true, promoPct: true, promoEnd: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));
    const unavailable: string[] = [];
    const isPro = user.role === "CLIENT_PRO";

    let totalCents = 0;
    const orderItems = original.items
      .filter((item) => {
        const p = productMap.get(item.productId);
        if (!p || !p.inStock || p.snoozeType !== "NONE") {
          unavailable.push(item.name);
          return false;
        }
        return true;
      })
      .map((item) => {
        const p = productMap.get(item.productId)!;
        let unitPrice = isPro && p.proPriceCents ? p.proPriceCents : p.priceCents;
        if (p.promoPct && p.promoEnd && new Date(p.promoEnd) > new Date()) {
          unitPrice = Math.round(unitPrice * (1 - p.promoPct / 100));
        }

        const itemTotal = item.weightGrams
          ? Math.round(unitPrice * (item.weightGrams / 1000))
          : Math.round(unitPrice * item.quantity);

        totalCents += itemTotal;

        return {
          productId: p.id,
          name: item.name,
          quantity: item.quantity,
          unit: p.unit,
          priceCents: unitPrice,
          totalCents: itemTotal,
          weightGrams: item.weightGrams,
          itemNote: item.itemNote,
        };
      });

    if (orderItems.length === 0) {
      return apiError("STOCK_INSUFFICIENT", "Aucun produit de cette commande n'est disponible actuellement");
    }

    // Generate order number
    const year = new Date().getFullYear();
    const prefix = `KG-${year}-`;
    const lastOrder = await prisma.order.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });
    const nextNum = lastOrder ? parseInt(lastOrder.orderNumber.slice(prefix.length), 10) + 1 : 1;
    const orderNumber = `${prefix}${String(nextNum).padStart(5, "0")}`;

    const initialStatus = original.shop.autoAccept ? "ACCEPTED" : "PENDING";
    const expiresAt = initialStatus === "PENDING"
      ? new Date(Date.now() + original.shop.acceptTimeoutMin * 60 * 1000)
      : null;
    const qrCode = initialStatus === "ACCEPTED" ? randomUUID() : null;

    const newOrder = await prisma.order.create({
      data: {
        orderNumber,
        userId: user.id,
        isPro,
        shopId: original.shopId,
        status: initialStatus,
        totalCents,
        expiresAt,
        qrCode,
        paymentMethod: original.paymentMethod,
        customerNote: original.customerNote,
        items: { create: orderItems },
      },
      include: {
        items: true,
        shop: { select: { id: true, name: true, slug: true } },
      },
    });

    return apiSuccess({
      order: newOrder,
      unavailable,
      message: unavailable.length > 0
        ? `${unavailable.length} produit(s) indisponible(s) ont été retirés de la commande`
        : null,
    }, 201);
  } catch (error) {
    return handleApiError(error, "orders/reorder");
  }
}
