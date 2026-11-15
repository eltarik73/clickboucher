// src/lib/services/stripe/webhook/online-order.ts — which Klik&Go order a Stripe object designates,
// and the guard every webhook write to the orders table runs through.
//
// Writes nothing itself: each handler keeps its own literal `prisma.order.updateMany` (so that
// tests/lib/order-writers-guard.test.ts reads its `data`) and passes it to recordOnOnlineOrder.
// Rules shared by those writes:
// - only an order paid ONLINE is ever matched: an order paid at pickup is never touched;
// - the order is designated by metadata.orderId (set by checkout-session.ts on the session and its
//   PaymentIntent, and copied by Stripe to the charge) AND a compatible Stripe id: one the order
//   does not hold yet, or the same one;
// - every write is conditional (a column written once, or an amount that only grows), so a replay,
//   a duplicate or an event older than the stored state changes nothing.
import type { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { uniqueViolationFields } from "@/lib/prisma-errors";

/** Id of an expandable Stripe field: the string itself, or the id of the expanded object. */
export function stripeIdOf(value: string | { id: string } | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : value.id;
}

/** The order id Klik&Go put in the metadata of the Stripe object, or null. */
export function metadataOrderId(
  metadata: Record<string, string> | null | undefined
): string | null {
  const orderId = metadata?.orderId;
  return orderId ? orderId : null;
}

/** Order `orderId`, paid online, bound to `paymentIntentId` or to no PaymentIntent yet. */
export function onlineOrderWhere(orderId: string, paymentIntentId: string): Prisma.OrderWhereInput {
  return {
    id: orderId,
    paymentMethod: "ONLINE",
    OR: [{ stripePaymentIntentId: null }, { stripePaymentIntentId: paymentIntentId }],
  };
}

/**
 * Runs one conditional write of payment columns and says whether it changed a row. Nothing written
 * (unknown order, order paid at pickup, other PaymentIntent, value already recorded) is logged at
 * info level: replays and late events are normal. A Stripe id already held by another order (unique
 * violation) is an anomaly no retry can fix: logged as an error (Sentry) and not retried.
 */
export async function recordOnOnlineOrder(
  context: Record<string, unknown>,
  write: () => Promise<Prisma.BatchPayload>
): Promise<boolean> {
  try {
    const { count } = await write();
    if (count === 0) logger.info("[stripe/webhook] nothing recorded on the order", context);
    return count > 0;
  } catch (error) {
    const fields = uniqueViolationFields(error);
    if (fields === null) throw error;
    logger.error("[stripe/webhook] Stripe id already held by another order", {
      ...context,
      fields,
    });
    return false;
  }
}
