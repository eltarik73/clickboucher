// src/hooks/use-seconds-until.ts — the countdown of a customer's answer window, on his banner and
// on the butcher's kitchen card. A local clock only: it never calls the network.
"use client";

import { useEffect, useState } from "react";

/**
 * Whole seconds left until `deadlineMs` (epoch milliseconds), rounded up and never below 0, one
 * tick per second. Null before mount, so no clock is read in the server render, and without a
 * deadline. The interval stops at 0 and on unmount.
 */
export function useSecondsUntil(deadlineMs: number | null): number | null {
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    if (deadlineMs === null) {
      setSeconds(null);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
      setSeconds(left);
      return left;
    };
    if (tick() === 0) return;
    const timer = setInterval(() => {
      if (tick() === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [deadlineMs]);
  return seconds;
}

/** "4:05": minutes, then seconds on two digits. */
export function formatMinutesSeconds(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
