// @vitest-environment node
// Les écritures du boucher sur sa boutique : une boutique suspendue appartient à l'administration
// jusqu'à sa réactivation. La condition est dans l'UPDATE lui-même, donc une suspension posée
// pendant la requête du boucher l'emporte sur son écriture. PostgreSQL réel, rien de simulé.
import { describe, expect, expectTypeOf, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { suspendShop } from "@/lib/services/shops/moderation";
import { writeOwnerShop } from "@/lib/services/shops/owner-write";
import { readShopService, updateShopService } from "@/lib/services/shops/service-settings";
import { endBusyMode, pauseShop, resumeShop, setBusyMode } from "@/lib/shop-status";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestShop } from "../helpers/factories";

// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React
useCleanDatabase();

type ShopState = Partial<Prisma.ShopUncheckedCreateInput>;

const AT = new Date("2026-11-15T08:00:00Z");
const LATER = new Date("2026-11-15T12:00:00Z");
const OPEN: ShopState = { status: "OPEN" };
const PAUSED: ShopState = { status: "PAUSED", paused: true, pausedAt: AT, pauseReason: "Rush" };
const BUSY: ShopState = { status: "BUSY", busyMode: true, busyExtraMin: 15, busyModeEndsAt: LATER };
const MISSING_SHOP = "boutique-inconnue";

const shopRow = (id: string) => prisma.shop.findUniqueOrThrow({ where: { id } });
const logs = (shopId: string) =>
  prisma.shopLog.findMany({
    where: { shopId },
    select: { action: true, triggeredBy: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

async function suspendedShop(state: ShopState = OPEN) {
  const shop = await createTestShop(state);
  expect(await suspendShop(shop.id, "Contrôle")).toEqual({ ok: true });
  return shop;
}

describe("writeOwnerShop", () => {
  it("écrit sur une boutique non suspendue", async () => {
    const shop = await createTestShop({ prepTimeMin: 15 });

    expect(await writeOwnerShop(prisma, shop.id, { prepTimeMin: 25 })).toEqual({ ok: true });

    expect((await shopRow(shop.id)).prepTimeMin).toBe(25);
  });

  it("n'écrit rien sur une boutique suspendue : SUSPENDED", async () => {
    const shop = await suspendedShop();
    const before = await shopRow(shop.id);

    expect(await writeOwnerShop(prisma, shop.id, { status: "OPEN" })).toEqual({
      ok: false,
      reason: "SUSPENDED",
    });

    expect(await shopRow(shop.id)).toEqual(before);
  });

  it("boutique inconnue : NOT_FOUND", async () => {
    expect(await writeOwnerShop(prisma, MISSING_SHOP, { prepTimeMin: 25 })).toEqual({
      ok: false,
      reason: "NOT_FOUND",
    });
  });

  it("son type n'accepte aucune colonne de publication", () => {
    type OwnerData = Parameters<typeof writeOwnerShop>[2];
    expectTypeOf<{ visible: true }>().not.toExtend<OwnerData>();
    expectTypeOf<{ suspendedAt: null }>().not.toExtend<OwnerData>();
    expectTypeOf<{ prepTimeMin: 25 }>().toExtend<OwnerData>();
  });
});

describe("le boucher agit sur une boutique suspendue pendant sa requête", () => {
  it.each<[string, ShopState, (shopId: string) => Promise<unknown>]>([
    ["pauseShop", OPEN, (id) => pauseShop(id, { triggeredBy: "boucher" })],
    ["resumeShop", PAUSED, (id) => resumeShop(id, "boucher")],
    ["setBusyMode", OPEN, (id) => setBusyMode(id, { extraMin: 10, durationMin: 30 })],
    ["endBusyMode", BUSY, (id) => endBusyMode(id)],
  ])(
    "%s : refusé, la boutique reste comme l'administration l'a laissée",
    async (_label, state, change) => {
      const shop = await suspendedShop(state);
      const suspended = await shopRow(shop.id);

      expect(await change(shop.id)).toEqual({ ok: false, reason: "SUSPENDED" });

      expect(suspended).toMatchObject({ status: "CLOSED", paused: false, busyMode: false });
      expect(await shopRow(shop.id)).toEqual(suspended);
      expect(await logs(shop.id)).toEqual([{ action: "SUSPENDED", triggeredBy: "admin" }]);
    }
  );

  it("hors suspension, la pause s'écrit avec sa ligne de journal", async () => {
    const shop = await createTestShop(OPEN);

    expect(await pauseShop(shop.id, { reason: "Rush", triggeredBy: "boucher" })).toEqual({
      ok: true,
    });

    expect(await shopRow(shop.id)).toMatchObject({
      status: "PAUSED",
      paused: true,
      pauseReason: "Rush",
    });
    expect(await logs(shop.id)).toEqual([{ action: "PAUSED", triggeredBy: "boucher" }]);
  });
});

describe("updateShopService", () => {
  it("écrit les réglages et les relit, avec le temps de préparation effectif", async () => {
    const shop = await createTestShop({
      busyMode: true,
      busyExtraMin: 15,
      priceAdjustmentThreshold: 20,
    });

    const result = await updateShopService(shop.id, { prepTimeMin: 25, maxOrdersPerHour: 30 });

    expect(result).toEqual({
      ok: true,
      service: {
        id: shop.id,
        busyMode: true,
        busyExtraMin: 15,
        paused: false,
        status: "OPEN",
        prepTimeMin: 25,
        autoAccept: false,
        maxOrdersPerHour: 30,
        priceAdjustmentThreshold: 20,
        effectivePrepTime: 40,
      },
    });
  });

  it("rend les mêmes réglages que leur lecture (GET /api/boucher/service)", async () => {
    const shop = await createTestShop({ priceAdjustmentThreshold: 20 });
    const body = {
      status: "PAUSED" as const,
      prepTimeMin: 25,
      autoAccept: true,
      maxOrdersPerHour: 30,
    };

    const result = await updateShopService(shop.id, body);

    expect(result).toEqual({ ok: true, service: await readShopService(shop.id) });
    expect(result).toMatchObject({ service: { ...body, effectivePrepTime: 25 } });
  });

  it("refuse une boutique suspendue sans rien écrire", async () => {
    const shop = await suspendedShop();
    const before = await shopRow(shop.id);

    expect(await updateShopService(shop.id, { status: "OPEN", prepTimeMin: 25 })).toEqual({
      ok: false,
      reason: "SUSPENDED",
    });

    expect(await shopRow(shop.id)).toEqual(before);
  });
});
