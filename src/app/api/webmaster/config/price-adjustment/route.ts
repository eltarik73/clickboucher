// GET + PATCH /api/webmaster/config/price-adjustment — the platform's setting of price adjustments,
// for admins: the safety cap of one adjustment in % of the order's current total
// (pa_max_increase_pct), the only setting left (src/lib/price-adjustment-config.ts). PATCH takes
// that key alone; any other key is refused.
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request-body";
import { writeAuditLog } from "@/lib/audit-log";
import { invalidateConfig } from "@/lib/feature-flags";
import { getPriceAdjConfig } from "@/lib/price-adjustment";
import { maxIncreasePctSchema, PA_KEYS } from "@/lib/price-adjustment-config";
import prisma from "@/lib/prisma";

const updateSchema = z
  .object({ maxIncreasePct: maxIncreasePctSchema })
  .strict("Seul le plafond d'un ajustement est réglable");

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const config = await getPriceAdjConfig();
    return apiSuccess(config);
  } catch (error) {
    return handleApiError(error, "webmaster/config/price-adjustment");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { maxIncreasePct } = updateSchema.parse(await readJsonBody(req));
    const key = PA_KEYS.maxIncreasePct;
    const value = String(maxIncreasePct);
    const existing = await prisma.platformConfig.findUnique({
      where: { key },
      select: { value: true },
    });
    await prisma.platformConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    invalidateConfig(key);
    await writeAuditLog({
      actorId: admin.userId,
      action: "config.update",
      target: "PlatformConfig",
      targetId: key,
      details: { from: existing?.value ?? null, to: value },
    });

    return apiSuccess(await getPriceAdjConfig());
  } catch (error) {
    return handleApiError(error, "webmaster/config/price-adjustment/PATCH");
  }
}
