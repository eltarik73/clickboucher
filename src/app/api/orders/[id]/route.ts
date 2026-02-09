import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

// ── GET /api/orders/[id] ───────────────────────
// Authenticated — order detail (client owner, boucher owner, or admin)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, sessionClaims } = await auth();
    const role = sessionClaims?.metadata?.role;

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        shop: { select: { id: true, name: true, slug: true, imageUrl: true, address: true, city: true, phone: true, ownerId: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true, clerkId: true } },
      },
    });

    if (!order) {
      return apiError("NOT_FOUND", "Commande introuvable");
    }

    // Permission check
    if (role === "admin") {
      // Admin can see all
    } else if (role === "boucher") {
      if (order.shop.ownerId !== userId) {
        return apiError("FORBIDDEN", "Cette commande n'appartient pas à votre boucherie");
      }
    } else {
      // Client — must be order owner
      if (order.user.clerkId !== userId) {
        return apiError("FORBIDDEN", "Cette commande ne vous appartient pas");
      }
    }

    return apiSuccess(order);
  } catch (error) {
    return handleApiError(error);
  }
}
