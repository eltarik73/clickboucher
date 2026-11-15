// PATCH /api/admin/shops/[shopId]/suspend — Suspend or reactivate a shop (admin only).
// The decision is the moderation service's (src/lib/services/shops/moderation.ts): a suspension is
// a stored state that only this route lifts; the route keeps the audit log.
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request-body";
import { writeAuditLog } from "@/lib/audit-log";
import { reactivateShop, suspendShop } from "@/lib/services/shops/moderation";
import { z } from "zod";

export const dynamic = "force-dynamic";

const DEFAULT_REASON = "Suspendue par l'administration";

const suspendSchema = z
  .object({
    suspended: z.boolean(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict({ message: "Ce champ ne peut pas être modifié ici" });

export async function PATCH(req: NextRequest, { params }: { params: { shopId: string } }) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { shopId } = params;
    const data = suspendSchema.parse(await readJsonBody(req));

    if (data.suspended) {
      const reason = data.reason || DEFAULT_REASON;
      const result = await suspendShop(shopId, reason);
      if (!result.ok) return apiError(result.code, result.message);

      await writeAuditLog({
        actorId: admin.userId,
        action: "shop.suspend",
        target: "Shop",
        targetId: shopId,
        details: { reason },
      });

      return apiSuccess({ suspended: true });
    }

    const result = await reactivateShop(shopId);
    if (!result.ok) return apiError(result.code, result.message);

    await writeAuditLog({
      actorId: admin.userId,
      action: "shop.reactivate",
      target: "Shop",
      targetId: shopId,
    });

    return apiSuccess({ suspended: false });
  } catch (error) {
    return handleApiError(error, "admin/shops/suspend");
  }
}
