// src/lib/cron-jobs.ts — node-cron jobs for Railway deployment
import cron from "node-cron";
import prisma from "@/lib/prisma";
import { checkAutoPause } from "@/lib/shop-status";
import { unsnoozeExpiredProducts } from "@/lib/product-snooze";
import { sendNotification } from "@/lib/notifications";

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

      // Find carts abandoned for 2h+ that haven't been reminded
      const abandonedCarts = await prisma.cart.findMany({
        where: {
          updatedAt: { lte: threshold },
          abandonedAt: null,
          items: { some: {} },
        },
        select: {
          id: true,
          userId: true,
          shopId: true,
          shop: { select: { name: true } },
          items: { select: { id: true } },
        },
      });

      if (abandonedCarts.length > 0) {
        // Mark as abandoned
        await prisma.cart.updateMany({
          where: { id: { in: abandonedCarts.map((c) => c.id) } },
          data: { abandonedAt: new Date() },
        });

        // Send multichannel notifications
        for (const cart of abandonedCarts) {
          await sendNotification("CART_ABANDONED", {
            userId: cart.userId,
            shopName: cart.shop.name,
            nbItems: cart.items.length,
          });
        }

        console.log(`[CRON][abandoned-carts] Marked ${abandonedCarts.length} carts as abandoned + sent reminders`);
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

      // Find expiring trials
      const expiredSubs = await prisma.subscription.findMany({
        where: {
          status: "TRIAL",
          trialEndsAt: { not: null, lte: now },
        },
        include: {
          shop: { select: { id: true, ownerId: true, name: true } },
        },
      });

      for (const sub of expiredSubs) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "EXPIRED" },
        });

        // Hide the shop
        await prisma.shop.update({
          where: { id: sub.shopId },
          data: { visible: false },
        });

        // Notify the boucher
        const owner = await prisma.user.findUnique({
          where: { clerkId: sub.shop.ownerId },
          select: { id: true },
        });
        if (owner) {
          await sendNotification("TRIAL_EXPIRING", {
            userId: owner.id,
            shopName: sub.shop.name,
            message: `Votre essai gratuit pour ${sub.shop.name} a expiré. Passez au paiement pour réactiver votre boutique.`,
          });
        }
      }

      // Send 7-day warning for trials expiring soon
      const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const sixDays = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);

      const warningSubs = await prisma.subscription.findMany({
        where: {
          status: "TRIAL",
          trialEndsAt: { gte: sixDays, lte: sevenDays },
        },
        include: {
          shop: { select: { ownerId: true, name: true } },
        },
      });

      for (const sub of warningSubs) {
        const owner = await prisma.user.findUnique({
          where: { clerkId: sub.shop.ownerId },
          select: { id: true },
        });
        if (owner) {
          await sendNotification("TRIAL_EXPIRING", {
            userId: owner.id,
            shopName: sub.shop.name,
            message: `Votre essai se termine dans 7 jours. Passez au paiement pour continuer à recevoir des commandes.`,
          });
        }
      }

      if (expiredSubs.length > 0) {
        console.log(`[CRON][trial-expiry] Expired ${expiredSubs.length} trial subscriptions`);
      }
      if (warningSubs.length > 0) {
        console.log(`[CRON][trial-expiry] Sent ${warningSubs.length} 7-day warnings`);
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

  // ═══════════════════════════════════════════
  // 9. Calendar alerts — daily at 9:00 AM
  // ═══════════════════════════════════════════
  cron.schedule("0 9 * * *", async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const events = await prisma.calendarEvent.findMany({
        where: { active: true },
      });

      for (const event of events) {
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === event.alertDaysBefore) {
          // Notify all bouchers
          const shops = await prisma.shop.findMany({
            where: { visible: true },
            select: { ownerId: true, name: true },
          });

          for (const shop of shops) {
            try {
              const owner = await prisma.user.findUnique({
                where: { clerkId: shop.ownerId },
                select: { id: true },
              });
              if (owner) {
                await sendNotification("CALENDAR_ALERT", {
                  userId: owner.id,
                  shopName: shop.name,
                  message: `${event.name} dans ${diffDays} jours ! Préparez vos stocks et vos produits saisonniers.`,
                });
              }
            } catch {
              // Continue with next shop
            }
          }

          console.log(`[CRON][calendar-alerts] Sent alerts for "${event.name}" (J-${diffDays})`);
        }
      }
    } catch (error) {
      console.error("[CRON][calendar-alerts] Error:", error);
    }
  });

  // ═══════════════════════════════════════════
  // 10. Recurring order reminders — daily at 8:00 AM
  // ═══════════════════════════════════════════
  cron.schedule("0 8 * * *", async () => {
    try {
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      const dueRecurring = await prisma.recurringOrder.findMany({
        where: {
          active: true,
          nextRunAt: { lte: today },
        },
        include: {
          user: { select: { id: true, firstName: true } },
        },
      });

      for (const rec of dueRecurring) {
        try {
          const shop = await prisma.shop.findUnique({
            where: { id: rec.shopId },
            select: { name: true },
          });

          // Send reminder notification (user must confirm)
          await sendNotification("RECURRING_REMINDER", {
            userId: rec.userId,
            shopName: shop?.name || "votre boucherie",
            message: `Votre commande récurrente chez ${shop?.name} est prête à être confirmée.`,
          });

          // Calculate next run date
          const freq = rec.frequency;
          const next = new Date(rec.nextRunAt || today);
          if (freq === "weekly") next.setDate(next.getDate() + 7);
          else if (freq === "biweekly") next.setDate(next.getDate() + 14);
          else if (freq === "monthly") next.setMonth(next.getMonth() + 1);

          await prisma.recurringOrder.update({
            where: { id: rec.id },
            data: { nextRunAt: next },
          });
        } catch {
          // Continue with next recurring order
        }
      }

      if (dueRecurring.length > 0) {
        console.log(`[CRON][recurring-orders] Sent ${dueRecurring.length} reminders`);
      }
    } catch (error) {
      console.error("[CRON][recurring-orders] Error:", error);
    }
  });

  console.log("[CRON] All cron jobs scheduled successfully");
}
