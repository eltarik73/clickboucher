import type { User } from "@prisma/client";
import { NextRequest } from "next/server";

import { apiSuccess, apiError, formatZodError, handleApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request-body";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { getServerUserId } from "@/lib/auth/server-auth";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { orderListQuerySchema } from "@/lib/validators";
import { listOrders, type OrderListViewer } from "@/lib/services/orders/list";
import { createOrder } from "@/lib/services/orders/create";
import { resolveOrderCustomer } from "@/lib/services/orders/customer";
import { customerOrderById } from "@/lib/services/orders/customer-view";

export const dynamic = "force-dynamic";

/**
 * Whose orders the user reads. A butcher reads the shop the auth helper resolves (it looks the
 * shop up by both owner ids), and no shop when it refuses; any other role reads its own orders.
 */
async function listViewer(user: Pick<User, "id" | "role">): Promise<OrderListViewer> {
  if (user.role === "ADMIN") return { role: "ADMIN" };
  if (user.role !== "BOUCHER") return { role: "CLIENT", userId: user.id };
  const boucher = await getAuthenticatedBoucher();
  return { role: "BOUCHER", shopIds: boucher.error ? [] : [boucher.shopId] };
}

// ── GET /api/orders ────────────────────────────
// Role-based: client sees own orders, boucher sees shop orders, admin sees all
export async function GET(req: NextRequest) {
  try {
    // @security: test-only — uses getServerUserId() for test mode bypass
    const userId = await getServerUserId();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const query = orderListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!query.success) {
      return apiError("VALIDATION_ERROR", "Paramètres invalides", formatZodError(query.error));
    }

    const user = await getOrCreateUser(userId);
    if (!user) return apiSuccess([]);

    return apiSuccess(await listOrders(await listViewer(user), query.data, new Date()));
  } catch (error) {
    return handleApiError(error, "orders GET");
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

    const customer = await resolveOrderCustomer(userId);
    if (!customer) {
      return apiError("NOT_FOUND", "Utilisateur introuvable");
    }

    const body = await readJsonBody(req);
    const result = await createOrder(body, customer);
    if (!result.ok) {
      return apiError(result.code, result.message, result.details);
    }
    return apiSuccess(await customerOrderById(result.order.id), result.status);
  } catch (error) {
    return handleApiError(error, "orders POST");
  }
}
