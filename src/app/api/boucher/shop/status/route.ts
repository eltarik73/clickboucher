// src/app/api/boucher/shop/status/route.ts — Boucher shop status management
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request-body";
import {
  pauseShop,
  resumeShop,
  setBusyMode,
  endBusyMode,
  setVacationMode,
  endVacationMode,
  getShopStatus,
  shopSuspension,
  type VacationChange,
} from "@/lib/shop-status";
import {
  SHOP_NOT_PUBLISHED_OWNER_MESSAGE,
  SHOP_SUSPENDED_OWNER_MESSAGE,
} from "@/lib/shop-publication";
import { shopStatusActionSchema } from "./action-schema";

export const dynamic = "force-dynamic";

/** Why a vacation could not start or end, as the butcher reads it. */
function vacationRefusal(reason: Extract<VacationChange, { ok: false }>["reason"]): Response {
  switch (reason) {
    case "SUSPENDED":
      return apiError("FORBIDDEN", SHOP_SUSPENDED_OWNER_MESSAGE);
    case "NOT_PUBLISHED":
      return apiError("CONFLICT", SHOP_NOT_PUBLISHED_OWNER_MESSAGE);
    case "NOT_ON_VACATION":
      return apiError("CONFLICT", "La boutique n'est pas en vacances");
  }
}

// ── GET — Current shop status + details ──
export async function GET() {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        name: true,
        rating: true,
        ratingCount: true,
        status: true,
        busyMode: true,
        busyExtraMin: true,
        busyModeEndsAt: true,
        defaultBusyDurationMin: true,
        paused: true,
        pausedAt: true,
        pauseReason: true,
        pauseEndsAt: true,
        autoPaused: true,
        autoPausedAt: true,
        vacationMode: true,
        vacationStart: true,
        vacationEnd: true,
        vacationMessage: true,
        prepTimeMin: true,
        autoAccept: true,
        acceptTimeoutMin: true,
        maxOrdersPerSlot: true,
        maxOrdersPerHour: true,
        autoBusyThreshold: true,
        missedOrdersCount: true,
        soundNotif: true,
        flashNotif: true,
        vibrateNotif: true,
      },
    });
    if (!shop) return apiError("NOT_FOUND", "Boutique introuvable");

    // A timed pause that has just expired may still be cached as PAUSED in Redis (60s):
    // drop the cached status so getShopStatus() runs its expiry logic against the DB.
    const pauseExpired = !!(shop.paused && shop.pauseEndsAt && shop.pauseEndsAt < new Date());
    if (pauseExpired) {
      await redis.del(`shop:status:${shop.id}`);
    }

    // Refresh status (auto-expire timers)
    const currentStatus = await getShopStatus(shop.id);

    // The row above was read before the expiry ran: mirror the fields getShopStatus() just
    // cleared. If the status is still PAUSED (cache bust failed, shop re-paused meanwhile),
    // keep the row as read so the client retries instead of showing a pause with no end.
    const pauseCleared = pauseExpired && currentStatus !== "PAUSED";

    return apiSuccess({
      ...shop,
      ...(pauseCleared
        ? { paused: false, pausedAt: null, pauseReason: null, pauseEndsAt: null }
        : {}),
      status: currentStatus,
      effectivePrepTime: shop.prepTimeMin + (shop.busyMode ? shop.busyExtraMin : 0),
    });
  } catch (error) {
    return handleApiError(error, "boucher/shop/status/GET");
  }
}

// ── PATCH — Change shop status ──
// A suspended shop belongs to the admin until it is reactivated: every action is refused.
export async function PATCH(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    if (await shopSuspension(shopId)) return apiError("FORBIDDEN", SHOP_SUSPENDED_OWNER_MESSAGE);

    const data = shopStatusActionSchema.parse(await readJsonBody(req));

    switch (data.action) {
      case "pause":
        await pauseShop(shopId, {
          reason: data.reason,
          durationMin: data.durationMin,
          triggeredBy: "boucher",
        });
        break;

      case "resume":
        await resumeShop(shopId, "boucher");
        break;

      case "busy":
        await setBusyMode(shopId, {
          extraMin: data.extraMin,
          durationMin: data.durationMin,
        });
        break;

      case "end_busy":
        await endBusyMode(shopId);
        break;

      case "vacation": {
        const change = await setVacationMode(shopId, {
          start: new Date(data.start),
          end: new Date(data.end),
          message: data.message,
        });
        if (!change.ok) return vacationRefusal(change.reason);
        break;
      }

      case "end_vacation": {
        const change = await endVacationMode(shopId);
        if (!change.ok) return vacationRefusal(change.reason);
        break;
      }

      case "close":
        await prisma.shop.update({
          where: { id: shopId },
          data: {
            status: "CLOSED",
            paused: false,
            pauseReason: null,
            pauseEndsAt: null,
            busyMode: false,
            busyModeEndsAt: null,
          },
        });
        break;

      case "update_settings": {
        const { action: _action, ...settings } = data;
        await prisma.shop.update({ where: { id: shopId }, data: settings });
        break;
      }
    }

    // Return fresh status
    const updated = await prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        status: true,
        busyMode: true,
        busyExtraMin: true,
        busyModeEndsAt: true,
        paused: true,
        pauseEndsAt: true,
        pauseReason: true,
        vacationMode: true,
        vacationEnd: true,
        vacationMessage: true,
        prepTimeMin: true,
        autoAccept: true,
        acceptTimeoutMin: true,
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "boucher/shop/status/PATCH");
  }
}
