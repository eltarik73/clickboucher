// @vitest-environment node
// Every customer-side order route opened by the order's own credential (C1-INVITES): the tracking
// status, the cancellation, the answer to a price adjustment, the answer to an out-of-stock
// question. One rule for all of them (src/lib/auth/order-access.ts): the cookie klikgo-order-<id>
// holding the order's live credential, else the session of the customer who placed it; 401 with
// neither, 404 for anything else, and nothing written. The real handlers run on PostgreSQL; only
// the caller's identity (server-auth), the Upstash rate limiter and the outgoing transports are
// mocked.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Order, OrderItem, Product, Shop, User } from "@prisma/client";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));

const auth = vi.hoisted(() => ({
  clerkId: null as string | null,
  getServerUserId: vi.fn<() => Promise<string | null>>(),
  getBoucherOwnerUserId: vi.fn<() => Promise<string | null>>(),
}));
vi.mock("@/lib/auth/server-auth", () => ({
  getServerUserId: auth.getServerUserId,
  getBoucherOwnerUserId: auth.getBoucherOwnerUserId,
}));

const limiter = vi.hoisted(() => ({
  checkRateLimit: vi.fn<(limiter: unknown, key: string) => Promise<{ success: boolean }>>(),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimits: { api: null },
  checkRateLimit: limiter.checkRateLimit,
}));

import { POST as acceptRoute } from "@/app/api/orders/[id]/adjustment/accept/route";
import { POST as rejectRoute } from "@/app/api/orders/[id]/adjustment/reject/route";
import { GET as alternativesRoute } from "@/app/api/orders/[id]/alternatives/route";
import { POST as cancelRoute } from "@/app/api/orders/[id]/cancel/route";
import { POST as chooseRoute } from "@/app/api/orders/[id]/choose-alternatives/route";
import { GET as statusRoute } from "@/app/api/orders/[id]/status/route";
import {
  generateOrderCredential,
  hashOrderCredential,
  orderAccessCookieName,
} from "@/lib/auth/order-credential";
import { adjustOrderPrice } from "@/lib/services/orders/adjust-price";
import { customerOrderSelect } from "@/lib/services/orders/customer-view";
import { prisma, useCleanDatabase } from "./helpers/db";
import {
  createTestOrder,
  createTestProduct,
  createTestShop,
  createTestUser,
} from "./helpers/factories";

// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React
useCleanDatabase();

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const ago = (ms: number) => new Date(Date.now() - ms);
const LATE_CANCEL =
  "Le délai d'annulation de 5 minutes est dépassé : la boutique a déjà accepté votre commande.";

type PlacedOrder = Order & { items: OrderItem[] };
type OrderShape = Pick<Parameters<typeof createTestOrder>[0], "status" | "items" | "overrides">;
type OrderOverrides = OrderShape["overrides"];
type Place = (shape: OrderShape) => Promise<PlacedOrder>;

interface Answer {
  status: number;
  text: string;
  body: {
    data?: Record<string, unknown>;
    error?: { code: string; message: string; details?: Record<string, string[]> };
  };
}

let shop: Shop;
let product: Product;
let missing: Product;
let replacement: Product;
let guest: User;

beforeEach(async () => {
  auth.clerkId = null;
  auth.getServerUserId.mockReset().mockImplementation(async () => auth.clerkId);
  auth.getBoucherOwnerUserId.mockReset().mockResolvedValue(null);
  limiter.checkRateLimit.mockReset().mockResolvedValue({ success: true });
  shop = await createTestShop();
  product = await createTestProduct(shop.id);
  const category = await prisma.category.create({ data: { name: "Saucisses", shopId: shop.id } });
  const inCategory = { categories: { connect: { id: category.id } } };
  missing = await createTestProduct(shop.id, { name: "Merguez", ...inCategory });
  replacement = await createTestProduct(shop.id, { name: "Chipolata", ...inCategory });
  guest = await createTestUser({ clerkId: null, isGuest: true });
});

function request(method: "GET" | "POST", path: string, cookie?: string, body?: string) {
  const headers = new Headers(body === undefined ? {} : { "content-type": "application/json" });
  if (cookie !== undefined) headers.set("cookie", cookie);
  return new NextRequest(new URL(path, "http://localhost:3000"), { method, headers, body });
}

const cookieOf = (orderId: string, token: string) => `${orderAccessCookieName(orderId)}=${token}`;
const ctx = (order: PlacedOrder) => ({ params: { id: order.id } });
const unavailable = (order: PlacedOrder) => order.items.filter((item) => !item.available);
const removeAll = (order: PlacedOrder) =>
  JSON.stringify({
    decisions: unavailable(order).map((line) => ({ orderItemId: line.id, action: "remove" })),
  });

async function answer(response: Response): Promise<Answer> {
  const text = await response.text();
  return { status: response.status, text, body: JSON.parse(text) as Answer["body"] };
}

/** Everything the six routes may change, to prove a refusal wrote nothing. */
const stateOf = (orderId: string) =>
  prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      status: true,
      totalCents: true,
      updatedAt: true,
      items: { select: { id: true, available: true, replacement: true }, orderBy: { id: "asc" } },
      priceAdjustment: { select: { status: true } },
      events: { select: { id: true } },
    },
  });

type Ready = (place: Place) => Promise<PlacedOrder>;

/** A PENDING order of one line at 1911. */
const plain: Ready = (place) => place({});

/** An ACCEPTED order with a pending tier-2 price adjustment (1911 -> 2198, +15 %). */
async function withPendingAdjustment(place: Place): Promise<PlacedOrder> {
  const order = await place({ status: "ACCEPTED" });
  const created = await adjustOrderPrice(order.id, shop.id, {
    adjustmentType: "MANUAL",
    newTotalCents: 2198,
  });
  if (!created.ok || created.data.autoApproved) throw new Error("ajustement en attente attendu");
  return order;
}

/** A PARTIALLY_DENIED order: one line kept, one line out of stock awaiting the customer. */
const outOfStock: Ready = (place) =>
  place({
    status: "PARTIALLY_DENIED",
    items: [{ productId: product.id }, { productId: missing.id, available: false }],
  });

interface RouteCase {
  name: string;
  /** Places, through `place`, an order on which the route succeeds. */
  ready: Ready;
  /** Overrides that expire the order's credential and keep the route's starting state. */
  expired: OrderOverrides;
  call: (order: PlacedOrder, cookie?: string) => Promise<Response>;
  /** Checks a successful answer. */
  succeeded: (order: PlacedOrder, result: Answer) => void;
}

const CREATED_31_DAYS_AGO = { createdAt: ago(31 * DAY_MS) };

const STATUS: RouteCase = {
  name: "GET status",
  ready: plain,
  expired: { status: "PICKED_UP", pickedUpAt: ago(31 * DAY_MS) },
  call: (order, cookie) =>
    statusRoute(request("GET", `/api/orders/${order.id}/status`, cookie), ctx(order)),
  succeeded: (order, { body }) => expect(body.data).toMatchObject({ id: order.id }),
};

const CANCEL: RouteCase = {
  name: "POST cancel",
  ready: plain,
  expired: CREATED_31_DAYS_AGO,
  call: (order, cookie) =>
    cancelRoute(request("POST", `/api/orders/${order.id}/cancel`, cookie), ctx(order)),
  succeeded: (order, { body }) =>
    expect(body.data).toMatchObject({ id: order.id, status: "CANCELLED" }),
};

const ACCEPT: RouteCase = {
  name: "POST adjustment/accept",
  ready: withPendingAdjustment,
  expired: CREATED_31_DAYS_AGO,
  call: (order, cookie) =>
    acceptRoute(request("POST", `/api/orders/${order.id}/adjustment/accept`, cookie), ctx(order)),
  succeeded: (order, { body }) =>
    expect(body.data).toMatchObject({ orderId: order.id, status: "APPROVED", newTotal: 2198 }),
};

const REJECT: RouteCase = {
  name: "POST adjustment/reject",
  ready: withPendingAdjustment,
  expired: CREATED_31_DAYS_AGO,
  call: (order, cookie) =>
    rejectRoute(request("POST", `/api/orders/${order.id}/adjustment/reject`, cookie), ctx(order)),
  succeeded: (order, { body }) =>
    expect(body.data).toMatchObject({ orderId: order.id, status: "REJECTED" }),
};

const ALTERNATIVES: RouteCase = {
  name: "GET alternatives",
  ready: outOfStock,
  expired: CREATED_31_DAYS_AGO,
  call: (order, cookie) =>
    alternativesRoute(
      request("GET", `/api/orders/${order.id}/alternatives?products=${missing.id}`, cookie),
      ctx(order)
    ),
  succeeded: (_order, { body }) =>
    expect(body.data).toEqual({
      [missing.id]: [
        {
          id: replacement.id,
          name: replacement.name,
          priceCents: replacement.priceCents,
          unit: "KG",
        },
      ],
    }),
};

const CHOOSE: RouteCase = {
  name: "POST choose-alternatives",
  ready: outOfStock,
  expired: CREATED_31_DAYS_AGO,
  call: (order, cookie) =>
    chooseRoute(
      request("POST", `/api/orders/${order.id}/choose-alternatives`, cookie, removeAll(order)),
      ctx(order)
    ),
  succeeded: (order, { body }) =>
    expect(body.data).toMatchObject({ id: order.id, status: "PENDING" }),
};

const ROUTES = [STATUS, CANCEL, ACCEPT, REJECT, ALTERNATIVES, CHOOSE];

/** An order as guest checkout writes it: placed as a guest, holding its own credential. */
async function placeAsGuest(ready: Ready = plain, extra: OrderOverrides = {}) {
  const { token, tokenHash } = generateOrderCredential();
  const order = await ready(({ status, items, overrides }) =>
    createTestOrder({
      shopId: shop.id,
      userId: guest.id,
      status,
      items: items ?? [{ productId: product.id }],
      overrides: { ...overrides, ...extra, placedAsGuest: true, accessTokenHash: tokenHash },
    })
  );
  return { order, token };
}

/** An order placed by a signed-in member, without any credential. */
const placeAsMember = (ready: Ready, member: User) =>
  ready(({ status, items, overrides }) =>
    createTestOrder({
      shopId: shop.id,
      userId: member.id,
      status,
      items: items ?? [{ productId: product.id }],
      overrides,
    })
  );

describe.each(ROUTES)("$name", (route) => {
  it("le cookie de la commande suffit, sans lire la session ni chercher de boutique", async () => {
    const { order, token } = await placeAsGuest(route.ready);
    const result = await answer(await route.call(order, cookieOf(order.id, token)));
    expect(result.status, result.text).toBe(200);
    route.succeeded(order, result);
    expect(result.text).not.toContain(token);
    expect(auth.getServerUserId).not.toHaveBeenCalled();
    expect(auth.getBoucherOwnerUserId).not.toHaveBeenCalled();
  });

  it("sans cookie ni session : 401 ; le cookie d'une autre commande, sous son nom : 401", async () => {
    const { order } = await placeAsGuest(route.ready);
    const other = await placeAsGuest(route.ready);
    const before = await stateOf(order.id);
    expect((await route.call(order)).status).toBe(401);
    expect((await route.call(order, cookieOf(other.order.id, other.token))).status).toBe(401);
    expect(await stateOf(order.id)).toEqual(before);
  });

  it("le jeton d'une autre commande du même invité, sous le nom de celle-ci : 404", async () => {
    const { order } = await placeAsGuest(route.ready);
    const other = await placeAsGuest(route.ready);
    const before = await stateOf(order.id);
    expect((await route.call(order, cookieOf(order.id, other.token))).status).toBe(404);
    expect(await stateOf(order.id)).toEqual(before);
  });

  it("un jeton expiré : 404, rien ne change", async () => {
    const { order, token } = await placeAsGuest(route.ready, route.expired);
    const before = await stateOf(order.id);
    expect((await route.call(order, cookieOf(order.id, token))).status).toBe(404);
    expect(await stateOf(order.id)).toEqual(before);
  });

  it("le membre connecté, sur sa commande : succès, sans chercher de boutique", async () => {
    const member = await createTestUser();
    const order = await placeAsMember(route.ready, member);
    auth.clerkId = member.clerkId;
    const result = await answer(await route.call(order));
    expect(result.status, result.text).toBe(200);
    route.succeeded(order, result);
    expect(auth.getBoucherOwnerUserId).not.toHaveBeenCalled();
  });
});

describe("GET /api/orders/[id]/status", () => {
  it("répond la vue client : ses clés exactement, sans empreinte ni identifiant", async () => {
    const { order, token } = await placeAsGuest();
    const { text, body } = await answer(await STATUS.call(order, cookieOf(order.id, token)));
    expect(Object.keys(body.data ?? {}).sort()).toEqual(Object.keys(customerOrderSelect).sort());
    expect(body.data).toMatchObject({ createdAt: order.createdAt.toISOString() });
    for (const secret of [hashOrderCredential(token), guest.id, guest.email]) {
      expect(text).not.toContain(secret);
    }
    for (const key of ["accessTokenHash", "placedAsGuest", "userId", "clerkId"]) {
      expect(text).not.toContain(`"${key}"`);
    }
  });
});

describe("POST /api/orders/[id]/cancel", () => {
  it("PENDING : 200 CANCELLED, un événement au nom du client de la commande", async () => {
    const { order, token } = await placeAsGuest();
    expect((await CANCEL.call(order, cookieOf(order.id, token))).status).toBe(200);
    expect((await stateOf(order.id)).status).toBe("CANCELLED");
    const events = await prisma.orderEvent.findMany({ where: { orderId: order.id } });
    expect(events).toMatchObject([{ type: "CANCELLED", actorId: guest.id }]);
    expect(limiter.checkRateLimit).toHaveBeenCalledWith(null, `order-cancel:${guest.id}`);
  });

  it("ACCEPTED depuis 6 minutes : 409, le même message que pour un membre", async () => {
    const late = { status: "ACCEPTED" as const, createdAt: ago(6 * MINUTE_MS) };
    const { order, token } = await placeAsGuest(plain, late);
    const asGuest = await answer(await CANCEL.call(order, cookieOf(order.id, token)));

    const member = await createTestUser();
    const own = await createTestOrder({ shopId: shop.id, userId: member.id, overrides: late });
    auth.clerkId = member.clerkId;
    const asMember = await answer(await CANCEL.call(own));

    expect(asGuest.status).toBe(409);
    expect(asGuest.body.error?.message).toBe(LATE_CANCEL);
    expect(asMember.body.error).toEqual(asGuest.body.error);
    expect((await stateOf(order.id)).status).toBe("ACCEPTED");
  });

  it("le limiteur refuse : 429, la commande reste en attente", async () => {
    const { order, token } = await placeAsGuest();
    limiter.checkRateLimit.mockResolvedValueOnce({ success: false });
    expect((await CANCEL.call(order, cookieOf(order.id, token))).status).toBe(429);
    expect((await stateOf(order.id)).status).toBe("PENDING");
  });
});

describe("POST /api/orders/[id]/adjustment/{accept,reject}", () => {
  it.each([ACCEPT, REJECT])("$name sans ajustement en attente : 409", async (route) => {
    const { order, token } = await placeAsGuest();
    const result = await answer(await route.call(order, cookieOf(order.id, token)));
    expect(result.status).toBe(409);
    expect(result.body.error?.message).toBe("Aucun ajustement en attente");
  });

  it("accepter applique le nouveau total, refuser le garde", async () => {
    const accepted = await placeAsGuest(withPendingAdjustment);
    await ACCEPT.call(accepted.order, cookieOf(accepted.order.id, accepted.token));
    expect((await stateOf(accepted.order.id)).totalCents).toBe(2198);

    const rejected = await placeAsGuest(withPendingAdjustment);
    await REJECT.call(rejected.order, cookieOf(rejected.order.id, rejected.token));
    expect((await stateOf(rejected.order.id)).totalCents).toBe(1911);
  });
});

describe("POST /api/orders/[id]/choose-alternatives", () => {
  async function choose(order: PlacedOrder, cookie: string | undefined, body: string) {
    const path = `/api/orders/${order.id}/choose-alternatives`;
    return answer(await chooseRoute(request("POST", path, cookie, body), ctx(order)));
  }

  it("retirer la ligne en rupture : la commande repart en attente, la ligne est retirée", async () => {
    const { order, token } = await placeAsGuest(outOfStock);
    expect((await choose(order, cookieOf(order.id, token), removeAll(order))).status).toBe(200);
    const [line] = unavailable(order);
    const stored = await stateOf(order.id);
    expect(stored.status).toBe("PENDING");
    expect(stored.items.find((item) => item.id === line.id)?.replacement).toBe("removed");
  });

  it("un corps mal formé : 400 ; sans accès, 401 avant toute lecture du corps", async () => {
    const { order, token } = await placeAsGuest(outOfStock);
    const cookie = cookieOf(order.id, token);
    const before = await stateOf(order.id);

    const broken = await choose(order, cookie, "{ pas du json");
    expect(broken.status).toBe(400);
    expect(broken.body.error?.code).toBe("VALIDATION_ERROR");

    const empty = await choose(order, cookie, JSON.stringify({ decisions: [] }));
    expect(empty.status).toBe(400);
    expect(empty.body.error).toMatchObject({
      message: "Données invalides",
      details: { decisions: ["Au moins une décision requise"] },
    });

    expect((await choose(order, undefined, "{ pas du json")).status).toBe(401);
    expect(await stateOf(order.id)).toEqual(before);
  });
});
