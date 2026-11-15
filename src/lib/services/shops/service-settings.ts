// src/lib/services/shops/service-settings.ts — the service settings of a shop (status, preparation
// time, busy extra, auto-accept, hourly cap, adjustment threshold), read and written by its owner
// or an admin through /api/boucher/service and PATCH /api/shops/[id]/status.
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import prisma from "@/lib/prisma";
import type { updateServiceSchema } from "@/lib/validators";
import { writeOwnerShop, type OwnerShopWrite } from "./owner-write";

const serviceSelect = {
  id: true,
  busyMode: true,
  busyExtraMin: true,
  paused: true,
  status: true,
  prepTimeMin: true,
  autoAccept: true,
  maxOrdersPerHour: true,
  priceAdjustmentThreshold: true,
} as const satisfies Prisma.ShopSelect;

type ServiceRow = Prisma.ShopGetPayload<{ select: typeof serviceSelect }>;

export type ShopServiceSettings = ServiceRow & { effectivePrepTime: number };

function toServiceSettings(shop: ServiceRow): ShopServiceSettings {
  return { ...shop, effectivePrepTime: shop.prepTimeMin + (shop.busyMode ? shop.busyExtraMin : 0) };
}

export async function readShopService(shopId: string): Promise<ShopServiceSettings | null> {
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: serviceSelect });
  return shop && toServiceSettings(shop);
}

/** Refused on a suspended shop (owner-write.ts); the settings are read back in the same transaction. */
export async function updateShopService(
  shopId: string,
  data: z.infer<typeof updateServiceSchema>
): Promise<{ ok: true; service: ShopServiceSettings } | Extract<OwnerShopWrite, { ok: false }>> {
  return prisma.$transaction(async (tx) => {
    const write = await writeOwnerShop(tx, shopId, data);
    if (!write.ok) return write;
    const shop = await tx.shop.findUniqueOrThrow({ where: { id: shopId }, select: serviceSelect });
    return { ok: true, service: toServiceSettings(shop) };
  });
}
