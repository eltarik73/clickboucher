// src/lib/services/orders/limited-stock.ts — stock of anti-gaspi and flash-sale products.
//
// Such a product carries a counter of sale units (antiGaspiStock / flashSaleStock). An order holds
// its units while it is in a status where holdsLimitedStock() is true: the caller reserves them on
// entering that set and releases them on leaving it, in the transaction of the transition.
// One unit = one portion (KG, TRANCHE) or one piece / tray, never a kilogram.
// An anti-gaspi counter counts only while the discount is in force (antiGaspiInForceWhere): past
// antiGaspiEndAt the product sells at its original price without limit, and its counter is neither
// taken from nor given back to (the butcher's « end anti-gaspi » action empties it).
import type { Prisma } from "@prisma/client";
import { antiGaspiInForceWhere } from "@/lib/pricing/anti-gaspi";
import { storedLineUnits, type StoredLine } from "@/lib/pricing/line";

type Tx = Prisma.TransactionClient;

export interface StockLine {
  productId: string;
  units: number;
}

export class LimitedStockError extends Error {
  readonly productId: string;

  constructor(productId: string) {
    super(`Limited stock exhausted for product ${productId}`);
    this.name = "LimitedStockError";
    this.productId = productId;
  }
}

/**
 * Available lines only, summed per product, in order of first appearance. A row that holds no unit
 * (a count adjusted down to 0) gives no line.
 */
export function stockLinesFromItems(
  items: ReadonlyArray<StoredLine & { productId: string; available: boolean }>
): StockLine[] {
  const unitsByProduct = new Map<string, number>();
  for (const item of items) {
    if (!item.available) continue;
    const units = storedLineUnits(item);
    if (units === 0) continue;
    unitsByProduct.set(item.productId, (unitsByProduct.get(item.productId) ?? 0) + units);
  }
  return Array.from(unitsByProduct, ([productId, units]) => ({ productId, units }));
}

/**
 * Lines to write, merged per product and sorted by id: two transactions touching the same products
 * then lock their rows in the same order and cannot deadlock each other.
 */
function normalizedLines(lines: readonly StockLine[]): StockLine[] {
  const unitsByProduct = new Map<string, number>();
  for (const line of lines) {
    if (!Number.isSafeInteger(line.units) || line.units <= 0) {
      throw new RangeError(
        `Stock units must be a positive integer, received ${line.units} for ${line.productId}`
      );
    }
    unitsByProduct.set(line.productId, (unitsByProduct.get(line.productId) ?? 0) + line.units);
  }
  return Array.from(unitsByProduct, ([productId, units]) => ({ productId, units })).sort((a, b) =>
    a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0
  );
}

/**
 * Takes `line.units` from one counter (anti-gaspi or flash sale) of a product of the shop that is in
 * that limited mode at `now`. The counter is only written here and by the release: it reaches 0 and
 * stays in its limited mode at 0, so the quote refuses new orders and the next reservation fails,
 * until the butcher ends the mode or gives stock back. Throws LimitedStockError when it would go
 * below 0.
 */
async function reserveCounter(
  tx: Tx,
  shopId: string,
  line: StockLine,
  counter: "antiGaspiStock" | "flashSaleStock",
  now: Date
): Promise<void> {
  const mode: Prisma.ProductWhereInput =
    counter === "antiGaspiStock" ? antiGaspiInForceWhere(now) : { isFlashSale: true };
  const { count } = await tx.product.updateMany({
    where: { id: line.productId, shopId, ...mode, [counter]: { not: null } },
    data: { [counter]: { decrement: line.units } },
  });
  if (count === 0) return;

  const product = await tx.product.findFirstOrThrow({
    where: { id: line.productId, shopId },
    select: { antiGaspiStock: true, flashSaleStock: true },
  });
  if ((product[counter] ?? 0) < 0) throw new LimitedStockError(line.productId);
}

/**
 * Takes the units from every limited product of the shop at `now`. Products of another shop,
 * products without a limited mode and anti-gaspi discounts past their end date are not touched.
 * Throws LimitedStockError when a counter would go below 0: the caller's transaction must roll
 * back (it holds the decrements already made).
 */
export async function reserveLimitedStock(
  tx: Tx,
  shopId: string,
  lines: readonly StockLine[],
  now: Date
): Promise<void> {
  for (const line of normalizedLines(lines)) {
    await reserveCounter(tx, shopId, line, "antiGaspiStock", now);
    await reserveCounter(tx, shopId, line, "flashSaleStock", now);
  }
}

/**
 * Gives the units back to the products of the shop that are still in their limited mode with a
 * counter at `now` (a sold-out product stays in its mode at 0 and gets them back). A product whose
 * mode the butcher switched off meanwhile, or whose anti-gaspi discount has expired, is left
 * alone: its stock is no longer counted.
 */
export async function releaseLimitedStock(
  tx: Tx,
  shopId: string,
  lines: readonly StockLine[],
  now: Date
): Promise<void> {
  for (const line of normalizedLines(lines)) {
    await tx.product.updateMany({
      where: {
        id: line.productId,
        shopId,
        ...antiGaspiInForceWhere(now),
        antiGaspiStock: { not: null },
      },
      data: { antiGaspiStock: { increment: line.units } },
    });
    await tx.product.updateMany({
      where: { id: line.productId, shopId, isFlashSale: true, flashSaleStock: { not: null } },
      data: { flashSaleStock: { increment: line.units } },
    });
  }
}
