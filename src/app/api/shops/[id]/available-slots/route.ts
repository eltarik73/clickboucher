// GET /api/shops/[id]/available-slots?date=2026-02-18
// Returns available 30-min pickup slots for a given date
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { earliestPickupMinutes, getParisWallClock, parisWallClockToUtc } from "@/lib/paris-time";

export const dynamic = "force-dynamic";

const DAY_KEYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

type SlotConfig = {
  intervalMin?: number;
  maxPerSlot?: number;
  slots?: Record<string, { start: string; end: string }>;
};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const dateStr = req.nextUrl.searchParams.get("date");
    if (!dateStr) return apiError("VALIDATION_ERROR", "Paramètre date requis (YYYY-MM-DD)");

    const shop = await prisma.shop.findUnique({
      where: { id },
      select: {
        id: true,
        pickupSlots: true,
        openingHours: true,
        prepTimeMin: true,
        busyMode: true,
        busyExtraMin: true,
        maxOrdersPerSlot: true,
        status: true,
      },
    });

    if (!shop) return apiError("NOT_FOUND", "Boutique introuvable");
    if (shop.status === "CLOSED" || shop.status === "VACATION" || shop.status === "PAUSED" || shop.status === "AUTO_PAUSED") {
      return apiSuccess({ slots: [], message: "Boutique fermée" });
    }

    const date = new Date(dateStr + "T00:00:00");
    const dayIndex = date.getDay();
    const dayKey = DAY_KEYS[dayIndex];

    // Get slot config
    const config = (shop.pickupSlots as SlotConfig) || {};
    const intervalMin = config.intervalMin || 30;
    const maxPerSlot = config.maxPerSlot || shop.maxOrdersPerSlot || 5;

    // Get day schedule — from slot config or opening hours
    const daySlot = config.slots?.[dayKey];
    const openingHours = shop.openingHours as Record<string, { open: string; close: string }> | null;
    const dayHours = openingHours?.[dayKey];

    const start = daySlot?.start || dayHours?.open;
    const end = daySlot?.end || dayHours?.close;

    if (!start || !end) {
      return apiSuccess({ slots: [], message: "Fermé ce jour" });
    }

    // Generate time slots
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // "Aujourd'hui" et "maintenant" en heure de Paris : le serveur tourne en UTC
    // (Vercel), son horloge proposerait des créneaux déjà passés de 1 à 2 h.
    const paris = getParisWallClock();
    // Jour déjà écoulé à Paris (ex. panier ouvert entre 00h et 02h, qui envoie
    // encore la date UTC de la veille) : aucun créneau à proposer.
    if (dateStr < paris.dateKey) {
      return apiSuccess({ slots: [], message: "Date passée" });
    }
    const isToday = dateStr === paris.dateKey;
    // Minimum pickup: now + 10 min margin, rounded UP to next slot boundary
    // 13h09 → 13h30 | 13h22 → 14h00 | 14h05 → 14h30 | 14h31 → 15h00
    const nowMinutes = isToday ? earliestPickupMinutes(paris.minutesOfDay, intervalMin) : 0;

    // Count existing orders per slot for this date. Les commandes stockent
    // l'instant réel du créneau : on convertit donc la journée et chaque créneau
    // de l'heure de Paris vers UTC (sinon les compteurs sont décalés de 1 à 2 h).
    const dayStart = parisWallClockToUtc(dateStr, 0);
    const dayEnd = parisWallClockToUtc(dateStr, 24 * 60);

    const orders = await prisma.order.findMany({
      where: {
        shopId: id,
        status: { notIn: ["CANCELLED", "DENIED", "AUTO_CANCELLED"] },
        pickupSlotStart: { gte: dayStart, lt: dayEnd },
      },
      select: { pickupSlotStart: true },
    });

    const slotCounts: Record<string, number> = {};
    for (const order of orders) {
      if (order.pickupSlotStart) {
        const key = order.pickupSlotStart.toISOString();
        slotCounts[key] = (slotCounts[key] || 0) + 1;
      }
    }

    const slots: { start: string; end: string; available: boolean; remaining: number }[] = [];

    for (let min = startMinutes; min + intervalMin <= endMinutes; min += intervalMin) {
      if (isToday && min < nowMinutes) continue;

      const h1 = Math.floor(min / 60);
      const m1 = min % 60;
      const h2 = Math.floor((min + intervalMin) / 60);
      const m2 = (min + intervalMin) % 60;

      const key = parisWallClockToUtc(dateStr, min).toISOString();
      const count = slotCounts[key] || 0;
      const remaining = maxPerSlot - count;

      slots.push({
        start: `${String(h1).padStart(2, "0")}:${String(m1).padStart(2, "0")}`,
        end: `${String(h2).padStart(2, "0")}:${String(m2).padStart(2, "0")}`,
        available: remaining > 0,
        remaining,
      });
    }

    return apiSuccess({ date: dateStr, day: dayKey, slots, intervalMin, maxPerSlot });
  } catch (error) {
    return handleApiError(error, "shops/[id]/available-slots");
  }
}
