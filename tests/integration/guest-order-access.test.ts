// @vitest-environment node
// Commande invitée : un jeton d'accès PAR COMMANDE (C1-INVITES), sur PostgreSQL réel.
//
// Avant ce chantier, POST /api/checkout/guest renvoyait le jeton de la PERSONNE (users.guest_token)
// à quiconque commandait avec le même e-mail : le second invité lisait la commande du premier
// (constat A01-02, reproduit le 2026-11-14). Ici les vrais handlers sont appelés ; seuls la session
// Clerk (server-auth) et les transports sortants (e-mail, push, WhatsApp) sont simulés. Chaque
// requête porte son propre x-forwarded-for (limiteur par IP, décision D20).
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Product, Shop } from "@prisma/client";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));

const auth = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@/lib/auth/server-auth", () => ({
  getServerUserId: async () => auth.clerkId,
  getBoucherOwnerUserId: async () => null,
  resolveUserRole: async () => undefined,
  getTestRole: () => null,
  isTestActivated: () => false,
}));

import { sendEmail } from "@/lib/email";
import {
  LEGACY_GUEST_TOKEN_COOKIE,
  hashOrderCredential,
  orderAccessCookieName,
} from "@/lib/auth/order-credential";
import { prisma, useCleanDatabase } from "./helpers/db";
import {
  createTestOrder,
  createTestProduct,
  createTestShop,
  createTestUser,
} from "./helpers/factories";
import { quoteOf, quoteRequest } from "./orders/create-order-fixtures";

const { POST: postGuestCheckout } = await import("@/app/api/checkout/guest/route");
const { GET: listOrders, POST: postOrder } = await import("@/app/api/orders/route");
const { GET: getOrder } = await import("@/app/api/orders/[id]/route");
const { GET: getOrderStatus } = await import("@/app/api/orders/[id]/status/route");

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const APP_URL = "https://suivi.itest.klikandgo.test";

let shop: Shop;
let product: Product;
let ipSequence = 0;

beforeEach(async () => {
  auth.clerkId = null;
  vi.mocked(sendEmail).mockClear();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", APP_URL);
  shop = await createTestShop();
  product = await createTestProduct(shop.id);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** A distinct client address per request (TEST-NET-3, RFC 5737). */
function nextClientIp(): string {
  ipSequence += 1;
  return `203.0.113.${ipSequence}`;
}

/** An order body as the cart sends it: the confirmed total is the server's own quote. */
async function orderBody(): Promise<Record<string, unknown>> {
  const request = quoteRequest(shop.id, [{ productId: product.id, quantity: 1, weightGrams: 500 }]);
  const quote = await quoteOf(request, null);
  return { ...request, idempotencyKey: randomUUID(), expectedTotalCents: quote.amountDueCents };
}

interface Answer {
  status: number;
  text: string;
  orderId: string;
  /** Raw Set-Cookie header lines of the answer. */
  setCookies: string[];
  /** Value of the cookie klikgo-order-<orderId>, if the answer set it. */
  accessToken: string | undefined;
}

/** Guest endpoint: { data: { order } }; signed-in endpoint: { data: order }. */
async function readAnswer(response: Response): Promise<Answer> {
  const text = await response.text();
  const { data } = JSON.parse(text) as { data: { order?: { id: string }; id?: string } };
  const orderId = data.order?.id ?? data.id;
  if (typeof orderId !== "string") throw new Error(`Réponse sans commande : ${text}`);
  const prefix = `${orderAccessCookieName(orderId)}=`;
  const setCookies = response.headers.getSetCookie();
  const line = setCookies.find((cookie) => cookie.startsWith(prefix));
  const accessToken =
    line === undefined ? undefined : decodeURIComponent(line.slice(prefix.length).split(";")[0]);
  return { status: response.status, text, orderId, setCookies, accessToken };
}

async function placeGuestOrder(identity: { email: string; firstName: string; lastName: string }) {
  const body = { ...(await orderBody()), ...identity, phone: "" };
  return readAnswer(
    await postGuestCheckout(
      new NextRequest("http://localhost/api/checkout/guest", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": nextClientIp() },
        body: JSON.stringify(body),
      })
    )
  );
}

async function readOrder(orderId: string, cookie: string | null) {
  const headers = new Headers({ "x-forwarded-for": nextClientIp() });
  if (cookie !== null) headers.set("cookie", cookie);
  return getOrder(new NextRequest(`http://localhost/api/orders/${orderId}`, { headers }), {
    params: { id: orderId },
  });
}

async function readStatus(orderId: string, cookie: string | null) {
  const headers = new Headers({ "x-forwarded-for": nextClientIp() });
  if (cookie !== null) headers.set("cookie", cookie);
  return getOrderStatus(
    new NextRequest(`http://localhost/api/orders/${orderId}/status`, { headers }),
    {
      params: { id: orderId },
    }
  );
}

/** The confirmation e-mail sent to `to` (the html handed to the mocked transport). */
function confirmationHtml(to: string): string {
  const calls = vi
    .mocked(sendEmail)
    .mock.calls.filter(([recipient, subject]) => recipient === to && subject.includes("confirmée"));
  expect(calls).toHaveLength(1);
  return calls[0][2];
}

/** Every href of the e-mail that points at a tracking page. */
function trackingHrefs(html: string): string[] {
  return Array.from(html.matchAll(/href="([^"]*\/suivi\/[^"]*)"/g), (match) => match[1]);
}

describe("POST /api/checkout/guest : un jeton d'accès par commande", () => {
  it("deux invités avec le même e-mail (casse différente) : deux jetons, aucun n'ouvre la commande de l'autre", async () => {
    const first = await placeGuestOrder({
      email: "Amina.Invitee@itest.klikandgo.test",
      firstName: "Amina",
      lastName: "Haddad",
    });
    const second = await placeGuestOrder({
      email: "amina.invitee@itest.klikandgo.test",
      firstName: "Bilal",
      lastName: "Martin",
    });

    expect([first.status, second.status]).toEqual([201, 201]);
    expect(second.orderId).not.toBe(first.orderId);
    if (first.accessToken === undefined || second.accessToken === undefined) {
      throw new Error("chaque commande invitée doit poser son cookie d'accès");
    }
    expect(second.accessToken).not.toBe(first.accessToken);
    expect(await prisma.user.count()).toBe(2); // le boucher de la boutique et l'unique ligne invitée

    for (const answer of [first, second]) {
      expect(answer.text).not.toContain("guestToken");
      expect(answer.text).not.toContain(first.accessToken);
      expect(answer.text).not.toContain(second.accessToken);
      expect(answer.setCookies.join("\n")).not.toContain(LEGACY_GUEST_TOKEN_COOKIE);
    }
    expect(second.setCookies.join("\n")).not.toContain(first.accessToken);

    const stored = await prisma.order.findUniqueOrThrow({ where: { id: first.orderId } });
    expect(stored).toMatchObject({
      placedAsGuest: true,
      accessTokenHash: hashOrderCredential(first.accessToken),
    });

    // Le jeton du second invité présenté comme s'il ouvrait la première commande : 404.
    const firstCookie = orderAccessCookieName(first.orderId);
    for (const cookie of [
      `${firstCookie}=${second.accessToken}`,
      `${LEGACY_GUEST_TOKEN_COOKIE}=${second.accessToken}`,
    ]) {
      expect((await readOrder(first.orderId, cookie)).status, cookie).toBe(404);
    }
    // Le navigateur du second invité tel quel : aucun jeton de la première commande, 401.
    const secondBrowser = `${orderAccessCookieName(second.orderId)}=${second.accessToken}`;
    expect((await readOrder(first.orderId, secondBrowser)).status).toBe(401);

    const own = await readOrder(first.orderId, `${firstCookie}=${first.accessToken}`);
    expect(own.status).toBe(200);
    expect(((await own.json()) as { data: { id: string } }).data.id).toBe(first.orderId);
  });

  it("un invité connu par son ancien jeton de personne : ce jeton ne sort jamais et la colonne reste telle quelle", async () => {
    const legacyToken = randomUUID();
    const guest = await createTestUser({
      clerkId: null,
      isGuest: true,
      guestToken: legacyToken,
      email: "ancien.invite@itest.klikandgo.test",
    });

    const answer = await placeGuestOrder({
      email: guest.email,
      firstName: "Karim",
      lastName: "Ancien",
    });

    expect(answer.status).toBe(201);
    expect(answer.text).not.toContain(legacyToken);
    expect(answer.setCookies.join("\n")).not.toContain(legacyToken);
    expect(answer.accessToken).toBeDefined();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: guest.id } });
    expect(user.guestToken).toBe(legacyToken);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: answer.orderId } });
    expect(order.userId).toBe(guest.id);
    expect(order.accessTokenHash).not.toBe(hashOrderCredential(legacyToken));
  });
});

describe("e-mail de confirmation : le lien de suivi", () => {
  it("commande invitée : /suivi/<id>/acces/<jeton>, sans query string ni guestToken", async () => {
    const answer = await placeGuestOrder({
      email: "lien.invite@itest.klikandgo.test",
      firstName: "Lina",
      lastName: "Lien",
    });
    expect(answer.status).toBe(201);
    expect(answer.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const html = confirmationHtml("lien.invite@itest.klikandgo.test");
    const link = `${APP_URL}/suivi/${answer.orderId}/acces/${answer.accessToken}`;
    expect(html).toContain(`href="${link}"`);
    expect(html).not.toContain("guestToken");
    const hrefs = trackingHrefs(html);
    expect(hrefs).toEqual([link]);
    for (const href of hrefs) expect(href).not.toContain("?");
  });

  it("commande d'un client connecté : /suivi/<id>, sans jeton", async () => {
    const client = await createTestUser({ email: "lien.client@itest.klikandgo.test" });
    auth.clerkId = client.clerkId;

    const answer = await readAnswer(
      await postOrder(
        new NextRequest("http://localhost/api/orders", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": nextClientIp() },
          body: JSON.stringify(await orderBody()),
        })
      )
    );

    expect(answer.status).toBe(201);
    expect(answer.accessToken).toBeUndefined();
    expect(trackingHrefs(confirmationHtml(client.email))).toEqual([
      `${APP_URL}/suivi/${answer.orderId}`,
    ]);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: answer.orderId } });
    expect(order).toMatchObject({
      placedAsGuest: false,
      accessTokenHash: null,
      customerFirstName: null,
      customerLastName: null,
      customerPhone: null,
    });
  });
});

describe("identité d'une commande invitée : celle saisie, jamais celle de la ligne users", () => {
  // Avant la correction F1, l'e-mail d'un compte (ou d'un invité précédent) renvoyait à n'importe
  // qui le prénom, le nom et le numéro client de cette personne (revue du chef, 2026-11-14).
  const TYPED = { firstName: "Zoe", lastName: "Sonde" };
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
  const VARYING_STRINGS = new Set(["id", "orderNumber", "displayNumber"]);
  let caseNumber = 0;

  /** The value of an answer with what differs between two orders (ids, numbers, dates) reduced to its kind. */
  function valueClasses(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(valueClasses);
    if (typeof value === "number") return "<nombre>";
    if (typeof value === "string" && ISO_DATE.test(value)) return "<date>";
    if (value === null || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        VARYING_STRINGS.has(key) && typeof child === "string" ? `<${key}>` : valueClasses(child),
      ])
    );
  }

  /** The three customer answers about one guest order: 201 body, GET /api/orders/[id], GET /status. */
  async function customerViews(answer: Answer): Promise<Record<string, unknown>> {
    expect(answer.status).toBe(201);
    const cookie = `${orderAccessCookieName(answer.orderId)}=${answer.accessToken}`;
    const read = await readOrder(answer.orderId, cookie);
    const status = await readStatus(answer.orderId, cookie);
    expect([read.status, status.status]).toEqual([200, 200]);
    return {
      created: (JSON.parse(answer.text) as { data: { order: unknown } }).data.order,
      read: ((await read.json()) as { data: unknown }).data,
      status: ((await status.json()) as { data: unknown }).data,
    };
  }

  /** The last confirmation e-mail sent to `to`. */
  function lastConfirmationHtml(to: string): string {
    const calls = vi
      .mocked(sendEmail)
      .mock.calls.filter(
        ([recipient, subject]) => recipient === to && subject.includes("confirmée")
      );
    expect(calls.length).toBeGreaterThan(0);
    return calls[calls.length - 1][2];
  }

  async function member(role: "CLIENT" | "CLIENT_PRO", email: string) {
    const row = await createTestUser({
      role,
      email,
      firstName: "Marie",
      lastName: "Dupont",
      phone: "+33700000001",
    });
    await prisma.shopCustomer.create({ data: { shopId: shop.id, userId: row.id, number: 29 } });
    return row;
  }

  async function earlierGuest(email: string) {
    const first = await placeGuestOrder({ email, firstName: "Amina", lastName: "Haddad" });
    expect(first.status).toBe(201);
    const row = await prisma.user.findUniqueOrThrow({ where: { email } });
    return { row, first };
  }

  it.each(["CLIENT", "CLIENT_PRO"] as const)(
    "e-mail d'un compte %s : les noms saisis, aucun numéro client, la même réponse qu'un inconnu",
    async (role) => {
      caseNumber += 1;
      const email = `marie.${caseNumber}@itest.klikandgo.test`;
      const row = await member(role, email);
      const before = await prisma.user.findUniqueOrThrow({ where: { id: row.id } });

      const fresh = await customerViews(
        await placeGuestOrder({ email: `inconnu.${caseNumber}@itest.klikandgo.test`, ...TYPED })
      );
      const answer = await placeGuestOrder({ email: email.toUpperCase(), ...TYPED });
      const views = await customerViews(answer);

      for (const [route, view] of Object.entries(views)) {
        expect(view, route).toMatchObject({ user: TYPED, customerNumber: null });
        expect(valueClasses(view), route).toEqual(valueClasses(fresh[route]));
        expect(JSON.stringify(view), route).not.toMatch(/Marie|Dupont/);
      }
      const html = lastConfirmationHtml(email);
      expect(html).toContain(`Bonjour ${TYPED.firstName},`);
      expect(html).not.toContain("Marie");

      // Le titulaire du compte, connecté, voit la commande rattachée avec les noms saisis.
      auth.clerkId = row.clerkId;
      const signedIn = await readOrder(answer.orderId, null);
      expect(signedIn.status).toBe(200);
      expect(((await signedIn.json()) as { data: unknown }).data).toMatchObject({
        user: TYPED,
        customerNumber: null,
      });
      const list = await listOrders(new NextRequest("http://localhost/api/orders"));
      const listed = ((await list.json()) as { data: Array<{ id: string }> }).data;
      expect(listed.find((order) => order.id === answer.orderId)).toMatchObject({
        user: TYPED,
        customerNumber: null,
      });
      auth.clerkId = null;

      expect(await prisma.user.findUniqueOrThrow({ where: { id: row.id } })).toEqual(before);
      // Rangée sous la ligne du compte, la commande ne prend pas le numéro client du compte.
      expect(await prisma.order.findUniqueOrThrow({ where: { id: answer.orderId } })).toMatchObject(
        {
          userId: row.id,
          customerNumber: null,
          customerFirstName: TYPED.firstName,
          customerLastName: TYPED.lastName,
          customerPhone: null,
        }
      );
      expect(await prisma.shopCustomer.findMany({ where: { userId: row.id } })).toEqual([
        expect.objectContaining({ shopId: shop.id, number: 29 }),
      ]);
    }
  );

  it("e-mail d'un invité précédent : chacun lit le nom qu'il a saisi, jamais celui de l'autre", async () => {
    const email = "partage@itest.klikandgo.test";
    const { row, first } = await earlierGuest(email);
    const before = await prisma.user.findUniqueOrThrow({ where: { id: row.id } });

    const fresh = await customerViews(
      await placeGuestOrder({ email: "inconnu.partage@itest.klikandgo.test", ...TYPED })
    );
    const views = await customerViews(await placeGuestOrder({ email, ...TYPED }));

    for (const [route, view] of Object.entries(views)) {
      expect(view, route).toMatchObject({ user: TYPED, customerNumber: null });
      expect(valueClasses(view), route).toEqual(valueClasses(fresh[route]));
      expect(JSON.stringify(view), route).not.toMatch(/Amina|Haddad/);
    }
    expect(lastConfirmationHtml(email)).toContain(`Bonjour ${TYPED.firstName},`);
    const firstViews = await customerViews(first);
    for (const view of Object.values(firstViews)) {
      expect(view).toMatchObject({ user: { firstName: "Amina", lastName: "Haddad" } });
    }
    expect(await prisma.user.findUniqueOrThrow({ where: { id: row.id } })).toEqual(before);
  });

  it("commande invitée d'avant C1-INVITES (sans identité saisie) : la ligne users, sans numéro client", async () => {
    const legacyToken = randomUUID();
    const guest = await createTestUser({
      clerkId: null,
      isGuest: true,
      guestToken: legacyToken,
      email: "avant@itest.klikandgo.test",
      firstName: "Yanis",
      lastName: "Avant",
    });
    const order = await createTestOrder({
      shopId: shop.id,
      userId: guest.id,
      overrides: {
        placedAsGuest: true,
        accessTokenHash: hashOrderCredential(legacyToken),
        customerNumber: 7,
      },
    });

    const read = await readOrder(order.id, `${LEGACY_GUEST_TOKEN_COOKIE}=${legacyToken}`);

    expect(read.status).toBe(200);
    expect(((await read.json()) as { data: unknown }).data).toMatchObject({
      user: { firstName: "Yanis", lastName: "Avant" },
      customerNumber: null,
    });
  });

  it("commande d'un membre connecté : sa ligne users et son numéro client", async () => {
    const client = await createTestUser({ firstName: "Ines", lastName: "Membre" });
    const order = await createTestOrder({
      shopId: shop.id,
      userId: client.id,
      overrides: { customerNumber: 12 },
    });
    auth.clerkId = client.clerkId;

    const read = await readOrder(order.id, null);

    expect(read.status).toBe(200);
    expect(((await read.json()) as { data: unknown }).data).toMatchObject({
      user: { firstName: "Ines", lastName: "Membre" },
      customerNumber: 12,
    });
  });
});
