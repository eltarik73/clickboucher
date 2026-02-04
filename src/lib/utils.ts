import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format price in EUR
 */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

/**
 * Format weight display
 */
export function formatWeight(grams: number): string {
  if (grams >= 1000) {
    return `${(grams / 1000).toFixed(1).replace(".0", "")} kg`;
  }
  return `${grams} g`;
}

/**
 * Format relative time (e.g., "il y a 5 min", "dans 10 min")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (Math.abs(diffMin) < 1) return "à l'instant";
  if (diffMin > 0) return `dans ${diffMin} min`;
  return `il y a ${Math.abs(diffMin)} min`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "…";
}

/**
 * Generate initials from a name
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Placeholder Unsplash URLs for seed data (arrays for indexed access)
 */
export const UNSPLASH = {
  shops: [
    "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=900&q=85&auto=format",
    "https://images.unsplash.com/photo-1545468800-85cc9bc6ecf7?w=900&q=85&auto=format",
    "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=900&q=85&auto=format",
  ],
  products: [
    "https://images.unsplash.com/photo-1558030006-450675393462?w=600&q=85&auto=format",
    "https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=600&q=85&auto=format",
    "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=85&auto=format",
    "https://images.unsplash.com/photo-1599921841143-819065a55cc6?w=600&q=85&auto=format",
    "https://images.unsplash.com/photo-1623238912680-26fc5ffb57e4?w=600&q=85&auto=format",
    "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=600&q=85&auto=format",
    "https://images.unsplash.com/photo-1608039829572-4885a8b1e1d8?w=600&q=85&auto=format",
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=85&auto=format",
  ],
  packs: [
    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=600&q=85&auto=format",
    "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&q=85&auto=format",
  ],
  offers: [
    "https://images.unsplash.com/photo-1551028150-64b9f398f678?w=600&q=85&auto=format",
  ],
} as const;
