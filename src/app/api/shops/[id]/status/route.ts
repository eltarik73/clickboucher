export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { updateServiceSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { isAdmin } from "@/lib/roles";

// ── PATCH /api/shops/[id]/status ───────────────
// Boucher (owner) or Admin — toggle operational status
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { userId } = await auth();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    // Check admin role from publicMetadata
    const user = await currentUser();
    const role = (user?.publicMetadata as Record<string, string>)?.role;

    // Verify ownership or admin
    const shop = await prisma.shop.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!shop) {
      return apiError("NOT_FOUND", "Boucherie introuvable");
    }

    if (shop.ownerId !== userId && !isAdmin(role)) {
      return apiError("FORBIDDEN", "Vous n'êtes pas propriétaire de cette boucherie");
    }

    const body = await req.json();
    const data = updateServiceSchema.parse(body);

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
    return handleApiError(error);
  }
}
