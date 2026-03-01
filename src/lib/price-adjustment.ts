// src/lib/price-adjustment.ts — 3-tier price adjustment system (server-only)
import prisma from "@/lib/prisma";
import {
  TIER_1_MAX as _T1,
  TIER_2_MAX as _T2,
} from "@/lib/price-adjustment-config";

// Re-export constants from client-safe config
export {
  TIER_1_MAX,
  TIER_2_MAX,
  TIER_2_AUTO_APPROVE_SEC,
  TIER_3_ESCALATION_MIN,
  MAX_INCREASE_PCT,
} from "@/lib/price-adjustment-config";

/**
 * Compute the tier (1, 2 or 3) for a price adjustment.
 * Price decreases always get tier 1 (auto-approved).
 */
export function computeTier(originalTotal: number, newTotal: number): number {
  if (newTotal <= originalTotal) return 1; // Price decrease → always tier 1
  const pct = originalTotal > 0 ? ((newTotal - originalTotal) / originalTotal) * 100 : 0;
  if (pct <= _T1) return 1;
  if (pct <= _T2) return 2;
  return 3;
}

/**
 * Check if an order has a PENDING price adjustment that has expired.
 * Handles tier 2 (auto-approve after 30s) and tier 3 (escalate after 10 min).
 * Called from any endpoint that reads an order.
 */
export async function autoApproveExpiredAdjustment(orderId: string) {
  const adjustment = await prisma.priceAdjustment.findUnique({
    where: { orderId },
  });

  if (!adjustment) return null;
  if (adjustment.status !== "PENDING") return null;

  const now = new Date();

  // ── Tier 2: auto-approve after 30s ──
  if (adjustment.tier === 2 && adjustment.autoApproveAt && now >= new Date(adjustment.autoApproveAt)) {
    const [updatedAdj] = await prisma.$transaction([
      prisma.priceAdjustment.update({
        where: { id: adjustment.id },
        data: { status: "AUTO_VALIDATED", respondedAt: now },
      }),
      prisma.order.update({
        where: { id: orderId },
        data: { totalCents: adjustment.newTotal },
      }),
    ]);

    // Apply item-level changes
    await applyItemSnapshot(adjustment.itemsSnapshot);

    // Notify client
    try {
      const { sendNotification } = await import("@/lib/notifications");
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { userId: true, orderNumber: true, shop: { select: { name: true } } },
      });
      if (order) {
        await sendNotification("PRICE_ADJUSTMENT_AUTO_VALIDATED", {
          userId: order.userId,
          orderId,
          orderNumber: order.orderNumber,
          shopName: order.shop.name,
        });
      }
    } catch { /* non-blocking */ }

    return updatedAdj;
  }

  // ── Tier 3: escalate after 10 min (no auto-approve) ──
  if (adjustment.tier === 3 && adjustment.escalateAt && now >= new Date(adjustment.escalateAt)) {
    const updatedAdj = await prisma.priceAdjustment.update({
      where: { id: adjustment.id },
      data: { status: "ESCALATED", respondedAt: now },
    });

    // Notify webmaster/admin
    try {
      const { sendNotification } = await import("@/lib/notifications");
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          orderNumber: true,
          userId: true,
          shop: { select: { name: true } },
        },
      });
      if (order) {
        await sendNotification("PRICE_ADJUSTMENT_ESCALATED", {
          orderId,
          orderNumber: order.orderNumber,
          shopName: order.shop.name,
          originalTotal: adjustment.originalTotal,
          newTotal: adjustment.newTotal,
          tier: 3,
        });
      }
    } catch { /* non-blocking */ }

    return updatedAdj;
  }

  return null;
}

/**
 * Apply item-level changes from a snapshot JSON.
 */
async function applyItemSnapshot(itemsSnapshot: unknown) {
  if (!itemsSnapshot || !Array.isArray(itemsSnapshot)) return;
  for (const snap of itemsSnapshot as Record<string, unknown>[]) {
    const updateData: Record<string, unknown> = {};
    if (snap.newQuantity !== undefined) updateData.quantity = snap.newQuantity;
    if (snap.newPriceCents !== undefined) updateData.priceCents = snap.newPriceCents;
    if (snap.newTotalCents !== undefined) updateData.totalCents = snap.newTotalCents;
    if (Object.keys(updateData).length > 0 && snap.orderItemId) {
      await prisma.orderItem.update({
        where: { id: snap.orderItemId as string },
        data: updateData,
      });
    }
  }
}
