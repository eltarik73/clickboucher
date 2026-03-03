// GET/PATCH/DELETE /api/dashboard/offers/[offerId]
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { updateOfferSchema } from "@/lib/validations/offer";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { offerId: string } }) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const offer = await prisma.offer.findUnique({
      where: { id: params.offerId },
      include: {
        shop: { select: { id: true, name: true, slug: true } },
        proposals: { include: { shop: { select: { id: true, name: true, slug: true } } } },
        eligibleProducts: { include: { product: { select: { id: true, name: true, priceCents: true, imageUrl: true } } } },
        _count: { select: { orders: true } },
      },
    });

    if (!offer) return apiError("NOT_FOUND", "Offre introuvable");
    return apiSuccess(offer);
  } catch (error) {
    return handleApiError(error, "dashboard/offers/[offerId]/GET");
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { offerId: string } }) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const body = await req.json();
    const data = updateOfferSchema.parse(body);

    const offer = await prisma.offer.findUnique({ where: { id: params.offerId } });
    if (!offer) return apiError("NOT_FOUND", "Offre introuvable");

    const updated = await prisma.offer.update({
      where: { id: params.offerId },
      data: {
        ...data,
        ...(data.startDate ? { startDate: new Date(data.startDate) } : {}),
        ...(data.endDate ? { endDate: new Date(data.endDate) } : {}),
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "dashboard/offers/[offerId]/PATCH");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { offerId: string } }) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const offer = await prisma.offer.findUnique({ where: { id: params.offerId } });
    if (!offer) return apiError("NOT_FOUND", "Offre introuvable");

    // Soft delete
    const updated = await prisma.offer.update({
      where: { id: params.offerId },
      data: { status: "EXPIRED" },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "dashboard/offers/[offerId]/DELETE");
  }
}
