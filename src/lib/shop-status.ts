// src/lib/shop-status.ts — Uber Eats / Deliveroo shop status system
import prisma from "./prisma";
import { redis } from "./redis";
import type { ShopStatus } from "@prisma/client";

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

  // Auto-expiration du mode vacances
  if (shop.vacationMode && shop.vacationEnd && now > shop.vacationEnd) {
    await prisma.shop.update({
      where: { id: shopId },
      data: { vacationMode: false, vacationStart: null, vacationEnd: null, vacationMessage: null, visible: true, status: "OPEN" },
    });
    status = "OPEN";
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
  const busyModeEndsAt = new Date(Date.now() + options.durationMin * 60 * 1000);

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

// ── Mode Vacances (Deliveroo "vacation mode") ──

export async function setVacationMode(
  shopId: string,
  options: { start: Date; end: Date; message?: string }
) {
  await prisma.$transaction([
    prisma.shop.update({
      where: { id: shopId },
      data: {
        status: "VACATION",
        vacationMode: true,
        vacationStart: options.start,
        vacationEnd: options.end,
        vacationMessage: options.message || "Nous sommes en vacances, à bientôt !",
        visible: false,
      },
    }),
    prisma.shopLog.create({
      data: {
        shopId,
        action: "VACATION_ON",
        details: `Du ${options.start.toISOString()} au ${options.end.toISOString()}`,
        triggeredBy: "boucher",
      },
    }),
  ]);
  await redis.del(`shop:status:${shopId}`);
}

// ── End Vacation ──

export async function endVacationMode(shopId: string) {
  await prisma.$transaction([
    prisma.shop.update({
      where: { id: shopId },
      data: {
        status: "OPEN",
        vacationMode: false,
        vacationStart: null,
        vacationEnd: null,
        vacationMessage: null,
        visible: true,
      },
    }),
    prisma.shopLog.create({
      data: { shopId, action: "VACATION_OFF", triggeredBy: "boucher" },
    }),
  ]);
  await redis.del(`shop:status:${shopId}`);
}
