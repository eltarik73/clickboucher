"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";

export const PENDING_COUNT_POLL_MS = 30_000;

export type PendingCountChange = { previous: number; current: number };

function readPending(body: unknown): number | null {
  if (typeof body !== "object" || body === null || !("data" in body)) return null;
  const { data } = body;
  if (typeof data !== "object" || data === null || !("pending" in data)) return null;
  const { pending } = data;
  return typeof pending === "number" && Number.isSafeInteger(pending) && pending >= 0
    ? pending
    : null;
}

/**
 * Number of the shop's orders waiting for the butcher's answer, read from
 * /api/boucher/orders/pending-count every 30 s while the tab is visible (useVisiblePolling: paused on
 * a hidden tab, backoff on error). 0 until the first read. `onChange` is called when a later read
 * differs from the previous one, never for the first read.
 */
export function usePendingOrderCount(onChange?: (change: PendingCountChange) => void): number {
  const [count, setCount] = useState(0);
  const lastReadRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const refresh = useCallback(async () => {
    const res = await fetch("/api/boucher/orders/pending-count");
    if (!res.ok) return false;
    const pending = readPending(await res.json());
    if (pending === null) return false;

    const previous = lastReadRef.current;
    lastReadRef.current = pending;
    setCount(pending);
    if (previous !== null && previous !== pending) {
      onChangeRef.current?.({ previous, current: pending });
    }
    return true;
  }, []);

  useVisiblePolling(refresh, PENDING_COUNT_POLL_MS);
  return count;
}
