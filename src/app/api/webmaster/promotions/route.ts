// /api/webmaster/promotions — Platform promo management (source=PLATFORM)
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET — List all promotions (platform + shop) with stats
export async function GET() {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult && authResult.error) return authResult.error;

    const promotions = await prisma.promotion.findMany({
      orderBy: { createdAt: "desc" },
      include: { shop: { select: { name: true, slug: true } } },
    });

    // Stats
    const activeCount = promotions.filter(
      (p) => p.isActive && new Date(p.endsAt) > new Date()
    ).length;
    const platformCount = promotions.filter((p) => p.source === "PLATFORM").length;
    const shopCount = promotions.filter((p) => p.source === "SHOP").length;
    const totalUses = promotions.reduce((sum, p) => sum + p.currentUses, 0);

    return apiSuccess({
      promotions,
      stats: { activeCount, platformCount, shopCount, totalUses },
    });
  } catch (error) {
    return handleApiError(error, "webmaster/promotions/GET");
  }
}

// POST — Create a platform promotion
const createSchema = z.object({
  type: z.enum(["PERCENT", "FIXED", "FREE_FEES"]),
  valueCents: z.number().int().min(0).optional(),
  valuePercent: z.number().min(0).max(100).optional(),
  label: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  target: z.enum(["ALL", "LOYAL", "INACTIVE", "SPECIFIC_PRODUCTS"]).default("ALL"),
  targetProductIds: z.array(z.string()).default([]),
  minOrderCents: z.number().int().min(0).optional(),
  maxUses: z.number().int().min(1).optional(),
  maxUsesPerUser: z.number().int().min(1).default(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  code: z.string().min(3).max(30).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult && authResult.error) return authResult.error;

    const body = await req.json();
    const data = createSchema.parse(body);

    const promotion = await prisma.promotion.create({
      data: {
        source: "PLATFORM",
        shopId: null,
        createdById: authResult.userId,
        type: data.type,
        valueCents: data.valueCents,
        valuePercent: data.valuePercent,
        label: data.label,
        description: data.description,
        target: data.target,
        targetProductIds: data.targetProductIds,
        minOrderCents: data.minOrderCents,
        maxUses: data.maxUses,
        maxUsesPerUser: data.maxUsesPerUser,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        code: data.code?.toUpperCase() || null,
        isActive: true,
      },
    });

    return apiSuccess(promotion);
  } catch (error) {
    return handleApiError(error, "webmaster/promotions/POST");
  }
}
