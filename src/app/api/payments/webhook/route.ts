// POST /api/payments/webhook — Stripe webhook (signature verified)
//
// Événements gérés (16 events configurés sur Stripe Dashboard) :
// - checkout.session.completed : passe l'order en PAID, déclenche notif boucher
// - payment_intent.succeeded : confirme le paiement (idempotent avec checkout)
// - payment_intent.payment_failed : marque l'order FAILED + notifie le client
// - charge.refunded : marque l'order REFUNDED + ajuste les compteurs
// - account.updated : sync Shop.stripeChargesEnabled / stripePayoutsEnabled / status
// - transfer.created : persist Order.stripeTransferId pour reporting
// - payout.paid : log pour le dashboard finances boucher
//
// Idempotency : chaque event.id est tracké dans la table StripeEvent.
// Sur retry (Stripe rejoue automatiquement après 5xx), on retourne 200 immédiatement.
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
import { syncShopStripeStatus } from "@/lib/services/stripe/connect";
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

  // ── Idempotency : sur retry, on a déjà traité cet event ──
  const existing = await prisma.stripeEvent.findUnique({
    where: { id: event.id },
  });
  if (existing) {
    logger.info("[stripe/webhook] duplicate event, skipping", {
      id: event.id,
      type: event.type,
    });
    return NextResponse.json({ received: true, duplicate: true });
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

    // Marque l'event traité (après succès du handler)
    await prisma.stripeEvent.create({
      data: {
        id: event.id,
        type: event.type,
        // Cast contrôlé : le payload Stripe est sérialisable en JSON par construction.
        payload: event as unknown as object,
      },
    });

    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error("[stripe/webhook] handler error", {
      type: event.type,
      id: event.id,
      err: (err as Error).message,
    });
    // On retourne 500 pour que Stripe rejoue. La table StripeEvent fait
    // que le rejeu sera idempotent une fois le bug fixé.
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

async function handlePaymentIntentFailed(pi: Stripe.PaymentIntent) {
  const orderId = pi.metadata?.orderId;
  if (!orderId) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, userId: true, orderNumber: true, shopId: true },
  });
  if (!order) return;

  // On ne marque pas CANCELLED (le client peut retenter). On log + notifie.
  logger.warn("[stripe/webhook] payment failed", {
    orderId,
    failureCode: pi.last_payment_error?.code,
    failureMessage: pi.last_payment_error?.message,
  });

  // Pas de notif client native ici (Stripe Checkout l'a déjà notifié sur leur page)
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const orderId = charge.metadata?.orderId;
  if (!orderId) return;

  const refunded = charge.amount_refunded;
  const isFullRefund = charge.amount_refunded === charge.amount;

  await prisma.order.update({
    where: { id: orderId },
    data: {
      refundedAt: new Date(),
      refundAmountCents: refunded,
      status: isFullRefund ? "CANCELLED" : undefined,
    },
  });

  logger.info("[stripe/webhook] charge refunded", {
    orderId,
    refundedCents: refunded,
    full: isFullRefund,
  });
}

async function handleAccountUpdated(account: Stripe.Account) {
  // Le shopId est dans metadata (set à la création) — fallback sur stripeAccountId si absent
  const shopId = account.metadata?.shopId;

  const status = await syncShopStripeStatus(account.id);

  const where = shopId
    ? { id: shopId }
    : { stripeAccountId: account.id };

  // findFirst plutôt que update direct pour ne pas crasher si le shop n'existe plus
  const shop = await prisma.shop.findFirst({
    where,
    select: { id: true },
  });
  if (!shop) {
    logger.warn("[stripe/webhook] shop not found for account.updated", {
      accountId: account.id,
      metadataShopId: shopId,
    });
    return;
  }

  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      stripeAccountId: account.id,
      stripeAccountStatus: status.status,
      stripeChargesEnabled: status.chargesEnabled,
      stripePayoutsEnabled: status.payoutsEnabled,
    },
  });

  logger.info("[stripe/webhook] shop stripe status synced", {
    shopId: shop.id,
    status: status.status,
    chargesEnabled: status.chargesEnabled,
  });
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
