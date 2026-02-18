import { auth } from "@clerk/nextjs/server";
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
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const shopId = params.id;
    const { proAccessId } = params;

    // Verify shop owner
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      return apiError("NOT_FOUND", "Boucherie introuvable");
    }

    if (shop.ownerId !== clerkId) {
      return apiError("FORBIDDEN", "Accès refusé");
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
