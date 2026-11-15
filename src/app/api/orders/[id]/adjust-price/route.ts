// PATCH /api/orders/[id]/adjust-price — the butcher proposes a new price after weighing (or a new
// unit price, or a new total) for an order of his shop. Applied at once when the customer's
// weighing tolerance allows it, otherwise left for the customer's explicit answer.
// Thin controller — business logic in src/lib/services/orders/adjust-price.ts
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request-body";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { adjustOrderPrice } from "@/lib/services/orders/adjust-price";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId, userId } = authResult;

    const rl = await checkRateLimit(rateLimits.api, `order-adjust:${shopId}`);
    if (!rl.success) return apiError("RATE_LIMITED", "Trop de requêtes");

    const body = await readJsonBody(req);
    const result = await adjustOrderPrice(params.id, { shopId, actorId: userId }, body);

    if (!result.ok) {
      return apiError(result.code, result.message, result.details);
    }
    return apiSuccess(result.data);
  } catch (error) {
    return handleApiError(error, "orders/adjust-price");
  }
}
