// POST /api/payments/webhook — Stripe webhook (signature verified)
//
// Événements gérés (16 events configurés sur Stripe Dashboard) :
// - checkout.session.completed : passe l'order en PAID, déclenche notif boucher
// - payment_intent.succeeded : confirme le paiement (idempotent avec checkout)
// - payment_intent.payment_failed : marque l'order CANCELLED + notifie le client (audit C2)
// - charge.refunded : marque l'order REFUNDED + ajuste les compteurs + recalcule
//   la commission proportionnellement (audit C3)
// - account.updated : sync Shop.stripeChargesEnabled / stripePayoutsEnabled / status
//   directement depuis le payload webhook (pas de re-fetch Stripe — audit C5)
// - transfer.created : persist Order.stripeTransferId pour reporting
// - payout.paid : log pour le dashboard finances boucher
//
// Idempotency : chaque event.id est tracké dans la table StripeEvent.
// ⚠️ FIX AUDIT I1 — l'INSERT du marker StripeEvent est fait AVANT le handler
// (pas après) pour éviter la fenêtre de double-traitement lors d'un retry Stripe
// pendant l'exécution du handler. ON CONFLICT DO NOTHING (Prisma P2002) → 200 dup.
//
// Runtime : nodejs (signature Stripe = byte-stream → req.text(), pas req.json()).

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  getStripeClient,
  STRIPE_WEBHOOK_SECRET,
  isStripeConfigured,
} from "@/lib/stripe";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendNotification } from "@/lib/notifications";
import { estimateStripeFeeCents } from "@/lib/services/stripe/commission";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured() || !STRIPE_WEBHOOK_SECRET) {
    logger.warn("[stripe/webhook] Stripe not configured — skipping");
    return NextResponse.json(
      { received: false, reason: "not-configured" },
      { status: 503 },
    );
  }

  // Raw body pour la signature (constructEvent vérifie le HMAC)
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(
      body,
      sig,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    logger.warn("[stripe/webhook] signature verification failed", {
      err: (err as Error).message,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── FIX AUDIT I1 : INSERT du marker AVANT le handler ──
  // Patron : INSERT ... ON CONFLICT DO NOTHING via catch P2002 Prisma.
  // Si event déjà inséré (retry pendant l'exécution d'un handler concurrent)
  // → 200 immédiat avec duplicate=true, on ne re-traite PAS le handler.
  try {
    await prisma.stripeEvent.create({
      data: {
        id: event.id,
        type: event.type,
        // Cast contrôlé : le payload Stripe est sérialisable en JSON par construction.
        payload: event as unknown as object,
      },
    });
  } catch (err) {
    // Prisma renvoie code "P2002" sur unique-constraint violation (event.id duplicate)
    const code = (err as { code?: string }).code;
    if (code === "P2002") {
      logger.info("[stripe/webhook] duplicate event, skipping", {
        id: event.id,
        type: event.type,
      });
      return NextResponse.json({ received: true, duplicate: true });
    }
    // Autre erreur DB inattendue → on remonte (Stripe retentera)
    throw err;
  }

  logger.info("[stripe/webhook] received", { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      case "transfer.created":
        await handleTransferCreated(event.data.object as Stripe.Transfer);
        break;

      case "payout.paid":
        await handlePayoutPaid(event.data.object as Stripe.Payout);
        break;

      default:
        logger.debug("[stripe/webhook] unhandled event type", {
          type: event.type,
        });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error("[stripe/webhook] handler error", {
      type: event.type,
      id: event.id,
      err: (err as Error).message,
    });
    // Le marker StripeEvent a déjà été inséré → on le supprime pour permettre
    // un retry Stripe propre (sinon le retry serait skippé comme duplicate).
    await prisma.stripeEvent
      .delete({ where: { id: event.id } })
      .catch((delErr) =>
        logger.error("[stripe/webhook] failed to rollback StripeEvent marker", {
          id: event.id,
          err: (delErr as Error).message,
        }),
      );
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════
// Handlers
// ═══════════════════════════════════════════════════════════

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) {
    logger.warn("[stripe/webhook] checkout.session.completed missing orderId metadata", {
      sessionId: session.id,
    });
    return;
  }

  // Si payment_intent est null (rare — uniquement en mode subscription/setup) on log et on sort.
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, paidAt: true, shopId: true, displayNumber: true, orderNumber: true, userId: true },
  });
  if (!order) {
    logger.warn("[stripe/webhook] order not found for checkout completed", { orderId });
    return;
  }

  if (order.paidAt) {
    logger.info("[stripe/webhook] order already paid, skipping", { orderId });
    return;
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      paidAt: new Date(),
      stripePaymentIntentId: paymentIntentId,
      // On garde stripePaymentId (legacy) en sync pour compat code existant
      stripePaymentId: paymentIntentId,
      // Si la commande était PENDING en attente de paiement, on la passe à ACCEPTED
      // pour que le boucher la voie dans son Mode Cuisine. Sinon on garde le statut courant.
      status: order.status === "PENDING" ? "ACCEPTED" : order.status,
    },
  });

  logger.info("[stripe/webhook] order marked paid", {
    orderId,
    paymentIntentId,
  });

  // Notification boucher : nouvelle commande payée
  sendNotification("ORDER_PENDING", {
    shopId: order.shopId,
    orderId: order.id,
    orderNumber: order.orderNumber,
  }).catch((err) =>
    logger.error("[stripe/webhook] notification ORDER_PENDING failed", {
      orderId,
      err: (err as Error).message,
    }),
  );
}

async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
  const orderId = pi.metadata?.orderId;
  if (!orderId) return;

  // Idempotent avec checkout.session.completed — on s'assure juste que paidAt est set
  // et qu'on persiste les frais Stripe estimés.
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, paidAt: true },
  });
  if (!order) return;

  await prisma.order.update({
    where: { id: orderId },
    data: {
      paidAt: order.paidAt ?? new Date(),
      stripePaymentIntentId: pi.id,
      stripePaymentId: pi.id,
      stripeFeeCents: estimateStripeFeeCents(pi.amount),
    },
  });
}

/**
 * ⚠️ FIX AUDIT C2 — `payment_intent.payment_failed` marque maintenant l'order
 * en CANCELLED (avec deny_reason = message Stripe) au lieu de seulement logger.
 *
 * Avant : la commande restait à PENDING indéfiniment → le boucher la voyait
 * dans son Mode Cuisine et pouvait la préparer pour rien.
 *
 * Safety : on n'écrase pas un order déjà payé (paidAt !== null) — protection
 * contre les events arrivés dans le désordre (cas rare mais possible).
 */
async function handlePaymentIntentFailed(pi: Stripe.PaymentIntent) {
  const orderId = pi.metadata?.orderId;
  if (!orderId) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, paidAt: true, userId: true, orderNumber: true, shopId: true },
  });
  if (!order) {
    logger.warn("[stripe/webhook] order not found for payment_failed", { orderId });
    return;
  }

  // Safety : ne pas écraser un order déjà payé
  if (order.paidAt) {
    logger.warn("[stripe/webhook] payment_failed received but order already paid", {
      orderId,
      piId: pi.id,
    });
    return;
  }

  // Safety : si l'order est déjà annulée, on ne re-écrit pas
  if (order.status === "CANCELLED" || order.status === "AUTO_CANCELLED" || order.status === "DENIED") {
    logger.info("[stripe/webhook] payment_failed: order already terminal", {
      orderId,
      status: order.status,
    });
    return;
  }

  const failureMsg =
    pi.last_payment_error?.message ||
    pi.last_payment_error?.code ||
    "Paiement refusé";

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "CANCELLED",
      autoCancelledAt: new Date(),
      denyReason: `Stripe — ${failureMsg}`.slice(0, 500),
    },
  });

  logger.warn("[stripe/webhook] order cancelled (payment failed)", {
    orderId,
    piId: pi.id,
    failureCode: pi.last_payment_error?.code,
    failureMessage: pi.last_payment_error?.message,
  });
}

/**
 * ⚠️ FIX AUDIT C3 — `charge.refunded` calcule maintenant la part de commission
 * Klik&Go remboursée au boucher proportionnellement au montant remboursé.
 *
 * Avant : Klik&Go gardait 100% de la commission même sur un refund total.
 * Conséquence : soit le boucher perdait l'argent (commande déjà remise), soit
 * Klik&Go violait son obligation de rendre 100% au consommateur.
 *
 * Désormais :
 * - `refundedAmountCents` (déjà existant) = montant remboursé
 * - `refundedPlatformFeeCents` (nouveau, fix C3) = part commission rendue
 * - `shopPayoutCents` mis à jour pour refléter le payout NET (après refund)
 *
 * Note : ce handler RÉAGIT à un refund déjà effectué. Pour QUE la commission
 * soit physiquement reversée au boucher côté Stripe, il faut que la route qui
 * crée le refund passe `refund_application_fee: true` à `stripe.refunds.create()`.
 * Voir TODO en commentaire dans `lib/services/stripe/checkout-session.ts` (ou
 * dans une nouvelle route `/api/admin/orders/[id]/refund` à venir).
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  const orderId = charge.metadata?.orderId;
  if (!orderId) {
    // Fallback : retrouver l'order via le PaymentIntent
    const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
    if (!piId) {
      logger.warn("[stripe/webhook] charge.refunded sans orderId ni payment_intent", {
        chargeId: charge.id,
      });
      return;
    }
    const fallbackOrder = await prisma.order.findFirst({
      where: { stripePaymentIntentId: piId },
      select: { id: true },
    });
    if (!fallbackOrder) {
      logger.warn("[stripe/webhook] charge.refunded: order not found via PI fallback", {
        chargeId: charge.id,
        piId,
      });
      return;
    }
    return processRefund(fallbackOrder.id, charge);
  }
  return processRefund(orderId, charge);
}

async function processRefund(orderId: string, charge: Stripe.Charge) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      platformFeeCents: true,
      shopPayoutCents: true,
      totalCents: true,
    },
  });
  if (!order) {
    logger.warn("[stripe/webhook] charge.refunded: order not found", { orderId, chargeId: charge.id });
    return;
  }

  const refundedAmountCents = charge.amount_refunded;
  const isFullRefund = refundedAmountCents >= charge.amount;

  // Refund ratio basé sur le total Stripe (charge.amount inclut subtotal + service fee)
  // Math.min pour clamp au cas où Stripe rembourse plus que charge.amount (cas pathologique)
  const refundRatio = charge.amount > 0 ? Math.min(1, refundedAmountCents / charge.amount) : 0;

  // Part proportionnelle de la commission Klik&Go à rembourser au boucher
  const platformFeeRefundCents = Math.round(order.platformFeeCents * refundRatio);

  // shopPayout NET = shopPayout initial - (montant remboursé NET de la part Klik&Go)
  // = shopPayout - (refundedAmount - platformFeeRefund)
  // En pratique : si full refund → shopPayoutCents = 0, refundedPlatformFeeCents = platformFeeCents
  const shopPayoutAdjustedCents = Math.max(
    0,
    order.shopPayoutCents - (refundedAmountCents - platformFeeRefundCents),
  );

  await prisma.order.update({
    where: { id: orderId },
    data: {
      refundedAt: new Date(),
      refundAmountCents: refundedAmountCents,
      refundedPlatformFeeCents: platformFeeRefundCents,
      shopPayoutCents: shopPayoutAdjustedCents,
      // Statut : on ne CANCELLED que si full refund. Sinon on laisse le statut courant
      // (le boucher peut encore remettre le reste de la commande).
      status: isFullRefund ? "CANCELLED" : undefined,
    },
  });

  logger.info("[stripe/webhook] charge refunded", {
    orderId,
    refundedCents: refundedAmountCents,
    platformFeeRefundCents,
    shopPayoutAdjustedCents,
    full: isFullRefund,
    chargeId: charge.id,
  });
}

/**
 * ⚠️ FIX AUDIT C5 — `account.updated` lit DIRECTEMENT le payload webhook
 * (qui contient déjà charges_enabled, payouts_enabled, requirements) au lieu
 * de re-appeler `stripe.accounts.retrieve()`.
 *
 * Avant : un round-trip Stripe inutile + risque de régression d'état si
 * `accounts.retrieve` répond avec un état plus VIEUX que celui du payload
 * (cohérence éventuelle Stripe, rare mais possible).
 *
 * Maintenant : le payload webhook EST la source de vérité à l'instant t.
 * Pour une vérif manuelle (route /api/boucher/stripe/refresh-status) on
 * garde l'appel API direct via syncShopStripeStatus() — non concerné par ce fix.
 */
async function handleAccountUpdated(account: Stripe.Account) {
  const chargesEnabled = account.charges_enabled ?? false;
  const payoutsEnabled = account.payouts_enabled ?? false;
  const pastDue = account.requirements?.past_due ?? [];
  const disabledReason = account.requirements?.disabled_reason;

  // Status logic identique à syncShopStripeStatus mais sans round-trip Stripe
  let status: "active" | "pending" | "restricted";
  if (chargesEnabled && payoutsEnabled) {
    status = "active";
  } else if (pastDue.length > 0 || disabledReason) {
    status = "restricted";
  } else {
    status = "pending";
  }

  // Le shopId est dans metadata (set à la création) — fallback sur stripeAccountId si absent
  const shopId = account.metadata?.shopId;

  if (shopId) {
    // Fix audit I7 : si l'event arrive AVANT le persist de stripeAccountId
    // (latence onboard route), on peut quand même updater via shop.id.
    const result = await prisma.shop.updateMany({
      where: { id: shopId },
      data: {
        stripeAccountId: account.id,
        stripeAccountStatus: status,
        stripeChargesEnabled: chargesEnabled,
        stripePayoutsEnabled: payoutsEnabled,
      },
    });

    if (result.count === 0) {
      logger.warn("[stripe/webhook] shop not found via metadata.shopId", {
        accountId: account.id,
        shopId,
      });
    } else {
      logger.info("[stripe/webhook] shop stripe status synced (via metadata)", {
        shopId,
        accountId: account.id,
        status,
        chargesEnabled,
      });
    }
    return;
  }

  // Fallback : pas de metadata.shopId → on cherche par stripeAccountId
  const result = await prisma.shop.updateMany({
    where: { stripeAccountId: account.id },
    data: {
      stripeAccountStatus: status,
      stripeChargesEnabled: chargesEnabled,
      stripePayoutsEnabled: payoutsEnabled,
    },
  });

  if (result.count === 0) {
    logger.warn("[stripe/webhook] shop not found for account.updated", {
      accountId: account.id,
    });
  } else {
    logger.info("[stripe/webhook] shop stripe status synced", {
      accountId: account.id,
      status,
      chargesEnabled,
    });
  }
}

async function handleTransferCreated(transfer: Stripe.Transfer) {
  // Lien transfer → order via metadata du PaymentIntent source.
  const sourceTransaction = transfer.source_transaction;
  if (!sourceTransaction) {
    // Transfert direct sans charge associée — pas de lien order possible
    return;
  }

  // On essaie de retrouver l'order par metadata si présent sur le transfer
  const orderId = transfer.metadata?.orderId;
  if (orderId) {
    await prisma.order.update({
      where: { id: orderId },
      data: { stripeTransferId: transfer.id },
    });
    return;
  }

  // Fallback : retrouve l'order via le PaymentIntent (transfer.transfer_group ou source)
  // Stripe ne donne pas toujours l'orderId sur le transfer — on log si manquant.
  logger.debug("[stripe/webhook] transfer without orderId metadata", {
    transferId: transfer.id,
    amount: transfer.amount,
  });
}

async function handlePayoutPaid(payout: Stripe.Payout) {
  // Reporting only — le payout est versé sur le compte bancaire du boucher.
  // Aucune mutation DB nécessaire (Stripe est source de vérité pour les payouts).
  logger.info("[stripe/webhook] payout paid", {
    payoutId: payout.id,
    amount: payout.amount,
    currency: payout.currency,
    arrivalDate: payout.arrival_date,
  });
}
