// src/lib/product-snooze.ts — Deliveroo-style product snooze system
import prisma from "./prisma";
import type { SnoozeType } from "@prisma/client";

export async function snoozeProduct(
  productId: string,
  type: SnoozeType,
  reason?: string
) {
  let snoozeEndsAt: Date | null = null;

  switch (type) {
    case "ONE_HOUR":
      snoozeEndsAt = new Date(Date.now() + 60 * 60 * 1000);
      break;
    case "TWO_HOURS":
      snoozeEndsAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      break;
    case "END_OF_DAY":
      snoozeEndsAt = new Date();
      snoozeEndsAt.setHours(23, 59, 59, 999);
      break;
    case "INDEFINITE":
      snoozeEndsAt = null;
      break;
    case "CUSTOM":
      // Custom date handled by caller
      break;
    case "NONE":
      // Unsnooze
      break;
  }

  if (type === "NONE") {
    await prisma.product.update({
      where: { id: productId },
      data: {
        snoozeType: "NONE",
        snoozedAt: null,
        snoozeEndsAt: null,
        snoozeReason: null,
        inStock: true,
      },
    });
  } else {
    await prisma.product.update({
      where: { id: productId },
      data: {
        snoozeType: type,
        snoozedAt: new Date(),
        snoozeEndsAt,
        snoozeReason: reason || null,
        inStock: false,
      },
    });
  }
}

/**
 * Unsnooze all products whose timer has expired.
 * Called by cron every 5 minutes.
 */
export async function unsnoozeExpiredProducts(): Promise<number> {
  const now = new Date();
  const result = await prisma.product.updateMany({
    where: {
      snoozeType: { not: "NONE" },
      snoozeEndsAt: { not: null, lte: now },
    },
    data: {
      snoozeType: "NONE",
      snoozedAt: null,
      snoozeEndsAt: null,
      snoozeReason: null,
      inStock: true,
    },
  });
  return result.count;
}

/**
 * Format remaining snooze time for display
 */
export function formatSnoozeRemaining(endsAt: Date | null, type: string): string {
  if (type === "INDEFINITE" || !endsAt) return "Indisponible";
  const diff = endsAt.getTime() - Date.now();
  if (diff <= 0) return "Bientôt disponible";
  const min = Math.floor(diff / 60000);
  if (min < 60) return `Retour dans ${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return `Retour dans ${h}h${m > 0 ? `${m}min` : ""}`;
  return "Retour demain";
}
