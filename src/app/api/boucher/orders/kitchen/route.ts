// src/app/api/boucher/orders/kitchen/route.ts — kitchen board of the authenticated butcher's shop
import { z } from "zod";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { apiError, apiSuccess, handleApiError, privateNoStore } from "@/lib/api/errors";
import { getKitchenBoard, getKitchenHistory } from "@/lib/services/orders/kitchen";

export const dynamic = "force-dynamic";

const kitchenQuerySchema = z.object({ history: z.literal("1").optional() }).strict();

// ── GET /api/boucher/orders/kitchen[?history=1] ──────────────
// Every active order of the shop. With history=1, also the 50 most recently updated finished
// orders of the last 7 days: the board asks for them on a slow cadence, not on every poll.
export async function GET(req: Request) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return privateNoStore(authResult.error);

    const query = kitchenQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!query.success) return privateNoStore(apiError("VALIDATION_ERROR", "Paramètres invalides"));

    if (query.data.history === undefined) {
      return privateNoStore(apiSuccess(await getKitchenBoard(authResult.shopId)));
    }
    const [board, history] = await Promise.all([
      getKitchenBoard(authResult.shopId),
      getKitchenHistory(authResult.shopId),
    ]);
    return privateNoStore(apiSuccess({ ...board, history }));
  } catch (error) {
    return privateNoStore(handleApiError(error, "boucher/orders/kitchen/GET"));
  }
}
