// src/app/api/orders/[id]/status/route.ts — the order as the tracking page (/suivi/[id]) polls it.
// For the order's customer — the holder of the order's credential cookie or the signed-in customer
// who placed it — then the butcher of the shop or an admin (authorizeOrderRead,
// src/lib/auth/order-access.ts: the customer is recognised first, staff are looked up only after).
// The answer is the customer view (customer-view.ts). An order outside the caller's reach is 404.
// A price adjustment left unanswered past its window is closed (silence is a refusal) before the
// order is returned; the row in hand decides it, so a poll without one costs no extra query.
import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { authorizeOrderRead, orderAccessRefusal } from "@/lib/auth/order-access";
import { isAdjustmentAnswerDue } from "@/lib/pricing/tolerance";
import { settleDueAdjustment } from "@/lib/services/orders/adjustment-answers";
import { findCustomerOrder } from "@/lib/services/orders/customer-view";

export const dynamic = "force-dynamic";

// ── GET /api/orders/[id]/status ────────────────
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await authorizeOrderRead(params.id, req.cookies);
    if (!access.ok) return orderAccessRefusal(access.status);

    const now = new Date();
    let order = await findCustomerOrder({ id: access.orderId });
    if (order && isAdjustmentAnswerDue(order.priceAdjustment, now)) {
      await settleDueAdjustment(access.orderId, now);
      order = await findCustomerOrder({ id: access.orderId });
    }
    if (!order) return apiError("NOT_FOUND", "Commande introuvable");
    return apiSuccess(order);
  } catch (error) {
    return handleApiError(error, "orders/status/GET");
  }
}
