// Titles and generated descriptions of the programmatic SEO pages.
//
// Titles are written before the « | Klik&Go » suffix the root layout adds, and stay within
// TITLE_MAX characters: the tagline (« Click & collect », « Sans abonnement ») is dropped when
// it does not fit. They carry the search keyword and nothing the page cannot back.
// City descriptions are hand-written in the city data; the descriptions generated here are
// true with zero shop in the city and state no fee, payment, delay, certification or count.

import { SEO_CITIES, type SeoCity, type SeoDepartment } from "@/lib/seo/cities";
import type { SeoDistrict } from "@/lib/seo/districts";
import type { SeoProduct } from "@/lib/seo/products";
import type { SeoOccasion } from "@/lib/seo/occasions";

export const TITLE_MAX = 60;
export const DESCRIPTION_MIN = 140;
export const DESCRIPTION_MAX = 160;

const CLICK_AND_COLLECT = "Click & collect";
const ELLIPSIS = "…";
// Characters that must not end a cut text (before the ellipsis).
const TRAILING_PUNCTUATION = /[\s,;:—–-]+$/u;

function normalizeSpaces(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

/**
 * The text with its spaces normalized, cut on a word boundary and ended with « … » when it is
 * longer than max. Never cuts a word; throws a RangeError when the first word alone is longer
 * than max (no honest cut exists).
 */
export function clampDescription(text: string, max: number = DESCRIPTION_MAX): string {
  const normalized = normalizeSpaces(text);
  if (normalized.length <= max) return normalized;
  const room = max - ELLIPSIS.length;
  const lastSpace = normalized.lastIndexOf(" ", room);
  const kept =
    lastSpace > 0 ? normalized.slice(0, lastSpace).replace(TRAILING_PUNCTUATION, "") : "";
  if (kept.length === 0) {
    throw new RangeError(
      `Cannot shorten "${normalized.slice(0, 40)}…" to ${max} characters on a word`
    );
  }
  return `${kept}${ELLIPSIS}`;
}

function fitTitle(main: string, tagline?: string): string {
  if (tagline !== undefined) {
    const withTagline = `${main} — ${tagline}`;
    if (withTagline.length <= TITLE_MAX) return withTagline;
  }
  return clampDescription(main, TITLE_MAX);
}

/** The label followed by « halal », unless it already contains the word (no « halal halal »). */
function withHalal(label: string): string {
  return /(^|[^\p{L}])halal($|[^\p{L}])/iu.test(label) ? label : `${label} halal`;
}

/**
 * The core sentence followed by the first alternative that still fits within DESCRIPTION_MAX.
 * The alternatives say the same thing at decreasing lengths, so the result lands between
 * DESCRIPTION_MIN and DESCRIPTION_MAX for every name of the data (pinned by
 * src/lib/__tests__/seo/titles.test.ts).
 */
function composeDescription(core: string, alternatives: readonly string[]): string {
  const base = normalizeSpaces(core);
  const fitting = alternatives.find(
    (sentence) => base.length + 1 + sentence.length <= DESCRIPTION_MAX
  );
  return clampDescription(fitting === undefined ? base : `${base} ${fitting}`, DESCRIPTION_MAX);
}

// French locative of each department name (« en Savoie », « dans le Rhône »).
const DEPARTMENT_LOCATIVES: Readonly<Record<string, string>> = {
  savoie: "en Savoie",
  "haute-savoie": "en Haute-Savoie",
  isere: "en Isère",
  rhone: "dans le Rhône",
  loire: "dans la Loire",
};

/** « en Savoie », « dans le Rhône »… Throws for a department without a known locative. */
export function departmentLocative(dept: SeoDepartment): string {
  const locative = DEPARTMENT_LOCATIVES[dept.slug];
  if (locative === undefined) {
    throw new Error(`No French locative for the department "${dept.slug}": add it to titles.ts`);
  }
  return locative;
}

/** Number of city pages of a department (its cities that exist in SEO_CITIES). */
export function departmentCityCount(dept: SeoDepartment): number {
  return SEO_CITIES.filter((city) => dept.citySlugs.includes(city.slug)).length;
}

export function cityTitle(city: SeoCity): string {
  return fitTitle(`Boucherie halal ${city.name}`, CLICK_AND_COLLECT);
}

export function districtTitle(district: SeoDistrict): string {
  return fitTitle(`Boucherie halal ${district.name} (${district.cityName})`, CLICK_AND_COLLECT);
}

export function departmentTitle(dept: SeoDepartment): string {
  const count = departmentCityCount(dept);
  return fitTitle(
    `Boucheries halal ${departmentLocative(dept)}`,
    `${count} ${count > 1 ? "villes" : "ville"}`
  );
}

export function sundayTitle(city: SeoCity): string {
  return fitTitle(`Boucherie halal ouverte le dimanche à ${city.name}`);
}

export function sundayDescription(city: SeoCity): string {
  return composeDescription(
    `Boucherie halal ouverte le dimanche à ${city.name} : consultez les horaires des boutiques inscrites sur Klik&Go.`,
    [
      "Commandez en ligne et retirez votre commande en boutique au créneau choisi.",
      "Commandez en ligne, retrait en boutique au créneau choisi.",
      "Retrait en boutique au créneau choisi.",
    ]
  );
}

export function productCityTitle(product: SeoProduct, city: SeoCity): string {
  return fitTitle(`${withHalal(product.name)} à ${city.name}`, CLICK_AND_COLLECT);
}

export function productCityDescription(product: SeoProduct, city: SeoCity): string {
  return composeDescription(
    `${withHalal(product.name)} à ${city.name} : commandez en ligne auprès d'une boucherie halal inscrite sur Klik&Go.`,
    [
      "Retirez votre commande en boutique au créneau choisi.",
      "Retrait en boutique au créneau choisi.",
      "Retrait au créneau choisi.",
    ]
  );
}

export function occasionCityTitle(occasion: SeoOccasion, city: SeoCity): string {
  return fitTitle(`${withHalal(occasion.name)} à ${city.name}`, CLICK_AND_COLLECT);
}

export function occasionCityDescription(occasion: SeoOccasion, city: SeoCity): string {
  return composeDescription(
    `${occasion.name} à ${city.name} : viande halal, quantités par personne et conseils pour commander à temps.`,
    [
      "Commande en ligne sur Klik&Go et retrait en boutique au créneau choisi.",
      "Commande en ligne et retrait en boutique au créneau choisi.",
      "Retrait en boutique au créneau choisi.",
    ]
  );
}

export function partnerTitle(city: SeoCity): string {
  return fitTitle(`Boucher partenaire ${city.name}`, "Sans abonnement");
}

export function partnerDescription(city: SeoCity): string {
  return composeDescription(
    `Boucher halal à ${city.name} ? Proposez la commande en ligne et le retrait en boutique avec Klik&Go, sans abonnement.`,
    [
      "Vous gérez votre catalogue, vos prix et vos horaires.",
      "Vous gérez votre catalogue et vos prix.",
      "Inscription en ligne.",
    ]
  );
}
