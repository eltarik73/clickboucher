// @vitest-environment node
// Une boucherie qui n'est pas en ligne ne prend aucune commande et n'a pas de page publique
// (C1-FAILLES-CRITIQUES), sur PostgreSQL réel et sans Redis, comme en production.
//
// Avant ce chantier, ni le devis ni la création ne lisaient la publication de la boutique : une
// boutique suspendue par l'administration ou jamais validée chiffrait un panier, et recevait des
// commandes tant que son statut restait OPEN ; sa page /boutique/[slug] restait en ligne. Une
// seule règle désormais, shopPublication (src/lib/shop-publication.ts) : prepareOrder (devis et
// création, client connecté comme invité) refuse tout ce qui n'est pas PUBLISHED, loadPublicShop
// ne rend que PUBLISHED ou ON_VACATION. Seuls la session Clerk, les transports et React.cache sont
// simulés.
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Product, Shop } from "@prisma/client";

vi.hoisted(() => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", undefined);
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
});
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));
const session = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@/lib/auth/server-auth", () => ({
  getServerUserId: async () => session.clerkId,
  getBoucherOwnerUserId: async () => null,
  resolveUserRole: async () => undefined,
  getTestRole: () => null,
  isTestActivated: () => false,
}));
// React.cache n'existe que sous la condition « react-server » de Next : hors Next, une identité.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

import { quoteOrder } from "@/lib/services/orders/quote";
import { reactivateShop, suspendShop } from "@/lib/services/shops/moderation";
import { SHOP_ON_VACATION_MESSAGE, SHOP_UNAVAILABLE_MESSAGE } from "@/lib/shop-publication";
import { setVacationMode } from "@/lib/shop-vacation";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestProduct, createTestShop, createTestUser } from "../helpers/factories";
import { quoteRequest } from "../orders/create-order-fixtures";

const { POST: postQuote } = await import("@/app/api/orders/quote/route");
const { POST: postMemberOrder } = await import("@/app/api/orders/route");
const { POST: postGuestCheckout } = await import("@/app/api/checkout/guest/route");
const { loadPublicShop } = await import("@/app/(client)/boutique/[slug]/load-shop");
const { default: BoutiquePage, generateMetadata } =
  await import("@/app/(client)/boutique/[slug]/page");

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

// 350 g à 24,90 €/kg : (2 490 × 350 + 500) / 1 000 arrondi vers le bas = 872 ; paiement sur
// place, aucun frais de service : « Total à payer » = 872.
const PRICE_PER_KG_CENTS = 2490;
const AMOUNT_DUE_CENTS = 872;
const DAY_MS = 24 * 60 * 60 * 1000;

let shop: Shop;
let product: Product;

beforeEach(async () => {
  session.clerkId = null;
  shop = await createTestShop();
  product = await createTestProduct(shop.id, { priceCents: PRICE_PER_KG_CENTS });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const basket = () =>
  quoteRequest(shop.id, [{ productId: product.id, quantity: 1, weightGrams: 350 }]);

/** The order body the cart sends once the customer confirmed « Total à payer ». */
const confirmedOrder = () => ({
  ...basket(),
  idempotencyKey: randomUUID(),
  expectedTotalCents: AMOUNT_DUE_CENTS,
});

interface Answer {
  status: number;
  error?: { code: string; message: string };
  data?: unknown;
}

async function post(
  handler: (req: NextRequest) => Promise<Response>,
  path: string,
  body: unknown
): Promise<Answer> {
  const response = await handler(
    new NextRequest(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
  const json = (await response.json()) as { error?: Answer["error"]; data?: unknown };
  return { status: response.status, error: json.error, data: json.data };
}

/** POST /api/orders by a signed-in customer (CLIENT). */
async function memberOrder(): Promise<Answer> {
  const member = await createTestUser();
  session.clerkId = member.clerkId;
  const answer = await post(postMemberOrder, "/api/orders", confirmedOrder());
  session.clerkId = null;
  return answer;
}

/** POST /api/checkout/guest, as the cart sends it. */
function guestOrder(): Promise<Answer> {
  return post(postGuestCheckout, "/api/checkout/guest", {
    ...confirmedOrder(),
    email: "nora.invitee@itest.klikandgo.test",
    phone: "06 12 34 56 78",
    firstName: "Nora",
    lastName: "Invitée",
  });
}

const refusal = (message: string) => ({
  status: 503,
  error: { code: "SERVICE_DISABLED", message },
});

async function suspendByAdmin(target: Shop): Promise<void> {
  expect(await suspendShop(target.id, "Contrôle sanitaire")).toEqual({ ok: true });
}

/** A row suspended but still listed: SUSPENDED wins over `visible`, whatever its status. */
async function suspendStillListed(target: Shop): Promise<void> {
  await prisma.shop.update({
    where: { id: target.id },
    data: { suspendedAt: new Date(), suspendReason: "Contrôle sanitaire", visible: true },
  });
}

/** Never validated: not listed, not suspended, not on vacation, status still OPEN. */
async function neverValidated(target: Shop): Promise<void> {
  await prisma.shop.update({ where: { id: target.id }, data: { visible: false } });
}

async function startVacation(target: Shop): Promise<void> {
  const start = new Date();
  const end = new Date(start.getTime() + 7 * DAY_MS);
  expect(await setVacationMode(target.id, { start, end })).toEqual({ ok: true });
}

const NOT_ONLINE: Array<[string, (target: Shop) => Promise<void>]> = [
  ["(a) suspendue par l'administration", suspendByAdmin],
  ["(b) suspendue mais encore listée", suspendStillListed],
  ["(c) jamais validée", neverValidated],
];

describe("Boutique hors ligne (suspendue ou non publiée) : ni commande ni page", () => {
  it.each(NOT_ONLINE)("%s : le devis refuse, SERVICE_DISABLED en 503", async (_state, putOff) => {
    await putOff(shop);

    const quoted = await quoteOrder(basket(), null, new Date());
    const viaRoute = await post(postQuote, "/api/orders/quote", basket());

    expect(quoted).toEqual({
      ok: false,
      code: "SERVICE_DISABLED",
      message: SHOP_UNAVAILABLE_MESSAGE,
    });
    expect(viaRoute).toEqual(refusal(SHOP_UNAVAILABLE_MESSAGE));
  });

  it.each(NOT_ONLINE)("%s : un client connecté ne crée aucune commande", async (_state, putOff) => {
    await putOff(shop);

    expect(await memberOrder()).toEqual(refusal(SHOP_UNAVAILABLE_MESSAGE));
    expect(await prisma.order.count()).toBe(0);
  });

  it.each(NOT_ONLINE)("%s : un invité ne crée aucune commande", async (_state, putOff) => {
    await putOff(shop);

    expect(await guestOrder()).toEqual(refusal(SHOP_UNAVAILABLE_MESSAGE));
    expect(await prisma.order.count()).toBe(0);
  });

  it.each(NOT_ONLINE)("%s : la page publique répond 404", async (_state, putOff) => {
    await putOff(shop);

    expect(await loadPublicShop(shop.slug)).toBeNull();
    await expect(generateMetadata({ params: { slug: shop.slug } })).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
    await expect(BoutiquePage({ params: { slug: shop.slug } })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("(d) Boutique en vacances : page en ligne, aucune commande", () => {
  it("le devis refuse avec le message des vacances", async () => {
    await startVacation(shop);

    const quoted = await quoteOrder(basket(), null, new Date());
    const viaRoute = await post(postQuote, "/api/orders/quote", basket());

    expect(quoted).toEqual({
      ok: false,
      code: "SERVICE_DISABLED",
      message: SHOP_ON_VACATION_MESSAGE,
    });
    expect(viaRoute).toEqual(refusal(SHOP_ON_VACATION_MESSAGE));
  });

  it("ni le client connecté ni l'invité ne créent de commande", async () => {
    await startVacation(shop);

    expect(await memberOrder()).toEqual(refusal(SHOP_ON_VACATION_MESSAGE));
    expect(await guestOrder()).toEqual(refusal(SHOP_ON_VACATION_MESSAGE));
    expect(await prisma.order.count()).toBe(0);
  });

  it("la page reste en ligne", async () => {
    await startVacation(shop);

    expect((await loadPublicShop(shop.slug))?.id).toBe(shop.id);
    expect((await generateMetadata({ params: { slug: shop.slug } })).title).toBe(
      `${shop.name} — Boucherie Halal à Chambéry`
    );
  });
});

describe("(e) Boutique en ligne : devis, commandes et page", () => {
  it("le devis vaut 872 c, le client connecté et l'invité créent chacun leur commande", async () => {
    const quoted = await quoteOrder(basket(), null, new Date());
    const member = await memberOrder();
    const guest = await guestOrder();

    expect(quoted).toMatchObject({ ok: true, quote: { amountDueCents: AMOUNT_DUE_CENTS } });
    expect([member.status, guest.status]).toEqual([201, 201]);
    expect(await prisma.order.count({ where: { shopId: shop.id } })).toBe(2);
  });

  it("loadPublicShop rend la boutique et ses produits actifs", async () => {
    const loaded = await loadPublicShop(shop.slug);

    expect(loaded?.id).toBe(shop.id);
    expect(loaded?.products.map((listed) => listed.id)).toEqual([product.id]);
  });
});

describe("Réactivation par l'administration", () => {
  it("après reactivateShop, le devis passe, la commande est créée et la page revient", async () => {
    await suspendByAdmin(shop);
    expect(await loadPublicShop(shop.slug)).toBeNull();

    expect(await reactivateShop(shop.id)).toEqual({ ok: true });
    const quoted = await quoteOrder(basket(), null, new Date());
    const member = await memberOrder();

    expect(quoted).toMatchObject({ ok: true, quote: { amountDueCents: AMOUNT_DUE_CENTS } });
    expect(member.status).toBe(201);
    expect(await prisma.order.count({ where: { shopId: shop.id } })).toBe(1);
    expect((await loadPublicShop(shop.slug))?.id).toBe(shop.id);
  });
});
