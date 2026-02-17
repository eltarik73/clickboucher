// src/app/api/boucher/service/route.ts — Proxy to /api/boucher/shop/status
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { updateServiceSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId },
      select: {
        id: true, status: true, busyMode: true, busyExtraMin: true,
        paused: true, prepTimeMin: true, autoAccept: true, maxOrdersPerHour: true,
      },
    });
    if (!shop) return apiError("NOT_FOUND", "Boutique introuvable");

    return apiSuccess({
      ...shop,
      effectivePrepTime: shop.prepTimeMin + (shop.busyMode ? shop.busyExtraMin : 0),
    });
  } catch (error) {
    return handleApiError(error, "boucher/service/GET");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });
    if (!shop) return apiError("NOT_FOUND", "Boutique introuvable");

    const body = await req.json();
    const data = updateServiceSchema.parse(body);

    const updated = await prisma.shop.update({
      where: { id: shop.id },
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
    return handleApiError(error, "boucher/service/PATCH");
  }
}
