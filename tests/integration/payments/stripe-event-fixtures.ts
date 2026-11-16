// Stripe events signed locally and Klik&Go rows, for the payment integration tests.
//
// Nothing here talks to Stripe: Stripe.webhooks.generateTestHeaderString computes the HMAC Stripe
// would send, with dummy secrets that exist only in these tests (assembled from pieces, so that no
// secret scanner mistakes them for real ones). The dummy secret key only makes isStripeConfigured()
// true: the webhook never builds a client, and each webhook test file installs the fake payment
// gateway and asserts that it received no call. Event objects carry only the fields the handlers
// read.
import Stripe from "stripe";
import { NextRequest } from "next/server";
import type { Order, OrderItem, Prisma, Product, Shop, User } from "@prisma/client";
import { afterEach, beforeEach, vi } from "vitest";
import { POST } from "@/app/api/payments/webhook/route";
import {
  createTestOrder,
  createTestProduct,
  createTestShop,
  createTestUser,
} from "../helpers/factories";

const DUMMY = "itest".repeat(6);
const STRIPE_TEST_ENV = {
  STRIPE_SECRET_KEY: ["sk", "test", DUMMY].join("_"),
  STRIPE_WEBHOOK_SECRET: ["whsec", "platform", DUMMY].join("_"),
  STRIPE_CONNECT_WEBHOOK_SECRET: ["whsec", "connect", DUMMY].join("_"),
};

const PLATFORM_SECRET = STRIPE_TEST_ENV.STRIPE_WEBHOOK_SECRET;
export const CONNECT_SECRET = STRIPE_TEST_ENV.STRIPE_CONNECT_WEBHOOK_SECRET;
export const FOREIGN_SECRET = ["whsec", "foreign", DUMMY].join("_");
/** The only kind of secret key the production deployment accepts. */
export const LIVE_SECRET_KEY = ["sk", "live", DUMMY].join("_");

/**
 * The dummy Stripe configuration, stubbed before each test and removed after it (a test that
 * changes or removes a variable does it with vi.stubEnv).
 */
export function useStripeTestEnv(): void {
  beforeEach(() => {
    for (const [name, value] of Object.entries(STRIPE_TEST_ENV)) vi.stubEnv(name, value);
  });
  afterEach(() => vi.unstubAllEnvs());
}

let sequence = 0;
/** Unique Stripe-like id within the test file. */
export function stripeId(prefix: string): string {
  sequence += 1;
  return `${prefix}_itest${sequence}`;
}

interface TestEvent {
  id: string;
  object: "event";
  type: string;
  livemode: boolean;
  created: number;
  account?: string;
  data: { object: Record<string, unknown> };
}

export function stripeEvent(
  type: string,
  object: Record<string, unknown>,
  options: { id?: string; livemode?: boolean; account?: string } = {}
): TestEvent {
  return {
    id: options.id ?? stripeId("evt"),
    object: "event",
    type,
    livemode: options.livemode ?? false,
    created: Math.floor(Date.now() / 1000),
    ...(options.account !== undefined && { account: options.account }),
    data: { object },
  };
}

/** A webhook request as Stripe sends it, signed with `secret`. */
export function signedRequest(
  event: TestEvent,
  secret: string = PLATFORM_SECRET,
  timestamp?: number
): NextRequest {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp });
  return new NextRequest("http://localhost/api/payments/webhook", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": header, "content-type": "application/json" },
  });
}

interface WebhookResponse {
  status: number;
  body: Record<string, unknown>;
}

export async function send(request: NextRequest): Promise<WebhookResponse> {
  const response = await POST(request);
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

export function deliver(
  event: TestEvent,
  secret: string = PLATFORM_SECRET
): Promise<WebhookResponse> {
  return send(signedRequest(event, secret));
}

// ── Stripe objects (only the fields the handlers read) ─────────────────────────

export function checkoutSession(input: {
  id?: string;
  orderId?: string;
  paymentIntent?: string | null;
}) {
  return {
    id: input.id ?? stripeId("cs"),
    object: "checkout.session",
    metadata: input.orderId === undefined ? {} : { orderId: input.orderId },
    payment_intent: input.paymentIntent ?? null,
  };
}

export function paymentIntent(input: {
  id: string;
  orderId?: string;
  amountCapturable?: number;
  amountReceived?: number;
  latestCharge?: string | Record<string, unknown> | null;
  declineCode?: string;
}) {
  return {
    id: input.id,
    object: "payment_intent",
    metadata: input.orderId === undefined ? {} : { orderId: input.orderId },
    amount_capturable: input.amountCapturable ?? 0,
    amount_received: input.amountReceived ?? 0,
    latest_charge: input.latestCharge ?? null,
    cancellation_reason: null,
    last_payment_error:
      input.declineCode === undefined
        ? null
        : { code: "card_declined", decline_code: input.declineCode },
  };
}

export function charge(input: {
  id?: string;
  orderId?: string;
  paymentIntent: string;
  amount: number;
  amountRefunded: number;
}) {
  return {
    id: input.id ?? stripeId("ch"),
    object: "charge",
    metadata: input.orderId === undefined ? {} : { orderId: input.orderId },
    payment_intent: input.paymentIntent,
    amount: input.amount,
    amount_refunded: input.amountRefunded,
  };
}

// ── Klik&Go rows ───────────────────────────────────────────────────────────────

interface PaymentWorld {
  shop: Shop;
  customer: User;
  product: Product;
}

export async function createPaymentWorld(
  shop: Partial<Prisma.ShopUncheckedCreateInput> = {}
): Promise<PaymentWorld> {
  const createdShop = await createTestShop(shop);
  return {
    shop: createdShop,
    customer: await createTestUser(),
    product: await createTestProduct(createdShop.id),
  };
}

/**
 * An order paid ONLINE, written by the factory: creating one through the API stays refused in this
 * phase (tests/integration/orders/online-refused.test.ts).
 */
export function createOnlineOrder(
  world: PaymentWorld,
  options: { status?: Order["status"]; overrides?: Partial<Prisma.OrderUncheckedCreateInput> } = {}
): Promise<Order & { items: OrderItem[] }> {
  return createTestOrder({
    shopId: world.shop.id,
    userId: world.customer.id,
    status: options.status,
    items: [{ productId: world.product.id }],
    overrides: { paymentMethod: "ONLINE", ...options.overrides },
  });
}
