// src/lib/cart/stored-cart.ts — carts and lines read from untyped sources: an older bundle's
// sessionStorage, GET /api/cart, a chat action, or an order line ordered again. Every line comes
// out with the cart's meaning (cart-line.ts) or is dropped.
//
// Pure and client-safe: no I/O, no clock.

import {
  EMPTY_CART,
  cartLineId,
  isValidCartLine,
  mergeCartLine,
  type CartItem,
  type CartLineIdentity,
  type CartState,
} from "@/lib/cart/cart-line";
import {
  isWeighedUnit,
  lineQuantityFromStored,
  type LineQuantity,
  type SaleUnit,
} from "@/lib/pricing/line";

const SALE_UNITS: readonly SaleUnit[] = ["KG", "PIECE", "BARQUETTE", "TRANCHE"];

/** The sale unit named by `value`, or null. */
export function parseSaleUnit(value: unknown): SaleUnit | null {
  return SALE_UNITS.find((unit) => unit === value) ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function optionalCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

/** Quantity and weight with today's meaning, or null when the stored values cannot be read as a line. */
function storedQuantity(
  unit: SaleUnit,
  quantity: unknown,
  weightGrams: unknown
): LineQuantity | null {
  if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity < 0) return null;
  if (!isWeighedUnit(unit)) return { unit, quantity };
  // Lines written before the portion weight was mandatory: quantity was the weight in kilograms.
  if (weightGrams === null || weightGrams === undefined) {
    return lineQuantityFromStored({ unit, quantity, weightGrams: null });
  }
  return typeof weightGrams === "number" ? { unit, quantity, weightGrams } : null;
}

/**
 * A cart line from an untyped source with the cart's meaning (quantity = portions or units,
 * weightGrams = grams of one portion): an older bundle's sessionStorage, GET /api/cart, a chat
 * action. A weighed line without weight is read with quantity in kilograms; a weight on a counted
 * line is dropped; an old cut price becomes the unit price. null when it cannot be made valid.
 */
export function normalizeCartLine(raw: unknown): CartItem | null {
  if (!isRecord(raw)) return null;
  const unit = parseSaleUnit(raw.unit);
  const productId = optionalString(raw.productId) ?? optionalString(raw.id);
  const name = typeof raw.name === "string" ? raw.name : undefined;
  // Older bundles kept the cut price beside the base price; it was the price charged.
  const priceCents = isCents(raw.cutPriceCents) ? raw.cutPriceCents : raw.priceCents;
  if (unit === null || productId === undefined || name === undefined || !isCents(priceCents))
    return null;

  const quantity = storedQuantity(unit, raw.quantity, raw.weightGrams);
  if (quantity === null) return null;

  const optional = {
    sliceCount: optionalCount(raw.sliceCount),
    thickness: optionalString(raw.thickness),
    variant: optionalString(raw.variant),
    pieceCount: optionalCount(raw.pieceCount),
    pieceLabel: optionalString(raw.pieceLabel),
    cutOption: optionalString(raw.cutOption),
    category: optionalString(raw.category),
  };
  const present = Object.fromEntries(
    Object.entries(optional).filter(([, value]) => value !== undefined)
  );
  const line = {
    productId,
    name,
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : "",
    priceCents,
    ...quantity,
    ...present,
  } as Omit<CartItem, "id">;
  const item = { id: cartLineId(line as CartLineIdentity), ...line } as CartItem;
  return isValidCartLine(item) ? item : null;
}

/**
 * Reads what an older bundle left in sessionStorage or what GET /api/cart returns.
 * Lines that cannot be made valid are dropped; ids are rebuilt with cartLineId and lines that
 * become identical are merged. Anything else than a cart with a shop and a valid line gives EMPTY_CART.
 */
export function normalizeStoredCart(raw: unknown): CartState {
  if (
    !isRecord(raw) ||
    !Array.isArray(raw.items) ||
    typeof raw.shopId !== "string" ||
    raw.shopId === ""
  ) {
    return EMPTY_CART;
  }
  const items = raw.items.reduce<CartItem[]>((lines, entry) => {
    const line = normalizeCartLine(entry);
    return line === null ? lines : mergeCartLine(lines, line);
  }, []);
  if (items.length === 0) return EMPTY_CART;
  return {
    shopId: raw.shopId,
    shopName: typeof raw.shopName === "string" ? raw.shopName : null,
    shopSlug: typeof raw.shopSlug === "string" ? raw.shopSlug : null,
    items,
  };
}

/** OrderItem fields a reorder reads (see StoredLine for quantity and weightGrams). */
export interface ReorderedOrderLine {
  productId: string;
  name: string;
  imageUrl?: string | null;
  unit: SaleUnit;
  quantity: number;
  weightGrams: number | null;
  priceCents: number;
  cutOption?: string | null;
  variant?: string | null;
  sliceCount?: number | null;
  sliceThickness?: string | null;
  pieceCount?: number | null;
  pieceLabel?: string | null;
}

/**
 * The cart line that orders a stored order line again, at the unit price charged then (the
 * server quotes the new order). null when the stored row is not a line the server accepts today.
 */
export function cartItemFromOrderLine(row: ReorderedOrderLine): CartItem | null {
  if (!Number.isFinite(row.quantity) || row.quantity < 0) return null;
  const line = lineQuantityFromStored({
    unit: row.unit,
    quantity: row.quantity,
    weightGrams: row.weightGrams,
  });
  return normalizeCartLine({
    productId: row.productId,
    name: row.name,
    imageUrl: row.imageUrl,
    unit: row.unit,
    quantity: line.quantity,
    weightGrams: line.weightGrams,
    priceCents: row.priceCents,
    cutOption: row.cutOption,
    variant: row.variant,
    sliceCount: row.sliceCount,
    thickness: row.sliceThickness,
    pieceCount: row.pieceCount,
    pieceLabel: row.pieceLabel,
  });
}
