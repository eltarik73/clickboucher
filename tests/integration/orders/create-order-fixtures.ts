// Shared inputs of the quote and order-creation integration tests: the customer as the routes
// resolve it, and request bodies whose confirmed total comes from the server's own quote.
import { randomUUID } from "crypto";
import type { User } from "@prisma/client";
import { expect } from "vitest";

import { quoteOrder, type OrderCustomer, type OrderQuote } from "@/lib/services/orders/quote";
import type { CreateOrderRequest, OrderLineInput, OrderQuoteRequest } from "@/lib/validators/order";

export function customerOf(user: User): OrderCustomer {
  return {
    id: user.id,
    role: user.role,
    isGuest: user.isGuest,
    firstName: user.firstName,
    email: user.email,
  };
}

export function quoteRequest(
  shopId: string,
  items: OrderLineInput[],
  promoCode?: string
): OrderQuoteRequest {
  return {
    shopId,
    items,
    paymentMethod: "ON_PICKUP",
    ...(promoCode === undefined ? {} : { promoCode }),
  };
}

export async function quoteOf(
  request: OrderQuoteRequest,
  customer: OrderCustomer | null
): Promise<OrderQuote> {
  const result = await quoteOrder(request, customer, new Date());
  if (!result.ok) throw new Error(`quoteOrder refused: ${result.code} ${result.message}`);
  return result.quote;
}

/** A body as the cart sends it: confirmed total = the server's amountDueCents, fresh key. */
export async function confirmedBody(
  request: OrderQuoteRequest,
  customer: OrderCustomer,
  overrides: Partial<CreateOrderRequest> = {}
): Promise<CreateOrderRequest> {
  const quote = await quoteOf(request, customer);
  expect(quote.discountRejection).toBeNull();
  return {
    ...request,
    idempotencyKey: randomUUID(),
    expectedTotalCents: quote.amountDueCents,
    ...overrides,
  };
}
