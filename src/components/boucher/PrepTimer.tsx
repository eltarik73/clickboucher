// PrepTimer — Countdown timer for kitchen orders
"use client";

import { useEffect, useState } from "react";

type Props = {
  estimatedReady: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
};

export default function PrepTimer({ estimatedReady, className = "", size = "md" }: Props) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!estimatedReady) {
      setRemaining(null);
      return;
    }

    function tick() {
      const diff = new Date(estimatedReady!).getTime() - Date.now();
      setRemaining(Math.ceil(diff / 60_000));
    }

    tick();
    const interval = setInterval(tick, 10_000); // Update every 10s
    return () => clearInterval(interval);
  }, [estimatedReady]);

  if (remaining === null) return null;

  const isOverdue = remaining < 0;
  const absMin = Math.abs(remaining);
  const hours = Math.floor(absMin / 60);
  const mins = absMin % 60;

  const display = hours > 0
    ? `${hours}h${String(mins).padStart(2, "0")}`
    : `${mins} min`;

  const sizeClasses = {
    sm: "text-sm px-2 py-1 rounded-lg",
    md: "text-lg px-3 py-1.5 rounded-xl font-mono font-bold",
    lg: "text-2xl px-4 py-2 rounded-xl font-mono font-black",
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${sizeClasses[size]} ${
        isOverdue
          ? "bg-red-500/20 text-red-400 animate-pulse"
          : remaining <= 5
          ? "bg-amber-500/20 text-amber-400"
          : "bg-blue-500/15 text-blue-400"
      } ${className}`}
    >
      {isOverdue ? "+" : ""}
      {display}
      {isOverdue && (
        <span className="text-[10px] font-normal opacity-70">retard</span>
      )}
    </div>
  );
}
