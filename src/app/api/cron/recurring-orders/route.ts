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
    today.setHours(23, 59, 59, 999);

    const dueRecurring = await prisma.recurringOrder.findMany({
      where: { active: true, nextRunAt: { lte: today } },
      include: { user: { select: { id: true, firstName: true } } },
    });

    let sentCount = 0;

    for (const rec of dueRecurring) {
      try {
        const shop = await prisma.shop.findUnique({
          where: { id: rec.shopId },
          select: { name: true },
        });

        await sendNotification("RECURRING_REMINDER", {
          userId: rec.userId,
          shopName: shop?.name || "votre boucherie",
          message: `Votre commande récurrente est prête à être confirmée.`,
        });

        const next = new Date(rec.nextRunAt || today);
        if (rec.frequency === "WEEKLY") next.setDate(next.getDate() + 7);
        else if (rec.frequency === "BIWEEKLY") next.setDate(next.getDate() + 14);
        else if (rec.frequency === "MONTHLY") next.setMonth(next.getMonth() + 1);

        await prisma.recurringOrder.update({
          where: { id: rec.id },
          data: { nextRunAt: next },
        });
        sentCount++;
      } catch {
        // Continue
      }
    }

    return apiSuccess({ sentCount, timestamp: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error, "cron/recurring-orders");
  }
}
