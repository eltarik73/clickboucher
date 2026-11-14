// POST /api/orders/quote — the server's price of a basket, shown by the cart before the order.
// Signed-in or not: an anonymous visitor gets public prices and no promo code. The response is the
// OrderQuote only; the offer and reward ids the server resolved never leave it.
import { NextRequest } from "next/server";

import { apiError, apiSuccess, formatZodError, handleApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request-body";
import { getServerUserId } from "@/lib/auth/server-auth";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { resolveOrderCustomer } from "@/lib/services/orders/customer";
import { quoteOrder } from "@/lib/services/orders/quote";
import { orderQuoteRequestSchema } from "@/lib/validators/order";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const clerkId = await getServerUserId();
    const requester =
      clerkId ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
    const rl = await checkRateLimit(rateLimits.api, `quote:${requester}`);
    if (!rl.success) {
      return apiError("RATE_LIMITED", "Trop de demandes, réessayez dans une minute");
    }

    const parsed = orderQuoteRequestSchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Données invalides", formatZodError(parsed.error));
    }

    const customer = clerkId === null ? null : await resolveOrderCustomer(clerkId);
    const result = await quoteOrder(parsed.data, customer, new Date());
    if (!result.ok) {
      return apiError(result.code, result.message, result.details);
    }
    if (result.quote.discountRejection !== null) {
      // Brute-force guard on promo codes: only a refused code counts as a guess. Re-quoting an
      // accepted code at every change of the basket costs nothing.
      const promoRl = await checkRateLimit(rateLimits.promoValidate, `promo:${requester}`);
      if (!promoRl.success) {
        return apiError("RATE_LIMITED", "Trop de tentatives, réessayez dans une minute");
      }
    }
    return apiSuccess(result.quote);
  } catch (error) {
    return handleApiError(error, "orders/quote POST");
  }
}
