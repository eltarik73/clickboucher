// src/app/(boucher)/boucher/commandes/use-shop-status.ts — the kitchen's view of its shop (name,
// preparation time, status, pause countdown): the one reader and the one writer of
// /api/boucher/shop/status in the kitchen.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Minimum delay between two shop-status refetches for the same expired pause
const PAUSE_EXPIRY_RETRY_MS = 15_000;

/** What the kitchen asks of PATCH /api/boucher/shop/status (route schema: action-schema.ts). */
export type ShopStatusChange =
  | { action: "pause"; reason: string; durationMin: number }
  | { action: "close" }
  | { action: "resume" };

function successMessage(change: ShopStatusChange): string {
  switch (change.action) {
    case "pause":
      return `Pause ${change.durationMin} min`;
    case "close":
      return "Boutique hors ligne";
    case "resume":
      return "Boutique en ligne";
  }
}

export type KitchenShop = ReturnType<typeof useShopStatus>;

export function useShopStatus() {
  const [shopName, setShopName] = useState("");
  const [shopPrepTime, setShopPrepTime] = useState(15);
  const [shopStatus, setShopStatus] = useState("OPEN");
  const [shopPauseEndsAt, setShopPauseEndsAt] = useState<string | null>(null);
  const [pauseCountdownStr, setPauseCountdownStr] = useState<string | null>(null);
  // Last refetch triggered by an expired pause (one per pauseEndsAt value, retried every 15 s at most)
  const expiredPauseFetchRef = useRef<{ key: string; at: number } | null>(null);

  // Read once on mount, then on every order status change, after each write and when a pause ends
  const fetchShopInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/boucher/shop/status");
      if (res.ok) {
        const json = await res.json();
        setShopName(json.data?.name || "");
        setShopPrepTime(json.data?.prepTimeMin || 15);
        setShopStatus(json.data?.status || "OPEN");
        setShopPauseEndsAt(json.data?.pauseEndsAt || null);
      }
    } catch {
      // A failed read keeps the last known status; the next trigger above reads again
    }
  }, []);

  useEffect(() => {
    fetchShopInfo();
  }, [fetchShopInfo]);

  // ── Countdown for pause timer (1s tick for MM:SS) ──
  useEffect(() => {
    const tick = () => {
      if (shopPauseEndsAt) {
        const diffMs = new Date(shopPauseEndsAt).getTime() - Date.now();
        if (diffMs <= 0) {
          setPauseCountdownStr(null);
          // Pause over: refetch once per pauseEndsAt value, then at most every 15 s
          // while the server still returns it (failed request, clock skew)
          const last = expiredPauseFetchRef.current;
          if (
            !last ||
            last.key !== shopPauseEndsAt ||
            Date.now() - last.at > PAUSE_EXPIRY_RETRY_MS
          ) {
            expiredPauseFetchRef.current = { key: shopPauseEndsAt, at: Date.now() };
            fetchShopInfo();
          }
        } else {
          const m = Math.floor(diffMs / 60000);
          const s = Math.floor((diffMs % 60000) / 1000);
          setPauseCountdownStr(`${m}:${s.toString().padStart(2, "0")}`);
        }
      } else {
        setPauseCountdownStr(null);
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [shopPauseEndsAt, fetchShopInfo]);

  const setStatus = useCallback(
    async (change: ShopStatusChange) => {
      try {
        const res = await fetch("/api/boucher/shop/status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(change),
        });
        if (res.ok) {
          fetchShopInfo();
          toast.success(successMessage(change));
        }
      } catch {
        toast.error("Erreur");
      }
    },
    [fetchShopInfo]
  );

  return {
    name: shopName,
    prepTimeMin: shopPrepTime,
    status: shopStatus,
    pauseCountdown: pauseCountdownStr,
    refresh: fetchShopInfo,
    setStatus,
  };
}
