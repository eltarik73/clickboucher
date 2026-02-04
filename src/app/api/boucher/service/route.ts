import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { updateServiceSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const data = updateServiceSchema.parse(body);

    // In production: extract shopId from auth token
    // For mock: get from query or body
    const shopId = req.nextUrl.searchParams.get("shopId");
    if (!shopId) return apiError("VALIDATION_ERROR", "shopId requis");

    const updateData: Record<string, unknown> = {};
    if (data.isServiceActive !== undefined) updateData.isServiceActive = data.isServiceActive;
    if (data.isSurchargeMode !== undefined) updateData.isSurchargeMode = data.isSurchargeMode;
    if (data.prepTimeMinutes !== undefined) updateData.prepTimeMinutes = data.prepTimeMinutes;
    if (data.maxOrdersPer15 !== undefined) updateData.maxOrdersPer15 = data.maxOrdersPer15;

    const shop = await prisma.shop.update({
      where: { id: shopId },
      data: updateData,
      select: {
        id: true,
        isServiceActive: true,
        isSurchargeMode: true,
        prepTimeMinutes: true,
        maxOrdersPer15: true,
      },
    });

    console.log(`[BOUCHER] Service updated for shop ${shopId}:`, shop);

    return apiSuccess(shop);
  } catch (error) {
    return handleApiError(error);
  }
}
