// PATCH /api/boucher/opt-ins/[id] — Accept or reject a proposal
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  action: z.enum(["accept", "reject"]),
  rejectedReason: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const { id } = await ctx.params;
    const optIn = await prisma.butcherOptIn.findFirst({
      where: { id, shopId: auth.shopId },
      include: { campaign: { select: { promoCodes: true } } },
    });
    if (!optIn) return apiError("NOT_FOUND", "Proposition introuvable");
    if (optIn.status !== "PENDING") {
      return apiError("VALIDATION_ERROR", "Cette proposition a déjà été traitée");
    }

    const body = await req.json();
    const { action, rejectedReason } = schema.parse(body);

    const updated = await prisma.butcherOptIn.update({
      where: { id },
      data: {
        status: action === "accept" ? "ACCEPTED" : "REJECTED",
        respondedAt: new Date(),
        ...(action === "reject" && rejectedReason ? { rejectedReason } : {}),
      },
    });

    // If accepted, activate campaign promo codes for this shop
    if (action === "accept" && optIn.campaign.promoCodes.length > 0) {
      for (const pc of optIn.campaign.promoCodes) {
        // Clone the platform promo code as a shop-scoped one if needed
        // or just make sure the platform code includes this shop
        await prisma.promoCode.update({
          where: { id: pc.id },
          data: { status: "ACTIVE" },
        });
      }
    }

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "boucher/opt-ins/PATCH");
  }
}
