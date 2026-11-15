// @vitest-environment node
// Marge de pesée sur PostgreSQL réel : une baisse s'applique toujours ; une hausse de pesée ne
// s'applique sans le client que tant que la hausse cumulée sur les lignes restantes reste dans
// min(taux x total estimé, plafond) figé sur la commande ; au-delà, ou pour un prix ou un total
// saisi à la main, ou sur une commande antérieure à la marge, le client doit répondre.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));

import { WEIGH_TOLERANCE_TERMS } from "@/lib/pricing/tolerance";
import { adjustOrderPrice } from "@/lib/services/orders/adjust-price";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestProduct } from "../helpers/factories";
import {
  butcherOf,
  createGramProduct,
  createOrder,
  createWeighedOrder,
  createWorld,
  eventsOf,
  notificationsOf,
  reload,
  type World,
} from "./commands-fixtures";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const ANSWER_WINDOW_MS = 300_000;

/** The butcher weighs the line again: `grams` of the 1000 c/kg product cost `grams` cents. */
function weigh(world: World, orderId: string, itemId: string, grams: number, now = new Date()) {
  return adjustOrderPrice(
    orderId,
    butcherOf(world),
    { adjustmentType: "WEIGHT", items: [{ orderItemId: itemId, newQuantity: grams / 1000 }] },
    now
  );
}

async function adjustmentOf(orderId: string) {
  return prisma.priceAdjustment.findUniqueOrThrow({ where: { orderId } });
}

describe.each([
  // Commande de 20,00 € : 5 % = 1,00 €, 10 % = 2,00 €, sous les plafonds.
  { choice: "STANDARD", terms: WEIGH_TOLERANCE_TERMS.STANDARD, onTwenty: 100, cap: 1000 },
  { choice: "EXTENDED", terms: WEIGH_TOLERANCE_TERMS.EXTENDED, onTwenty: 200, cap: 2000 },
])("$choice tolerance", ({ terms, onTwenty, cap }) => {
  it("a decrease applies at once and is recorded as applied by the butcher", async () => {
    const world = await createWorld();
    const product = await createGramProduct(world);
    const order = await createWeighedOrder(world, product, [2000], terms);

    const result = await weigh(world, order.id, order.items[0].id, 1900);

    expect(result).toMatchObject({
      ok: true,
      data: { applied: true, decision: { decision: "APPLY", reason: "DECREASE" } },
    });
    expect((await reload(order.id)).totalCents).toBe(1900);
    expect(await adjustmentOf(order.id)).toMatchObject({
      status: "AUTO_APPROVED",
      tier: 1,
      answerBy: null,
    });
    const [event] = await eventsOf(order.id, "PRICE_ADJUSTED");
    expect(event).toMatchObject({ actorId: world.owner.id });
    expect(event.payloadJson).toMatchObject({ from: 2000, to: 1900, settledAs: "AUTO_APPROVED" });
    const [notice] = await notificationsOf(world.customer.id, "PRICE_ADJUSTMENT_AUTO_APPROVED");
    expect(notice.message).toBe("Le prix de votre commande a baissé : 19,00 €");
  });

  it("a weighing increase of exactly the tolerance applies without asking the customer", async () => {
    const world = await createWorld();
    const product = await createGramProduct(world);
    const order = await createWeighedOrder(world, product, [2000], terms);

    const result = await weigh(world, order.id, order.items[0].id, 2000 + onTwenty);

    expect(result).toMatchObject({
      ok: true,
      data: {
        applied: true,
        decision: {
          reason: "WITHIN_TOLERANCE",
          toleranceCents: onTwenty,
          cumulatedIncreaseCents: onTwenty,
        },
      },
    });
    const stored = await reload(order.id);
    expect(stored.totalCents).toBe(2000 + onTwenty);
    expect(stored.items[0]).toMatchObject({ totalCents: 2000 + onTwenty });
    const [event] = await eventsOf(order.id, "PRICE_ADJUSTED");
    expect(event.payloadJson).toEqual({
      from: 2000,
      to: 2000 + onTwenty,
      settledAs: "AUTO_APPROVED",
      adjustmentType: "WEIGHT",
      toleranceCents: onTwenty,
      cumulatedIncreaseCents: onTwenty,
    });
    const [notice] = await notificationsOf(world.customer.id, "PRICE_ADJUSTMENT_AUTO_APPROVED");
    expect(notice.message).toBe(
      `Prix ajusté après la pesée : ${((2000 + onTwenty) / 100).toFixed(2).replace(".", ",")} €, dans la marge que vous avez choisie.`
    );
    expect(await notificationsOf(world.customer.id, "PRICE_ADJUSTMENT_PENDING")).toHaveLength(0);
  });

  it("one cent more waits for the customer's answer for 5 minutes, the price unchanged", async () => {
    const world = await createWorld();
    const product = await createGramProduct(world);
    const order = await createWeighedOrder(world, product, [2000], terms);
    const now = new Date();

    const result = await weigh(world, order.id, order.items[0].id, 2001 + onTwenty, now);

    expect(result).toMatchObject({
      ok: true,
      data: { applied: false, decision: { decision: "ASK", reason: "BEYOND_TOLERANCE" } },
    });
    expect(await adjustmentOf(order.id)).toMatchObject({
      status: "PENDING",
      tier: 3,
      newTotal: 2001 + onTwenty,
      answerBy: new Date(now.getTime() + ANSWER_WINDOW_MS),
      autoApproveAt: null,
      escalateAt: null,
    });
    const stored = await reload(order.id);
    expect(stored.totalCents).toBe(2000);
    expect(stored.items[0]).toMatchObject({ quantity: 2, totalCents: 2000 });
    expect(await eventsOf(order.id, "PRICE_ADJUSTED")).toHaveLength(0);
    const [notice] = await notificationsOf(world.customer.id, "PRICE_ADJUSTMENT_PENDING");
    expect(notice.message).toContain(
      "Répondez dans les 5 minutes. Sans réponse de votre part, le prix ne change pas."
    );
  });

  it("two increases within the tolerance each but beyond it together: the second one asks", async () => {
    const world = await createWorld();
    const product = await createGramProduct(world);
    const order = await createWeighedOrder(world, product, [2000], terms);
    const step = (onTwenty * 6) / 10;

    const first = await weigh(world, order.id, order.items[0].id, 2000 + step);
    const second = await weigh(world, order.id, order.items[0].id, 2000 + 2 * step);

    expect(first).toMatchObject({ ok: true, data: { applied: true } });
    expect(second).toMatchObject({
      ok: true,
      data: { applied: false, decision: { cumulatedIncreaseCents: 2 * step } },
    });
    expect((await reload(order.id)).totalCents).toBe(2000 + step);
    expect(await adjustmentOf(order.id)).toMatchObject({ status: "PENDING", tier: 3 });
  });

  it(`on a 300,00 € order the cap holds: +${cap / 100},00 € applies, one cent more asks`, async () => {
    const world = await createWorld();
    const product = await createGramProduct(world);
    const atCap = await createWeighedOrder(world, product, [30_000], terms);
    const beyond = await createWeighedOrder(world, product, [30_000], terms);

    const applied = await weigh(world, atCap.id, atCap.items[0].id, 30_000 + cap);
    const asked = await weigh(world, beyond.id, beyond.items[0].id, 30_001 + cap);

    expect(applied).toMatchObject({
      ok: true,
      data: { applied: true, decision: { toleranceCents: cap } },
    });
    expect((await reload(atCap.id)).totalCents).toBe(30_000 + cap);
    expect(asked).toMatchObject({ ok: true, data: { applied: false } });
    expect((await reload(beyond.id)).totalCents).toBe(30_000);
  });

  it("a line out of stock gives no room: the remaining line is measured against its own estimate", async () => {
    const world = await createWorld();
    const product = await createGramProduct(world);
    // Total estimé 40,00 € : la marge est figée sur 40,00 €, même si une ligne disparaît ensuite.
    const room = 2 * onTwenty;
    const within = await createWeighedOrder(world, product, [2000, 2000], terms);
    const beyond = await createWeighedOrder(world, product, [2000, 2000], terms);
    for (const order of [within, beyond]) {
      await prisma.orderItem.update({
        where: { id: order.items[1].id },
        data: { available: false },
      });
      await prisma.order.update({ where: { id: order.id }, data: { totalCents: 2000 } });
    }

    const applied = await weigh(world, within.id, within.items[0].id, 2000 + room);
    const asked = await weigh(world, beyond.id, beyond.items[0].id, 2001 + room);

    expect(applied).toMatchObject({ ok: true, data: { applied: true } });
    expect(asked).toMatchObject({
      ok: true,
      data: { applied: false, decision: { reason: "BEYOND_TOLERANCE" } },
    });
    expect((await reload(beyond.id)).totalCents).toBe(2000);
  });
});

describe("increases that always need the customer's answer", () => {
  it("a new unit price or a new total typed by the butcher asks for any increase; their decreases apply", async () => {
    const world = await createWorld();
    const tray = await createTestProduct(world.shop.id, { unit: "BARQUETTE", priceCents: 1500 });
    const orders = await Promise.all(
      Array.from({ length: 4 }, () =>
        createOrder(world, {
          status: "ACCEPTED",
          items: [{ productId: tray.id, estimatedPriceCents: 1500 }],
          overrides: {
            weighToleranceRateBps: WEIGH_TOLERANCE_TERMS.EXTENDED.rateBps,
            weighToleranceCapCents: WEIGH_TOLERANCE_TERMS.EXTENDED.capCents,
            estimatedTotalCents: 1500,
          },
        })
      )
    );
    const reprice = (index: number, newPriceCents: number) =>
      adjustOrderPrice(orders[index].id, butcherOf(world), {
        adjustmentType: "PRICE",
        items: [{ orderItemId: orders[index].items[0].id, newPriceCents }],
      });
    const retotal = (index: number, newTotalCents: number) =>
      adjustOrderPrice(orders[index].id, butcherOf(world), {
        adjustmentType: "MANUAL",
        newTotalCents,
      });

    expect(await reprice(0, 1501)).toMatchObject({
      ok: true,
      data: { applied: false, decision: { reason: "NOT_WEIGHING" } },
    });
    expect(await reprice(1, 1499)).toMatchObject({ ok: true, data: { applied: true } });
    expect(await retotal(2, 1501)).toMatchObject({
      ok: true,
      data: { applied: false, decision: { reason: "NOT_WEIGHING" } },
    });
    expect(await retotal(3, 1499)).toMatchObject({ ok: true, data: { applied: true } });
    const totals = await Promise.all(
      orders.map(async (order) => (await reload(order.id)).totalCents)
    );
    expect(totals).toEqual([1500, 1499, 1500, 1499]);
  });

  it("an order created before the weighing tolerance: every increase asks, a decrease applies", async () => {
    const world = await createWorld();
    const product = await createGramProduct(world);
    const increased = await createWeighedOrder(world, product, [2000], null);
    const decreased = await createWeighedOrder(world, product, [2000], null);

    expect(await weigh(world, increased.id, increased.items[0].id, 2001)).toMatchObject({
      ok: true,
      data: { applied: false, decision: { reason: "NO_TOLERANCE", toleranceCents: 0 } },
    });
    expect(await weigh(world, decreased.id, decreased.items[0].id, 1999)).toMatchObject({
      ok: true,
      data: { applied: true },
    });
    expect((await reload(increased.id)).totalCents).toBe(2000);
    expect((await reload(decreased.id)).totalCents).toBe(1999);
  });

  it("the platform hard cap still refuses an increase above +50 %, whatever the tolerance", async () => {
    const world = await createWorld();
    const product = await createGramProduct(world);
    const order = await createWeighedOrder(world, product, [2000], WEIGH_TOLERANCE_TERMS.EXTENDED);

    const result = await weigh(world, order.id, order.items[0].id, 3001);

    expect(result).toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "L'ajustement ne peut pas dépasser +50 % du total actuel",
    });
    expect(await prisma.priceAdjustment.count()).toBe(0);
  });
});
