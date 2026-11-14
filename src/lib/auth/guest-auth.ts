// src/lib/auth/guest-auth.ts — the customer a guest checkout places its order as, the cap on guest
// orders awaiting the shop, and the rule that tells which guest orders the shop has not acted on.
//
// A guest proves nothing about the e-mail they type: the users row is only where the order is
// filed, never an access right nor an identity. Access to a guest order is the order's own
// credential (order-credential.ts), and the person it names is the one typed at checkout, recorded
// on the order (guest-placement.ts) and read by every reader, the shop's included, through
// order-person.ts. Every e-mail gets the same treatment, so the answer never tells whether an
// account exists nor whom it belongs to: an account's e-mail files the order under that row, with
// guest semantics.
//
// Reached by the expiry cron through close.ts: this module imports no auth helper (locked by
// src/lib/__tests__/middleware-matcher.test.ts).
import { createHash } from "crypto";
import type { Prisma, User } from "@prisma/client";

import prisma from "@/lib/prisma";
import type { OrderCustomer } from "@/lib/services/orders/quote";
import { ACCEPTED_EVENT_TYPE } from "@/lib/services/orders/stock-hold";
import { SYSTEM_ACTOR_ID } from "@/lib/services/orders/transition";

/** Contact typed at guest checkout: e-mail trimmed and lowercased, phone in E.164 or null. */
export interface GuestIdentity {
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
}

/** Most guest orders awaiting the shop (GUEST_ORDER_AWAITING_SHOP) for one e-mail, and one phone. */
export const MAX_GUEST_ORDERS_AWAITING_SHOP = 5;

export const GUEST_ORDERS_CAP_MESSAGE =
  "Trop de commandes en attente de validation pour ces coordonnées. Attendez que la boucherie les ait traitées, ou connectez-vous.";

/**
 * A guest order the shop has not acted on yet: PENDING, or ACCEPTED by the shop's auto-accept
 * setting (the platform's ACCEPTED event) with no event written by anyone else since. Anyone can
 * place one with any e-mail, so it does not count toward the shop's load: neither in the
 * auto-busy count (announce.ts), nor in the hourly and slot capacity left to other customers
 * (shop-capacity.ts, which bounds these orders on their own), nor, once expired, toward auto-pause
 * (countsTowardAutoPause). It counts as soon as the butcher accepts it or moves it on.
 */
export const GUEST_ORDER_AWAITING_SHOP: Prisma.OrderWhereInput = {
  placedAsGuest: true,
  OR: [
    { status: "PENDING" },
    {
      status: "ACCEPTED",
      events: {
        some: { type: ACCEPTED_EVENT_TYPE, actorId: SYSTEM_ACTOR_ID },
        none: { actorId: { not: SYSTEM_ACTOR_ID } },
      },
    },
  ],
};

/**
 * Whether an order that expired without an answer counts as an order the shop missed. An expired
 * guest order was by definition never acted on: it does not feed auto-pause.
 */
export function countsTowardAutoPause(order: { placedAsGuest: boolean }): boolean {
  return !order.placedAsGuest;
}

type ContactFields = Partial<Pick<User, "phone" | "firstName" | "lastName">>;

/** Contact fields of an existing guest row (never an account) that the guest's input fills in. */
function missingContact(row: User, identity: GuestIdentity): ContactFields {
  const updates: ContactFields = {};
  if (!row.phone && identity.phone) updates.phone = identity.phone;
  if (!row.firstName) updates.firstName = identity.firstName;
  if (!row.lastName) updates.lastName = identity.lastName;
  return updates;
}

/**
 * The customer a guest order is placed as. The users row of the e-mail is found, or created as a
 * guest row (INSERT ... ON CONFLICT DO NOTHING, then read back: two first orders of the same
 * e-mail share one row and nothing fails). An existing guest row only gets a missing phone or
 * missing names; a row that belongs to an account (clerkId) is never written. Whatever the row,
 * the order gets guest semantics: role CLIENT (public prices) and isGuest (no promo code), and it
 * names the person who typed it (confirmation e-mail, butcher's alert), never the row's owner.
 */
export async function resolveGuestCustomer(identity: GuestIdentity): Promise<OrderCustomer> {
  let row = await prisma.user.findUnique({ where: { email: identity.email } });
  if (row === null) {
    await prisma.user.createMany({
      data: [
        {
          email: identity.email,
          firstName: identity.firstName,
          lastName: identity.lastName,
          phone: identity.phone,
          role: "CLIENT",
          isGuest: true,
        },
      ],
      skipDuplicates: true,
    });
    row = await prisma.user.findUniqueOrThrow({ where: { email: identity.email } });
  }

  if (row.clerkId === null) {
    const updates = missingContact(row, identity);
    if (Object.keys(updates).length > 0) {
      const { count } = await prisma.user.updateMany({
        where: { id: row.id, clerkId: null },
        data: updates,
      });
      if (count === 1) row = { ...row, ...updates };
    }
  }

  return {
    id: row.id,
    role: "CLIENT",
    isGuest: true,
    firstName: identity.firstName,
    email: row.email,
  };
}

/** Advisory lock key of a cap: the first 8 bytes of SHA-256(label), as a signed 64-bit integer. */
function capLockKey(label: string): bigint {
  return createHash("sha256").update(label, "utf8").digest().readBigInt64BE(0);
}

/**
 * The admission check of a guest order, run as the first statement of its creation transaction
 * (create.ts). It takes one transaction-scoped advisory lock per key (e-mail, and phone when
 * given), in ascending order so two requests cannot deadlock, then counts the guest orders that
 * await the shop for that e-mail (the users row the orders are filed under) and for that phone
 * (the phone typed on each order, orders.customer_phone). The locks are held until commit, so the
 * cap holds under concurrency; they are transaction-scoped, which is what pgbouncer's transaction
 * pooling supports. Returns the refusal message, or null when the order may be created.
 */
export function guestOrderAdmission(
  identity: Pick<GuestIdentity, "email" | "phone">
): (tx: Prisma.TransactionClient) => Promise<string | null> {
  const caps: Prisma.OrderWhereInput[] = [{ user: { email: identity.email } }];
  const keys = [capLockKey(`guest-order:email:${identity.email}`)];
  if (identity.phone !== null) {
    caps.push({ customerPhone: identity.phone });
    keys.push(capLockKey(`guest-order:phone:${identity.phone}`));
  }
  keys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  return async (tx) => {
    for (const key of keys) {
      // $executeRaw: pg_advisory_xact_lock returns void, which $queryRaw cannot deserialize.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key})`;
    }
    for (const cap of caps) {
      const awaiting = await tx.order.count({ where: { AND: [GUEST_ORDER_AWAITING_SHOP, cap] } });
      if (awaiting >= MAX_GUEST_ORDERS_AWAITING_SHOP) return GUEST_ORDERS_CAP_MESSAGE;
    }
    return null;
  };
}
