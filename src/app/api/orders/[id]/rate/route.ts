import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { rateOrderSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

// ── POST /api/orders/[id]/rate ─────────────────
// Client — rate a completed/picked-up order
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await auth();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        status: true,
        rating: true,
        shopId: true,
        user: { select: { clerkId: true } },
      },
    });

    if (!order) {
      return apiError("NOT_FOUND", "Commande introuvable");
    }
    if (order.user.clerkId !== userId) {
      return apiError("FORBIDDEN", "Cette commande ne vous appartient pas");
    }
    if (order.status !== "PICKED_UP" && order.status !== "COMPLETED") {
      return apiError("VALIDATION_ERROR", "Vous ne pouvez noter qu'une commande récupérée");
    }
    if (order.rating !== null) {
      return apiError("CONFLICT", "Vous avez déjà noté cette commande");
    }

    const body = await req.json();
    const data = rateOrderSchema.parse(body);

    // Update order with rating and mark as COMPLETED
    const updated = await prisma.order.update({
      where: { id },
      data: {
        rating: data.rating,
        ratingComment: data.comment,
        status: "COMPLETED",
      },
    });

    // Update shop average rating
    const shop = await prisma.shop.findUnique({
      where: { id: order.shopId },
      select: { rating: true, ratingCount: true },
    });

    if (shop) {
      const newCount = shop.ratingCount + 1;
      const newRating = (shop.rating * shop.ratingCount + data.rating) / newCount;

      await prisma.shop.update({
        where: { id: order.shopId },
        data: {
          rating: Math.round(newRating * 100) / 100,
          ratingCount: newCount,
        },
      });
    }

    // ── Loyalty: increment orderCount when order completes ──
    try {
      const dbUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true },
      });

      if (dbUser) {
        const loyaltyPoints = await prisma.loyaltyPoints.upsert({
          where: { userId_shopId: { userId: dbUser.id, shopId: order.shopId } },
          create: { userId: dbUser.id, shopId: order.shopId, orderCount: 1, rewardsEarned: 0 },
          update: { orderCount: { increment: 1 } },
        });

        // Check if a reward is earned
        const rule = await prisma.loyaltyRule.findFirst({
          where: { shopId: order.shopId, active: true },
        });

        if (rule && loyaltyPoints.orderCount % rule.ordersRequired === 0) {
          await prisma.loyaltyPoints.update({
            where: { id: loyaltyPoints.id },
            data: { rewardsEarned: { increment: 1 } },
          });
        }
      }
    } catch (loyaltyErr) {
      console.error("[Rate] Loyalty error (non-blocking):", loyaltyErr);
    }

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
