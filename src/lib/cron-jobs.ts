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

      if (expiredOrders.length > 0) {
        // Batch update all expired orders at once
        await prisma.order.updateMany({
          where: { id: { in: expiredOrders.map(o => o.id) } },
          data: { status: "AUTO_CANCELLED", autoCancelledAt: now },
        });
        // Check auto-pause for each unique shop
        const uniqueShopIds = [...new Set(expiredOrders.map(o => o.shopId))];
        for (const shopId of uniqueShopIds) {
          await checkAutoPause(shopId);
        }
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
  // 5. Ready reminder — every 5 minutes
  //    Remind customers who haven't picked up after 30 min
  // ═══════════════════════════════════════════
  cron.schedule("*/5 * * * *", async () => {
    try {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      // Find orders READY for 30+ min that haven't been reminded yet
      const readyOrders = await prisma.order.findMany({
        where: {
          status: "READY",
          actualReady: { not: null, lte: thirtyMinAgo, gte: twoHoursAgo },
        },
        select: {
          id: true,
          orderNumber: true,
          userId: true,
          notifSent: true,
          shop: { select: { name: true } },
        },
      });

      let sentCount = 0;
      for (const order of readyOrders) {
        // Check if READY_REMINDER was already sent for this order
        const existing = Array.isArray(order.notifSent) ? order.notifSent : [];
        const alreadyReminded = existing.some(
          (entry) => typeof entry === "object" && entry !== null && (entry as Record<string, unknown>).event === "READY_REMINDER"
        );
        if (alreadyReminded) continue;

        await sendNotification("READY_REMINDER", {
          userId: order.userId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          shopName: order.shop.name,
        });
        sentCount++;
      }

      if (sentCount > 0) {
        console.log(`[CRON][ready-reminder] Sent ${sentCount} pickup reminders`);
      }
    } catch (error) {
      console.error("[CRON][ready-reminder] Error:", error);
    }
  });

  // ═══════════════════════════════════════════
  // 6. Auto-close vacation mode — every hour
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

      // Batch fetch ALL owners at once (instead of N queries)
      const allOwnerIds = [
        ...expiredSubs.map(s => s.shop.ownerId),
        ...warningSubs.map(s => s.shop.ownerId),
      ].filter(Boolean);
      const uniqueOwnerIds = [...new Set(allOwnerIds)];
      const owners = uniqueOwnerIds.length > 0
        ? await prisma.user.findMany({
            where: { clerkId: { in: uniqueOwnerIds } },
            select: { id: true, clerkId: true },
          })
        : [];
      const ownerMap = new Map(owners.map(u => [u.clerkId, u.id]));

      // Batch update expired subs + hide shops
      if (expiredSubs.length > 0) {
        await prisma.$transaction([
          prisma.subscription.updateMany({
            where: { id: { in: expiredSubs.map(s => s.id) } },
            data: { status: "EXPIRED" },
          }),
          prisma.shop.updateMany({
            where: { id: { in: expiredSubs.map(s => s.shopId) } },
            data: { visible: false },
          }),
        ]);
      }

      // Notify expired owners
      for (const sub of expiredSubs) {
        const ownerId = ownerMap.get(sub.shop.ownerId);
        if (ownerId) {
          await sendNotification("TRIAL_EXPIRING", {
            userId: ownerId,
            shopName: sub.shop.name,
            message: `Votre essai gratuit pour ${sub.shop.name} a expiré. Passez au paiement pour réactiver votre boutique.`,
          });
        }
      }

      // Notify warning owners
      for (const sub of warningSubs) {
        const ownerId = ownerMap.get(sub.shop.ownerId);
        if (ownerId) {
          await sendNotification("TRIAL_EXPIRING", {
            userId: ownerId,
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
  // 8. Weekly stats report — every Monday at 9:00 AM
  //    Sends per-shop report via notifications
  // ═══════════════════════════════════════════
  cron.schedule("0 9 * * 1", async () => {
    try {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Global log
      const [globalOrders, globalRevenue, newUsers, newShops] = await Promise.all([
        prisma.order.count({ where: { createdAt: { gte: weekAgo } } }),
        prisma.order.aggregate({
          where: { status: { in: ["COMPLETED", "PICKED_UP"] }, createdAt: { gte: weekAgo } },
          _sum: { totalCents: true },
        }),
        prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
        prisma.shop.count({ where: { createdAt: { gte: weekAgo } } }),
      ]);

      console.log(
        `[CRON][weekly-report] Global: ${globalOrders} orders, ${((globalRevenue._sum.totalCents || 0) / 100).toFixed(2)}€, ${newUsers} users, ${newShops} shops`
      );

      // Per-shop reports
      const shops = await prisma.shop.findMany({
        where: { visible: true },
        select: { id: true, name: true, ownerId: true, rating: true },
      });

      const shopIds = shops.map(s => s.id);
      let sentCount = 0;

      // Batch: order stats + revenue stats + item data + owners (instead of 4*N queries)
      const [orderStats, revenueStats, allItems] = await Promise.all([
        prisma.order.groupBy({
          by: ["shopId"],
          where: { shopId: { in: shopIds }, status: { in: ["COMPLETED", "PICKED_UP"] }, createdAt: { gte: weekAgo } },
          _count: true,
        }),
        prisma.order.groupBy({
          by: ["shopId"],
          where: { shopId: { in: shopIds }, status: { in: ["COMPLETED", "PICKED_UP"] }, createdAt: { gte: weekAgo } },
          _sum: { totalCents: true },
        }),
        prisma.orderItem.findMany({
          where: { order: { shopId: { in: shopIds }, status: { in: ["COMPLETED", "PICKED_UP"] }, createdAt: { gte: weekAgo } } },
          select: { name: true, totalCents: true, order: { select: { shopId: true } } },
        }),
      ]);

      const countMap = new Map(orderStats.map(c => [c.shopId, c._count]));
      const revenueMap = new Map(revenueStats.map(r => [r.shopId, r._sum.totalCents || 0]));

      // Compute top product per shop in JS
      const productTotals = new Map<string, Map<string, number>>();
      for (const item of allItems) {
        const sid = item.order.shopId;
        if (!productTotals.has(sid)) productTotals.set(sid, new Map());
        const shopMap = productTotals.get(sid)!;
        shopMap.set(item.name, (shopMap.get(item.name) || 0) + item.totalCents);
      }
      const topByShop = new Map<string, string>();
      for (const [sid, map] of productTotals) {
        const top = [...map.entries()].sort((a, b) => b[1] - a[1])[0];
        if (top) topByShop.set(sid, top[0]);
      }

      // Batch fetch owners
      const ownerIds = [...new Set(shops.map(s => s.ownerId).filter(Boolean))];
      const owners = ownerIds.length > 0
        ? await prisma.user.findMany({
            where: { clerkId: { in: ownerIds } },
            select: { id: true, clerkId: true },
          })
        : [];
      const ownerMap = new Map(owners.map(u => [u.clerkId, u.id]));

      for (const shop of shops) {
        try {
          const weeklyOrders = countMap.get(shop.id) || 0;
          const weeklyRevenue = revenueMap.get(shop.id) || 0;
          const weeklyAvgOrder = weeklyOrders > 0 ? Math.round(weeklyRevenue / weeklyOrders) : 0;
          const topProduct = topByShop.get(shop.id);

          const ownerId = ownerMap.get(shop.ownerId);
          if (ownerId) {
            await sendNotification("WEEKLY_REPORT", {
              userId: ownerId,
              shopName: shop.name,
              weeklyRevenue,
              weeklyOrders,
              weeklyAvgOrder,
              weeklyRating: shop.rating,
              weeklyTopProduct: topProduct,
            });
            sentCount++;
          }
        } catch {
          // Continue with next shop
        }
      }

      console.log(`[CRON][weekly-report] Sent ${sentCount} per-shop reports`);
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

      // Hoist shop + owner queries OUTSIDE the event loop
      const shops = await prisma.shop.findMany({
        where: { visible: true },
        select: { ownerId: true, name: true },
      });
      const calOwnerIds = [...new Set(shops.map(s => s.ownerId).filter(Boolean))];
      const calOwners = calOwnerIds.length > 0
        ? await prisma.user.findMany({
            where: { clerkId: { in: calOwnerIds } },
            select: { id: true, clerkId: true },
          })
        : [];
      const calOwnerMap = new Map(calOwners.map(u => [u.clerkId, u.id]));

      for (const event of events) {
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === event.alertDaysBefore) {
          for (const shop of shops) {
            try {
              const ownerId = calOwnerMap.get(shop.ownerId);
              if (ownerId) {
                await sendNotification("CALENDAR_ALERT", {
                  userId: ownerId,
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
          shop: { select: { name: true } }, // Include shop to avoid N+1
        },
      });

      const nextRunUpdates: { id: string; nextRunAt: Date }[] = [];

      for (const rec of dueRecurring) {
        try {
          await sendNotification("RECURRING_REMINDER", {
            userId: rec.userId,
            shopName: rec.shop?.name || "votre boucherie",
            message: `Votre commande récurrente chez ${rec.shop?.name} est prête à être confirmée.`,
          });

          const freq = rec.frequency;
          const next = new Date(rec.nextRunAt || today);
          if (freq === "WEEKLY") next.setDate(next.getDate() + 7);
          else if (freq === "BIWEEKLY") next.setDate(next.getDate() + 14);
          else if (freq === "MONTHLY") next.setMonth(next.getMonth() + 1);

          nextRunUpdates.push({ id: rec.id, nextRunAt: next });
        } catch {
          // Continue with next recurring order
        }
      }

      // Batch update nextRunAt via $transaction
      if (nextRunUpdates.length > 0) {
        await prisma.$transaction(
          nextRunUpdates.map(u =>
            prisma.recurringOrder.update({
              where: { id: u.id },
              data: { nextRunAt: u.nextRunAt },
            })
          )
        );
      }

      if (dueRecurring.length > 0) {
        console.log(`[CRON][recurring-orders] Sent ${dueRecurring.length} reminders`);
      }
    } catch (error) {
      console.error("[CRON][recurring-orders] Error:", error);
    }
  });

  // ═══════════════════════════════════════════
  // 11. Off-peak auto promos — every hour (PREMIUM only)
  //     Applies -10% on featured products during off-peak hours
  // ═══════════════════════════════════════════
  cron.schedule("0 * * * *", async () => {
    try {
      const currentHour = new Date().getHours();

      // Find PREMIUM shops with auto-promos enabled
      const premiumFeatures = await prisma.planFeature.findMany({
        where: {
          plan: "PREMIUM",
          featureKey: { startsWith: "auto_promos_" },
          enabled: true,
        },
      });

      if (premiumFeatures.length === 0) return;

      // Batch fetch all recent orders for all premium shops at once
      const premiumShopIds = premiumFeatures.map(f => f.featureKey.replace("auto_promos_", ""));
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const allRecentOrders = premiumShopIds.length > 0
        ? await prisma.order.findMany({
            where: { shopId: { in: premiumShopIds }, createdAt: { gte: weekAgo } },
            select: { shopId: true, createdAt: true },
          })
        : [];
      // Group orders by shopId
      const ordersByShop = new Map<string, Date[]>();
      for (const o of allRecentOrders) {
        if (!ordersByShop.has(o.shopId)) ordersByShop.set(o.shopId, []);
        ordersByShop.get(o.shopId)!.push(o.createdAt);
      }

      for (const feature of premiumFeatures) {
        try {
          const shopId = feature.featureKey.replace("auto_promos_", "");

          // Use pre-fetched orders
          const recentDates = ordersByShop.get(shopId) || [];

          // Calculate hourly distribution
          const hourCounts = new Map<number, number>();
          for (let h = 0; h < 24; h++) hourCounts.set(h, 0);
          for (const d of recentDates) {
            const h = d.getHours();
            hourCounts.set(h, (hourCounts.get(h) || 0) + 1);
          }

          const peak = Math.max(...hourCounts.values(), 1);
          const isOffPeak = (hourCounts.get(currentHour) || 0) < peak * 0.2;

          if (isOffPeak) {
            // Apply 10% promo on featured products (no existing promo)
            const promoEnd = new Date();
            promoEnd.setHours(promoEnd.getHours() + 1);

            const result = await prisma.product.updateMany({
              where: {
                shopId,
                featured: true,
                inStock: true,
                promoPct: null,
              },
              data: {
                promoPct: 10,
                promoType: "FLASH",
                promoEnd,
              },
            });

            if (result.count > 0) {
              console.log(`[CRON][auto-promos] Applied -10% on ${result.count} products for shop ${shopId} (hour ${currentHour}h)`);
            }
          }
        } catch {
          // Continue with next shop
        }
      }
    } catch (error) {
      console.error("[CRON][auto-promos] Error:", error);
    }
  });

  // ═══════════════════════════════════════════
  // 12. Pickup soon — every 2 minutes
  //     Notify customer ~5 min before estimatedReady
  // ═══════════════════════════════════════════
  cron.schedule("*/2 * * * *", async () => {
    try {
      const now = Date.now();
      const fiveMinFromNow = new Date(now + 5 * 60 * 1000);
      const tenMinFromNow = new Date(now + 10 * 60 * 1000);

      // Find orders where estimatedReady is 5-10 min in the future
      const approachingOrders = await prisma.order.findMany({
        where: {
          status: { in: ["ACCEPTED", "PREPARING"] },
          estimatedReady: { gte: fiveMinFromNow, lte: tenMinFromNow },
        },
        select: {
          id: true,
          orderNumber: true,
          userId: true,
          estimatedReady: true,
          notifSent: true,
          shop: { select: { name: true } },
        },
      });

      let sentCount = 0;
      for (const order of approachingOrders) {
        // Check if PICKUP_SOON was already sent
        const existing = Array.isArray(order.notifSent) ? order.notifSent : [];
        const alreadySent = existing.some(
          (entry) => typeof entry === "object" && entry !== null && (entry as Record<string, unknown>).event === "PICKUP_SOON"
        );
        if (alreadySent) continue;

        const minutesLeft = order.estimatedReady
          ? Math.round((new Date(order.estimatedReady).getTime() - now) / 60_000)
          : 5;

        await sendNotification("PICKUP_SOON", {
          userId: order.userId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          shopName: order.shop.name,
          estimatedMinutes: minutesLeft,
        });
        sentCount++;
      }

      if (sentCount > 0) {
        console.log(`[CRON][pickup-soon] Sent ${sentCount} pickup-soon notifications`);
      }
    } catch (error) {
      console.error("[CRON][pickup-soon] Error:", error);
    }
  });

  // ═══════════════════════════════════════════
  // 13. Daily performance metrics refresh — 3 AM
  // ═══════════════════════════════════════════
  cron.schedule("0 3 * * *", async () => {
    try {
      const { refreshAllShopMetrics } = await import("@/lib/services/performance");
      await refreshAllShopMetrics();
    } catch (error) {
      console.error("[CRON][performance-refresh] Error:", error);
    }
  });

  // ═══════════════════════════════════════════
  // 14. Price adjustment auto-approve (tier 2) + escalation (tier 3) — every 30s
  // ═══════════════════════════════════════════
  cron.schedule("*/1 * * * *", async () => {
    try {
      const now = new Date();

      // ── Tier 2: auto-approve expired (30s timer) ──
      const expiredTier2 = await prisma.priceAdjustment.findMany({
        where: {
          status: "PENDING",
          tier: 2,
          autoApproveAt: { not: null, lte: now },
        },
        select: { id: true, orderId: true, newTotal: true, itemsSnapshot: true },
      });

      // Batch fetch ALL orders for tier2 + tier3 at once (instead of N findUnique)
      const tier2OrderIds = expiredTier2.map(a => a.orderId);

      // ── Tier 3: escalate after 10 min ──
      const expiredTier3 = await prisma.priceAdjustment.findMany({
        where: {
          status: "PENDING",
          tier: 3,
          escalateAt: { not: null, lte: now },
        },
        select: { id: true, orderId: true, originalTotal: true, newTotal: true },
      });

      const tier3OrderIds = expiredTier3.map(a => a.orderId);
      const allAdjOrderIds = [...new Set([...tier2OrderIds, ...tier3OrderIds])];
      const adjOrders = allAdjOrderIds.length > 0
        ? await prisma.order.findMany({
            where: { id: { in: allAdjOrderIds } },
            select: { id: true, userId: true, orderNumber: true, shop: { select: { name: true } } },
          })
        : [];
      const adjOrderMap = new Map(adjOrders.map(o => [o.id, o]));

      // Process tier 2
      for (const adj of expiredTier2) {
        try {
          // Transaction for adjustment + order total update
          await prisma.$transaction([
            prisma.priceAdjustment.update({
              where: { id: adj.id },
              data: { status: "AUTO_VALIDATED", respondedAt: now },
            }),
            prisma.order.update({
              where: { id: adj.orderId },
              data: { totalCents: adj.newTotal },
            }),
          ]);

          // Apply item snapshot via $transaction
          if (adj.itemsSnapshot && Array.isArray(adj.itemsSnapshot)) {
            const snapUpdates = (adj.itemsSnapshot as Record<string, unknown>[])
              .filter(snap => snap.orderItemId && (snap.newQuantity !== undefined || snap.newPriceCents !== undefined || snap.newTotalCents !== undefined))
              .map(snap => {
                const updateData: Record<string, unknown> = {};
                if (snap.newQuantity !== undefined) updateData.quantity = snap.newQuantity;
                if (snap.newPriceCents !== undefined) updateData.priceCents = snap.newPriceCents;
                if (snap.newTotalCents !== undefined) updateData.totalCents = snap.newTotalCents;
                return prisma.orderItem.update({
                  where: { id: snap.orderItemId as string },
                  data: updateData,
                });
              });
            if (snapUpdates.length > 0) {
              await prisma.$transaction(snapUpdates);
            }
          }

          // Notify client (using pre-fetched order)
          const order = adjOrderMap.get(adj.orderId);
          if (order) {
            await sendNotification("PRICE_ADJUSTMENT_AUTO_VALIDATED", {
              userId: order.userId,
              orderId: adj.orderId,
              orderNumber: order.orderNumber,
              shopName: order.shop.name,
            });
          }
        } catch {
          // Continue with next adjustment
        }
      }

      // Process tier 3 — batch update status
      if (expiredTier3.length > 0) {
        await prisma.priceAdjustment.updateMany({
          where: { id: { in: expiredTier3.map(a => a.id) } },
          data: { status: "ESCALATED", respondedAt: now },
        });
      }

      for (const adj of expiredTier3) {
        try {
          const order = adjOrderMap.get(adj.orderId);
          if (order) {
            await sendNotification("PRICE_ADJUSTMENT_ESCALATED", {
              orderId: adj.orderId,
              orderNumber: order.orderNumber,
              shopName: order.shop.name,
              originalTotal: adj.originalTotal,
              newTotal: adj.newTotal,
              tier: 3,
            });
          }
        } catch {
          // Continue with next adjustment
        }
      }

      const total = expiredTier2.length + expiredTier3.length;
      if (total > 0) {
        console.log(`[CRON][price-adjust] Auto-validated ${expiredTier2.length} tier-2, escalated ${expiredTier3.length} tier-3`);
      }
    } catch (error) {
      console.error("[CRON][price-adjust] Error:", error);
    }
  });

  // ═══════════════════════════════════════════
  // 15. Auto-open/close based on opening hours — every minute
  //     Opens CLOSED shops during their hours, closes OPEN/BUSY shops after hours
  //     Respects manual PAUSED and VACATION — never overrides
  // ═══════════════════════════════════════════
  cron.schedule("* * * * *", async () => {
    try {
      const DAYS_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
      const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
      const dayKey = DAYS_FR[now.getDay()];
      const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

      // Find shops with opening hours configured
      const shops = await prisma.shop.findMany({
        where: {
          visible: true,
          vacationMode: false,
          openingHours: { not: { equals: {} } },
        },
        select: {
          id: true,
          status: true,
          paused: true,
          openingHours: true,
        },
      });

      let opened = 0;
      let closed = 0;

      // Collect shops to open and close (instead of N individual updates)
      const toOpen: string[] = [];
      const toClose: string[] = [];

      for (const shop of shops) {
        const hours = shop.openingHours as Record<string, { open: string; close: string }> | null;
        if (!hours || !hours[dayKey]) continue;

        const { open, close } = hours[dayKey];
        if (!open || !close) continue;

        const isWithinHours = currentTime >= open && currentTime < close;

        if (isWithinHours && shop.status === "CLOSED") {
          toOpen.push(shop.id);
        } else if (!isWithinHours && (shop.status === "OPEN" || shop.status === "BUSY")) {
          toClose.push(shop.id);
        }
      }

      // Batch update
      if (toOpen.length > 0) {
        await prisma.shop.updateMany({
          where: { id: { in: toOpen } },
          data: { status: "OPEN" },
        });
        opened = toOpen.length;
      }
      if (toClose.length > 0) {
        await prisma.shop.updateMany({
          where: { id: { in: toClose } },
          data: { status: "CLOSED", busyMode: false, busyModeEndsAt: null },
        });
        closed = toClose.length;
      }

      if (opened > 0 || closed > 0) {
        console.log(`[CRON][auto-schedule] Opened ${opened}, closed ${closed} shops based on opening hours`);
      }
    } catch (error) {
      console.error("[CRON][auto-schedule] Error:", error);
    }
  });

  // ═══════════════════════════════════════════
  // CAMPAIGN — Send scheduled campaigns every 5 min
  // ═══════════════════════════════════════════
  cron.schedule("*/5 * * * *", async () => {
    try {
      const now = new Date();

      // Find due scheduled campaigns
      const dueCampaigns = await prisma.campaign.findMany({
        where: {
          status: "SCHEDULED",
          scheduledAt: { not: null, lte: now },
        },
        select: { id: true, title: true },
      });

      if (dueCampaigns.length === 0) return;

      const { executeCampaignSend } = await import("@/lib/marketing/send-campaign");

      for (const campaign of dueCampaigns) {
        try {
          const result = await executeCampaignSend(campaign.id);
          console.log(`[CRON][campaign] Sent "${campaign.title}": ${result.sent}/${result.total} emails`);
        } catch (err) {
          console.error(`[CRON][campaign] Error sending "${campaign.title}":`, err);
          await prisma.campaign.update({
            where: { id: campaign.id },
            data: { status: "SCHEDULED" },
          }).catch(() => {});
        }
      }
    } catch (error) {
      console.error("[CRON][campaign] Error:", error);
    }
  });

  // ═══════════════════════════════════════════
  // LOYALTY — Remind expiring rewards daily at 10h
  // ═══════════════════════════════════════════
  cron.schedule("0 10 * * *", async () => {
    try {
      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Rewards expiring in 3 days (between tomorrow and 3 days)
      const expiringRewards = await prisma.loyaltyReward.findMany({
        where: {
          usedAt: null,
          expiresAt: { gte: tomorrow, lte: threeDaysFromNow },
        },
        include: {
          user: { select: { id: true, pushPromoEnabled: true, firstName: true } },
        },
      });

      let sent = 0;
      for (const reward of expiringRewards) {
        if (!reward.user.pushPromoEnabled) continue;

        const label = reward.rewardCents
          ? `${(reward.rewardCents / 100).toFixed(0)}\u20AC`
          : `${reward.rewardPercent}%`;

        await sendNotification("PROMO_NEW", {
          userId: reward.user.id,
          message: `Votre bon de ${label} expire dans 3 jours ! Code : ${reward.code}`,
        }).catch(() => {});
        sent++;
      }
      if (sent > 0) console.log(`[CRON][loyalty] Sent ${sent} expiring reward reminders`);
    } catch (error) {
      console.error("[CRON][loyalty] Error:", error);
    }
  });

  // ═══════════════════════════════════════════
  // RECIPE — Generate daily AI recipe at 6:00 AM
  // ═══════════════════════════════════════════
  cron.schedule("0 6 * * *", async () => {
    try {
      const { generateDailyRecipe } = await import("@/lib/recipe-generator");
      const recipe = await generateDailyRecipe();
      console.log(`[CRON][recipe] Generated: "${recipe.title}" (${recipe.slug})`);
    } catch (error) {
      console.error("[CRON][recipe] Error:", error);
    }
  });

  console.log("[CRON] All cron jobs scheduled successfully");
}
