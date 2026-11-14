// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CartItem } from "@/lib/cart/cart-line";
import {
  buildCheckoutSubmission,
  buildCreateOrderRequest,
  buildQuoteRequest,
  checkoutFingerprint,
  parseCheckoutAttempt,
  prepareCheckoutAttempt,
  refusedCartLines,
  resolveIdempotencyKey,
  UNAVAILABLE_LINE_MESSAGE,
  type CheckoutSelection,
} from "@/lib/cart/order-payload";
import { createOrderSchema, orderQuoteRequestSchema } from "@/lib/validators/order";

const SHOP_ID = "clshop0000000000000000001";
const KEY_A = "6f1c1f3e-8d2a-4b8e-9a51-0f7c2d3e4a5b";
const KEY_B = "0b7e5c2d-1a3f-4e6b-8c9d-2e3f4a5b6c7d";

const weighed: CartItem = {
  id: "clprod00000000000000000001-500g",
  productId: "clprod00000000000000000001",
  name: "Entrecôte",
  imageUrl: "/img/products/boeuf-1.jpg",
  priceCents: 1911,
  quantity: 2,
  unit: "KG",
  weightGrams: 500,
  cutOption: "Tranches fines",
  variant: "Maturée",
};

const counted: CartItem = {
  id: "clprod00000000000000000002",
  productId: "clprod00000000000000000002",
  name: "Merguez",
  imageUrl: "/img/products/merguez.jpg",
  priceCents: 650,
  quantity: 3,
  unit: "BARQUETTE",
};

const sliced: CartItem = {
  id: "clprod00000000000000000003-120g",
  productId: "clprod00000000000000000003",
  name: "Pastrami",
  imageUrl: "/img/products/pastrami.jpg",
  priceCents: 3200,
  quantity: 1,
  unit: "TRANCHE",
  weightGrams: 120,
  sliceCount: 6,
  thickness: "fine",
};

function selection(overrides: Partial<CheckoutSelection> = {}): CheckoutSelection {
  return {
    shopId: SHOP_ID,
    items: [weighed, counted, sliced],
    promoCode: null,
    requestedTime: "asap",
    pickupSlot: null,
    customerNote: "",
    ...overrides,
  };
}

const FORBIDDEN_KEYS = [
  "cutPriceCents",
  "discountCents",
  "discountSource",
  "offerId",
  "loyaltyRewardId",
];

function keysDeep(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysDeep);
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => [k, ...keysDeep(v)]);
  }
  return [];
}

describe("buildQuoteRequest", () => {
  it("sends a weighed line as portions and grams of one portion, not as kilograms", () => {
    const request = buildQuoteRequest(selection());
    expect(request.items[0]).toEqual({
      productId: weighed.productId,
      quantity: 2,
      weightGrams: 500,
      cutOption: "Tranches fines",
      variant: "Maturée",
    });
  });

  it("sends a counted line without weight and a sliced line with its options", () => {
    const request = buildQuoteRequest(selection());
    expect(request.items[1]).toEqual({ productId: counted.productId, quantity: 3 });
    expect(request.items[2]).toEqual({
      productId: sliced.productId,
      quantity: 1,
      weightGrams: 120,
      sliceCount: 6,
      sliceThickness: "fine",
    });
  });

  it("always asks for payment on pickup and trims the promo code", () => {
    expect(buildQuoteRequest(selection()).paymentMethod).toBe("ON_PICKUP");
    expect(buildQuoteRequest(selection({ promoCode: "  BIENVENUE10 " })).promoCode).toBe(
      "BIENVENUE10"
    );
    expect(buildQuoteRequest(selection({ promoCode: "   " }))).not.toHaveProperty("promoCode");
    expect(buildQuoteRequest(selection())).not.toHaveProperty("promoCode");
  });

  it("parses with the server quote schema", () => {
    const parsed = orderQuoteRequestSchema.safeParse(
      buildQuoteRequest(selection({ promoCode: "BIENVENUE10" }))
    );
    expect(parsed.success).toBe(true);
  });
});

describe("buildCreateOrderRequest", () => {
  const slotSelection = selection({
    promoCode: "BIENVENUE10",
    requestedTime: "2026-11-14T10:00:00",
    pickupSlot: { startIso: "2026-11-14T09:00:00.000Z", endIso: "2026-11-14T09:30:00.000Z" },
    customerNote: "  Sans gras  ",
  });

  it("carries the confirmation, the slot and the trimmed note", () => {
    const request = buildCreateOrderRequest(slotSelection, {
      expectedTotalCents: 5432,
      idempotencyKey: KEY_A,
    });
    expect(request).toMatchObject({
      shopId: SHOP_ID,
      paymentMethod: "ON_PICKUP",
      promoCode: "BIENVENUE10",
      idempotencyKey: KEY_A,
      expectedTotalCents: 5432,
      requestedTime: "2026-11-14T10:00:00",
      pickupSlotStart: "2026-11-14T09:00:00.000Z",
      pickupSlotEnd: "2026-11-14T09:30:00.000Z",
      customerNote: "Sans gras",
    });
    expect(request.items[0]).toMatchObject({ quantity: 2, weightGrams: 500 });
  });

  it("omits an empty note and an absent slot", () => {
    const request = buildCreateOrderRequest(selection(), {
      expectedTotalCents: 100,
      idempotencyKey: KEY_A,
    });
    expect(request).not.toHaveProperty("customerNote");
    expect(request).not.toHaveProperty("pickupSlotStart");
    expect(request).not.toHaveProperty("pickupSlotEnd");
  });

  it("contains no client-side amount or discount reference", () => {
    const request = buildCreateOrderRequest(slotSelection, {
      expectedTotalCents: 5432,
      idempotencyKey: KEY_A,
    });
    const keys = keysDeep(request);
    for (const forbidden of FORBIDDEN_KEYS) expect(keys).not.toContain(forbidden);
  });

  it("parses with the server createOrderSchema", () => {
    const request = buildCreateOrderRequest(slotSelection, {
      expectedTotalCents: 5432,
      idempotencyKey: KEY_A,
    });
    const parsed = createOrderSchema.safeParse(request);
    expect(parsed.success).toBe(true);
  });
});

describe("buildCheckoutSubmission", () => {
  const request = buildCreateOrderRequest(selection(), {
    expectedTotalCents: 5432,
    idempotencyKey: KEY_A,
  });

  it("sends a signed-in customer's request unchanged to /api/orders", () => {
    expect(buildCheckoutSubmission(request, null)).toEqual({
      endpoint: "/api/orders",
      body: request,
    });
  });

  it("sends a guest's request to /api/checkout/guest with the trimmed identity beside the order fields", () => {
    const submission = buildCheckoutSubmission(request, {
      email: "  fatima@exemple.fr ",
      firstName: " Fatima ",
      lastName: " Amrani ",
      phone: " 06 12 34 56 78 ",
    });
    expect(submission).toEqual({
      endpoint: "/api/checkout/guest",
      body: {
        ...request,
        email: "fatima@exemple.fr",
        firstName: "Fatima",
        lastName: "Amrani",
        phone: "06 12 34 56 78",
      },
    });
  });

  it.each([
    ["an empty phone", "   "],
    ["no phone", undefined],
  ])("omits the phone for %s", (_label, phone) => {
    const submission = buildCheckoutSubmission(request, {
      email: "fatima@exemple.fr",
      firstName: "Fatima",
      lastName: "Amrani",
      ...(phone !== undefined && { phone }),
    });
    expect(submission.endpoint).toBe("/api/checkout/guest");
    expect(submission.body).not.toHaveProperty("phone");
  });
});

describe("checkoutFingerprint and resolveIdempotencyKey", () => {
  const unkeyed = (s: CheckoutSelection, expectedTotalCents = 5432) => {
    const { idempotencyKey: _key, ...rest } = buildCreateOrderRequest(s, {
      expectedTotalCents,
      idempotencyKey: KEY_A,
    });
    void _key;
    return rest;
  };
  const base = selection({ promoCode: "BIENVENUE10" });
  const baseFingerprint = checkoutFingerprint(unkeyed(base));

  it("gives the same fingerprint for the same selection, and keeps the key", () => {
    expect(checkoutFingerprint(unkeyed(selection({ promoCode: "BIENVENUE10" })))).toBe(
      baseFingerprint
    );
    const previous = { key: KEY_A, fingerprint: baseFingerprint };
    const generate = () => KEY_B;
    expect(resolveIdempotencyKey(previous, baseFingerprint, generate)).toEqual(previous);
  });

  it("ignores a key passed along with the content", () => {
    const keyed = buildCreateOrderRequest(base, {
      expectedTotalCents: 5432,
      idempotencyKey: KEY_B,
    });
    expect(checkoutFingerprint(keyed)).toBe(baseFingerprint);
  });

  it.each([
    [
      "a quantity",
      selection({
        promoCode: "BIENVENUE10",
        items: [{ ...weighed, quantity: 3 }, counted, sliced],
      }),
    ],
    [
      "a portion weight",
      selection({
        promoCode: "BIENVENUE10",
        items: [{ ...weighed, weightGrams: 600 }, counted, sliced],
      }),
    ],
    [
      "the slot",
      selection({
        promoCode: "BIENVENUE10",
        requestedTime: "2026-11-14T10:00:00",
        pickupSlot: { startIso: "2026-11-14T09:00:00.000Z", endIso: "2026-11-14T09:30:00.000Z" },
      }),
    ],
    ["the note", selection({ promoCode: "BIENVENUE10", customerNote: "Bien saignant" })],
    ["the promo code", selection({ promoCode: "AUTRECODE" })],
  ])("changing %s gives a new fingerprint and a new key", (_label, changed) => {
    const fingerprint = checkoutFingerprint(unkeyed(changed));
    expect(fingerprint).not.toBe(baseFingerprint);
    const next = resolveIdempotencyKey(
      { key: KEY_A, fingerprint: baseFingerprint },
      fingerprint,
      () => KEY_B
    );
    expect(next).toEqual({ key: KEY_B, fingerprint });
  });

  it("changing the expected total gives a new fingerprint and a new key", () => {
    const fingerprint = checkoutFingerprint(unkeyed(base, 5500));
    expect(fingerprint).not.toBe(baseFingerprint);
    expect(
      resolveIdempotencyKey({ key: KEY_A, fingerprint: baseFingerprint }, fingerprint, () => KEY_B)
        .key
    ).toBe(KEY_B);
  });

  it("generates a key when there is no previous attempt", () => {
    let calls = 0;
    const next = resolveIdempotencyKey(null, baseFingerprint, () => {
      calls += 1;
      return KEY_B;
    });
    expect(next).toEqual({ key: KEY_B, fingerprint: baseFingerprint });
    expect(calls).toBe(1);
  });
});

describe("prepareCheckoutAttempt", () => {
  it("reuses the previous key for an unchanged checkout and returns a keyed request", () => {
    const first = prepareCheckoutAttempt(selection(), 5432, null, () => KEY_A);
    expect(first.request.idempotencyKey).toBe(KEY_A);
    const retry = prepareCheckoutAttempt(selection(), 5432, first.attempt, () => KEY_B);
    expect(retry.attempt).toEqual(first.attempt);
    expect(retry.request).toEqual(first.request);
  });

  it("draws a new key once the confirmed total changes", () => {
    const first = prepareCheckoutAttempt(selection(), 5432, null, () => KEY_A);
    const changed = prepareCheckoutAttempt(selection(), 5400, first.attempt, () => KEY_B);
    expect(changed.request.idempotencyKey).toBe(KEY_B);
    expect(changed.request.expectedTotalCents).toBe(5400);
  });
});

describe("parseCheckoutAttempt", () => {
  it("reads a stored attempt and rejects anything else", () => {
    expect(parseCheckoutAttempt(JSON.stringify({ key: KEY_A, fingerprint: "f" }))).toEqual({
      key: KEY_A,
      fingerprint: "f",
    });
    expect(parseCheckoutAttempt(null)).toBeNull();
    expect(parseCheckoutAttempt("not json")).toBeNull();
    expect(parseCheckoutAttempt("null")).toBeNull();
    expect(parseCheckoutAttempt(JSON.stringify({ key: 1, fingerprint: "f" }))).toBeNull();
    expect(parseCheckoutAttempt(JSON.stringify({ key: KEY_A, fingerprint: "" }))).toBeNull();
  });
});

describe("refusedCartLines", () => {
  const items = [weighed, counted, sliced];

  it("puts each quote detail beside the cart line at its index, with the server's messages", () => {
    const refused = refusedCartLines(items, {
      code: "VALIDATION_ERROR",
      details: {
        "items.0.variant": ["Entrecôte : variante inconnue"],
        "items.2.sliceCount": ["Pastrami : nombre de tranches ou épaisseur non proposés"],
      },
    });
    expect(refused).toEqual({
      [weighed.id]: ["Entrecôte : variante inconnue"],
      [sliced.id]: ["Pastrami : nombre de tranches ou épaisseur non proposés"],
    });
  });

  it("gathers several fields of one line, the line-level key included, without repeating a message", () => {
    const refused = refusedCartLines(items, {
      code: "VALIDATION_ERROR",
      details: {
        "items.1": ["Unrecognized key(s) in object: 'cutPriceCents'"],
        "items.1.quantity": ["Quantité maximale : 99"],
        "items.1.weightGrams": ["Quantité maximale : 99"],
      },
    });
    expect(refused).toEqual({
      [counted.id]: ["Unrecognized key(s) in object: 'cutPriceCents'", "Quantité maximale : 99"],
    });
  });

  it("ignores details that name no line of the cart", () => {
    const refused = refusedCartLines(items, {
      code: "VALIDATION_ERROR",
      details: {
        shopId: ["shopId requis"],
        items: ["Au moins 1 article requis"],
        "items.7.quantity": ["x"],
        "items.x": ["y"],
      },
    });
    expect(refused).toEqual({});
  });

  it("marks every line of a product the shop cannot sell now", () => {
    const twoCuts: CartItem = { ...weighed, id: `${weighed.productId}-1000g`, weightGrams: 1000 };
    const refused = refusedCartLines([weighed, counted, twoCuts], {
      code: "STOCK_INSUFFICIENT",
      details: { unavailableProductIds: [weighed.productId] },
    });
    expect(Object.keys(refused)).toEqual([weighed.id, twoCuts.id]);
    expect(refused[weighed.id]).toEqual([UNAVAILABLE_LINE_MESSAGE]);
  });

  it("reads product ids only for a stock refusal, and nothing without details", () => {
    expect(
      refusedCartLines(items, {
        code: "PRODUCTS_MISSING",
        details: { missingProductIds: [weighed.productId] },
      })
    ).toEqual({});
    expect(refusedCartLines(items, { code: "VALIDATION_ERROR" })).toEqual({});
    expect(refusedCartLines(items, null)).toEqual({});
  });
});
