// @vitest-environment node
// The customer behind a quote and an order, resolved the same way by both routes, on real
// PostgreSQL: a signed-in customer whose users row does not exist yet (the Clerk webhook has not
// run) gets the row created by the quote, keeps the discount of a valid code, and the order placed
// from that quote is accepted. Also: concurrent first requests resolve to one users row, and the
// promo-code brute-force guard counts refused codes only.
//
// Mocked: outbound transports, the Clerk API (stub keys locally), the caller's identity, and the
// rate-limit module (its limiters call Redis) replaced by a counting stub.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));
vi.mock("@/lib/emails/order-confirmation", () => ({
  sendOrderConfirmationEmail: vi.fn(async () => true),
}));

const auth = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@/lib/auth/server-auth", () => ({
  getServerUserId: async () => auth.clerkId,
}));

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    users: {
      getUser: async (clerkId: string) => ({
        emailAddresses: [{ emailAddress: `${clerkId}@itest.klikandgo.test` }],
        firstName: "Nora",
        lastName: "Benali",
        phoneNumbers: [],
      }),
    },
  }),
}));

const limits = vi.hoisted(() => ({ calls: [] as string[], exhausted: new Set<string>() }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimits: { api: "api", orders: "orders", promoValidate: "promoValidate" },
  checkRateLimit: async (limiter: string) => {
    limits.calls.push(limiter);
    return { success: !limits.exhausted.has(limiter) };
  },
}));

import { resolveOrderCustomer } from "@/lib/services/orders/customer";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestOffer, createTestProduct, createTestShop } from "../helpers/factories";

const { POST: postQuote } = await import("@/app/api/orders/quote/route");
const { POST: postOrder } = await import("@/app/api/orders/route");

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

beforeEach(() => {
  auth.clerkId = null;
  limits.calls.length = 0;
  limits.exhausted.clear();
});

function jsonRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7" },
    body: JSON.stringify(body),
  });
}

async function basketWithCode() {
  const shop = await createTestShop();
  const beef = await createTestProduct(shop.id, { unit: "KG", priceCents: 1911 });
  const offer = await createTestOffer({ code: "BIENVENUE10", type: "PERCENT", discountValue: 10 });
  const request = {
    shopId: shop.id,
    items: [{ productId: beef.id, quantity: 2, weightGrams: 500 }],
    paymentMethod: "ON_PICKUP",
    promoCode: offer.code,
  };
  return { shop, request };
}

describe("quote and order of a signed-in customer without a users row", () => {
  it("quotes the code's discount, then creates the order for that amount, with one users row", async () => {
    const { request } = await basketWithCode();
    auth.clerkId = "user_itest_fresh_signup";

    const quoteResponse = await postQuote(jsonRequest("/api/orders/quote", request));
    expect(quoteResponse.status).toBe(200);
    const quote = (await quoteResponse.json()).data;
    expect(quote.discountRejection).toBeNull();
    expect(quote.subtotalCents).toBe(1912);
    expect(quote.discount).toMatchObject({ code: "BIENVENUE10", discountCents: 191 });
    expect(quote.amountDueCents).toBe(1721);

    const orderResponse = await postOrder(
      jsonRequest("/api/orders", {
        ...request,
        idempotencyKey: "4a1f0c55-7a0e-4a43-9c1e-7d1b2f3a4b5c",
        expectedTotalCents: quote.amountDueCents,
        requestedTime: "asap",
      })
    );
    expect(orderResponse.status).toBe(201);
    const order = (await orderResponse.json()).data;
    expect(order.totalCents).toBe(1721);

    const users = await prisma.user.findMany({ where: { clerkId: "user_itest_fresh_signup" } });
    expect(users).toHaveLength(1);
    // The answer is the customer view: no user id in it, the stored order carries it.
    expect(order).not.toHaveProperty("userId");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).userId).toBe(
      users[0].id
    );
  });
});

describe("resolveOrderCustomer", () => {
  it("returns the same user to five concurrent first requests of a new clerk id", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => resolveOrderCustomer("user_itest_concurrent_first"))
    );

    expect(results.every((customer) => customer !== null)).toBe(true);
    expect(new Set(results.map((customer) => customer?.id)).size).toBe(1);
    expect(await prisma.user.count({ where: { clerkId: "user_itest_concurrent_first" } })).toBe(1);
  });
});

describe("promo-code brute-force guard of the quote route", () => {
  it("does not charge the guard when an accepted code is quoted again, even once exhausted", async () => {
    const { request } = await basketWithCode();
    auth.clerkId = "user_itest_adjusting_basket";
    limits.exhausted.add("promoValidate");

    for (const quantity of [1, 2, 3]) {
      const response = await postQuote(
        jsonRequest("/api/orders/quote", { ...request, items: [{ ...request.items[0], quantity }] })
      );
      expect(response.status).toBe(200);
      expect((await response.json()).data.discountRejection).toBeNull();
    }
    expect(limits.calls.filter((limiter) => limiter === "promoValidate")).toEqual([]);
  });

  it("charges the guard for a refused code and answers RATE_LIMITED once it is exhausted", async () => {
    const { request } = await basketWithCode();
    auth.clerkId = "user_itest_guessing";
    const guess = { ...request, promoCode: "DEVINETTE" };

    const allowed = await postQuote(jsonRequest("/api/orders/quote", guess));
    expect(allowed.status).toBe(200);
    expect((await allowed.json()).data.discountRejection).not.toBeNull();
    expect(limits.calls.filter((limiter) => limiter === "promoValidate")).toHaveLength(1);

    limits.exhausted.add("promoValidate");
    const refused = await postQuote(jsonRequest("/api/orders/quote", guess));
    expect(refused.status).toBe(429);
    expect((await refused.json()).error).toMatchObject({ code: "RATE_LIMITED" });
    expect(limits.calls.filter((limiter) => limiter === "promoValidate")).toHaveLength(2);
  });
});
