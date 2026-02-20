// src/app/api/boucher/shop/status/route.ts — Boucher shop status management
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import {
  pauseShop,
  resumeShop,
  setBusyMode,
  endBusyMode,
  setVacationMode,
  endVacationMode,
  getShopStatus,
} from "@/lib/shop-status";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ── GET — Current shop status + details ──
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId },
      select: {
        id: true,
        name: true,
        rating: true,
        ratingCount: true,
        status: true,
        busyMode: true,
        busyExtraMin: true,
        busyModeEndsAt: true,
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

    // Refresh status (auto-expire timers)
    const currentStatus = await getShopStatus(shop.id);

    return apiSuccess({
      ...shop,
      status: currentStatus,
      effectivePrepTime: shop.prepTimeMin + (shop.busyMode ? shop.busyExtraMin : 0),
    });
  } catch (error) {
    return handleApiError(error, "boucher/shop/status/GET");
  }
}

// ── PATCH — Change shop status ──
const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("pause"),
    reason: z.string().optional(),
    durationMin: z.number().int().min(1).max(1440).optional(),
  }),
  z.object({ action: z.literal("resume") }),
  z.object({
    action: z.literal("busy"),
    extraMin: z.number().int().min(5).max(60),
    durationMin: z.number().int().min(15).max(480),
  }),
  z.object({ action: z.literal("end_busy") }),
  z.object({
    action: z.literal("vacation"),
    start: z.string().datetime(),
    end: z.string().datetime(),
    message: z.string().max(200).optional(),
  }),
  z.object({ action: z.literal("end_vacation") }),
  z.object({
    action: z.literal("update_settings"),
    prepTimeMin: z.number().int().min(5).max(120).optional(),
    autoAccept: z.boolean().optional(),
    acceptTimeoutMin: z.number().int().min(3).max(60).optional(),
    maxOrdersPerSlot: z.number().int().min(1).max(100).optional(),
    maxOrdersPerHour: z.number().int().min(1).max(500).optional(),
    autoBusyThreshold: z.number().int().min(3).max(100).optional(),
    soundNotif: z.boolean().optional(),
    flashNotif: z.boolean().optional(),
    vibrateNotif: z.boolean().optional(),
  }),
]);

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });
    if (!shop) return apiError("NOT_FOUND", "Boutique introuvable");

    const body = await req.json();
    const data = actionSchema.parse(body);

    switch (data.action) {
      case "pause":
        await pauseShop(shop.id, {
          reason: data.reason,
          durationMin: data.durationMin,
          triggeredBy: "boucher",
        });
        break;

      case "resume":
        await resumeShop(shop.id, "boucher");
        break;

      case "busy":
        await setBusyMode(shop.id, {
          extraMin: data.extraMin,
          durationMin: data.durationMin,
        });
        break;

      case "end_busy":
        await endBusyMode(shop.id);
        break;

      case "vacation":
        await setVacationMode(shop.id, {
          start: new Date(data.start),
          end: new Date(data.end),
          message: data.message,
        });
        break;

      case "end_vacation":
        await endVacationMode(shop.id);
        break;

      case "update_settings": {
        const { action: _, ...settings } = data;
        const updateData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(settings)) {
          if (value !== undefined) updateData[key] = value;
        }
        if (Object.keys(updateData).length > 0) {
          await prisma.shop.update({ where: { id: shop.id }, data: updateData });
        }
        break;
      }
    }

    // Return fresh status
    const updated = await prisma.shop.findUnique({
      where: { id: shop.id },
      select: {
        id: true, status: true, busyMode: true, busyExtraMin: true,
        busyModeEndsAt: true, paused: true, pauseEndsAt: true, pauseReason: true,
        vacationMode: true, vacationEnd: true, vacationMessage: true,
        prepTimeMin: true, autoAccept: true, acceptTimeoutMin: true,
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "boucher/shop/status/PATCH");
  }
}
