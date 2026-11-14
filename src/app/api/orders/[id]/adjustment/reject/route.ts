// POST /api/orders/[id]/adjustment/reject — the customer refuse the pending price adjustment of their order.
// Business logic in src/lib/services/orders/adjustment-settlement.ts.
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { rejectAdjustment } from "@/lib/services/orders/adjustment-answers";
import { customerUserId } from "@/lib/services/orders/commands/outcome";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const clerkId = await getServerUserId();
    if (!clerkId) return apiError("UNAUTHORIZED", "Authentification requise");
    const userId = await customerUserId(clerkId);
    if (userId === null) return apiError("NOT_FOUND", "Commande introuvable");

    const result = await rejectAdjustment({ orderId: params.id, userId, now: new Date() });
    if (result.kind === "not_found") return apiError("NOT_FOUND", "Commande introuvable");
    if (result.kind === "refused") return apiError("CONFLICT", result.message);
    return apiSuccess(result.adjustment);
  } catch (error) {
    return handleApiError(error, "orders/adjustment/reject");
  }
}
