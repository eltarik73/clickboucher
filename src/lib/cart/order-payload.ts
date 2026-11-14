// src/lib/cart/order-payload.ts — the cart turned into a quote or order request.
//
// The only place where the checkout request is built. Lines are sent exactly as the
// cart holds them (decision 1 of chantier 0): quantity = portions (KG, TRANCHE) or
// units, weightGrams = grams of ONE portion, the cut option by NAME. No amount, no
// discount, no price ever leaves the browser: the server quotes everything.
//
// The return types are the request types of the server schemas, so a drift between
// the cart and `@/lib/validators/order` fails `tsc`.
//
// Pure and client-safe: no I/O, no clock, no randomness (the key generator is injected).

import type { CartItem } from "@/lib/cart/cart-line";
import { isWeighedUnit } from "@/lib/pricing/line";
import type { CreateOrderRequest, OrderLineInput, OrderQuoteRequest } from "@/lib/validators/order";

export interface CheckoutSelection {
  shopId: string;
  items: readonly CartItem[];
  promoCode: string | null;
  requestedTime: string;
  pickupSlot: { startIso: string; endIso: string } | null;
  customerNote: string;
}

export interface CheckoutAttempt {
  key: string;
  fingerprint: string;
}

type UnkeyedCreateOrderRequest = Omit<CreateOrderRequest, "idempotencyKey">;

function nonEmpty(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toLineInput(item: CartItem): OrderLineInput {
  return {
    productId: item.productId,
    quantity: item.quantity,
    ...(isWeighedUnit(item.unit) && { weightGrams: item.weightGrams }),
    ...(nonEmpty(item.cutOption) && { cutOption: item.cutOption }),
    ...(nonEmpty(item.variant) && { variant: item.variant }),
    ...(item.sliceCount !== undefined && item.sliceCount > 0 && { sliceCount: item.sliceCount }),
    ...(nonEmpty(item.thickness) && { sliceThickness: item.thickness }),
    ...(item.pieceCount !== undefined && item.pieceCount > 0 && { pieceCount: item.pieceCount }),
    ...(nonEmpty(item.pieceLabel) && { pieceLabel: item.pieceLabel }),
  };
}

export function buildQuoteRequest(selection: CheckoutSelection): OrderQuoteRequest {
  const promoCode = nonEmpty(selection.promoCode);
  return {
    shopId: selection.shopId,
    items: selection.items.map(toLineInput),
    paymentMethod: "ON_PICKUP",
    ...(promoCode && { promoCode }),
  };
}

function buildUnkeyedRequest(
  selection: CheckoutSelection,
  expectedTotalCents: number
): UnkeyedCreateOrderRequest {
  const customerNote = nonEmpty(selection.customerNote);
  return {
    ...buildQuoteRequest(selection),
    expectedTotalCents,
    requestedTime: selection.requestedTime,
    ...(customerNote && { customerNote }),
    ...(selection.pickupSlot && {
      pickupSlotStart: selection.pickupSlot.startIso,
      pickupSlotEnd: selection.pickupSlot.endIso,
    }),
  };
}

export function buildCreateOrderRequest(
  selection: CheckoutSelection,
  confirmation: { expectedTotalCents: number; idempotencyKey: string }
): CreateOrderRequest {
  return {
    ...buildUnkeyedRequest(selection, confirmation.expectedTotalCents),
    idempotencyKey: confirmation.idempotencyKey,
  };
}

/** A refusal of the quote or the order, as `{ success: false, error }` carries it. */
export interface CheckoutRefusal {
  code: string;
  details?: Record<string, string[]>;
}

/** Shown beside a line whose product the shop cannot sell now (STOCK_INSUFFICIENT names products, not lines). */
export const UNAVAILABLE_LINE_MESSAGE =
  "Indisponible pour le moment, ou stock insuffisant pour cette quantité";

const LINE_DETAIL_KEY = /^items\.(\d+)(?:\.|$)/;

/**
 * Messages of a refusal for each cart line it concerns, keyed by cart line id. The request lists
 * the lines in cart order, so a detail keyed `items.N…` (quote checks and schema errors alike)
 * belongs to items[N]; a STOCK_INSUFFICIENT refusal names products, and marks every line of each.
 * Details naming no line (shop, promo code, product ids of PRODUCTS_MISSING) are left out: an empty
 * result means the refusal is not about one line.
 */
export function refusedCartLines(
  items: readonly CartItem[],
  refusal: CheckoutRefusal | null
): Record<string, string[]> {
  const refused: Record<string, string[]> = {};
  const add = (item: CartItem | undefined, messages: readonly string[]) => {
    if (!item) return;
    const kept = refused[item.id] ?? [];
    for (const message of messages) if (!kept.includes(message)) kept.push(message);
    if (kept.length > 0) refused[item.id] = kept;
  };
  const details = refusal?.details;
  if (!details) return refused;

  for (const [key, messages] of Object.entries(details)) {
    const match = LINE_DETAIL_KEY.exec(key);
    if (match) add(items[Number(match[1])], messages);
  }
  if (refusal.code === "STOCK_INSUFFICIENT") {
    const unavailable = details.unavailableProductIds ?? [];
    for (const item of items) {
      if (unavailable.includes(item.productId)) add(item, [UNAVAILABLE_LINE_MESSAGE]);
    }
  }
  return refused;
}

/** Identity of a visitor ordering without an account, sent beside the order fields. */
export interface GuestIdentity {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

/** Where a confirmed order is sent, and the body sent there. */
export type CheckoutSubmission =
  | { endpoint: "/api/orders"; body: CreateOrderRequest }
  | { endpoint: "/api/checkout/guest"; body: CreateOrderRequest & GuestIdentity };

/**
 * A signed-in customer posts the order request to /api/orders; a guest posts it to
 * /api/checkout/guest with the identity fields beside it, trimmed, the phone left out when empty.
 */
export function buildCheckoutSubmission(
  request: CreateOrderRequest,
  guest: GuestIdentity | null
): CheckoutSubmission {
  if (guest === null) return { endpoint: "/api/orders", body: request };
  const phone = nonEmpty(guest.phone);
  return {
    endpoint: "/api/checkout/guest",
    body: {
      ...request,
      email: guest.email.trim(),
      firstName: guest.firstName.trim(),
      lastName: guest.lastName.trim(),
      ...(phone && { phone }),
    },
  };
}

/** JSON with object keys sorted at every level, so equal content gives an equal string. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Identity of the checkout content. A key passed along by mistake is ignored. */
export function checkoutFingerprint(request: UnkeyedCreateOrderRequest): string {
  const content: Record<string, unknown> = { ...request };
  delete content.idempotencyKey;
  return canonicalJson(content);
}

/** Same fingerprint => same key; different fingerprint or no previous => generate(). */
export function resolveIdempotencyKey(
  previous: CheckoutAttempt | null,
  fingerprint: string,
  generate: () => string
): CheckoutAttempt {
  if (previous && previous.fingerprint === fingerprint) {
    return { key: previous.key, fingerprint };
  }
  return { key: generate(), fingerprint };
}

/** The order request of a confirmation, with the key of the previous attempt when the content is unchanged. */
export function prepareCheckoutAttempt(
  selection: CheckoutSelection,
  expectedTotalCents: number,
  previous: CheckoutAttempt | null,
  generate: () => string
): { request: CreateOrderRequest; attempt: CheckoutAttempt } {
  const unkeyed = buildUnkeyedRequest(selection, expectedTotalCents);
  const attempt = resolveIdempotencyKey(previous, checkoutFingerprint(unkeyed), generate);
  return { request: { ...unkeyed, idempotencyKey: attempt.key }, attempt };
}

/** Reads a stored attempt; anything that is not { key, fingerprint } strings counts as none. */
export function parseCheckoutAttempt(raw: string | null): CheckoutAttempt | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
  if (parsed === null || typeof parsed !== "object") return null;
  const { key, fingerprint } = parsed as Record<string, unknown>;
  if (typeof key !== "string" || typeof fingerprint !== "string" || !key || !fingerprint)
    return null;
  return { key, fingerprint };
}
