// PATCH /api/admin/shops/[shopId]/commission — Set per-shop commission
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request-body";
import { writeAuditLog } from "@/lib/audit-log";
import { FIELD_NOT_EDITABLE_HERE } from "@/lib/validators";
import { z } from "zod";

export const dynamic = "force-dynamic";

// One of the two writers of Shop.commissionPct (with /api/admin/commission/global), both audited.
const commissionSchema = z
  .object({
    commissionPct: z.number().min(0).max(100),
    commissionEnabled: z.boolean().optional(),
  })
  .strict(FIELD_NOT_EDITABLE_HERE);

export async function PATCH(req: NextRequest, { params }: { params: { shopId: string } }) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { shopId } = params;
    const data = commissionSchema.parse(await readJsonBody(req));

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true },
    });
    if (!shop) {
      return apiError("NOT_FOUND", "Boutique introuvable");
    }

    // Without commissionEnabled, only the rate changes: charging stays as it is.
    const updated = await prisma.shop.update({
      where: { id: shopId },
      data: {
        commissionPct: data.commissionPct,
        ...(data.commissionEnabled !== undefined && { commissionEnabled: data.commissionEnabled }),
      },
      select: { id: true, name: true, commissionPct: true, commissionEnabled: true },
    });

    await writeAuditLog({
      actorId: admin.userId,
      action: "shop.commission_change",
      target: "Shop",
      targetId: shopId,
      details: { commissionPct: data.commissionPct, enabled: data.commissionEnabled },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "admin/shops/commission");
  }
}
