import { NextRequest } from "next/server";

import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { getServerUserId } from "@/lib/auth/server-auth";
import { listOrders } from "@/lib/services/orders/list";
import { createOrder } from "@/lib/services/orders/create";

export const dynamic = "force-dynamic";

// ── GET /api/orders ────────────────────────────
// Role-based: client sees own orders, boucher sees shop orders, admin sees all
export async function GET(req: NextRequest) {
  try {
    // @security: test-only — uses getServerUserId() for test mode bypass
    const userId = await getServerUserId();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const result = await listOrders(userId, req);
    if (!result.ok) {
      return apiError(result.code, result.message);
    }
    return apiSuccess(result.orders);
  } catch (error) {
    return handleApiError(error);
  }
}

// ── POST /api/orders ───────────────────────────
// Client — create a new order (Uber Eats style with throttling + auto-cancel)
export async function POST(req: NextRequest) {
  try {
    // @security: test-only — uses getServerUserId() for test mode bypass
    const userId = await getServerUserId();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const rl = await checkRateLimit(rateLimits.orders, userId);
    if (!rl.success) {
      return apiError("CAPACITY_EXCEEDED", "Trop de commandes, veuillez patienter");
    }

    const body = await req.json();
    const result = await createOrder(body, userId);
    if (!result.ok) {
      return apiError(result.code, result.message, result.details as Record<string, string[]> | undefined);
    }
    return apiSuccess(result.order, result.status);
  } catch (error) {
    return handleApiError(error);
  }
}
