// src/lib/services/orders/order-shop.ts — the shop row an order is quoted and created from:
// throttling and preparation settings, minimum order, commission, and the publication facts
// (src/lib/shop-publication.ts) that decide whether the shop takes orders at all.
import type { Prisma } from "@prisma/client";

import { shopPublicationSelect } from "@/lib/shop-publication";

export const orderShopSelect = {
  id: true,
  name: true,
  address: true,
  city: true,
  autoAccept: true,
  acceptTimeoutMin: true,
  busyMode: true,
  busyExtraMin: true,
  prepTimeMin: true,
  maxOrdersPerSlot: true,
  maxOrdersPerHour: true,
  autoBusyThreshold: true,
  minOrderCents: true,
  commissionPct: true,
  commissionEnabled: true,
  ...shopPublicationSelect,
} satisfies Prisma.ShopSelect;

export type OrderShop = Prisma.ShopGetPayload<{ select: typeof orderShopSelect }>;
