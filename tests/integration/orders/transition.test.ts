// @vitest-environment node
// The conditional status write on real PostgreSQL: scope, table, extra conditions, effects in the
// same transaction, and two requests racing on the same order.
import type { Order, OrderStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  IllegalTransitionError,
  transitionOrder,
  transitionOrderInTx,
  type TransitionInput,
} from "@/lib/services/orders/transition";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestOrder, createTestShop, createTestUser } from "../helpers/factories";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

async function pendingOrder(status: OrderStatus = "PENDING") {
  const shop = await createTestShop();
  const customer = await createTestUser();
  const order = await createTestOrder({ shopId: shop.id, userId: customer.id, status });
  return { shop, customer, order };
}

function acceptInput(order: Order, overrides: Partial<TransitionInput> = {}): TransitionInput {
  return {
    orderId: order.id,
    scope: { shopId: order.shopId },
    from: ["PENDING"],
    to: "ACCEPTED",
    data: { estimatedReady: new Date("2026-11-13T11:00:00Z") },
    event: { type: "ACCEPTED", actorId: "user_butcher", payload: { estimatedMinutes: 20 } },
    ...overrides,
  };
}

async function snapshot(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const events = await prisma.orderEvent.findMany({ where: { orderId } });
  return { order, events };
}

describe("transitionOrder — success", () => {
  it("updates the row, writes exactly one OrderEvent and returns previousStatus", async () => {
    const { order } = await pendingOrder();

    const outcome = await transitionOrder(acceptInput(order));

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.previousStatus).toBe("PENDING");
    expect(outcome.order.status).toBe("ACCEPTED");
    expect(outcome.order.estimatedReady).toEqual(new Date("2026-11-13T11:00:00Z"));

    const { order: stored, events } = await snapshot(order.id);
    expect(stored.status).toBe("ACCEPTED");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      orderId: order.id,
      shopId: order.shopId,
      type: "ACCEPTED",
      actorId: "user_butcher",
      payloadJson: { estimatedMinutes: 20 },
    });
  });

  it("changes Order.updatedAt", async () => {
    const { order } = await pendingOrder();
    const past = new Date("2026-01-01T00:00:00Z");
    await prisma.$executeRaw`UPDATE "orders" SET "updated_at" = ${past} WHERE "id" = ${order.id}`;

    const outcome = await transitionOrder(acceptInput(order));

    expect(outcome.ok).toBe(true);
    const { order: stored } = await snapshot(order.id);
    expect(stored.updatedAt.getTime()).toBeGreaterThan(past.getTime());
  });

  it("reports the status actually left when `from` lists several statuses", async () => {
    const { order } = await pendingOrder("PREPARING");

    const outcome = await transitionOrder({
      orderId: order.id,
      scope: { system: true },
      from: ["ACCEPTED", "PREPARING"],
      to: "READY",
      event: { type: "READY", actorId: "system" },
    });

    expect(outcome).toMatchObject({ ok: true, previousStatus: "PREPARING" });
  });

  it("accepts the customer's scope", async () => {
    const { order, customer } = await pendingOrder();

    const outcome = await transitionOrder({
      orderId: order.id,
      scope: { userId: customer.id },
      from: ["PENDING"],
      to: "CANCELLED",
      event: { type: "CANCELLED", actorId: customer.id },
    });

    expect(outcome).toMatchObject({ ok: true, previousStatus: "PENDING" });
  });

  it("runs effects in the transaction with the updated order and the previous status", async () => {
    const { order } = await pendingOrder();
    const seen: Array<[OrderStatus, OrderStatus]> = [];

    await transitionOrder(
      acceptInput(order, {
        effects: async (tx, updated, previousStatus) => {
          seen.push([updated.status, previousStatus]);
          await tx.order.update({ where: { id: updated.id }, data: { boucherNote: "effet" } });
        },
      })
    );

    expect(seen).toEqual([["ACCEPTED", "PENDING"]]);
    expect((await snapshot(order.id)).order.boucherNote).toBe("effet");
  });
});

describe("transitionOrder — refusals", () => {
  it("throws IllegalTransitionError for a pair absent from the table and writes nothing", async () => {
    const { order } = await pendingOrder();

    await expect(
      transitionOrder(acceptInput(order, { from: ["PENDING"], to: "PICKED_UP" }))
    ).rejects.toBeInstanceOf(IllegalTransitionError);
    await expect(
      transitionOrder(acceptInput(order, { from: ["PENDING", "COMPLETED"], to: "ACCEPTED" }))
    ).rejects.toBeInstanceOf(IllegalTransitionError);
    await expect(transitionOrder(acceptInput(order, { from: [] }))).rejects.toBeInstanceOf(
      IllegalTransitionError
    );

    const { order: stored, events } = await snapshot(order.id);
    expect(stored.status).toBe("PENDING");
    expect(events).toHaveLength(0);
  });

  it("returns NOT_FOUND for a wrong shop scope and writes nothing", async () => {
    const { order } = await pendingOrder();
    const otherShop = await createTestShop();

    const outcome = await transitionOrder(acceptInput(order, { scope: { shopId: otherShop.id } }));

    expect(outcome).toEqual({ ok: false, reason: "NOT_FOUND" });
    const { order: stored, events } = await snapshot(order.id);
    expect(stored.status).toBe("PENDING");
    expect(events).toHaveLength(0);
  });

  it("returns NOT_FOUND for a wrong customer scope and writes nothing", async () => {
    const { order } = await pendingOrder();
    const stranger = await createTestUser();

    const outcome = await transitionOrder(
      acceptInput(order, { scope: { userId: stranger.id }, to: "CANCELLED" })
    );

    expect(outcome).toEqual({ ok: false, reason: "NOT_FOUND" });
    expect((await snapshot(order.id)).order.status).toBe("PENDING");
  });

  it("returns NOT_FOUND for an order that does not exist", async () => {
    const outcome = await transitionOrder({
      orderId: "missing",
      scope: { system: true },
      from: ["PENDING"],
      to: "AUTO_CANCELLED",
      event: { type: "AUTO_CANCELLED", actorId: "system" },
    });
    expect(outcome).toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  it("returns CONFLICT with the current status when the order is not in `from`", async () => {
    const { order } = await pendingOrder("READY");

    const outcome = await transitionOrder(acceptInput(order));

    expect(outcome).toEqual({ ok: false, reason: "CONFLICT", currentStatus: "READY" });
    expect((await snapshot(order.id)).events).toHaveLength(0);
  });

  it("returns CONFLICT with the current status when an extra `where` does not match", async () => {
    const { order } = await pendingOrder();

    const outcome = await transitionOrder(
      acceptInput(order, { where: { qrCode: "not-this-code" } })
    );

    expect(outcome).toEqual({ ok: false, reason: "CONFLICT", currentStatus: "PENDING" });
    const { order: stored, events } = await snapshot(order.id);
    expect(stored.status).toBe("PENDING");
    expect(stored.estimatedReady).toBeNull();
    expect(events).toHaveLength(0);
  });

  it("reports a replay as CONFLICT whose current status is the target", async () => {
    const { order } = await pendingOrder();
    await transitionOrder(acceptInput(order));

    const replay = await transitionOrder(acceptInput(order));

    expect(replay).toEqual({ ok: false, reason: "CONFLICT", currentStatus: "ACCEPTED" });
    expect((await snapshot(order.id)).events).toHaveLength(1);
  });

  it("rolls back status, event and the effects' own writes when effects throw", async () => {
    const { order } = await pendingOrder();
    class EffectFailure extends Error {}

    await expect(
      transitionOrder(
        acceptInput(order, {
          effects: async (tx, updated) => {
            await tx.order.update({ where: { id: updated.id }, data: { boucherNote: "effet" } });
            throw new EffectFailure("stock");
          },
        })
      )
    ).rejects.toBeInstanceOf(EffectFailure);

    const { order: stored, events } = await snapshot(order.id);
    expect(stored.status).toBe("PENDING");
    expect(stored.boucherNote).toBeNull();
    expect(stored.estimatedReady).toBeNull();
    expect(events).toHaveLength(0);
  });
});

describe("transitionOrder — concurrency", () => {
  it("lets exactly one of two concurrent transitions from PENDING win", async () => {
    for (let round = 0; round < 5; round += 1) {
      const { order, customer } = await pendingOrder();

      const [accept, cancel] = await Promise.all([
        transitionOrder(acceptInput(order)),
        transitionOrder({
          orderId: order.id,
          scope: { userId: customer.id },
          from: ["PENDING"],
          to: "CANCELLED",
          event: { type: "CANCELLED", actorId: customer.id },
        }),
      ]);

      const outcomes = [accept, cancel];
      const winners = outcomes.filter((o) => o.ok);
      const losers = outcomes.filter((o) => !o.ok);
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);

      const winnerTarget = accept.ok ? "ACCEPTED" : "CANCELLED";
      expect(losers[0]).toEqual({ ok: false, reason: "CONFLICT", currentStatus: winnerTarget });
      const { order: stored, events } = await snapshot(order.id);
      expect(stored.status).toBe(winnerTarget);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(winnerTarget);
    }
  });

  it("refuses the second writer that read PENDING before the first one committed", async () => {
    const { order, customer } = await pendingOrder();
    let releaseFirst: () => void = () => undefined;
    const firstMayCommit = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let signalWritten: () => void = () => undefined;
    const firstWritten = new Promise<void>((resolve) => {
      signalWritten = resolve;
    });

    // The first transaction writes ACCEPTED and keeps the row locked until released.
    const first = prisma.$transaction(
      async (tx) => {
        const outcome = await transitionOrderInTx(tx, acceptInput(order));
        signalWritten();
        await firstMayCommit;
        return outcome;
      },
      { timeout: 30_000 }
    );
    await firstWritten;

    // The second one still reads PENDING (uncommitted change), then waits on the row lock.
    const second = transitionOrder({
      orderId: order.id,
      scope: { userId: customer.id },
      from: ["PENDING"],
      to: "CANCELLED",
      event: { type: "CANCELLED", actorId: customer.id },
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    releaseFirst();

    expect(await first).toMatchObject({ ok: true, previousStatus: "PENDING" });
    expect(await second).toEqual({ ok: false, reason: "CONFLICT", currentStatus: "ACCEPTED" });
    const { order: stored, events } = await snapshot(order.id);
    expect(stored.status).toBe("ACCEPTED");
    expect(events.map((e) => e.type)).toEqual(["ACCEPTED"]);
  });

  it("runs inside the caller's transaction with transitionOrderInTx", async () => {
    const { order } = await pendingOrder();
    class Abort extends Error {}

    await expect(
      prisma.$transaction(async (tx) => {
        const outcome = await transitionOrderInTx(tx, acceptInput(order));
        expect(outcome.ok).toBe(true);
        throw new Abort("caller rolls back");
      })
    ).rejects.toBeInstanceOf(Abort);

    const { order: stored, events } = await snapshot(order.id);
    expect(stored.status).toBe("PENDING");
    expect(events).toHaveLength(0);
  });
});
