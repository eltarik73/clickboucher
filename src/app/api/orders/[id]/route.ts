export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { authorizeOrderRead, orderAccessRefusal } from "@/lib/auth/order-access";
import { readCustomerOrder } from "@/lib/services/orders/customer-view";

// ── GET /api/orders/[id] ───────────────────────
// Order detail in the customer view (readCustomerOrder, customer-view.ts), for its customer (the
// order's credential cookie or the signed-in owner), the butcher of the shop or an admin
// (src/lib/auth/order-access.ts). A legacy token in the query string is ignored. An order outside
// the caller's reach is 404.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await authorizeOrderRead(params.id, req.cookies);
    if (!access.ok) return orderAccessRefusal(access.status);

    const order = await readCustomerOrder(access.orderId, new Date());
    if (!order) return apiError("NOT_FOUND", "Commande introuvable");
    return apiSuccess(order);
  } catch (error) {
    return handleApiError(error, "orders/[id] GET");
  }
}
