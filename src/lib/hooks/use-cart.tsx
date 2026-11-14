"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "@clerk/nextjs";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { hasTestModeCookie } from "@/lib/test-mode-client";
import {
  EMPTY_CART,
  cartReducer,
  cartTotalCents,
  type CartItem,
  type CartState,
} from "@/lib/cart/cart-line";
import { normalizeStoredCart } from "@/lib/cart/stored-cart";

export type { CartItem } from "@/lib/cart/cart-line";

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

// ── Stored cart ──────────────────────────────

const STORAGE_KEY = "klikgo-cart";

function loadState(): CartState {
  try {
    if (typeof window === "undefined") return EMPTY_CART;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_CART;
    return normalizeStoredCart(JSON.parse(raw));
  } catch {
    return EMPTY_CART;
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
  const [state, dispatch] = useReducer(cartReducer, EMPTY_CART);
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
    } catch {
      /* SSR or quota exceeded — ignore */
    }
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
            productId: i.productId,
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

        const restored = normalizeStoredCart({
          ...dbCart,
          items: dbCart.items.filter(
            (i: { inStock?: boolean; snoozed?: boolean }) => i.inStock && !i.snoozed
          ),
        });
        if (restored.items.length === 0) return;

        skipNextSync.current = true;
        dispatch({ type: "SET_STATE", payload: restored });
      } catch {
        // Silent — sessionStorage is the primary source
      }
    }
    loadFromDB();
  }, [canSync, hydrated]);

  const addItem = useCallback(
    (item: CartItem, shop: { id: string; name: string; slug: string }) => {
      // Intercept shop switch: ask confirmation before clearing cart. Read through the ref, so
      // that clear() followed by addItem() in the same handler (reorder) sees the emptied cart.
      const current = stateRef.current;
      if (current.shopId && current.shopId !== shop.id && current.items.length > 0) {
        setPendingSwitch({ item, shop, oldShopName: current.shopName || "la boutique actuelle" });
        return;
      }
      dispatch({
        type: "ADD_ITEM",
        payload: { ...item, shopId: shop.id, shopName: shop.name, shopSlug: shop.slug },
      });
    },
    []
  );

  const removeItem = useCallback(
    (id: string) => dispatch({ type: "REMOVE_ITEM", payload: { id } }),
    []
  );
  const updateQty = useCallback(
    (id: string, quantity: number) => dispatch({ type: "UPDATE_QTY", payload: { id, quantity } }),
    []
  );
  const updateWeight = useCallback(
    (id: string, weightGrams: number) =>
      dispatch({ type: "UPDATE_WEIGHT", payload: { id, weightGrams } }),
    []
  );
  const clear = useCallback(() => {
    stateRef.current = EMPTY_CART;
    dispatch({ type: "CLEAR" });
    if (!knownAnonymousRef.current) {
      fetch("/api/cart", { method: "DELETE" }).catch(() => {});
    }
  }, []);

  const itemCount = useMemo(
    () => state.items.reduce((sum, i) => sum + i.quantity, 0),
    [state.items]
  );

  const totalCents = useMemo(() => cartTotalCents(state.items), [state.items]);

  const value = useMemo(
    () => ({ state, addItem, removeItem, updateQty, updateWeight, clear, itemCount, totalCents }),
    [state, addItem, removeItem, updateQty, updateWeight, clear, itemCount, totalCents]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={!!pendingSwitch}
        onOpenChange={(open) => {
          if (!open) setPendingSwitch(null);
        }}
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
