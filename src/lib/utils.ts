import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Design tokens
export const THEME = {
  burgundy: "#7A1023",
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
export const UNSPLASH = "https://images.unsplash.com/photo-";

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
