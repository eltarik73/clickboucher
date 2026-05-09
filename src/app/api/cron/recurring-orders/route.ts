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

    // Audit CTO #1 perf 2026-05-09 : N+1 fixé. À 1k+ recurring users le for/await
    // séquentiel timeout 30s Vercel. Promise.allSettled = parallèle + résilient
    // (ne plante pas si 1 notif échoue), batch de 50 max pour ne pas saturer Resend.
    const BATCH_SIZE = 50;
    const nextRunUpdates: { id: string; nextRunAt: Date }[] = [];
    let sentCount = 0;

    for (let i = 0; i < dueRecurring.length; i += BATCH_SIZE) {
      const chunk = dueRecurring.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        chunk.map((rec) =>
          sendNotification("RECURRING_REMINDER", {
            userId: rec.userId,
            shopName: rec.shop?.name || "votre boucherie",
            message: `Votre commande récurrente est prête à être confirmée.`,
          }).then(() => rec)
        )
      );

      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        const rec = r.value;
        const next = new Date(rec.nextRunAt || today);
        if (rec.frequency === "WEEKLY") next.setDate(next.getDate() + 7);
        else if (rec.frequency === "BIWEEKLY") next.setDate(next.getDate() + 14);
        else if (rec.frequency === "MONTHLY") next.setMonth(next.getMonth() + 1);
        nextRunUpdates.push({ id: rec.id, nextRunAt: next });
        sentCount++;
      }
    }

    // Batch update nextRunAt via $transaction
    if (nextRunUpdates.length > 0) {
      await prisma.$transaction(
        nextRunUpdates.map((u) =>
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
