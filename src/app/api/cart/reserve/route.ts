import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { cartReserveSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

const HOLD_MINUTES = Number(process.env.LAST_MINUTE_HOLD_MINUTES) || 10;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { offerId, quantity } = cartReserveSchema.parse(body);

    const offer = await prisma.offer.findUnique({ where: { id: offerId } });
    if (!offer) return apiError("NOT_FOUND", "Offre introuvable");

    if (new Date() > offer.expiresAt) {
      return apiError("OFFER_EXPIRED", "Cette offre a expiré");
    }

    const available = offer.remainingQty - offer.reservedInCart;
    if (available < quantity) {
      return apiError("STOCK_INSUFFICIENT", `Seulement ${available} disponible(s)`);
    }

    // Reserve
    await prisma.offer.update({
      where: { id: offerId },
      data: { reservedInCart: { increment: quantity } },
    });

    const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000);

    console.log(`[CART RESERVE] Offer ${offerId}: +${quantity} reserved (expires ${expiresAt.toISOString()})`);

    return apiSuccess({
      offerId,
      reservedQty: quantity,
      holdExpiresAt: expiresAt.toISOString(),
      holdMinutes: HOLD_MINUTES,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
