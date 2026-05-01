"use client";

import { useEffect, useState } from "react";

// Renders "Retrait le plus tot : HH:MM" client-side only to avoid hydration
// mismatches caused by Date.now() differing between server and client.
// (audit SEO HIGH #5)
export function EarliestPickupTime({ minutesFromNow }: { minutesFromNow: number }) {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const t = new Date(Date.now() + minutesFromNow * 60_000).toLocaleTimeString(
      "fr-FR",
      { hour: "2-digit", minute: "2-digit" }
    );
    setTime(t);
  }, [minutesFromNow]);

  return (
    <p className="text-xs font-medium text-gray-900 dark:text-gray-300 mt-1">
      Retrait le plus tot :{" "}
      <span className="tabular-nums">{time ?? "--:--"}</span>
    </p>
  );
}
