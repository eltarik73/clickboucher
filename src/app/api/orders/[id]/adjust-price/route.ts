// PATCH /api/orders/[id]/adjust-price — Boucher creates a price adjustment (3-tier system)
// Thin controller — business logic in src/lib/services/orders/adjust-price.ts
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { adjustOrderPrice } from "@/lib/services/orders/adjust-price";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: orderId } = params;
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const rl = await checkRateLimit(rateLimits.api, `order-adjust:${shopId}`);
    if (!rl.success) return apiError("RATE_LIMITED", "Trop de requêtes");

    const body = await req.json();
    const result = await adjustOrderPrice(orderId, shopId, body);

    if (!result.ok) {
      return apiError(result.code, result.message, result.details);
    }
    return apiSuccess(result.data);
  } catch (error) {
    return handleApiError(error, "orders/adjust-price");
  }
}
