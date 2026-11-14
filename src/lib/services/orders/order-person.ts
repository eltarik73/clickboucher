// src/lib/services/orders/order-person.ts — whom an order names, one rule for every reader: the
// customer's views, the shop's (kitchen board, ticket, lists, exports, statistics, client list,
// notices), the platform's, and the phone the customer's messages go to.
//
// A guest order placed since C1-INVITES records the identity typed at checkout on the order
// (customer_first_name, customer_last_name, customer_phone, written by guest-placement.ts). It
// names that identity and nothing of the users row it is filed under: the row is only where the
// order is filed, and it may be someone else's (an account whose e-mail was typed, or an earlier
// guest who used the same e-mail). Any other order — a member's, or a guest order placed before
// C1-INVITES — names its users row. The e-mail is the same either way: the row is the e-mail typed.
//
// Pure: types, Prisma select fragments and string helpers; no database.
import type { Prisma } from "@prisma/client";

import { formatClientName } from "@/lib/format-kitchen";

/** The order columns that decide whom an order names: select them beside the reader's `user`. */
export const orderPersonColumns = {
  placedAsGuest: true,
  customerFirstName: true,
  customerLastName: true,
  customerPhone: true,
} as const satisfies Prisma.OrderSelect;

export type OrderPersonColumns = Prisma.OrderGetPayload<{ select: typeof orderPersonColumns }>;

export interface PersonName {
  firstName: string;
  lastName: string;
}

export interface OrderPerson extends PersonName {
  /** Phone to reach the person: E.164 when typed at guest checkout, null when none was given. */
  phone: string | null;
}

/**
 * The identity typed at guest checkout, when the order records one; null when the order names its
 * users row. A typed identity has no phone when the guest gave none: the row's phone, which may be
 * someone else's, is never used in its place.
 */
export function typedGuestPerson(order: OrderPersonColumns): OrderPerson | null {
  if (!order.placedAsGuest) return null;
  if (order.customerFirstName === null || order.customerLastName === null) return null;
  return {
    firstName: order.customerFirstName,
    lastName: order.customerLastName,
    phone: order.customerPhone,
  };
}

/** Name and phone of the person an order names. */
export function orderPerson(order: OrderPersonColumns & { user: OrderPerson }): OrderPerson {
  return (
    typedGuestPerson(order) ?? {
      firstName: order.user.firstName,
      lastName: order.user.lastName,
      phone: order.user.phone,
    }
  );
}

/** What the shop's order views (kitchen board, order list) show of the person next to an order. */
export const shopPersonSelect = {
  firstName: true,
  lastName: true,
  phone: true,
  loyaltyBadge: true,
} as const satisfies Prisma.UserSelect;

export type ShopPerson = Prisma.UserGetPayload<{ select: typeof shopPersonSelect }>;

/** The person a shop view shows: a typed guest identity has no loyalty badge (that is the row's). */
export function shopOrderPerson(order: OrderPersonColumns & { user: ShopPerson }): ShopPerson {
  const typed = typedGuestPerson(order);
  return typed === null ? order.user : { ...typed, loyaltyBadge: null };
}

/** Name of the person an order names, for the readers that show no phone. */
export function orderPersonName(order: OrderPersonColumns & { user: PersonName }): PersonName {
  const { firstName, lastName } = typedGuestPerson(order) ?? order.user;
  return { firstName, lastName };
}

/** « Prénom.N » (formatClientName) of the person an order names: tickets, notices, lists. */
export function orderClientName(order: OrderPersonColumns & { user: PersonName }): string {
  const { firstName, lastName } = orderPersonName(order);
  return formatClientName(firstName, lastName);
}

/**
 * The shop customer number an order shows. A guest order shows none: since C1-INVITES it takes
 * none at creation (create.ts), and one placed before belongs to a users row the guest proved
 * nothing about. Numbers belong to accounts, which a guest checkout never speaks for.
 */
export function orderCustomerNumber(order: {
  placedAsGuest: boolean;
  customerNumber: number | null;
}): number | null {
  return order.placedAsGuest ? null : order.customerNumber;
}

/**
 * The client an order belongs to in the shop's client lists and statistics: its users row, or for a
 * guest order with a typed identity, that identity typed with that row's e-mail. The key is opaque
 * and unambiguous whatever the names contain.
 */
export function orderClientKey(order: OrderPersonColumns & { userId: string }): string {
  const typed = typedGuestPerson(order);
  return typed === null
    ? order.userId
    : JSON.stringify(["guest", order.userId, typed.firstName, typed.lastName]);
}

/** A row read with orderPersonColumns, split into the row without them and those columns. */
export function splitOrderPerson<T extends OrderPersonColumns>(
  row: T
): { order: Omit<T, keyof OrderPersonColumns>; person: OrderPersonColumns } {
  const { placedAsGuest, customerFirstName, customerLastName, customerPhone, ...order } = row;
  return { order, person: { placedAsGuest, customerFirstName, customerLastName, customerPhone } };
}

/**
 * A row read with orderPersonColumns as a name-only reader shows it: `user` carries the name of the
 * person the order names, the deciding columns are left out. The row's other `user` fields (its id
 * and e-mail, for the platform's readers) are kept: the e-mail is the one typed for the order. A
 * reader that shows a phone or a loyalty badge uses orderPerson or shopOrderPerson instead, which
 * never pass on the row's own (the type refuses them here).
 */
export function withOrderPersonName<
  T extends OrderPersonColumns & { user: PersonName & { phone?: never; loyaltyBadge?: never } },
>(row: T): Omit<T, keyof OrderPersonColumns> {
  const { order, person } = splitOrderPerson(row);
  return { ...order, user: { ...order.user, ...orderPersonName({ ...person, user: order.user }) } };
}
