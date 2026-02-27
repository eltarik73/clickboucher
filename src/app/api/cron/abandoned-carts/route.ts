import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";
import { verifyCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) return apiError("UNAUTHORIZED", "Invalid cron secret");

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

    if (abandonedCarts.length > 0) {
      await prisma.cart.updateMany({
        where: { id: { in: abandonedCarts.map((c) => c.id) } },
        data: { abandonedAt: new Date() },
      });

      for (const cart of abandonedCarts) {
        await sendNotification("CART_ABANDONED", {
          userId: cart.userId,
          shopName: cart.shop.name,
          nbItems: cart.items.length,
        });
      }
    }

    return apiSuccess({ markedCount: abandonedCarts.length, timestamp: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error, "cron/abandoned-carts");
  }
}
