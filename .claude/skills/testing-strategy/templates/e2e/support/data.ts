// Destination : tests/e2e/support/data.ts
// Préparation des données d'un parcours. Trois règles :
//  1. passer par l'API quand elle existe (elle exerce le code de production) ;
//  2. tout ce qui est unique en base ou sert à retrouver un élément à l'écran porte un suffixe
//     aléatoire : la base n'est pas vidée entre deux parcours ;
//  3. un montant n'est jamais calculé par le test : il vient du devis du serveur (POST /api/orders/quote).
import { randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import type { Prisma, Product, Shop } from "@prisma/client";
import { assertDisposableDatabase, prisma } from "./db";

export const uid = (): string => randomUUID().replace(/-/g, "").slice(0, 6);

/**
 * La boutique sur laquelle agit le rôle BOUCHER (et ADMIN) du mode test : la plus ancienne en base,
 * même règle que getAuthenticatedBoucher(). Avec le seed : « El Fathe » (slug el-fathe).
 */
export async function kitchenShop(): Promise<Shop> {
  assertDisposableDatabase();
  return prisma.shop.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
}

/**
 * À appeler une fois (projet `setup`) : la boutique du mode cuisine accepte les commandes quelle que
 * soit l'heure du lancement. Le seed la plafonne à 25 commandes par heure : au-delà, CAPACITY_EXCEEDED
 * sans rapport avec le sujet du test.
 */
export async function prepareKitchenShop(): Promise<Shop> {
  const shop = await kitchenShop();
  return prisma.shop.update({
    where: { id: shop.id },
    data: { status: "OPEN", paused: false, vacationMode: false, maxOrdersPerHour: 10_000, maxOrdersPerSlot: 10_000 },
  });
}

/** Un produit au prix connu, en stock, au nom unique. Le seed tire ses prix et ses ruptures au hasard. */
export async function makeProduct(
  shopId: string,
  overrides: Partial<Prisma.ProductUncheckedCreateInput> = {},
): Promise<Product> {
  assertDisposableDatabase();
  return prisma.product.create({
    data: { shopId, name: `Merguez e2e ${uid()}`, unit: "PIECE", priceCents: 1000, inStock: true, ...overrides },
  });
}

type Line = { productId: string; quantity: number; weightGrams?: number };

/** Total à payer selon le serveur, comme le panier l'affiche avant confirmation. */
export async function quoteAmount(request: APIRequestContext, shopId: string, items: Line[]): Promise<number> {
  const response = await request.post("/api/orders/quote", { data: { shopId, items, paymentMethod: "ON_PICKUP" } });
  if (response.status() !== 200) throw new Error(`Devis refusé (${response.status()}) : ${await response.text()}`);
  return ((await response.json()) as { data: { amountDueCents: number } }).data.amountDueCents;
}

export type GuestOrder = {
  orderId: string;
  guestToken: string;
  /** Nom affiché sur la carte cuisine et le ticket (format Prénom.N) : unique, sert à retrouver LA commande. */
  customer: string;
  /** Adresse de suivi de l'invité. */
  trackingPath: string;
};

/**
 * Passe une commande invité par devis puis POST /api/checkout/guest (les routes du parcours réel).
 * `request` doit porter une session de mode test (page.request d'un contexte ouvert avec AUTH.*) :
 * le middleware court-circuite alors Clerk, dont les clés sont factices en CI.
 */
export async function placeGuestOrder(
  request: APIRequestContext,
  input: { shopId: string; items: Line[]; customerNote?: string },
): Promise<GuestOrder> {
  const id = uid();
  const firstName = `Zoe${id}`;
  const expectedTotalCents = await quoteAmount(request, input.shopId, input.items);
  const response = await request.post("/api/checkout/guest", {
    data: {
      ...input,
      paymentMethod: "ON_PICKUP",
      idempotencyKey: randomUUID(),
      expectedTotalCents,
      requestedTime: "asap",
      email: `e2e-${id}@test.klikgo`,
      firstName,
      lastName: "Test",
    },
  });
  if (response.status() !== 201) {
    throw new Error(`Commande invité refusée (${response.status()}) : ${await response.text()}`);
  }
  const body = (await response.json()) as { data: { order: { id: string }; guestToken: string } };
  return {
    orderId: body.data.order.id,
    guestToken: body.data.guestToken,
    customer: `${firstName}.T`,
    trackingPath: `/suivi/${body.data.order.id}?guestToken=${encodeURIComponent(body.data.guestToken)}`,
  };
}
