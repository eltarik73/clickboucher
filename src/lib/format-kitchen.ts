// src/lib/format-kitchen.ts — Pure formatters used in the Kitchen Mode UI.
// Extracted from KitchenOrderCard / OrderTicket so they can be unit-tested
// without booting React/jsdom and so the logic is shared instead of duplicated.

/**
 * Format a client name as "Firstname.L" (e.g. "tarik" + "boudefar" → "Tarik.B").
 * Falls back to "Client" when no first name is provided.
 */
export function formatClientName(firstName: string, lastName: string): string {
  if (!firstName) return "Client";
  const first =
    firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : "";
  return lastInitial ? `${first}.${lastInitial}` : first;
}

/**
 * Format a price stored in cents as "12,34 €" (French locale, comma decimal).
 * The euro sign is emitted via the € escape to mirror the original
 * components verbatim and keep diff-able call sites identical.
 */
export function formatPriceCents(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}

/**
 * Map a Prisma `Unit` enum value to its short display label.
 * Unknown units fall through to "barq." to mirror the original component behavior.
 */
export function formatUnit(unit: string): string {
  if (unit === "KG") return "kg";
  if (unit === "PIECE") return "pc";
  if (unit === "TRANCHE") return "tr.";
  return "barq.";
}

/** True if the pickup time string is the special "ASAP" marker. */
export function isAsapTime(timeStr: string | null): boolean {
  if (!timeStr) return false;
  return timeStr.toLowerCase() === "asap";
}

/**
 * Format an ISO datetime string as "HH:MM" in fr-FR locale.
 * Pure wrapper around toLocaleTimeString — extracted only so callers can test it.
 */
export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format the elapsed duration since `dateStr` until `now` (default Date.now).
 * Returns "< 1 min", "N min", or "Hh MM".
 *
 * `now` is injectable so the test suite is deterministic — production callers
 * can omit it and use the wall clock as before.
 */
export function timeSince(dateStr: string, now: number = Date.now()): string {
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}`;
}

/**
 * Format a countdown (in milliseconds) before an upcoming pickup time.
 * Returns "Maintenant" once we hit zero, "Dans N min" under an hour,
 * "Dans Xh" / "Dans Xh MM" otherwise.
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Maintenant";
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 60) return `Dans ${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `Dans ${h}h${String(m).padStart(2, "0")}` : `Dans ${h}h`;
}
