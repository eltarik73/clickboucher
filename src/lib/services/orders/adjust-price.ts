// Order price adjustment service, for PATCH /api/orders/[id]/adjust-price: the butcher proposes
// new weights, unit prices or a new total; decideAdjustment (src/lib/pricing/tolerance.ts) says
// whether it applies at once or needs the customer's explicit yes before answerBy. Lines are
// re-priced by src/lib/pricing/adjustment.ts; adjustment-settlement.ts applies it.
import type { OrderItem, PriceAdjustment, Prisma } from "@prisma/client";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications";
import { getPriceAdjConfig } from "@/lib/price-adjustment";
import { formatZodError } from "@/lib/api/errors";
import {
  availableLinesAfter,
  repriceLine,
  reweighLine,
  type AdjustedLine,
} from "@/lib/pricing/adjustment";
import {
  ADJUSTMENT_ANSWER_WINDOW_SECONDS,
  decideAdjustment,
  frozenToleranceOf,
  type AdjustmentDecision,
} from "@/lib/pricing/tolerance";
import { notifyAdjustmentExpired } from "./adjustment-answers";
import { expirePendingAdjustment } from "./adjustment-closure";
import {
  ADJUSTMENT_CREATION_STATUSES,
  lockOrderForAdjustment,
  settleAdjustmentInTx,
  type AdjustmentSnapshotLine,
} from "./adjustment-settlement";

export const adjustPriceSchema = z.object({
  adjustmentType: z.enum(["WEIGHT", "PRICE", "MANUAL"]),
  reason: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        orderItemId: z.string().min(1),
        newQuantity: z.number().min(0).optional(),
        newPriceCents: z.number().int().min(0).optional(),
      })
    )
    .max(50)
    .optional(),
  newTotalCents: z.number().int().min(0).optional(),
});

type AdjustPriceInput = z.infer<typeof adjustPriceSchema>;

type AdjustPriceErrorCode = "VALIDATION_ERROR" | "NOT_FOUND" | "CONFLICT";

type Failure = {
  ok: false;
  code: AdjustPriceErrorCode;
  message: string;
  details?: Record<string, string[]>;
};

export type AdjustPriceResult =
  | {
      ok: true;
      data: { adjustment: PriceAdjustment; applied: boolean; decision: AdjustmentDecision };
    }
  | Failure;

const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 10_000 } as const;

const MISSING_DATA = "Données d'ajustement manquantes";

const LINE_REFUSALS: Record<Extract<AdjustedLine, { ok: false }>["reason"], string> = {
  QUANTITY_INVALID: "Quantité invalide : poids en grammes entiers, nombre entier pour les pièces",
  PRICE_INVALID: "Prix invalide",
  LINE_NOT_ADJUSTABLE: "Cette ligne ne peut pas être ajustée",
};

type AdjustableItem = Pick<
  OrderItem,
  | "id"
  | "name"
  | "unit"
  | "quantity"
  | "weightGrams"
  | "priceCents"
  | "totalCents"
  | "available"
  | "estimatedPriceCents"
>;

/** New total and line changes of the request, computed from the locked order. */
function planAdjustment(
  data: AdjustPriceInput,
  originalTotal: number,
  items: readonly AdjustableItem[]
): { newTotal: number; snapshot: AdjustmentSnapshotLine[] } | Failure {
  if (data.adjustmentType === "MANUAL") {
    if (data.newTotalCents === undefined) {
      return { ok: false, code: "VALIDATION_ERROR", message: "Nouveau total manquant" };
    }
    return { newTotal: data.newTotalCents, snapshot: [] };
  }
  const changes = data.items ?? [];
  if (changes.length === 0) return { ok: false, code: "VALIDATION_ERROR", message: MISSING_DATA };
  if (new Set(changes.map((change) => change.orderItemId)).size !== changes.length) {
    return { ok: false, code: "VALIDATION_ERROR", message: "Article ajusté deux fois" };
  }

  const itemById = new Map(items.map((item) => [item.id, item]));
  const snapshot: AdjustmentSnapshotLine[] = [];
  for (const change of changes) {
    const item = itemById.get(change.orderItemId);
    if (item === undefined || !item.available) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Article absent de la commande ou en rupture",
      };
    }
    const line = {
      unit: item.unit,
      quantity: item.quantity,
      weightGrams: item.weightGrams,
      priceCents: item.priceCents,
    };
    const adjusted =
      data.adjustmentType === "WEIGHT"
        ? change.newQuantity === undefined
          ? null
          : reweighLine(line, change.newQuantity)
        : change.newPriceCents === undefined
          ? null
          : repriceLine(line, change.newPriceCents);
    if (adjusted === null) return { ok: false, code: "VALIDATION_ERROR", message: MISSING_DATA };
    if (!adjusted.ok) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: `${item.name} : ${LINE_REFUSALS[adjusted.reason]}`,
      };
    }
    snapshot.push({
      orderItemId: item.id,
      name: item.name,
      unit: item.unit,
      oldQuantity: item.quantity,
      oldPriceCents: item.priceCents,
      oldTotalCents: item.totalCents,
      newTotalCents: adjusted.totalCents,
      ...(data.adjustmentType === "WEIGHT"
        ? { newQuantity: adjusted.quantity, priceCents: item.priceCents }
        : { newPriceCents: adjusted.priceCents, quantity: item.quantity }),
    });
  }
  const diff = snapshot.reduce((sum, line) => sum + line.newTotalCents - line.oldTotalCents, 0);
  return { newTotal: Math.max(0, originalTotal + diff), snapshot };
}

/**
 * Creates a price adjustment for an order of the butcher's shop, under the order lock: applied in
 * the same transaction (APPLY) or left PENDING, tier 3, until answerBy (ASK). A pending one past
 * its window is closed first (NO_ANSWER); one the customer may still answer is a conflict.
 */
export async function adjustOrderPrice(
  orderId: string,
  shop: { shopId: string; actorId: string },
  body: unknown,
  now: Date = new Date()
): Promise<AdjustPriceResult> {
  const parseResult = adjustPriceSchema.safeParse(body);
  if (!parseResult.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Données invalides",
      details: formatZodError(parseResult.error),
    };
  }
  const data = parseResult.data;
  const config = await getPriceAdjConfig();

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
    const existing = await tx.priceAdjustment.findUnique({
      where: { orderId },
      select: { id: true, status: true },
    });
    if (existing?.status === "PENDING") {
      return answer({
        ok: false,
        code: "CONFLICT",
        message: "Un ajustement est déjà en attente de la réponse du client",
      });
    }

    const items = await tx.orderItem.findMany({
      where: { orderId },
      select: {
        id: true,
        name: true,
        unit: true,
        quantity: true,
        weightGrams: true,
        priceCents: true,
        totalCents: true,
        available: true,
        estimatedPriceCents: true,
      },
    });
    const plan = planAdjustment(data, order.totalCents, items);
    if ("ok" in plan) return answer(plan);

    const maxAllowed = Math.round(order.totalCents * (1 + config.maxIncreasePct / 100));
    if (plan.newTotal > maxAllowed) {
      return answer({
        ok: false,
        code: "VALIDATION_ERROR",
        message: `L'ajustement ne peut pas dépasser +${config.maxIncreasePct} % du total actuel`,
      });
    }
    const decision = decideAdjustment({
      adjustmentType: data.adjustmentType,
      currentTotalCents: order.totalCents,
      newTotalCents: plan.newTotal,
      tolerance: frozenToleranceOf(order),
      lines: availableLinesAfter(items, plan.snapshot),
    });
    const applied = decision.decision === "APPLY";

    // One adjustment row per order: a settled or closed one is replaced by the new proposal.
    if (existing !== null) await tx.priceAdjustment.delete({ where: { id: existing.id } });
    const adjustment = await tx.priceAdjustment.create({
      data: {
        orderId,
        shopId: shop.shopId,
        originalTotal: order.totalCents,
        newTotal: plan.newTotal,
        reason: data.reason,
        adjustmentType: data.adjustmentType,
        status: "PENDING",
        // 1 = applied without asking, 3 = needs the customer's answer (never 2: see schema).
        tier: applied ? 1 : 3,
        answerBy: applied
          ? undefined
          : new Date(now.getTime() + ADJUSTMENT_ANSWER_WINDOW_SECONDS * 1000),
        itemsSnapshot:
          plan.snapshot.length > 0 ? (plan.snapshot as Prisma.InputJsonArray) : undefined,
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
  if (!result.ok) return result;
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
