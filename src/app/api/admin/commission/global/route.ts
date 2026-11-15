// PATCH /api/admin/commission/global — Set global commission for all shops
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request-body";
import { writeAuditLog } from "@/lib/audit-log";
import { FIELD_NOT_EDITABLE_HERE } from "@/lib/validators";
import { z } from "zod";

export const dynamic = "force-dynamic";

const globalCommissionSchema = z
  .object({
    commissionPct: z.number().min(0).max(100),
    commissionEnabled: z.boolean().optional().default(true),
  })
  .strict(FIELD_NOT_EDITABLE_HERE);

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const data = globalCommissionSchema.parse(await readJsonBody(req));

    const result = await prisma.shop.updateMany({
      data: {
        commissionPct: data.commissionPct,
        commissionEnabled: data.commissionEnabled,
      },
    });

    // Every shop's commission changed: traced like a per-shop change (shop.commission_change), so
    // a rate that matches no admin decision can be told from an admin's (commission-audit.readonly.sql).
    await writeAuditLog({
      actorId: admin.userId,
      action: "commission.global_change",
      target: "Shop",
      details: {
        commissionPct: data.commissionPct,
        commissionEnabled: data.commissionEnabled,
        updated: result.count,
      },
    });

    return apiSuccess({
      updated: result.count,
      commissionPct: data.commissionPct,
      commissionEnabled: data.commissionEnabled,
    });
  } catch (error) {
    return handleApiError(error, "admin/commission/global");
  }
}
