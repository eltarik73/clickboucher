"use client";

import { createContext, useContext, useState } from "react";
import { z } from "zod";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";

const pendingCountAnswer = z.object({
  data: z.object({ pending: z.number().int().nonnegative() }),
});

// undefined: no provider above the reader; null: not read yet.
const PendingOrderCountContext = createContext<number | null | undefined>(undefined);

/**
 * Reads the number of the shop's orders waiting for the butcher's answer once for the whole
 * butcher layout: from /api/boucher/orders/pending-count every 30 s while the tab is visible
 * (useVisiblePolling: paused on a hidden tab, backoff on error), the last count kept on a failed read.
 */
export function PendingOrderCountProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState<number | null>(null);

  useVisiblePolling(async () => {
    const res = await fetch("/api/boucher/orders/pending-count");
    if (!res.ok) return false;
    const answer = pendingCountAnswer.safeParse(await res.json());
    if (!answer.success) return false;
    setCount(answer.data.data.pending);
    return true;
  }, 30_000);

  return (
    <PendingOrderCountContext.Provider value={count}>{children}</PendingOrderCountContext.Provider>
  );
}

/** The count read by the enclosing PendingOrderCountProvider, null before its first read. */
export function usePendingOrderCount(): number | null {
  const count = useContext(PendingOrderCountContext);
  if (count === undefined) {
    throw new Error("usePendingOrderCount is read outside PendingOrderCountProvider");
  }
  return count;
}
