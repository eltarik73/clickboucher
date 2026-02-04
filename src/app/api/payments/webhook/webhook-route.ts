import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { paymentService } from "@/lib/services/payment.service";
import { notifyOrderStatus } from "@/lib/services/notification.service";

export async function POST(req: NextRequest) {
  const provider = process.env.PAYMENT_PROVIDER || "mock";

  // ── Mock webhook ────────────────────────────
  if (provider !== "stripe") {
    try {
      const body = await req.json();
      const { orderId, status } = body;
      if (!orderId || !status) {
        return NextResponse.json({ error: "Missing orderId or status" }, { status: 400 });
      }
      if (status === "COMPLETED") {
        await paymentService.confirmPayment(orderId);
        await notifyOrderStatus(orderId, "ACCEPTED");
      }
      return NextResponse.json({ received: true });
    } catch (error) {
      console.error("[MOCK WEBHOOK] Error:", error);
      return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
  }

  // ── Stripe webhook ──────────────────────────
  try {
    const mod = "stripe";
    const Stripe = require(/* webpackIgnore: true */ mod);
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-04-10" });
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET not set" }, { status: 500 });

    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err: any) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    switch (event.type) {
      case "payment_intent.succeeded": {
        const orderId = event.data.object.metadata?.orderId;
        if (orderId) {
          await paymentService.confirmPayment(orderId);
          await notifyOrderStatus(orderId, "ACCEPTED");
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const orderId = event.data.object.metadata?.orderId;
        if (orderId) {
          await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: "FAILED" } });
        }
        break;
      }
      case "charge.refunded": {
        const intentId = event.data.object.payment_intent;
        if (intentId) {
          const payment = await prisma.payment.findFirst({ where: { providerRef: intentId } });
          if (payment) await paymentService.refundPayment(payment.orderId);
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[STRIPE WEBHOOK]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
