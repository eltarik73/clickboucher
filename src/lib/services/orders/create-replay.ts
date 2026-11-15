// src/lib/services/orders/create-replay.ts — the replay of an order creation by its idempotency
// key, and the failures a creation transaction can end with. Used by create.ts only.
import prisma from "@/lib/prisma";
import { uniqueViolationFields } from "@/lib/prisma-errors";
import type { CreateOrderRequest } from "@/lib/validators/order";
import type { CreateOrderResult } from "./create";
import { DiscountUnavailableError } from "./discount-ledger";
import { discountUnavailableMessage } from "./discount";
import { LimitedStockError } from "./limited-stock";
import { ShopStoppedTakingOrdersError } from "./order-shop";
import type { OrderCustomer, OrderQuote } from "./quote";

export type Failure = Extract<CreateOrderResult, { ok: false }>;

/** What creationFailure reads of the order being placed. */
interface PlacementAttempt {
  request: CreateOrderRequest;
  customer: OrderCustomer;
  quote: OrderQuote;
}

/** The idempotency key belongs to an order this request may not replay. */
export const KEY_ALREADY_USED_MESSAGE = "Cette demande a déjà été utilisée";
const IDEMPOTENCY_COLUMN = "idempotency_key";

/**
 * Thrown inside the creation transaction when a guest order is refused by its admission check
 * (GuestOrderPlacement.admit): the transaction rolls back and the creation answers RATE_LIMITED.
 */
export class GuestAdmissionRefusedError extends Error {
  constructor(readonly refusal: string) {
    super(refusal);
    this.name = "GuestAdmissionRefusedError";
  }
}

export const createdOrderInclude = {
  items: true,
  shop: { select: { id: true, name: true, slug: true } },
} as const;

/** Order already created with this key: returned to its customer only. */
export async function findByIdempotencyKey(
  idempotencyKey: string,
  customerId: string
): Promise<CreateOrderResult | null> {
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey },
    include: createdOrderInclude,
  });
  if (existing === null) return null;
  if (existing.userId !== customerId)
    return { ok: false, code: "CONFLICT", message: KEY_ALREADY_USED_MESSAGE };
  return { ok: true, status: 200, order: existing };
}

/**
 * A request refused while a concurrent request with the same key and customer created the order
 * (its code is then used, its stock taken, its key taken): the answer is that order, not the refusal.
 */
export async function replayOr(
  request: CreateOrderRequest,
  customer: OrderCustomer,
  failure: Failure
): Promise<CreateOrderResult> {
  return (await findByIdempotencyKey(request.idempotencyKey, customer.id)) ?? failure;
}

/**
 * Failures the transaction can end with. The order a concurrent request created with the same key
 * comes first (so a request refused by the guest cap while its twin succeeded gets that order);
 * then the failures the customer can act on; anything else is rethrown.
 */
export async function creationFailure(
  error: unknown,
  placement: PlacementAttempt
): Promise<CreateOrderResult> {
  const replay = await findByIdempotencyKey(
    placement.request.idempotencyKey,
    placement.customer.id
  );
  if (replay !== null) return replay;
  if (error instanceof ShopStoppedTakingOrdersError) {
    return { ok: false, code: "SERVICE_DISABLED", message: error.refusal };
  }
  if (error instanceof GuestAdmissionRefusedError) {
    return { ok: false, code: "RATE_LIMITED", message: error.refusal };
  }
  if (error instanceof DiscountUnavailableError) {
    return { ok: false, code: "PRICE_CHANGED", message: discountUnavailableMessage(error.reason) };
  }
  if (error instanceof LimitedStockError) {
    const line = placement.quote.lines.find((candidate) => candidate.productId === error.productId);
    if (line === undefined) throw error;
    return {
      ok: false,
      code: "STOCK_INSUFFICIENT",
      message: `${line.name} — stock limité épuisé`,
      details: { unavailableProductIds: [error.productId] },
    };
  }
  if (uniqueViolationFields(error)?.includes(IDEMPOTENCY_COLUMN)) {
    return { ok: false, code: "CONFLICT", message: KEY_ALREADY_USED_MESSAGE };
  }
  throw error;
}
