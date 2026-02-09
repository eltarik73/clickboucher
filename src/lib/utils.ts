import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Design tokens
export const THEME = {
  burgundy: "#DC2626",
  burgundyLight: "#9B1B32",
  burgundyBg: "#FDF2F4",
  orange: "#E8630A",
  orangeLight: "#FFF3E6",
  green: "#16A34A",
  greenBg: "#F0FDF4",
  red: "#DC2626",
  redBg: "#FEF2F2",
} as const;

export function formatPrice(price: number): string {
  return price.toFixed(2).replace(".", ",") + " €";
}

export function formatShortTime(mins: number): string {
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h${String(m).padStart(2, "0")}`;
  }
  return `${mins} min`;
}

// Image placeholders
export const UNSPLASH = {
  products: [
    "https://images.unsplash.com/photo-1588347818481-07e015e9e8bc?w=400",
    "https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400",
    "https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=400",
    "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400",
    "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400",
    "https://images.unsplash.com/photo-1546964124-0cce460f38ef?w=400",
  ],
  shops: [
    "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400",
    "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400",
    "https://images.unsplash.com/photo-1588347818481-07e015e9e8bc?w=400",
  ],
  heroes: [
    "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800",
    "https://images.unsplash.com/photo-1588347818481-07e015e9e8bc?w=800",
  ],
};

// Format weight
export function formatWeight(grams: number): string {
  if (grams >= 1000) {
    return `${(grams / 1000).toFixed(1)} kg`;
  }
  return `${grams} g`;
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
