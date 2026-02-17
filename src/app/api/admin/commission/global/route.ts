// PATCH /api/admin/commission/global — Set global commission for all shops
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

const globalCommissionSchema = z.object({
  commissionPct: z.number().min(0).max(100),
  commissionEnabled: z.boolean().optional().default(true),
});

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const body = await req.json();
    const data = globalCommissionSchema.parse(body);

    const result = await prisma.shop.updateMany({
      data: {
        commissionPct: data.commissionPct,
        commissionEnabled: data.commissionEnabled,
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
