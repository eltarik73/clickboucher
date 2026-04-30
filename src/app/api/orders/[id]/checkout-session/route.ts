// POST /api/orders/[id]/checkout-session
//
// Crée une Stripe Checkout Session pour une order existante.
// Le client appelle cet endpoint après /api/orders POST :
//   1. POST /api/orders → order PENDING avec paymentMethod=ONLINE
//   2. POST /api/orders/[id]/checkout-session → renvoie session.url
//   3. Front fait window.location = session.url
//
// Sécurité :
// - Vérifie que l'utilisateur est propriétaire de l'order
// - Recharge l'order côté serveur (pas de manipulation client)
// - Idempotency key sur orderId

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getServerUserId } from "@/lib/auth/server-auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { createCheckoutSession } from "@/lib/services/stripe/checkout-session";
import { isStripeConfigured } from "@/lib/stripe";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    if (!isStripeConfigured()) {
      return apiError("SERVICE_DISABLED", "Stripe non configuré");
    }

    const userId = await getServerUserId();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const { id: orderId } = params;

    // Recharger order et vérifier ownership
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        shopId: true,
        userId: true,
        paidAt: true,
        paymentMethod: true,
        user: { select: { email: true, clerkId: true } },
      },
    });

    if (!order) {
      return apiError("NOT_FOUND", "Commande introuvable");
    }

    // Ownership check : userId est soit Clerk ID, soit Prisma User ID
    const dbUser = await prisma.user.findFirst({
      where: { OR: [{ clerkId: userId }, { id: userId }] },
      select: { id: true, email: true, role: true },
    });

    if (!dbUser) {
      return apiError("UNAUTHORIZED", "Utilisateur introuvable");
    }

    const isOwner = order.userId === dbUser.id;
    const isAdmin = dbUser.role === "ADMIN";
    if (!isOwner && !isAdmin) {
      return apiError("FORBIDDEN", "Cette commande ne vous appartient pas");
    }

    if (order.paidAt) {
      return apiError("CONFLICT", "Commande déjà payée");
    }

    if (order.paymentMethod !== "ONLINE") {
      return apiError(
        "VALIDATION_ERROR",
        "Cette commande est en paiement sur place — pas de paiement en ligne possible",
      );
    }

    const customerEmail = order.user?.email || dbUser.email;
    if (!customerEmail) {
      return apiError("VALIDATION_ERROR", "Email client manquant");
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      new URL(req.url).origin;

    const result = await createCheckoutSession({
      orderId: order.id,
      shopId: order.shopId,
      customerEmail,
      successUrl: `${siteUrl}/checkout/success?order=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${siteUrl}/checkout/cancel?order=${order.id}`,
    });

    if (!result.ok) {
      return apiError(
        result.code === "SHOP_NOT_ONBOARDED" || result.code === "SHOP_NOT_READY"
          ? "VALIDATION_ERROR"
          : result.code === "ALREADY_PAID"
          ? "CONFLICT"
          : result.code === "ORDER_NOT_FOUND"
          ? "NOT_FOUND"
          : "INTERNAL_ERROR",
        result.message,
      );
    }

    return apiSuccess({ sessionId: result.sessionId, url: result.url });
  } catch (err) {
    return handleApiError(err, "orders/checkout-session");
  }
}
