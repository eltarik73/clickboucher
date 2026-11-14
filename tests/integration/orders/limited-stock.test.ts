// @vitest-environment node
// Anti-gaspi and flash-sale stock reserved and released in the caller's transaction, on real
// PostgreSQL.
import type { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  LimitedStockError,
  releaseLimitedStock,
  reserveLimitedStock,
  stockLinesFromItems,
  type StockLine,
} from "@/lib/services/orders/limited-stock";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestProduct, createTestShop } from "../helpers/factories";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const ANTI_GASPI_END = new Date("2026-11-14T18:00:00Z");
const FLASH_END = new Date("2026-11-13T20:00:00Z");

async function antiGaspiProduct(
  shopId: string,
  stock: number,
  overrides: Partial<Prisma.ProductUncheckedCreateInput> = {}
) {
  return createTestProduct(shopId, {
    priceCents: 990,
    isAntiGaspi: true,
    antiGaspiStock: stock,
    antiGaspiOrigPriceCents: 1490,
    antiGaspiEndAt: ANTI_GASPI_END,
    antiGaspiReason: "DLC proche",
    ...overrides,
  });
}

async function flashProduct(shopId: string, stock: number) {
  return createTestProduct(shopId, {
    isFlashSale: true,
    flashSaleStock: stock,
    flashSaleEndAt: FLASH_END,
  });
}

function product(id: string) {
  return prisma.product.findUniqueOrThrow({ where: { id } });
}

function reserve(shopId: string, lines: StockLine[]) {
  return prisma.$transaction((tx) => reserveLimitedStock(tx, shopId, lines));
}

function release(shopId: string, lines: StockLine[]) {
  return prisma.$transaction((tx) => releaseLimitedStock(tx, shopId, lines));
}

describe("stockLinesFromItems", () => {
  it("keeps available lines only and sums sale units per product", () => {
    expect(
      stockLinesFromItems([
        { productId: "p1", unit: "KG", quantity: 1.5, weightGrams: 500, available: true },
        { productId: "p2", unit: "PIECE", quantity: 2, weightGrams: null, available: true },
        { productId: "p1", unit: "KG", quantity: 0.25, weightGrams: 250, available: true },
        { productId: "p3", unit: "BARQUETTE", quantity: 4, weightGrams: null, available: false },
        { productId: "p4", unit: "KG", quantity: 0.47, weightGrams: 500, available: true },
        { productId: "p5", unit: "PIECE", quantity: 0, weightGrams: null, available: true },
      ])
    ).toEqual([
      { productId: "p1", units: 4 },
      { productId: "p2", units: 2 },
      { productId: "p4", units: 1 },
    ]);
  });
});

describe("reserveLimitedStock", () => {
  it("decrements anti-gaspi and flash-sale stock by the units", async () => {
    const shop = await createTestShop();
    const gaspi = await antiGaspiProduct(shop.id, 5);
    const flash = await flashProduct(shop.id, 4);

    await reserve(shop.id, [
      { productId: gaspi.id, units: 2 },
      { productId: flash.id, units: 3 },
    ]);

    expect((await product(gaspi.id)).antiGaspiStock).toBe(3);
    expect((await product(gaspi.id)).isAntiGaspi).toBe(true);
    expect((await product(flash.id)).flashSaleStock).toBe(1);
  });

  it("keeps an anti-gaspi product in its limited mode at stock 0, at its reduced price", async () => {
    const shop = await createTestShop();
    const gaspi = await antiGaspiProduct(shop.id, 2);

    await reserve(shop.id, [{ productId: gaspi.id, units: 2 }]);

    expect(await product(gaspi.id)).toMatchObject({
      isAntiGaspi: true,
      priceCents: 990,
      antiGaspiStock: 0,
      antiGaspiOrigPriceCents: 1490,
      antiGaspiEndAt: ANTI_GASPI_END,
      antiGaspiReason: "DLC proche",
    });
  });

  it("keeps a flash sale in its limited mode at stock 0", async () => {
    const shop = await createTestShop();
    const flash = await flashProduct(shop.id, 3);

    await reserve(shop.id, [{ productId: flash.id, units: 3 }]);

    expect(await product(flash.id)).toMatchObject({
      isFlashSale: true,
      flashSaleStock: 0,
      flashSaleEndAt: FLASH_END,
    });
  });

  it("throws LimitedStockError on underflow and the rolled-back transaction leaves stock unchanged", async () => {
    const shop = await createTestShop();
    const gaspi = await antiGaspiProduct(shop.id, 5);
    const flash = await flashProduct(shop.id, 1);

    const error = await reserve(shop.id, [
      { productId: gaspi.id, units: 2 },
      { productId: flash.id, units: 2 },
    ]).then(
      () => null,
      (caught: unknown) => caught
    );

    expect(error).toBeInstanceOf(LimitedStockError);
    expect((error as LimitedStockError).productId).toBe(flash.id);
    expect((await product(gaspi.id)).antiGaspiStock).toBe(5);
    expect(await product(flash.id)).toMatchObject({ isFlashSale: true, flashSaleStock: 1 });
  });

  it("lets only the reservations that fit succeed under concurrency", async () => {
    const shop = await createTestShop();
    const gaspi = await antiGaspiProduct(shop.id, 3);

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => reserve(shop.id, [{ productId: gaspi.id, units: 2 }]))
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results) {
      if (r.status === "rejected") expect(r.reason).toBeInstanceOf(LimitedStockError);
    }
    expect(await product(gaspi.id)).toMatchObject({ isAntiGaspi: true, antiGaspiStock: 1 });
  });

  it("refuses the next reservation once the stock reached exactly 0, and a release gives units back", async () => {
    const shop = await createTestShop();
    const gaspi = await antiGaspiProduct(shop.id, 6);
    const flash = await flashProduct(shop.id, 3);
    await reserve(shop.id, [
      { productId: gaspi.id, units: 3 },
      { productId: gaspi.id, units: 3 },
      { productId: flash.id, units: 3 },
    ]);

    const gaspiError = await reserve(shop.id, [{ productId: gaspi.id, units: 3 }]).catch(
      (caught: unknown) => caught
    );
    const flashError = await reserve(shop.id, [{ productId: flash.id, units: 1 }]).catch(
      (caught: unknown) => caught
    );

    expect(gaspiError).toBeInstanceOf(LimitedStockError);
    expect(flashError).toBeInstanceOf(LimitedStockError);
    expect((await product(gaspi.id)).antiGaspiStock).toBe(0);

    await release(shop.id, [{ productId: gaspi.id, units: 3 }]);
    expect(await product(gaspi.id)).toMatchObject({ isAntiGaspi: true, antiGaspiStock: 3 });
    await reserve(shop.id, [{ productId: gaspi.id, units: 3 }]);
    expect((await product(gaspi.id)).antiGaspiStock).toBe(0);
  });

  it("leaves products without a limited mode alone", async () => {
    const shop = await createTestShop();
    const plain = await createTestProduct(shop.id);

    await reserve(shop.id, [{ productId: plain.id, units: 3 }]);

    expect(await product(plain.id)).toEqual(plain);
  });

  it("never touches a product of another shop", async () => {
    const [shop, otherShop] = [await createTestShop(), await createTestShop()];
    const foreign = await antiGaspiProduct(otherShop.id, 5);
    const foreignFlash = await flashProduct(otherShop.id, 1);

    await reserve(shop.id, [
      { productId: foreign.id, units: 5 },
      { productId: foreignFlash.id, units: 1 },
    ]);
    await release(shop.id, [{ productId: foreign.id, units: 2 }]);

    expect(await product(foreign.id)).toEqual(foreign);
    expect(await product(foreignFlash.id)).toEqual(foreignFlash);
  });

  it("refuses a line whose units are not a positive integer", async () => {
    const shop = await createTestShop();
    const gaspi = await antiGaspiProduct(shop.id, 5);

    await expect(reserve(shop.id, [{ productId: gaspi.id, units: 0 }])).rejects.toBeInstanceOf(
      RangeError
    );
    await expect(reserve(shop.id, [{ productId: gaspi.id, units: 1.5 }])).rejects.toBeInstanceOf(
      RangeError
    );
    expect((await product(gaspi.id)).antiGaspiStock).toBe(5);
  });
});

describe("releaseLimitedStock", () => {
  it("increments products still in their limited mode", async () => {
    const shop = await createTestShop();
    const gaspi = await antiGaspiProduct(shop.id, 1);
    const flash = await flashProduct(shop.id, 0);

    await release(shop.id, [
      { productId: gaspi.id, units: 2 },
      { productId: flash.id, units: 3 },
    ]);

    expect((await product(gaspi.id)).antiGaspiStock).toBe(3);
    expect((await product(flash.id)).flashSaleStock).toBe(3);
  });

  it("does not revive a product whose mode the butcher ended", async () => {
    const shop = await createTestShop();
    const soldOut = await antiGaspiProduct(shop.id, 1);
    await reserve(shop.id, [{ productId: soldOut.id, units: 1 }]);
    const ended = await prisma.product.update({
      where: { id: soldOut.id },
      data: {
        isAntiGaspi: false,
        antiGaspiStock: null,
        priceCents: 1490,
        antiGaspiOrigPriceCents: null,
      },
    });
    const unlimitedFlash = await createTestProduct(shop.id, {
      isFlashSale: true,
      flashSaleStock: null,
    });

    await release(shop.id, [
      { productId: soldOut.id, units: 1 },
      { productId: unlimitedFlash.id, units: 4 },
    ]);

    expect(await product(soldOut.id)).toEqual(ended);
    expect(await product(unlimitedFlash.id)).toEqual(unlimitedFlash);
  });
});
