// PATCH /api/reviews/[id]/reply — boucher responds to a review on their shop.
//
// Lets the shop owner publish a public reply visible under the customer review.
// Critical for trust: gives the boucher a way to defend against unfair 1-star reviews
// and acknowledge praise. Only the shop owner of the reviewed shop can reply.

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getServerUserId } from "@/lib/auth/server-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";

const replySchema = z.object({
  reply: z.string().trim().min(1, "Réponse vide").max(800, "Max 800 caractères"),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const clerkId = await getServerUserId();
    if (!clerkId) return apiError("UNAUTHORIZED", "Authentification requise");

    const rl = await checkRateLimit(rateLimits.api, `review-reply:${clerkId}`);
    if (!rl.success) return apiError("RATE_LIMITED", "Trop de requêtes");

    const dbUser = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    const review = await prisma.review.findUnique({
      where: { id: params.id },
      select: { id: true, shopId: true },
    });
    if (!review) return apiError("NOT_FOUND", "Avis introuvable");

    // Ownership: clerkId or dbUser.id (legacy data uses either form).
    const shop = await prisma.shop.findFirst({
      where: {
        id: review.shopId,
        OR: [
          { ownerId: clerkId },
          ...(dbUser ? [{ ownerId: dbUser.id }] : []),
        ],
      },
      select: { id: true },
    });
    if (!shop) return apiError("FORBIDDEN", "Accès refusé");

    const body = await req.json();
    const parsed = replySchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.errors[0].message);
    }

    const updated = await prisma.review.update({
      where: { id: params.id },
      data: {
        reply: parsed.data.reply,
        repliedAt: new Date(),
        repliedById: dbUser?.id ?? clerkId,
      },
      select: {
        id: true,
        reply: true,
        repliedAt: true,
      },
    });

    return apiSuccess(updated);
  } catch (err) {
    return handleApiError(err, "review-reply");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const clerkId = await getServerUserId();
    if (!clerkId) return apiError("UNAUTHORIZED", "Authentification requise");

    const dbUser = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    const review = await prisma.review.findUnique({
      where: { id: params.id },
      select: { id: true, shopId: true },
    });
    if (!review) return apiError("NOT_FOUND", "Avis introuvable");

    const shop = await prisma.shop.findFirst({
      where: {
        id: review.shopId,
        OR: [
          { ownerId: clerkId },
          ...(dbUser ? [{ ownerId: dbUser.id }] : []),
        ],
      },
      select: { id: true },
    });
    if (!shop) return apiError("FORBIDDEN", "Accès refusé");

    await prisma.review.update({
      where: { id: params.id },
      data: { reply: null, repliedAt: null, repliedById: null },
    });

    return apiSuccess({ deleted: true });
  } catch (err) {
    return handleApiError(err, "review-reply-delete");
  }
}
