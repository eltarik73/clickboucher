// src/components/order/ReorderSection.tsx — Reorder + Location side by side grid
"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { RotateCcw, ChevronRight, MapPin, Navigation, Loader2 } from "lucide-react";
import { useGeolocation } from "@/hooks/useGeolocation";

interface LastOrder {
  shopName: string;
  shopSlug: string;
  summary: string;
  totalCents: number;
  createdAt: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days}j`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)} sem.`;
  return `Il y a ${Math.floor(days / 30)} mois`;
}

function LocationCard() {
  const geo = useGeolocation();
  const [showInput, setShowInput] = useState(false);
  const [manualInput, setManualInput] = useState("");

  // Notify NearbyShops when location changes
  const { latitude, longitude } = geo;
  useEffect(() => {
    if (latitude != null && longitude != null) {
      window.dispatchEvent(new CustomEvent("klikgo-location", { detail: { lat: latitude, lng: longitude } }));
    }
  }, [latitude, longitude]);

  const handleGPS = async () => {
    await geo.requestGPS();
  };

  const handleManualSubmit = async () => {
    if (!manualInput.trim()) return;
    await geo.setManualCity(manualInput.trim());
    setShowInput(false);
    setManualInput("");
  };

  return (
    <div className="bg-white dark:bg-white/[0.03] rounded-2xl p-3.5 border border-[#ece8e3] dark:border-white/[0.06] shadow-sm">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-9 h-9 rounded-[10px] bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
          <MapPin size={18} className="text-red-600" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-[13px] text-gray-900 dark:text-white">Votre position</div>
          <div className="text-[11px] text-gray-400">
            {geo.city || "Activez pour voir les proches"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-white/5">
        {geo.city ? (
          <>
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1">
              <MapPin size={12} className="inline text-red-600 mr-1" />
              {geo.city}
            </span>
            <button
              onClick={() => { geo.clear(); window.dispatchEvent(new CustomEvent("klikgo-location", { detail: { lat: null, lng: null } })); }}
              className="text-[11px] text-gray-400 hover:text-red-600 transition font-semibold"
            >
              Modifier
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleGPS}
              disabled={geo.loading}
              className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-2 rounded-[10px] transition-colors disabled:opacity-50"
            >
              {geo.loading ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
              {geo.loading ? "..." : "Activer GPS"}
            </button>
            <button
              onClick={() => setShowInput(!showInput)}
              className="text-gray-500 text-[11px] font-semibold border border-gray-200 dark:border-white/[0.06] rounded-lg px-2.5 py-1.5 hover:border-gray-300 transition"
            >
              Saisir ville
            </button>
          </>
        )}
      </div>
      {geo.error && (
        <p className="text-[11px] text-red-500 mt-1.5">{geo.error}</p>
      )}
      {showInput && !geo.city && (
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
            placeholder="Ex: Chambéry, Lyon..."
            className="flex-1 px-3 py-1.5 text-xs border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-red-500"
            autoFocus
          />
          <button
            onClick={handleManualSubmit}
            disabled={!manualInput.trim() || geo.loading}
            className="px-3 py-1.5 bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-xs font-medium rounded-lg hover:opacity-90 transition disabled:opacity-50"
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}

export function ReorderSection() {
  const { isSignedIn } = useUser();
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;

    (async () => {
      try {
        const res = await fetch("/api/orders");
        if (!res.ok) return;
        const json = await res.json();
        const data = json.data || json || [];

        for (const o of data) {
          if (!["COMPLETED", "PICKED_UP"].includes(o.status)) continue;
          const items = o.items || [];
          const names = items.slice(0, 3).map((i: { name: string }) => i.name);
          const summary = names.join(", ") + (items.length > 3 ? ` +${items.length - 3}` : "");

          setLastOrder({
            shopName: o.shop?.name || "",
            shopSlug: o.shop?.slug || "",
            summary,
            totalCents: o.totalCents,
            createdAt: o.createdAt,
          });
          break;
        }
      } catch {}
    })();
  }, [isSignedIn]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
      {/* Reorder card */}
      {lastOrder ? (
        <Link
          href={`/boutique/${lastOrder.shopSlug}`}
          className="bg-white dark:bg-white/[0.03] rounded-2xl p-3.5 border border-[#ece8e3] dark:border-white/[0.06] shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
        >
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-[10px] bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
              <RotateCcw size={18} className="text-red-600" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[13px] text-gray-900 dark:text-white group-hover:text-[#DC2626] transition-colors">Commander à nouveau</div>
              <div className="text-[11px] text-gray-400 truncate">{lastOrder.shopName} · {timeAgo(lastOrder.createdAt)}</div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-white/5">
            <span className="text-xs text-gray-400 truncate">{lastOrder.summary}</span>
            <span className="flex items-center gap-0.5 text-red-600 text-[13px] font-bold flex-shrink-0">
              {(lastOrder.totalCents / 100).toFixed(2).replace(".", ",")} € <ChevronRight size={14} />
            </span>
          </div>
        </Link>
      ) : (
        <div className="bg-white dark:bg-white/[0.03] rounded-2xl p-3.5 border border-[#ece8e3] dark:border-white/[0.06] shadow-sm flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
            <RotateCcw size={18} className="text-red-600" />
          </div>
          <div>
            <div className="font-bold text-[13px] text-gray-900 dark:text-white">Commander à nouveau</div>
            <div className="text-[11px] text-gray-400">Passez votre première commande</div>
          </div>
        </div>
      )}

      {/* Location card */}
      <LocationCard />
    </div>
  );
}
