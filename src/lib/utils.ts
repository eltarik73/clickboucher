import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { FONT_SIZE_SCALE, RADIUS_SCALE, SHADOW_SCALE } from "@/lib/design-tokens";

// Les noms d'échelle du thème (text-body, shadow-card, rounded-control…) sont déclarés à
// tailwind-merge depuis les mêmes objets que tailwind.config.ts : sans cela, text-body passe
// pour une couleur et efface text-primary-foreground.
const twMerge = extendTailwindMerge({
  extend: {
    theme: { borderRadius: Object.keys(RADIUS_SCALE) },
    classGroups: {
      "font-size": [{ text: Object.keys(FONT_SIZE_SCALE) }],
      shadow: [{ shadow: Object.keys(SHADOW_SCALE) }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}

export function formatShortTime(mins: number): string {
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h${String(m).padStart(2, "0")}`;
  }
  return `${mins} min`;
}

// Format weight
export function formatWeight(grams: number): string {
  if (grams >= 1000) {
    return `${(grams / 1000).toFixed(1)} kg`;
  }
  return `${grams} g`;
}

// Parse pagination from URL searchParams
export function parsePagination(params: URLSearchParams, defaults = { page: 1, perPage: 20 }) {
  const page = Math.max(1, parseInt(params.get("page") || String(defaults.page), 10) || defaults.page);
  const perPage = Math.min(100, Math.max(1, parseInt(params.get("perPage") || String(defaults.perPage), 10) || defaults.perPage));
  return { page, perPage, skip: (page - 1) * perPage };
}

// Format relative time
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `Il y a ${diffD}j`;
}
