// @vitest-environment node
// Online payment stays refused: the real handlers POST /api/orders/quote, POST /api/orders and
// POST /api/checkout/guest answer 400 to paymentMethod "ONLINE" with the French message, create no
// order, and make no call to the Stripe gateway (its fake records every call). Lifting the lock
// changes this contract: update this file with it, on purpose.
// Simulated: the transports, the caller's session and the gateway; PostgreSQL is real.
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakePaymentGateway } from "../helpers/fake-payment-gateway";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => "sent") }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));
vi.mock("@/lib/emails/order-confirmation", () => ({
  sendOrderConfirmationEmail: vi.fn(async () => true),
}));

const auth = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@/lib/auth/server-auth", () => ({ getServerUserId: async () => auth.clerkId }));

const gateway = createFakePaymentGateway();
vi.mock("@/lib/payments/gateway", () => ({ getPaymentGateway: () => gateway }));

import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestProduct, createTestShop, createTestUser } from "../helpers/factories";
import { quoteOf, quoteRequest } from "./create-order-fixtures";

const { POST: postQuote } = await import("@/app/api/orders/quote/route");
const { POST: postOrder } = await import("@/app/api/orders/route");
const { POST: postGuestCheckout } = await import("@/app/api/checkout/guest/route");

// eslint-disable-next-line react-hooks/rules-of-hooks -- not a React hook
useCleanDatabase();

const ONLINE_REFUSED =
  "Le paiement en ligne n'est pas encore disponible. Réglez sur place au retrait.";

type Handler = (req: NextRequest) => Promise<Response>;

let ipSequence = 0;

async function post(handler: Handler, path: string, body: Record<string, unknown>) {
  ipSequence += 1;
  const response = await handler(
    new NextRequest(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `198.18.0.${ipSequence}` },
      body: JSON.stringify(body),
    })
  );
  const json = (await response.json()) as {
    error?: { code: string; message: string; details?: Record<string, string[]> };
  };
  return { status: response.status, error: json.error };
}

/** A complete, confirmed order body that only differs from a valid one by its payment method. */
async function onlineOrder() {
  const shop = await createTestShop();
  const beef = await createTestProduct(shop.id);
  const request = quoteRequest(shop.id, [{ productId: beef.id, quantity: 1, weightGrams: 500 }]);
  return {
    quote: { ...request, paymentMethod: "ONLINE" },
    order: {
      ...request,
      paymentMethod: "ONLINE",
      idempotencyKey: randomUUID(),
      expectedTotalCents: (await quoteOf(request, null)).amountDueCents,
      weighTolerance: "STANDARD",
    },
  };
}

beforeEach(() => {
  auth.clerkId = null;
  gateway.reset();
});

describe("online payment refused by the quote and order routes", () => {
  it.each([
    ["anonymous", false],
    ["signed-in customer", true],
  ])(
    "POST /api/orders/quote, %s: 400 with the message, no Stripe call",
    async (_label, signedIn) => {
      if (signedIn) auth.clerkId = (await createTestUser()).clerkId;
      const { quote } = await onlineOrder();

      const answer = await post(postQuote, "/api/orders/quote", quote);

      expect(answer.status).toBe(400);
      expect(answer.error).toMatchObject({
        code: "VALIDATION_ERROR",
        details: { paymentMethod: [ONLINE_REFUSED] },
      });
      expect(gateway.calls).toEqual([]);
    }
  );

  it("POST /api/orders: 400 with the message, no order, no Stripe call", async () => {
    const user = await createTestUser();
    auth.clerkId = user.clerkId;
    const { order } = await onlineOrder();

    const answer = await post(postOrder, "/api/orders", order);

    expect(answer.status).toBe(400);
    expect(answer.error).toMatchObject({
      code: "VALIDATION_ERROR",
      details: { paymentMethod: [ONLINE_REFUSED] },
    });
    expect(await prisma.order.count()).toBe(0);
    expect(gateway.calls).toEqual([]);
  });

  it("POST /api/checkout/guest: 400 with the message, no order, no Stripe call", async () => {
    const { order } = await onlineOrder();

    const answer = await post(postGuestCheckout, "/api/checkout/guest", {
      ...order,
      email: "en-ligne@itest.klikandgo.test",
      firstName: "Nora",
      lastName: "Invitée",
    });

    expect(answer.status).toBe(400);
    expect(answer.error).toMatchObject({
      code: "VALIDATION_ERROR",
      details: { paymentMethod: [ONLINE_REFUSED] },
    });
    expect(await prisma.order.count()).toBe(0);
    expect(gateway.calls).toEqual([]);
  });

  it("accepts the same body paid at pickup: only the payment method is refused", async () => {
    const user = await createTestUser();
    auth.clerkId = user.clerkId;
    const { order } = await onlineOrder();

    const answer = await post(postOrder, "/api/orders", { ...order, paymentMethod: "ON_PICKUP" });

    expect(answer.status).toBe(201);
    expect(await prisma.order.count()).toBe(1);
    expect(gateway.calls).toEqual([]);
  });
});
