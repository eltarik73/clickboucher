// @vitest-environment node
// Réponse du client à une hausse hors marge, sur PostgreSQL réel : un oui explicite l'applique,
// un non la ferme, le silence vaut refus (jamais acceptation) et un oui tardif ne change rien ;
// une ligne en attente sans answerBy (palier 2 ou 3) est traitée de même, à createdAt + 5 min,
// sans jamais être appliquée sans réponse.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));

import { WEIGH_TOLERANCE_TERMS } from "@/lib/pricing/tolerance";
import {
  acceptAdjustment,
  rejectAdjustment,
  settleDueAdjustment,
} from "@/lib/services/orders/adjustment-answers";
import { reportUnavailableItems } from "@/lib/services/orders/commands/unavailable";
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
  customerAnswer,
  eventsOf,
  notificationsOf,
  pendingWeighingIncrease,
  reload,
  weighGrams,
} from "./commands-fixtures";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const SECOND_MS = 1000;
const TOO_LATE = "Le délai de réponse est dépassé : le prix de votre commande n'a pas changé.";

function later(from: Date, ms: number): Date {
  return new Date(from.getTime() + ms);
}

describe("the customer's explicit answer", () => {
  it("a yes before the deadline applies the total and the lines, recorded as the customer's", async () => {
    const now = new Date();
    const { world, order } = await pendingWeighingIncrease(now);

    const answer = await acceptAdjustment(
      customerAnswer(order.id, world.customer.id, later(now, 299 * SECOND_MS))
    );

    expect(answer.kind).toBe("done");
    const stored = await reload(order.id);
    expect(stored.totalCents).toBe(2200);
    expect(stored.items[0]).toMatchObject({ quantity: 2.2, totalCents: 2200 });
    expect(await adjustmentOf(order.id)).toMatchObject({ status: "APPROVED", closeReason: null });
    const [event] = await eventsOf(order.id, "PRICE_ADJUSTED");
    expect(event.actorId).toBe(world.customer.id);
    expect(event.payloadJson).toEqual({
      from: 2000,
      to: 2200,
      settledAs: "APPROVED",
      adjustmentType: "WEIGHT",
      toleranceCents: 100,
      cumulatedIncreaseCents: 200,
    });
    const [notice] = await notificationsOf(world.owner.id, "PRICE_ADJUSTMENT_ACCEPTED");
    expect(notice.message).toContain("Nouveau total : 22,00 €");
  });

  it("a no keeps the price, is recorded as the customer's refusal and cannot be followed by a yes", async () => {
    const now = new Date();
    const { world, order } = await pendingWeighingIncrease(now);
    const answeredAt = later(now, SECOND_MS);

    const answer = await rejectAdjustment(customerAnswer(order.id, world.customer.id, answeredAt));
    const yes = await acceptAdjustment(customerAnswer(order.id, world.customer.id, answeredAt));

    expect(answer.kind).toBe("done");
    expect(yes).toEqual({ kind: "refused", message: "Aucun ajustement en attente" });
    expect((await reload(order.id)).totalCents).toBe(2000);
    expect(await adjustmentOf(order.id)).toMatchObject({
      status: "REJECTED",
      closeReason: "CUSTOMER_REFUSED",
    });
    const [event] = await eventsOf(order.id, "PRICE_ADJUSTMENT_CLOSED");
    expect(event).toMatchObject({ actorId: world.customer.id });
    expect(event.payloadJson).toMatchObject({ reason: "CUSTOMER_REFUSED", from: 2000, to: 2200 });
    const [notice] = await notificationsOf(world.owner.id, "PRICE_ADJUSTMENT_REJECTED");
    expect(notice.message).toBe(
      `Le client a refusé : le prix de la commande #${order.orderNumber} reste à 20,00 €. Repesez dans sa marge ou retirez l'article.`
    );
  });

  it("a yes on an order whose total changed since closes the adjustment, never applied", async () => {
    const now = new Date();
    const { world, order } = await pendingWeighingIncrease(now);
    await prisma.order.update({ where: { id: order.id }, data: { totalCents: 1800 } });
    const answeredAt = later(now, SECOND_MS);

    const yes = await acceptAdjustment(customerAnswer(order.id, world.customer.id, answeredAt));

    expect(yes).toEqual({
      kind: "refused",
      message: "La commande a changé depuis cet ajustement : il n'est plus applicable.",
    });
    expect((await reload(order.id)).totalCents).toBe(1800);
    expect(await adjustmentOf(order.id)).toMatchObject({
      status: "REJECTED",
      closeReason: "ORDER_CHANGED",
      respondedAt: answeredAt,
    });
    const closed = await eventsOf(order.id, "PRICE_ADJUSTMENT_CLOSED");
    expect(closed).toMatchObject([{ actorId: world.customer.id }]);
    expect(await eventsOf(order.id, "PRICE_ADJUSTED")).toHaveLength(0);
  });
});

describe("silence is a refusal", () => {
  it("a read after the deadline closes it unanswered, the price unchanged, the shop told once", async () => {
    const now = new Date();
    const { world, order } = await pendingWeighingIncrease(now);

    await settleDueAdjustment(order.id, later(now, ANSWER_WINDOW_MS - SECOND_MS));
    expect(await adjustmentOf(order.id)).toMatchObject({ status: "PENDING" });

    const deadline = later(now, ANSWER_WINDOW_MS);
    await Promise.all(Array.from({ length: 6 }, () => settleDueAdjustment(order.id, deadline)));

    expect((await reload(order.id)).totalCents).toBe(2000);
    expect(await adjustmentOf(order.id)).toMatchObject({
      status: "REJECTED",
      closeReason: "NO_ANSWER",
      respondedAt: deadline,
    });
    const events = await eventsOf(order.id, "PRICE_ADJUSTMENT_CLOSED");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorId: "system" });
    expect(events[0].payloadJson).toMatchObject({ reason: "NO_ANSWER" });
    const notices = await notificationsOf(world.owner.id, "PRICE_ADJUSTMENT_EXPIRED");
    expect(notices).toHaveLength(1);
    expect(notices[0].message).toBe(
      `Le client n'a pas répondu : le prix de la commande #${order.orderNumber} reste à 20,00 €. Repesez dans sa marge ou retirez l'article.`
    );
  });

  it("a yes after the deadline is refused and changes nothing", async () => {
    const now = new Date();
    const { world, order } = await pendingWeighingIncrease(now);

    const deadline = later(now, ANSWER_WINDOW_MS);
    const late = await acceptAdjustment(customerAnswer(order.id, world.customer.id, deadline));
    const again = await acceptAdjustment(
      customerAnswer(order.id, world.customer.id, later(deadline, SECOND_MS))
    );

    expect(late).toEqual({ kind: "refused", message: TOO_LATE });
    expect(again).toEqual({ kind: "refused", message: "Aucun ajustement en attente" });
    expect((await reload(order.id)).totalCents).toBe(2000);
    expect(await adjustmentOf(order.id)).toMatchObject({ closeReason: "NO_ANSWER" });
    expect(await eventsOf(order.id, "PRICE_ADJUSTED")).toHaveLength(0);
    expect(await notificationsOf(world.owner.id, "PRICE_ADJUSTMENT_EXPIRED")).toHaveLength(1);
  });

  it("a no after the deadline is recorded as no answer, with the same price", async () => {
    const now = new Date();
    const { world, order } = await pendingWeighingIncrease(now);

    const late = later(now, ANSWER_WINDOW_MS + SECOND_MS);
    const answer = await rejectAdjustment(customerAnswer(order.id, world.customer.id, late));

    expect(answer.kind).toBe("done");
    expect((await reload(order.id)).totalCents).toBe(2000);
    expect(await adjustmentOf(order.id)).toMatchObject({ closeReason: "NO_ANSWER" });
    expect(await notificationsOf(world.owner.id, "PRICE_ADJUSTMENT_REJECTED")).toHaveLength(0);
  });

  it.each([
    { tier: 2, legacy: { autoApproveAt: new Date(Date.now() - 60 * SECOND_MS) } },
    { tier: 3, legacy: { escalateAt: new Date(Date.now() - 60 * SECOND_MS) } },
  ])(
    "a tier-$tier row without answerBy is refused at createdAt + 5 min, never applied",
    async ({ tier, legacy }) => {
      const world = await createWorld();
      const product = await createGramProduct(world);
      const order = await createWeighedOrder(world, product, [2000], null);
      const createdAt = new Date(Date.now() - 60 * SECOND_MS);
      await prisma.priceAdjustment.create({
        data: {
          orderId: order.id,
          shopId: world.shop.id,
          originalTotal: 2000,
          newTotal: 2300,
          adjustmentType: "MANUAL",
          tier,
          createdAt,
          ...legacy,
        },
      });

      await settleDueAdjustment(order.id, new Date());
      expect(await adjustmentOf(order.id)).toMatchObject({ status: "PENDING" });

      await settleDueAdjustment(order.id, later(createdAt, ANSWER_WINDOW_MS));
      expect(await adjustmentOf(order.id)).toMatchObject({ closeReason: "NO_ANSWER" });
      expect((await reload(order.id)).totalCents).toBe(2000);
    }
  );
});

describe("after a refusal", () => {
  it("the butcher may weigh again within the tolerance (applied) or report the line out of stock", async () => {
    const now = new Date();
    const world = await createWorld();
    const meat = await createGramProduct(world);
    const tray = await createTestProduct(world.shop.id, { unit: "BARQUETTE", priceCents: 1000 });
    // 20,00 € de viande + une barquette à 10,00 € : marge STANDARD de 1,50 € sur 30,00 €.
    const order = await createOrder(world, {
      status: "ACCEPTED",
      items: [
        {
          productId: meat.id,
          quantity: 2,
          weightGrams: 2000,
          priceCents: 1000,
          totalCents: 2000,
          estimatedPriceCents: 2000,
        },
        { productId: tray.id, estimatedPriceCents: 1000 },
      ],
      overrides: {
        weighToleranceRateBps: WEIGH_TOLERANCE_TERMS.STANDARD.rateBps,
        weighToleranceCapCents: WEIGH_TOLERANCE_TERMS.STANDARD.capCents,
        estimatedTotalCents: 3000,
      },
    });
    const meatLine = order.items.find((item) => item.productId === meat.id)?.id as string;
    expect(await weighGrams(order.id, butcherOf(world), { [meatLine]: 2200 }, now)).toMatchObject({
      ok: true,
      data: { applied: false },
    });
    await rejectAdjustment(customerAnswer(order.id, world.customer.id, later(now, SECOND_MS)));

    const again = await weighGrams(
      order.id,
      butcherOf(world),
      { [meatLine]: 2150 },
      later(now, 2 * SECOND_MS)
    );
    expect(again).toMatchObject({ ok: true, data: { applied: true } });
    expect((await reload(order.id)).totalCents).toBe(3150);

    const reported = await reportUnavailableItems({
      orderId: order.id,
      shopId: world.shop.id,
      actorId: world.owner.id,
      productIds: [meat.id],
    });
    expect(reported.kind).toBe("done");
    expect(await reload(order.id)).toMatchObject({ status: "PARTIALLY_DENIED", totalCents: 1000 });
  });

  it("a proposal while the customer may still answer is a conflict; once unanswered it is replaced", async () => {
    const now = new Date();
    const { world, order } = await pendingWeighingIncrease(now);

    const line = order.items[0].id;
    const conflict = await weighGrams(
      order.id,
      butcherOf(world),
      { [line]: 2050 },
      later(now, SECOND_MS)
    );
    expect(conflict).toMatchObject({
      ok: false,
      code: "CONFLICT",
      message: "Un ajustement est déjà en attente de la réponse du client",
    });

    const deadline = later(now, ANSWER_WINDOW_MS);
    const replaced = await weighGrams(order.id, butcherOf(world), { [line]: 2050 }, deadline);
    expect(replaced).toMatchObject({ ok: true, data: { applied: true } });
    expect((await reload(order.id)).totalCents).toBe(2050);
    const closed = await eventsOf(order.id, "PRICE_ADJUSTMENT_CLOSED");
    expect(closed.map((event) => event.payloadJson)).toMatchObject([{ reason: "NO_ANSWER" }]);
    expect(await notificationsOf(world.owner.id, "PRICE_ADJUSTMENT_EXPIRED")).toHaveLength(1);
  });
});
