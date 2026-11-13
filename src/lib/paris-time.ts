// src/lib/paris-time.ts — Heure murale Europe/Paris, indépendante du fuseau du serveur.
//
// Les fonctions Vercel tournent en UTC alors que boutiques et clients sont en
// France : `new Date().getHours()` y est décalé de 1 h (hiver) ou 2 h (été).
// Ces helpers purs passent par Intl.DateTimeFormat (timeZone "Europe/Paris"),
// donc restent justes aux changements d'heure.

export const PARIS_TIME_ZONE = "Europe/Paris";

/** Marge minimale entre maintenant et le premier créneau de retrait proposé. */
export const PICKUP_MARGIN_MIN = 10;

export interface ParisWallClock {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  /** 0–23 */
  hour: number;
  minute: number;
  second: number;
  /** 0 = dimanche … 6 = samedi (même convention que Date#getDay) */
  weekday: number;
  /** "YYYY-MM-DD" */
  dateKey: string;
  /** Minutes écoulées depuis minuit, heure de Paris */
  minutesOfDay: number;
}

const PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: PARIS_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Décompose un instant en date et heure murales de Paris.
 */
export function getParisWallClock(now: Date = new Date()): ParisWallClock {
  const parts = new Map<string, number>();
  for (const part of PARTS_FORMATTER.formatToParts(now)) {
    if (part.type !== "literal") parts.set(part.type, Number(part.value));
  }

  const year = parts.get("year") ?? 0;
  const month = parts.get("month") ?? 1;
  const day = parts.get("day") ?? 1;
  // Certains moteurs ICU rendent "24" à minuit : on ramène dans 0–23.
  const hour = (parts.get("hour") ?? 0) % 24;
  const minute = parts.get("minute") ?? 0;
  const second = parts.get("second") ?? 0;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    dateKey: `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`,
    minutesOfDay: hour * 60 + minute,
  };
}

/**
 * Date dont les accesseurs LOCAUX (getDay, getHours, getMinutes…) renvoient
 * l'heure murale de Paris, quel que soit le fuseau du runtime (UTC sur Vercel).
 * À passer aux fonctions qui lisent l'horloge locale, ex. `getShopStatus(hours, now)`.
 * Ce n'est PAS l'instant réel : ne pas la sérialiser ni la comparer à des dates en base.
 */
export function toParisWallClockDate(now: Date = new Date()): Date {
  const paris = getParisWallClock(now);
  return new Date(
    paris.year,
    paris.month - 1,
    paris.day,
    paris.hour,
    paris.minute,
    paris.second,
    now.getMilliseconds()
  );
}

/**
 * Premier créneau de retrait possible, en minutes depuis minuit :
 * maintenant + marge, arrondi vers le HAUT au prochain multiple de l'intervalle.
 * Intervalle 30 min : 13h09 → 13h30 | 13h22 → 14h00 | 14h05 → 14h30 | 14h31 → 15h00.
 */
export function earliestPickupMinutes(
  nowMinutesOfDay: number,
  intervalMin: number,
  marginMin: number = PICKUP_MARGIN_MIN
): number {
  const rawMin = nowMinutesOfDay + marginMin;
  const remainder = rawMin % intervalMin;
  return remainder === 0 ? rawMin : rawMin + intervalMin - remainder;
}

/** Décalage de Paris par rapport à UTC (en ms) à un instant donné : +1 h en hiver, +2 h en été. */
function parisOffsetMs(at: Date): number {
  const paris = getParisWallClock(at);
  const wallAsUtc = Date.UTC(paris.year, paris.month - 1, paris.day, paris.hour, paris.minute, paris.second);
  return wallAsUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * Instant réel correspondant à une heure murale de Paris.
 * `dateKey` = "YYYY-MM-DD", `minutesOfDay` = minutes depuis minuit (1440 = minuit du lendemain).
 * Sert à comparer un créneau « 13h30 à Paris » aux dates stockées en base (instants UTC).
 */
export function parisWallClockToUtc(dateKey: string, minutesOfDay: number): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const wallAsUtc = Date.UTC(year, month - 1, day, 0, minutesOfDay, 0, 0);
  // 1re passe : décalage estimé ; 2e passe : décalage à l'instant trouvé (changements d'heure).
  const estimate = wallAsUtc - parisOffsetMs(new Date(wallAsUtc));
  return new Date(wallAsUtc - parisOffsetMs(new Date(estimate)));
}
