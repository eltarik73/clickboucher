// @vitest-environment node
// The weighing tolerance at order creation, on real PostgreSQL: a member's first order needs an
// active choice, later orders reuse the saved one, the order freezes the rate, the cap and the
// estimated total; a guest chooses on every order and his choice never reads nor writes the users
// row. Only the transports and the caller's session are simulated.
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import type { Order, User } from "@prisma/client";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));
vi.mock("@/lib/emails/order-confirmation", () => ({
  sendOrderConfirmationEmail: vi.fn(async () => true),
}));
vi.mock("@/lib/auth/server-auth", () => ({ getServerUserId: async () => null }));

import { createOrder, type CreateOrderResult } from "@/lib/services/orders/create";
import type { CreateOrderRequest } from "@/lib/validators/order";
import { prisma, useCleanDatabase } from "../helpers/db";
import {
  createTestOffer,
  createTestProduct,
  createTestShop,
  createTestUser,
} from "../helpers/factories";
import { confirmedBody, customerOf, quoteOf, quoteRequest } from "./create-order-fixtures";

const { POST: postGuestCheckout } = await import("@/app/api/checkout/guest/route");

// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React
useCleanDatabase();

const CHOICE_REQUIRED = "Choisissez votre marge de pesée avant de commander.";
const CHOICE_DETAIL =
  "Choix requis : 5\u00a0% du total estimé, 10,00\u00a0€ au\u00a0plus ou 10\u00a0% du total estimé, 20,00\u00a0€ au\u00a0plus";
const DOMAIN = "itest.klikandgo.test";
/** What each choice freezes on the order of world() (quote total 19,12 €). */
const FROZEN = {
  STANDARD: { rateBps: 500, capCents: 1000, estimatedTotalCents: 1912 },
  EXTENDED: { rateBps: 1000, capCents: 2000, estimatedTotalCents: 1912 },
};

async function world() {
  const shop = await createTestShop();
  const beef = await createTestProduct(shop.id, { unit: "KG", priceCents: 1911 });
  // 2 portions of 500 g at 19,11 €/kg: 2 × 9,56 € = 19,12 €.
  const request = quoteRequest(shop.id, [{ productId: beef.id, quantity: 2, weightGrams: 500 }]);
  return { shop, beef, request };
}

/** A member's order body as the cart sends it, without any tolerance unless `choice` is given. */
async function memberBody(
  request: Awaited<ReturnType<typeof world>>["request"],
  user: User,
  choice?: CreateOrderRequest["weighTolerance"]
): Promise<CreateOrderRequest> {
  const body = await confirmedBody(request, customerOf(user));
  delete body.weighTolerance;
  return choice === undefined ? body : { ...body, weighTolerance: choice };
}

/** The order a creation returned; a refusal fails the test with its code and message. */
function created(result: CreateOrderResult): Order {
  if (!result.ok) throw new Error(`creation refused: ${result.code} ${result.message}`);
  return result.order;
}

const frozenOf = (order: Order) => ({
  rateBps: order.weighToleranceRateBps,
  capCents: order.weighToleranceCapCents,
  estimatedTotalCents: order.estimatedTotalCents,
});

const storedChoice = async (userId: string) =>
  (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).weighTolerance;

let ipSequence = 0;

async function postGuest(body: Record<string, unknown>) {
  ipSequence += 1;
  const response = await postGuestCheckout(
    new NextRequest("http://localhost/api/checkout/guest", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `192.0.2.${ipSequence}` },
      body: JSON.stringify(body),
    })
  );
  const json = (await response.json()) as {
    data?: { order: { id: string } };
    error?: { code: string; message: string; details?: Record<string, string[]> };
  };
  return { status: response.status, json };
}

async function guestBody(
  request: Awaited<ReturnType<typeof world>>["request"],
  email: string,
  choice?: CreateOrderRequest["weighTolerance"]
) {
  return {
    ...request,
    idempotencyKey: randomUUID(),
    expectedTotalCents: (await quoteOf(request, null)).amountDueCents,
    ...(choice === undefined ? {} : { weighTolerance: choice }),
    email,
    firstName: "Nora",
    lastName: "Invitée",
  };
}

describe("member — the first order needs an active choice", () => {
  it("without a choice: VALIDATION_ERROR (400) in French, nothing created or saved", async () => {
    const { request } = await world();
    const user = await createTestUser();

    const result = await createOrder(await memberBody(request, user), customerOf(user));

    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      message: CHOICE_REQUIRED,
      details: { weighTolerance: [CHOICE_DETAIL] },
    });
    expect(await prisma.order.count()).toBe(0);
    expect(await storedChoice(user.id)).toBeNull();
  });

  it("STANDARD: the order freezes 5 % / 10,00 € on the quote total, the choice is saved", async () => {
    const { request } = await world();
    const user = await createTestUser();

    const result = await createOrder(await memberBody(request, user, "STANDARD"), customerOf(user));

    expect(result).toMatchObject({ ok: true, status: 201 });
    expect(frozenOf(created(result))).toEqual(FROZEN.STANDARD);
    expect(await storedChoice(user.id)).toBe("STANDARD");
  });

  it("later orders: no choice reuses the saved one, EXTENDED freezes 10 % / 20,00 € and is saved", async () => {
    const { request } = await world();
    const user = await createTestUser();
    const customer = customerOf(user);
    created(await createOrder(await memberBody(request, user, "STANDARD"), customer));

    const reused = created(await createOrder(await memberBody(request, user), customer));
    const extended = created(
      await createOrder(await memberBody(request, user, "EXTENDED"), customer)
    );

    expect(frozenOf(reused)).toEqual(FROZEN.STANDARD);
    expect(frozenOf(extended)).toEqual(FROZEN.EXTENDED);
    expect(await storedChoice(user.id)).toBe("EXTENDED");
  });

  it("the saved choice sent again leaves the users row unwritten", async () => {
    const { request } = await world();
    const user = await createTestUser({ weighTolerance: "EXTENDED" });
    const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    const result = await createOrder(await memberBody(request, user, "EXTENDED"), customerOf(user));

    expect(frozenOf(created(result))).toEqual(FROZEN.EXTENDED);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toEqual(before);
  });

  it("a replayed key returns the first order and its frozen terms, whatever the choice resent", async () => {
    const { request } = await world();
    const user = await createTestUser();
    const body = await memberBody(request, user, "STANDARD");
    const first = created(await createOrder(body, customerOf(user)));

    const replay = await createOrder({ ...body, weighTolerance: "EXTENDED" }, customerOf(user));

    expect(replay).toMatchObject({ ok: true, status: 200 });
    expect(created(replay).id).toBe(first.id);
    expect(frozenOf(created(replay))).toEqual(FROZEN.STANDARD);
    expect(await storedChoice(user.id)).toBe("STANDARD");
    expect(await prisma.order.count()).toBe(1);
  });

  it("with a promo code the estimated total is the total after the discount", async () => {
    const { shop, beef } = await world();
    await createTestOffer({ code: "DIX", type: "PERCENT", discountValue: 10 });
    const user = await createTestUser();
    const request = quoteRequest(
      shop.id,
      [{ productId: beef.id, quantity: 2, weightGrams: 500 }],
      "DIX"
    );

    const order = created(
      await createOrder(await memberBody(request, user, "STANDARD"), customerOf(user))
    );

    // 19,12 € − 10 % (191,2 cents, rounded half-up to 1,91 €) = 17,21 €.
    expect(order.estimatedTotalCents).toBe(1721);
    expect(order.totalCents).toBe(1721);
  });

  it.each([
    ["an unknown choice", { weighTolerance: "GENEREUX" }],
    ["a rate", { weighTolerance: "STANDARD", weighToleranceRateBps: 5000 }],
    ["a cap", { weighTolerance: "STANDARD", weighToleranceCapCents: 99_999 }],
    ["an estimated total", { weighTolerance: "STANDARD", estimatedTotalCents: 1 }],
  ])("refuses %s in the body and creates nothing", async (_label, extra) => {
    const { request } = await world();
    const user = await createTestUser();

    const result = await createOrder(
      { ...(await memberBody(request, user)), ...extra },
      customerOf(user)
    );

    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(await prisma.order.count()).toBe(0);
    expect(await storedChoice(user.id)).toBeNull();
  });

  it.each([1, 2, 3])(
    "round %i: two orders of one member in two shops at once, each changing his choice",
    async () => {
      const [a, b] = [await world(), await world()];
      const user = await createTestUser({ weighTolerance: "STANDARD" });
      const bodies = [
        await memberBody(a.request, user, "EXTENDED"),
        await memberBody(b.request, user, "EXTENDED"),
      ];

      const results = await Promise.all(bodies.map((body) => createOrder(body, customerOf(user))));

      const outcomes = results.map((result) => (result.ok ? result.status : result.code));
      expect(outcomes).toEqual([201, 201]);
      expect(await storedChoice(user.id)).toBe("EXTENDED");
    }
  );
});

describe("guest — a choice on every order, never read from nor written to the users row", () => {
  it("without a choice: 400 with the French message, no order", async () => {
    const { request } = await world();

    const answer = await postGuest(await guestBody(request, `sans-choix@${DOMAIN}`));

    expect(answer.status).toBe(400);
    expect(answer.json.error).toEqual({
      code: "VALIDATION_ERROR",
      message: CHOICE_REQUIRED,
      details: { weighTolerance: [CHOICE_DETAIL] },
    });
    expect(await prisma.order.count()).toBe(0);
  });

  it("with a choice: frozen on the order, the guest row keeps no preference", async () => {
    const { request } = await world();
    const email = `nouvelle@${DOMAIN}`;

    const answer = await postGuest(await guestBody(request, email, "EXTENDED"));

    expect(answer.status).toBe(201);
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: answer.json.data?.order.id },
    });
    expect(frozenOf(order)).toEqual(FROZEN.EXTENDED);
    const guest = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(guest.weighTolerance).toBeNull();
  });

  it("on a member's e-mail: the guest's choice is frozen, the member's row is untouched", async () => {
    const { request } = await world();
    const member = await createTestUser({ email: `membre@${DOMAIN}`, weighTolerance: "EXTENDED" });
    const before = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });

    const answer = await postGuest(await guestBody(request, member.email, "STANDARD"));

    expect(answer.status).toBe(201);
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: answer.json.data?.order.id },
    });
    expect(order).toMatchObject({ userId: member.id, placedAsGuest: true });
    expect(frozenOf(order)).toEqual(FROZEN.STANDARD);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).toEqual(before);
  });

  it("on a member's e-mail without a choice: refused, the member's saved choice is never used", async () => {
    const { request } = await world();
    const member = await createTestUser({ email: `prefere@${DOMAIN}`, weighTolerance: "STANDARD" });

    const answer = await postGuest(await guestBody(request, member.email));

    expect(answer.status).toBe(400);
    expect(answer.json.error?.message).toBe(CHOICE_REQUIRED);
    expect(await prisma.order.count()).toBe(0);
  });
});
