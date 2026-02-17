// src/hooks/useOrderStream.ts — SSE hook for boucher real-time orders (Uber Eats tablette style)
"use client";

import { useEffect, useRef, useCallback, useState } from "react";

type SSEEvent = {
  type: "CONNECTED" | "NEW_ORDER" | "STATUS_CHANGED" | "SHOP_AUTO_PAUSED" | "HEARTBEAT";
  [key: string]: unknown;
};

type OrderStreamCallbacks = {
  onNewOrder?: (order: unknown) => void;
  onStatusChange?: (status: string) => void;
  onAutoPaused?: (message: string) => void;
};

export function useOrderStream(callbacks: OrderStreamCallbacks = {}) {
  const [connected, setConnected] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const playSound = useCallback((src: string) => {
    try {
      const audio = new Audio(src);
      audio.volume = 0.7;
      audio.play().catch(() => {
        // Autoplay blocked — user needs to interact first
      });
    } catch {
      // Audio not supported
    }
  }, []);

  const flashScreen = useCallback((color: "green" | "red") => {
    const cls = color === "green" ? "flash-green" : "flash-red";
    document.body.classList.add(cls);
    setTimeout(() => document.body.classList.remove(cls), 3000);
  }, []);

  const vibrate = useCallback(() => {
    navigator.vibrate?.([200, 100, 200, 100, 200]);
  }, []);

  useEffect(() => {
    const eventSource = new EventSource("/api/boucher/orders/stream");
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);

        switch (data.type) {
          case "CONNECTED":
            setConnected(true);
            break;

          case "NEW_ORDER":
            // Sound + vibration + flash (Uber Eats tablette style)
            playSound("/sounds/new-order.wav");
            vibrate();
            flashScreen("green");
            callbacksRef.current.onNewOrder?.(data.order);
            break;

          case "STATUS_CHANGED":
            callbacksRef.current.onStatusChange?.(data.status as string);
            break;

          case "SHOP_AUTO_PAUSED":
            playSound("/sounds/alert.wav");
            vibrate();
            flashScreen("red");
            callbacksRef.current.onAutoPaused?.(data.message as string);
            break;

          case "HEARTBEAT":
            setPendingCount((data.pendingCount as number) || 0);
            break;
        }
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
      // EventSource reconnects automatically
    };

    eventSource.onopen = () => {
      setConnected(true);
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [playSound, vibrate, flashScreen]);

  return { connected, pendingCount };
}
