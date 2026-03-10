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

    // Hoist shop.findMany OUTSIDE the event loop (was identical every iteration)
    const shops = await prisma.shop.findMany({
      where: { visible: true },
      select: { ownerId: true, name: true },
    });

    // Batch fetch ALL owners at once (instead of N per shop)
    const ownerIds = [...new Set(shops.map(s => s.ownerId).filter(Boolean))];
    const owners = ownerIds.length > 0
      ? await prisma.user.findMany({
          where: { OR: [{ clerkId: { in: ownerIds } }, { id: { in: ownerIds } }] },
          select: { id: true, clerkId: true },
        })
      : [];
    const ownerMap = new Map<string, string>();
    for (const u of owners) {
      ownerMap.set(u.clerkId, u.id);
      ownerMap.set(u.id, u.id);
    }

    let sentCount = 0;

    for (const event of events) {
      const eventDate = new Date(event.date);
      eventDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === event.alertDaysBefore) {
        for (const shop of shops) {
          try {
            const ownerId = ownerMap.get(shop.ownerId);
            if (ownerId) {
              await sendNotification("CALENDAR_ALERT", {
                userId: ownerId,
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
