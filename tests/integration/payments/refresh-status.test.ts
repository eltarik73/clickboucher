// @vitest-environment node
// POST /api/boucher/stripe/refresh-status on real PostgreSQL: the account the butcher's refresh
// re-reads is written by the writer of account.updated (syncShopFromAccount), every Stripe column
// and the switch-off of online payment included. Simulated: the butcher's session, and the gateway
// as a vi.fn that returns the account (this file only; the others install the recording fake).
import { beforeEach, describe, expect, it, vi } from "vitest";

const boucherAuth = vi.hoisted(() => ({ getAuthenticatedBoucher: vi.fn() }));
const retrieveAccount = vi.hoisted(() => vi.fn());
vi.mock("@/lib/boucher-auth", () => boucherAuth);
vi.mock("@/lib/payments/gateway", () => ({ getPaymentGateway: () => ({ retrieveAccount }) }));

import { POST } from "@/app/api/boucher/stripe/refresh-status/route";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createPaymentWorld, useStripeTestEnv } from "./stripe-event-fixtures";

/* eslint-disable react-hooks/rules-of-hooks -- not React hooks: the rule reads the « use » prefix */
useCleanDatabase();
useStripeTestEnv();
/* eslint-enable react-hooks/rules-of-hooks */

beforeEach(() => {
  boucherAuth.getAuthenticatedBoucher.mockReset();
  retrieveAccount.mockReset();
});

describe("POST /api/boucher/stripe/refresh-status", () => {
  it("writes the re-read account on the shop and switches online payment off, like account.updated", async () => {
    const world = await createPaymentWorld({
      stripeAccountId: "acct_itest_refresh",
      acceptOnline: true,
      stripeAccountStatus: "active",
      stripePayoutsEnabled: true,
      stripeDisabledReason: "requirements.past_due",
      stripeCardPaymentsActive: true,
    });
    boucherAuth.getAuthenticatedBoucher.mockResolvedValue({
      userId: world.shop.ownerId,
      shopId: world.shop.id,
    });
    retrieveAccount.mockResolvedValue({
      id: "acct_itest_refresh",
      object: "account",
      metadata: {},
      charges_enabled: true,
      payouts_enabled: false,
      details_submitted: true,
      capabilities: { card_payments: "inactive", transfers: "active" },
      requirements: {
        currently_due: ["individual.id_number", "external_account"],
        past_due: [],
        disabled_reason: null,
      },
    });

    const response = await POST();

    expect(retrieveAccount.mock.calls).toEqual([["acct_itest_refresh"]]);
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      accountId: "acct_itest_refresh",
      chargesEnabled: true,
      payoutsEnabled: false,
      detailsSubmitted: true,
      status: "pending",
      requirementsCurrentlyDue: ["individual.id_number", "external_account"],
      requirementsPastDue: [],
    });
    expect(await prisma.shop.findUniqueOrThrow({ where: { id: world.shop.id } })).toMatchObject({
      stripeAccountStatus: "pending",
      stripeChargesEnabled: true,
      stripePayoutsEnabled: false,
      stripeRequirementsDue: ["individual.id_number", "external_account"],
      stripeDisabledReason: null,
      stripeCardPaymentsActive: false,
      acceptOnline: false,
    });
  });
});
