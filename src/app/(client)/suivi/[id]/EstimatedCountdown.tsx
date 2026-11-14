"use client";

import { useEffect, useState } from "react";
import { formatParisTime } from "./TrackingTimeline";

const BOX = "rounded-2xl border p-5 text-center";
const LABEL = "mb-1 text-xs font-medium";
const DIGITS = "text-3xl font-black tabular-nums tracking-tight";

/**
 * Countdown to the estimated pickup time. The clock is read only after mount: the server render
 * and the first browser render show the same thing (the pickup time, in a neutral box of the same
 * height), and the countdown with its on-time / late wording appears once the browser runs.
 */
export default function EstimatedCountdown({ estimatedReady }: { estimatedReady: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  const pickupTime = (
    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
      {`Retrait estimé : ${formatParisTime(estimatedReady)}`}
    </p>
  );

  if (now === null) {
    return (
      <div className={`${BOX} border-gray-200 bg-white dark:border-white/10 dark:bg-[#141414]`}>
        <p className={LABEL} aria-hidden="true">
          {" "}
        </p>
        <p className={DIGITS} aria-hidden="true">
          {" "}
        </p>
        {pickupTime}
      </div>
    );
  }

  const diffMs = new Date(estimatedReady).getTime() - now;
  const isLate = diffMs < 0;
  const absDiff = Math.abs(diffMs);
  const minutes = Math.floor(absDiff / 60_000);
  const seconds = Math.floor((absDiff % 60_000) / 1000);

  return (
    <div
      className={`${BOX} ${
        isLate
          ? "border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/20"
          : "border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-900/20"
      }`}
    >
      <p
        className={`${LABEL} ${isLate ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"}`}
      >
        {isLate ? "Retrait estimé dépassé de" : "Prête dans environ"}
      </p>
      <p
        className={`${DIGITS} ${
          isLate ? "text-amber-800 dark:text-amber-300" : "text-blue-800 dark:text-blue-300"
        }`}
      >
        {minutes > 0 ? `${minutes} min ${seconds.toString().padStart(2, "0")}s` : `${seconds}s`}
      </p>
      {pickupTime}
    </div>
  );
}
