// src/lib/services/stripe/checkout-session.ts
//
// Crée une Stripe Checkout Session en mode marketplace (destination charge).
//
// Architecture :
// - Klik&Go encaisse via le compte plateforme.
// - `application_fee_amount` = commission % + 0,99€ frais service.
// - `transfer_data.destination` = stripeAccountId du boucher.
// - Stripe transfère automatiquement le solde au boucher après capture.
//
// Sécurité :
// - Prix TOUJOURS recalculé côté serveur depuis l'Order (jamais depuis le panier client).
// - Idempotency key sur l'orderId (anti double-charge).
// - Webhook = source de vérité pour le passage en PAID (jamais le success_url).

import prisma from "@/lib/prisma";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";
import { logger } from "@/lib/logger";
import {
  getEffectiveCommissionRate,
  computeOrderFees,
  type ShopTier,
} from "./commission";

export type CreateCheckoutSessionInput = {
  orderId: string;
  shopId: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
};

export type CreateCheckoutSessionResult =
  | { ok: true; sessionId: string; url: string }
  | {
      ok: false;
      code:
        | "SERVICE_DISABLED"
        | "ORDER_NOT_FOUND"
        | "SHOP_NOT_ONBOARDED"
        | "SHOP_NOT_READY"
        | "ALREADY_PAID"
        | "INVALID_AMOUNT"
        | "INTERNAL_ERROR";
      message: string;
    };

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<CreateCheckoutSessionResult> {
  if (!isStripeConfigured()) {
    return {
      ok: false,
      code: "SERVICE_DISABLED",
      message: "Stripe not configured",
    };
  }

  // ── 1. Recharger l'order avec shop + items (server-side source of truth) ──
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: {
      shop: {
        select: {
          id: true,
          name: true,
          stripeAccountId: true,
          stripeChargesEnabled: true,
          tier: true,
          earlyAdopterUntil: true,
        },
      },
      items: {
        select: {
          id: true,
          name: true,
          quantity: true,
          unit: true,
          priceCents: true,
          totalCents: true,
          weightGrams: true,
        },
      },
    },
  });

  if (!order) {
    return { ok: false, code: "ORDER_NOT_FOUND", message: "Commande introuvable" };
  }

  if (order.shopId !== input.shopId) {
    return {
      ok: false,
      code: "ORDER_NOT_FOUND",
      message: "Boutique inconnue pour cette commande",
    };
  }

  if (order.paidAt) {
    return { ok: false, code: "ALREADY_PAID", message: "Commande déjà payée" };
  }

  if (!order.shop.stripeAccountId) {
    return {
      ok: false,
      code: "SHOP_NOT_ONBOARDED",
      message: "La boutique n'a pas encore connecté son compte Stripe",
    };
  }

  if (!order.shop.stripeChargesEnabled) {
    return {
      ok: false,
      code: "SHOP_NOT_READY",
      message: "La boutique n'a pas terminé son onboarding Stripe",
    };
  }

  if (order.totalCents <= 0) {
    return { ok: false, code: "INVALID_AMOUNT", message: "Montant invalide" };
  }

  // ── 2. Calculer les frais (server-side authoritative) ──
  const effectiveRate = getEffectiveCommissionRate({
    tier: order.shop.tier as ShopTier,
    earlyAdopterUntil: order.shop.earlyAdopterUntil,
  });

  const fees = computeOrderFees({
    orderSubtotalCents: order.totalCents, // Order.totalCents = subtotal après remise (cf. orders/create.ts)
    effectiveCommissionRate: effectiveRate,
  });

  // ── 3. Construire les line_items ──
  const stripe = getStripeClient();

  // Si une remise a été appliquée à l'order, on regroupe les items en une seule
  // ligne "Commande #X" pour éviter les écarts d'arrondi entre items et total.
  // Sinon on liste chaque item (meilleure UX sur Stripe Checkout).
  const useDetailedLineItems = order.discountCents === 0;

  // On laisse TypeScript inférer la forme depuis les params Stripe.
  // (Le namespace `Stripe.Checkout.SessionCreateParams.LineItem` n'est pas
  // re-exporté en deep namespace — on inline les objets.)
  const itemLines = useDetailedLineItems
    ? order.items.map((item) => ({
        price_data: {
          currency: "eur",
          product_data: {
            name: item.weightGrams
              ? `${item.name} (${item.weightGrams}g)`
              : item.name,
          },
          unit_amount: item.totalCents,
        },
        quantity: 1, // totalCents inclut déjà la quantité côté order
      }))
    : [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Commande ${order.displayNumber || order.orderNumber}`,
              description: `${order.shop.name} — ${order.items.length} article(s)`,
            },
            unit_amount: order.totalCents,
          },
          quantity: 1,
        },
      ];

  // Frais de service Klik&Go (toujours en ligne séparée pour la transparence client)
  const serviceLineItem = {
    price_data: {
      currency: "eur",
      product_data: {
        name: "Frais de service Klik&Go",
        description: "Frais de plateforme",
      },
      unit_amount: fees.serviceFeeCents,
    },
    quantity: 1,
  };

  const lineItems = [...itemLines, serviceLineItem];

  // ── 4. Créer la session Stripe Checkout (destination charge) ──
  let session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: lineItems,
        customer_email: input.customerEmail,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: {
          orderId: order.id,
          shopId: order.shopId,
          orderNumber: order.orderNumber,
        },
        payment_intent_data: {
          application_fee_amount: fees.platformFeeCents,
          transfer_data: { destination: order.shop.stripeAccountId },
          statement_descriptor_suffix: "KLIKANDGO",
          metadata: {
            orderId: order.id,
            shopId: order.shopId,
            orderNumber: order.orderNumber,
          },
        },
        locale: "fr",
        // Email auto-confirmation Stripe (en plus de notre propre email)
        // pas redondant — confirme bien le paiement spécifiquement
        // payment_method_types par défaut = ["card"] (suffisant marketplace FR)
      },
      {
        idempotencyKey: `checkout:${order.id}`,
      },
    );
  } catch (err) {
    logger.error("[stripe/checkout] Stripe API error", {
      orderId: order.id,
      err: (err as Error).message,
    });
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Erreur lors de la création de la session Stripe",
    };
  }

  if (!session.url) {
    logger.error("[stripe/checkout] session.url missing", {
      sessionId: session.id,
    });
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      message: "URL Stripe manquante",
    };
  }

  // ── 5. Persister le breakdown sur l'Order (sera confirmé par le webhook) ──
  try {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        platformFeeCents: fees.platformFeeCents,
        serviceFeeCents: fees.serviceFeeCents,
        shopPayoutCents: fees.shopPayoutCents,
        commissionCents: fees.commissionCents, // legacy field — on garde aligné
        stripeCheckoutSessionId: session.id,
      },
    });
  } catch (err) {
    // Le persist a échoué mais la session Stripe existe — on log et on continue.
    // Le webhook checkout.session.completed pourra toujours retrouver l'order via metadata.
    logger.error("[stripe/checkout] order persist failed", {
      orderId: order.id,
      sessionId: session.id,
      err: (err as Error).message,
    });
  }

  logger.info("[stripe/checkout] session created", {
    orderId: order.id,
    sessionId: session.id,
    platformFeeCents: fees.platformFeeCents,
    shopPayoutCents: fees.shopPayoutCents,
  });

  return { ok: true, sessionId: session.id, url: session.url };
}
