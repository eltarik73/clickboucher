// @vitest-environment node
// Marge de pesée et composition de la commande, sur PostgreSQL réel. Quand le client accepte une
// nouvelle composition (article en rupture retiré ou remplacé), l'estimation de chaque ligne
// remplacée et le total estimé de la commande sont figés à nouveau : la marge devient
// min(taux x nouveau total estimé, plafond), et un remplacement moins cher ne donne aucune marge.
// Une ligne repesée à 0 ne donne aucune marge non plus, en une requête comme en deux.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));

import { toleranceTicketLine } from "@/components/boucher/tolerance-ticket-line";
import { WEIGH_TOLERANCE_TERMS, frozenToleranceOf, toleranceCents } from "@/lib/pricing/tolerance";
import { adjustOrderPrice } from "@/lib/services/orders/adjust-price";
import { acceptAdjustment } from "@/lib/services/orders/adjustment-answers";
import { acceptOrder } from "@/lib/services/orders/commands/accept";
import {
  reportUnavailableItems,
  resolveUnavailableItems,
  type UnavailableDecision,
} from "@/lib/services/orders/commands/unavailable";
import { customerOrderById } from "@/lib/services/orders/customer-view";
import { getKitchenBoard } from "@/lib/services/orders/kitchen";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestProduct } from "../helpers/factories";
import {
  butcherOf,
  createGramProduct,
  createOrder,
  createWeighedOrder,
  createWorld,
  reload,
  type World,
} from "./commands-fixtures";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const STANDARD = WEIGH_TOLERANCE_TERMS.STANDARD;

/** The butcher weighs lines again, in grams of a 1000 c/kg product: one gram costs one cent. */
function weigh(world: World, orderId: string, grams: Record<string, number>) {
  return adjustOrderPrice(orderId, butcherOf(world), {
    adjustmentType: "WEIGHT",
    items: Object.entries(grams).map(([orderItemId, weight]) => ({
      orderItemId,
      newQuantity: weight / 1000,
    })),
  });
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
  const line = (productId: string, priceCents: number) => ({
    productId,
    quantity: 1,
    weightGrams: 1000,
    priceCents,
    totalCents: priceCents,
    estimatedPriceCents: priceCents,
  });
  const order = await createOrder(world, {
    status: "ACCEPTED",
    items: [line(veal.id, 3000), line(grams.id, 1000)],
    overrides: {
      weighToleranceRateBps: STANDARD.rateBps,
      weighToleranceCapCents: STANDARD.capCents,
      estimatedTotalCents: 4000,
    },
  });
  const [vealLine, gramLine] = order.items;
  return { order, veal, vealLine, gramLine };
}

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
  it("a line out of stock: the estimate is that of the lines left", async () => {
    const world = await createWorld();
    const { partial } = await vealAnswered(world, (id) => ({ orderItemId: id, action: "remove" }));

    expect(partial).toMatchObject({ status: "PARTIALLY_DENIED", estimatedTotalCents: 1000 });
  });

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
    const result = await weigh(world, order.id, { [vealLine.id]: 1101 });

    expect(result).toMatchObject({
      ok: true,
      data: {
        applied: false,
        decision: { reason: "BEYOND_TOLERANCE", toleranceCents: 100, cumulatedIncreaseCents: 101 },
      },
    });
    expect((await reload(order.id)).totalCents).toBe(2000);
  });

  it("a removal: beyond 5 % of the remaining estimate asks the customer", async () => {
    const world = await createWorld();
    const { order, gramLine } = await vealAnswered(world, (id) => ({
      orderItemId: id,
      action: "remove",
    }));
    expect(await reload(order.id)).toMatchObject({ totalCents: 1000, estimatedTotalCents: 1000 });

    // 5 % de 10,00 € = 0,50 €.
    const result = await weigh(world, order.id, { [gramLine.id]: 1051 });

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
    const { order } = await vealAnswered(world, (id) => ({ orderItemId: id, action: "remove" }));

    const view = await customerOrderById(order.id);
    expect(view.estimatedTotalCents).toBe(1000);
    const tolerance = frozenToleranceOf(view);
    expect(
      tolerance === null ? null : toleranceCents(tolerance, tolerance.estimatedTotalCents)
    ).toBe(50);
    const [row] = (await getKitchenBoard(world.shop.id)).active;
    expect(row).toMatchObject({ id: order.id, estimatedTotalCents: 1000 });
    expect(toleranceTicketLine(row)).toContain("(jusqu'à 0,50 €)");
  });
});

describe("a line weighed again at 0 gives no room to the others", () => {
  /** STANDARD, 2000 g and 500 g of the gram product: estimated 25,00 €, tolerance 1,25 €. */
  async function twoWeighedLines(world: World) {
    const order = await createWeighedOrder(
      world,
      await createGramProduct(world),
      [2000, 500],
      STANDARD
    );
    const [zeroed, inflated] = order.items;
    return { order, zeroed, inflated };
  }

  it("in one request: zeroed and inflated together is asked, though the total goes down", async () => {
    const world = await createWorld();
    const { order, zeroed, inflated } = await twoWeighedLines(world);

    const result = await weigh(world, order.id, { [zeroed.id]: 0, [inflated.id]: 2400 });

    expect(result).toMatchObject({
      ok: true,
      data: {
        applied: false,
        decision: { reason: "BEYOND_TOLERANCE", toleranceCents: 125, cumulatedIncreaseCents: 1900 },
      },
    });
    expect((await reload(order.id)).totalCents).toBe(2500);
  });

  it("in two requests: the line zeroed alone applies, the other one inflated next is asked", async () => {
    const world = await createWorld();
    const { order, zeroed, inflated } = await twoWeighedLines(world);

    const removal = await weigh(world, order.id, { [zeroed.id]: 0 });
    const increase = await weigh(world, order.id, { [inflated.id]: 700 });

    expect(removal).toMatchObject({
      ok: true,
      data: { applied: true, decision: { reason: "DECREASE" } },
    });
    expect(increase).toMatchObject({
      ok: true,
      data: {
        applied: false,
        decision: { reason: "BEYOND_TOLERANCE", toleranceCents: 125, cumulatedIncreaseCents: 200 },
      },
    });
    expect((await reload(order.id)).totalCents).toBe(500);
  });

  it("a decrease after an increase the customer accepted still applies at once", async () => {
    const world = await createWorld();
    const order = await createWeighedOrder(
      world,
      await createGramProduct(world),
      [1000, 1000],
      STANDARD
    );
    const [first, second] = order.items;

    // 5 % de 20,00 € = 1,00 € : +3,00 € est demandé, le client accepte.
    expect(await weigh(world, order.id, { [first.id]: 1300 })).toMatchObject({
      ok: true,
      data: { applied: false },
    });
    expect(
      await acceptAdjustment({ orderId: order.id, userId: world.customer.id, now: new Date() })
    ).toMatchObject({ kind: "done" });
    const lighter = await weigh(world, order.id, { [second.id]: 900 });

    expect(lighter).toMatchObject({
      ok: true,
      data: { applied: true, decision: { reason: "DECREASE", cumulatedIncreaseCents: 200 } },
    });
    expect((await reload(order.id)).totalCents).toBe(2200);
    expect(
      await prisma.priceAdjustment.findUniqueOrThrow({ where: { orderId: order.id } })
    ).toMatchObject({
      status: "AUTO_APPROVED",
    });
  });
});
