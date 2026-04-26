// src/lib/services/stripe/checkout-session.ts
//
// Skeleton service for creating a Stripe Checkout Session.
// NOT activated — returns SERVICE_DISABLED until STRIPE_SECRET_KEY is set
// AND the real implementation is wired up. See audit/stripe-activation.md.
import { isStripeConfigured } from "@/lib/stripe";

export type CreateCheckoutSessionInput = {
  orderId: string;
  shopId: string;
  amountCents: number;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
};

export type CreateCheckoutSessionResult =
  | { ok: true; sessionId: string; url: string }
  | { ok: false; code: "SERVICE_DISABLED" | "NOT_IMPLEMENTED"; message: string };

export async function createCheckoutSession(
  _input: CreateCheckoutSessionInput,
): Promise<CreateCheckoutSessionResult> {
  if (!isStripeConfigured()) {
    return {
      ok: false,
      code: "SERVICE_DISABLED",
      message: "Stripe not configured",
    };
  }

  // TODO: real implementation when Stripe is activated.
  // Skeleton:
  //   const shop = await prisma.shop.findUnique({ where: { id: input.shopId } });
  //   const session = await getStripeClient().checkout.sessions.create({
  //     mode: "payment",
  //     line_items: [{
  //       price_data: {
  //         currency: "eur",
  //         product_data: { name: `Commande #${input.orderId}` },
  //         unit_amount: input.amountCents,
  //       },
  //       quantity: 1,
  //     }],
  //     customer_email: input.customerEmail,
  //     success_url: input.successUrl,
  //     cancel_url: input.cancelUrl,
  //     metadata: { orderId: input.orderId, shopId: input.shopId },
  //     // Stripe Connect — uncomment once shop.stripeAccountId is wired:
  //     // payment_intent_data: {
  //     //   application_fee_amount: commissionCents,
  //     //   transfer_data: { destination: shop.stripeAccountId! },
  //     // },
  //   }, {
  //     idempotencyKey: `checkout:${input.orderId}`,
  //   });
  //   return { ok: true, sessionId: session.id, url: session.url! };

  return {
    ok: false,
    code: "NOT_IMPLEMENTED",
    message: "Stripe activation pending",
  };
}
