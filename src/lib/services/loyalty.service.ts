// src/lib/services/loyalty.service.ts — Platform loyalty program logic
import prisma from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications";

// Default loyalty tiers (webmaster can override via LoyaltyProgram)
const DEFAULT_TIERS = [
  { minOrders: 3, rewardType: "FIXED", rewardCents: 200, label: "3 commandes → -2€" },
  { minOrders: 7, rewardType: "FIXED", rewardCents: 500, label: "7 commandes → -5€" },
  { minOrders: 15, rewardType: "FIXED", rewardCents: 1000, label: "15 commandes → -10€" },
];

type LoyaltyTier = {
  minOrders: number;
  rewardType: string;
  rewardCents?: number;
  rewardPercent?: number;
  label: string;
};

function generateRewardCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "KG-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Get current active loyalty tiers from DB or defaults.
 */
async function getActiveTiers(): Promise<LoyaltyTier[]> {
  const program = await prisma.loyaltyProgram.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  if (program && Array.isArray(program.tiers) && (program.tiers as LoyaltyTier[]).length > 0) {
    return program.tiers as LoyaltyTier[];
  }

  return DEFAULT_TIERS;
}

/**
 * Called after an order is PICKED_UP.
 * Increments user.totalOrders, checks for tier upgrade, creates reward if earned.
 */
export async function processLoyaltyOnPickup(userId: string, orderId: string): Promise<void> {
  try {
    // 1. Increment user.totalOrders + get current count
    const user = await prisma.user.update({
      where: { id: userId },
      data: { totalOrders: { increment: 1 } },
      select: { id: true, totalOrders: true, loyaltyTier: true, firstName: true },
    });

    const newCount = user.totalOrders;

    // 2. Get active tiers
    const tiers = await getActiveTiers();

    // 3. Check if a new tier is reached EXACTLY at this count
    const matchedTier = tiers.find((t) => t.minOrders === newCount);
    if (!matchedTier) return;

    // 4. Generate unique reward code
    let code = generateRewardCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.loyaltyReward.findUnique({ where: { code } });
      if (!existing) break;
      code = generateRewardCode();
      attempts++;
    }

    // 5. Create LoyaltyReward
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days validity

    await prisma.loyaltyReward.create({
      data: {
        userId,
        tier: matchedTier.minOrders,
        rewardType: matchedTier.rewardType,
        rewardCents: matchedTier.rewardCents || null,
        rewardPercent: matchedTier.rewardPercent || null,
        code,
        expiresAt,
      },
    });

    // 6. Update user.loyaltyTier + badge if 15+
    const updateData: Record<string, unknown> = { loyaltyTier: matchedTier.minOrders };
    if (newCount >= 15) {
      updateData.loyaltyBadge = "FIDELE";
    }
    await prisma.user.update({ where: { id: userId }, data: updateData });

    // 7. Notify client
    const rewardLabel = matchedTier.rewardCents
      ? `${(matchedTier.rewardCents / 100).toFixed(0)}€`
      : `${matchedTier.rewardPercent}%`;

    await sendNotification("LOYALTY_REWARD_EARNED", {
      userId,
      orderId,
      rewardCode: code,
      rewardAmount: rewardLabel,
      message: `Bravo ! ${matchedTier.minOrders} commandes → Votre bon de ${rewardLabel} : ${code}`,
    });
  } catch (error) {
    // Non-critical — don't fail the pickup flow
    console.error("[loyalty] processLoyaltyOnPickup error:", error);
  }
}

/**
 * Validate and apply a loyalty reward code.
 * Returns the discount in cents or null if invalid.
 */
export async function validateLoyaltyCode(
  code: string,
  userId: string,
  orderTotalCents: number
): Promise<{ valid: boolean; discountCents: number; rewardId: string; error?: string }> {
  const reward = await prisma.loyaltyReward.findUnique({ where: { code } });

  if (!reward) return { valid: false, discountCents: 0, rewardId: "", error: "Code invalide" };
  if (reward.userId !== userId) return { valid: false, discountCents: 0, rewardId: "", error: "Ce code ne vous appartient pas" };
  if (reward.usedAt) return { valid: false, discountCents: 0, rewardId: "", error: "Ce code a déjà été utilisé" };
  if (new Date() > reward.expiresAt) return { valid: false, discountCents: 0, rewardId: "", error: "Ce code a expiré" };

  let discountCents = 0;
  if (reward.rewardType === "FIXED" && reward.rewardCents) {
    discountCents = Math.min(reward.rewardCents, orderTotalCents);
  } else if (reward.rewardType === "PERCENT" && reward.rewardPercent) {
    discountCents = Math.round(orderTotalCents * (reward.rewardPercent / 100));
  }

  return { valid: true, discountCents, rewardId: reward.id };
}

/**
 * Mark a loyalty reward as used on an order.
 */
export async function markLoyaltyRewardUsed(rewardId: string, orderId: string): Promise<void> {
  await prisma.loyaltyReward.update({
    where: { id: rewardId },
    data: { usedAt: new Date(), usedOnOrderId: orderId },
  });
}

/**
 * Get user's loyalty status (for display in client UI).
 */
export async function getUserLoyaltyStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totalOrders: true, loyaltyTier: true, loyaltyBadge: true },
  });

  if (!user) return null;

  const tiers = await getActiveTiers();

  // Find next tier
  const nextTier = tiers
    .filter((t) => t.minOrders > user.totalOrders)
    .sort((a, b) => a.minOrders - b.minOrders)[0] || null;

  // Get available (unused, not expired) rewards
  const rewards = await prisma.loyaltyReward.findMany({
    where: {
      userId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: "asc" },
  });

  return {
    totalOrders: user.totalOrders,
    currentTier: user.loyaltyTier,
    badge: user.loyaltyBadge,
    nextTier: nextTier
      ? {
          minOrders: nextTier.minOrders,
          remaining: nextTier.minOrders - user.totalOrders,
          label: nextTier.label,
        }
      : null,
    rewards: rewards.map((r) => ({
      id: r.id,
      code: r.code,
      tier: r.tier,
      rewardType: r.rewardType,
      rewardCents: r.rewardCents,
      rewardPercent: r.rewardPercent,
      expiresAt: r.expiresAt.toISOString(),
    })),
    tiers: tiers.map((t) => ({
      ...t,
      reached: user.totalOrders >= t.minOrders,
    })),
  };
}
