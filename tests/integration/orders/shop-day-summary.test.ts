// @vitest-environment node
// Accueil du tableau de bord boucher : les chiffres du jour sont calculés par la base pour la
// boutique, sur toute la journée de Paris, et non sur les 50 dernières commandes de GET /api/orders.
import type { OrderStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCleanDatabase } from "../helpers/db";
import { createTestOrder, createTestShop, createTestUser } from "../helpers/factories";

const boucherAuth = vi.hoisted(() => ({ getAuthenticatedBoucher: vi.fn() }));
vi.mock("@/lib/boucher-auth", () => boucherAuth);

import { getShopDaySummary, RECENT_ORDERS_LIMIT } from "@/lib/services/orders/shop-summary";
import { GET as getSummaryRoute } from "@/app/api/boucher/orders/summary/route";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const MINUTE_MS = 60_000;
// 14 novembre 2026, 11 h à Paris (UTC+1) : la journée de Paris commence le 13 à 23 h UTC.
const NOW = new Date("2026-11-14T10:00:00.000Z");

function minutesBefore(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * MINUTE_MS);
}

async function orderAt(
  shopId: string,
  userId: string,
  status: OrderStatus,
  createdAt: Date,
  totalCents = 1000
) {
  return createTestOrder({
    shopId,
    userId,
    status,
    totalCents,
    overrides: { createdAt, updatedAt: createdAt },
  });
}

beforeEach(() => {
  boucherAuth.getAuthenticatedBoucher.mockReset();
});

describe("getShopDaySummary", () => {
  it("compte toutes les commandes du jour au-delà de 50 et le CA des commandes retirées", async () => {
    const shop = await createTestShop();
    const client = await createTestUser();
    const statuses: OrderStatus[] = ["PICKED_UP", "COMPLETED", "PENDING", "CANCELLED", "READY"];
    for (let i = 0; i < 55; i++) {
      await orderAt(shop.id, client.id, statuses[i % statuses.length], minutesBefore(i + 1));
    }

    const summary = await getShopDaySummary(shop.id, NOW);

    expect(summary.ordersToday).toBe(55);
    // 11 retirées + 11 terminées, à 10 € chacune.
    expect(summary.revenueTodayCents).toBe(22 * 1000);
  });

  it("prend la journée de Paris, pas la journée UTC, et ignore les autres boutiques", async () => {
    const shop = await createTestShop();
    const other = await createTestShop();
    const client = await createTestUser();
    // Le 13 à 23 h 30 UTC = le 14 à 0 h 30 à Paris : aujourd'hui.
    await orderAt(shop.id, client.id, "PICKED_UP", new Date("2026-11-13T23:30:00.000Z"), 1500);
    // Le 13 à 22 h 59 UTC = le 13 à 23 h 59 à Paris : hier.
    await orderAt(shop.id, client.id, "PICKED_UP", new Date("2026-11-13T22:59:00.000Z"), 700);
    await orderAt(other.id, client.id, "PICKED_UP", minutesBefore(5), 9900);

    const summary = await getShopDaySummary(shop.id, NOW);

    expect(summary).toMatchObject({ ordersToday: 1, revenueTodayCents: 1500 });
    expect(summary.recent).toHaveLength(2);
  });

  it("les commandes récentes : les 5 plus récentes, nombre d'articles et prénom / nom seulement", async () => {
    const shop = await createTestShop();
    const client = await createTestUser({ firstName: "Karim", lastName: "Haddad" });
    const ids: string[] = [];
    for (let i = 0; i < 7; i++) {
      ids.push((await orderAt(shop.id, client.id, "PENDING", minutesBefore(i + 1))).id);
    }

    const { recent } = await getShopDaySummary(shop.id, NOW);

    expect(recent.map((order) => order.id)).toEqual(ids.slice(0, RECENT_ORDERS_LIMIT));
    expect(recent[0]).toMatchObject({ itemCount: 0, status: "PENDING", totalCents: 1000 });
    expect(recent[0].user).toEqual({ firstName: "Karim", lastName: "Haddad" });
  });
});

describe("GET /api/boucher/orders/summary", () => {
  it("renvoie le résumé de la boutique du boucher, jamais en cache partagé", async () => {
    const shop = await createTestShop();
    const client = await createTestUser();
    await orderAt(shop.id, client.id, "PENDING", new Date());
    boucherAuth.getAuthenticatedBoucher.mockResolvedValue({
      userId: "user_boucher",
      shopId: shop.id,
    });

    const response = await getSummaryRoute();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const json = (await response.json()) as { data: { ordersToday: number; recent: unknown[] } };
    expect(json.data.recent).toHaveLength(1);
  });

  it("transmet le refus d'authentification", async () => {
    boucherAuth.getAuthenticatedBoucher.mockResolvedValue({
      error: Response.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "refusé" } },
        { status: 401 }
      ),
    });

    const response = await getSummaryRoute();

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
