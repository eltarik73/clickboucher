// src/lib/cron-jobs.ts — node-cron jobs for Railway deployment
import cron from "node-cron";
import prisma from "@/lib/prisma";
import { checkAutoPause } from "@/lib/shop-status";
import { unsnoozeExpiredProducts } from "@/lib/product-snooze";

let started = false;

export function startCronJobs() {
  if (started) return;
  started = true;

  console.log("[CRON] Starting cron jobs...");

  // ═══════════════════════════════════════════
  // 1. Auto-cancel expired pending orders — every minute
  // ═══════════════════════════════════════════
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const expiredOrders = await prisma.order.findMany({
        where: {
          status: "PENDING",
          expiresAt: { not: null, lte: now },
        },
        select: { id: true, shopId: true, orderNumber: true },
      });

      for (const order of expiredOrders) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: "AUTO_CANCELLED", autoCancelledAt: now },
        });
        await checkAutoPause(order.shopId);
      }

      if (expiredOrders.length > 0) {
        console.log(`[CRON][auto-cancel] Cancelled ${expiredOrders.length} expired orders`);
      }
    } catch (error) {
      console.error("[CRON][auto-cancel] Error:", error);
    }
  });

  // ═══════════════════════════════════════════
  // 2. Unsnooze expired products — every 5 minutes
  // ═══════════════════════════════════════════
  cron.schedule("*/5 * * * *", async () => {
    try {
      const count = await unsnoozeExpiredProducts();
      if (count > 0) {
        console.log(`[CRON][unsnooze] Unsnoozed ${count} products`);
      }
    } catch (error) {
      console.error("[CRON][unsnooze] Error:", error);
    }
  });

  // ═══════════════════════════════════════════
  // 3. Expire promos — every hour
  // ═══════════════════════════════════════════
  cron.schedule("0 * * * *", async () => {
    try {
      const result = await prisma.product.updateMany({
        where: {
          promoEnd: { lt: new Date() },
          promoPct: { not: null },
        },
        data: {
          promoPct: null,
          promoType: null,
          promoEnd: null,
        },
      });

      if (result.count > 0) {
        console.log(`[CRON][expire-promos] Expired ${result.count} promos`);
      }
    } catch (error) {
      console.error("[CRON][expire-promos] Error:", error);
    }
  });

  // ═══════════════════════════════════════════
  // 4. Abandoned cart reminders — every 30 minutes
  // ═══════════════════════════════════════════
  cron.schedule("*/30 * * * *", async () => {
    try {
      const threshold = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

      // Mark carts as abandoned if not updated in 2h and have items
      const abandoned = await prisma.cart.updateMany({
        where: {
          updatedAt: { lte: threshold },
          abandonedAt: null,
          items: { some: {} },
        },
        data: { abandonedAt: new Date() },
      });

      if (abandoned.count > 0) {
        console.log(`[CRON][abandoned-carts] Marked ${abandoned.count} carts as abandoned`);
      }
    } catch (error) {
      console.error("[CRON][abandoned-carts] Error:", error);
    }
  });

  // ═══════════════════════════════════════════
  // 5. Auto-close vacation mode — every hour
  // ═══════════════════════════════════════════
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();
      const result = await prisma.shop.updateMany({
        where: {
          vacationMode: true,
          vacationEnd: { not: null, lte: now },
        },
        data: {
          vacationMode: false,
          status: "OPEN",
          vacationStart: null,
          vacationEnd: null,
          vacationMessage: null,
        },
      });

      if (result.count > 0) {
        console.log(`[CRON][vacation-end] Reopened ${result.count} shops after vacation`);
      }
    } catch (error) {
      console.error("[CRON][vacation-end] Error:", error);
    }
  });

  // ═══════════════════════════════════════════
  // 6. Auto-end busy mode — every minute
  // ═══════════════════════════════════════════
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const result = await prisma.shop.updateMany({
        where: {
          busyMode: true,
          busyModeEndsAt: { not: null, lte: now },
        },
        data: {
          busyMode: false,
          busyModeEndsAt: null,
          status: "OPEN",
        },
      });

      if (result.count > 0) {
        console.log(`[CRON][busy-end] Reset ${result.count} shops from busy mode`);
      }
    } catch (error) {
      console.error("[CRON][busy-end] Error:", error);
    }
  });

  // ═══════════════════════════════════════════
  // 7. Trial expiry check — daily at 2:00 AM
  // ═══════════════════════════════════════════
  cron.schedule("0 2 * * *", async () => {
    try {
      const now = new Date();
      const result = await prisma.subscription.updateMany({
        where: {
          status: "TRIAL",
          trialEndsAt: { not: null, lte: now },
        },
        data: { status: "EXPIRED" },
      });

      if (result.count > 0) {
        console.log(`[CRON][trial-expiry] Expired ${result.count} trial subscriptions`);
      }
    } catch (error) {
      console.error("[CRON][trial-expiry] Error:", error);
    }
  });

  // ═══════════════════════════════════════════
  // 8. Weekly stats report log — every Monday at 8:00 AM
  // ═══════════════════════════════════════════
  cron.schedule("0 8 * * 1", async () => {
    try {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [orders, revenue, newUsers, newShops] = await Promise.all([
        prisma.order.count({ where: { createdAt: { gte: weekAgo } } }),
        prisma.order.aggregate({
          where: { status: { in: ["COMPLETED", "PICKED_UP"] }, createdAt: { gte: weekAgo } },
          _sum: { totalCents: true },
        }),
        prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
        prisma.shop.count({ where: { createdAt: { gte: weekAgo } } }),
      ]);

      console.log(
        `[CRON][weekly-report] Week summary: ${orders} orders, ${((revenue._sum.totalCents || 0) / 100).toFixed(2)}€ revenue, ${newUsers} new users, ${newShops} new shops`
      );
    } catch (error) {
      console.error("[CRON][weekly-report] Error:", error);
    }
  });

  console.log("[CRON] All cron jobs scheduled successfully");
}
