// src/app/api/reviews/route.ts — Reviews API
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export const dynamic = "force-dynamic";

const createReviewSchema = z.object({
  shopId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  orderId: z.string().optional(),
});

// ── POST /api/reviews — Create a review ─────────
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return apiError("UNAUTHORIZED", "Authentification requise");

    const user = await getOrCreateUser(clerkId);
    if (!user) return apiError("UNAUTHORIZED", "Utilisateur introuvable");
    const body = await req.json();
    const data = createReviewSchema.parse(body);

    // Verify shop exists
    const shop = await prisma.shop.findUnique({
      where: { id: data.shopId },
      select: { id: true, rating: true, ratingCount: true },
    });
    if (!shop) return apiError("NOT_FOUND", "Boutique introuvable");

    // If orderId provided, verify it's COMPLETED and belongs to user
    if (data.orderId) {
      const order = await prisma.order.findUnique({
        where: { id: data.orderId },
        select: { status: true, userId: true, shopId: true },
      });
      if (!order) return apiError("NOT_FOUND", "Commande introuvable");
      if (order.userId !== user.id) return apiError("FORBIDDEN", "Cette commande ne vous appartient pas");
      if (order.status !== "COMPLETED" && order.status !== "PICKED_UP") {
        return apiError("VALIDATION_ERROR", "Seules les commandes terminées peuvent être notées");
      }
      if (order.shopId !== data.shopId) {
        return apiError("VALIDATION_ERROR", "La commande ne correspond pas à cette boutique");
      }
    }

    // Check uniqueness: one review per user per shop per order
    const existing = await prisma.review.findFirst({
      where: {
        userId: user.id,
        shopId: data.shopId,
        orderId: data.orderId ?? null,
      },
    });
    if (existing) return apiError("CONFLICT", "Vous avez déjà laissé un avis");

    // Create the review
    const review = await prisma.review.create({
      data: {
        rating: data.rating,
        comment: data.comment || null,
        userId: user.id,
        shopId: data.shopId,
        orderId: data.orderId || null,
      },
    });

    // Update shop average rating
    const newCount = shop.ratingCount + 1;
    const newRating = (shop.rating * shop.ratingCount + data.rating) / newCount;
    await prisma.shop.update({
      where: { id: data.shopId },
      data: {
        rating: Math.round(newRating * 100) / 100,
        ratingCount: newCount,
      },
    });

    return apiSuccess(review, 201);
  } catch (error) {
    return handleApiError(error, "reviews/POST");
  }
}

// ── GET /api/reviews?shopId=X — List reviews for a shop ──
export async function GET(req: NextRequest) {
  try {
    const shopId = req.nextUrl.searchParams.get("shopId");
    if (!shopId) return apiError("VALIDATION_ERROR", "shopId requis");

    const reviews = await prisma.review.findMany({
      where: { shopId },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const serialized = reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      user: {
        firstName: r.user.firstName,
        lastInitial: r.user.lastName ? r.user.lastName[0] + "." : "",
      },
    }));

    return apiSuccess(serialized);
  } catch (error) {
    return handleApiError(error, "reviews/GET");
  }
}
