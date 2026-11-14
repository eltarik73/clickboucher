// @vitest-environment node
// Who opens an order on the customer side (C1-INVITES): the order's own credential, the legacy
// per-person cookie on legacy orders only, the signed-in owner; staff reads; the e-mailed link.
// Real database; only the caller's identity (server-auth) and the outgoing transports are mocked.
import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Order, Shop, User } from "@prisma/client";
import {
  authorizeOrderAccess,
  authorizeOrderRead,
  replaceOrderCredential,
  verifyOrderCredential,
  type CookieSource,
} from "@/lib/auth/order-access";
import {
  generateOrderCredential,
  hashOrderCredential,
  LEGACY_GUEST_TOKEN_COOKIE,
  orderAccessCookieName,
  orderCredentialExpiresAt,
} from "@/lib/auth/order-credential";
import { prisma, useCleanDatabase } from "./helpers/db";
import { createTestOrder, createTestShop, createTestUser } from "./helpers/factories";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({ sendWhatsAppMessage: vi.fn(), sendWhatsAppRaw: vi.fn() }));

const auth = vi.hoisted(() => ({
  clerkId: null as string | null,
  getServerUserId: vi.fn<() => Promise<string | null>>(),
  getBoucherOwnerUserId: vi.fn<() => Promise<string | null>>(),
}));
vi.mock("@/lib/auth/server-auth", () => ({
  getServerUserId: auth.getServerUserId,
  getBoucherOwnerUserId: auth.getBoucherOwnerUserId,
}));

const { GET: getOrder } = await import("@/app/api/orders/[id]/route");
const { GET: openLink } = await import("@/app/(client)/suivi/[id]/acces/[token]/route");

// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React
useCleanDatabase();

const MIGRATION_DIR = path.resolve(__dirname, "../../prisma/migrations/20261114120000_c1_invites");
const BACKFILL_SQL = readFileSync(path.join(MIGRATION_DIR, "backfill-after-release.sql"), "utf8");
const DAY_MS = 24 * 60 * 60 * 1000;
const daysFrom = (now: Date, days: number) => new Date(now.getTime() + days * DAY_MS);
const REFUSED = { ok: false, status: 404 };
const UNAUTHENTICATED = { ok: false, status: 401 };
const granted = (orderId: string, customerId: string, via: "credential" | "session") => ({
  ok: true,
  orderId,
  customerId,
  via,
});
const readBy = (orderId: string, reader: string) => ({ ok: true, orderId, reader });
const columns = (placedAsGuest: boolean, accessTokenHash: string | null) => ({
  placedAsGuest,
  accessTokenHash,
});
const pickedUp = (pickedUpAt: Date) => ({ status: "PICKED_UP" as const, pickedUpAt });

let shop: Shop;
let guest: User;

beforeEach(async () => {
  auth.clerkId = null;
  auth.getServerUserId.mockReset().mockImplementation(async () => auth.clerkId);
  auth.getBoucherOwnerUserId.mockReset().mockResolvedValue(null);
  shop = await createTestShop();
  guest = await createTestUser({ clerkId: null, isGuest: true, guestToken: randomUUID() });
});

type OrderOverrides = Parameters<typeof createTestOrder>[0]["overrides"];
type GuestOrder = { order: Order; token: string };

/** A guest order with its own credential, as guest checkout creates it. */
async function guestOrder(overrides: OrderOverrides = {}): Promise<GuestOrder> {
  const { token, tokenHash } = generateOrderCredential();
  const order = await createTestOrder({
    shopId: shop.id,
    userId: guest.id,
    overrides: { placedAsGuest: true, accessTokenHash: tokenHash, ...overrides },
  });
  return { order, token };
}

function jar(entries: Record<string, string> = {}): CookieSource {
  return { get: (name) => (name in entries ? { value: entries[name] } : undefined) };
}

/** authorizeOrderAccess with `token` in the cookie of order `orderId`. */
const withCookie = (orderId: string, token: string, now?: Date) =>
  authorizeOrderAccess(orderId, jar({ [orderAccessCookieName(orderId)]: token }), now);

const GUEST_COLUMNS = { placedAsGuest: true, accessTokenHash: true } as const;
const guestColumns = (id: string) =>
  prisma.order.findUniqueOrThrow({ where: { id }, select: GUEST_COLUMNS });

async function signIn(user: User | Promise<User>): Promise<void> {
  auth.clerkId = (await user).clerkId;
}

const ownerOf = (s: Shop) => prisma.user.findUniqueOrThrow({ where: { id: s.ownerId } });

const request = (url: string, cookie?: string) =>
  new NextRequest(new URL(url, "http://localhost:3000"), { headers: cookie ? { cookie } : {} });

/** The e-mailed link /suivi/<id>/acces/<token>. */
const followLink = (id: string, token: string) =>
  openLink(request(`/suivi/${id}/acces/${token}`), { params: { id, token } });

describe("authorizeOrderAccess", () => {
  it("le jeton de la commande l'ouvre à son auteur, sans lire la session", async () => {
    const { order, token } = await guestOrder();
    expect(await withCookie(order.id, token)).toEqual(granted(order.id, guest.id, "credential"));
    expect(auth.getServerUserId).not.toHaveBeenCalled();
  });

  it("refuse le jeton d'une autre commande du même invité, sous le nom de celle-ci (404)", async () => {
    const [first, second] = [await guestOrder(), await guestOrder()];
    expect(await withCookie(first.order.id, second.token)).toEqual(REFUSED);
  });

  it("expire 30 jours après le retrait ; un créneau à venir garde valable une commande ancienne", async () => {
    const now = new Date();
    const late = await guestOrder(pickedUp(daysFrom(now, -31)));
    const recent = await guestOrder(pickedUp(daysFrom(now, -29)));
    expect(await withCookie(late.order.id, late.token, now)).toEqual(REFUSED);
    expect((await withCookie(recent.order.id, recent.token, now)).ok).toBe(true);
    const createdAt = daysFrom(now, -40);
    const slotted = await guestOrder({ createdAt, pickupSlotEnd: daysFrom(now, 1) });
    const unslotted = await guestOrder({ createdAt });
    expect((await withCookie(slotted.order.id, slotted.token, now)).ok).toBe(true);
    expect(await withCookie(unslotted.order.id, unslotted.token, now)).toEqual(REFUSED);
  });

  it("la session ouvre la commande au client qui l'a passée, et à lui seul", async () => {
    const member = await createTestUser();
    const order = await createTestOrder({ shopId: shop.id, userId: member.id });
    const guestOne = await guestOrder();

    const noCookie = (orderId: string) => authorizeOrderAccess(orderId, jar());
    expect(await noCookie(guestOne.order.id)).toEqual(UNAUTHENTICATED);
    await signIn(member);
    expect(await noCookie(order.id)).toEqual(granted(order.id, member.id, "session"));
    expect(await noCookie(guestOne.order.id)).toEqual(REFUSED);
    expect(auth.getServerUserId).toHaveBeenCalledTimes(3);
  });
});

describe("commandes antérieures à C1-INVITES", () => {
  it("le rattrapage SQL donne aux commandes invitées l'empreinte du jeton par personne", async () => {
    const legacyToken = guest.guestToken as string;
    const legacy = await createTestOrder({ shopId: shop.id, userId: guest.id });
    const member = await createTestUser({ guestToken: randomUUID() });
    const memberOrder = await createTestOrder({ shopId: shop.id, userId: member.id });

    await prisma.$executeRawUnsafe(BACKFILL_SQL);
    await prisma.$executeRawUnsafe(BACKFILL_SQL);

    const [{ sqlHash }] = await prisma.$queryRaw<Array<{ sqlHash: string }>>`
      SELECT encode(sha256(convert_to(${legacyToken}, 'UTF8')), 'hex') AS "sqlHash"
    `;
    expect(sqlHash).toBe(hashOrderCredential(legacyToken));
    expect(await guestColumns(legacy.id)).toEqual(columns(true, sqlHash));
    expect(await guestColumns(memberOrder.id)).toEqual(columns(false, null));
  });

  it("le cookie par personne ouvre les commandes rattrapées, et elles seules", async () => {
    const legacy = await createTestOrder({ shopId: shop.id, userId: guest.id });
    await prisma.$executeRawUnsafe(BACKFILL_SQL);
    const fresh = await guestOrder();
    const legacyCookie = jar({ [LEGACY_GUEST_TOKEN_COOKIE]: guest.guestToken as string });

    expect(await authorizeOrderAccess(legacy.id, legacyCookie)).toEqual(
      granted(legacy.id, guest.id, "credential")
    );
    expect(await verifyOrderCredential(legacy.id, guest.guestToken as string)).not.toBeNull();
    expect(await authorizeOrderAccess(fresh.order.id, legacyCookie)).toEqual(REFUSED);
  });
});

describe("authorizeOrderRead", () => {
  it("le boucher de la boutique lit, celui d'une autre boutique non (404), l'admin oui", async () => {
    const { order } = await guestOrder();
    await signIn(ownerOf(shop));
    expect(await authorizeOrderRead(order.id, jar())).toEqual(readBy(order.id, "shop"));

    await signIn(ownerOf(await createTestShop()));
    expect(await authorizeOrderRead(order.id, jar())).toEqual(REFUSED);

    await signIn(createTestUser({ role: "ADMIN" }));
    expect(await authorizeOrderRead(order.id, jar())).toEqual(readBy(order.id, "admin"));
  });

  it("ne cherche aucun propriétaire de boutique quand le client est reconnu", async () => {
    const { order, token } = await guestOrder();
    const cookie = jar({ [orderAccessCookieName(order.id)]: token });
    expect(await authorizeOrderRead(order.id, cookie)).toMatchObject({ reader: "customer" });
    expect(auth.getServerUserId).not.toHaveBeenCalled();

    const member = await createTestUser();
    const own = await createTestOrder({ shopId: shop.id, userId: member.id });
    await signIn(member);
    expect(await authorizeOrderRead(own.id, jar())).toMatchObject({ reader: "customer" });
    expect(auth.getServerUserId).toHaveBeenCalledTimes(1);
    expect(auth.getBoucherOwnerUserId).not.toHaveBeenCalled();
  });
});

describe("replaceOrderCredential et verifyOrderCredential", () => {
  it("remplace le jeton d'une commande invitée, jamais celui d'une commande de membre", async () => {
    const { order, token } = await guestOrder();
    const next = generateOrderCredential();
    expect(await replaceOrderCredential(order.id, next.tokenHash)).toBe(true);
    expect((await withCookie(order.id, token)).ok).toBe(false);
    expect((await withCookie(order.id, next.token)).ok).toBe(true);
    const member = await createTestUser();
    const memberOrder = await createTestOrder({ shopId: shop.id, userId: member.id });
    expect(await replaceOrderCredential(memberOrder.id, next.tokenHash)).toBe(false);
    expect((await guestColumns(memberOrder.id)).accessTokenHash).toBeNull();
  });

  it("rend les dates pour un jeton vivant, null pour un jeton expiré, faux ou mal formé", async () => {
    const now = new Date();
    const { order, token } = await guestOrder();
    const { id, createdAt, pickupSlotEnd, pickedUpAt } = order;
    const live = await verifyOrderCredential(id, token, now);
    expect(live).toEqual({ id, createdAt, pickupSlotEnd, pickedUpAt });
    expect(await verifyOrderCredential(order.id, token, daysFrom(now, 31))).toBeNull();
    expect(await verifyOrderCredential(order.id, generateOrderCredential().token, now)).toBeNull();
    expect(await verifyOrderCredential(order.id, `${token}/x`, now)).toBeNull();
  });
});

describe("GET /api/orders/[id]", () => {
  it("le cookie de la commande donne la vue client, sans empreinte ni marqueur invité", async () => {
    const { order, token } = await guestOrder();
    const cookie = `${orderAccessCookieName(order.id)}=${token}`;
    const response = await getOrder(request(`/api/orders/${order.id}`, cookie), {
      params: { id: order.id },
    });
    expect(response.status).toBe(200);
    const text = await response.text();
    const { data } = JSON.parse(text) as { data: Record<string, unknown> };
    expect(data.id).toBe(order.id);
    expect(data).not.toHaveProperty("accessTokenHash");
    expect(data).not.toHaveProperty("placedAsGuest");
    expect(text).not.toContain(token);
    expect(text).not.toContain(hashOrderCredential(token));
  });

  it("ignore ?guestToken= : sans cookie, 401", async () => {
    const legacy = await createTestOrder({ shopId: shop.id, userId: guest.id });
    await prisma.$executeRawUnsafe(BACKFILL_SQL);
    const url = `/api/orders/${legacy.id}?guestToken=${guest.guestToken}`;
    expect((await getOrder(request(url), { params: { id: legacy.id } })).status).toBe(401);
  });
});

describe("GET /suivi/<id>/acces/<token>", () => {
  it("pose le cookie de la commande et renvoie vers son suivi, sans cache ni référent", async () => {
    const { order, token } = await guestOrder();
    const response = await followLink(order.id, token);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toMatch(new RegExp(`/suivi/${order.id}$`));
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");

    const [cookie, ...others] = response.headers.getSetCookie();
    expect(others).toEqual([]);
    expect(cookie.startsWith(`${orderAccessCookieName(order.id)}=${token};`)).toBe(true);
    expect(cookie).toMatch(/;\s*HttpOnly/i);
    expect(cookie).toMatch(/;\s*SameSite=Lax/i);
    expect(cookie).toMatch(/;\s*Path=\/(;|$)/);
    const expires = new Date(cookie.match(/;\s*Expires=([^;]+)/i)?.[1] ?? "invalid");
    expect(expires.toUTCString()).toBe(orderCredentialExpiresAt(order).toUTCString());
  });

  it("un jeton faux ou expiré : même redirection, aucun cookie", async () => {
    const { order } = await guestOrder();
    const expired = await guestOrder(pickedUp(daysFrom(new Date(), -31)));
    for (const [id, token] of [
      [order.id, generateOrderCredential().token],
      [expired.order.id, expired.token],
    ]) {
      const response = await followLink(id, token);
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toMatch(new RegExp(`/suivi/${id}$`));
      expect(response.headers.getSetCookie()).toEqual([]);
    }
  });
});
