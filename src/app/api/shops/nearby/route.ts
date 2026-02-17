// src/app/api/shops/nearby/route.ts — Shops by proximity (Haversine)
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(100).default(15),
});

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parseResult = nearbyQuerySchema.safeParse(params);

    if (!parseResult.success) {
      return apiError("VALIDATION_ERROR", "Paramètres lat/lng requis");
    }

    const { lat, lng, radius } = parseResult.data;

    // Haversine query with Prisma.$queryRaw (parameterized)
    const shops = await prisma.$queryRaw<
      Array<{
        id: string;
        slug: string;
        name: string;
        address: string;
        city: string;
        image_url: string | null;
        latitude: number | null;
        longitude: number | null;
        prep_time_min: number;
        busy_mode: boolean;
        busy_extra_min: number;
        status: string;
        rating: number;
        rating_count: number;
        delivery_radius: number;
        distance: number;
      }>
    >`SELECT
        s.id, s.slug, s.name, s.address, s.city, s.image_url,
        s.latitude, s.longitude,
        s.prep_time_min, s.busy_mode, s.busy_extra_min,
        s.status, s.rating, s.rating_count, s.delivery_radius,
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
      HAVING (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(${lat})) * cos(radians(s.latitude)) * cos(radians(s.longitude) - radians(${lng}))
          + sin(radians(${lat})) * sin(radians(s.latitude))
        ))
      )) <= ${radius}
      ORDER BY distance ASC`;

    // Also get shops without coordinates (show at end)
    const shopsWithoutCoords = await prisma.shop.findMany({
      where: {
        visible: true,
        OR: [{ latitude: null }, { longitude: null }],
      },
      select: {
        id: true, slug: true, name: true, address: true, city: true,
        imageUrl: true, latitude: true, longitude: true,
        prepTimeMin: true, busyMode: true, busyExtraMin: true,
        status: true, rating: true, ratingCount: true,
      },
      orderBy: { rating: "desc" },
    });

    // Normalize field names from raw SQL (snake_case → camelCase)
    const nearbyNormalized = shops.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      address: s.address,
      city: s.city,
      imageUrl: s.image_url,
      latitude: s.latitude,
      longitude: s.longitude,
      prepTimeMin: s.prep_time_min,
      busyMode: s.busy_mode,
      busyExtraMin: s.busy_extra_min,
      status: s.status,
      rating: s.rating,
      ratingCount: s.rating_count,
      distance: Math.round(Number(s.distance) * 10) / 10,
    }));

    const withoutCoordsNormalized = shopsWithoutCoords.map((s) => ({
      ...s,
      distance: null as number | null,
    }));

    return apiSuccess([...nearbyNormalized, ...withoutCoordsNormalized]);
  } catch (error) {
    return handleApiError(error, "shops/nearby");
  }
}
