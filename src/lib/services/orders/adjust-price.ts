// Order price adjustment service (3-tier system), for PATCH /api/orders/[id]/adjust-price.
// Tier 1 (decrease or small increase) is applied at once; tier 2 waits for the customer and is
// validated at its deadline; tier 3 needs the customer's answer and escalates to the webmaster.
// Lines are re-priced by src/lib/pricing/adjustment.ts; the adjustment is applied by
// adjustment-settlement.ts, the only writer of an adjusted total.
import type { OrderItem, PriceAdjustment, Prisma } from "@prisma/client";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications";
import { computeTier, getPriceAdjConfig } from "@/lib/price-adjustment";
import type { PriceAdjConfig } from "@/lib/price-adjustment-config";
import { formatZodError } from "@/lib/api/errors";
import { repriceLine, reweighLine, type AdjustedLine } from "@/lib/pricing/adjustment";
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
  | { ok: true; data: { adjustment: PriceAdjustment; tier: 1 | 2 | 3; autoApproved: boolean } }
  | Failure;

const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 10_000 } as const;

const LINE_REFUSALS: Record<Extract<AdjustedLine, { ok: false }>["reason"], string> = {
  QUANTITY_INVALID: "Quantité invalide : poids en grammes entiers, nombre entier pour les pièces",
  PRICE_INVALID: "Prix invalide",
  LINE_NOT_ADJUSTABLE: "Cette ligne ne peut pas être ajustée",
};

type AdjustableItem = Pick<
  OrderItem,
  "id" | "name" | "unit" | "quantity" | "weightGrams" | "priceCents" | "totalCents" | "available"
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
  if (changes.length === 0)
    return { ok: false, code: "VALIDATION_ERROR", message: "Donnees d'ajustement manquantes" };
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
    if (adjusted === null)
      return { ok: false, code: "VALIDATION_ERROR", message: "Donnees d'ajustement manquantes" };
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

function deadlines(tier: 1 | 2 | 3, config: PriceAdjConfig, now: Date) {
  if (tier === 2)
    return { autoApproveAt: new Date(now.getTime() + config.tier2AutoApproveSec * 1000) };
  if (tier === 3)
    return { escalateAt: new Date(now.getTime() + config.tier3EscalationMin * 60_000) };
  return {};
}

/**
 * Creates a price adjustment for an order of the butcher's shop; tier 1 is applied in the same
 * transaction. The order is locked first: no transition can change it in between.
 */
export async function adjustOrderPrice(
  orderId: string,
  shopId: string,
  body: unknown,
  now: Date = new Date()
): Promise<AdjustPriceResult> {
  const parseResult = adjustPriceSchema.safeParse(body);
  if (!parseResult.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Donnees invalides",
      details: formatZodError(parseResult.error),
    };
  }
  const data = parseResult.data;
  const config = await getPriceAdjConfig();

  const result = await prisma.$transaction(async (tx): Promise<AdjustPriceResult> => {
    const order = await lockOrderForAdjustment(tx, orderId, { shopId });
    if (order === null) return { ok: false, code: "NOT_FOUND", message: "Commande introuvable" };
    if (!ADJUSTMENT_CREATION_STATUSES.includes(order.status)) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: `Ajustement impossible (statut: ${order.status})`,
      };
    }
    const existing = await tx.priceAdjustment.findUnique({
      where: { orderId },
      select: { id: true, status: true },
    });
    if (existing?.status === "PENDING") {
      return {
        ok: false,
        code: "CONFLICT",
        message: "Un ajustement est deja en attente pour cette commande",
      };
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
      },
    });
    const plan = planAdjustment(data, order.totalCents, items);
    if ("ok" in plan) return plan;

    const maxAllowed = Math.round(order.totalCents * (1 + config.maxIncreasePct / 100));
    if (plan.newTotal > maxAllowed) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: `L'ajustement ne peut pas depasser ${config.maxIncreasePct}% du prix initial`,
      };
    }
    const tier = computeTier(
      order.totalCents,
      plan.newTotal,
      config.tier1MaxPct,
      config.tier2MaxPct
    ) as 1 | 2 | 3;

    // One adjustment row per order: a settled one is replaced by the new proposal.
    if (existing !== null) await tx.priceAdjustment.delete({ where: { id: existing.id } });
    const adjustment = await tx.priceAdjustment.create({
      data: {
        orderId,
        shopId,
        originalTotal: order.totalCents,
        newTotal: plan.newTotal,
        reason: data.reason,
        adjustmentType: data.adjustmentType,
        status: "PENDING",
        tier,
        itemsSnapshot:
          plan.snapshot.length > 0 ? (plan.snapshot as Prisma.InputJsonArray) : undefined,
        ...deadlines(tier, config, now),
      },
    });
    if (tier !== 1) return { ok: true, data: { adjustment, tier, autoApproved: false } };

    const settled = await settleAdjustmentInTx(tx, {
      orderId,
      scope: { shopId },
      settledAs: "AUTO_APPROVED",
      now,
    });
    if (settled.kind !== "settled")
      throw new Error(`Tier-1 adjustment of order ${orderId} not applied: ${settled.kind}`);
    return { ok: true, data: { adjustment: settled.adjustment, tier: 1, autoApproved: true } };
  }, TRANSACTION_OPTIONS);
  if (!result.ok) return result;

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { userId: true, orderNumber: true, shop: { select: { name: true } } },
  });
  const { adjustment, tier } = result.data;
  await sendNotification(
    tier === 1 ? "PRICE_ADJUSTMENT_AUTO_APPROVED" : "PRICE_ADJUSTMENT_PENDING",
    {
      userId: order.userId,
      orderId,
      orderNumber: order.orderNumber,
      shopName: order.shop.name,
      originalTotal: adjustment.originalTotal,
      newTotal: adjustment.newTotal,
      tier,
      ...(tier === 2 && { autoApproveSeconds: config.tier2AutoApproveSec }),
    }
  );
  return result;
}
