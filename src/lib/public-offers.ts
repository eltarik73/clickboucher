// src/lib/public-offers.ts — the promo codes a visitor may read on public pages (/bons-plans, the
// home page badges and popup, the shop banner and its offer products).
// Allow-list: an offer is public only when it is meant for everyone (audience ALL), its creator
// chose to diffuse it (badge, banner or popup), it is active in its window and it has uses left.
// A code created for a segment, a customer or a private campaign never reaches a public page.
// Every public query goes through publicOfferWhere. Server-only (Prisma).
import type { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";

/** Where an offer is diffused: the shop-card badge, the shop banner, the home-page popup. */
export type OfferChannel = "badge" | "banner" | "popup";

const CHANNEL_FLAG = {
  badge: { diffBadge: true },
  banner: { diffBanner: true },
  popup: { diffPopup: true },
} as const satisfies Record<OfferChannel, Prisma.OfferWhereInput>;

/** The public offers; with a channel, only those diffused on that channel. */
export function publicOfferWhere(now: Date, channel?: OfferChannel): Prisma.OfferWhereInput {
  return {
    status: "ACTIVE",
    audience: "ALL",
    startDate: { lte: now },
    endDate: { gt: now },
    AND: [
      channel ? CHANNEL_FLAG[channel] : { OR: Object.values(CHANNEL_FLAG) },
      { OR: [{ maxUses: null }, { currentUses: { lt: prisma.offer.fields.maxUses } }] },
    ],
  };
}

const publicOfferSelect = {
  id: true,
  name: true,
  type: true,
  discountValue: true,
  code: true,
  endDate: true,
  shop: { select: { name: true, slug: true } },
} as const satisfies Prisma.OfferSelect;

/** What a public page shows of an offer. */
export interface PublicOffer {
  id: string;
  label: string;
  description: null;
  type: string;
  valueCents: number | null;
  valuePercent: number | null;
  code: string;
  endsAt: string;
  shopName: string | null;
  shopSlug: string | null;
}

/** The public offers, newest first. */
export async function listPublicOffers(now: Date): Promise<PublicOffer[]> {
  const offers = await prisma.offer.findMany({
    where: publicOfferWhere(now),
    select: publicOfferSelect,
    orderBy: { createdAt: "desc" },
  });
  return offers.map((offer) => ({
    id: offer.id,
    label: offer.name,
    description: null,
    type: offer.type,
    valueCents: offer.type === "AMOUNT" ? Math.round(offer.discountValue * 100) : null,
    valuePercent: offer.type === "PERCENT" ? offer.discountValue : null,
    code: offer.code,
    endsAt: offer.endDate.toISOString(),
    shopName: offer.shop?.name ?? null,
    shopSlug: offer.shop?.slug ?? null,
  }));
}

/**
 * The offers shown as a badge on the shop cards (home page, GET /api/shops/nearby), newest first;
 * with shopIds, only those shops' own offers.
 */
export function listBadgeOffers(now: Date, take: number, shopIds?: readonly string[]) {
  const where = publicOfferWhere(now, "badge");
  return prisma.offer.findMany({
    where: shopIds ? { AND: [where, { shopId: { in: [...shopIds] } }] } : where,
    select: {
      id: true,
      name: true,
      type: true,
      discountValue: true,
      shopId: true,
      shop: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** The offers shown in the home-page popup, newest first. */
export function listPopupOffers(now: Date, take: number) {
  return prisma.offer.findMany({
    where: publicOfferWhere(now, "popup"),
    select: {
      id: true,
      name: true,
      code: true,
      type: true,
      discountValue: true,
      popupTitle: true,
      popupMessage: true,
      popupColor: true,
      popupFrequency: true,
      popupImageUrl: true,
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/**
 * The public offers of one shop (its own, and the platform offers it accepted), newest first, with
 * their banner and the shop's eligible products. The banner shows the first one diffused as a banner.
 */
export function listShopOffers(shopId: string, now: Date) {
  return prisma.offer.findMany({
    where: {
      AND: [
        publicOfferWhere(now),
        { OR: [{ shopId }, { proposals: { some: { shopId, status: "ACCEPTED" } } }] },
      ],
    },
    select: {
      id: true,
      name: true,
      code: true,
      type: true,
      discountValue: true,
      diffBanner: true,
      bannerTitle: true,
      bannerSubtitle: true,
      bannerColor: true,
      bannerImageUrl: true,
      eligibleProducts: {
        where: { shopId },
        select: {
          product: {
            select: { id: true, name: true, imageUrl: true, priceCents: true, unit: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
