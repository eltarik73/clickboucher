import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit-log";
import { invalidateFlag } from "@/lib/feature-flags";
import { wmToggleFeatureFlagSchema } from "@/lib/validators";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const rl = await checkRateLimit(rateLimits.api, `wm-flag:${admin.userId}`);
    if (!rl.success) return apiError("RATE_LIMITED", "Trop de requêtes");

    const { key } = await params;
    const body = await request.json();
    const parsed = wmToggleFeatureFlagSchema.parse(body);

    const flag = await prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) {
      return apiError("NOT_FOUND", `Flag "${key}" introuvable`);
    }

    const updated = await prisma.featureFlag.update({
      where: { key },
      data: { enabled: parsed.enabled },
    });

    // Invalidate cache
    invalidateFlag(key);

    // Audit log
    await writeAuditLog({
      actorId: admin.userId,
      action: parsed.enabled ? "flag.enable" : "flag.disable",
      target: "FeatureFlag",
      targetId: key,
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "webmaster/flags/toggle");
  }
}
