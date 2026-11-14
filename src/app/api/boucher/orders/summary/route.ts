// src/app/api/boucher/orders/summary/route.ts — today's figures and newest orders of the butcher's shop
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { apiSuccess, handleApiError, privateNoStore } from "@/lib/api/errors";
import { getShopDaySummary } from "@/lib/services/orders/shop-summary";

export const dynamic = "force-dynamic";

// ── GET /api/boucher/orders/summary ──────────────
// Orders created today (Paris day), takings of today's collected orders, the five newest orders.
export async function GET() {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return privateNoStore(authResult.error);

    const summary = await getShopDaySummary(authResult.shopId, new Date());
    return privateNoStore(apiSuccess(summary));
  } catch (error) {
    return privateNoStore(handleApiError(error, "boucher/orders/summary/GET"));
  }
}
