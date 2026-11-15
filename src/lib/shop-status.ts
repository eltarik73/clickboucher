// src/lib/shop-status.ts — Uber Eats / Deliveroo shop status system
import prisma from "./prisma";
import { redis } from "./redis";
import type { ShopStatus } from "@prisma/client";
import { endVacationMode } from "./shop-vacation";

// ── Mode Vacances (Deliveroo "vacation mode") : src/lib/shop-vacation.ts ──
export {
  endExpiredVacations,
  endVacationMode,
  setVacationMode,
  type VacationChange,
} from "./shop-vacation";

// ── Cache du statut dans Redis (comme Uber : lookup ultra rapide) ──

export async function getShopStatus(shopId: string): Promise<ShopStatus> {
  // 1. Check Redis cache first (latence < 5ms)
  const cached = await redis.get<ShopStatus>(`shop:status:${shopId}`);
  if (cached) return cached;

  // 2. Check DB + logique auto-expiration
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: {
      status: true,
      paused: true,
      autoPaused: true,
      busyMode: true,
      vacationMode: true,
      vacationEnd: true,
      busyModeEndsAt: true,
      pauseEndsAt: true,
    },
  });
  if (!shop) return "CLOSED";

  let status: ShopStatus = shop.status;
  const now = new Date();

  // Auto-expiration du busy mode
  if (shop.busyMode && shop.busyModeEndsAt && now > shop.busyModeEndsAt) {
    await prisma.shop.update({
      where: { id: shopId },
      data: { busyMode: false, busyModeEndsAt: null, status: "OPEN" },
    });
    status = "OPEN";
  }

  // Auto-expiration de la pause
  if (shop.paused && shop.pauseEndsAt && now > shop.pauseEndsAt) {
    await prisma.shop.update({
      where: { id: shopId },
      data: { paused: false, pausedAt: null, pauseEndsAt: null, pauseReason: null, status: "OPEN" },
    });
    status = "OPEN";
  }

  // Auto-expiration du mode vacances : la même fin de congés que celle du boucher
  if (shop.vacationMode && shop.vacationEnd && now > shop.vacationEnd) {
    const ended = await endVacationMode(shopId, "system");
    if (ended.ok) status = "OPEN";
  }

  // Cache 60s
  await redis.set(`shop:status:${shopId}`, status, { ex: 60 });
  return status;
}

// ── Pause manuelle (bouton "Pause new orders" d'Uber Eats) ──

export async function pauseShop(
  shopId: string,
  options: {
    reason?: string;
    durationMin?: number;
    triggeredBy: "boucher" | "admin" | "system";
  }
) {
  const pauseEndsAt = options.durationMin
    ? new Date(Date.now() + options.durationMin * 60 * 1000)
    : null;

  await prisma.$transaction([
    prisma.shop.update({
      where: { id: shopId },
      data: {
        status: "PAUSED",
        paused: true,
        pausedAt: new Date(),
        pauseReason: options.reason || "Pause manuelle",
        pauseEndsAt,
      },
    }),
    prisma.shopLog.create({
      data: {
        shopId,
        action: "PAUSED",
        details: `Raison: ${options.reason || "Manuel"} | Durée: ${options.durationMin || "indéfinie"}min`,
        triggeredBy: options.triggeredBy,
      },
    }),
  ]);

  await redis.del(`shop:status:${shopId}`);
  await redis.publish(
    `shop:${shopId}:events`,
    JSON.stringify({ type: "SHOP_PAUSED", pauseEndsAt, reason: options.reason })
  );
}

// ── Reprendre (bouton "Resume orders" d'Uber Eats) ──

export async function resumeShop(shopId: string, triggeredBy: string) {
  await prisma.$transaction([
    prisma.shop.update({
      where: { id: shopId },
      data: {
        status: "OPEN",
        paused: false,
        autoPaused: false,
        pausedAt: null,
        pauseEndsAt: null,
        pauseReason: null,
        missedOrdersCount: 0,
      },
    }),
    prisma.shopLog.create({
      data: { shopId, action: "RESUMED", triggeredBy },
    }),
  ]);
  await redis.del(`shop:status:${shopId}`);
  await redis.publish(`shop:${shopId}:events`, JSON.stringify({ type: "SHOP_RESUMED" }));
}

// ── Busy Mode (Uber Eats : "Start busy mode") ──

export async function setBusyMode(
  shopId: string,
  options: {
    extraMin: number; // +10, +15, +20, +30
    durationMin: number;
  }
) {
  // If already busy, extend from current end time (cumulative)
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { busyMode: true, busyModeEndsAt: true } });
  const baseTime = shop?.busyMode && shop.busyModeEndsAt && shop.busyModeEndsAt.getTime() > Date.now()
    ? shop.busyModeEndsAt.getTime()
    : Date.now();
  const busyModeEndsAt = new Date(baseTime + options.durationMin * 60 * 1000);

  await prisma.$transaction([
    prisma.shop.update({
      where: { id: shopId },
      data: {
        status: "BUSY",
        busyMode: true,
        busyExtraMin: options.extraMin,
        busyModeEndsAt,
      },
    }),
    prisma.shopLog.create({
      data: {
        shopId,
        action: "BUSY_ON",
        details: `+${options.extraMin}min prep | Durée: ${options.durationMin}min`,
        triggeredBy: "boucher",
      },
    }),
  ]);
  await redis.del(`shop:status:${shopId}`);
  await redis.publish(
    `shop:${shopId}:events`,
    JSON.stringify({ type: "SHOP_BUSY", extraMin: options.extraMin, endsAt: busyModeEndsAt })
  );
}

// ── End Busy Mode ──

export async function endBusyMode(shopId: string) {
  await prisma.$transaction([
    prisma.shop.update({
      where: { id: shopId },
      data: { status: "OPEN", busyMode: false, busyModeEndsAt: null },
    }),
    prisma.shopLog.create({
      data: { shopId, action: "BUSY_OFF", triggeredBy: "boucher" },
    }),
  ]);
  await redis.del(`shop:status:${shopId}`);
  await redis.publish(`shop:${shopId}:events`, JSON.stringify({ type: "SHOP_RESUMED" }));
}

// ── Auto-Pause (Uber Eats : pause automatique si pas de réponse) ──

export async function checkAutoPause(shopId: string) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { missedOrdersCount: true, autoPauseThreshold: true, status: true },
  });
  if (!shop || shop.status !== "OPEN") return;

  const newCount = shop.missedOrdersCount + 1;
  if (newCount >= shop.autoPauseThreshold) {
    await prisma.$transaction([
      prisma.shop.update({
        where: { id: shopId },
        data: {
          status: "AUTO_PAUSED",
          autoPaused: true,
          autoPausedAt: new Date(),
          missedOrdersCount: newCount,
        },
      }),
      prisma.shopLog.create({
        data: {
          shopId,
          action: "AUTO_PAUSED",
          details: `${newCount} commandes non-répondues consécutives`,
          triggeredBy: "system",
        },
      }),
    ]);
    await redis.del(`shop:status:${shopId}`);
    await redis.publish(
      `shop:${shopId}:events`,
      JSON.stringify({
        type: "SHOP_AUTO_PAUSED",
        message: "Votre boutique a été mise en pause car plusieurs commandes sont restées sans réponse.",
      })
    );
  } else {
    await prisma.shop.update({
      where: { id: shopId },
      data: { missedOrdersCount: newCount },
    });
  }
}

// ── Suspension (posée et levée par l'administration seule : services/shops/moderation.ts) ──

/** The suspension of a shop, or null when the shop does not exist or is not suspended. */
export async function shopSuspension(
  shopId: string
): Promise<{ suspendedAt: Date; reason: string | null } | null> {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { suspendedAt: true, suspendReason: true },
  });
  if (!shop?.suspendedAt) return null;
  return { suspendedAt: shop.suspendedAt, reason: shop.suspendReason };
}
