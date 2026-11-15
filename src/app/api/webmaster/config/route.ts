// GET + PATCH /api/webmaster/config — Platform config management. PATCH is the only writer of
// platform_config; the cap of a price adjustment (MAX_INCREASE_PCT_KEY) is held to its own rule.
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiError, apiSuccess, formatZodError, handleApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request-body";
import { writeAuditLog } from "@/lib/audit-log";
import { invalidateConfig } from "@/lib/feature-flags";
import { MAX_INCREASE_PCT_KEY, parseMaxIncreasePct } from "@/lib/price-adjustment-config";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET — All platform config values
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const configs = await prisma.platformConfig.findMany({
      orderBy: { key: "asc" },
    });

    return apiSuccess(configs);
  } catch (error) {
    return handleApiError(error, "webmaster/config");
  }
}

const updateConfigSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().max(1000),
});

// PATCH — Update a single config value
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const parsed = updateConfigSchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Données invalides", formatZodError(parsed.error));
    }
    const data = parsed.data;
    if (data.key === MAX_INCREASE_PCT_KEY) {
      const cap = parseMaxIncreasePct(data.value);
      if (!cap.success) {
        const messages = cap.error.issues.map((issue) => issue.message);
        return apiError("VALIDATION_ERROR", messages[0], { value: messages });
      }
    }

    const existing = await prisma.platformConfig.findUnique({
      where: { key: data.key },
    });

    const updated = await prisma.platformConfig.upsert({
      where: { key: data.key },
      update: { value: data.value },
      create: { key: data.key, value: data.value },
    });

    invalidateConfig(data.key);

    await writeAuditLog({
      actorId: admin.userId,
      action: "config.update",
      target: "PlatformConfig",
      targetId: data.key,
      details: { from: existing?.value || null, to: data.value },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "webmaster/config/patch");
  }
}
