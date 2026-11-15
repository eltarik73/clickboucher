// @vitest-environment node
// The system expiries on real PostgreSQL. The auto-cancel cron cancels only the due PENDING orders,
// gives back their discount, sends one ORDER_EXPIRED per order, and a second run does nothing.
// expireUnpaidCheckout closes an unpaid online order whose Checkout Session expired, once.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));

import { NextRequest } from "next/server";
import { GET as autoCancelRoute } from "@/app/api/cron/auto-cancel/route";
import { expireDueOrders, expireUnpaidCheckout } from "@/lib/services/orders/commands/close";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestOffer } from "../helpers/factories";
import {
  MINUTE_MS,
  createOrder,
  createWorld,
  eventsOf,
  notificationsOf,
  readResponse,
  reload,
} from "./commands-fixtures";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const CRON_SECRET = "itest-cron-secret";

beforeEach(() => vi.stubEnv("CRON_SECRET", CRON_SECRET));
afterEach(() => vi.unstubAllEnvs());

async function runCron(secret = CRON_SECRET) {
  const request = new NextRequest("http://localhost/api/cron/auto-cancel", {
    headers: { authorization: `Bearer ${secret}` },
  });
  return readResponse(await autoCancelRoute(request));
}

describe("GET /api/cron/auto-cancel", () => {
  it("expires only the PENDING orders whose deadline passed, once", async () => {
    const world = await createWorld();
    const past = new Date(Date.now() - MINUTE_MS);
    const future = new Date(Date.now() + 10 * MINUTE_MS);
    const offer = await createTestOffer({ currentUses: 1, maxUses: 5 });

    const expiredWithOffer = await createOrder(world, {
      overrides: { expiresAt: past, offerId: offer.id },
    });
    const expired = await createOrder(world, { overrides: { expiresAt: past } });
    const notYet = await createOrder(world, { overrides: { expiresAt: future } });
    const noDeadline = await createOrder(world);
    const accepted = await createOrder(world, {
      status: "ACCEPTED",
      overrides: { expiresAt: past },
    });

    const first = await runCron();
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ cancelledCount: 2, remainingCount: 0 });

    for (const order of [expiredWithOffer, expired]) {
      const stored = await reload(order.id);
      expect(stored.status).toBe("AUTO_CANCELLED");
      expect(stored.autoCancelledAt).not.toBeNull();
      expect(await eventsOf(order.id, "AUTO_CANCELLED")).toHaveLength(1);
    }
    expect((await reload(notYet.id)).status).toBe("PENDING");
    expect((await reload(noDeadline.id)).status).toBe("PENDING");
    expect((await reload(accepted.id)).status).toBe("ACCEPTED");
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).currentUses).toBe(0);

    const expiredRows = await notificationsOf(world.customer.id, "ORDER_EXPIRED");
    expect(expiredRows.map((row) => row.orderId).sort()).toEqual(
      [expiredWithOffer.id, expired.id].sort()
    );

    const second = await runCron();
    expect(second.body.data).toMatchObject({ cancelledCount: 0 });
    expect(await notificationsOf(world.customer.id, "ORDER_EXPIRED")).toHaveLength(2);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).currentUses).toBe(0);
  });

  it("refuses a call without the cron secret", async () => {
    const world = await createWorld();
    const order = await createOrder(world, {
      overrides: { expiresAt: new Date(Date.now() - MINUTE_MS) },
    });

    expect((await runCron("wrong")).status).toBe(401);
    expect((await reload(order.id)).status).toBe("PENDING");
  });
});

describe("expireDueOrders — time budget", () => {
  async function threeDueOrders() {
    const world = await createWorld();
    const past = new Date(Date.now() - MINUTE_MS);
    const orders = [];
    for (let i = 0; i < 3; i += 1)
      orders.push(await createOrder(world, { overrides: { expiresAt: past } }));
    await createOrder(world, { overrides: { expiresAt: new Date(Date.now() + 10 * MINUTE_MS) } });
    return orders;
  }

  it("expires nothing and reports every due order as remaining when the deadline has already passed", async () => {
    const orders = await threeDueOrders();
    const now = new Date();

    const result = await expireDueOrders({ now, deadline: new Date(now.getTime() - 1) });

    expect(result).toEqual({ expiredShopIds: [], missedShopIds: [], failed: 0, remainingCount: 3 });
    for (const order of orders) expect((await reload(order.id)).status).toBe("PENDING");
  });

  it("expires every due order and reports none remaining with a normal deadline", async () => {
    const orders = await threeDueOrders();
    const now = new Date();

    const result = await expireDueOrders({ now, deadline: new Date(now.getTime() + MINUTE_MS) });

    expect(result.expiredShopIds).toHaveLength(3);
    expect(result).toMatchObject({ failed: 0, remainingCount: 0 });
    for (const order of orders) expect((await reload(order.id)).status).toBe("AUTO_CANCELLED");
  });
});

describe("expireUnpaidCheckout", () => {
  it("closes an unpaid PENDING online order once: session in the event, discount given back, one notification", async () => {
    const world = await createWorld();
    const offer = await createTestOffer({ currentUses: 1, maxUses: 5 });
    const order = await createOrder(world, {
      overrides: { paymentMethod: "ONLINE", offerId: offer.id },
    });
    const now = new Date();
    const expiry = { orderId: order.id, checkoutSessionId: "cs_itest_expired", now };

    expect((await expireUnpaidCheckout(expiry)).kind).toBe("done");
    expect((await expireUnpaidCheckout(expiry)).kind).toBe("replay");

    expect(await reload(order.id)).toMatchObject({ status: "AUTO_CANCELLED", autoCancelledAt: now });
    expect(await eventsOf(order.id)).toMatchObject([
      {
        type: "AUTO_CANCELLED",
        actorId: "system",
        payloadJson: { reason: "CHECKOUT_SESSION_EXPIRED", checkoutSessionId: "cs_itest_expired" },
      },
    ]);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).currentUses).toBe(0);
    expect(await notificationsOf(world.customer.id, "ORDER_EXPIRED")).toHaveLength(1);
  });
});
