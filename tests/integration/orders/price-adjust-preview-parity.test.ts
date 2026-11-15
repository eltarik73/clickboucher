// @vitest-environment node
// La fenêtre d'ajustement du boucher annonce, avant l'envoi, ce que le serveur fera : appliqué tout
// de suite ou accord du client demandé. Ici, sur PostgreSQL réel, la ligne de commande telle que le
// tableau cuisine l'envoie au navigateur (JSON), les champs tels que le boucher les tape, puis la
// requête construite par la fenêtre envoyée au vrai service : décision et nouveau total identiques.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));

import type { KitchenOrder } from "@/hooks/use-order-polling";
import {
  draftFromInputs,
  previewAdjustment,
  type TypedInputs,
} from "@/components/boucher/price-adjust-preview";
import { WEIGH_TOLERANCE_TERMS, type AdjustmentKind } from "@/lib/pricing/tolerance";
import { adjustOrderPrice } from "@/lib/services/orders/adjust-price";
import { getKitchenBoard } from "@/lib/services/orders/kitchen";
import { useCleanDatabase } from "../helpers/db";
import { createTestProduct } from "../helpers/factories";
import {
  butcherOf,
  createGramProduct,
  createOrder,
  createWeighedOrder,
  createWorld,
  type World,
} from "./commands-fixtures";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const { STANDARD, EXTENDED } = WEIGH_TOLERANCE_TERMS;

/** The order as GET /api/boucher/orders/kitchen hands it to the butcher's browser. */
async function boardRow(world: World, orderId: string): Promise<KitchenOrder> {
  const board = await getKitchenBoard(world.shop.id);
  const row = board.active.find((order) => order.id === orderId);
  if (row === undefined) throw new Error(`Order ${orderId} is not on the kitchen board`);
  return JSON.parse(JSON.stringify(row)) as KitchenOrder;
}

/** The window's fields as it opens (every available line), with what the butcher typed. */
function typed(row: KitchenOrder, changes: Partial<TypedInputs>): TypedInputs {
  const lines = row.items.filter((item) => item.available);
  return {
    weights: {
      ...Object.fromEntries(lines.map((item) => [item.id, String(item.quantity)])),
      ...changes.weights,
    },
    prices: {
      ...Object.fromEntries(lines.map((item) => [item.id, (item.priceCents / 100).toFixed(2)])),
      ...changes.prices,
    },
    total: changes.total ?? (row.totalCents / 100).toFixed(2),
  };
}

/** Previews in the window, sends its request to the service, and expects the same outcome. */
async function expectSameOutcome(
  world: World,
  orderId: string,
  tab: AdjustmentKind,
  changes: Partial<TypedInputs>
) {
  const row = await boardRow(world, orderId);
  const preview = previewAdjustment(row, draftFromInputs(tab, typed(row, changes)));
  if (!preview.ok) throw new Error(`Preview refused: ${preview.message}`);

  const result = await adjustOrderPrice(orderId, butcherOf(world), preview.request);

  if (!result.ok) throw new Error(`Server refused: ${result.message}`);
  expect(result.data.decision).toEqual(preview.decision);
  expect(result.data.applied).toBe(preview.decision.decision === "APPLY");
  expect(result.data.adjustment.newTotal).toBe(preview.newTotalCents);
  return preview.decision;
}

describe("the butcher's window and the server decide alike", () => {
  it("a weighing down applies at once", async () => {
    const world = await createWorld();
    const order = await createWeighedOrder(world, await createGramProduct(world), [2000], STANDARD);

    const decision = await expectSameOutcome(world, order.id, "WEIGHT", {
      weights: { [order.items[0].id]: "1,9" },
    });

    expect(decision).toMatchObject({ decision: "APPLY", reason: "DECREASE" });
  });

  it("up to the tolerance applies without the customer, one gram more asks him", async () => {
    const world = await createWorld();
    const product = await createGramProduct(world);
    const within = await createWeighedOrder(world, product, [2000], STANDARD);
    const beyond = await createWeighedOrder(world, product, [2000], STANDARD);

    expect(
      await expectSameOutcome(world, within.id, "WEIGHT", {
        weights: { [within.items[0].id]: "2,1" },
      })
    ).toMatchObject({ reason: "WITHIN_TOLERANCE", toleranceCents: 100 });
    expect(
      await expectSameOutcome(world, beyond.id, "WEIGHT", {
        weights: { [beyond.items[0].id]: "2.101" },
      })
    ).toMatchObject({ reason: "BEYOND_TOLERANCE", cumulatedIncreaseCents: 101 });
  });

  it("counts the increase cumulated since the order, after an increase already applied", async () => {
    const world = await createWorld();
    const order = await createWeighedOrder(world, await createGramProduct(world), [2000], STANDARD);
    const lineId = order.items[0].id;

    await expectSameOutcome(world, order.id, "WEIGHT", { weights: { [lineId]: "2.06" } });
    const decision = await expectSameOutcome(world, order.id, "WEIGHT", {
      weights: { [lineId]: "2.11" },
    });

    expect(decision).toMatchObject({ reason: "BEYOND_TOLERANCE", cumulatedIncreaseCents: 110 });
  });

  it("caps the EXTENDED tolerance at 20,00 € on a large order", async () => {
    const world = await createWorld();
    const product = await createGramProduct(world);
    const within = await createWeighedOrder(world, product, [30_000], EXTENDED);
    const beyond = await createWeighedOrder(world, product, [30_000], EXTENDED);

    expect(
      await expectSameOutcome(world, within.id, "WEIGHT", {
        weights: { [within.items[0].id]: "32" },
      })
    ).toMatchObject({ reason: "WITHIN_TOLERANCE", toleranceCents: 2000 });
    expect(
      await expectSameOutcome(world, beyond.id, "WEIGHT", {
        weights: { [beyond.items[0].id]: "32.001" },
      })
    ).toMatchObject({ reason: "BEYOND_TOLERANCE", toleranceCents: 2000 });
  });

  it("a line out of stock gives the others no room", async () => {
    const world = await createWorld();
    const product = await createGramProduct(world);
    const order = await createOrder(world, {
      status: "ACCEPTED",
      totalCents: 1000,
      items: [
        {
          productId: product.id,
          quantity: 1,
          weightGrams: 1000,
          priceCents: 1000,
          totalCents: 1000,
          estimatedPriceCents: 1000,
        },
        {
          productId: product.id,
          quantity: 1,
          weightGrams: 1000,
          priceCents: 1000,
          totalCents: 0,
          estimatedPriceCents: 1000,
          available: false,
        },
      ],
      overrides: {
        weighToleranceRateBps: STANDARD.rateBps,
        weighToleranceCapCents: STANDARD.capCents,
        estimatedTotalCents: 2000,
      },
    });
    const [inStock] = order.items.filter((item) => item.available);

    const decision = await expectSameOutcome(world, order.id, "WEIGHT", {
      weights: { [inStock.id]: "1.15" },
    });

    expect(decision).toMatchObject({ reason: "BEYOND_TOLERANCE", cumulatedIncreaseCents: 150 });
  });

  it("a new unit price or a total typed by hand asks the customer for any increase", async () => {
    const world = await createWorld();
    const bread = await createTestProduct(world.shop.id, { unit: "PIECE", priceCents: 450 });
    const repriced = await createOrder(world, {
      status: "ACCEPTED",
      items: [{ productId: bread.id, estimatedPriceCents: 450 }],
      overrides: {
        weighToleranceRateBps: EXTENDED.rateBps,
        weighToleranceCapCents: EXTENDED.capCents,
        estimatedTotalCents: 450,
      },
    });
    const retotalled = await createWeighedOrder(
      world,
      await createGramProduct(world),
      [2000],
      STANDARD
    );
    const lowered = await createWeighedOrder(
      world,
      await createGramProduct(world),
      [2000],
      STANDARD
    );

    expect(
      await expectSameOutcome(world, repriced.id, "PRICE", {
        prices: { [repriced.items[0].id]: "4,60" },
      })
    ).toMatchObject({ decision: "ASK", reason: "NOT_WEIGHING" });
    expect(
      await expectSameOutcome(world, retotalled.id, "MANUAL", { total: "20,50" })
    ).toMatchObject({ decision: "ASK", reason: "NOT_WEIGHING" });
    expect(await expectSameOutcome(world, lowered.id, "MANUAL", { total: "19" })).toMatchObject({
      decision: "APPLY",
      reason: "DECREASE",
    });
  });

  it("an order created before the tolerance asks the customer for any increase", async () => {
    const world = await createWorld();
    const order = await createWeighedOrder(world, await createGramProduct(world), [2000], null);

    const decision = await expectSameOutcome(world, order.id, "WEIGHT", {
      weights: { [order.items[0].id]: "2.001" },
    });

    expect(decision).toMatchObject({ decision: "ASK", reason: "NO_TOLERANCE", toleranceCents: 0 });
  });
});
