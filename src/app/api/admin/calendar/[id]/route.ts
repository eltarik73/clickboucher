// PATCH + DELETE /api/admin/calendar/[id]
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

const updateEventSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  date: z.string().datetime().optional(),
  type: z.string().min(1).max(50).optional(),
  alertDaysBefore: z.number().int().min(0).max(90).optional(),
  suggestedProducts: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { id } = await params;
    const body = await req.json();
    const data = updateEventSchema.parse(body);

    const existing = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!existing) {
      return apiError("NOT_FOUND", "Événement introuvable");
    }

    const updated = await prisma.calendarEvent.update({
      where: { id },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "admin/calendar/update");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { id } = await params;

    await prisma.calendarEvent.delete({ where: { id } });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, "admin/calendar/delete");
  }
}
