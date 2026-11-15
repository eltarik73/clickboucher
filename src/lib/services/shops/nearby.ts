// src/lib/services/shops/nearby.ts — the home shop list sorted by distance (GET /api/shops/nearby):
// visible shops within the radius, nearest first, then up to 20 visible shops without coordinates,
// all as list-page shop cards (src/lib/seo/shop-cards.ts) with their distance and badge offer.
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { badgeLabelsByShop } from "@/lib/offer-badge-label";
import { listBadgeOffers } from "@/lib/public-offers";
import {
  shopCardOrderBy,
  shopCardSelect,
  toShopCards,
  type ShopCardOf,
} from "@/lib/seo/shop-cards";

const nearbyShopSelect = {
  ...shopCardSelect,
  latitude: true,
  longitude: true,
} as const satisfies Prisma.ShopSelect;

type NearbyShopRow = Prisma.ShopGetPayload<{ select: typeof nearbyShopSelect }>;

export type NearbyShopCard = ShopCardOf<NearbyShopRow> & {
  /** Kilometres from the position, to 0.1 km; null for a shop without coordinates. */
  distance: number | null;
  activePromo: string | null;
};

/** Visible shops with coordinates within `radiusKm` (Haversine, in km), nearest first. */
function shopsWithin({ lat, lng, radiusKm }: { lat: number; lng: number; radiusKm: number }) {
  // Bounding box first (1 degree of latitude ~ 111 km, a degree of longitude shrinks with the
  // latitude), so that the coordinates index filters before the trigonometry.
  const deltaLat = radiusKm / 111.0;
  const deltaLng = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));
  // The columns of nearbyShopSelect, under their Prisma names.
  return prisma.$queryRaw<(NearbyShopRow & { distance: number })[]>`
    SELECT * FROM (
      SELECT
        s.id, s.slug, s.name, s.address, s.city, s.image_url AS "imageUrl",
        s.prep_time_min AS "prepTimeMin", s.busy_mode AS "busyMode",
        s.busy_extra_min AS "busyExtraMin", s.status, s.opening_hours AS "openingHours",
        s.latitude, s.longitude,
        (6371 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(${lat})) * cos(radians(s.latitude)) * cos(radians(s.longitude) - radians(${lng}))
            + sin(radians(${lat})) * sin(radians(s.latitude))
          ))
        )) AS distance
      FROM shops s
      WHERE s.visible = true
        AND s.latitude IS NOT NULL
        AND s.longitude IS NOT NULL
        AND s.latitude BETWEEN ${lat - deltaLat} AND ${lat + deltaLat}
        AND s.longitude BETWEEN ${lng - deltaLng} AND ${lng + deltaLng}
    ) sub
    WHERE sub.distance <= ${radiusKm}
    ORDER BY sub.distance ASC`;
}

/**
 * The shop cards around `position`: nearest first, then the shops without coordinates in the
 * list-page order; a shop with a public badge offer moves to the front, order kept otherwise.
 */
export async function listNearbyShops(
  position: { lat: number; lng: number; radiusKm: number },
  now: Date
): Promise<NearbyShopCard[]> {
  const [withCoordinates, withoutCoordinates] = await Promise.all([
    shopsWithin(position),
    prisma.shop.findMany({
      where: { visible: true, OR: [{ latitude: null }, { longitude: null }] },
      select: nearbyShopSelect,
      orderBy: shopCardOrderBy(),
      take: 20,
    }),
  ]);
  const rows: (NearbyShopRow & { distance: number | null })[] = [
    ...withCoordinates.map((row) => ({ ...row, distance: Math.round(row.distance * 10) / 10 })),
    ...withoutCoordinates.map((row) => ({ ...row, distance: null })),
  ];

  const ids = rows.map((row) => row.id);
  const [cards, offers] = await Promise.all([
    toShopCards(rows),
    ids.length > 0 ? listBadgeOffers(now, 200, ids) : [],
  ]);
  const promos = badgeLabelsByShop(offers);
  return cards
    .map((card) => ({ ...card, activePromo: promos.get(card.id) ?? null }))
    .sort((a, b) => Number(b.activePromo !== null) - Number(a.activePromo !== null));
}
