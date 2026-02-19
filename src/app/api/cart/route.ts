// GET /api/cart — Get user's persistent cart
// POST /api/cart — Add item or sync full cart
// DELETE /api/cart — Clear cart
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ── GET — Load persistent cart ──
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const cart = await prisma.cart.findFirst({
      where: { user: { clerkId: userId } },
      include: {
        shop: { select: { id: true, name: true, slug: true } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                priceCents: true,
                proPriceCents: true,
                unit: true,
                inStock: true,
                snoozeType: true,
              },
            },
          },
        },
      },
    });

    if (!cart) return apiSuccess(null);

    return apiSuccess({
      id: cart.id,
      shopId: cart.shopId,
      shopName: cart.shop.name,
      shopSlug: cart.shop.slug,
      items: cart.items.map((ci) => ({
        id: ci.id,
        productId: ci.productId,
        name: ci.product.name,
        imageUrl: ci.product.imageUrl || "",
        priceCents: ci.product.priceCents,
        unit: ci.product.unit,
        quantity: ci.quantity,
        weightGrams: ci.weightGrams,
        itemNote: ci.itemNote,
        inStock: ci.product.inStock,
        snoozed: ci.product.snoozeType !== "NONE",
      })),
      updatedAt: cart.updatedAt,
    });
  } catch (error) {
    return handleApiError(error, "cart/get");
  }
}

// ── POST — Sync cart (upsert full cart from client) ──
const syncCartSchema = z.object({
  shopId: z.string().min(1),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().min(0.01),
      weightGrams: z.number().int().optional(),
      itemNote: z.string().max(300).optional(),
    })
  ),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const body = await req.json();
    const data = syncCartSchema.parse(body);

    // Get DB user
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });
    if (!user) return apiError("NOT_FOUND", "Utilisateur introuvable");

    // Upsert cart + replace items in a single transaction
    const cart = await prisma.$transaction(async (tx) => {
      const c = await tx.cart.upsert({
        where: { userId_shopId: { userId: user.id, shopId: data.shopId } },
        create: {
          userId: user.id,
          shopId: data.shopId,
        },
        update: {
          abandonedAt: null,
          reminderSentAt: null,
        },
      });

      await tx.cartItem.deleteMany({ where: { cartId: c.id } });

      if (data.items.length > 0) {
        await tx.cartItem.createMany({
          data: data.items.map((item) => ({
            cartId: c.id,
            productId: item.productId,
            quantity: item.quantity,
            weightGrams: item.weightGrams,
            itemNote: item.itemNote,
          })),
        });
      }

      return c;
    });

    return apiSuccess({ synced: true, cartId: cart.id });
  } catch (error) {
    return handleApiError(error, "cart/sync");
  }
}

// ── DELETE — Clear cart ──
export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });
    if (!user) return apiError("NOT_FOUND", "Utilisateur introuvable");

    await prisma.cart.deleteMany({ where: { userId: user.id } });

    return apiSuccess({ cleared: true });
  } catch (error) {
    return handleApiError(error, "cart/clear");
  }
}
