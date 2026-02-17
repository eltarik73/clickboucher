// PATCH /api/admin/shops/[shopId]/plan — Change shop subscription plan
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

const changePlanSchema = z.object({
  plan: z.enum(["STARTER", "PRO", "PREMIUM"]),
  adminNote: z.string().max(500).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { shopId } = await params;
    const body = await req.json();
    const data = changePlanSchema.parse(body);

    const sub = await prisma.subscription.findUnique({ where: { shopId } });
    if (!sub) {
      return apiError("NOT_FOUND", "Aucun abonnement pour cette boutique");
    }

    const updated = await prisma.subscription.update({
      where: { shopId },
      data: {
        plan: data.plan,
        adminNote: data.adminNote ?? sub.adminNote,
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "admin/shops/plan");
  }
}
