// src/app/api/orders/[id]/choose-alternatives/route.ts — the customer answers the out-of-stock
// lines of a PARTIALLY_DENIED order: each one is replaced or removed, then the butcher decides again.
import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerUserId } from "@/lib/auth/server-auth";
import { apiError, handleApiError } from "@/lib/api/errors";
import { customerTransitionResponse } from "@/lib/services/orders/commands/http";
import { customerUserId } from "@/lib/services/orders/commands/outcome";
import { resolveUnavailableItems } from "@/lib/services/orders/commands/unavailable";

export const dynamic = "force-dynamic";

const decisionSchema = z.discriminatedUnion("action", [
  z.object({ orderItemId: z.string().min(1), action: z.literal("remove") }),
  z.object({
    orderItemId: z.string().min(1),
    action: z.literal("replace"),
    replacementProductId: z.string().min(1),
  }),
]);

const choiceSchema = z.object({
  decisions: z.array(decisionSchema).min(1, "Au moins une décision requise").max(50),
});

// ── POST /api/orders/[id]/choose-alternatives ──
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const clerkId = await getServerUserId();
    if (!clerkId) return apiError("UNAUTHORIZED", "Authentification requise");

    const { decisions } = choiceSchema.parse(await req.json());
    const userId = await customerUserId(clerkId);
    if (userId === null) return apiError("NOT_FOUND", "Commande introuvable");

    return await customerTransitionResponse(
      await resolveUnavailableItems({ orderId: params.id, userId, decisions, now: new Date() })
    );
  } catch (error) {
    return handleApiError(error, "orders/choose-alternatives");
  }
}
