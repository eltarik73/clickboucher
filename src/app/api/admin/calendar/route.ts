// CRUD /api/admin/calendar — Calendar events management
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

// GET — List calendar events
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const events = await prisma.calendarEvent.findMany({
      orderBy: { date: "asc" },
    });

    return apiSuccess(events);
  } catch (error) {
    return handleApiError(error, "admin/calendar");
  }
}

const createEventSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  date: z.string().datetime(),
  type: z.string().min(1).max(50),
  alertDaysBefore: z.number().int().min(0).max(90).optional().default(7),
  suggestedProducts: z.array(z.string()).optional(),
  active: z.boolean().optional().default(true),
});

// POST — Create a calendar event
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const body = await req.json();
    const data = createEventSchema.parse(body);

    const event = await prisma.calendarEvent.create({
      data: {
        name: data.name,
        description: data.description,
        date: new Date(data.date),
        type: data.type,
        alertDaysBefore: data.alertDaysBefore,
        suggestedProducts: data.suggestedProducts || [],
        active: data.active,
      },
    });

    return apiSuccess(event, 201);
  } catch (error) {
    return handleApiError(error, "admin/calendar/create");
  }
}
