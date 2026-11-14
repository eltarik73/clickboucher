// src/app/api/orders/[id]/rate/route.ts — the customer rates a collected order (once).
import { NextRequest } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import { rateOrderSchema } from "@/lib/validators";
import { apiError, handleApiError } from "@/lib/api/errors";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { customerTransitionResponse } from "@/lib/services/orders/commands/http";
import { customerUserId } from "@/lib/services/orders/commands/outcome";
import { rateOrder } from "@/lib/services/orders/commands/rate";

export const dynamic = "force-dynamic";

// ── POST /api/orders/[id]/rate ─────────────────
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const clerkId = await getServerUserId();
    if (!clerkId) return apiError("UNAUTHORIZED", "Authentification requise");

    const rl = await checkRateLimit(rateLimits.api, `order-rate:${clerkId}`);
    if (!rl.success) return apiError("RATE_LIMITED", "Trop de requêtes");

    const data = rateOrderSchema.parse(await req.json());
    const userId = await customerUserId(clerkId);
    if (userId === null) return apiError("NOT_FOUND", "Commande introuvable");

    return await customerTransitionResponse(
      await rateOrder({ orderId: params.id, userId, rating: data.rating, comment: data.comment })
    );
  } catch (error) {
    return handleApiError(error, "orders/rate");
  }
}
