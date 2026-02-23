// src/lib/price-adjustment.ts — Auto-approve expired price adjustments (Approach A: read-time check)
import prisma from "@/lib/prisma";

/** Max increase percent allowed */
export const MAX_INCREASE_PCT = 10;

/**
 * Check if an order has a PENDING price adjustment that has expired.
 * If so, auto-approve it (update status + order total) and notify.
 * Called from any endpoint that reads an order.
 * Returns the updated PriceAdjustment or null.
 */
export async function autoApproveExpiredAdjustment(orderId: string) {
  const adjustment = await prisma.priceAdjustment.findUnique({
    where: { orderId },
  });

  if (!adjustment) return null;
  if (adjustment.status !== "PENDING") return null;
  if (!adjustment.autoApproveAt) return null;
  if (new Date() < new Date(adjustment.autoApproveAt)) return null;

  // Expired — auto-validate
  const [updatedAdj] = await prisma.$transaction([
    prisma.priceAdjustment.update({
      where: { id: adjustment.id },
      data: {
        status: "AUTO_VALIDATED",
        respondedAt: new Date(),
      },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { totalCents: adjustment.newTotal },
    }),
  ]);

  // Apply item-level changes from snapshot
  if (adjustment.itemsSnapshot && Array.isArray(adjustment.itemsSnapshot)) {
    for (const snap of adjustment.itemsSnapshot as Record<string, unknown>[]) {
      const updateData: Record<string, unknown> = {};
      if (snap.newWeightGrams) updateData.weightGrams = snap.newWeightGrams;
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

  // Fire-and-forget notification (lazy import to avoid circular deps)
  try {
    const { sendNotification } = await import("@/lib/notifications");
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        userId: true,
        orderNumber: true,
        shop: { select: { name: true } },
      },
    });
    if (order) {
      await sendNotification("PRICE_ADJUSTMENT_AUTO_VALIDATED" as never, {
        userId: order.userId,
        orderId,
        orderNumber: order.orderNumber,
        shopName: order.shop.name,
      });
    }
  } catch {
    // Notification failure should not block the read
  }

  return updatedAdj;
}
