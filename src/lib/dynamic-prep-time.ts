// src/lib/dynamic-prep-time.ts — Dynamic prep time calculation (Uber Eats style)
import prisma from "@/lib/prisma";

type PrepTimeParams = {
  shopId: string;
  basePrepMin: number;
  busyMode: boolean;
  busyExtraMin: number;
  itemCount: number;
};

/**
 * Calculate dynamic prep time based on active orders + item count.
 * Mimics Uber Eats algorithm: base + busy + queue + complexity
 */
export async function calculatePrepTime(params: PrepTimeParams): Promise<number> {
  const { shopId, basePrepMin, busyMode, busyExtraMin, itemCount } = params;

  // Count active orders (not yet picked up)
  const activeOrders = await prisma.order.count({
    where: {
      shopId,
      status: { in: ["ACCEPTED", "PREPARING"] },
    },
  });

  let prepTime = basePrepMin;

  // Add busy mode extra time
  if (busyMode) {
    prepTime += busyExtraMin;
  }

  // Queue factor: +3 min per active order
  prepTime += activeOrders * 3;

  // Complexity factor: +2 min per 5 items beyond 3
  if (itemCount > 3) {
    prepTime += Math.ceil((itemCount - 3) / 5) * 2;
  }

  // Cap at 120 min
  return Math.min(prepTime, 120);
}

/**
 * Get estimated ready time from now.
 */
export async function getEstimatedReady(params: PrepTimeParams): Promise<Date> {
  const minutes = await calculatePrepTime(params);
  return new Date(Date.now() + minutes * 60_000);
}
