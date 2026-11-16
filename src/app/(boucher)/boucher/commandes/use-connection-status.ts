// src/app/(boucher)/boucher/commandes/use-connection-status.ts — the kitchen's Wi-Fi indicator:
// green as soon as an orders poll succeeds, red once none has succeeded for CONNECTION_STALE_MS
// (counted from the page's mount while no poll has succeeded yet).
"use client";

import { useEffect, useRef, useState } from "react";

// Above the 15 s hidden-tab cadence of the orders poll
const CONNECTION_STALE_MS = 20_000;

export function useConnectionStatus(lastSuccessAt: number | null): boolean {
  const [connected, setConnected] = useState(true);
  const lastSuccessRef = useRef<number | null>(null);

  useEffect(() => {
    if (lastSuccessAt === null) return;
    lastSuccessRef.current = lastSuccessAt;
    setConnected(true);
  }, [lastSuccessAt]);

  useEffect(() => {
    const mountedAt = Date.now();
    const checker = setInterval(() => {
      const reference = lastSuccessRef.current ?? mountedAt;
      setConnected(Date.now() - reference <= CONNECTION_STALE_MS);
    }, 5000);
    return () => clearInterval(checker);
  }, []);

  return connected;
}
