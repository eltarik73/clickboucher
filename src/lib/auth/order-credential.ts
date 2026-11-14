// src/lib/auth/order-credential.ts — the access credential of ONE order (C1-INVITES).
//
// A guest order gets its own random token (32 bytes, base64url). Only its SHA-256 is stored, in
// orders.access_token_hash; the token itself goes once to the request that created the order, in
// an httpOnly cookie named after the order and as a path segment of the e-mailed link
// (/suivi/<id>/acces/<token>), never in a query string, never in a log.
// Pure module: node:crypto only, no Prisma and no Next runtime, so it is unit-tested directly.
// The database side (lookups, the access rule) is src/lib/auth/order-access.ts.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** A credential stays valid 30 days after pickup (or after the order, when it was never picked up). */
export const ORDER_CREDENTIAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Cookie of the per-person token handed out before C1-INVITES. It is only ever compared with the
 * hash of the order being opened (the migration stored the SHA-256 of the per-person token on
 * those orders), so it opens legacy orders only and closes by itself with their 30-day expiry.
 */
export const LEGACY_GUEST_TOKEN_COOKIE = "klikgo-guest-token";

const TOKEN_BYTES = 32;
/** New base64url tokens (43 characters) and legacy UUID tokens (36 characters) both fit. */
const CREDENTIAL_SHAPE = /^[A-Za-z0-9_-]{16,128}$/;
const STORED_HASH_SHAPE = /^[0-9a-f]{64}$/;

export interface OrderCredential {
  /** 43 base64url characters; never stored. */
  token: string;
  /** 64 lowercase hex characters: what orders.access_token_hash holds. */
  tokenHash: string;
}

export interface CredentialDates {
  createdAt: Date;
  pickupSlotEnd: Date | null;
  pickedUpAt: Date | null;
}

/** Only the options this module sets; NextResponse.cookies satisfies it. */
export interface ResponseCookieJar {
  set(
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: "lax";
      path: string;
      expires: Date;
    }
  ): unknown;
}

export function generateOrderCredential(): OrderCredential {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashOrderCredential(token) };
}

/** SHA-256 of the UTF-8 token, lowercase hex: equal to SQL encode(sha256(convert_to(token, 'UTF8')), 'hex'). */
export function hashOrderCredential(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** 16 to 128 characters of [A-Za-z0-9_-]: anything else is never looked up nor hashed. */
export function isCredentialShaped(value: string): boolean {
  return CREDENTIAL_SHAPE.test(value);
}

/** Does `token` hash to `storedHash`? Constant time; false on any malformed input. */
export function credentialMatches(token: string, storedHash: string): boolean {
  if (!isCredentialShaped(token) || !STORED_HASH_SHAPE.test(storedHash)) return false;
  const presented = createHash("sha256").update(token, "utf8").digest();
  return timingSafeEqual(presented, Buffer.from(storedHash, "hex"));
}

/**
 * The instant from which the order's credential is refused: 30 days after pickup; for an order not
 * picked up, 30 days after the later of its creation and the end of its pickup slot.
 */
export function orderCredentialExpiresAt(order: CredentialDates): Date {
  const { createdAt, pickupSlotEnd, pickedUpAt } = order;
  const slotOrCreation = pickupSlotEnd && pickupSlotEnd > createdAt ? pickupSlotEnd : createdAt;
  const anchor = pickedUpAt ?? slotOrCreation;
  return new Date(anchor.getTime() + ORDER_CREDENTIAL_TTL_MS);
}

/** One cookie per order: a guest may hold several orders. */
export function orderAccessCookieName(orderId: string): string {
  return `klikgo-order-${orderId}`;
}

/** The tracking page of an order. */
export function orderPagePath(orderId: string): string {
  return `/suivi/${encodeURIComponent(orderId)}`;
}

/** The link that hands the credential to a browser: the token is a path segment, never a query. */
export function orderAccessPath(orderId: string, token: string): string {
  return `/suivi/${encodeURIComponent(orderId)}/acces/${encodeURIComponent(token)}`;
}

/** Sets the order's credential cookie, which expires with the credential. */
export function setOrderAccessCookie(
  jar: ResponseCookieJar,
  order: CredentialDates & { id: string },
  token: string
): void {
  jar.set(orderAccessCookieName(order.id), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: orderCredentialExpiresAt(order),
  });
}
