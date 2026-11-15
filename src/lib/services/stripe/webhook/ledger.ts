// src/lib/services/stripe/webhook/ledger.ts — each Stripe event id is processed once.
//
// Writes the stripe_events table only. One marker row per event id: claimedAt when a delivery takes
// it, BEFORE the handler runs; handledAt AFTER the handler succeeded (a redelivery is then a
// duplicate). An unhandled marker younger than STALE_CLAIM_MS belongs to a delivery still running;
// an older one was abandoned (function killed at its 30 s limit) and a conditional write on the
// claimedAt read hands it to exactly one new delivery: handlers are idempotent, so running one twice
// is safe, losing an event is not. A failed handler deletes its marker so that Stripe's retry runs.
import type { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import prisma from "@/lib/prisma";

type EventClaim = "claimed" | "duplicate" | "in_progress";

/** Twice the longest function run (30 s, vercel.json): an older unhandled marker is abandoned. */
export const STALE_CLAIM_MS = 60_000;

/** A marker can vanish between the insert and the read (released by a failed run): try again. */
const CLAIM_ATTEMPTS = 2;

function markerColumns(event: Stripe.Event) {
  return {
    type: event.type,
    livemode: event.livemode,
    account: event.account ?? null,
    // A verified Stripe event is the JSON object Stripe sent, parsed by constructEvent: storing it
    // as JSON loses nothing. Its type is a union of SDK interfaces, which Prisma's JSON input type
    // cannot name.
    payload: event as unknown as Prisma.InputJsonObject,
  };
}

/** Claims the event for this delivery, or says why it must not be processed now. */
export async function claimStripeEvent(event: Stripe.Event, now: Date): Promise<EventClaim> {
  for (let attempt = 0; attempt < CLAIM_ATTEMPTS; attempt += 1) {
    const inserted = await prisma.stripeEvent.createMany({
      data: [{ id: event.id, claimedAt: now, ...markerColumns(event) }],
      skipDuplicates: true,
    });
    if (inserted.count === 1) return "claimed";

    const marker = await prisma.stripeEvent.findUnique({
      where: { id: event.id },
      select: { handledAt: true, claimedAt: true },
    });
    if (marker === null) continue;
    if (marker.handledAt !== null) return "duplicate";
    if (now.getTime() - marker.claimedAt.getTime() < STALE_CLAIM_MS) return "in_progress";

    const takenOver = await prisma.stripeEvent.updateMany({
      where: { id: event.id, handledAt: null, claimedAt: marker.claimedAt },
      data: { claimedAt: now, ...markerColumns(event) },
    });
    return takenOver.count === 1 ? "claimed" : "in_progress";
  }
  return "in_progress";
}

/** Records that the claimed event was fully processed. */
export async function markStripeEventHandled(eventId: string, now: Date): Promise<void> {
  await prisma.stripeEvent.updateMany({
    where: { id: eventId, handledAt: null },
    data: { handledAt: now },
  });
}

/** Deletes the unhandled marker after a failed run, so that Stripe's next delivery processes it. */
export async function releaseStripeEvent(eventId: string): Promise<void> {
  await prisma.stripeEvent.deleteMany({ where: { id: eventId, handledAt: null } });
}
