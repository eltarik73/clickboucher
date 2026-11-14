export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { apiSuccess, apiError, handleApiError, formatZodError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request-body";
import { guestOrderAdmission, resolveGuestCustomer } from "@/lib/auth/guest-auth";
import { replaceOrderCredential } from "@/lib/auth/order-access";
import {
  generateOrderCredential,
  orderAccessPath,
  setOrderAccessCookie,
} from "@/lib/auth/order-credential";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { createOrder } from "@/lib/services/orders/create";
import { KEY_ALREADY_USED_MESSAGE } from "@/lib/services/orders/create-replay";
import { customerOrderById } from "@/lib/services/orders/customer-view";
import { clientIp, guestIdentitySchema } from "./identity";

// ── POST /api/checkout/guest ───────────────────────
// Public: anonymous checkout. The order is filed under the users row of the e-mail typed, with
// guest semantics whatever that row is (public prices, no promo code), and it records the identity
// typed, the only one the customer views show (customer-view.ts). The answer is therefore the same
// for every e-mail and never tells whether an account exists nor whose it is. Abuse is capped in
// PostgreSQL: in the creation transaction, at most MAX_GUEST_ORDERS_AWAITING_SHOP guest orders
// awaiting the shop per e-mail and per phone (guest-auth.ts); per shop, guest orders awaiting it
// are bounded apart from the capacity left to other customers (shop-capacity.ts); beside the
// per-IP and per-e-mail limiters.
//
// The order gets its own random access credential, stored only as a hash. The credential goes to
// this request alone: in the httpOnly cookie klikgo-order-<id>, and in the confirmation e-mail as
// the path /suivi/<id>/acces/<token>. It is never in the JSON body and never in a query string.
// A replay of the same order (same idempotency key) gets a fresh credential, since the browser
// that replays lost the first answer and its cookie.
export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return apiError("VALIDATION_ERROR", "Données invalides");
    }
    // Only the order fields reach createOrder(), whose strict schema validates them.
    const { email, phone, firstName, lastName, ...orderFields } = body as Record<string, unknown>;

    const parsed = guestIdentitySchema.safeParse({ email, phone, firstName, lastName });
    if (!parsed.success) {
      // The cart shows error.message: it names the field to correct (« Téléphone invalide … »).
      const [firstIssue] = parsed.error.issues;
      return apiError("VALIDATION_ERROR", firstIssue.message, formatZodError(parsed.error));
    }
    const identity = parsed.data;

    const perIp = await checkRateLimit(rateLimits.orders, `guest-ip:${clientIp(req)}`);
    if (!perIp.success) {
      return apiError(
        "RATE_LIMITED",
        "Trop de commandes depuis cette connexion. Réessayez dans quelques minutes."
      );
    }
    const perEmail = await checkRateLimit(rateLimits.orders, `guest:${identity.email}`);
    if (!perEmail.success) {
      return apiError("RATE_LIMITED", "Trop de commandes, veuillez patienter");
    }

    const customer = await resolveGuestCustomer(identity);
    const credential = generateOrderCredential();
    const result = await createOrder(orderFields, customer, {
      accessTokenHash: credential.tokenHash,
      contact: {
        firstName: identity.firstName,
        lastName: identity.lastName,
        phone: identity.phone,
      },
      trackingPath: (orderId) => orderAccessPath(orderId, credential.token),
      admit: guestOrderAdmission(identity),
    });

    if (!result.ok) {
      return apiError(result.code, result.message, result.details);
    }

    // A replay hands out a fresh credential, and only for an order placed as a guest. The key of
    // an order the account placed while signed in is refused like a key of another customer: an
    // e-mail typed here never opens an account's orders.
    const issued =
      result.status === 201 ||
      (await replaceOrderCredential(result.order.id, credential.tokenHash));
    if (!issued) return apiError("CONFLICT", KEY_ALREADY_USED_MESSAGE);

    const response = apiSuccess({ order: await customerOrderById(result.order.id) }, result.status);
    setOrderAccessCookie(response.cookies, result.order, credential.token);
    return response;
  } catch (error) {
    return handleApiError(error, "checkout/guest POST");
  }
}
