// src/lib/cart/cart-line.ts — the cart line, its local price estimate and the cart reducer.
// Stored carts are read by stored-cart.ts; the price a product card shows is pricing/display.ts.
//
// A cart line has the meaning of a request line (chantier 0, decision 1):
//   quantity    = number of portions (KG, TRANCHE) or of units (PIECE, BARQUETTE), integer 1..99;
//   weightGrams = grams of ONE portion, present for weighed units only;
//   priceCents  = effective unit price when the line was added (per kilogram for weighed units).
// The cart price is an estimate: the server quotes every order from its own rows.
//
// Lines are identified by `cartLineId`, which carries everything that makes two lines
// different (variant, cut, slices, pieces and, for weighed lines, the portion weight), so
// that two lines are merged only when they are the same line.
//
// Pure and client-safe: no I/O, no clock.

import {
  MAX_LINE_QUANTITY,
  checkLineQuantity,
  isWeighedUnit,
  lineTotalCents,
  type SaleUnit,
} from "@/lib/pricing/line";

interface CartLineBase {
  /** Cart line id (cartLineId); for weighed lines it includes weightGrams. */
  id: string;
  productId: string;
  name: string;
  imageUrl: string;
  /** Effective unit price when added (resolveUnitPrice): per kg for KG/TRANCHE, per unit otherwise. Local estimate only. */
  priceCents: number;
  /** Portions (KG, TRANCHE) or units. Integer >= 1. */
  quantity: number;
  sliceCount?: number;
  thickness?: string;
  variant?: string;
  pieceCount?: number;
  pieceLabel?: string;
  cutOption?: string;
  category?: string;
}

export type CartItem =
  | (CartLineBase & { unit: "KG" | "TRANCHE"; weightGrams: number })
  | (CartLineBase & { unit: "PIECE" | "BARQUETTE"; weightGrams?: undefined });

export interface CartState {
  shopId: string | null;
  shopName: string | null;
  shopSlug: string | null;
  items: CartItem[];
}

export const EMPTY_CART: CartState = { shopId: null, shopName: null, shopSlug: null, items: [] };

/** lineTotalCents(item, item.priceCents). Throws RangeError on a line that is not a valid request line. */
export function cartLineTotalCents(item: CartItem): number {
  return lineTotalCents(item, item.priceCents);
}

export function cartTotalCents(items: readonly CartItem[]): number {
  return items.reduce((sum, item) => sum + cartLineTotalCents(item), 0);
}

export interface CartLineIdentity {
  productId: string;
  unit: SaleUnit;
  weightGrams?: number;
  variant?: string;
  cutOption?: string;
  thickness?: string;
  sliceCount?: number;
  pieceCount?: number;
}

/**
 * `<productId>[-variant][-cutOption][-thickness][-sliceCount][-<pieceCount>pc]-<grams>g` for a weighed
 * line, `<productId>[-variant]` for a counted one.
 */
export function cartLineId(line: CartLineIdentity): string {
  const parts = [line.productId, line.variant, line.cutOption, line.thickness];
  if (line.sliceCount !== undefined) parts.push(String(line.sliceCount));
  if (line.pieceCount !== undefined) parts.push(`${line.pieceCount}pc`);
  if (isWeighedUnit(line.unit)) parts.push(`${line.weightGrams}g`);
  return parts.filter((part) => part !== undefined && part !== "").join("-");
}

/** A line the server would accept as a request line, with a usable local price. */
export function isValidCartLine(item: CartItem): boolean {
  return (
    checkLineQuantity(item) === null &&
    Number.isSafeInteger(item.priceCents) &&
    item.priceCents >= 0
  );
}

// ── Reducer ──────────────────────────────────

export type CartAction =
  | { type: "ADD_ITEM"; payload: CartItem & { shopId: string; shopName: string; shopSlug: string } }
  | { type: "REMOVE_ITEM"; payload: { id: string } }
  | { type: "UPDATE_QTY"; payload: { id: string; quantity: number } }
  | { type: "UPDATE_WEIGHT"; payload: { id: string; weightGrams: number } }
  | { type: "SET_STATE"; payload: CartState }
  | { type: "CLEAR" };

function withItems(state: CartState, items: CartItem[]): CartState {
  return items.length === 0 ? EMPTY_CART : { ...state, items };
}

/** Adds `item` to `items`: summed into the line with the same id (capped at MAX_LINE_QUANTITY), else appended. */
export function mergeCartLine(items: readonly CartItem[], item: CartItem): CartItem[] {
  const existing = items.find((line) => line.id === item.id);
  if (existing === undefined) return [...items, item];
  const quantity = Math.min(MAX_LINE_QUANTITY, existing.quantity + item.quantity);
  return items.map((line) => (line.id === item.id ? { ...line, quantity } : line));
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const { shopId, shopName, shopSlug, ...item } = action.payload;
      const line = item as CartItem;
      if (!isValidCartLine(line)) return state;
      if (state.shopId && state.shopId !== shopId) {
        return { shopId, shopName, shopSlug, items: [line] };
      }
      return { shopId, shopName, shopSlug, items: mergeCartLine(state.items, line) };
    }

    case "REMOVE_ITEM":
      return withItems(
        state,
        state.items.filter((line) => line.id !== action.payload.id)
      );

    case "UPDATE_QTY": {
      const { id, quantity } = action.payload;
      if (quantity <= 0)
        return withItems(
          state,
          state.items.filter((line) => line.id !== id)
        );
      if (!Number.isInteger(quantity) || quantity > MAX_LINE_QUANTITY) return state;
      return {
        ...state,
        items: state.items.map((line) => (line.id === id ? { ...line, quantity } : line)),
      };
    }

    case "UPDATE_WEIGHT": {
      const { id, weightGrams } = action.payload;
      const line = state.items.find((candidate) => candidate.id === id);
      if (line === undefined || !isWeighedUnit(line.unit)) return state;
      const reweighed = { ...line, weightGrams } as CartItem;
      if (checkLineQuantity(reweighed) !== null) return state;
      const rekeyed = { ...reweighed, id: cartLineId(reweighed) } as CartItem;
      const others = state.items.filter((candidate) => candidate.id !== id);
      if (others.some((candidate) => candidate.id === rekeyed.id)) {
        return { ...state, items: mergeCartLine(others, rekeyed) };
      }
      return {
        ...state,
        items: state.items.map((candidate) => (candidate.id === id ? rekeyed : candidate)),
      };
    }

    case "SET_STATE":
      return action.payload;

    case "CLEAR":
      return EMPTY_CART;
  }
}
