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
      include: {
        user: { select: { id: true, firstName: true } },
        shop: { select: { name: true } }, // Include shop to avoid N+1 lookup
      },
    });

    let sentCount = 0;
    const nextRunUpdates: { id: string; nextRunAt: Date }[] = [];

    for (const rec of dueRecurring) {
      try {
        await sendNotification("RECURRING_REMINDER", {
          userId: rec.userId,
          shopName: rec.shop?.name || "votre boucherie",
          message: `Votre commande récurrente est prête à être confirmée.`,
        });

        const next = new Date(rec.nextRunAt || today);
        if (rec.frequency === "WEEKLY") next.setDate(next.getDate() + 7);
        else if (rec.frequency === "BIWEEKLY") next.setDate(next.getDate() + 14);
        else if (rec.frequency === "MONTHLY") next.setMonth(next.getMonth() + 1);

        nextRunUpdates.push({ id: rec.id, nextRunAt: next });
        sentCount++;
      } catch {
        // Continue
      }
    }

    // Batch update nextRunAt via $transaction
    if (nextRunUpdates.length > 0) {
      await prisma.$transaction(
        nextRunUpdates.map(u =>
          prisma.recurringOrder.update({
            where: { id: u.id },
            data: { nextRunAt: u.nextRunAt },
          })
        )
      );
    }

    return apiSuccess({ sentCount, timestamp: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error, "cron/recurring-orders");
  }
}
