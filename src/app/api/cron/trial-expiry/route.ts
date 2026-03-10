import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";
import { verifyCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) return apiError("UNAUTHORIZED", "Invalid cron secret");

    const now = new Date();

    // Expire trials
    const expiredSubs = await prisma.subscription.findMany({
      where: { status: "TRIAL", trialEndsAt: { not: null, lte: now } },
      include: { shop: { select: { id: true, ownerId: true, name: true } } },
    });

    // 7-day warnings
    const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const sixDays = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);

    const warningSubs = await prisma.subscription.findMany({
      where: { status: "TRIAL", trialEndsAt: { gte: sixDays, lte: sevenDays } },
      include: { shop: { select: { ownerId: true, name: true } } },
    });

    // Batch fetch ALL owners at once (instead of N queries)
    const allOwnerIds = [
      ...expiredSubs.map(s => s.shop.ownerId),
      ...warningSubs.map(s => s.shop.ownerId),
    ].filter(Boolean);
    const uniqueOwnerIds = [...new Set(allOwnerIds)];

    const owners = uniqueOwnerIds.length > 0
      ? await prisma.user.findMany({
          where: { OR: [{ clerkId: { in: uniqueOwnerIds } }, { id: { in: uniqueOwnerIds } }] },
          select: { id: true, clerkId: true },
        })
      : [];
    const ownerMap = new Map<string, string>();
    for (const u of owners) {
      ownerMap.set(u.clerkId, u.id);
      ownerMap.set(u.id, u.id);
    }

    // Process expired subs
    for (const sub of expiredSubs) {
      await prisma.$transaction([
        prisma.subscription.update({ where: { id: sub.id }, data: { status: "EXPIRED" } }),
        prisma.shop.update({ where: { id: sub.shopId }, data: { visible: false } }),
      ]);

      const ownerId = ownerMap.get(sub.shop.ownerId);
      if (ownerId) {
        await sendNotification("TRIAL_EXPIRING", {
          userId: ownerId,
          shopName: sub.shop.name,
          message: `Votre essai gratuit pour ${sub.shop.name} a expiré.`,
        });
      }
    }

    // Process warning subs
    for (const sub of warningSubs) {
      const ownerId = ownerMap.get(sub.shop.ownerId);
      if (ownerId) {
        await sendNotification("TRIAL_EXPIRING", {
          userId: ownerId,
          shopName: sub.shop.name,
          message: `Votre essai se termine dans 7 jours.`,
        });
      }
    }

    return apiSuccess({
      expiredCount: expiredSubs.length,
      warningCount: warningSubs.length,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    return handleApiError(error, "cron/trial-expiry");
  }
}
