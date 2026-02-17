// src/components/landing/CalendarBanner.tsx — Religious event banner for clients
"use client";

import { useMemo } from "react";
import Link from "next/link";

// Hardcoded upcoming events (same as boucher calendar)
const EVENTS = [
  { name: "Ramadan", date: "2025-03-01", endDate: "2025-03-30", emoji: "🌙", type: "ramadan", link: "Préparez vos commandes" },
  { name: "Aïd el-Fitr", date: "2025-03-31", emoji: "🎉", type: "aid", link: "Commandez pour la fête" },
  { name: "Aïd el-Adha", date: "2025-06-07", emoji: "🐑", type: "aid-adha", link: "Commandez votre mouton" },
  { name: "Ramadan", date: "2026-02-18", endDate: "2026-03-19", emoji: "🌙", type: "ramadan", link: "Préparez vos commandes" },
  { name: "Aïd el-Fitr", date: "2026-03-20", emoji: "🎉", type: "aid", link: "Commandez pour la fête" },
  { name: "Aïd el-Adha", date: "2026-05-27", emoji: "🐑", type: "aid-adha", link: "Commandez votre mouton" },
];

export default function CalendarBanner() {
  const upcoming = useMemo(() => {
    const now = Date.now();
    return EVENTS.filter((e) => {
      const days = Math.ceil((new Date(e.date).getTime() - now) / (1000 * 60 * 60 * 24));
      // Show banner 21 days before and during the event
      const endDays = e.endDate
        ? Math.ceil((new Date(e.endDate).getTime() - now) / (1000 * 60 * 60 * 24))
        : days;
      return days <= 21 && endDays >= 0;
    }).slice(0, 1);
  }, []);

  if (upcoming.length === 0) return null;

  const event = upcoming[0];
  const days = Math.ceil((new Date(event.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isOngoing = days <= 0;

  const bgColor = event.type === "ramadan"
    ? "bg-gradient-to-r from-indigo-900 to-purple-900"
    : event.type === "aid-adha"
    ? "bg-gradient-to-r from-emerald-800 to-teal-900"
    : "bg-gradient-to-r from-amber-700 to-orange-800";

  return (
    <div className={`${bgColor} rounded-2xl p-5 text-white overflow-hidden relative`}>
      <div className="absolute top-0 right-0 text-6xl opacity-20 -mr-2 -mt-2">{event.emoji}</div>
      <div className="relative z-10">
        <p className="text-xs font-medium opacity-80 uppercase tracking-wider">
          {isOngoing ? "En cours" : `Dans ${days} jour${days > 1 ? "s" : ""}`}
        </p>
        <h3 className="text-lg font-bold mt-1">
          {event.emoji} {event.name} {isOngoing ? "" : "approche !"}
        </h3>
        <p className="text-sm opacity-90 mt-1">{event.link}</p>
        <Link
          href="/decouvrir#butchers"
          className="inline-block mt-3 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors"
        >
          Voir les boucheries
        </Link>
      </div>
    </div>
  );
}
