export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { autoApproveExpiredAdjustment } from "@/lib/price-adjustment";

// ── GET /api/orders/[id] ───────────────────────
// Authenticated — order detail (client owner, boucher owner, or admin)
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const userId = await getServerUserId();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    // Get user from DB to determine role
    const dbUser = await getOrCreateUser(userId);

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        shop: { select: { id: true, name: true, slug: true, imageUrl: true, address: true, city: true, phone: true, ownerId: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true, clerkId: true, customerNumber: true } },
        priceAdjustment: true,
      },
    });

    if (!order) {
      return apiError("NOT_FOUND", "Commande introuvable");
    }

    // Auto-approve expired price adjustment if any
    if (order.priceAdjustment?.status === "PENDING" && order.priceAdjustment.autoApproveAt && new Date() >= new Date(order.priceAdjustment.autoApproveAt)) {
      await autoApproveExpiredAdjustment(id);
      const refreshed = await prisma.order.findUnique({
        where: { id },
        include: {
          items: { include: { product: true } },
          shop: { select: { id: true, name: true, slug: true, imageUrl: true, address: true, city: true, phone: true, ownerId: true } },
          user: { select: { id: true, firstName: true, lastName: true, email: true, clerkId: true, customerNumber: true } },
          priceAdjustment: true,
        },
      });
      if (refreshed) {
        Object.assign(order, refreshed);
      }
    }

    // Permission check using DB role
    const role = dbUser?.role;
    if (role === "ADMIN") {
      // Admin can see all
    } else if (role === "BOUCHER") {
      // Check ownership with OR clause (ownerId may store clerkId OR dbUser.id)
      if (order.shop.ownerId !== userId && order.shop.ownerId !== dbUser?.id) {
        return apiError("FORBIDDEN", "Cette commande n'appartient pas a votre boucherie");
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
