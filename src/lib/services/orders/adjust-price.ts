// Order price adjustment service (3-tier system).
// Pure business logic — no Request/Response. Called from PATCH /api/orders/[id]/adjust-price.
// Tier 1 (≤10% / decrease) → AUTO_APPROVED; Tier 2 (≤20%) → PENDING auto-approve after Ns;
// Tier 3 (>20%) → PENDING client must approve, escalates to webmaster.
import { Prisma } from "@prisma/client";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications";
import { computeTier, getPriceAdjConfig } from "@/lib/price-adjustment";
import { formatZodError } from "@/lib/api/errors";

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
    .optional(),
  newTotalCents: z.number().int().min(0).optional(),
});

type AdjustPriceErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT";

export type AdjustPriceResult =
  | { ok: true; data: { adjustment: unknown; tier: 1 | 2 | 3; autoApproved: boolean } }
  | {
      ok: false;
      code: AdjustPriceErrorCode;
      message: string;
      details?: Record<string, string[]>;
    };

/**
 * Create a price adjustment for an order.
 *
 * @param orderId - Order id (from URL param)
 * @param shopId - Authenticated boucher's shop id (already verified upstream)
 * @param body - Raw JSON body
 */
export async function adjustOrderPrice(
  orderId: string,
  shopId: string,
  body: unknown
): Promise<AdjustPriceResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: { select: { unit: true } } } },
      shop: { select: { id: true, name: true, priceAdjustmentThreshold: true } },
      user: { select: { id: true } },
      priceAdjustment: true,
    },
  });

  if (!order) return { ok: false, code: "NOT_FOUND", message: "Commande introuvable" };
  if (order.shopId !== shopId) {
    return { ok: false, code: "FORBIDDEN", message: "Pas votre boucherie" };
  }

  if (order.status !== "ACCEPTED" && order.status !== "PREPARING") {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: `Ajustement impossible (statut: ${order.status})`,
    };
  }

  if (order.priceAdjustment && order.priceAdjustment.status === "PENDING") {
    return {
      ok: false,
      code: "CONFLICT",
      message: "Un ajustement est deja en attente pour cette commande",
    };
  }

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

  // ── Calculate new total ──
  const originalTotal = order.totalCents;
  let newTotal: number;
  const itemsSnapshot: Record<string, unknown>[] = [];

  if (data.adjustmentType === "MANUAL" && data.newTotalCents !== undefined) {
    newTotal = data.newTotalCents;
  } else if (data.items && data.items.length > 0) {
    let totalDiff = 0;

    for (const adj of data.items) {
      const item = order.items.find((i) => i.id === adj.orderItemId);
      if (!item) continue;

      let newItemTotal = item.totalCents;

      if (data.adjustmentType === "WEIGHT" && adj.newQuantity !== undefined) {
        newItemTotal = Math.round(item.priceCents * adj.newQuantity);
        itemsSnapshot.push({
          orderItemId: item.id,
          name: item.name,
          oldQuantity: item.quantity,
          newQuantity: adj.newQuantity,
          unit: item.unit,
          priceCents: item.priceCents,
          oldTotalCents: item.totalCents,
          newTotalCents: newItemTotal,
        });
      } else if (data.adjustmentType === "PRICE" && adj.newPriceCents !== undefined) {
        newItemTotal = Math.round(adj.newPriceCents * item.quantity);
        itemsSnapshot.push({
          orderItemId: item.id,
          name: item.name,
          oldPriceCents: item.priceCents,
          newPriceCents: adj.newPriceCents,
          quantity: item.quantity,
          oldTotalCents: item.totalCents,
          newTotalCents: newItemTotal,
        });
      }

      totalDiff += newItemTotal - item.totalCents;
    }

    newTotal = originalTotal + totalDiff;
  } else {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Donnees d'ajustement manquantes",
    };
  }

  // ── Hard cap safety net ──
  const maxAllowed = Math.round(originalTotal * (1 + config.maxIncreasePct / 100));
  if (newTotal > maxAllowed) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: `L'ajustement ne peut pas depasser ${config.maxIncreasePct}% du prix initial`,
    };
  }

  const tier = computeTier(originalTotal, newTotal, config.tier1MaxPct, config.tier2MaxPct);

  // ── Delete previous resolved adjustment if exists ──
  if (order.priceAdjustment && order.priceAdjustment.status !== "PENDING") {
    await prisma.priceAdjustment.delete({ where: { id: order.priceAdjustment.id } });
  }

  const applyItemChanges = async () => {
    if (!data.items) return;
    const itemUpdates = [];
    for (const adj of data.items) {
      const snap = itemsSnapshot.find(
        (s) => (s as { orderItemId: string }).orderItemId === adj.orderItemId
      );
      if (!snap) continue;
      const updateData: Record<string, unknown> = {};
      if (data.adjustmentType === "WEIGHT" && adj.newQuantity !== undefined) {
        updateData.quantity = adj.newQuantity;
        updateData.totalCents = (snap as { newTotalCents: number }).newTotalCents;
      } else if (data.adjustmentType === "PRICE" && adj.newPriceCents !== undefined) {
        updateData.priceCents = adj.newPriceCents;
        updateData.totalCents = (snap as { newTotalCents: number }).newTotalCents;
      }
      if (Object.keys(updateData).length > 0) {
        itemUpdates.push(
          prisma.orderItem.update({ where: { id: adj.orderItemId }, data: updateData })
        );
      }
    }
    if (itemUpdates.length > 0) await prisma.$transaction(itemUpdates);
  };

  const snapshotJson =
    itemsSnapshot.length > 0
      ? (itemsSnapshot as unknown as Prisma.InputJsonValue)
      : undefined;

  // ── TIER 1 — AUTO_APPROVED ──
  if (tier === 1) {
    const [adjustment] = await prisma.$transaction([
      prisma.priceAdjustment.create({
        data: {
          orderId,
          shopId: order.shop.id,
          originalTotal,
          newTotal,
          reason: data.reason,
          adjustmentType: data.adjustmentType,
          status: "AUTO_APPROVED",
          tier: 1,
          itemsSnapshot: snapshotJson,
          respondedAt: new Date(),
        },
      }),
      prisma.order.update({
        where: { id: orderId },
        data: { totalCents: newTotal },
      }),
    ]);

    await applyItemChanges();

    try {
      await sendNotification("PRICE_ADJUSTMENT_AUTO_APPROVED", {
        userId: order.user.id,
        orderId,
        orderNumber: order.orderNumber,
        shopName: order.shop.name,
        originalTotal,
        newTotal,
        tier: 1,
      });
    } catch {
      /* non-blocking */
    }

    return { ok: true, data: { adjustment, tier: 1, autoApproved: true } };
  }

  // ── TIER 2 — PENDING, auto-approve after Ns ──
  if (tier === 2) {
    const autoApproveAt = new Date(Date.now() + config.tier2AutoApproveSec * 1000);

    const adjustment = await prisma.priceAdjustment.create({
      data: {
        orderId,
        shopId: order.shop.id,
        originalTotal,
        newTotal,
        reason: data.reason,
        adjustmentType: data.adjustmentType,
        status: "PENDING",
        tier: 2,
        itemsSnapshot: snapshotJson,
        autoApproveAt,
      },
    });

    try {
      await sendNotification("PRICE_ADJUSTMENT_PENDING", {
        userId: order.user.id,
        orderId,
        orderNumber: order.orderNumber,
        shopName: order.shop.name,
        originalTotal,
        newTotal,
        tier: 2,
        autoApproveSeconds: config.tier2AutoApproveSec,
      });
    } catch {
      /* non-blocking */
    }

    return { ok: true, data: { adjustment, tier: 2, autoApproved: false } };
  }

  // ── TIER 3 — PENDING, client MUST approve, escalation after Nm ──
  const escalateAt = new Date(Date.now() + config.tier3EscalationMin * 60 * 1000);

  const adjustment = await prisma.priceAdjustment.create({
    data: {
      orderId,
      shopId: order.shop.id,
      originalTotal,
      newTotal,
      reason: data.reason,
      adjustmentType: data.adjustmentType,
      status: "PENDING",
      tier: 3,
      itemsSnapshot: snapshotJson,
      escalateAt,
    },
  });

  try {
    await sendNotification("PRICE_ADJUSTMENT_PENDING", {
      userId: order.user.id,
      orderId,
      orderNumber: order.orderNumber,
      shopName: order.shop.name,
      originalTotal,
      newTotal,
      tier: 3,
    });
  } catch {
    /* non-blocking */
  }

  return { ok: true, data: { adjustment, tier: 3, autoApproved: false } };
}
