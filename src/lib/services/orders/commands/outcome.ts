// src/lib/services/orders/commands/outcome.ts — what an order command answers, and the pieces
// every command shares: the scoped read of an order, the replay of a transition already made,
// and the customer id resolution.
import type { Order, OrderStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { TransitionOutcome, TransitionScope } from "@/lib/services/orders/transition";

export type CommandRefusalCode = "VALIDATION_ERROR" | "STOCK_INSUFFICIENT" | "CONFLICT";

export type CommandResult<T> =
  /** This request made the change. */
  | { kind: "done"; data: T }
  /** The order already was in the requested state: nothing was written, nothing is sent. */
  | { kind: "replay"; data: T }
  | { kind: "not_found" }
  /** The order is in a status the command does not start from. */
  | { kind: "conflict"; currentStatus: OrderStatus }
  /** A business rule refused the command; the order is unchanged. */
  | {
      kind: "refused";
      code: CommandRefusalCode;
      message: string;
      details?: Record<string, string[]>;
    };

/**
 * Thrown inside a transition's effects when the rows read before the transition no longer match
 * what the effects find under the order's row lock. It rolls the transition back.
 */
export class StaleOrderError extends Error {
  constructor(orderId: string) {
    super(`Order ${orderId} changed between the read and the transition`);
    this.name = "StaleOrderError";
  }
}

export const STALE_ORDER_REFUSAL: CommandResult<never> = {
  kind: "refused",
  code: "CONFLICT",
  message: "La commande a été modifiée pendant l'opération. Rechargez-la puis recommencez.",
};

export function scopedOrderWhere(orderId: string, scope: TransitionScope): Prisma.OrderWhereInput {
  if ("shopId" in scope) return { id: orderId, shopId: scope.shopId };
  if ("userId" in scope) return { id: orderId, userId: scope.userId };
  return { id: orderId };
}

/**
 * A transition that changed nothing: a replay when the order already is in the target status
 * (the current row is returned), otherwise not found or a conflict with the current status.
 */
export async function unappliedTransition(
  outcome: Extract<TransitionOutcome, { ok: false }>,
  input: { orderId: string; scope: TransitionScope; to: OrderStatus }
): Promise<Exclude<CommandResult<Order>, { kind: "done" }>> {
  if (outcome.reason === "NOT_FOUND") return { kind: "not_found" };
  if (outcome.currentStatus !== input.to) {
    return { kind: "conflict", currentStatus: outcome.currentStatus };
  }
  const current = await prisma.order.findFirst({
    where: scopedOrderWhere(input.orderId, input.scope),
  });
  return current === null ? { kind: "not_found" } : { kind: "replay", data: current };
}

/** Customer routes receive a Clerk id; orders store the Prisma user id. */
export async function customerUserId(clerkId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } });
  return user?.id ?? null;
}
