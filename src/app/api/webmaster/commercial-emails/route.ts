// GET + PUT /api/webmaster/commercial-emails — interrupteur « Envoi des e-mails commerciaux » (admin)
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request-body";
import { writeAuditLog } from "@/lib/audit-log";
import {
  COMMERCIAL_EMAILS_CONFIG_KEY,
  commercialEmailsEnabled,
  setCommercialEmailsEnabled,
} from "@/lib/commercial-emails";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const putBodySchema = z.object({ enabled: z.boolean() }).strict();

// GET — état enregistré de l'interrupteur
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    return apiSuccess({ enabled: await commercialEmailsEnabled() });
  } catch (error) {
    return handleApiError(error, "webmaster/commercial-emails GET");
  }
}

// PUT — met l'interrupteur à la valeur demandée (rejouable : « mettre à », pas « basculer »)
export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const rl = await checkRateLimit(rateLimits.api, `commercial-emails:${admin.userId}`);
    if (!rl.success) return apiError("RATE_LIMITED", "Trop de requêtes, réessayez dans une minute");

    const { enabled } = putBodySchema.parse(await readJsonBody(req));
    const change = await setCommercialEmailsEnabled(enabled);

    await writeAuditLog({
      actorId: admin.userId,
      action: "commercial_emails.toggle",
      target: "PlatformConfig",
      targetId: COMMERCIAL_EMAILS_CONFIG_KEY,
      details: { from: change.previous, to: change.enabled },
    });

    return apiSuccess({ enabled: change.enabled });
  } catch (error) {
    return handleApiError(error, "webmaster/commercial-emails PUT");
  }
}
