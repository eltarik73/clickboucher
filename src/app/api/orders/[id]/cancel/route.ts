// src/app/api/orders/[id]/cancel/route.ts — the customer cancels an order: PENDING, or ACCEPTED less
// than 5 minutes after it was placed. The customer is the holder of the order's credential cookie
// or the signed-in customer who placed it (authorizeOrderAccess, src/lib/auth/order-access.ts); the
// same rule then applies to both. An order outside the caller's reach is 404.
import { NextRequest } from "next/server";
import { apiError, handleApiError } from "@/lib/api/errors";
import { authorizeOrderAccess, orderAccessRefusal } from "@/lib/auth/order-access";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { cancelOrderByCustomer } from "@/lib/services/orders/commands/close";
import { customerTransitionResponse } from "@/lib/services/orders/commands/http";

export const dynamic = "force-dynamic";

// ── POST /api/orders/[id]/cancel ───────────────
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await authorizeOrderAccess(params.id, req.cookies);
    if (!access.ok) return orderAccessRefusal(access.status);

    const rl = await checkRateLimit(rateLimits.api, `order-cancel:${access.customerId}`);
    if (!rl.success) return apiError("RATE_LIMITED", "Trop de requêtes");

    return await customerTransitionResponse(
      await cancelOrderByCustomer({
        orderId: access.orderId,
        userId: access.customerId,
        now: new Date(),
      })
    );
  } catch (error) {
    return handleApiError(error, "orders/cancel");
  }
}
