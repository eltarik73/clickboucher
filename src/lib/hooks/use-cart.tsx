"use client";

import React, { createContext, useContext, useReducer, useCallback, useMemo } from "react";

// ── Types ────────────────────────────────────

export interface CartItem {
  id: string;
  productId?: string;
  packId?: string;
  offerId?: string;
  name: string;
  imageUrl: string;
  unit: "KG" | "PIECE" | "BARQUETTE";
  priceCents: number;
  quantity: number;
  weightGrams?: number;
// Added for CartItem.tsx compatibility
  category?: string;
  quantiteG?: number;
  prixAuKg?: number;
}

interface CartState {
  shopId: string | null;
  shopName: string | null;
  shopSlug: string | null;
  items: CartItem[];
}

type CartAction =
  | { type: "ADD_ITEM"; payload: CartItem & { shopId: string; shopName: string; shopSlug: string } }
  | { type: "REMOVE_ITEM"; payload: { id: string } }
  | { type: "UPDATE_QTY"; payload: { id: string; quantity: number } }
  | { type: "UPDATE_WEIGHT"; payload: { id: string; weightGrams: number } }
  | { type: "CLEAR" };

export interface CartContextType {
  state: CartState;
  addItem: (item: CartItem, shop: { id: string; name: string; slug: string }) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, quantity: number) => void;
  updateWeight: (id: string, weightGrams: number) => void;
  clear: () => void;
  itemCount: number;
  totalCents: number;
}

// ── Reducer ──────────────────────────────────

const initialState: CartState = { shopId: null, shopName: null, shopSlug: null, items: [] };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const { shopId, shopName, shopSlug, ...item } = action.payload;

      // If switching shops, clear cart
      if (state.shopId && state.shopId !== shopId) {
        return {
          shopId,
          shopName,
          shopSlug,
          items: [item],
        };
      }

      // Check if item already exists
      const existing = state.items.find((i) => i.id === item.id);
      if (existing) {
        return {
          ...state,
          shopId,
          shopName,
          shopSlug,
          items: state.items.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
          ),
        };
      }

      return { ...state, shopId, shopName, shopSlug, items: [...state.items, item] };
    }

    case "REMOVE_ITEM": {
      const items = state.items.filter((i) => i.id !== action.payload.id);
      return items.length === 0 ? initialState : { ...state, items };
    }

    case "UPDATE_QTY": {
      if (action.payload.quantity <= 0) {
        const items = state.items.filter((i) => i.id !== action.payload.id);
        return items.length === 0 ? initialState : { ...state, items };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.payload.id ? { ...i, quantity: action.payload.quantity } : i
        ),
      };
    }

    case "UPDATE_WEIGHT": {
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.payload.id ? { ...i, weightGrams: action.payload.weightGrams } : i
        ),
      };
    }

    case "CLEAR":
      return initialState;

    default:
      return state;
  }
}

// ── Context ──────────────────────────────────

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  const addItem = useCallback(
    (item: CartItem, shop: { id: string; name: string; slug: string }) => {
      dispatch({
        type: "ADD_ITEM",
        payload: { ...item, shopId: shop.id, shopName: shop.name, shopSlug: shop.slug },
      });
    },
    []
  );

  const removeItem = useCallback((id: string) => dispatch({ type: "REMOVE_ITEM", payload: { id } }), []);
  const updateQty = useCallback((id: string, quantity: number) => dispatch({ type: "UPDATE_QTY", payload: { id, quantity } }), []);
  const updateWeight = useCallback((id: string, weightGrams: number) => dispatch({ type: "UPDATE_WEIGHT", payload: { id, weightGrams } }), []);
  const clear = useCallback(() => dispatch({ type: "CLEAR" }), []);

  const itemCount = useMemo(() => state.items.reduce((sum, i) => sum + i.quantity, 0), [state.items]);

  const totalCents = useMemo(
    () =>
      state.items.reduce((sum, item) => {
        if (item.unit === "KG" && item.weightGrams) {
          return sum + Math.round((item.weightGrams / 1000) * item.priceCents) * item.quantity;
        }
        return sum + item.priceCents * item.quantity;
      }, 0),
    [state.items]
  );

  const value = useMemo(
    () => ({ state, addItem, removeItem, updateQty, updateWeight, clear, itemCount, totalCents }),
    [state, addItem, removeItem, updateQty, updateWeight, clear, itemCount, totalCents]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
