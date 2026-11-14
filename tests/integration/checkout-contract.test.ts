// @vitest-environment node
// Contrat panier → commande, de bout en bout sur PostgreSQL réel.
//
// Le panier est construit comme le font les écrans d'ajout (prix unitaire résolu par
// resolveUnitPrice, identifiant de ligne cartLineId, fusion par cartReducer), puis il passe par le
// constructeur de requête du navigateur (src/lib/cart/order-payload.ts) jusqu'au devis et à la
// création de commande du serveur. C'est le test dont l'absence a laissé passer le changement de
// mars 2026 : le panier pré-multipliait la quantité par le poids et le serveur appliquait le poids
// une seconde fois. Chaque cas fixe aussi le sous-total attendu, calculé à la main.
//
// Le dernier bloc envoie la soumission du panier (buildCheckoutSubmission : point d'entrée et corps)
// aux vrais handlers POST /api/orders et POST /api/checkout/guest ; seule l'identité de l'appelant
// connecté est simulée.
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import type { Product } from "@prisma/client";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));
vi.mock("@/lib/emails/order-confirmation", () => ({
  sendOrderConfirmationEmail: vi.fn(async () => true),
}));

const auth = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@/lib/auth/server-auth", () => ({
  getServerUserId: async () => auth.clerkId,
}));

import {
  EMPTY_CART,
  cartLineId,
  cartReducer,
  cartTotalCents,
  type CartItem,
  type CartState,
} from "@/lib/cart/cart-line";
import {
  buildCheckoutSubmission,
  buildCreateOrderRequest,
  buildQuoteRequest,
  type CheckoutSelection,
  type CheckoutSubmission,
} from "@/lib/cart/order-payload";
import { toStoredQuantity } from "@/lib/pricing/line";
import { sliceWeightGrams } from "@/lib/pricing/preparation";
import { resolveUnitPrice } from "@/lib/pricing/unit-price";
import { createOrder } from "@/lib/services/orders/create";
import { quoteOrder, type OrderCustomer } from "@/lib/services/orders/quote";
import { prisma, useCleanDatabase } from "./helpers/db";
import {
  createTestOffer,
  createTestProduct,
  createTestShop,
  createTestUser,
} from "./helpers/factories";

const { POST: postQuote } = await import("@/app/api/orders/quote/route");
const { POST: postOrder } = await import("@/app/api/orders/route");
const { POST: postGuestCheckout } = await import("@/app/api/checkout/guest/route");

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

// ── Catalogue ────────────────────────────────

async function catalogue() {
  const shop = await createTestShop();
  const [beef, veal, skewer, tray, lamb, chicken] = await Promise.all([
    createTestProduct(shop.id, {
      name: "Entrecôte",
      unit: "KG",
      priceCents: 1911,
      cutOptions: [{ name: "Haché", priceCents: 2200 }],
    }),
    createTestProduct(shop.id, { name: "Escalope de veau", unit: "TRANCHE", priceCents: 2490 }),
    createTestProduct(shop.id, { name: "Brochette", unit: "PIECE", priceCents: 350 }),
    createTestProduct(shop.id, {
      name: "Barquette de merguez",
      unit: "BARQUETTE",
      priceCents: 790,
    }),
    createTestProduct(shop.id, {
      name: "Gigot d'agneau",
      unit: "KG",
      priceCents: 2400,
      promoPct: 15,
      promoType: "PERCENTAGE",
      promoEnd: null,
    }),
    createTestProduct(shop.id, {
      name: "Cuisse de poulet",
      unit: "KG",
      priceCents: 1290,
      promoType: "FIXED_AMOUNT",
      promoFixedCents: 300,
      promoEnd: null,
    }),
  ]);
  const user = await createTestUser({ firstName: "Fatima" });
  const customer: OrderCustomer = {
    id: user.id,
    role: user.role,
    isGuest: user.isGuest,
    firstName: user.firstName,
    email: user.email,
  };
  return { shop, beef, veal, skewer, tray, lamb, chicken, customer };
}

type Catalogue = Awaited<ReturnType<typeof catalogue>>;

// ── Ajouts au panier, comme les écrans ───────

/** Prix public du produit au moment de l'ajout (ShopProductsClient, WeightSheet, TrancheSheet). */
function addedPrice(product: Product, cutOption?: string): number {
  const price = resolveUnitPrice(product, { isPro: false, cutOption, now: new Date() });
  if (!price.ok) throw new Error(`resolveUnitPrice a refusé ${product.name} : ${price.error}`);
  return price.unitPriceCents;
}

/** WeightSheet → handleWeightConfirm : une portion de `grams`, éventuellement une découpe. */
function weighed(product: Product, grams: number, cutOption?: string): CartItem {
  const line = { productId: product.id, unit: "KG" as const, weightGrams: grams, cutOption };
  return {
    ...line,
    id: cartLineId(line),
    name: product.name,
    imageUrl: "",
    priceCents: addedPrice(product, cutOption),
    quantity: 1,
  };
}

/** TrancheSheet → handleTrancheConfirm : poids estimé = tranches × poids d'une tranche fine (30 g). */
function sliced(product: Product, sliceCount: number): CartItem {
  expect(sliceWeightGrams(sliceCount, "fine")).toBe(sliceCount * 30);
  const line = {
    productId: product.id,
    unit: "TRANCHE" as const,
    weightGrams: sliceWeightGrams(sliceCount, "fine"),
    thickness: "fine",
    sliceCount,
  };
  return {
    ...line,
    id: cartLineId(line),
    name: product.name,
    imageUrl: "",
    priceCents: addedPrice(product),
    quantity: 1,
  };
}

/** WeightSheet en mode pièces → handleWeightConfirm : portion = pièces × poids d'une pièce. */
function pieces(product: Product, pieceCount: number, variant?: string): CartItem {
  if (product.weightPerPiece === null)
    throw new Error(`${product.name} ne se commande pas à la pièce`);
  const line = {
    productId: product.id,
    unit: "KG" as const,
    weightGrams: pieceCount * product.weightPerPiece,
    variant,
    pieceCount,
  };
  return {
    ...line,
    id: cartLineId(line),
    name: product.name,
    imageUrl: "",
    priceCents: addedPrice(product),
    quantity: 1,
    pieceLabel: product.pieceLabel ?? undefined,
  };
}

/** ShopProductsClient → addCounted : pièces ou barquettes. */
function counted(product: Product, quantity: number): CartItem {
  if (product.unit !== "PIECE" && product.unit !== "BARQUETTE")
    throw new Error(`${product.name} se vend au poids`);
  const line = { productId: product.id, unit: product.unit };
  return {
    ...line,
    id: cartLineId(line),
    name: product.name,
    imageUrl: "",
    priceCents: addedPrice(product),
    quantity,
  };
}

/** Les ajouts successifs, fusionnés par le réducteur du panier (deux ajouts identiques = quantité 2). */
function cartOf(shopId: string, additions: readonly CartItem[]): CartState {
  return additions.reduce(
    (state, item) =>
      cartReducer(state, {
        type: "ADD_ITEM",
        payload: { ...item, shopId, shopName: "Boucherie", shopSlug: "boucherie" },
      }),
    EMPTY_CART
  );
}

// ── Parcours complet ─────────────────────────

async function checkout(world: Catalogue, cart: CartState, promoCode: string | null = null) {
  const selection: CheckoutSelection = {
    shopId: world.shop.id,
    items: cart.items,
    promoCode,
    requestedTime: "asap",
    pickupSlot: null,
    customerNote: "",
  };

  const quoted = await quoteOrder(buildQuoteRequest(selection), world.customer, new Date());
  if (!quoted.ok)
    throw new Error(`quoteOrder a refusé le panier : ${quoted.code} ${quoted.message}`);
  const { quote } = quoted;

  const request = buildCreateOrderRequest(selection, {
    expectedTotalCents: quote.amountDueCents,
    idempotencyKey: randomUUID(),
  });
  const created = await createOrder(request, world.customer);
  if (!created.ok)
    throw new Error(`createOrder a refusé la commande : ${created.code} ${created.message}`);
  expect(created.status).toBe(201);

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: created.order.id },
    include: { items: true },
  });
  return { quote, order };
}

/** Une ligne comparable, quel que soit l'ordre de stockage des OrderItem. */
function sorted<T>(rows: T[]): T[] {
  return [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

async function expectContract(
  world: Catalogue,
  additions: readonly CartItem[],
  expected: { subtotalCents: number; discountCents?: number },
  promoCode: string | null = null
) {
  const cart = cartOf(world.shop.id, additions);
  const { quote, order } = await checkout(world, cart, promoCode);

  expect(quote.discountRejection).toBeNull();
  expect(cartTotalCents(cart.items)).toBe(quote.subtotalCents);
  expect(quote.subtotalCents).toBe(expected.subtotalCents);
  expect(quote.discount?.discountCents ?? 0).toBe(expected.discountCents ?? 0);
  expect(quote.serviceFeeCents).toBe(0);

  expect(order.totalCents).toBe(quote.totalCents);
  expect(order.totalCents).toBe(expected.subtotalCents - (expected.discountCents ?? 0));
  expect(order.serviceFeeCents).toBe(0);

  const storedLines = sorted(
    order.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      weightGrams: item.weightGrams,
      cutOption: item.cutOption,
      priceCents: item.priceCents,
      totalCents: item.totalCents,
    }))
  );
  const quotedLines = sorted(
    quote.lines.map((line) => ({
      productId: line.productId,
      quantity: toStoredQuantity(line),
      weightGrams: line.weightGrams,
      cutOption: line.cutOption,
      priceCents: line.unitPriceCents,
      totalCents: line.lineTotalCents,
    }))
  );
  expect(storedLines).toEqual(quotedLines);
}

// ── Cas ──────────────────────────────────────
// Prix d'une portion : floor((prix au kg × grammes + 500) / 1000).

describe("contrat panier → devis → commande", () => {
  it("500 g d'entrecôte à 19,11 €/kg = 9,56 €", async () => {
    const world = await catalogue();
    await expectContract(world, [weighed(world.beef, 500)], { subtotalCents: 956 });
  });

  it("250 g = 4,78 €", async () => {
    const world = await catalogue();
    await expectContract(world, [weighed(world.beef, 250)], { subtotalCents: 478 });
  });

  it("2 kg = 38,22 €", async () => {
    const world = await catalogue();
    await expectContract(world, [weighed(world.beef, 2000)], { subtotalCents: 3822 });
  });

  it("2 × 500 g (deux ajouts fusionnés) = 19,12 €", async () => {
    const world = await catalogue();
    const portion = weighed(world.beef, 500);
    await expectContract(world, [portion, portion], { subtotalCents: 1912 });
  });

  it("une ligne en tranches : 12 tranches fines (360 g) à 24,90 €/kg = 8,96 €", async () => {
    const world = await catalogue();
    await expectContract(world, [sliced(world.veal, 12)], { subtotalCents: 896 });
  });

  it("des pièces : 3 brochettes à 3,50 € = 10,50 €", async () => {
    const world = await catalogue();
    await expectContract(world, [counted(world.skewer, 3)], { subtotalCents: 1050 });
  });

  it("des barquettes : 2 × 7,90 € = 15,80 €", async () => {
    const world = await catalogue();
    await expectContract(world, [counted(world.tray, 2)], { subtotalCents: 1580 });
  });

  it("une promotion de 15 % sans date de fin : 750 g à 20,40 €/kg = 15,30 €", async () => {
    const world = await catalogue();
    await expectContract(world, [weighed(world.lamb, 750)], { subtotalCents: 1530 });
  });

  it("une promotion de 3 € sur le prix au kilo : 1,2 kg à 9,90 €/kg = 11,88 €", async () => {
    const world = await catalogue();
    await expectContract(world, [weighed(world.chicken, 1200)], { subtotalCents: 1188 });
  });

  it("une découpe : 500 g de haché à 22,00 €/kg = 11,00 €", async () => {
    const world = await catalogue();
    await expectContract(world, [weighed(world.beef, 500, "Haché")], { subtotalCents: 1100 });
  });

  it("un panier qui mélange tous les cas", async () => {
    const world = await catalogue();
    const portion = weighed(world.beef, 500);
    await expectContract(
      world,
      [
        portion,
        weighed(world.beef, 250),
        weighed(world.beef, 2000),
        portion,
        portion,
        sliced(world.veal, 12),
        counted(world.skewer, 3),
        counted(world.tray, 2),
        weighed(world.lamb, 750),
        weighed(world.chicken, 1200),
        weighed(world.beef, 500, "Haché"),
      ],
      { subtotalCents: 956 + 478 + 3822 + 1912 + 896 + 1050 + 1580 + 1530 + 1188 + 1100 }
    );
  });

  it("un panier avec un code de 10 % : 2 × 500 g + 3 brochettes = 29,62 €, remise 2,96 €", async () => {
    const world = await catalogue();
    await createTestOffer({ code: "DIX", type: "PERCENT", discountValue: 10 });
    const portion = weighed(world.beef, 500);
    await expectContract(
      world,
      [portion, portion, counted(world.skewer, 3)],
      { subtotalCents: 2962, discountCents: 296 },
      "DIX"
    );
  });
});

describe("contrat panier → commande : choix de préparation", () => {
  async function chopsWorld() {
    const world = await catalogue();
    const chops = await createTestProduct(world.shop.id, {
      name: "Côtelettes d'agneau",
      unit: "KG",
      priceCents: 2020,
      weightPerPiece: 80,
      pieceLabel: "côtelettes",
      variants: ["Bien épaisses"],
    });
    return { world, chops };
  }

  it("6 côtelettes bien épaisses (480 g) à 20,20 €/kg = 9,70 €, pièces et libellé du produit enregistrés", async () => {
    const { world, chops } = await chopsWorld();
    const cart = cartOf(world.shop.id, [pieces(chops, 6, "Bien épaisses")]);
    await expectContract(world, cart.items, { subtotalCents: 970 });

    const [item] = await prisma.orderItem.findMany({ where: { productId: chops.id } });
    expect(item).toMatchObject({
      pieceCount: 6,
      pieceLabel: "côtelettes",
      variant: "Bien épaisses",
      weightGrams: 480,
    });
  });

  it("refuse une ligne qui annonce 12 côtelettes pour 50 g payés : rien n'est créé", async () => {
    const { world, chops } = await chopsWorld();
    const honest = pieces(chops, 12);
    if (honest.unit !== "KG") throw new Error("ligne au poids attendue");
    const forged: CartItem = { ...honest, weightGrams: 50 };
    const selection: CheckoutSelection = {
      shopId: world.shop.id,
      items: [forged],
      promoCode: null,
      requestedTime: "asap",
      pickupSlot: null,
      customerNote: "",
    };

    const request = buildCreateOrderRequest(selection, {
      expectedTotalCents: 101,
      idempotencyKey: randomUUID(),
    });
    const created = await createOrder(request, world.customer);

    expect(created).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(await prisma.order.count()).toBe(0);
  });
});

// ── Soumission aux routes ────────────────────

const ROUTES = { "/api/orders": postOrder, "/api/checkout/guest": postGuestCheckout } as const;

async function submit(submission: CheckoutSubmission) {
  const response = await ROUTES[submission.endpoint](
    new NextRequest(`http://localhost${submission.endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submission.body),
    })
  );
  return { status: response.status, body: await response.json() };
}

function rawPost(path: string, body: string) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

async function confirmedRequest(world: Catalogue, customer: OrderCustomer | null) {
  const cart = cartOf(world.shop.id, [
    weighed(world.beef, 500),
    weighed(world.beef, 500),
    counted(world.skewer, 3),
  ]);
  const selection: CheckoutSelection = {
    shopId: world.shop.id,
    items: cart.items,
    promoCode: null,
    requestedTime: "asap",
    pickupSlot: null,
    customerNote: "",
  };
  const quoted = await quoteOrder(buildQuoteRequest(selection), customer, new Date());
  if (!quoted.ok)
    throw new Error(`quoteOrder a refusé le panier : ${quoted.code} ${quoted.message}`);
  const request = buildCreateOrderRequest(selection, {
    expectedTotalCents: quoted.quote.amountDueCents,
    idempotencyKey: randomUUID(),
  });
  return { quote: quoted.quote, request };
}

describe("contrat panier → routes de commande", () => {
  it("invité : POST /api/checkout/guest crée la commande au total du devis, puis la rejoue", async () => {
    const world = await catalogue();
    auth.clerkId = null;
    const { quote, request } = await confirmedRequest(world, null);
    expect(quote.subtotalCents).toBe(1912 + 1050);
    const submission = buildCheckoutSubmission(request, {
      email: "  nora.invitee@itest.klikandgo.test ",
      firstName: " Nora ",
      lastName: "Benali",
      phone: "",
    });
    expect(submission.endpoint).toBe("/api/checkout/guest");

    const first = await submit(submission);
    expect(first.status).toBe(201);
    expect(typeof first.body.data.guestToken).toBe("string");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: first.body.data.order.id } });
    expect(order.totalCents).toBe(quote.totalCents);
    const guest = await prisma.user.findUniqueOrThrow({
      where: { email: "nora.invitee@itest.klikandgo.test" },
    });
    expect(guest).toMatchObject({ isGuest: true, clerkId: null, firstName: "Nora", phone: null });
    expect(guest.guestToken).toBe(first.body.data.guestToken);
    expect(order.userId).toBe(guest.id);

    const replay = await submit(submission);
    expect(replay.status).toBe(200);
    expect(replay.body.data.order.id).toBe(order.id);
    expect(await prisma.order.count()).toBe(1);
  });

  it("client connecté : POST /api/orders crée la commande au total du devis", async () => {
    const world = await catalogue();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: world.customer.id } });
    auth.clerkId = user.clerkId;
    const { quote, request } = await confirmedRequest(world, world.customer);
    const submission = buildCheckoutSubmission(request, null);
    expect(submission.endpoint).toBe("/api/orders");

    const created = await submit(submission);
    expect(created.status).toBe(201);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: created.body.data.id } });
    expect(order).toMatchObject({ userId: world.customer.id, totalCents: quote.totalCents });
  });
});

describe("contrat panier → routes de commande : premières commandes simultanées d'un invité", () => {
  it("trois envois parallèles du même nouvel invité avec la même clé : un 201, deux 200, une commande", async () => {
    const world = await catalogue();
    auth.clerkId = null;
    const { request } = await confirmedRequest(world, null);
    const submission = buildCheckoutSubmission(request, {
      email: "samir.simultane@itest.klikandgo.test",
      firstName: "Samir",
      lastName: "Haddad",
      phone: "",
    });

    const answers = await Promise.all([submit(submission), submit(submission), submit(submission)]);

    expect(answers.map((answer) => answer.status).sort()).toEqual([200, 200, 201]);
    const orderIds = new Set(answers.map((answer) => answer.body.data.order.id));
    expect(orderIds.size).toBe(1);
    const guest = await prisma.user.findUniqueOrThrow({
      where: { email: "samir.simultane@itest.klikandgo.test" },
    });
    expect(new Set(answers.map((answer) => answer.body.data.guestToken))).toEqual(
      new Set([guest.guestToken])
    );
    expect(
      await prisma.user.count({ where: { email: "samir.simultane@itest.klikandgo.test" } })
    ).toBe(1);
    expect(await prisma.order.count()).toBe(1);
  });
});

describe("routes de devis et de commande : corps qui n'est pas du JSON", () => {
  it.each([
    ["/api/orders/quote", postQuote, null],
    ["/api/checkout/guest", postGuestCheckout, null],
    ["/api/orders", postOrder, "client"],
  ] as const)(
    "%s répond 400 VALIDATION_ERROR sans erreur serveur",
    async (path, handler, caller) => {
      if (caller === "client") {
        const user = await createTestUser();
        auth.clerkId = user.clerkId;
      } else {
        auth.clerkId = null;
      }
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      try {
        for (const body of ["{bad", ""]) {
          const response = await handler(rawPost(path, body));
          expect(response.status).toBe(400);
          expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
        }
        expect(consoleError).not.toHaveBeenCalled();
      } finally {
        consoleError.mockRestore();
      }
      expect(await prisma.order.count()).toBe(0);
    }
  );
});
