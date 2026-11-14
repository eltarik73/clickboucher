// @vitest-environment node
// Ce que les GET publics des boutiques et des produits, la page publique des bons plans et les
// réponses de commande d'un client renvoient selon l'appelant. Les handlers sont appelés
// directement ; seuls l'identité de l'appelant (helpers d'auth) et les envois sortants sont simulés,
// la base est réelle.
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma, Product, Shop, User } from "@prisma/client";
import {
  listBadgeOffers,
  listPopupOffers,
  listPublicOffers,
  listShopOffers,
} from "@/lib/public-offers";
import { prisma, useCleanDatabase } from "../helpers/db";
import {
  createTestOffer,
  createTestOrder,
  createTestProduct,
  createTestShop,
  createTestUser,
} from "../helpers/factories";
import { quoteOf, quoteRequest } from "../orders/create-order-fixtures";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));

const auth = vi.hoisted(() => ({ clerkId: null as string | null }));

vi.mock("@/lib/auth/server-auth", () => ({
  getServerUserId: async () => auth.clerkId,
  getBoucherOwnerUserId: async () => auth.clerkId,
  resolveUserRole: async () => undefined,
  getTestRole: () => null,
  isTestActivated: () => false,
}));

vi.mock("@/lib/boucher-auth", () => ({
  getAuthenticatedBoucher: async () => {
    throw new Error("getAuthenticatedBoucher ne doit pas être appelé par un GET public");
  },
}));

const { GET: getShop } = await import("@/app/api/shops/[id]/route");
const { GET: listNearbyShops } = await import("@/app/api/shops/nearby/route");
const { GET: getProduct } = await import("@/app/api/products/[id]/route");
const { GET: listProducts } = await import("@/app/api/products/route");
const { GET: getOrder } = await import("@/app/api/orders/[id]/route");
const { GET: getOrderStatus } = await import("@/app/api/orders/[id]/status/route");
const { GET: listOrders } = await import("@/app/api/orders/route");
const { POST: guestCheckout } = await import("@/app/api/checkout/guest/route");
const { POST: cancelOrder } = await import("@/app/api/orders/[id]/cancel/route");

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const SENSITIVE_SHOP_KEYS = [
  "ownerId",
  "email",
  "stripeAccountId",
  "stripeAccountStatus",
  "stripePayoutsEnabled",
  "commissionPct",
  "commissionEnabled",
  "commissionMarkupPercent",
  "tier",
  "monthlyGmvCents",
  "earlyAdopterUntil",
  "siret",
  "legalName",
  "suspendReason",
  "suspendedAt",
  "missedOrdersCount",
  "autoAccept",
  "cachedAcceptanceRate",
  "performanceScore",
];

// Valeurs volontairement reconnaissables : aucune ne doit apparaître dans le corps sérialisé.
const SENSITIVE_SHOP_VALUES = {
  email: "secret-owner@itest.klikandgo.test",
  stripeAccountId: "acct_ITEST_SECRET_42",
  stripeAccountStatus: "restricted-itest-secret",
  commissionPct: 7.77,
  commissionEnabled: true,
  commissionMarkupPercent: 55,
  tier: "PLATINUM",
  monthlyGmvCents: BigInt(987654321),
  earlyAdopterUntil: new Date("2031-02-03T04:05:06.000Z"),
  siret: "98765432109876",
  legalName: "SARL ITEST SECRETE",
  suspendReason: "motif-de-suspension-itest-secret",
  suspendedAt: new Date("2030-01-02T03:04:05.000Z"),
  missedOrdersCount: 4242,
  autoAccept: true,
  cachedAcceptanceRate: 0.123456,
  performanceScore: 77.7777,
  stripePayoutsEnabled: true,
} as const;

const PRO_PRICE = 4321;
const BOUTIQUE_PRICE = 8765;

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
  } else if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      collectKeys(child, keys);
    }
  }
  return keys;
}

function getRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

async function readBody(response: Response): Promise<{ text: string; json: { data: unknown } }> {
  expect(response.status).toBe(200);
  const text = await response.text();
  return { text, json: JSON.parse(text) };
}

let owner: User;
let shop: Shop;
let product: Product;

beforeEach(async () => {
  auth.clerkId = null;
  owner = await createTestUser({ role: "BOUCHER" });
  shop = await createTestShop({ ownerId: owner.id, ...SENSITIVE_SHOP_VALUES });
  product = await createTestProduct(shop.id, {
    proPriceCents: PRO_PRICE,
    boutiquePriceCents: BOUTIQUE_PRICE,
    vatRate: 5.5,
    snoozeReason: "motif-produit-itest-secret",
  });
});

describe("GET /api/shops/[id] (anonyme)", () => {
  it("ne renvoie aucun champ sensible de la boutique, à aucune profondeur", async () => {
    const { text, json } = await readBody(
      await getShop(getRequest(`/api/shops/${shop.id}`), { params: { id: shop.id } })
    );

    const keys = collectKeys(json);
    for (const key of SENSITIVE_SHOP_KEYS) expect(keys.has(key), key).toBe(false);
    for (const value of [
      owner.id,
      SENSITIVE_SHOP_VALUES.email,
      SENSITIVE_SHOP_VALUES.stripeAccountId,
      SENSITIVE_SHOP_VALUES.stripeAccountStatus,
      String(SENSITIVE_SHOP_VALUES.commissionPct),
      String(SENSITIVE_SHOP_VALUES.monthlyGmvCents),
      SENSITIVE_SHOP_VALUES.earlyAdopterUntil.toISOString(),
      SENSITIVE_SHOP_VALUES.siret,
      SENSITIVE_SHOP_VALUES.legalName,
      SENSITIVE_SHOP_VALUES.suspendReason,
      String(SENSITIVE_SHOP_VALUES.missedOrdersCount),
      String(SENSITIVE_SHOP_VALUES.cachedAcceptanceRate),
      String(SENSITIVE_SHOP_VALUES.performanceScore),
    ]) {
      expect(text, value).not.toContain(value);
    }
  });

  it("ne renvoie ni tarif pro ni prix magasin sur les produits", async () => {
    const { text, json } = await readBody(
      await getShop(getRequest(`/api/shops/${shop.id}`), { params: { id: shop.id } })
    );
    const data = json.data as { products: Array<Record<string, unknown>> };

    expect(data.products.map((p) => p.id)).toEqual([product.id]);
    for (const p of data.products) {
      expect(p).not.toHaveProperty("proPriceCents");
      expect(p).not.toHaveProperty("boutiquePriceCents");
      expect(p).not.toHaveProperty("snoozeReason");
    }
    expect(text).not.toContain("motif-produit-itest-secret");
  });

  it("renvoie les trois indicateurs de paiement lus par le panier et le temps de préparation effectif", async () => {
    const { json } = await readBody(
      await getShop(getRequest(`/api/shops/${shop.id}`), { params: { id: shop.id } })
    );

    expect(json.data).toMatchObject({
      id: shop.id,
      slug: shop.slug,
      acceptOnline: false,
      acceptOnPickup: true,
      stripeChargesEnabled: false,
      effectivePrepTime: shop.prepTimeMin,
    });
  });

  it("répond 404 pour une boutique inconnue", async () => {
    const response = await getShop(getRequest("/api/shops/inconnue"), {
      params: { id: "inconnue" },
    });
    expect(response.status).toBe(404);
  });
});

describe("GET /api/products/[id]", () => {
  async function detail(): Promise<{ response: Response; data: Record<string, unknown> }> {
    const response = await getProduct(getRequest(`/api/products/${product.id}`), {
      params: { id: product.id },
    });
    const { json } = await readBody(response.clone());
    return { response, data: json.data as Record<string, unknown> };
  }

  it("anonyme : ni tarif pro ni prix magasin, réponse jamais stockée par un cache partagé", async () => {
    const { response, data } = await detail();

    expect(data).toMatchObject({ id: product.id, priceCents: product.priceCents });
    expect(data).not.toHaveProperty("proPriceCents");
    expect(data).not.toHaveProperty("boutiquePriceCents");
    expect(data).not.toHaveProperty("vatRate");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("propriétaire après un appel anonyme sur la même URL : ligne complète, private, no-store", async () => {
    await detail();
    auth.clerkId = owner.clerkId;

    const { response, data } = await detail();
    expect(data).toHaveProperty("boutiquePriceCents", BOUTIQUE_PRICE);
    expect(data).toHaveProperty("proPriceCents", PRO_PRICE);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("client connecté sans rôle pro : projection publique", async () => {
    const client = await createTestUser({ role: "CLIENT" });
    auth.clerkId = client.clerkId;

    const { data } = await detail();
    expect(data).not.toHaveProperty("proPriceCents");
    expect(data).not.toHaveProperty("boutiquePriceCents");
  });

  it("CLIENT_PRO : tarif pro, sans prix magasin, jamais en cache partagé", async () => {
    const pro = await createTestUser({ role: "CLIENT_PRO" });
    auth.clerkId = pro.clerkId;

    const { response, data } = await detail();
    expect(data.proPriceCents).toBe(PRO_PRICE);
    expect(data).not.toHaveProperty("boutiquePriceCents");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("propriétaire de la boutique : ligne complète, jamais en cache partagé", async () => {
    auth.clerkId = owner.clerkId;

    const { response, data } = await detail();
    expect(data).toMatchObject({
      proPriceCents: PRO_PRICE,
      boutiquePriceCents: BOUTIQUE_PRICE,
      vatRate: 5.5,
    });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("propriétaire enregistré par son clerkId dans shop.ownerId : ligne complète", async () => {
    const legacyOwner = await createTestUser({
      role: "BOUCHER",
      clerkId: "user_itest_legacy_owner",
    });
    const legacyShop = await createTestShop({ ownerId: "user_itest_legacy_owner" });
    product = await createTestProduct(legacyShop.id, {
      proPriceCents: PRO_PRICE,
      boutiquePriceCents: BOUTIQUE_PRICE,
    });
    auth.clerkId = legacyOwner.clerkId;

    const { data } = await detail();
    expect(data).toMatchObject({ proPriceCents: PRO_PRICE, boutiquePriceCents: BOUTIQUE_PRICE });
  });

  it("boucher d'une autre boutique : projection publique", async () => {
    const otherOwner = await createTestUser({ role: "BOUCHER" });
    await createTestShop({ ownerId: otherOwner.id });
    auth.clerkId = otherOwner.clerkId;

    const { data } = await detail();
    expect(data).not.toHaveProperty("proPriceCents");
    expect(data).not.toHaveProperty("boutiquePriceCents");
  });

  it("administrateur : ligne complète", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    auth.clerkId = admin.clerkId;

    const { data } = await detail();
    expect(data).toMatchObject({ proPriceCents: PRO_PRICE, boutiquePriceCents: BOUTIQUE_PRICE });
  });

  it("répond 404 pour un produit inconnu, connecté ou non", async () => {
    expect((await getProduct(getRequest("/api/products/x"), { params: { id: "x" } })).status).toBe(
      404
    );
    auth.clerkId = owner.clerkId;
    expect((await getProduct(getRequest("/api/products/x"), { params: { id: "x" } })).status).toBe(
      404
    );
  });
});

describe("GET /api/products?shopId=", () => {
  async function list(): Promise<Array<Record<string, unknown>>> {
    const { json } = await readBody(
      await listProducts(getRequest(`/api/products?shopId=${shop.id}`))
    );
    return json.data as Array<Record<string, unknown>>;
  }

  it("anonyme : ni tarif pro ni prix magasin", async () => {
    const products = await list();
    expect(products.map((p) => p.id)).toEqual([product.id]);
    expect(products[0]).not.toHaveProperty("proPriceCents");
    expect(products[0]).not.toHaveProperty("boutiquePriceCents");
    expect(products[0]).not.toHaveProperty("snoozeReason");
  });

  it("CLIENT_PRO : tarif pro, sans prix magasin", async () => {
    const pro = await createTestUser({ role: "CLIENT_PRO" });
    auth.clerkId = pro.clerkId;

    const [p] = await list();
    expect(p.proPriceCents).toBe(PRO_PRICE);
    expect(p).not.toHaveProperty("boutiquePriceCents");
  });

  it("propriétaire : les deux prix et les champs de gestion de sa page catalogue", async () => {
    auth.clerkId = owner.clerkId;

    const [p] = await list();
    expect(p).toMatchObject({
      proPriceCents: PRO_PRICE,
      boutiquePriceCents: BOUTIQUE_PRICE,
      snoozeReason: "motif-produit-itest-secret",
    });
    expect(p).toHaveProperty("stockQty");
    expect(p).toHaveProperty("snoozedAt");
  });

  it("boucher d'une autre boutique : projection publique", async () => {
    const otherOwner = await createTestUser({ role: "BOUCHER" });
    await createTestShop({ ownerId: otherOwner.id });
    auth.clerkId = otherOwner.clerkId;

    const [p] = await list();
    expect(p).not.toHaveProperty("proPriceCents");
    expect(p).not.toHaveProperty("boutiquePriceCents");
  });

  it("administrateur : les deux prix", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    auth.clerkId = admin.clerkId;

    const [p] = await list();
    expect(p).toMatchObject({ proPriceCents: PRO_PRICE, boutiquePriceCents: BOUTIQUE_PRICE });
  });
});

describe("page /bons-plans : codes promo publics", () => {
  it("ne publie que les offres pour tous, diffusées, actives et non épuisées", async () => {
    const now = new Date();
    const visible = await createTestOffer({ code: "POURTOUS", audience: "ALL", diffBadge: true });
    await createTestOffer({
      code: "RVWVIP",
      audience: "VIP",
      diffBadge: false,
      diffBanner: false,
      diffPopup: false,
    });
    await createTestOffer({ code: "VIPDIFFUSE", audience: "VIP", diffBadge: true });
    await createTestOffer({
      code: "NONDIFFUSE",
      audience: "ALL",
      diffBadge: false,
      diffBanner: false,
      diffPopup: false,
    });
    await createTestOffer({
      code: "RECMAX1",
      audience: "ALL",
      diffBadge: true,
      maxUses: 1,
      currentUses: 1,
    });
    await createTestOffer({ code: "BROUILLON", audience: "ALL", diffBadge: true, status: "DRAFT" });

    const offers = await listPublicOffers(now);

    expect(offers.map((offer) => offer.code)).toEqual(["POURTOUS"]);
    expect(offers[0]).toMatchObject({ id: visible.id, valuePercent: visible.discountValue });
  });
});

describe("accueil et page boutique : codes promo diffusés", () => {
  const PRIVATE_CODES = ["VIPCIBLE", "NOUVEAUX", "EPUISE", "BROUILLON2", "NONDIFFUSE2"];

  async function createPrivateOffers(diffusion: Partial<Prisma.OfferUncheckedCreateInput>) {
    const offers = [
      await createTestOffer({ ...diffusion, shopId: shop.id, code: "VIPCIBLE", audience: "VIP" }),
      await createTestOffer({ ...diffusion, shopId: shop.id, code: "NOUVEAUX", audience: "NEW" }),
      await createTestOffer({
        ...diffusion,
        shopId: shop.id,
        code: "EPUISE",
        maxUses: 2,
        currentUses: 2,
      }),
      await createTestOffer({ ...diffusion, shopId: shop.id, code: "BROUILLON2", status: "DRAFT" }),
      await createTestOffer({
        shopId: shop.id,
        code: "NONDIFFUSE2",
        diffBadge: false,
        diffBanner: false,
        diffPopup: false,
      }),
    ];
    for (const offer of offers) {
      await prisma.offerProduct.create({
        data: { offerId: offer.id, productId: product.id, shopId: shop.id },
      });
    }
  }

  it("popup de l'accueil : seulement les offres pour tous, en popup, actives et non épuisées", async () => {
    await createPrivateOffers({ diffPopup: true });
    await createTestOffer({ code: "BADGESEUL", diffBadge: true, diffPopup: false });
    await createTestOffer({ code: "POPUPTOUS", diffPopup: true, maxUses: 5, currentUses: 4 });

    const popup = await listPopupOffers(new Date(), 3);

    expect(popup.map((offer) => offer.code)).toEqual(["POPUPTOUS"]);
  });

  it("badges de l'accueil : aucune offre ciblée ni épuisée ne s'affiche sur une carte boutique", async () => {
    await createPrivateOffers({ diffBadge: true });
    const visible = await createTestOffer({ shopId: shop.id, code: "BADGETOUS", diffBadge: true });

    const badges = await listBadgeOffers(new Date(), 6);

    expect(badges.map((offer) => offer.id)).toEqual([visible.id]);
  });

  it("page boutique : bannière et produits en offre ne montrent que les codes publics de la boutique", async () => {
    await createPrivateOffers({ diffBanner: true });
    const banner = await createTestOffer({ shopId: shop.id, code: "BANNIERE", diffBanner: true });
    const platform = await createTestOffer({ code: "PLATEFORME", diffBadge: true });
    await prisma.offerProposal.create({
      data: { offerId: platform.id, shopId: shop.id, status: "ACCEPTED" },
    });
    const otherShop = await createTestShop({ ownerId: owner.id });
    await createTestOffer({ shopId: otherShop.id, code: "AUTREBOUTIQUE", diffBanner: true });

    const offers = await listShopOffers(shop.id, new Date());

    const codes = offers.map((offer) => offer.code).sort();
    expect(codes).toEqual(["BANNIERE", "PLATEFORME"]);
    for (const code of PRIVATE_CODES) expect(codes).not.toContain(code);
    expect(offers.find((offer) => offer.diffBanner)?.id).toBe(banner.id);
  });
});

describe("GET /api/shops/nearby : badges des cartes boutique", () => {
  it("seule une offre pour tous, diffusée en badge et non épuisée pose un badge et remonte la boutique", async () => {
    const coords = { latitude: 45.5646, longitude: 5.9178 };
    await prisma.shop.update({ where: { id: shop.id }, data: { ...coords, rating: 5 } });
    const promoShop = await createTestShop({ ownerId: owner.id, ...coords, rating: 1 });
    await createTestOffer({
      shopId: shop.id,
      code: "VIPSECRET",
      audience: "VIP",
      discountValue: 30,
    });
    await createTestOffer({
      shopId: shop.id,
      code: "NOUVEAUX3",
      audience: "NEW",
      discountValue: 20,
    });
    await createTestOffer({
      shopId: shop.id,
      code: "EPUISE25",
      discountValue: 25,
      maxUses: 5,
      currentUses: 5,
    });
    await createTestOffer({ shopId: promoShop.id, code: "POURTOUS15", discountValue: 15 });

    const { json } = await readBody(
      await listNearbyShops(getRequest("/api/shops/nearby?lat=45.5646&lng=5.9178&radius=50"))
    );

    const shops = json.data as Array<{ id: string; activePromo: string | null }>;
    expect(shops.map((s) => [s.id, s.activePromo])).toEqual([
      [promoShop.id, "-15%"],
      [shop.id, null],
    ]);
  });
});

const SECRET_ORDER_KEYS = [
  "commissionCents",
  "idempotencyKey",
  "offerId",
  "loyaltyRewardId",
  "stripePaymentId",
  "stripeCheckoutSessionId",
  "stripePaymentIntentId",
  "stripeTransferId",
  "platformFeeCents",
  "shopPayoutCents",
  "userId",
  "shopId",
  "ownerId",
  "clerkId",
  "guestToken",
  "email",
  "proPriceCents",
  "boutiquePriceCents",
  "stockQty",
  "referenceId",
  "vatRate",
];

function expectCustomerView(text: string, json: unknown) {
  const keys = collectKeys(json);
  for (const key of SECRET_ORDER_KEYS) expect(keys.has(key), key).toBe(false);
  for (const value of [
    owner.id,
    String(PRO_PRICE),
    String(BOUTIQUE_PRICE),
    "itest-secret-idempotency",
  ]) {
    expect(text, value).not.toContain(value);
  }
}

describe("commandes : vue client", () => {
  async function guestOrder() {
    const guest = await createTestUser({ clerkId: null, isGuest: true, guestToken: randomUUID() });
    const order = await createTestOrder({
      shopId: shop.id,
      userId: guest.id,
      items: [{ productId: product.id }],
      overrides: { commissionCents: 123, stripePaymentIntentId: "pi_itest_secret" },
    });
    return { guest, order };
  }

  it("GET /api/orders/[id]?guestToken= : la vue client, sans propriétaire, identifiants ni prix pro", async () => {
    const { guest, order } = await guestOrder();

    const { text, json } = await readBody(
      await getOrder(getRequest(`/api/orders/${order.id}?guestToken=${guest.guestToken}`), {
        params: { id: order.id },
      })
    );

    expectCustomerView(text, json);
    expect(text).not.toContain("pi_itest_secret");
    expect(json.data).toMatchObject({
      id: order.id,
      items: [{ productId: product.id, product: { name: product.name, unit: product.unit } }],
      shop: { id: shop.id, name: shop.name },
    });
  });

  it("GET /api/orders/[id] : un jeton invalide ou un autre client ne lisent rien (404)", async () => {
    const { order } = await guestOrder();
    const wrongToken = await getOrder(
      getRequest(`/api/orders/${order.id}?guestToken=${randomUUID()}`),
      {
        params: { id: order.id },
      }
    );
    expect(wrongToken.status).toBe(404);

    const stranger = await createTestUser();
    auth.clerkId = stranger.clerkId;
    expect(
      (await getOrder(getRequest(`/api/orders/${order.id}`), { params: { id: order.id } })).status
    ).toBe(404);
  });

  it("GET /api/orders (client connecté) : la vue client de ses commandes", async () => {
    const client = await createTestUser();
    await createTestOrder({
      shopId: shop.id,
      userId: client.id,
      items: [{ productId: product.id }],
      overrides: { idempotencyKey: "itest-secret-idempotency" },
    });
    auth.clerkId = client.clerkId;

    const { text, json } = await readBody(await listOrders(getRequest("/api/orders")));

    expect(json.data).toHaveLength(1);
    expectCustomerView(text, json);
  });

  describe("GET /api/orders/[id]/status", () => {
    async function readStatus(orderId: string) {
      return getOrderStatus(getRequest(`/api/orders/${orderId}/status`), {
        params: { id: orderId },
      });
    }

    async function clientOrder() {
      const client = await createTestUser({ firstName: "Samia", lastName: "Benali" });
      const order = await createTestOrder({
        shopId: shop.id,
        userId: client.id,
        items: [{ productId: product.id }],
      });
      return { client, order };
    }

    it("le client : son statut, avec seulement le prénom et le nom de l'utilisateur", async () => {
      const { client, order } = await clientOrder();
      auth.clerkId = client.clerkId;

      const { text, json } = await readBody(await readStatus(order.id));

      expect(json.data).toMatchObject({ id: order.id, status: "PENDING" });
      expect((json.data as { user: unknown }).user).toEqual({
        firstName: "Samia",
        lastName: "Benali",
      });
      expect(collectKeys(json).has("clerkId")).toBe(false);
      expect(text).not.toContain(client.clerkId as string);
    });

    it("le boucher de la boutique : le statut, sans clerkId du client", async () => {
      const { client, order } = await clientOrder();
      auth.clerkId = owner.clerkId;

      const { text, json } = await readBody(await readStatus(order.id));

      expect((json.data as { user: unknown }).user).toEqual({
        firstName: "Samia",
        lastName: "Benali",
      });
      expect(text).not.toContain(client.clerkId as string);
    });

    it("un autre client ou le boucher d'une autre boutique ne lisent rien (404), anonyme 401", async () => {
      const { order } = await clientOrder();

      expect((await readStatus(order.id)).status).toBe(401);

      const stranger = await createTestUser();
      auth.clerkId = stranger.clerkId;
      expect((await readStatus(order.id)).status).toBe(404);

      const otherOwner = await createTestUser({ role: "BOUCHER" });
      await createTestShop({ ownerId: otherOwner.id });
      auth.clerkId = otherOwner.clerkId;
      expect((await readStatus(order.id)).status).toBe(404);
    });
  });

  it("POST /api/checkout/guest puis annulation : réponses en vue client", async () => {
    await prisma.shop.update({ where: { id: shop.id }, data: { autoAccept: false } });
    const request = quoteRequest(shop.id, [
      { productId: product.id, quantity: 1, weightGrams: 500 },
    ]);
    const quote = await quoteOf(request, null);
    const created = await guestCheckout(
      new NextRequest(new URL("/api/checkout/guest", "http://localhost:3000"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...request,
          idempotencyKey: randomUUID(),
          expectedTotalCents: quote.amountDueCents,
          email: "invite-itest@klikandgo.test",
          firstName: "Invité",
          lastName: "Test",
        }),
      })
    );
    expect(created.status).toBe(201);
    const text = await created.text();
    const json = JSON.parse(text) as {
      data: { order: Record<string, unknown>; guestToken: string };
    };
    const { guestToken, ...rest } = json.data;
    expect(typeof guestToken).toBe("string");
    expectCustomerView(text.replace(guestToken, ""), rest);
    expect(rest.order).toMatchObject({ totalCents: quote.totalCents, status: "PENDING" });

    const client = await createTestUser();
    const order = await createTestOrder({
      shopId: shop.id,
      userId: client.id,
      items: [{ productId: product.id }],
    });
    auth.clerkId = client.clerkId;
    const cancelled = await readBody(
      await cancelOrder(getRequest(`/api/orders/${order.id}/cancel`), { params: { id: order.id } })
    );
    expectCustomerView(cancelled.text, cancelled.json);
    expect(cancelled.json.data).toMatchObject({ id: order.id, status: "CANCELLED" });
  });
});
