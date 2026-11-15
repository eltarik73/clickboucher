export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getServerUserId, getBoucherOwnerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { updateServiceSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request-body";
import { isAdmin } from "@/lib/roles";
import { SHOP_SUSPENDED_ADMIN_MESSAGE, SHOP_SUSPENDED_OWNER_MESSAGE } from "@/lib/shop-publication";

// ── PATCH /api/shops/[id]/status ───────────────
// Boucher (owner) or Admin — toggle operational status. A suspended shop is closed until the admin
// reactivates it (PATCH /api/admin/shops/[shopId]/suspend): its status cannot change here.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const authId = await getServerUserId();

    if (!authId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }
    const userId = await getBoucherOwnerUserId();

    // Check role from DB
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: authId },
      select: { id: true, role: true },
    });

    // Verify ownership or admin
    const shop = await prisma.shop.findUnique({
      where: { id },
      select: { ownerId: true, suspendedAt: true },
    });

    if (!shop) {
      return apiError("NOT_FOUND", "Boucherie introuvable");
    }

    const admin = isAdmin(dbUser?.role);
    if (shop.ownerId !== userId && shop.ownerId !== dbUser?.id && !admin) {
      return apiError("FORBIDDEN", "Vous n'êtes pas propriétaire de cette boucherie");
    }

    if (shop.suspendedAt) {
      return admin
        ? apiError("CONFLICT", SHOP_SUSPENDED_ADMIN_MESSAGE)
        : apiError("FORBIDDEN", SHOP_SUSPENDED_OWNER_MESSAGE);
    }

    const data = updateServiceSchema.parse(await readJsonBody(req));

    const updated = await prisma.shop.update({
      where: { id },
      data,
    });

    return apiSuccess({
      id: updated.id,
      busyMode: updated.busyMode,
      busyExtraMin: updated.busyExtraMin,
      paused: updated.paused,
      status: updated.status,
      prepTimeMin: updated.prepTimeMin,
      autoAccept: updated.autoAccept,
      maxOrdersPerHour: updated.maxOrdersPerHour,
      effectivePrepTime: updated.prepTimeMin + (updated.busyMode ? updated.busyExtraMin : 0),
    });
  } catch (error) {
    return handleApiError(error, "shops/[id]/status");
  }
}
