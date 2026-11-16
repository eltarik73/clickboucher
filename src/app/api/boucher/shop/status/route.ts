// src/app/api/boucher/shop/status/route.ts — Boucher shop status management
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import type { z } from "zod";
import { apiSuccess, apiError, formatZodError, handleApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request-body";
import { writeOwnerShop, type OwnerShopWrite } from "@/lib/services/shops/owner-write";
import { shopWriteRefusal } from "@/lib/services/shops/owner-write-http";
import { pauseShop, resumeShop, setBusyMode, endBusyMode, getShopStatus } from "@/lib/shop-status";
import { setVacationMode, endVacationMode, type VacationChange } from "@/lib/shop-vacation";
import { SHOP_NOT_PUBLISHED_OWNER_MESSAGE } from "@/lib/shop-publication";
import { shopStatusActionSchema } from "./action-schema";

export const dynamic = "force-dynamic";

type ActionResult = OwnerShopWrite | VacationChange;

/** Why the butcher's action was refused, as the butcher reads it. */
function actionRefusal(reason: Extract<ActionResult, { ok: false }>["reason"]): Response {
  switch (reason) {
    case "SUSPENDED":
    case "NOT_FOUND":
      return shopWriteRefusal(reason);
    case "NOT_PUBLISHED":
      return apiError("CONFLICT", SHOP_NOT_PUBLISHED_OWNER_MESSAGE);
    case "NOT_ON_VACATION":
      return apiError("CONFLICT", "La boutique n'est pas en vacances");
  }
}

/** Every write below is refused on a suspended shop: it belongs to the admin until reactivated. */
function applyAction(
  shopId: string,
  data: z.infer<typeof shopStatusActionSchema>
): Promise<ActionResult> {
  switch (data.action) {
    case "pause":
      return pauseShop(shopId, {
        reason: data.reason,
        durationMin: data.durationMin,
        triggeredBy: "boucher",
      });
    case "resume":
      return resumeShop(shopId, "boucher");
    case "busy":
      return setBusyMode(shopId, { extraMin: data.extraMin, durationMin: data.durationMin });
    case "end_busy":
      return endBusyMode(shopId);
    case "vacation":
      return setVacationMode(shopId, {
        start: new Date(data.start),
        end: new Date(data.end),
        message: data.message,
      });
    case "end_vacation":
      return endVacationMode(shopId);
    case "close":
      return writeOwnerShop(prisma, shopId, {
        status: "CLOSED",
        paused: false,
        pauseReason: null,
        pauseEndsAt: null,
        busyMode: false,
        busyModeEndsAt: null,
      });
    case "update_settings": {
      const { action: _action, ...settings } = data;
      return writeOwnerShop(prisma, shopId, settings);
    }
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
export async function PATCH(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const parsed = shopStatusActionSchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Données invalides", formatZodError(parsed.error));
    }

    const change = await applyAction(shopId, parsed.data);
    if (!change.ok) return actionRefusal(change.reason);

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
