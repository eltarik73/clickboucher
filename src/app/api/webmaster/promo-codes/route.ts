// GET/POST /api/webmaster/promo-codes — Webmaster promo code management
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ── GET — List all promo codes (platform + shop) ──
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const scope = req.nextUrl.searchParams.get("scope"); // PLATFORM | SHOP | all
    const status = req.nextUrl.searchParams.get("status"); // ACTIVE | PAUSED | EXPIRED | all

    const codes = await prisma.promoCode.findMany({
      where: {
        ...(scope && scope !== "all" ? { scope: scope as "PLATFORM" | "SHOP" | "LOYALTY" } : {}),
        ...(status && status !== "all" ? { status: status as "ACTIVE" | "PAUSED" | "EXPIRED" | "DRAFT" | "ARCHIVED" } : {}),
      },
      include: {
        shop: { select: { id: true, name: true, slug: true } },
        campaign: { select: { id: true, name: true } },
        _count: { select: { usages: true, orders: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Stats
    const stats = {
      total: codes.length,
      active: codes.filter((c) => c.status === "ACTIVE").length,
      platform: codes.filter((c) => c.scope === "PLATFORM").length,
      shop: codes.filter((c) => c.scope === "SHOP").length,
      totalUsages: codes.reduce((sum, c) => sum + c.currentUses, 0),
    };

    return apiSuccess({ codes, stats });
  } catch (error) {
    return handleApiError(error, "webmaster/promo-codes/GET");
  }
}

const createSchema = z.object({
  code: z.string().min(3).max(30).transform((v) => v.toUpperCase().trim()),
  discountType: z.enum(["PERCENT", "FIXED", "FREE_FEES"]),
  valueCents: z.number().int().min(0).optional(),
  valuePercent: z.number().min(0).max(100).optional(),
  scope: z.enum(["PLATFORM", "SHOP"]),
  shopId: z.string().optional(), // Required if scope=SHOP
  label: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  audience: z.enum(["ALL", "NEW_CLIENTS", "LOYAL_CLIENTS", "INACTIVE_CLIENTS", "PRO_CLIENTS"]).default("ALL"),
  minOrderCents: z.number().int().min(0).optional(),
  maxDiscountCents: z.number().int().min(0).optional(),
  maxUses: z.number().int().min(1).optional(),
  maxUsesPerUser: z.number().int().min(1).default(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  isFlash: z.boolean().default(false),
  campaignId: z.string().optional(),
});

// ── POST — Create promo code (platform or for a specific shop) ──
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const body = await req.json();
    const data = createSchema.parse(body);

    if (data.scope === "SHOP" && !data.shopId) {
      return apiError("VALIDATION_ERROR", "shopId requis pour un code boutique");
    }

    // Check code uniqueness
    const existing = await prisma.promoCode.findUnique({ where: { code: data.code } });
    if (existing) {
      return apiError("VALIDATION_ERROR", "Ce code promo existe déjà");
    }

    const promoCode = await prisma.promoCode.create({
      data: {
        code: data.code,
        discountType: data.discountType,
        valueCents: data.valueCents,
        valuePercent: data.valuePercent,
        scope: data.scope,
        shopId: data.shopId,
        label: data.label,
        description: data.description,
        audience: data.audience,
        minOrderCents: data.minOrderCents,
        maxDiscountCents: data.maxDiscountCents,
        maxUses: data.maxUses,
        maxUsesPerUser: data.maxUsesPerUser,
        status: "ACTIVE",
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        isFlash: data.isFlash,
        createdById: auth.userId,
        campaignId: data.campaignId,
      },
    });

    return apiSuccess(promoCode);
  } catch (error) {
    return handleApiError(error, "webmaster/promo-codes/POST");
  }
}
