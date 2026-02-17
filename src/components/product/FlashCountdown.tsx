// src/components/product/FlashCountdown.tsx — Real-time flash promo countdown
"use client";

import { useState, useEffect } from "react";

interface Props {
  promoEnd: string;
  compact?: boolean;
}

function getRemaining(endStr: string) {
  const diff = new Date(endStr).getTime() - Date.now();
  if (diff <= 0) return null;

  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1_000);

  return { hours, minutes, seconds, total: diff };
}

export function FlashCountdown({ promoEnd, compact = false }: Props) {
  const [remaining, setRemaining] = useState(() => getRemaining(promoEnd));

  useEffect(() => {
    const interval = setInterval(() => {
      const r = getRemaining(promoEnd);
      setRemaining(r);
      if (!r) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [promoEnd]);

  if (!remaining) return null;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-orange-600 dark:text-orange-400">
        {remaining.hours > 0 && `${remaining.hours}h `}
        {remaining.minutes}min
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-red-600 to-orange-500 rounded-lg text-white text-[10px] font-bold shadow-sm">
      <span>{"\u23F1"}</span>
      {remaining.hours > 0 && <span>{remaining.hours}h</span>}
      <span>{remaining.minutes}min</span>
      <span className="opacity-70">{remaining.seconds}s</span>
    </div>
  );
}
