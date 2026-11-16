// src/app/api/boucher/service/route.ts — the service settings of the butcher's own shop, read and
// written by src/lib/services/shops/service-settings.ts (shared with PATCH /api/shops/[id]/status).
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { apiSuccess, apiError, formatZodError, handleApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request-body";
import { shopWriteRefusal } from "@/lib/services/shops/owner-write-http";
import { readShopService, updateShopService } from "@/lib/services/shops/service-settings";
import { updateServiceSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;

    const service = await readShopService(authResult.shopId);
    if (!service) return apiError("NOT_FOUND", "Boutique introuvable");

    return apiSuccess(service);
  } catch (error) {
    return handleApiError(error, "boucher/service/GET");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;

    const parsed = updateServiceSchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Données invalides", formatZodError(parsed.error));
    }

    const result = await updateShopService(authResult.shopId, parsed.data);
    if (!result.ok) return shopWriteRefusal(result.reason);

    return apiSuccess(result.service);
  } catch (error) {
    return handleApiError(error, "boucher/service/PATCH");
  }
}
