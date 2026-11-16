// @vitest-environment node
// Marge de pesée et composition de la commande, sur PostgreSQL réel. Quand le client accepte une
// nouvelle composition (article en rupture retiré ou remplacé), l'estimation de chaque ligne
// remplacée et le total estimé de la commande sont figés à nouveau : la marge devient
// min(taux x nouveau total estimé, plafond), et un remplacement moins cher ne donne aucune marge.
// Une ligne pesée plus légère ne donne aucune marge aux autres : elle ne compte dans la base de la
// marge que ce qu'elle coûte encore (à 0, rien, comme une ligne en rupture ; à 1 g, 2 centimes).
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => "sent") }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));

import { toleranceTicketLine } from "@/components/boucher/tolerance-ticket-line";
import { planAdjustment } from "@/lib/pricing/adjustment";
import { WEIGH_TOLERANCE_TERMS } from "@/lib/pricing/tolerance";
import { adjustOrderPrice } from "@/lib/services/orders/adjust-price";
import { acceptAdjustment, rejectAdjustment } from "@/lib/services/orders/adjustment-answers";
import { acceptOrder } from "@/lib/services/orders/commands/accept";
import {
  reportUnavailableItems,
  resolveUnavailableItems,
  type UnavailableDecision,
} from "@/lib/services/orders/commands/unavailable";
import { customerOrderById } from "@/lib/services/orders/customer-view";
import { getKitchenBoard } from "@/lib/services/orders/kitchen";
import { useCleanDatabase } from "../helpers/db";
import { createTestProduct } from "../helpers/factories";
import {
  adjustmentOf,
  butcherOf,
  createGramProduct,
  createOrder,
  createWeighedOrder,
  createWorld,
  customerAnswer,
  reload,
  weighGrams,
  type World,
} from "./commands-fixtures";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const STANDARD = WEIGH_TOLERANCE_TERMS.STANDARD;

/** One KG portion of `grams` as checkout writes it: estimated at its total. */
function checkoutLine(productId: string, grams: number, priceCents: number, totalCents: number) {
  return {
    productId,
    quantity: grams / 1000,
    weightGrams: grams,
    priceCents,
    totalCents,
    estimatedPriceCents: totalCents,
  };
}

/**
 * ACCEPTED, STANDARD, as checkout writes it: 1 kg of veal at 30,00 €/kg and 1 kg of the gram
 * product; estimated 40,00 €, tolerance 2,00 €.
 */
async function vealAndGrams(world: World) {
  const veal = await createTestProduct(world.shop.id, {
    name: "Escalope de veau",
    priceCents: 3000,
  });
  const grams = await createGramProduct(world);
  const order = await createOrder(world, {
    status: "ACCEPTED",
    items: [checkoutLine(veal.id, 1000, 3000, 3000), checkoutLine(grams.id, 1000, 1000, 1000)],
    overrides: {
      weighToleranceRateBps: STANDARD.rateBps,
      weighToleranceCapCents: STANDARD.capCents,
      estimatedTotalCents: 4000,
    },
  });
  const [vealLine, gramLine] = order.items;
  return { order, veal, vealLine, gramLine };
}

const removeLine = (id: string): UnavailableDecision => ({ orderItemId: id, action: "remove" });

/** The veal is out of stock, the customer answers, the butcher accepts the order again. */
async function vealAnswered(world: World, decide: (lineId: string) => UnavailableDecision) {
  const placed = await vealAndGrams(world);
  const reported = await reportUnavailableItems({
    orderId: placed.order.id,
    shopId: world.shop.id,
    actorId: world.owner.id,
    productIds: [placed.veal.id],
  });
  expect(reported.kind).toBe("done");
  const partial = await reload(placed.order.id);
  const resolved = await resolveUnavailableItems({
    orderId: placed.order.id,
    userId: world.customer.id,
    decisions: [decide(placed.vealLine.id)],
    now: new Date(),
  });
  expect(resolved.kind).toBe("done");
  const accepted = await acceptOrder({
    orderId: placed.order.id,
    shopId: world.shop.id,
    actorId: world.owner.id,
    estimatedMinutes: 15,
    now: new Date(),
  });
  expect(accepted.kind).toBe("done");
  return { ...placed, partial };
}

describe("a new composition accepted by the customer freezes a new estimate", () => {
  it("a cheaper replacement gives no room: tolerance + 1 cent on it asks the customer", async () => {
    const world = await createWorld();
    const chicken = await createGramProduct(world);
    const { order, vealLine } = await vealAnswered(world, (id) => ({
      orderItemId: id,
      action: "replace",
      replacementProductId: chicken.id,
    }));
    const replaced = await reload(order.id);
    expect(replaced).toMatchObject({ totalCents: 2000, estimatedTotalCents: 2000 });
    expect(replaced.items.find((item) => item.id === vealLine.id)).toMatchObject({
      productId: chicken.id,
      totalCents: 1000,
      estimatedPriceCents: 1000,
    });

    // 5 % de 20,00 € = 1,00 € ; 1,01 € de plus sur la ligne remplacée est demandé au client.
    const result = await weighGrams(order.id, butcherOf(world), { [vealLine.id]: 1101 });

    expect(result).toMatchObject({
      ok: true,
      data: {
        applied: false,
        decision: { reason: "BEYOND_TOLERANCE", toleranceCents: 100, cumulatedIncreaseCents: 101 },
      },
    });
    expect((await reload(order.id)).totalCents).toBe(2000);
  });

  it("a removal: the estimate of the line left is frozen, beyond 5 % of it asks the customer", async () => {
    const world = await createWorld();
    const { order, gramLine, partial } = await vealAnswered(world, removeLine);
    // Dès la rupture signalée, puis après le retrait choisi par le client.
    expect(partial).toMatchObject({ status: "PARTIALLY_DENIED", estimatedTotalCents: 1000 });
    expect(await reload(order.id)).toMatchObject({ totalCents: 1000, estimatedTotalCents: 1000 });

    // 5 % de 10,00 € = 0,50 €.
    const result = await weighGrams(order.id, butcherOf(world), { [gramLine.id]: 1051 });

    expect(result).toMatchObject({
      ok: true,
      data: {
        applied: false,
        decision: { reason: "BEYOND_TOLERANCE", toleranceCents: 50, cumulatedIncreaseCents: 51 },
      },
    });
    expect((await reload(order.id)).totalCents).toBe(1000);
  });

  it("the customer's order page and the butcher's ticket show the tolerance of the new estimate", async () => {
    const world = await createWorld();
    const { order } = await vealAnswered(world, removeLine);

    expect(await customerOrderById(order.id)).toMatchObject({
      estimatedTotalCents: 1000,
      weighToleranceRateBps: 500,
    });
    const [row] = (await getKitchenBoard(world.shop.id)).active;
    expect(row).toMatchObject({ id: order.id, estimatedTotalCents: 1000 });
    expect(toleranceTicketLine(row)).toContain("(jusqu'à 0,50 €)");
  });
});

describe("a lighter line gives no room to the others", () => {
  /**
   * ACCEPTED, STANDARD: 1 kg of côte de bœuf at 23,96 €/kg and 500 g of tripes at 9,02 €/kg
   * (floor((902 x 500 + 500) / 1000) = 451); estimated 28,47 €, tolerance 1,42 €.
   */
  async function coteAndTripes() {
    const world = await createWorld();
    const cote = await createTestProduct(world.shop.id, { name: "Côte de bœuf", priceCents: 2396 });
    const tripes = await createTestProduct(world.shop.id, { name: "Tripes", priceCents: 902 });
    const order = await createOrder(world, {
      status: "ACCEPTED",
      items: [checkoutLine(cote.id, 1000, 2396, 2396), checkoutLine(tripes.id, 500, 902, 451)],
      overrides: {
        weighToleranceRateBps: STANDARD.rateBps,
        weighToleranceCapCents: STANDARD.capCents,
        estimatedTotalCents: 2847,
      },
    });
    const [coteLine, tripesLine] = order.items;
    return { world, order, coteLine, tripesLine };
  }

  // Côte à 1 g : floor((2396 x 1 + 500) / 1000) = 2 c, compté 2 c dans la base de la marge :
  // 2 + 451 = 4,53 €, marge 5 % = 0,22 €. Tripes : floor((902 x grammes + 500) / 1000).
  it.each([
    { tripes: 3150, newTotal: 2843, increase: 2390 }, // 2841 - 451 ; le total baisse
    { tripes: 657, newTotal: 595, increase: 142 }, // 593 - 451
  ])("côte weighed at 1 g and tripes at $tripes g in one request asks", async (row) => {
    const { world, order, coteLine, tripesLine } = await coteAndTripes();

    const result = await weighGrams(order.id, butcherOf(world), {
      [coteLine.id]: 1,
      [tripesLine.id]: row.tripes,
    });

    const asked = { reason: "BEYOND_TOLERANCE", toleranceCents: 22, estimatedTotalCents: 453 };
    expect(result).toMatchObject({
      ok: true,
      data: { applied: false, decision: { ...asked, cumulatedIncreaseCents: row.increase } },
    });
    expect((await reload(order.id)).totalCents).toBe(2847);
    expect(await adjustmentOf(order.id)).toMatchObject({
      status: "PENDING",
      newTotal: row.newTotal,
    });
  });

  it("côte weighed at 0 leaves the tolerance of the tripes alone; the window, the ticket and the server agree", async () => {
    const { world, order, coteLine, tripesLine } = await coteAndTripes();
    const butcher = butcherOf(world);

    expect(await weighGrams(order.id, butcher, { [coteLine.id]: 0 })).toMatchObject({
      ok: true,
      data: { applied: true, decision: { reason: "DECREASE" } },
    });
    expect(await reload(order.id)).toMatchObject({ totalCents: 451, estimatedTotalCents: 451 });

    // 5 % de 4,51 € = 0,22 € : 524 g de tripes (4,73 €) s'appliquent, 525 g (4,74 €) se demandent.
    expect(await weighGrams(order.id, butcher, { [tripesLine.id]: 524 })).toMatchObject({
      ok: true,
      data: { applied: true, decision: { toleranceCents: 22, cumulatedIncreaseCents: 22 } },
    });
    const [row] = (await getKitchenBoard(world.shop.id)).active;
    expect(toleranceTicketLine(row)).toContain("(jusqu'à 0,22 €)");
    const request = {
      adjustmentType: "WEIGHT" as const,
      items: [{ orderItemId: tripesLine.id, newQuantity: 0.525 }],
    };
    const asks = {
      decision: "ASK",
      reason: "BEYOND_TOLERANCE",
      toleranceCents: 22,
      cumulatedIncreaseCents: 23,
      estimatedTotalCents: 451,
    };
    const plan = planAdjustment(row, request);
    expect(plan).toMatchObject({ ok: true, newTotalCents: 474, decision: asks });
    expect(await adjustOrderPrice(order.id, butcher, request)).toMatchObject({
      ok: true,
      data: { applied: false, decision: asks },
    });
    expect((await reload(order.id)).totalCents).toBe(473);

    // Le client refuse ; 50 g de côte (1,20 €) comptent dans la base : 5 % de 5,71 € = 0,28 €.
    await rejectAdjustment(customerAnswer(order.id, world.customer.id, new Date()));
    expect(await weighGrams(order.id, butcher, { [coteLine.id]: 50 })).toMatchObject({
      ok: true,
      data: { applied: true, decision: { reason: "WITHIN_TOLERANCE", toleranceCents: 28 } },
    });
    expect(await reload(order.id)).toMatchObject({ totalCents: 593, estimatedTotalCents: 571 });
  });

  it("a decrease after an increase the customer accepted still applies at once", async () => {
    const world = await createWorld();
    const product = await createGramProduct(world);
    const order = await createWeighedOrder(world, product, [1000, 1000], STANDARD);
    const [first, second] = order.items;

    // 5 % de 20,00 € = 1,00 € : +3,00 € est demandé, le client accepte.
    expect(await weighGrams(order.id, butcherOf(world), { [first.id]: 1300 })).toMatchObject({
      ok: true,
      data: { applied: false },
    });
    expect(
      await acceptAdjustment({ orderId: order.id, userId: world.customer.id, now: new Date() })
    ).toMatchObject({ kind: "done" });
    const lighter = await weighGrams(order.id, butcherOf(world), { [second.id]: 900 });

    expect(lighter).toMatchObject({
      ok: true,
      // La ligne allégée de 1,00 € ne retranche rien aux 3,00 € acceptés sur l'autre.
      data: { applied: true, decision: { reason: "DECREASE", cumulatedIncreaseCents: 300 } },
    });
    expect((await reload(order.id)).totalCents).toBe(2200);
    expect(await adjustmentOf(order.id)).toMatchObject({ status: "AUTO_APPROVED" });
  });
});
