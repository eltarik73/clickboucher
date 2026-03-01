export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";
import {
  MAX_INCREASE_PCT,
  computeTier,
  TIER_2_AUTO_APPROVE_SEC,
  TIER_3_ESCALATION_MIN,
} from "@/lib/price-adjustment";
import { Prisma } from "@prisma/client";
import { z } from "zod";

// ── Validation schema ──
const adjustPriceSchema = z.object({
  adjustmentType: z.enum(["WEIGHT", "PRICE", "MANUAL"]),
  reason: z.string().max(500).optional(),
  items: z.array(z.object({
    orderItemId: z.string().min(1),
    newQuantity: z.number().min(0).optional(),
    newPriceCents: z.number().int().min(0).optional(),
  })).optional(),
  newTotalCents: z.number().int().min(0).optional(),
});

// ── PATCH /api/orders/[id]/adjust-price ──
// Boucher creates a price adjustment (3-tier system)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: orderId } = params;
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: { select: { unit: true } } } },
        shop: { select: { id: true, name: true, priceAdjustmentThreshold: true } },
        user: { select: { id: true } },
        priceAdjustment: true,
      },
    });

    if (!order) return apiError("NOT_FOUND", "Commande introuvable");
    if (order.shopId !== shopId) return apiError("FORBIDDEN", "Pas votre boucherie");

    if (order.status !== "ACCEPTED" && order.status !== "PREPARING") {
      return apiError("VALIDATION_ERROR", `Ajustement impossible (statut: ${order.status})`);
    }

    if (order.priceAdjustment && order.priceAdjustment.status === "PENDING") {
      return apiError("CONFLICT", "Un ajustement est deja en attente pour cette commande");
    }

    const body = await req.json();
    const data = adjustPriceSchema.parse(body);

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
      return apiError("VALIDATION_ERROR", "Donnees d'ajustement manquantes");
    }

    // ── Hard cap safety net ──
    const maxAllowed = Math.round(originalTotal * (1 + MAX_INCREASE_PCT / 100));
    if (newTotal > maxAllowed) {
      return apiError("VALIDATION_ERROR",
        `L'ajustement ne peut pas depasser ${MAX_INCREASE_PCT}% du prix initial`
      );
    }

    // ── Compute tier ──
    const tier = computeTier(originalTotal, newTotal);

    // ── Delete previous resolved adjustment if exists ──
    if (order.priceAdjustment && order.priceAdjustment.status !== "PENDING") {
      await prisma.priceAdjustment.delete({ where: { id: order.priceAdjustment.id } });
    }

    // Helper: apply item-level changes immediately
    const applyItemChanges = async () => {
      if (!data.items) return;
      for (const adj of data.items) {
        const snap = itemsSnapshot.find((s) => (s as { orderItemId: string }).orderItemId === adj.orderItemId);
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
          await prisma.orderItem.update({ where: { id: adj.orderItemId }, data: updateData });
        }
      }
    };

    const snapshotJson = itemsSnapshot.length > 0
      ? (itemsSnapshot as unknown as Prisma.InputJsonValue)
      : undefined;

    // ═══════════════════════════════════════════
    // TIER 1 (≤10% or price decrease) — AUTO_APPROVED immediately
    // ═══════════════════════════════════════════
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
      } catch { /* non-blocking */ }

      return apiSuccess({ adjustment, tier: 1, autoApproved: true });
    }

    // ═══════════════════════════════════════════
    // TIER 2 (10-20%) — PENDING, auto-approved after 30s, client can refuse
    // ═══════════════════════════════════════════
    if (tier === 2) {
      const autoApproveAt = new Date(Date.now() + TIER_2_AUTO_APPROVE_SEC * 1000);

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
          autoApproveSeconds: TIER_2_AUTO_APPROVE_SEC,
        });
      } catch { /* non-blocking */ }

      return apiSuccess({ adjustment, tier: 2, autoApproved: false });
    }

    // ═══════════════════════════════════════════
    // TIER 3 (>20%) — PENDING, client MUST approve, escalation after 10 min
    // ═══════════════════════════════════════════
    const escalateAt = new Date(Date.now() + TIER_3_ESCALATION_MIN * 60 * 1000);

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
        // No autoApproveAt — client must approve
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
    } catch { /* non-blocking */ }

    return apiSuccess({ adjustment, tier: 3, autoApproved: false });
  } catch (error) {
    return handleApiError(error, "orders/adjust-price");
  }
}
