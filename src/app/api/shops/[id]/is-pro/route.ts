import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const shopId = params.id;

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      return apiError("NOT_FOUND", "Utilisateur introuvable");
    }

    const proAccess = await prisma.proAccess.findFirst({
      where: { userId: user.id, shopId },
    });

    if (!proAccess) {
      return apiSuccess({ isPro: false });
    }

    return apiSuccess({
      isPro: proAccess.status === "APPROVED",
      companyName: proAccess.companyName,
      status: proAccess.status,
    });
  } catch (error) {
    return handleApiError(error, "is-pro");
  }
}
