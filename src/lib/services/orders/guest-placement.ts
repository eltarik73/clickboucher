// src/lib/services/orders/guest-placement.ts — what guest checkout adds to the creation of an order
// (create.ts): the order's own credential (its hash only), the identity typed at checkout, the
// admission check of the guest caps, and the columns of the order row they become.
//
// Pure: types only, no database, no network.
import type { Prisma } from "@prisma/client";

import type { GuestIdentity } from "@/lib/auth/guest-auth";

/** An order placed through guest checkout. The credential is never stored in clear. */
export interface GuestOrderPlacement {
  /** hashOrderCredential(token), written in the creation INSERT with placedAsGuest. */
  accessTokenHash: string;
  /**
   * The identity typed at checkout, recorded on the order. It is the only identity the customer
   * views show: the users row of the e-mail typed may belong to someone else.
   */
  contact: Pick<GuestIdentity, "firstName" | "lastName" | "phone">;
  /** orderAccessPath(orderId, token): the link of the confirmation e-mail. */
  trackingPath: (orderId: string) => string;
  /** First statement of the creation transaction; a message refuses the order (RATE_LIMITED). */
  admit?: (tx: Prisma.TransactionClient) => Promise<string | null>;
}

/**
 * The guest columns of a new order row, written in the same INSERT as the rest of the order. A
 * member order (no placement) is not a guest order, has no credential, and leaves the identity
 * columns NULL: its users row is the customer's own.
 */
export function guestOrderColumns(guest: GuestOrderPlacement | undefined) {
  return {
    placedAsGuest: guest !== undefined,
    accessTokenHash: guest?.accessTokenHash ?? null,
    customerFirstName: guest?.contact.firstName ?? null,
    customerLastName: guest?.contact.lastName ?? null,
    customerPhone: guest?.contact.phone ?? null,
  } satisfies Partial<Prisma.OrderUncheckedCreateInput>;
}
