// src/app/api/dashboard/offers/[offerId]/propose/route.ts — Propose offer to shops (admin)
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

type RouteContext = { params: { offerId: string } };

const proposeSchema = z.object({
  shopIds: z.array(z.string().min(1)).min(1, "Au moins une boutique requise"),
});

// ── POST — Create proposals for shops ────────────────────────
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { offerId } = params;

    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      select: { id: true },
    });
    if (!offer) {
      return apiError("NOT_FOUND", "Offre introuvable");
    }

    const body = await req.json();
    const data = proposeSchema.parse(body);

    const result = await prisma.offerProposal.createMany({
      data: data.shopIds.map((shopId) => ({
        offerId,
        shopId,
      })),
      skipDuplicates: true,
    });

    return apiSuccess({ created: result.count }, 201);
  } catch (error) {
    return handleApiError(error, "dashboard/offers/[offerId]/propose POST");
  }
}
