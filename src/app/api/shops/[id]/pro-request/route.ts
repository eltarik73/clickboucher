import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { proAccessRequestSchema } from "@/lib/validators";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const shopId = params.id;

    const body = await req.json();
    const parsed = proAccessRequestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.errors[0].message);
    }

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      return apiError("NOT_FOUND", "Utilisateur introuvable");
    }

    // Check for existing PENDING or APPROVED ProAccess
    const existingAccess = await prisma.proAccess.findFirst({
      where: {
        userId: user.id,
        shopId,
        status: { in: ["PENDING", "APPROVED"] },
      },
    });

    if (existingAccess) {
      return apiError(
        "CONFLICT",
        existingAccess.status === "PENDING"
          ? "Une demande est déjà en cours"
          : "Vous avez déjà un accès Pro pour cette boucherie"
      );
    }

    // If REJECTED exists, delete it first (allow retry)
    const rejectedAccess = await prisma.proAccess.findFirst({
      where: { userId: user.id, shopId, status: "REJECTED" },
    });
    if (rejectedAccess) {
      await prisma.proAccess.delete({ where: { id: rejectedAccess.id } });
    }

    // Create ProAccess with status PENDING
    const proAccess = await prisma.proAccess.create({
      data: {
        userId: user.id,
        shopId,
        status: "PENDING",
        ...parsed.data,
      },
    });

    // Notify shop owner
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (shop) {
      const owner = await prisma.user.findUnique({
        where: { clerkId: shop.ownerId },
      });
      if (owner) {
        await prisma.notification.create({
          data: {
            userId: owner.id,
            type: "PRO_REQUEST",
            message: `Nouvelle demande Pro : ${parsed.data.companyName}`,
          },
        });
      }
    }

    return apiSuccess(proAccess, 201);
  } catch (error) {
    return handleApiError(error, "pro-request");
  }
}
