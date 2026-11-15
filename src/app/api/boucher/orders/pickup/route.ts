// src/app/api/boucher/orders/pickup/route.ts — pickup confirmed by scanning the customer's QR code.
// The order is found by its code inside the butcher's shop; the pickup itself is the same command
// as the kitchen's QR and manual pickups.
import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { apiError, apiSuccess, formatZodError, handleApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request-body";
import { storedLineUnits } from "@/lib/pricing/line";
import { orderClientName, orderPersonColumns } from "@/lib/services/orders/order-person";
import { transitionResponse } from "@/lib/services/orders/commands/http";
import { confirmPickup } from "@/lib/services/orders/commands/progress";

export const dynamic = "force-dynamic";

const pickupByQrSchema = z.object({
  qrCode: z.string().uuid("QR code invalide"),
});

/** What the scanner shows after a pickup. */
async function pickupSummary(orderId: string, shopId: string) {
  const order = await prisma.order.findFirstOrThrow({
    where: { id: orderId, shopId },
    select: {
      id: true,
      orderNumber: true,
      totalCents: true,
      items: { select: { unit: true, quantity: true, weightGrams: true, available: true } },
      user: { select: { firstName: true, lastName: true } },
      ...orderPersonColumns,
    },
  });
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    clientName: orderClientName(order),
    itemCount: order.items
      .filter((item) => item.available)
      .reduce((sum, item) => sum + storedLineUnits(item), 0),
    totalCents: order.totalCents,
  };
}

// ── POST /api/boucher/orders/pickup ──────────────
export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId, userId } = authResult;

    const parsed = pickupByQrSchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Données invalides", formatZodError(parsed.error));
    }
    const result = await confirmPickup({
      shopId,
      actorId: userId,
      now: new Date(),
      target: { qrCode: parsed.data.qrCode },
    });
    if (result.kind === "done") return apiSuccess(await pickupSummary(result.data.id, shopId));
    if (result.kind === "replay") {
      return apiSuccess({ ...(await pickupSummary(result.data.id, shopId)), _idempotent: true });
    }
    if (result.kind === "not_found") {
      return apiError("NOT_FOUND", "Aucune commande trouvée avec ce QR code pour votre boucherie");
    }
    return transitionResponse(result);
  } catch (error) {
    return handleApiError(error, "boucher/orders/pickup");
  }
}
