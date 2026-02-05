// src/lib/hooks/useCart.ts
"use client";

import { useState, useCallback, useEffect, createContext, useContext, type ReactNode } from "react";
import { computePrice } from "@/lib/estimate";

export interface CartItem {
  productId: string;
  shopId: string;
  name: string;
  category: string;
  quantiteG: number;
  prixAuKg: number;
  imageUrl?: string;
}

export interface ToastData {
  message: string;
  id: number;
}

export interface CartState {
  items: CartItem[];
  toast: ToastData | null;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantiteG: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  getItemPrice: (productId: string) => number;
  hasItem: (productId: string) => boolean;
  dismissToast: () => void;
}

const STORAGE_KEY = "clickboucher_cart";

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function saveCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
}

export function useCartState(): CartState {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  useEffect(() => { setItems(loadCart()); setHydrated(true); }, []);
  useEffect(() => { if (hydrated) saveCart(items); }, [items, hydrated]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const addItem = useCallback((newItem: CartItem) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.productId === newItem.productId);
      if (idx >= 0) {
        const upd = [...prev];
        upd[idx] = { ...upd[idx], quantiteG: newItem.quantiteG };
        return upd;
      }
      return [...prev, newItem];
    });
    setToast({ message: `${newItem.name} ajouté au panier`, id: Date.now() });
  }, []);

  const removeItem = useCallback((pid: string) => {
    setItems(prev => prev.filter(i => i.productId !== pid));
  }, []);

  const updateQuantity = useCallback((pid: string, g: number) => {
    setItems(prev => prev.map(i => i.productId === pid ? { ...i, quantiteG: g } : i));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);
  const getTotal = useCallback(() => items.reduce((t, i) => t + computePrice(i.quantiteG, i.prixAuKg), 0), [items]);
  const getItemCount = useCallback(() => items.length, [items]);
  const getItemPrice = useCallback((pid: string) => {
    const i = items.find(x => x.productId === pid);
    return i ? computePrice(i.quantiteG, i.prixAuKg) : 0;
  }, [items]);
  const hasItem = useCallback((pid: string) => items.some(i => i.productId === pid), [items]);
  const dismissToast = useCallback(() => setToast(null), []);

  return { items, toast, addItem, removeItem, updateQuantity, clearCart, getTotal, getItemCount, getItemPrice, hasItem, dismissToast };
}

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children, value }: { children: ReactNode; value: CartState }) {
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
