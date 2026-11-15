// @vitest-environment node
// DELETE /api/users/me sur PostgreSQL réel : un client qui a une commande encore ouverte, y compris
// PARTIALLY_DENIED (rupture partielle en attente de sa réponse), ne peut pas supprimer son compte ;
// un client dont toutes les commandes sont terminées est anonymisé.
//
// Simulés : l'identité de l'appelant et le limiteur de débit (il appelle Redis).
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderStatus, User } from "@prisma/client";

const auth = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@/lib/auth/server-auth", () => ({
  getServerUserId: async () => auth.clerkId,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimits: { api: "api" },
  checkRateLimit: async () => ({ success: true }),
}));

import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestOrder, createTestShop, createTestUser } from "../helpers/factories";

const { DELETE: deleteMe } = await import("@/app/api/users/me/route");

// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React, seul le préfixe « use » compte
useCleanDatabase();

const OPEN_ORDERS_MESSAGE =
  "Impossible de supprimer votre compte tant que vous avez des commandes en cours";

beforeEach(() => {
  auth.clerkId = null;
});

async function customerWithOrder(status: OrderStatus): Promise<User> {
  const customer = await createTestUser();
  const shop = await createTestShop();
  await createTestOrder({ shopId: shop.id, userId: customer.id, status });
  auth.clerkId = customer.clerkId;
  return customer;
}

async function expectUntouched(before: User): Promise<void> {
  const after = await prisma.user.findUniqueOrThrow({ where: { id: before.id } });
  expect(after.deletedAt).toBeNull();
  expect(after.email).toBe(before.email);
  expect(after.clerkId).toBe(before.clerkId);
  expect(after.firstName).toBe(before.firstName);
  expect(after.lastName).toBe(before.lastName);
}

describe("DELETE /api/users/me — commandes ouvertes", () => {
  it.each<OrderStatus>(["PENDING", "ACCEPTED", "PREPARING", "READY", "PARTIALLY_DENIED"])(
    "refuse avec 400 VALIDATION_ERROR quand une commande %s est ouverte, sans toucher au compte",
    async (status) => {
      const customer = await customerWithOrder(status);

      const res = await deleteMe();

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        success: false,
        error: { code: "VALIDATION_ERROR", message: OPEN_ORDERS_MESSAGE },
      });
      await expectUntouched(customer);
    }
  );

  it("ne compte pas la commande ouverte d'un autre client", async () => {
    const other = await createTestUser();
    const shop = await createTestShop();
    await createTestOrder({ shopId: shop.id, userId: other.id, status: "PARTIALLY_DENIED" });
    const customer = await createTestUser();
    auth.clerkId = customer.clerkId;

    const res = await deleteMe();

    expect(res.status).toBe(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(after.deletedAt).toBeInstanceOf(Date);
    await expectUntouched(other);
  });
});

describe("DELETE /api/users/me — commandes terminées", () => {
  it.each<OrderStatus>(["COMPLETED", "PICKED_UP", "DENIED", "CANCELLED", "AUTO_CANCELLED"])(
    "anonymise le compte dont la seule commande est %s",
    async (status) => {
      const customer = await customerWithOrder(status);

      const res = await deleteMe();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true, data: { deleted: true } });
      const after = await prisma.user.findUniqueOrThrow({ where: { id: customer.id } });
      expect(after.deletedAt).toBeInstanceOf(Date);
      expect(after.email).not.toBe(customer.email);
      expect(after.email).toMatch(/^deleted_deleted_\d+@klikandgo\.app$/);
      expect(after.clerkId).toMatch(/^deleted_deleted_\d+$/);
      expect(after.firstName).toBe("Compte");
      expect(after.lastName).toBe("Supprime");
    }
  );

  it("répond 401 sans session et n'écrit rien", async () => {
    const customer = await createTestUser();

    const res = await deleteMe();

    expect(res.status).toBe(401);
    await expectUntouched(customer);
  });
});
