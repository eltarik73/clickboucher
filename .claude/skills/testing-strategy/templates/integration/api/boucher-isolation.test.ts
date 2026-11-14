// @vitest-environment node
// Destination : tests/integration/api/boucher-isolation.test.ts (exige setup/clerk-mock.ts).
// Isolation entre boutiques prouvée avec les VRAIS helpers d'identité : seule la session Clerk est
// simulée. Exécuté le 2026-11-14 sur l'arbre du chantier 0 : 6 verts [L20].
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));
vi.mock("@/lib/emails/order-confirmation", () => ({ sendOrderConfirmationEmail: vi.fn(async () => true) }));

import { PATCH as actionRoute } from "@/app/api/boucher/orders/[orderId]/action/route";
import { POST as createRoute } from "@/app/api/orders/route";
import { POST as quoteRoute } from "@/app/api/orders/quote/route";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestOrder, createTestProduct, createTestShop, createTestUser } from "../helpers/factories";
import { apiRequest } from "../helpers/http";
import { signInAs } from "../helpers/session";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const act = (orderId: string, body: unknown) =>
  actionRoute(apiRequest("PATCH", `/api/boucher/orders/${orderId}/action`, body), { params: { orderId } });

/** Une boutique dont ownerId porte l'id Prisma ou le clerkId du boucher (les deux existent en base). */
async function pendingOrder(ownerIdKind: "prisma" | "clerk" = "prisma") {
  const owner = await createTestUser({ role: "BOUCHER" });
  const shop = await createTestShop({ ownerId: ownerIdKind === "prisma" ? owner.id : (owner.clerkId as string) });
  const customer = await createTestUser();
  const product = await createTestProduct(shop.id, { unit: "PIECE", priceCents: 1000 });
  const order = await createTestOrder({ shopId: shop.id, userId: customer.id, items: [{ productId: product.id }] });
  return { owner, shop, customer, order };
}

const statusOf = async (orderId: string) => (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status;

describe("PATCH /api/boucher/orders/[orderId]/action — qui peut agir", () => {
  it.each(["prisma", "clerk"] as const)("le propriétaire (ownerId = id %s) accepte", async (kind) => {
    const { owner, order } = await pendingOrder(kind);
    signInAs(owner);

    expect((await act(order.id, { action: "accept", estimatedMinutes: 20 })).status).toBe(200);
    expect(await statusOf(order.id)).toBe("ACCEPTED");
  });

  it("sans session : 401, rien n'est écrit", async () => {
    const { order } = await pendingOrder();

    expect((await act(order.id, { action: "accept", estimatedMinutes: 20 })).status).toBe(401);
    expect(await statusOf(order.id)).toBe("PENDING");
  });

  it("le boucher d'une autre boutique : 404, ni statut ni journal", async () => {
    const { order } = await pendingOrder();
    const intruder = await createTestUser({ role: "BOUCHER" });
    await createTestShop({ ownerId: intruder.id });
    signInAs(intruder);

    expect((await act(order.id, { action: "deny", reason: "Tentative inter-boutiques" })).status).toBe(404);
    expect(await statusOf(order.id)).toBe("PENDING");
    expect(await prisma.orderEvent.count({ where: { orderId: order.id } })).toBe(0);
  });

  it("un client connecté n'est pas un boucher : 403", async () => {
    const { customer, order } = await pendingOrder();
    signInAs(customer);

    expect((await act(order.id, { action: "accept", estimatedMinutes: 20 })).status).toBe(403);
  });
});

describe("POST /api/orders/quote puis /api/orders — client connecté", () => {
  it("le total enregistré est celui du devis serveur", async () => {
    const shop = await createTestShop();
    const client = await createTestUser();
    const product = await createTestProduct(shop.id, { priceCents: 1290, unit: "PIECE" });
    signInAs(client);
    const request = { shopId: shop.id, items: [{ productId: product.id, quantity: 2 }], paymentMethod: "ON_PICKUP" };

    const quote = (await (await quoteRoute(apiRequest("POST", "/api/orders/quote", request))).json()).data;
    const created = await createRoute(
      apiRequest("POST", "/api/orders", { ...request, idempotencyKey: randomUUID(), expectedTotalCents: quote.amountDueCents }),
    );

    expect(created.status).toBe(201);
    expect(await prisma.order.findFirstOrThrow({ where: { shopId: shop.id } })).toMatchObject({
      totalCents: 2580,
      status: "PENDING",
    });
  });
});
