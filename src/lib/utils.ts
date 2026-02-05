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
