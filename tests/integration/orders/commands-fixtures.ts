// Données et appels partagés par les tests des commandes de commande (boucher, client, système).
// Les transports sortants et l'authentification sont simulés dans chaque fichier de test (vi.mock
// est propre au fichier) ; tout le reste passe par PostgreSQL.
import { NextRequest } from "next/server";
import type { Order, OrderItem, Product, Shop, User } from "@prisma/client";
import { WEIGH_TOLERANCE_TERMS } from "@/lib/pricing/tolerance";
import { adjustOrderPrice } from "@/lib/services/orders/adjust-price";
import { prisma } from "../helpers/db";
import {
  createTestOrder,
  createTestProduct,
  createTestShop,
  createTestUser,
} from "../helpers/factories";

export const MINUTE_MS = 60_000;
/** The customer's window to answer a price adjustment. */
export const ANSWER_WINDOW_MS = 5 * MINUTE_MS;

export interface World {
  owner: User;
  shop: Shop;
  customer: User;
  product: Product;
}

/** A shop whose ownerId is the owner's Clerk id (as in production), a customer, a KG product. */
export async function createWorld(): Promise<World> {
  const owner = await createTestUser({ role: "BOUCHER" });
  const shop = await createTestShop({
    ownerId: owner.clerkId as string,
    name: "Boucherie des Tests",
  });
  const customer = await createTestUser({ firstName: "fatima", lastName: "amrani" });
  const product = await createTestProduct(shop.id);
  return { owner, shop, customer, product };
}

/** One KG line of three 500 g portions at 1911 c/kg: 3 x 956 = 2868 cents. */
export const THREE_PORTIONS = {
  quantity: 1.5,
  weightGrams: 500,
  priceCents: 1911,
  totalCents: 2868,
};

export async function createOrder(
  world: World,
  options: {
    status?: Order["status"];
    items?: Parameters<typeof createTestOrder>[0]["items"];
    overrides?: Parameters<typeof createTestOrder>[0]["overrides"];
    totalCents?: number;
  } = {}
): Promise<Order & { items: OrderItem[] }> {
  return createTestOrder({
    shopId: world.shop.id,
    userId: world.customer.id,
    status: options.status,
    totalCents: options.totalCents,
    items: options.items ?? [{ productId: world.product.id }],
    overrides: options.overrides,
  });
}

/** The butcher of the world's shop, as adjustOrderPrice receives him from the route. */
export function butcherOf(world: World): { shopId: string; actorId: string } {
  return { shopId: world.shop.id, actorId: world.owner.id };
}

/** A KG product at 1000 c/kg: one gram costs exactly one cent, whatever the weight. */
export async function createGramProduct(world: World): Promise<Product> {
  return createTestProduct(world.shop.id, { priceCents: 1000, name: "Viande au gramme" });
}

/**
 * An ACCEPTED order of KG lines of `gramProduct` (one portion of the given grams each), as checkout
 * writes it: each line's estimate is its total, the order's estimated total is their sum, and the
 * terms of the customer's tolerance are frozen on it; `terms` null is an order created before the
 * weighing tolerance existed.
 */
export async function createWeighedOrder(
  world: World,
  gramProduct: Product,
  grams: readonly number[],
  terms: { rateBps: number; capCents: number } | null
): Promise<Order & { items: OrderItem[] }> {
  const total = grams.reduce((sum, weight) => sum + weight, 0);
  return createOrder(world, {
    status: "ACCEPTED",
    items: grams.map((weight) => ({
      productId: gramProduct.id,
      quantity: weight / 1000,
      weightGrams: weight,
      priceCents: 1000,
      totalCents: weight,
      estimatedPriceCents: weight,
    })),
    overrides:
      terms === null
        ? undefined
        : {
            weighToleranceRateBps: terms.rateBps,
            weighToleranceCapCents: terms.capCents,
            estimatedTotalCents: total,
          },
  });
}

/** The butcher weighs lines again, `weights` in grams by line id. */
export function weighGrams(
  orderId: string,
  shop: { shopId: string; actorId: string },
  weights: Record<string, number>,
  now = new Date()
) {
  return adjustOrderPrice(
    orderId,
    shop,
    {
      adjustmentType: "WEIGHT",
      items: Object.entries(weights).map(([orderItemId, grams]) => ({
        orderItemId,
        newQuantity: grams / 1000,
      })),
    },
    now
  );
}

export async function adjustmentOf(orderId: string) {
  return prisma.priceAdjustment.findUniqueOrThrow({ where: { orderId } });
}

/** A 20,00 € order, STANDARD tolerance (1,00 €), weighed at 22,00 € at `now`: it waits. */
export async function pendingWeighingIncrease(now: Date) {
  const world = await createWorld();
  const product = await createGramProduct(world);
  const order = await createWeighedOrder(world, product, [2000], WEIGH_TOLERANCE_TERMS.STANDARD);
  const created = await weighGrams(order.id, butcherOf(world), { [order.items[0].id]: 2200 }, now);
  if (!created.ok || created.data.applied) throw new Error("ajustement en attente attendu");
  return { world, order };
}

/** The customer's answer, as acceptAdjustment and rejectAdjustment take it. */
export function customerAnswer(orderId: string, userId: string, now: Date) {
  return { orderId, userId, now };
}

export function jsonRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export interface ApiBody {
  success: boolean;
  data?: Record<string, unknown> & { _idempotent?: boolean };
  error?: { code: string; message: string; details?: Record<string, string[]> };
}

export async function readResponse(response: Response): Promise<{ status: number; body: ApiBody }> {
  return { status: response.status, body: (await response.json()) as ApiBody };
}

export async function eventsOf(orderId: string, type?: string) {
  return prisma.orderEvent.findMany({
    where: { orderId, ...(type && { type }) },
    orderBy: { createdAt: "asc" },
  });
}

export async function notificationsOf(userId: string, type?: string) {
  return prisma.notification.findMany({
    where: { userId, ...(type && { type }) },
    orderBy: { createdAt: "asc" },
  });
}

export async function reload(orderId: string) {
  return prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
}
