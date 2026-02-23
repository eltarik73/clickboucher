// useWakeLock — Prevent screen from sleeping (kitchen mode)
// Requests Wake Lock on mount, releases on unmount
// Re-requests on visibilitychange (lost when tab goes background)
"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export function useWakeLock() {
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(true);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = useCallback(async () => {
    if (!("wakeLock" in navigator)) {
      setSupported(false);
      return;
    }

    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      setActive(true);

      wakeLockRef.current.addEventListener("release", () => {
        setActive(false);
      });
    } catch {
      // Permission denied or other error
      setActive(false);
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // Already released
      }
      wakeLockRef.current = null;
      setActive(false);
    }
  }, []);

  useEffect(() => {
    // Request on mount
    requestWakeLock();

    // Re-request when tab becomes visible again (wake lock is lost on background)
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseWakeLock();
    };
  }, [requestWakeLock, releaseWakeLock]);

  return { active, supported };
}
