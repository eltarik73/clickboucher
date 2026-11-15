// @vitest-environment node
// Connected accounts, disputes and alerts on real PostgreSQL, with locally signed events:
// account.updated copies the account state onto its shop, switches online payment off (never on)
// and never re-points a shop to another account; disputes keep one row each, never reopened by a
// late event; disputes, failed refunds and failed payouts raise an error log (Sentry). The logger is
// observed with a spy that keeps its behaviour. No Stripe call: the fake gateway must record none.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakePaymentGateway } from "../helpers/fake-payment-gateway";

const gateway = createFakePaymentGateway();
vi.mock("@/lib/payments/gateway", () => ({ getPaymentGateway: () => gateway }));

import { logger } from "@/lib/logger";
import { prisma, useCleanDatabase } from "../helpers/db";
import {
  CONNECT_SECRET,
  createOnlineOrder,
  createPaymentWorld,
  deliver,
  installStripeTestEnv,
  stripeEvent,
  stripeId,
} from "./stripe-event-fixtures";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();
installStripeTestEnv();

const errorLogs = vi.spyOn(logger, "error");
beforeEach(() => {
  gateway.reset();
  errorLogs.mockClear();
});
afterEach(() => expect(gateway.calls).toEqual([]));

const errorMessages = () => errorLogs.mock.calls.map(([message]) => message);

function account(input: {
  id: string;
  shopId?: string;
  charges?: boolean;
  card?: "active" | "inactive" | "pending";
  currentlyDue?: string[];
  pastDue?: string[];
  disabledReason?: string | null;
}) {
  return {
    id: input.id,
    object: "account",
    metadata: input.shopId === undefined ? {} : { shopId: input.shopId },
    charges_enabled: input.charges ?? true,
    payouts_enabled: true,
    capabilities: { card_payments: input.card ?? "active", transfers: "active" },
    requirements: {
      currently_due: input.currentlyDue ?? [],
      past_due: input.pastDue ?? [],
      disabled_reason: input.disabledReason ?? null,
    },
  };
}

async function accountUpdated(object: ReturnType<typeof account>) {
  const response = await deliver(
    stripeEvent("account.updated", object, { account: object.id }),
    CONNECT_SECRET
  );
  expect(response).toEqual({ status: 200, body: { received: true } });
}

const shopOf = (id: string) => prisma.shop.findUniqueOrThrow({ where: { id } });

describe("account.updated", () => {
  it("stores status, requirements and capabilities, and switches online payment off, never on", async () => {
    const world = await createPaymentWorld({ stripeAccountId: "acct_itest_a", acceptOnline: true });

    await accountUpdated(
      account({ id: "acct_itest_a", currentlyDue: ["a", "b"], pastDue: ["b", "c"] })
    );
    expect(await shopOf(world.shop.id)).toMatchObject({
      stripeAccountStatus: "active",
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      stripeRequirementsDue: ["a", "b", "c"],
      stripeDisabledReason: null,
      stripeCardPaymentsActive: true,
      acceptOnline: true,
    });

    await accountUpdated(
      account({
        id: "acct_itest_a",
        charges: false,
        card: "inactive",
        pastDue: ["x"],
        disabledReason: "requirements.past_due",
      })
    );
    expect(await shopOf(world.shop.id)).toMatchObject({
      stripeAccountStatus: "restricted",
      stripeChargesEnabled: false,
      stripeRequirementsDue: ["x"],
      stripeDisabledReason: "requirements.past_due",
      stripeCardPaymentsActive: false,
      acceptOnline: false,
    });

    await accountUpdated(account({ id: "acct_itest_a" }));
    expect(await shopOf(world.shop.id)).toMatchObject({
      stripeAccountStatus: "active",
      stripeCardPaymentsActive: true,
      acceptOnline: false,
    });
  });

  it("switches online payment off when card payments alone are not active", async () => {
    const world = await createPaymentWorld({
      stripeAccountId: "acct_itest_card",
      acceptOnline: true,
    });
    await accountUpdated(account({ id: "acct_itest_card", card: "pending" }));
    expect(await shopOf(world.shop.id)).toMatchObject({
      stripeChargesEnabled: true,
      acceptOnline: false,
    });
  });

  it("attaches a new account to the shop of its metadata only if that shop holds none", async () => {
    const free = await createPaymentWorld();
    const taken = await createPaymentWorld({ stripeAccountId: "acct_itest_owner" });

    await accountUpdated(account({ id: "acct_itest_new", shopId: free.shop.id, charges: false }));
    await accountUpdated(account({ id: "acct_itest_intruder", shopId: taken.shop.id }));

    expect(await shopOf(free.shop.id)).toMatchObject({
      stripeAccountId: "acct_itest_new",
      stripeAccountStatus: "pending",
    });
    expect(await shopOf(taken.shop.id)).toMatchObject({
      stripeAccountId: "acct_itest_owner",
      stripeAccountStatus: null,
      stripeChargesEnabled: false,
    });
  });
});

describe("charge.dispute.*", () => {
  function dispute(
    status: string,
    input: { id: string; chargeId: string; paymentIntentId: string }
  ) {
    return {
      id: input.id,
      object: "dispute",
      charge: input.chargeId,
      payment_intent: input.paymentIntentId,
      amount: 2350,
      currency: "eur",
      reason: "product_not_received",
      status,
      livemode: false,
      evidence_details: { due_by: 1_900_000_000 },
    };
  }

  async function disputeEvent(type: string, object: ReturnType<typeof dispute>) {
    expect((await deliver(stripeEvent(type, object))).status).toBe(200);
  }

  it("keeps one row per dispute, linked to its order, alerts once, and is never reopened", async () => {
    const world = await createPaymentWorld();
    const order = await createOnlineOrder(world, {
      status: "PICKED_UP",
      overrides: { stripePaymentIntentId: "pi_itest_dispute", stripeChargeId: "ch_itest_dispute" },
    });
    const ids = {
      id: "du_itest_1",
      chargeId: "ch_itest_dispute",
      paymentIntentId: "pi_itest_dispute",
    };

    await disputeEvent("charge.dispute.created", dispute("needs_response", ids));
    await disputeEvent("charge.dispute.created", dispute("needs_response", ids));
    await disputeEvent("charge.dispute.updated", dispute("under_review", ids));
    await disputeEvent("charge.dispute.closed", dispute("lost", ids));
    await disputeEvent("charge.dispute.updated", dispute("under_review", ids));
    await disputeEvent("charge.dispute.created", dispute("needs_response", ids));

    const rows = await prisma.stripeDispute.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "du_itest_1",
      orderId: order.id,
      shopId: world.shop.id,
      chargeId: "ch_itest_dispute",
      amountCents: 2350,
      currency: "eur",
      reason: "product_not_received",
      status: "lost",
      dueBy: new Date(1_900_000_000 * 1000),
      livemode: false,
      closedAt: expect.any(Date),
    });
    expect(
      errorMessages().filter(
        (m) => m === "[stripe/webhook] card dispute opened: answer before dueBy"
      )
    ).toHaveLength(1);
    expect(errorMessages()).toContain("[stripe/webhook] card dispute closed");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      "PICKED_UP"
    );
  });

  it("creates the row from a first update that overtook the creation, without an order when none matches", async () => {
    const ids = { id: "du_itest_2", chargeId: stripeId("ch"), paymentIntentId: stripeId("pi") };

    await disputeEvent("charge.dispute.updated", dispute("under_review", ids));
    await disputeEvent("charge.dispute.created", dispute("needs_response", ids));

    expect(
      await prisma.stripeDispute.findUniqueOrThrow({ where: { id: "du_itest_2" } })
    ).toMatchObject({
      status: "under_review",
      orderId: null,
      shopId: null,
      closedAt: null,
    });
    expect(errorMessages()).toContain("[stripe/webhook] card dispute opened: answer before dueBy");
  });
});

describe("alertes sans écriture", () => {
  it("raises an error log for a failed refund and a failed payout, and writes nothing else", async () => {
    const refund = {
      id: stripeId("re"),
      object: "refund",
      amount: 500,
      status: "failed",
      failure_reason: "expired_or_canceled_card",
      payment_intent: stripeId("pi"),
      metadata: {},
    };
    const payout = {
      id: stripeId("po"),
      object: "payout",
      amount: 12000,
      currency: "eur",
      failure_code: "account_closed",
    };

    expect((await deliver(stripeEvent("refund.failed", refund))).status).toBe(200);
    expect(
      (
        await deliver(
          stripeEvent("payout.failed", payout, { account: "acct_itest_payout" }),
          CONNECT_SECRET
        )
      ).status
    ).toBe(200);

    expect(errorMessages()).toEqual([
      "[stripe/webhook] refund failed",
      "[stripe/webhook] payout to a butcher failed",
    ]);
    expect(await prisma.stripeEvent.count({ where: { handledAt: { not: null } } })).toBe(2);
    expect(await prisma.stripeDispute.count()).toBe(0);
  });
});
