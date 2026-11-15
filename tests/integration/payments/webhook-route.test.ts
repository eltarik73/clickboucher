// @vitest-environment node
// POST /api/payments/webhook on real PostgreSQL, with events signed locally: configuration,
// signature (two secrets, two scopes), livemode, the event ledger (duplicate, in progress, abandoned
// marker taken over, release after a failed handler) and concurrent deliveries. No Stripe call: the
// fake payment gateway must record none.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakePaymentGateway } from "../helpers/fake-payment-gateway";

const gateway = createFakePaymentGateway();
vi.mock("@/lib/payments/gateway", () => ({ getPaymentGateway: () => gateway }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));

import { NextRequest } from "next/server";
import { prisma, useCleanDatabase } from "../helpers/db";
import {
  CONNECT_SECRET,
  FOREIGN_SECRET,
  checkoutSession,
  createOnlineOrder,
  createPaymentWorld,
  deliver,
  installStripeTestEnv,
  notificationsOf,
  orderEventsOf,
  reloadOrder,
  send,
  setStripeVariable,
  signedRequest,
  stripeEvent,
  stripeId,
} from "./stripe-event-fixtures";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();
installStripeTestEnv();

beforeEach(() => gateway.reset());
afterEach(() => expect(gateway.calls).toEqual([]));

const marker = (id: string) => prisma.stripeEvent.findUnique({ where: { id } });

/** A PENDING online order and the signed expiry of its session: the event with a visible effect. */
async function expiringOrder() {
  const world = await createPaymentWorld();
  const order = await createOnlineOrder(world);
  const event = stripeEvent("checkout.session.expired", checkoutSession({ orderId: order.id }));
  return { world, order, event };
}

async function expectExpiredOnce(order: { id: string; userId: string }) {
  expect((await reloadOrder(order.id)).status).toBe("AUTO_CANCELLED");
  expect((await orderEventsOf(order.id)).map((e) => e.type)).toEqual(["AUTO_CANCELLED"]);
  expect(await notificationsOf(order.userId, "ORDER_EXPIRED")).toHaveLength(1);
}

/** Makes PostgreSQL refuse every UPDATE of one order until the returned function is called. */
async function refuseOrderUpdates(orderId: string): Promise<() => Promise<void>> {
  if (!/^[a-z0-9]+$/.test(orderId)) throw new Error(`unexpected order id ${orderId}`);
  await prisma.$executeRawUnsafe(
    "CREATE OR REPLACE FUNCTION itest_refuse_order_update() RETURNS trigger LANGUAGE plpgsql " +
      "AS $$ BEGIN RAISE EXCEPTION 'itest: order update refused'; END $$"
  );
  await prisma.$executeRawUnsafe(
    "CREATE TRIGGER itest_refuse_order_update BEFORE UPDATE ON orders FOR EACH ROW " +
      `WHEN (OLD.id = '${orderId}') EXECUTE FUNCTION itest_refuse_order_update()`
  );
  return async () => {
    await prisma.$executeRawUnsafe("DROP TRIGGER IF EXISTS itest_refuse_order_update ON orders");
    await prisma.$executeRawUnsafe("DROP FUNCTION IF EXISTS itest_refuse_order_update()");
  };
}

describe("configuration et signature", () => {
  it("answers 503 without an accepted secret key or without any webhook secret", async () => {
    const event = stripeEvent("refund.updated", { id: stripeId("re") });
    const restoreKey = setStripeVariable("STRIPE_SECRET_KEY", undefined);
    expect(await deliver(event)).toEqual({
      status: 503,
      body: { received: false, reason: "not-configured" },
    });
    restoreKey();

    const restorePlatform = setStripeVariable("STRIPE_WEBHOOK_SECRET", undefined);
    const restoreConnect = setStripeVariable("STRIPE_CONNECT_WEBHOOK_SECRET", undefined);
    expect((await deliver(event)).status).toBe(503);
    restoreConnect();
    restorePlatform();
    expect(await prisma.stripeEvent.count()).toBe(0);
  });

  it("refuses a missing, foreign, tampered or outdated signature and writes nothing", async () => {
    const { order, event } = await expiringOrder();
    const unsigned = new NextRequest("http://localhost/api/payments/webhook", {
      method: "POST",
      body: JSON.stringify(event),
    });
    expect((await send(unsigned)).status).toBe(400);
    expect((await deliver(event, FOREIGN_SECRET)).status).toBe(400);

    const tampered = new NextRequest("http://localhost/api/payments/webhook", {
      method: "POST",
      body: JSON.stringify({ ...event, livemode: true }),
      headers: {
        "stripe-signature": signedRequest(event).headers.get("stripe-signature") as string,
      },
    });
    expect((await send(tampered)).status).toBe(400);
    const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600;
    expect((await send(signedRequest(event, undefined, tenMinutesAgo))).status).toBe(400);

    expect(await prisma.stripeEvent.count()).toBe(0);
    expect((await reloadOrder(order.id)).status).toBe("PENDING");
  });

  it("handles a platform event and records it with handledAt", async () => {
    const { order, event } = await expiringOrder();

    expect(await deliver(event)).toEqual({ status: 200, body: { received: true } });

    await expectExpiredOnce(order);
    expect(await marker(event.id)).toMatchObject({
      type: "checkout.session.expired",
      livemode: false,
      account: null,
      handledAt: expect.any(Date),
    });
  });

  it("verifies a Connect-scope event with the second secret", async () => {
    const world = await createPaymentWorld({ stripeAccountId: "acct_itest_route" });
    const account = { id: "acct_itest_route", charges_enabled: true, payouts_enabled: true };
    const event = stripeEvent("account.updated", account, { account: account.id });

    expect(await deliver(event, CONNECT_SECRET)).toEqual({ status: 200, body: { received: true } });

    const shop = await prisma.shop.findUniqueOrThrow({ where: { id: world.shop.id } });
    expect(shop).toMatchObject({ stripeChargesEnabled: true, stripeAccountStatus: "active" });
    expect(await marker(event.id)).toMatchObject({
      account: account.id,
      handledAt: expect.any(Date),
    });
  });

  it("ignores an event verified by the other scope's secret, a test event in production mode and an unknown type", async () => {
    const { order, event } = await expiringOrder();
    expect((await deliver(event, CONNECT_SECRET)).body).toEqual({
      received: true,
      ignored: "scope",
    });

    const account = stripeEvent(
      "account.updated",
      { id: "acct_itest_scope" },
      { account: "acct_itest_scope" }
    );
    expect((await deliver(account)).body).toEqual({ received: true, ignored: "scope" });

    const live = { ...event, id: stripeId("evt"), livemode: true };
    expect(await deliver(live)).toEqual({
      status: 200,
      body: { received: true, ignored: "livemode" },
    });

    const unknown = stripeEvent("customer.created", { id: stripeId("cus") });
    expect((await deliver(unknown)).body).toEqual({ received: true, ignored: "type" });

    expect(await prisma.stripeEvent.count()).toBe(0);
    expect((await reloadOrder(order.id)).status).toBe("PENDING");
  });
});

describe("registre des événements", () => {
  it("answers a replayed event id as a duplicate without a second effect", async () => {
    const { order, event } = await expiringOrder();
    expect((await deliver(event)).status).toBe(200);

    expect(await deliver(event)).toEqual({
      status: 200,
      body: { received: true, duplicate: true },
    });

    await expectExpiredOnce(order);
    expect(await prisma.stripeEvent.count()).toBe(1);
  });

  it("answers 500 and drops the marker when the handler fails, then processes the redelivery", async () => {
    const { order, event } = await expiringOrder();
    const allowUpdates = await refuseOrderUpdates(order.id);
    try {
      expect((await deliver(event)).status).toBe(500);
    } finally {
      await allowUpdates();
    }
    expect(await marker(event.id)).toBeNull();
    expect((await reloadOrder(order.id)).status).toBe("PENDING");

    expect((await deliver(event)).status).toBe(200);
    await expectExpiredOnce(order);
  });

  it("answers 409 while a recent marker is unhandled, and takes over an abandoned one", async () => {
    const { order, event } = await expiringOrder();
    await prisma.stripeEvent.create({
      data: { id: event.id, type: event.type, processedAt: new Date(Date.now() - 30_000) },
    });

    expect(await deliver(event)).toEqual({
      status: 409,
      body: { received: false, reason: "in-progress" },
    });
    expect((await reloadOrder(order.id)).status).toBe("PENDING");

    await prisma.stripeEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date(Date.now() - 120_000) },
    });
    expect((await deliver(event)).status).toBe(200);
    await expectExpiredOnce(order);
    expect(await marker(event.id)).toMatchObject({ livemode: false, handledAt: expect.any(Date) });
  });

  it("applies two concurrent deliveries of one event once", async () => {
    const { order, event } = await expiringOrder();

    const responses = await Promise.all([deliver(event), deliver(event)]);

    const handled = responses.filter((r) => r.status === 200 && r.body.duplicate === undefined);
    expect(handled).toHaveLength(1);
    for (const response of responses) expect([200, 409]).toContain(response.status);
    await expectExpiredOnce(order);
  });
});
