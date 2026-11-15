// src/lib/services/stripe/webhook/ledger.ts — at-most-once processing of a Stripe event id.
//
// Writes the stripe_events table only. One row per event id: the marker is inserted (or taken
// over) BEFORE the handler runs, handledAt is written AFTER it succeeded.
// - handledAt set: the event was processed, a redelivery is a duplicate (200).
// - handledAt NULL and processedAt younger than STALE_CLAIM_MS: another delivery is processing it
//   (409, Stripe retries later).
// - handledAt NULL and older: the delivery that claimed it died (function killed at its 30 s
//   limit, instance stopped) without releasing it. A conditional write on the processedAt value
//   read hands it to exactly one new delivery. Handlers are idempotent, so running one twice is
//   safe; losing an event is not.
// A failed handler deletes its unhandled marker (releaseStripeEvent) so that Stripe's retry runs.
import type { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import prisma from "@/lib/prisma";

export type EventClaim = "claimed" | "duplicate" | "in_progress";

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
      data: [{ id: event.id, processedAt: now, ...markerColumns(event) }],
      skipDuplicates: true,
    });
    if (inserted.count === 1) return "claimed";

    const marker = await prisma.stripeEvent.findUnique({
      where: { id: event.id },
      select: { handledAt: true, processedAt: true },
    });
    if (marker === null) continue;
    if (marker.handledAt !== null) return "duplicate";
    if (now.getTime() - marker.processedAt.getTime() < STALE_CLAIM_MS) return "in_progress";

    const takenOver = await prisma.stripeEvent.updateMany({
      where: { id: event.id, handledAt: null, processedAt: marker.processedAt },
      data: { processedAt: now, ...markerColumns(event) },
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
