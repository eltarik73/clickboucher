// src/lib/services/orders/transition.ts — the ONLY writer of Order.status after creation.
//
// A transition is a conditional write: the UPDATE carries the order id, the caller's scope and the
// expected starting status, so two concurrent requests on the same order cannot both succeed —
// PostgreSQL re-checks the WHERE clause of the second one after the first commits and it then
// matches no row. The OrderEvent and the caller's linked effects are written in the same
// transaction, and only by the request whose status write changed the row.
//
// Lock order of every order transaction (creation and transitions alike): the order row, then the
// offer, then the counters, then the products. Two transactions that take the same rows in the
// same order wait for each other instead of deadlocking.
import type { Order, OrderStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { canTransition } from "@/lib/order-state-machine";

type Tx = Prisma.TransactionClient;

/** actorId of the OrderEvents written by the platform itself (auto-accept, expiry). */
export const SYSTEM_ACTOR_ID = "system";

export type TransitionScope = { shopId: string } | { userId: string } | { system: true };

export interface TransitionInput {
  orderId: string;
  scope: TransitionScope;
  /** Every (from, to) pair must be in the transition table, else IllegalTransitionError. */
  from: readonly OrderStatus[];
  to: OrderStatus;
  /** Extra write conditions (expiresAt <= now, qrCode, cancellation window). */
  where?: Prisma.OrderWhereInput;
  data?: Omit<Prisma.OrderUncheckedUpdateManyInput, "status">;
  event: { type: string; actorId: string; payload?: Prisma.InputJsonObject };
  /** Same transaction, runs only when the status write changed exactly one row. A throw rolls everything back. */
  effects?: (tx: Tx, order: Order, previousStatus: OrderStatus) => Promise<void>;
}

export type TransitionOutcome =
  | { ok: true; order: Order; previousStatus: OrderStatus }
  | { ok: false; reason: "NOT_FOUND" }
  | { ok: false; reason: "CONFLICT"; currentStatus: OrderStatus };

/** A caller asked for a transition the table does not allow: a programming error, never a 409. */
export class IllegalTransitionError extends Error {
  constructor(from: readonly OrderStatus[], to: OrderStatus) {
    super(`Illegal order transition: [${from.join(", ")}] -> ${to}`);
    this.name = "IllegalTransitionError";
  }
}

const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 10_000 } as const;

function assertLegal(from: readonly OrderStatus[], to: OrderStatus): void {
  if (from.length === 0 || from.some((status) => !canTransition(status, to))) {
    throw new IllegalTransitionError(from, to);
  }
}

function scopeWhere(orderId: string, scope: TransitionScope): Prisma.OrderWhereInput {
  if ("shopId" in scope) return { id: orderId, shopId: scope.shopId };
  if ("userId" in scope) return { id: orderId, userId: scope.userId };
  return { id: orderId };
}

async function readScopedStatus(
  tx: Tx,
  scoped: Prisma.OrderWhereInput
): Promise<OrderStatus | null> {
  const row = await tx.order.findFirst({ where: scoped, select: { status: true } });
  return row?.status ?? null;
}

function failure(currentStatus: OrderStatus | null): TransitionOutcome {
  return currentStatus === null
    ? { ok: false, reason: "NOT_FOUND" }
    : { ok: false, reason: "CONFLICT", currentStatus };
}

/**
 * Runs the transition on the caller's transaction (use it when the transition is one step of a
 * larger unit of work). The caller must not swallow a throw from here: the transaction has to roll
 * back for the effects to be undone.
 */
export async function transitionOrderInTx(
  tx: Tx,
  input: TransitionInput
): Promise<TransitionOutcome> {
  assertLegal(input.from, input.to);
  const scoped = scopeWhere(input.orderId, input.scope);

  // The status read here is the one the write is conditioned on: previousStatus is then exact
  // even when `from` lists several statuses.
  const previousStatus = await readScopedStatus(tx, scoped);
  if (previousStatus === null || !input.from.includes(previousStatus)) {
    return failure(previousStatus);
  }

  const { count } = await tx.order.updateMany({
    where: { AND: [scoped, { status: previousStatus }, input.where ?? {}] },
    data: { ...input.data, status: input.to },
  });
  if (count === 0) return failure(await readScopedStatus(tx, scoped));
  if (count !== 1) {
    throw new Error(`transitionOrder: ${count} rows matched order ${input.orderId}`);
  }

  const order = await tx.order.findUniqueOrThrow({ where: { id: input.orderId } });
  if (input.effects) await input.effects(tx, order, previousStatus);
  await tx.orderEvent.create({
    data: {
      orderId: order.id,
      shopId: order.shopId,
      type: input.event.type,
      actorId: input.event.actorId,
      payloadJson: input.event.payload,
    },
  });
  return { ok: true, order, previousStatus };
}

/** Runs the transition in its own transaction. */
export async function transitionOrder(input: TransitionInput): Promise<TransitionOutcome> {
  return prisma.$transaction((tx) => transitionOrderInTx(tx, input), TRANSACTION_OPTIONS);
}
