export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

const createEventSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (YYYY-MM-DD)"),
  type: z.enum(["fermeture", "promo", "evenement", "fete"]),
  emoji: z.string().max(10).optional(),
});

const updateEventSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (YYYY-MM-DD)").optional(),
  type: z.enum(["fermeture", "promo", "evenement", "fete"]).optional(),
  emoji: z.string().max(10).optional(),
  active: z.boolean().optional(),
});

// ── GET /api/boucher/calendar ──
export async function GET() {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const events = await prisma.calendarEvent.findMany({
      where: { shopId },
      orderBy: { date: "asc" },
    });

    return apiSuccess(events);
  } catch (error) {
    return handleApiError(error);
  }
}

// ── POST /api/boucher/calendar ──
export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const body = await req.json();
    const data = createEventSchema.parse(body);

    const event = await prisma.calendarEvent.create({
      data: {
        name: data.name,
        description: data.description || null,
        date: new Date(data.date),
        type: data.type,
        emoji: data.emoji || null,
        shopId,
        alertDaysBefore: data.type === "fermeture" ? 3 : 7,
      },
    });

    return apiSuccess(event);
  } catch (error) {
    return handleApiError(error);
  }
}

// ── DELETE /api/boucher/calendar ──
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const body = await req.json();
    const { id } = z.object({ id: z.string().min(1) }).parse(body);

    const event = await prisma.calendarEvent.findUnique({
      where: { id },
      select: { shopId: true },
    });
    if (!event) return apiError("NOT_FOUND", "Evenement introuvable");

    // Verify ownership — check that event belongs to the authenticated boucher's shop
    if (event.shopId !== shopId) {
      return apiError("FORBIDDEN", "Non autorise");
    }

    await prisma.calendarEvent.delete({ where: { id } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
