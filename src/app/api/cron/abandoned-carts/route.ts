import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";
import { verifyCronAuth } from "@/lib/cron-auth";
import { commercialEmailsEnabled } from "@/lib/commercial-emails";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) return apiError("UNAUTHORIZED", "Invalid cron secret");

    // En pause, les paniers sont quand même marqués : réactiver l'envoi plus tard ne doit pas
    // relancer des paniers vieux de plusieurs semaines.
    const commercialEmailsPaused = !(await commercialEmailsEnabled());
    const threshold = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const abandonedCarts = await prisma.cart.findMany({
      where: {
        updatedAt: { lte: threshold },
        abandonedAt: null,
        items: { some: {} },
      },
      select: {
        id: true,
        userId: true,
        shopId: true,
        shop: { select: { name: true } },
        items: { select: { id: true } },
      },
    });

    let remindersSent = 0;
    if (abandonedCarts.length > 0) {
      await prisma.cart.updateMany({
        where: { id: { in: abandonedCarts.map((c) => c.id) } },
        data: { abandonedAt: new Date() },
      });
    }

    if (!commercialEmailsPaused) {
      // Audit CTO #1 perf 2026-05-09 : Promise.allSettled batché pour éviter
      // timeout 30s à scale + résilience aux erreurs partielles Resend.
      const BATCH_SIZE = 50;
      for (let i = 0; i < abandonedCarts.length; i += BATCH_SIZE) {
        const chunk = abandonedCarts.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          chunk.map((cart) =>
            sendNotification("CART_ABANDONED", {
              userId: cart.userId,
              shopName: cart.shop.name,
              nbItems: cart.items.length,
            })
          )
        );
        remindersSent += results.filter((r) => r.status === "fulfilled" && r.value.sent).length;
      }
    }

    return apiSuccess({
      markedCount: abandonedCarts.length,
      remindersSent,
      commercialEmailsPaused,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error, "cron/abandoned-carts");
  }
}
