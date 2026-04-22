// GET /api/boucher/images/gallery — Boucher AI image gallery (shop-scoped, paginated, filterable)
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError, apiError, formatZodError } from "@/lib/api/errors";

const ALLOWED_MODELS = ["PEXELS_SEARCH", "UNSPLASH_SEARCH", "FLUX_SCHNELL", "FLUX_KONTEXT"] as const;
const ALLOWED_USAGE = ["CAMPAIGN", "PROMO", "PRODUCT", "SOCIAL", "BANNER"] as const;

const querySchema = z.object({
  cursor: z.string().trim().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  usage: z.enum(ALLOWED_USAGE).optional(),
  model: z.enum(ALLOWED_MODELS).optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const sp = req.nextUrl.searchParams;
    const parsed = querySchema.safeParse({
      cursor: sp.get("cursor") || undefined,
      limit: sp.get("limit") || undefined,
      usage: sp.get("usage") || undefined,
      model: sp.get("model") || undefined,
      q: sp.get("q") || undefined,
    });
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Parametres invalides", formatZodError(parsed.error));
    }

    const { cursor, usage, model, q } = parsed.data;
    const limit = parsed.data.limit ?? 24;

    const where = {
      shopId: auth.shopId,
      ...(usage ? { usage } : {}),
      ...(model ? { model } : {}),
      ...(q ? { prompt: { contains: q, mode: "insensitive" as const } } : {}),
    };

    const [images, total] = await Promise.all([
      prisma.generatedImage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      prisma.generatedImage.count({ where }),
    ]);

    const hasMore = images.length > limit;
    const page = hasMore ? images.slice(0, limit) : images;
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

    return apiSuccess({ images: page, nextCursor, total });
  } catch (err) {
    return handleApiError(err, "boucher/images/gallery");
  }
}
