// src/app/api/orders/[id]/choose-alternatives/route.ts — the customer answers the out-of-stock
// lines of a PARTIALLY_DENIED order: each one is replaced or removed, then the butcher decides again.
// The customer is the holder of the order's credential cookie or the signed-in customer who placed
// it (authorizeOrderAccess, src/lib/auth/order-access.ts), checked before the body is read. An order
// outside the caller's reach is 404.
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, formatZodError, handleApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request-body";
import { authorizeOrderAccess, orderAccessRefusal } from "@/lib/auth/order-access";
import { customerTransitionResponse } from "@/lib/services/orders/commands/http";
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
    const access = await authorizeOrderAccess(params.id, req.cookies);
    if (!access.ok) return orderAccessRefusal(access.status);

    const parsed = choiceSchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Données invalides", formatZodError(parsed.error));
    }

    return await customerTransitionResponse(
      await resolveUnavailableItems({
        orderId: access.orderId,
        userId: access.customerId,
        decisions: parsed.data.decisions,
        now: new Date(),
      })
    );
  } catch (error) {
    return handleApiError(error, "orders/choose-alternatives");
  }
}
