// src/app/(boucher)/boucher/commandes/KitchenTopBar.tsx — the kitchen's top bar: logo and shop
// name, online toggle and pause, then clock, sound, simple mode, scanner, connection and settings.
"use client";

import { useEffect, useState } from "react";
import {
  LayoutGrid,
  Pause,
  ScanLine,
  Settings,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { KitchenShop } from "./use-shop-status";

type Props = {
  shop: KitchenShop;
  onOpenPause: () => void;
  muted: boolean;
  onToggleMuted: () => void;
  simpleMode: boolean;
  onToggleSimpleMode: () => void;
  onOpenScanner: () => void;
  connected: boolean;
};

export default function KitchenTopBar({
  shop,
  onOpenPause,
  muted,
  onToggleMuted,
  simpleMode,
  onToggleSimpleMode,
  onOpenScanner,
  connected,
}: Props) {
  const online = shop.status === "OPEN" || shop.status === "BUSY";

  // Live clock (ticks every second), read only after mount: none in the server render
  const [clockStr, setClockStr] = useState<string | null>(null);
  useEffect(() => {
    const tick = () =>
      setClockStr(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <header className="flex shrink-0 items-center justify-between gap-1.5 border-b border-white/5 bg-[#111] px-2 py-1.5 sm:gap-3 sm:px-4 sm:py-2">
      {/* Section gauche — Logo + Nom boutique */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <a href="/boucher/dashboard" className="flex shrink-0 items-center gap-2">
          <div className="flex h-[24px] w-[24px] items-center justify-center rounded-md bg-[#DC2626] sm:h-[26px] sm:w-[26px]">
            <span className="text-[10px] font-black leading-none text-white sm:text-xs">K</span>
          </div>
          <span className="hidden text-sm font-bold text-white sm:inline">
            Klik<span className="text-[#DC2626]">&amp;</span>Go
          </span>
        </a>
        {shop.name && (
          <>
            <div className="hidden h-5 w-px shrink-0 bg-white/10 sm:block" />
            <span className="hidden truncate text-xs text-[#78716C] sm:inline">{shop.name}</span>
          </>
        )}
      </div>

      {/* Section centre — Contrôles */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Toggle En ligne / Hors ligne */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => shop.setStatus({ action: online ? "close" : "resume" })}
            className="relative h-5 w-9 rounded-full transition-colors duration-200 focus:outline-none sm:h-6 sm:w-11"
            style={{ backgroundColor: online ? "#16A34A" : "#3F3F46" }}
          >
            <span
              className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 sm:h-5 sm:w-5"
              style={{ transform: online ? "translateX(16px)" : "translateX(0)" }}
            />
          </button>
          <div className="hidden sm:block">
            <span className={`text-xs font-bold ${online ? "text-[#16A34A]" : "text-[#78716C]"}`}>
              {online ? "En ligne" : "Hors ligne"}
            </span>
            <span className="block text-[10px] text-[#57534E]">Auto 8h-19h</span>
          </div>
        </div>

        {/* Séparateur */}
        <div className="h-5 w-px shrink-0 bg-[#262626] sm:h-6" />

        {/* Bouton Pause */}
        {shop.status === "PAUSED" ? (
          <button
            onClick={() => shop.setStatus({ action: "resume" })}
            className="flex min-h-[32px] animate-pulse items-center gap-1 rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/20 px-2 py-1 text-[10px] font-bold text-[#F59E0B] transition-all hover:bg-[#F59E0B]/30 sm:min-h-[36px] sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs"
          >
            <Pause size={10} className="sm:h-3 sm:w-3" />{" "}
            <span className="hidden sm:inline">{shop.pauseCountdown || "En pause"}</span>
            <span className="sm:hidden">{shop.pauseCountdown || "Pause"}</span>
          </button>
        ) : (
          <button
            onClick={onOpenPause}
            className="flex min-h-[32px] items-center gap-1 rounded-lg border border-[#3F3F46] bg-[#1C1C1E] px-2 py-1 text-[10px] font-bold text-[#F59E0B] transition-all hover:bg-[#262626] sm:min-h-[36px] sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs"
          >
            <Pause size={10} className="sm:h-3 sm:w-3" /> Pause
          </button>
        )}
      </div>

      {/* Section droite — Horloge + icônes */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Horloge */}
        {clockStr !== null && (
          <span className="text-xs font-bold tabular-nums text-white sm:text-sm lg:text-xl">
            {clockStr}
          </span>
        )}

        {/* Sound toggle */}
        <button
          onClick={onToggleMuted}
          className={`flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg transition-colors sm:min-h-[36px] sm:min-w-[36px] ${
            muted
              ? "bg-red-500/20 text-red-400"
              : "bg-white/5 text-gray-500 hover:text-white dark:text-gray-400"
          }`}
          title={muted ? "Son désactivé" : "Son activé"}
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>

        {/* Simple mode toggle */}
        <button
          onClick={onToggleSimpleMode}
          className={`hidden min-h-[36px] min-w-[36px] items-center justify-center rounded-lg transition-colors sm:flex ${
            simpleMode
              ? "bg-amber-500/20 text-amber-400"
              : "bg-white/5 text-gray-500 hover:text-white dark:text-gray-400"
          }`}
          title={simpleMode ? "Mode simple actif" : "Passer en mode simple"}
        >
          <LayoutGrid size={14} />
        </button>

        {/* QR Scanner — hidden on small phones, visible on tablets+ */}
        <button
          onClick={onOpenScanner}
          className="hidden min-h-[36px] min-w-[36px] items-center justify-center rounded-lg bg-white/5 text-gray-500 transition-colors hover:bg-white/10 hover:text-white dark:text-gray-400 sm:flex"
          title="Scanner QR"
        >
          <ScanLine size={16} />
        </button>

        {/* Connection status */}
        <div className="flex min-h-[32px] min-w-[24px] items-center justify-center sm:min-h-[36px] sm:min-w-[36px]">
          {connected ? (
            <Wifi size={12} className="text-emerald-400 sm:h-[14px] sm:w-[14px]" />
          ) : (
            <WifiOff size={12} className="animate-pulse text-red-400 sm:h-[14px] sm:w-[14px]" />
          )}
        </div>

        {/* Settings — hidden on small phones */}
        <a
          href="/boucher/parametres"
          className="hidden min-h-[36px] min-w-[36px] items-center justify-center rounded-lg bg-white/5 text-gray-500 transition-colors hover:bg-white/10 hover:text-white dark:text-gray-400 sm:flex"
          title="Parametres"
        >
          <Settings size={16} />
        </a>
      </div>
    </header>
  );
}
