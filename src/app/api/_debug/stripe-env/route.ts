// GET /api/_debug/stripe-env — vérifie que les env vars Stripe arrivent au runtime.
// À supprimer après debug de production.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function GET() {
  const secret = process.env.STRIPE_SECRET_KEY;
  const pub = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const wh = process.env.STRIPE_WEBHOOK_SECRET;

  return NextResponse.json({
    hasStripeSecret: !!secret,
    stripeKeyPrefix: secret ? secret.substring(0, 8) : null,
    stripeKeyLength: secret?.length || 0,
    hasStripePublishable: !!pub,
    publishablePrefix: pub ? pub.substring(0, 8) : null,
    hasStripeWebhook: !!wh,
    webhookPrefix: wh ? wh.substring(0, 8) : null,
    envKeys: Object.keys(process.env).filter(k => k.includes("STRIPE")).sort(),
  });
}
