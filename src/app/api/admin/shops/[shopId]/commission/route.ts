// PATCH /api/admin/shops/[shopId]/commission — Set per-shop commission
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

const commissionSchema = z.object({
  commissionPct: z.number().min(0).max(100),
  commissionEnabled: z.boolean().optional(),
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
    const data = commissionSchema.parse(body);

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true },
    });
    if (!shop) {
      return apiError("NOT_FOUND", "Boutique introuvable");
    }

    const updated = await prisma.shop.update({
      where: { id: shopId },
      data: {
        commissionPct: data.commissionPct,
        commissionEnabled: data.commissionEnabled ?? true,
      },
      select: { id: true, name: true, commissionPct: true, commissionEnabled: true },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "admin/shops/commission");
  }
}
