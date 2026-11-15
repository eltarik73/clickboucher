// src/app/api/boucher/service/route.ts — Proxy to /api/boucher/shop/status
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request-body";
import { SHOP_SUSPENDED_OWNER_MESSAGE } from "@/lib/shop-publication";
import { shopSuspension } from "@/lib/shop-status";
import { updateServiceSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        status: true,
        busyMode: true,
        busyExtraMin: true,
        paused: true,
        prepTimeMin: true,
        autoAccept: true,
        maxOrdersPerHour: true,
        priceAdjustmentThreshold: true,
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

// A suspended shop belongs to the admin until it is reactivated: every change is refused.
export async function PATCH(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    if (await shopSuspension(shopId)) return apiError("FORBIDDEN", SHOP_SUSPENDED_OWNER_MESSAGE);

    const data = updateServiceSchema.parse(await readJsonBody(req));

    const updated = await prisma.shop.update({
      where: { id: shopId },
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
      priceAdjustmentThreshold: updated.priceAdjustmentThreshold,
      effectivePrepTime: updated.prepTimeMin + (updated.busyMode ? updated.busyExtraMin : 0),
    });
  } catch (error) {
    return handleApiError(error, "boucher/service/PATCH");
  }
}
