// ═══════════════════════════════════════════════
// CLICKBOUCHER — Payment Service
// Stripe-ready with mock fallback
// Switch via PAYMENT_PROVIDER env var
// ═══════════════════════════════════════════════

import { PaymentMethod, PaymentStatus } from "@prisma/client";
import prisma from "@/lib/prisma";

// ── Interface ────────────────────────────────

export interface PaymentIntent {
  id: string;
  orderId: string;
  amountCents: number;
  method: PaymentMethod;
  status: PaymentStatus;
  providerRef: string | null;
  clientSecret: string | null;
}

export interface IPaymentService {
  createPayment(orderId: string, amountCents: number, method: PaymentMethod): Promise<PaymentIntent>;
  confirmPayment(orderId: string): Promise<PaymentIntent>;
  refundPayment(orderId: string): Promise<PaymentIntent>;
  getPaymentStatus(orderId: string): Promise<PaymentIntent | null>;
}

// ── Helper ───────────────────────────────────

function toIntent(p: {
  id: string; orderId: string; amountCents: number;
  method: PaymentMethod; status: PaymentStatus;
  providerRef: string | null; clientSecret: string | null;
}): PaymentIntent {
  return { id: p.id, orderId: p.orderId, amountCents: p.amountCents, method: p.method, status: p.status, providerRef: p.providerRef, clientSecret: p.clientSecret };
}

// ── Mock Implementation ──────────────────────

class MockPaymentService implements IPaymentService {
  async createPayment(orderId: string, amountCents: number, method: PaymentMethod): Promise<PaymentIntent> {
    console.log(`[MOCK PAYMENT] Create: order=${orderId}, ${amountCents}c, ${method}`);
    const payment = await prisma.payment.create({
      data: {
        orderId, amountCents, method,
        status: method === "CASH" || method === "CB_SHOP" ? "PENDING" : "PROCESSING",
        providerRef: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        clientSecret: method === "CB_ONLINE" ? `mock_secret_${orderId}` : null,
      },
    });
    return toIntent(payment);
  }

  async confirmPayment(orderId: string): Promise<PaymentIntent> {
    console.log(`[MOCK PAYMENT] Confirm: order=${orderId}`);
    const payment = await prisma.payment.update({ where: { orderId }, data: { status: "COMPLETED" } });
    await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: "COMPLETED" } });
    return toIntent(payment);
  }

  async refundPayment(orderId: string): Promise<PaymentIntent> {
    console.log(`[MOCK PAYMENT] Refund: order=${orderId}`);
    const payment = await prisma.payment.update({ where: { orderId }, data: { status: "REFUNDED" } });
    await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: "REFUNDED" } });
    return toIntent(payment);
  }

  async getPaymentStatus(orderId: string): Promise<PaymentIntent | null> {
    const p = await prisma.payment.findUnique({ where: { orderId } });
    return p ? toIntent(p) : null;
  }
}

// ── Stripe Implementation ────────────────────

class StripePaymentService implements IPaymentService {
  private getStripe() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not set");
    // Dynamic require to avoid webpack bundling when not used
    const mod = "stripe";
    const Stripe = require(/* webpackIgnore: true */ mod);
    return new Stripe(key, { apiVersion: "2024-04-10" });
  }

  async createPayment(orderId: string, amountCents: number, method: PaymentMethod): Promise<PaymentIntent> {
    // Cash and CB_SHOP don't need Stripe
    if (method === "CASH" || method === "CB_SHOP") {
      const payment = await prisma.payment.create({
        data: { orderId, amountCents, method, status: "PENDING", providerRef: null, clientSecret: null },
      });
      return toIntent(payment);
    }

    const stripe = this.getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "eur",
      metadata: { orderId },
      automatic_payment_methods: { enabled: true },
    });

    const payment = await prisma.payment.create({
      data: {
        orderId, amountCents, method, status: "PROCESSING",
        providerRef: intent.id, clientSecret: intent.client_secret,
      },
    });
    console.log(`[STRIPE] PaymentIntent ${intent.id} for order ${orderId}`);
    return toIntent(payment);
  }

  async confirmPayment(orderId: string): Promise<PaymentIntent> {
    const payment = await prisma.payment.update({ where: { orderId }, data: { status: "COMPLETED" } });
    await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: "COMPLETED" } });
    console.log(`[STRIPE] Confirmed order ${orderId}`);
    return toIntent(payment);
  }

  async refundPayment(orderId: string): Promise<PaymentIntent> {
    const existing = await prisma.payment.findUnique({ where: { orderId } });
    if (existing?.providerRef) {
      const stripe = this.getStripe();
      await stripe.refunds.create({ payment_intent: existing.providerRef });
      console.log(`[STRIPE] Refund for ${existing.providerRef}`);
    }
    const payment = await prisma.payment.update({ where: { orderId }, data: { status: "REFUNDED" } });
    await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: "REFUNDED" } });
    return toIntent(payment);
  }

  async getPaymentStatus(orderId: string): Promise<PaymentIntent | null> {
    const p = await prisma.payment.findUnique({ where: { orderId } });
    return p ? toIntent(p) : null;
  }
}

// ── Factory (env-based) ──────────────────────

function createPaymentService(): IPaymentService {
  const provider = process.env.PAYMENT_PROVIDER || "mock";
  if (provider === "stripe" && process.env.STRIPE_SECRET_KEY) {
    console.log("[PAYMENT] Provider: Stripe");
    return new StripePaymentService();
  }
  console.log("[PAYMENT] Provider: Mock");
  return new MockPaymentService();
}

export const paymentService: IPaymentService = createPaymentService();
