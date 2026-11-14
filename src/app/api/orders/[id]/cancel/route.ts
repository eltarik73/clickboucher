// src/app/api/orders/[id]/cancel/route.ts — the customer cancels an order: PENDING, or ACCEPTED less
// than 5 minutes after it was placed.
import { NextRequest } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import { apiError, handleApiError } from "@/lib/api/errors";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { cancelOrderByCustomer } from "@/lib/services/orders/commands/close";
import { customerTransitionResponse } from "@/lib/services/orders/commands/http";
import { customerUserId } from "@/lib/services/orders/commands/outcome";

export const dynamic = "force-dynamic";

// ── POST /api/orders/[id]/cancel ───────────────
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const clerkId = await getServerUserId();
    if (!clerkId) return apiError("UNAUTHORIZED", "Authentification requise");

    const rl = await checkRateLimit(rateLimits.api, `order-cancel:${clerkId}`);
    if (!rl.success) return apiError("RATE_LIMITED", "Trop de requêtes");

    const userId = await customerUserId(clerkId);
    if (userId === null) return apiError("NOT_FOUND", "Commande introuvable");

    return await customerTransitionResponse(
      await cancelOrderByCustomer({ orderId: params.id, userId, now: new Date() })
    );
  } catch (error) {
    return handleApiError(error, "orders/cancel");
  }
}
