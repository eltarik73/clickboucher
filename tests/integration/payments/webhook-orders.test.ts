// @vitest-environment node
// What each Stripe event does to an order, on real PostgreSQL with locally signed events. Only
// checkout.session.expired changes a status, through the system command expireUnpaidCheckout
// (PENDING -> AUTO_CANCELLED, closing effects, one notification); the other events record payment
// columns of ONLINE orders, each once, whatever the order and the repetition of the deliveries.
// Orders paid at pickup are never touched. No Stripe call: the fake payment gateway must record none.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakePaymentGateway } from "../helpers/fake-payment-gateway";

const gateway = createFakePaymentGateway();
vi.mock("@/lib/payments/gateway", () => ({ getPaymentGateway: () => gateway }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => "sent") }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));

import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestOffer } from "../helpers/factories";
import { eventsOf, notificationsOf, reload } from "../orders/commands-fixtures";
import {
  charge,
  checkoutSession,
  createOnlineOrder,
  createPaymentWorld,
  deliver,
  paymentIntent,
  stripeEvent,
  stripeId,
  useStripeTestEnv,
} from "./stripe-event-fixtures";

/* eslint-disable react-hooks/rules-of-hooks -- not React hooks: the rule reads the « use » prefix */
useCleanDatabase();
useStripeTestEnv();
/* eslint-enable react-hooks/rules-of-hooks */

beforeEach(() => gateway.reset());
afterEach(() => expect(gateway.calls).toEqual([]));

async function handled(type: string, object: Record<string, unknown>) {
  const response = await deliver(stripeEvent(type, object));
  expect(response).toEqual({ status: 200, body: { received: true } });
}

describe("checkout.session.expired", () => {
  it("auto-cancels a PENDING online order, releases its discount, notifies once", async () => {
    const world = await createPaymentWorld();
    const offer = await createTestOffer({ currentUses: 1, maxUses: 5 });
    const order = await createOnlineOrder(world, { overrides: { offerId: offer.id } });
    const session = checkoutSession({ orderId: order.id });

    await handled("checkout.session.expired", session);

    const stored = await reload(order.id);
    expect(stored.status).toBe("AUTO_CANCELLED");
    expect(stored.autoCancelledAt).toEqual(expect.any(Date));
    const events = await eventsOf(order.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "AUTO_CANCELLED",
      actorId: "system",
      payloadJson: { reason: "CHECKOUT_SESSION_EXPIRED", checkoutSessionId: session.id },
    });
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).currentUses).toBe(0);
    expect(await notificationsOf(world.customer.id, "ORDER_EXPIRED")).toHaveLength(1);
  });

  it("leaves alone an accepted, authorized, paid, paid-at-pickup or otherwise-linked order", async () => {
    const world = await createPaymentWorld();
    const accepted = await createOnlineOrder(world, { status: "ACCEPTED" });
    const authorized = await createOnlineOrder(world, {
      overrides: { paymentAuthorizedAt: new Date() },
    });
    const paid = await createOnlineOrder(world, { overrides: { paidAt: new Date() } });
    const onPickup = await createOnlineOrder(world, { overrides: { paymentMethod: "ON_PICKUP" } });
    const otherSession = await createOnlineOrder(world, {
      overrides: { stripeCheckoutSessionId: stripeId("cs") },
    });

    for (const order of [accepted, authorized, paid, onPickup, otherSession]) {
      await handled("checkout.session.expired", checkoutSession({ orderId: order.id }));
      expect((await reload(order.id)).status).toBe(order.status);
      expect(await eventsOf(order.id)).toEqual([]);
    }
    expect(await notificationsOf(world.customer.id, "ORDER_EXPIRED")).toEqual([]);
  });
});

describe("checkout.session.completed", () => {
  it("links the session and its PaymentIntent, changes no status, never re-links", async () => {
    const world = await createPaymentWorld();
    const order = await createOnlineOrder(world);
    const piId = stripeId("pi");
    const session = checkoutSession({ orderId: order.id, paymentIntent: piId });

    await handled("checkout.session.completed", session);
    await handled(
      "checkout.session.completed",
      checkoutSession({ orderId: order.id, paymentIntent: stripeId("pi") })
    );

    expect(await reload(order.id)).toMatchObject({
      status: "PENDING",
      paidAt: null,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: piId,
    });
    expect(await eventsOf(order.id)).toEqual([]);
  });

  it("does not touch an order paid at pickup, nor take a session another order holds", async () => {
    const world = await createPaymentWorld();
    const onPickup = await createOnlineOrder(world, { overrides: { paymentMethod: "ON_PICKUP" } });
    const holder = await createOnlineOrder(world, {
      overrides: { stripeCheckoutSessionId: "cs_itest_held" },
    });
    const other = await createOnlineOrder(world);

    await handled(
      "checkout.session.completed",
      checkoutSession({ orderId: onPickup.id, paymentIntent: stripeId("pi") })
    );
    await handled(
      "checkout.session.completed",
      checkoutSession({ id: "cs_itest_held", orderId: other.id })
    );

    expect(await reload(onPickup.id)).toMatchObject({
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
    });
    expect((await reload(other.id)).stripeCheckoutSessionId).toBeNull();
    expect((await reload(holder.id)).stripeCheckoutSessionId).toBe("cs_itest_held");
  });
});

describe("payment_intent.*", () => {
  it("records capture before authorization, each column once, and never a status", async () => {
    const world = await createPaymentWorld();
    const order = await createOnlineOrder(world);
    const piId = stripeId("pi");
    const chargeId = stripeId("ch");

    await handled(
      "payment_intent.succeeded",
      paymentIntent({ id: piId, orderId: order.id, amountReceived: 1850 })
    );
    const paid = await reload(order.id);
    await handled(
      "payment_intent.amount_capturable_updated",
      paymentIntent({
        id: piId,
        orderId: order.id,
        amountCapturable: 2100,
        latestCharge: chargeId,
      })
    );
    const authorized = await reload(order.id);
    await handled(
      "payment_intent.succeeded",
      paymentIntent({ id: piId, orderId: order.id, amountReceived: 9999 })
    );
    await handled(
      "payment_intent.amount_capturable_updated",
      paymentIntent({
        id: piId,
        orderId: order.id,
        amountCapturable: 9999,
        latestCharge: stripeId("ch"),
      })
    );

    const stored = await reload(order.id);
    expect(stored).toMatchObject({
      status: "PENDING",
      stripePaymentIntentId: piId,
      paidAt: paid.paidAt,
      capturedAmountCents: 1850,
      paymentAuthorizedAt: authorized.paymentAuthorizedAt,
      authorizedAmountCents: 2100,
      stripeChargeId: chargeId,
      captureBefore: null,
      cardNetwork: null,
    });
    expect(stored.paidAt).toEqual(expect.any(Date));
    expect(stored.paymentAuthorizedAt).toEqual(expect.any(Date));
    expect(await eventsOf(order.id)).toEqual([]);
  });

  it("records nothing on a declined card, then the authorization; reads card details only when expanded", async () => {
    const world = await createPaymentWorld();
    const order = await createOnlineOrder(world);
    const piId = stripeId("pi");
    const captureBefore = Math.floor(Date.now() / 1000) + 6 * 24 * 3600;

    await handled(
      "payment_intent.payment_failed",
      paymentIntent({ id: piId, orderId: order.id, declineCode: "insufficient_funds" })
    );
    expect(await reload(order.id)).toMatchObject({
      status: "PENDING",
      stripePaymentIntentId: null,
      paymentAuthorizedAt: null,
    });

    await handled(
      "payment_intent.amount_capturable_updated",
      paymentIntent({
        id: piId,
        orderId: order.id,
        amountCapturable: 1500,
        latestCharge: {
          id: "ch_itest_expanded",
          payment_method_details: {
            card: { capture_before: captureBefore, network: "cartes_bancaires" },
          },
        },
      })
    );

    expect(await reload(order.id)).toMatchObject({
      status: "PENDING",
      authorizedAmountCents: 1500,
      stripeChargeId: "ch_itest_expanded",
      captureBefore: new Date(captureBefore * 1000),
      cardNetwork: "cartes_bancaires",
    });
  });

  it("records the release once, and ignores another PaymentIntent and orders paid at pickup", async () => {
    const world = await createPaymentWorld();
    const order = await createOnlineOrder(world, {
      overrides: { stripePaymentIntentId: "pi_itest_bound" },
    });
    const onPickup = await createOnlineOrder(world, { overrides: { paymentMethod: "ON_PICKUP" } });

    await handled(
      "payment_intent.canceled",
      paymentIntent({ id: "pi_itest_bound", orderId: order.id })
    );
    const released = (await reload(order.id)).paymentReleasedAt;
    await handled(
      "payment_intent.canceled",
      paymentIntent({ id: "pi_itest_bound", orderId: order.id })
    );
    await handled(
      "payment_intent.succeeded",
      paymentIntent({ id: stripeId("pi"), orderId: order.id, amountReceived: 100 })
    );
    await handled(
      "payment_intent.succeeded",
      paymentIntent({ id: stripeId("pi"), orderId: onPickup.id, amountReceived: 100 })
    );

    expect(released).toEqual(expect.any(Date));
    expect(await reload(order.id)).toMatchObject({
      status: "PENDING",
      paymentReleasedAt: released,
      paidAt: null,
      stripePaymentIntentId: "pi_itest_bound",
    });
    expect(await reload(onPickup.id)).toMatchObject({
      paidAt: null,
      stripePaymentIntentId: null,
    });
  });
});

describe("charge.refunded", () => {
  it("stores the absolute refunded amount, never lowers it, never changes the status", async () => {
    const world = await createPaymentWorld();
    const order = await createOnlineOrder(world, {
      status: "PICKED_UP",
      overrides: { stripePaymentIntentId: "pi_itest_refund" },
    });
    const refunded = (amount: number, orderId?: string) =>
      handled(
        "charge.refunded",
        charge({ orderId, paymentIntent: "pi_itest_refund", amount: 2000, amountRefunded: amount })
      );

    await refunded(500, order.id);
    const first = await reload(order.id);
    await refunded(2000);
    await refunded(500, order.id);

    expect(first).toMatchObject({ refundAmountCents: 500, refundedAt: expect.any(Date) });
    expect(await reload(order.id)).toMatchObject({
      status: "PICKED_UP",
      refundAmountCents: 2000,
      refundedPlatformFeeCents: 0,
    });
    expect(await eventsOf(order.id)).toEqual([]);
  });
});
