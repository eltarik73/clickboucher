// src/lib/flags.ts — Country flag emoji mapping for product origins

const FLAG_MAP: Record<string, string> = {
  france: "\u{1F1EB}\u{1F1F7}",
  eu: "\u{1F1EA}\u{1F1FA}",
  espagne: "\u{1F1EA}\u{1F1F8}",
  irlande: "\u{1F1EE}\u{1F1EA}",
  belgique: "\u{1F1E7}\u{1F1EA}",
  allemagne: "\u{1F1E9}\u{1F1EA}",
  "nouvelle-zélande": "\u{1F1F3}\u{1F1FF}",
  "nouvelle-zelande": "\u{1F1F3}\u{1F1FF}",
  brésil: "\u{1F1E7}\u{1F1F7}",
  bresil: "\u{1F1E7}\u{1F1F7}",
  pologne: "\u{1F1F5}\u{1F1F1}",
  italie: "\u{1F1EE}\u{1F1F9}",
  uk: "\u{1F1EC}\u{1F1E7}",
  "royaume-uni": "\u{1F1EC}\u{1F1E7}",
  ecosse: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
  "pays-bas": "\u{1F1F3}\u{1F1F1}",
  argentine: "\u{1F1E6}\u{1F1F7}",
  australie: "\u{1F1E6}\u{1F1FA}",
};

/**
 * Get flag emoji for a country/origin string.
 * Matches the first word or known country name in the origin.
 */
export function getFlag(origin: string | null | undefined): string {
  if (!origin) return "\u{1F30D}"; // 🌍
  const lower = origin.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Try exact match first
  for (const [key, flag] of Object.entries(FLAG_MAP)) {
    const keyNorm = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (lower.includes(keyNorm)) return flag;
  }

  // Default
  return "\u{1F30D}"; // 🌍
}

/**
 * Get display name for origin (short version)
 * "France — Charolais" → "France"
 */
export function getOriginCountry(origin: string): string {
  const parts = origin.split(/\s*[—–-]\s*/);
  return parts[0].trim();
}

/**
 * Get origin detail (race, region)
 * "France — Charolais" → "Charolais"
 */
export function getOriginDetail(origin: string): string | null {
  const parts = origin.split(/\s*[—–-]\s*/);
  return parts.length > 1 ? parts.slice(1).join(" ").trim() : null;
}
