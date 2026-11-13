// src/lib/shop-hours.ts — Compute shop open/closing status from opening hours JSON
//
// Shape of openingHours (as stored in Prisma): Record<DayKey, { open: "HH:MM"; close: "HH:MM" }>
// DayKey réellement enregistré par l'app (réglages boucher, seed, créneaux de retrait) :
// "lundi" | "mardi" | "mercredi" | "jeudi" | "vendredi" | "samedi" | "dimanche".
// Les clés anglaises courtes ("sun" | "mon" | … | "sat") restent acceptées.
// Days without an entry (or with empty strings) are treated as closed for that day.

export type OpeningHours = Record<string, { open: string; close: string } | null | undefined>;

export type ShopStatus =
  | { status: "OPEN" }
  | { status: "CLOSING_SOON"; closesAt: Date; minutesLeft: number }
  | { status: "CLOSED" };

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DAY_KEYS_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"] as const;

export type DayHours = { open: string; close: string };

/**
 * Horaires d'un jour (0 = dimanche … 6 = samedi, comme Date#getDay()).
 * Accepte les clés françaises (celles que l'app enregistre) et, à défaut, les
 * clés anglaises courtes. Retourne null si le jour est fermé ou non renseigné.
 */
export function getDayHours(
  openingHours: OpeningHours | null | undefined,
  jsDay: number,
): DayHours | null {
  if (!openingHours || typeof openingHours !== "object") return null;
  const day = openingHours[DAY_KEYS_FR[jsDay]] ?? openingHours[DAY_KEYS[jsDay]];
  if (!day || !day.open || !day.close) return null;
  return { open: day.open, close: day.close };
}

function parseHHMM(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Compute the current status for a shop given its openingHours.
 * CLOSING_SOON is returned when the shop is open AND will close in under 60 minutes.
 */
export function getShopStatus(
  openingHours: OpeningHours | null | undefined,
  now: Date = new Date(),
  closingSoonMinutes = 60,
): ShopStatus {
  const day = getDayHours(openingHours, now.getDay());
  if (!day) return { status: "CLOSED" };

  const openMin = parseHHMM(day.open);
  const closeMin = parseHHMM(day.close);
  if (openMin === null || closeMin === null) return { status: "CLOSED" };

  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Simple case: open < close on the same day (no overnight support)
  if (nowMin < openMin || nowMin >= closeMin) return { status: "CLOSED" };

  const minutesLeft = closeMin - nowMin;
  if (minutesLeft <= closingSoonMinutes) {
    const closesAt = new Date(now);
    closesAt.setHours(0, 0, 0, 0);
    closesAt.setMinutes(closeMin);
    return { status: "CLOSING_SOON", closesAt, minutesLeft };
  }

  return { status: "OPEN" };
}

/**
 * Format a "closes at" hint for a shop card, e.g. "Ferme à 19h30" or "Ferme dans 45 min".
 * Use the Date form for ≥ 30min remaining, the countdown form for < 30min.
 */
export function formatClosingHint(status: Extract<ShopStatus, { status: "CLOSING_SOON" }>): string {
  if (status.minutesLeft < 30) {
    return `Ferme dans ${status.minutesLeft} min`;
  }
  const h = status.closesAt.getHours();
  const m = status.closesAt.getMinutes();
  const mm = m.toString().padStart(2, "0");
  return `Ferme à ${h}h${mm}`;
}
