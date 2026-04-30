import { getServerUserId } from "@/lib/auth/server-auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { proAccessReviewSchema } from "@/lib/validators";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; proAccessId: string } }
) {
  try {
    const clerkId = await getServerUserId();
    if (!clerkId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const shopId = params.id;
    const { proAccessId } = params;

    // Resolve Clerk → DB user (shops may store either clerkId or dbUser.id as ownerId).
    const dbUser = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    const shop = await prisma.shop.findFirst({
      where: {
        id: shopId,
        OR: [
          { ownerId: clerkId },
          ...(dbUser ? [{ ownerId: dbUser.id }] : []),
        ],
      },
    });
    if (!shop) {
      return apiError("FORBIDDEN", "Accès refusé");
    }

    // Lock proAccessId to this shop — prevents cross-shop tampering via guessable IDs.
    const targetAccess = await prisma.proAccess.findUnique({
      where: { id: proAccessId },
      select: { shopId: true },
    });
    if (!targetAccess || targetAccess.shopId !== shopId) {
      return apiError("NOT_FOUND", "Demande introuvable");
    }

    const body = await req.json();
    const parsed = proAccessReviewSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.errors[0].message);
    }

    const { status, notes } = parsed.data;

    // Update ProAccess
    const proAccess = await prisma.proAccess.update({
      where: { id: proAccessId },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedBy: clerkId,
        notes,
      },
    });

    // Notify the client
    if (status === "APPROVED") {
      await prisma.notification.create({
        data: {
          userId: proAccess.userId,
          type: "PRO_APPROVED",
          message: `Votre accès Pro chez ${shop.name} est validé !`,
        },
      });
    } else if (status === "REJECTED") {
      await prisma.notification.create({
        data: {
          userId: proAccess.userId,
          type: "PRO_REJECTED",
          message: `Votre demande Pro chez ${shop.name} a été refusée.`,
        },
      });
    }

    return apiSuccess(proAccess);
  } catch (error) {
    return handleApiError(error, "pro-access-review");
  }
}
