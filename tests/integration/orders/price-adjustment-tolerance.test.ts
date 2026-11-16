// @vitest-environment node
// Marge de pesée sur PostgreSQL réel : une baisse s'applique toujours ; une hausse de pesée ne
// s'applique sans le client que tant que la hausse cumulée, ligne par ligne, reste dans
// min(taux x total estimé des lignes encore livrées, plafond) ; au-delà, ou pour une pièce ou une
// barquette de plus, un prix ou un total saisi à la main, ou sur une commande sans marge figée, le
// client doit répondre. Le plafond de sécurité de la plateforme borne tout ajustement.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));

import { invalidateConfig } from "@/lib/feature-flags";
import { MAX_INCREASE_PCT_KEY } from "@/lib/price-adjustment-config";
import { WEIGH_TOLERANCE_TERMS, type WeighToleranceTerms } from "@/lib/pricing/tolerance";
import { adjustOrderPrice } from "@/lib/services/orders/adjust-price";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestProduct } from "../helpers/factories";
import {
  ANSWER_WINDOW_MS,
  adjustmentOf,
  butcherOf,
  createGramProduct,
  createOrder,
  createWeighedOrder,
  createWorld,
  eventsOf,
  notificationsOf,
  reload,
  weighGrams,
} from "./commands-fixtures";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

/**
 * An ACCEPTED order of KG lines of the 1000 c/kg product (one gram costs one cent), and the
 * butcher weighing its first line again at `grams`.
 */
async function weighedOrder(lineGrams: readonly number[], terms: WeighToleranceTerms | null) {
  const world = await createWorld();
  const order = await createWeighedOrder(world, await createGramProduct(world), lineGrams, terms);
  const firstLineAt = (grams: number, now?: Date) =>
    weighGrams(order.id, butcherOf(world), { [order.items[0].id]: grams }, now);
  return { world, order, firstLineAt };
}

describe.each([
  // Commande de 20,00 € : 5 % = 1,00 €, 10 % = 2,00 €, sous les plafonds.
  { choice: "STANDARD", onTwenty: 100, atTolerance: "21,00 €", cap: 1000 },
  { choice: "EXTENDED", onTwenty: 200, atTolerance: "22,00 €", cap: 2000 },
] as const)("$choice tolerance", ({ choice, onTwenty, atTolerance, cap }) => {
  const terms = WEIGH_TOLERANCE_TERMS[choice];

  it("a decrease applies at once and is recorded as applied by the butcher", async () => {
    const { world, order, firstLineAt } = await weighedOrder([2000], terms);

    const result = await firstLineAt(1900);

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
    const { world, order, firstLineAt } = await weighedOrder([2000], terms);

    const result = await firstLineAt(2000 + onTwenty);

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
      `Prix ajusté après la pesée : ${atTolerance}, dans la marge que vous avez choisie.`
    );
    expect(await notificationsOf(world.customer.id, "PRICE_ADJUSTMENT_PENDING")).toHaveLength(0);
  });

  it("one cent more waits for the customer's answer for 5 minutes, the price unchanged", async () => {
    const { world, order, firstLineAt } = await weighedOrder([2000], terms);
    const now = new Date();

    const result = await firstLineAt(2001 + onTwenty, now);

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
    const { order, firstLineAt } = await weighedOrder([2000], terms);
    const step = (onTwenty * 6) / 10;

    const first = await firstLineAt(2000 + step);
    const second = await firstLineAt(2000 + 2 * step);

    expect(first).toMatchObject({ ok: true, data: { applied: true } });
    expect(second).toMatchObject({
      ok: true,
      data: { applied: false, decision: { cumulatedIncreaseCents: 2 * step } },
    });
    expect((await reload(order.id)).totalCents).toBe(2000 + step);
    expect(await adjustmentOf(order.id)).toMatchObject({ status: "PENDING", tier: 3 });
  });

  it(`on a 300,00 € order the cap holds: +${cap / 100},00 € applies, one cent more asks`, async () => {
    const { order, firstLineAt } = await weighedOrder([30_000], terms);

    const applied = await firstLineAt(30_000 + cap);
    const asked = await firstLineAt(30_001 + cap);

    expect(applied).toMatchObject({
      ok: true,
      data: { applied: true, decision: { toleranceCents: cap } },
    });
    expect(asked).toMatchObject({
      ok: true,
      data: { applied: false, decision: { toleranceCents: cap, cumulatedIncreaseCents: cap + 1 } },
    });
    expect((await reload(order.id)).totalCents).toBe(30_000 + cap);
  });

  it("a line out of stock gives no room, whatever the stored estimate: the base is the lines still delivered", async () => {
    const { order, firstLineAt } = await weighedOrder([2000, 2000], terms);
    // Total estimé figé à 40,00 € ; la seconde ligne n'est plus livrée : la marge porte sur 20,00 €.
    await prisma.orderItem.update({ where: { id: order.items[1].id }, data: { available: false } });
    await prisma.order.update({ where: { id: order.id }, data: { totalCents: 2000 } });

    const asked = await firstLineAt(2001 + onTwenty);

    expect(asked).toMatchObject({
      ok: true,
      data: {
        applied: false,
        decision: {
          reason: "BEYOND_TOLERANCE",
          toleranceCents: onTwenty,
          estimatedTotalCents: 2000,
        },
      },
    });
    expect(await reload(order.id)).toMatchObject({ totalCents: 2000, estimatedTotalCents: 4000 });
  });
});

describe("increases that always need the customer's answer", () => {
  const count = (trays: number) => ({ newQuantity: trays });
  const price = (cents: number) => ({ newPriceCents: cents });
  // Commande EXTENDED : 20,00 € de viande au gramme et `trays` barquettes à 1,50 € ; la marge
  // (10 %, plus de 2,00 €) dépasse le prix d'une barquette. Une barquette de plus est un autre
  // article, pas une pesée : comme un prix unitaire ou un total saisi, toute hausse se demande.
  it.each([
    ["one more tray", 1, "WEIGHT", count(2), false, 2150],
    ["one tray less", 2, "WEIGHT", count(1), true, 2150],
    ["a tray one cent dearer", 1, "PRICE", price(151), false, 2150],
    ["a tray one cent cheaper", 1, "PRICE", price(149), true, 2149],
    ["a total typed one cent higher", 1, "MANUAL", 2151, false, 2150],
    ["a total typed one cent lower", 1, "MANUAL", 2149, true, 2149],
  ] as const)("%s", async (_label, trays, adjustmentType, change, applied, total) => {
    const world = await createWorld();
    const meat = await createGramProduct(world);
    const tray = await createTestProduct(world.shop.id, { unit: "BARQUETTE", priceCents: 150 });
    const order = await createOrder(world, {
      status: "ACCEPTED",
      items: [
        { productId: meat.id, quantity: 2, totalCents: 2000, estimatedPriceCents: 2000 },
        {
          productId: tray.id,
          quantity: trays,
          totalCents: 150 * trays,
          estimatedPriceCents: 150 * trays,
        },
      ],
      overrides: {
        weighToleranceRateBps: WEIGH_TOLERANCE_TERMS.EXTENDED.rateBps,
        weighToleranceCapCents: WEIGH_TOLERANCE_TERMS.EXTENDED.capCents,
        estimatedTotalCents: 2000 + trays * 150,
      },
    });
    const orderItemId = order.items[1].id;

    const result = await adjustOrderPrice(
      order.id,
      butcherOf(world),
      typeof change === "number"
        ? { adjustmentType, newTotalCents: change }
        : { adjustmentType, items: [{ orderItemId, ...change }] }
    );

    const reason = applied ? "DECREASE" : "NOT_WEIGHING";
    expect(result).toMatchObject({ ok: true, data: { applied, decision: { reason } } });
    expect((await reload(order.id)).totalCents).toBe(total);
  });

  it("an order without a frozen tolerance: every increase asks, a decrease applies", async () => {
    const increased = await weighedOrder([2000], null);
    const decreased = await weighedOrder([2000], null);

    expect(await increased.firstLineAt(2001)).toMatchObject({
      ok: true,
      data: { applied: false, decision: { reason: "NO_TOLERANCE", toleranceCents: 0 } },
    });
    expect(await decreased.firstLineAt(1999)).toMatchObject({ ok: true, data: { applied: true } });
    expect((await reload(increased.order.id)).totalCents).toBe(2000);
    expect((await reload(decreased.order.id)).totalCents).toBe(1999);
  });
});

describe("the platform's safety cap of one adjustment, whatever the tolerance", () => {
  afterEach(() => invalidateConfig(MAX_INCREASE_PCT_KEY));

  // Commande de 20,00 €, marge EXTENDED (2,00 €) : au plafond, la hausse attend le client.
  it.each([
    { stored: null, cap: 50, atCap: 3000 },
    { stored: "30", cap: 30, atCap: 2600 },
    // Pas un plafond valide (1 à 100) : le plafond par défaut s'applique.
    { stored: "0", cap: 50, atCap: 3000 },
  ])("stored $stored: up to +$cap % is proposed, one cent more is refused", async (row) => {
    if (row.stored !== null) {
      await prisma.platformConfig.create({
        data: { key: MAX_INCREASE_PCT_KEY, value: row.stored },
      });
      invalidateConfig(MAX_INCREASE_PCT_KEY);
    }
    const { order, firstLineAt } = await weighedOrder([2000], WEIGH_TOLERANCE_TERMS.EXTENDED);

    expect(await firstLineAt(row.atCap + 1)).toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      message: `L'ajustement ne peut pas dépasser +${row.cap} % du total actuel`,
    });
    expect(await prisma.priceAdjustment.count()).toBe(0);

    expect(await firstLineAt(row.atCap)).toMatchObject({ ok: true, data: { applied: false } });
    expect(await adjustmentOf(order.id)).toMatchObject({ status: "PENDING", newTotal: row.atCap });
  });
});
