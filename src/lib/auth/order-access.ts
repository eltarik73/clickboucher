// src/lib/auth/order-access.ts — who may open ONE order on the customer side (C1-INVITES).
//
// One rule for every customer-side order route and the tracking page: the order's own credential
// (cookie klikgo-order-<id>, or the legacy cookie klikgo-guest-token for orders placed before
// C1-INVITES), else the signed-in customer who placed it. The credential is checked first, with one
// query and no Clerk call; the session is read at most once, and only when the credential failed.
// The per-person token of the users row is never read: a presented token is only compared with the
// hash stored on the order being opened.
// An order outside the caller's reach is 404, never 403; 401 only when the request carries neither
// a session nor anything shaped like a credential.
//
// Never import this module from src/lib/auth/guest-auth.ts nor from anything reached by
// /api/cron/** (it imports server-auth, see src/lib/__tests__/middleware-matcher.test.ts).
import type { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api/errors";
import { getBoucherOwnerUserId, getServerUserId } from "@/lib/auth/server-auth";
import {
  credentialMatches,
  isCredentialShaped,
  LEGACY_GUEST_TOKEN_COOKIE,
  orderAccessCookieName,
  orderCredentialExpiresAt,
  type CredentialDates,
} from "@/lib/auth/order-credential";
import { isAdmin, isBoucher } from "@/lib/roles";

/** Satisfied by NextRequest.cookies and by cookies() from next/headers. */
export interface CookieSource {
  get(name: string): { value: string } | undefined;
}

export type OrderAccess =
  | { ok: true; orderId: string; customerId: string; via: "credential" | "session" }
  | { ok: false; status: 401 | 404 };

export type OrderRead =
  | { ok: true; orderId: string; reader: "customer" | "shop" | "admin" }
  | { ok: false; status: 401 | 404 };

const credentialSelect = {
  id: true,
  userId: true,
  accessTokenHash: true,
  createdAt: true,
  pickupSlotEnd: true,
  pickedUpAt: true,
} as const satisfies Prisma.OrderSelect;

type CredentialRow = Prisma.OrderGetPayload<{ select: typeof credentialSelect }>;

/** The credential-shaped values of the order's cookie and of the legacy cookie. */
function presentedTokens(orderId: string, cookies: CookieSource): string[] {
  return [
    cookies.get(orderAccessCookieName(orderId))?.value,
    cookies.get(LEGACY_GUEST_TOKEN_COOKIE)?.value,
  ].filter((value): value is string => typeof value === "string" && isCredentialShaped(value));
}

/** Is the order's credential live at `now`, and does one of `tokens` match it? */
function credentialOpens(row: CredentialRow, tokens: string[], now: Date): boolean {
  const storedHash = row.accessTokenHash;
  if (storedHash === null || now >= orderCredentialExpiresAt(row)) return false;
  // Every candidate is compared, whichever matches.
  return tokens.map((token) => credentialMatches(token, storedHash)).includes(true);
}

/** The customer rule, plus the Clerk id it read (null without a session or when not read). */
async function customerAccess(
  orderId: string,
  cookies: CookieSource,
  now: Date
): Promise<{ access: OrderAccess; clerkId: string | null }> {
  const tokens = presentedTokens(orderId, cookies);
  if (tokens.length > 0) {
    const row = await prisma.order.findUnique({ where: { id: orderId }, select: credentialSelect });
    if (row && credentialOpens(row, tokens, now)) {
      return {
        access: { ok: true, orderId: row.id, customerId: row.userId, via: "credential" },
        clerkId: null,
      };
    }
  }

  const clerkId = await getServerUserId();
  if (clerkId) {
    const owned = await prisma.order.findFirst({
      where: { id: orderId, user: { clerkId } },
      select: { id: true, userId: true },
    });
    if (owned) {
      return {
        access: { ok: true, orderId: owned.id, customerId: owned.userId, via: "session" },
        clerkId,
      };
    }
  }

  return {
    access: { ok: false, status: clerkId || tokens.length > 0 ? 404 : 401 },
    clerkId,
  };
}

/**
 * May the caller act on this order as its customer? `customerId` is orders.user_id: pass it as the
 * userId scope of the customer commands (cancel, adjustment answer, out-of-stock answer).
 */
export async function authorizeOrderAccess(
  orderId: string,
  cookies: CookieSource,
  now: Date = new Date()
): Promise<OrderAccess> {
  return (await customerAccess(orderId, cookies, now)).access;
}

/**
 * May the caller read this order? Its customer (same rule as authorizeOrderAccess), else an admin,
 * else the butcher of the order's shop (ownerId = their clerkId, their users.id, or the shop owner
 * of the test mode). Staff are looked up only after the customer rule failed and a session exists.
 * For GET /api/orders/[id] and GET /api/orders/[id]/status only.
 */
export async function authorizeOrderRead(
  orderId: string,
  cookies: CookieSource,
  now: Date = new Date()
): Promise<OrderRead> {
  const { access, clerkId } = await customerAccess(orderId, cookies, now);
  if (access.ok) return { ok: true, orderId: access.orderId, reader: "customer" };
  if (!clerkId) return access;

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  });
  if (user && isAdmin(user.role)) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
    if (order) return { ok: true, orderId: order.id, reader: "admin" };
  } else if (user && isBoucher(user.role)) {
    const ownerIds = [clerkId, user.id, await getBoucherOwnerUserId()].filter(
      (ownerId): ownerId is string => !!ownerId
    );
    const order = await prisma.order.findFirst({
      where: { id: orderId, shop: { ownerId: { in: ownerIds } } },
      select: { id: true },
    });
    if (order) return { ok: true, orderId: order.id, reader: "shop" };
  }
  return access;
}

/**
 * The order's dates when `token` is its live credential, else null. Used by the e-mailed link
 * (/suivi/<id>/acces/<token>) before it sets the order's cookie.
 */
export async function verifyOrderCredential(
  orderId: string,
  token: string,
  now: Date = new Date()
): Promise<(CredentialDates & { id: string }) | null> {
  if (!isCredentialShaped(token)) return null;
  const row = await prisma.order.findUnique({ where: { id: orderId }, select: credentialSelect });
  if (!row || !credentialOpens(row, [token], now)) return null;
  return {
    id: row.id,
    createdAt: row.createdAt,
    pickupSlotEnd: row.pickupSlotEnd,
    pickedUpAt: row.pickedUpAt,
  };
}

/**
 * Replaces the credential of a guest order (replay of a guest checkout whose first answer was
 * lost). False, and nothing written, for an order not placed as a guest.
 */
export async function replaceOrderCredential(orderId: string, tokenHash: string): Promise<boolean> {
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, placedAsGuest: true },
    data: { accessTokenHash: tokenHash },
  });
  return count === 1;
}

/** The answer to a refused OrderAccess or OrderRead. */
export function orderAccessRefusal(status: 401 | 404): NextResponse {
  return status === 401
    ? apiError("UNAUTHORIZED", "Authentification requise")
    : apiError("NOT_FOUND", "Commande introuvable");
}
