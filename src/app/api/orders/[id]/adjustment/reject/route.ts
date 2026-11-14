// POST /api/orders/[id]/adjustment/reject — the customer refuses the pending price adjustment of
// the order: the total does not change. The customer is the holder of the order's credential cookie
// or the signed-in customer who placed it (authorizeOrderAccess, src/lib/auth/order-access.ts). An
// order outside the caller's reach is 404. Business logic in
// src/lib/services/orders/adjustment-answers.ts.
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { authorizeOrderAccess, orderAccessRefusal } from "@/lib/auth/order-access";
import { rejectAdjustment } from "@/lib/services/orders/adjustment-answers";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await authorizeOrderAccess(params.id, req.cookies);
    if (!access.ok) return orderAccessRefusal(access.status);

    const result = await rejectAdjustment({
      orderId: access.orderId,
      userId: access.customerId,
      now: new Date(),
    });
    if (result.kind === "not_found") return apiError("NOT_FOUND", "Commande introuvable");
    if (result.kind === "refused") return apiError("CONFLICT", result.message);
    return apiSuccess(result.adjustment);
  } catch (error) {
    return handleApiError(error, "orders/adjustment/reject");
  }
}
