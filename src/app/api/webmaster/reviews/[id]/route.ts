// DELETE /api/webmaster/reviews/[id] — Delete a review (moderation)
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { id } = params;

    const review = await prisma.review.findUnique({
      where: { id },
      select: { id: true, shopId: true, rating: true, userId: true },
    });
    if (!review) {
      return apiError("NOT_FOUND", "Avis introuvable");
    }

    await prisma.review.delete({ where: { id } });

    // Recalculate shop rating
    const agg = await prisma.review.aggregate({
      where: { shopId: review.shopId },
      _avg: { rating: true },
      _count: true,
    });
    await prisma.shop.update({
      where: { id: review.shopId },
      data: {
        rating: agg._avg.rating || 0,
        ratingCount: agg._count,
      },
    });

    await writeAuditLog({
      actorId: admin.userId,
      action: "review.delete",
      target: "Review",
      targetId: id,
      details: { shopId: review.shopId, rating: review.rating },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, "webmaster/reviews/delete");
  }
}
