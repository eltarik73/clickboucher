export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { authorizeOrderRead, orderAccessRefusal } from "@/lib/auth/order-access";
import { settleDueAdjustment } from "@/lib/services/orders/adjustment-answers";
import { findCustomerOrder } from "@/lib/services/orders/customer-view";

// ── GET /api/orders/[id] ───────────────────────
// Order detail in the customer view (customer-view.ts), for its customer (the order's credential
// cookie or the signed-in owner), the butcher of the shop or an admin (src/lib/auth/order-access.ts).
// A legacy token in the query string is ignored. An order outside the caller's reach is 404.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await authorizeOrderRead(params.id, req.cookies);
    if (!access.ok) return orderAccessRefusal(access.status);

    // A price adjustment whose deadline has passed is settled before the order is shown.
    await settleDueAdjustment(access.orderId, new Date());
    const order = await findCustomerOrder({ id: access.orderId });
    if (!order) return apiError("NOT_FOUND", "Commande introuvable");
    return apiSuccess(order);
  } catch (error) {
    return handleApiError(error, "orders/[id] GET");
  }
}
