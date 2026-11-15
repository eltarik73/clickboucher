export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getServerUserId, getBoucherOwnerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { updateServiceSchema } from "@/lib/validators";
import { apiSuccess, apiError, formatZodError, handleApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request-body";
import { isAdmin } from "@/lib/roles";
import { shopWriteRefusal } from "@/lib/services/shops/owner-write-http";
import { updateShopService } from "@/lib/services/shops/service-settings";

// ── PATCH /api/shops/[id]/status ───────────────
// Boucher (owner) or Admin — the shop's service settings. A suspended shop is closed until the admin
// reactivates it (PATCH /api/admin/shops/[shopId]/suspend): the write refuses it, for both.
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
      select: { ownerId: true },
    });

    if (!shop) {
      return apiError("NOT_FOUND", "Boucherie introuvable");
    }

    const admin = isAdmin(dbUser?.role);
    if (shop.ownerId !== userId && shop.ownerId !== dbUser?.id && !admin) {
      return apiError("FORBIDDEN", "Vous n'êtes pas propriétaire de cette boucherie");
    }

    const parsed = updateServiceSchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Données invalides", formatZodError(parsed.error));
    }

    const result = await updateShopService(id, parsed.data);
    if (!result.ok) return shopWriteRefusal(result.reason, admin ? "admin" : "owner");

    return apiSuccess(result.service);
  } catch (error) {
    return handleApiError(error, "shops/[id]/status");
  }
}
