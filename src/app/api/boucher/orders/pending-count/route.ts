// src/app/api/boucher/orders/pending-count/route.ts — number of orders waiting for the butcher's answer
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { apiSuccess, handleApiError, privateNoStore } from "@/lib/api/errors";
import { countPendingOrders } from "@/lib/services/orders/kitchen";

export const dynamic = "force-dynamic";

// ── GET /api/boucher/orders/pending-count ────────
export async function GET() {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return privateNoStore(authResult.error);

    const pending = await countPendingOrders(authResult.shopId);
    return privateNoStore(apiSuccess({ pending }));
  } catch (error) {
    return privateNoStore(handleApiError(error, "boucher/orders/pending-count/GET"));
  }
}
