// Order price adjustment service, for PATCH /api/orders/[id]/adjust-price: the butcher proposes
// new weights, unit prices or a new total. Under the order lock, planAdjustment
// (src/lib/pricing/adjustment.ts, also the preview of the butcher's window) gives the changed
// lines, the new total and whether it applies at once or needs the customer's explicit yes before
// answerBy. This module keeps what needs the database: the pending conflict, the platform's cap,
// the stored row; adjustment-settlement.ts applies it.
import type { AdjustmentType, PriceAdjustment, Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications";
import { getMaxIncreasePct } from "@/lib/price-adjustment";
import type { AdjustPriceRequest } from "@/lib/price-adjustment-request";
import {
  isAdjustmentApplied,
  planAdjustment,
  type PlannableLine,
  type PlannedLineChange,
} from "@/lib/pricing/adjustment";
import { ADJUSTMENT_ANSWER_WINDOW_SECONDS, type AdjustmentDecision } from "@/lib/pricing/tolerance";
import { notifyAdjustmentExpired } from "./adjustment-answers";
import { expirePendingAdjustment } from "./adjustment-closure";
import {
  ADJUSTMENT_CREATION_STATUSES,
  lockOrderForAdjustment,
  settleAdjustmentInTx,
  type AdjustmentSnapshotLine,
} from "./adjustment-settlement";

type Failure = {
  ok: false;
  code: "VALIDATION_ERROR" | "NOT_FOUND" | "CONFLICT";
  message: string;
};

/** What PATCH /api/orders/[id]/adjust-price answers once the proposal is taken. */
export type AdjustPriceAnswer =
  | { adjustment: PriceAdjustment; applied: boolean; decision: AdjustmentDecision }
  /** The proposal changes nothing: the order's current adjustment, nothing written. */
  | { adjustment: PriceAdjustment | null; applied: boolean; _idempotent: true };

export type AdjustPriceResult = { ok: true; data: AdjustPriceAnswer } | Failure;

const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 10_000 } as const;

const PLANNABLE_LINE_SELECT = {
  id: true,
  name: true,
  unit: true,
  quantity: true,
  weightGrams: true,
  priceCents: true,
  totalCents: true,
  available: true,
  estimatedPriceCents: true,
} satisfies Prisma.OrderItemSelect;

/** What the changed lines were and become, kept on the adjustment for its settlement. */
function snapshotOf(
  adjustmentType: AdjustmentType,
  items: readonly PlannableLine[],
  changes: readonly PlannedLineChange[]
): AdjustmentSnapshotLine[] {
  const changeById = new Map(changes.map((change) => [change.orderItemId, change]));
  return items.flatMap((item) => {
    const change = changeById.get(item.id);
    if (change === undefined) return [];
    return {
      orderItemId: item.id,
      name: item.name,
      unit: item.unit,
      oldQuantity: item.quantity,
      oldPriceCents: item.priceCents,
      oldTotalCents: item.totalCents,
      newTotalCents: change.totalCents,
      ...(adjustmentType === "WEIGHT"
        ? { newQuantity: change.quantity }
        : { newPriceCents: change.priceCents }),
    };
  });
}

/**
 * Creates a price adjustment for an order of the butcher's shop, under the order lock: applied in
 * the same transaction (APPLY) or left PENDING, tier 3, until answerBy (ASK). A pending one past
 * its window is closed first (NO_ANSWER); one the customer may still answer is a conflict. A
 * proposal that changes neither the total nor a line answers the current state, idempotently.
 */
export async function adjustOrderPrice(
  orderId: string,
  shop: { shopId: string; actorId: string },
  data: AdjustPriceRequest,
  now: Date = new Date()
): Promise<AdjustPriceResult> {
  const maxIncreasePct = await getMaxIncreasePct();

  const { result, expired } = await prisma.$transaction(async (tx) => {
    const order = await lockOrderForAdjustment(tx, orderId, { shopId: shop.shopId });
    const refuse = (failure: Failure) => ({ result: failure, expired: null });
    if (order === null)
      return refuse({ ok: false, code: "NOT_FOUND", message: "Commande introuvable" });
    if (!ADJUSTMENT_CREATION_STATUSES.includes(order.status)) {
      return refuse({
        ok: false,
        code: "VALIDATION_ERROR",
        message: `Ajustement impossible (statut : ${order.status})`,
      });
    }
    const expired = await expirePendingAdjustment(tx, orderId, now);
    const answer = (outcome: AdjustPriceResult) => ({ result: outcome, expired });
    const existing = await tx.priceAdjustment.findUnique({ where: { orderId } });
    if (existing?.status === "PENDING") {
      return answer({
        ok: false,
        code: "CONFLICT",
        message: "Un ajustement est déjà en attente de la réponse du client",
      });
    }

    const items = await tx.orderItem.findMany({
      where: { orderId },
      select: PLANNABLE_LINE_SELECT,
    });
    const plan = planAdjustment({ ...order, items }, data);
    if (!plan.ok) return answer({ ok: false, code: "VALIDATION_ERROR", message: plan.message });
    if (plan.unchanged) {
      // Applied only when the current adjustment set the order's total (not after a refusal).
      const applied = existing !== null && isAdjustmentApplied(existing.status);
      return answer({ ok: true, data: { adjustment: existing, applied, _idempotent: true } });
    }
    // The cap is measured on the current total or, when higher, on the estimate of the lines the
    // order still delivers (frozen tolerance only): a line weighed down by mistake, even to 0, can
    // be weighed back to its estimate, and an increase never widens the base.
    const capBaseCents = Math.max(order.totalCents, plan.decision.estimatedTotalCents ?? 0);
    const maxAllowed = Math.round(capBaseCents * (1 + maxIncreasePct / 100));
    if (plan.newTotalCents > maxAllowed) {
      return answer({
        ok: false,
        code: "VALIDATION_ERROR",
        message: `L'ajustement ne peut pas dépasser +${maxIncreasePct} % du total de la commande`,
      });
    }
    const { decision } = plan;
    const applied = decision.decision === "APPLY";
    const snapshot = snapshotOf(data.adjustmentType, items, plan.lineChanges);

    // One adjustment row per order: a settled or closed one is replaced by the new proposal.
    if (existing !== null) await tx.priceAdjustment.delete({ where: { id: existing.id } });
    const adjustment = await tx.priceAdjustment.create({
      data: {
        orderId,
        shopId: shop.shopId,
        originalTotal: order.totalCents,
        newTotal: plan.newTotalCents,
        reason: data.reason,
        adjustmentType: data.adjustmentType,
        status: "PENDING",
        // 1 = applied without asking, 3 = needs the customer's answer (never 2: see schema).
        tier: applied ? 1 : 3,
        answerBy: applied
          ? undefined
          : new Date(now.getTime() + ADJUSTMENT_ANSWER_WINDOW_SECONDS * 1000),
        itemsSnapshot: snapshot.length > 0 ? (snapshot as Prisma.InputJsonArray) : undefined,
      },
    });
    if (!applied) return answer({ ok: true, data: { adjustment, applied, decision } });

    const settled = await settleAdjustmentInTx(tx, {
      orderId,
      scope: { shopId: shop.shopId },
      settledAs: "AUTO_APPROVED",
      now,
      actorId: shop.actorId,
    });
    if (settled.kind !== "settled")
      throw new Error(`Adjustment of order ${orderId} not applied: ${settled.kind}`);
    return answer({ ok: true, data: { adjustment: settled.adjustment, applied, decision } });
  }, TRANSACTION_OPTIONS);

  if (expired !== null) await notifyAdjustmentExpired(expired);
  if (!result.ok || "_idempotent" in result.data) return result;
  await notifyCustomer(orderId, result.data.adjustment, result.data.applied);
  return result;
}

/** Applied: the customer learns the new price (not when it is unchanged). Asked: he must answer. */
async function notifyCustomer(orderId: string, adjustment: PriceAdjustment, applied: boolean) {
  if (applied && adjustment.newTotal === adjustment.originalTotal) return;
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { userId: true, orderNumber: true, shop: { select: { name: true } } },
  });
  await sendNotification(applied ? "PRICE_ADJUSTMENT_AUTO_APPROVED" : "PRICE_ADJUSTMENT_PENDING", {
    userId: order.userId,
    orderId,
    orderNumber: order.orderNumber,
    shopName: order.shop.name,
    originalTotal: adjustment.originalTotal,
    newTotal: adjustment.newTotal,
  });
}
