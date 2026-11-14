// Données et appels partagés par les tests des commandes de commande (boucher, client, système).
// Les transports sortants et l'authentification sont simulés dans chaque fichier de test (vi.mock
// est propre au fichier) ; tout le reste passe par PostgreSQL.
import { NextRequest } from "next/server";
import type { Order, OrderItem, Product, Shop, User } from "@prisma/client";
import { prisma } from "../helpers/db";
import {
  createTestOrder,
  createTestProduct,
  createTestShop,
  createTestUser,
} from "../helpers/factories";

export const MINUTE_MS = 60_000;

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
