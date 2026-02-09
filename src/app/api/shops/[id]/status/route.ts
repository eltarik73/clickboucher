import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { updateServiceSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

// ── PATCH /api/shops/[id]/status ───────────────
// Boucher (owner) only — toggle operational status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await auth();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    // Verify ownership
    const shop = await prisma.shop.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!shop) {
      return apiError("NOT_FOUND", "Boucherie introuvable");
    }

    if (shop.ownerId !== userId) {
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
      isOpen: updated.isOpen,
      prepTimeMin: updated.prepTimeMin,
      autoAccept: updated.autoAccept,
      maxOrdersHour: updated.maxOrdersHour,
      effectivePrepTime: updated.prepTimeMin + (updated.busyMode ? updated.busyExtraMin : 0),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
