// GET + PATCH /api/webmaster/config — Platform config management
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit-log";
import { invalidateConfig } from "@/lib/feature-flags";
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

    const body = await req.json();
    const data = updateConfigSchema.parse(body);

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
