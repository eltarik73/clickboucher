"use client";

import React, { createContext, useContext, useReducer, useCallback, useMemo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { hasTestModeCookie } from "@/lib/test-mode-client";

// ── Types ────────────────────────────────────

export interface CartItem {
  id: string;
  productId?: string;
  packId?: string;
  offerId?: string;
  name: string;
  imageUrl: string;
  unit: "KG" | "PIECE" | "BARQUETTE" | "TRANCHE";
  priceCents: number;
  quantity: number;
  weightGrams?: number;
  // TRANCHE-specific
  sliceCount?: number;
  thickness?: string;
  // Variant & piece selection
  variant?: string;
  pieceCount?: number;
  pieceLabel?: string;
  // Cut options (découpe)
  cutOption?: string;
  cutPriceCents?: number;
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

type PendingShopSwitch = {
  item: CartItem;
  shop: { id: string; name: string; slug: string };
  oldShopName: string;
};

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

// useLayoutEffect côté navigateur (avant le premier affichage), useEffect côté serveur.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function CartProvider({ children }: { children: React.ReactNode }) {
  // Premier rendu = panier vide, côté serveur COMME côté client. Le panier de
  // sessionStorage est relu juste après le montage (effet ci-dessous) : le lire
  // dans l'initialiseur du reducer faisait diverger le HTML statique et le rendu
  // client → erreur d'hydratation React sur chaque page dès qu'un panier existait.
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const [hydrated, setHydrated] = useState(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout>>();
  const initialLoadDone = useRef(false);
  const [pendingSwitch, setPendingSwitch] = useState<PendingShopSwitch | null>(null);

  // Le panier en base n'existe que pour un utilisateur connecté (/api/cart répond
  // vide ou 401 sinon). On n'appelle donc l'API que si Clerk confirme la session
  // — ou en mode test, où Clerk se voit « déconnecté ». Attendre Clerk garantit
  // aussi que la requête part avec un jeton de session rafraîchi.
  // Lu dans des effets/refs uniquement : aucun impact sur le HTML rendu.
  const { isLoaded, isSignedIn } = useAuth();
  const testMode = hasTestModeCookie();
  const canSync = (isLoaded && !!isSignedIn) || testMode;
  const knownAnonymousRef = useRef(false);
  knownAnonymousRef.current = isLoaded && !isSignedIn && !testMode;
  const stateRef = useRef(state);
  stateRef.current = state;
  const dbLoadStarted = useRef(false);
  const skipNextSync = useRef(false);

  // Relecture du panier local, une fois, avant le premier affichage (pas de flash
  // « panier vide »). Ce n'est pas une modification de l'utilisateur : pas de
  // renvoi vers la base.
  useIsomorphicLayoutEffect(() => {
    const stored = loadState();
    if (stored.items.length > 0) {
      skipNextSync.current = true;
      dispatch({ type: "SET_STATE", payload: stored });
    }
    setHydrated(true);
  }, []);

  // Persist to sessionStorage — jamais avant la relecture, sinon l'état vide
  // initial écraserait le panier stocké.
  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* SSR or quota exceeded — ignore */ }
  }, [state, hydrated]);

  // DB sync: debounced POST to /api/cart on every state change
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      return;
    }

    // Le panier vient d'être restauré depuis la base : inutile de le lui renvoyer
    // (cela réinitialisait aussi abandonedAt / reminderSentAt côté serveur).
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }

    if (syncTimer.current) clearTimeout(syncTimer.current);

    syncTimer.current = setTimeout(() => {
      // Visiteur anonyme confirmé : pas de panier en base, l'appel finirait en 401.
      // Tant que Clerk charge encore, on envoie comme avant (aucune perte de sync).
      if (knownAnonymousRef.current) return;

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
            // null (article sans poids revenu de la base) → omis : l'API refuse null
            weightGrams: i.weightGrams ?? undefined,
          })),
        }),
      }).catch(() => {});
    }, 2000);

    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [state]);

  // Dès que la session est confirmée : restaurer le panier depuis la base si le
  // panier local est vide (une seule fois par montage).
  useEffect(() => {
    if (!hydrated || !canSync || dbLoadStarted.current) return;
    dbLoadStarted.current = true;

    async function loadFromDB() {
      try {
        if (stateRef.current.items.length > 0) return; // Local has data, don't overwrite

        const res = await fetch("/api/cart");
        if (!res.ok) return;
        const json = await res.json();
        const dbCart = json.data;
        if (!dbCart || !dbCart.items || dbCart.items.length === 0) return;

        // Ne jamais écraser des articles ajoutés pendant l'attente de Clerk ou du GET
        if (stateRef.current.items.length > 0) return;

        skipNextSync.current = true;
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
                weightGrams: i.weightGrams ?? undefined,
              })
            ),
          },
        });
      } catch {
        // Silent — sessionStorage is the primary source
      }
    }
    loadFromDB();
  }, [canSync, hydrated]);

  const addItem = useCallback(
    (item: CartItem, shop: { id: string; name: string; slug: string }) => {
      // Intercept shop switch: ask confirmation before clearing cart
      if (state.shopId && state.shopId !== shop.id && state.items.length > 0) {
        setPendingSwitch({ item, shop, oldShopName: state.shopName || "la boutique actuelle" });
        return;
      }
      dispatch({
        type: "ADD_ITEM",
        payload: { ...item, shopId: shop.id, shopName: shop.name, shopSlug: shop.slug },
      });
    },
    [state.shopId, state.shopName, state.items.length]
  );

  const removeItem = useCallback((id: string) => dispatch({ type: "REMOVE_ITEM", payload: { id } }), []);
  const updateQty = useCallback((id: string, quantity: number) => dispatch({ type: "UPDATE_QTY", payload: { id, quantity } }), []);
  const updateWeight = useCallback((id: string, weightGrams: number) => dispatch({ type: "UPDATE_WEIGHT", payload: { id, weightGrams } }), []);
  const clear = useCallback(() => {
    dispatch({ type: "CLEAR" });
    if (!knownAnonymousRef.current) {
      fetch("/api/cart", { method: "DELETE" }).catch(() => {});
    }
  }, []);

  const itemCount = useMemo(() => state.items.reduce((sum, i) => sum + i.quantity, 0), [state.items]);

  const totalCents = useMemo(
    () =>
      state.items.reduce((sum, item) => {
        const effectivePrice = item.cutPriceCents ?? item.priceCents;
        if ((item.unit === "KG" || item.unit === "TRANCHE") && item.weightGrams) {
          return sum + Math.round((item.weightGrams / 1000) * effectivePrice) * item.quantity;
        }
        return sum + effectivePrice * item.quantity;
      }, 0),
    [state.items]
  );

  const value = useMemo(
    () => ({ state, addItem, removeItem, updateQty, updateWeight, clear, itemCount, totalCents }),
    [state, addItem, removeItem, updateQty, updateWeight, clear, itemCount, totalCents]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={!!pendingSwitch}
        onOpenChange={(open) => { if (!open) setPendingSwitch(null); }}
        title="Changer de boutique ?"
        description={
          pendingSwitch
            ? `Votre panier contient des articles de ${pendingSwitch.oldShopName}. En ajoutant depuis ${pendingSwitch.shop.name}, votre panier actuel sera vide.`
            : ""
        }
        confirmLabel="Vider et ajouter"
        cancelLabel="Garder mon panier"
        variant="danger"
        onConfirm={() => {
          if (pendingSwitch) {
            dispatch({ type: "CLEAR" });
            dispatch({
              type: "ADD_ITEM",
              payload: {
                ...pendingSwitch.item,
                shopId: pendingSwitch.shop.id,
                shopName: pendingSwitch.shop.name,
                shopSlug: pendingSwitch.shop.slug,
              },
            });
            setPendingSwitch(null);
          }
        }}
        onCancel={() => setPendingSwitch(null)}
      />
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
