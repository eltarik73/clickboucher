"use client";

import React, { createContext, useContext, useReducer, useCallback, useMemo, useEffect, useRef } from "react";

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
  | { type: "SET_STATE"; payload: CartState }
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

const STORAGE_KEY = "klikgo-cart";
const initialState: CartState = { shopId: null, shopName: null, shopSlug: null, items: [] };

function loadState(): CartState {
  try {
    if (typeof window === "undefined") return initialState;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    return JSON.parse(raw) as CartState;
  } catch {
    return initialState;
  }
}

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

    case "SET_STATE":
      return action.payload;

    case "CLEAR":
      return initialState;

    default:
      return state;
  }
}

// ── Context ──────────────────────────────────

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState, loadState);
  const syncTimer = useRef<ReturnType<typeof setTimeout>>();
  const initialLoadDone = useRef(false);

  // Persist to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* SSR or quota exceeded — ignore */ }
  }, [state]);

  // DB sync: debounced POST to /api/cart on every state change
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      return;
    }

    if (syncTimer.current) clearTimeout(syncTimer.current);

    syncTimer.current = setTimeout(() => {
      if (!state.shopId || state.items.length === 0) {
        // Clear DB cart
        fetch("/api/cart", { method: "DELETE" }).catch(() => {});
        return;
      }

      fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: state.shopId,
          items: state.items.map((i) => ({
            productId: i.productId || i.id,
            quantity: i.quantity,
            weightGrams: i.weightGrams,
          })),
        }),
      }).catch(() => {});
    }, 2000);

    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [state]);

  // On mount: try loading from DB if sessionStorage is empty
  useEffect(() => {
    async function loadFromDB() {
      try {
        const localState = loadState();
        if (localState.items.length > 0) return; // Local has data, don't overwrite

        const res = await fetch("/api/cart");
        if (!res.ok) return;
        const json = await res.json();
        const dbCart = json.data;
        if (!dbCart || !dbCart.items || dbCart.items.length === 0) return;

        dispatch({
          type: "SET_STATE",
          payload: {
            shopId: dbCart.shopId,
            shopName: dbCart.shopName,
            shopSlug: dbCart.shopSlug,
            items: dbCart.items.filter((i: { inStock: boolean; snoozed: boolean }) => i.inStock && !i.snoozed).map(
              (i: { id: string; productId: string; name: string; imageUrl: string; priceCents: number; unit: string; quantity: number; weightGrams?: number }) => ({
                id: i.productId,
                productId: i.productId,
                name: i.name,
                imageUrl: i.imageUrl,
                priceCents: i.priceCents,
                unit: i.unit,
                quantity: i.quantity,
                weightGrams: i.weightGrams,
              })
            ),
          },
        });
      } catch {
        // Silent — sessionStorage is the primary source
      }
    }
    loadFromDB();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const clear = useCallback(() => {
    dispatch({ type: "CLEAR" });
    fetch("/api/cart", { method: "DELETE" }).catch(() => {});
  }, []);

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
