// GET /api/calendar-events — List upcoming calendar events
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const events = await prisma.calendarEvent.findMany({
      where: { active: true },
      orderBy: { date: "asc" },
    });

    const mapped = events.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      date: e.date.toISOString().split("T")[0],
      type: e.type,
      emoji: e.type === "ramadan" ? "🌙" : e.type === "aid" ? "🐑" : "📅",
      alertDaysBefore: e.alertDaysBefore,
      suggestedProducts: (e.suggestedProducts as string[]) || [],
    }));

    return apiSuccess(mapped);
  } catch (error) {
    return handleApiError(error, "calendar-events/GET");
  }
}
