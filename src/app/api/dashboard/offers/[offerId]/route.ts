// src/app/api/dashboard/offers/[offerId]/route.ts — Get, update, soft-delete offer (admin)
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { updateOfferSchema } from "@/lib/validations/offer";

export const dynamic = "force-dynamic";

type RouteContext = { params: { offerId: string } };

// ── GET — Single offer with relations ────────────────────────
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { offerId } = params;

    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        shop: { select: { id: true, name: true, slug: true } },
        proposals: {
          include: { shop: { select: { id: true, name: true } } },
        },
        eligibleProducts: {
          include: {
            product: {
              select: { id: true, name: true, imageUrl: true, priceCents: true },
            },
          },
        },
        _count: { select: { orders: true } },
      },
    });

    if (!offer) {
      return apiError("NOT_FOUND", "Offre introuvable");
    }

    return apiSuccess(offer);
  } catch (error) {
    return handleApiError(error, "dashboard/offers/[offerId] GET");
  }
}

// ── PATCH — Update offer ─────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { offerId } = params;

    const existing = await prisma.offer.findUnique({
      where: { id: offerId },
      select: { id: true },
    });
    if (!existing) {
      return apiError("NOT_FOUND", "Offre introuvable");
    }

    const body = await req.json();
    const data = updateOfferSchema.parse(body);

    // Build update payload, handling date fields
    const updateData: Record<string, unknown> = { ...data };
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);

    const offer = await prisma.offer.update({
      where: { id: offerId },
      data: updateData,
    });

    return apiSuccess(offer);
  } catch (error) {
    return handleApiError(error, "dashboard/offers/[offerId] PATCH");
  }
}

// ── DELETE — Soft delete (set status EXPIRED) ────────────────
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { offerId } = params;

    const existing = await prisma.offer.findUnique({
      where: { id: offerId },
      select: { id: true },
    });
    if (!existing) {
      return apiError("NOT_FOUND", "Offre introuvable");
    }

    const offer = await prisma.offer.update({
      where: { id: offerId },
      data: { status: "EXPIRED" },
    });

    return apiSuccess(offer);
  } catch (error) {
    return handleApiError(error, "dashboard/offers/[offerId] DELETE");
  }
}
