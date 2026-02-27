import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";
import { verifyCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) return apiError("UNAUTHORIZED", "Invalid cron secret");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const events = await prisma.calendarEvent.findMany({
      where: { active: true },
    });

    let sentCount = 0;

    for (const event of events) {
      const eventDate = new Date(event.date);
      eventDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === event.alertDaysBefore) {
        const shops = await prisma.shop.findMany({
          where: { visible: true },
          select: { ownerId: true, name: true },
        });

        for (const shop of shops) {
          try {
            const owner = await prisma.user.findFirst({
              where: { OR: [{ clerkId: shop.ownerId }, { id: shop.ownerId }] },
              select: { id: true },
            });
            if (owner) {
              await sendNotification("CALENDAR_ALERT", {
                userId: owner.id,
                shopName: shop.name,
                message: `${event.name} dans ${diffDays} jours !`,
              });
              sentCount++;
            }
          } catch {
            // Continue
          }
        }
      }
    }

    return apiSuccess({ sentCount, timestamp: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error, "cron/calendar-alerts");
  }
}
