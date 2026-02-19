// AudioUnlockScreen — Full-screen overlay requiring user gesture to unlock iOS audio
"use client";

import { useState } from "react";
import { Volume2, Loader2 } from "lucide-react";
import { soundManager } from "@/lib/notification-sound";

type Props = {
  onUnlocked: () => void;
};

export default function AudioUnlockScreen({ onUnlocked }: Props) {
  const [unlocking, setUnlocking] = useState(false);

  async function handleUnlock() {
    setUnlocking(true);
    const ok = await soundManager.unlock();
    if (ok) {
      // Play a small confirmation beep
      soundManager.play("tick", 0.3);
    }
    // Even if unlock fails, let user proceed
    onUnlocked();
  }

  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col items-center justify-center gap-8 p-6">
      {/* Logo */}
      <div className="w-20 h-20 bg-[#DC2626] rounded-2xl flex items-center justify-center shadow-lg shadow-red-900/30">
        <span className="text-white font-black text-3xl">K</span>
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-white">Mode Cuisine</h1>
        <p className="text-gray-400 text-sm max-w-xs">
          Activez le son pour recevoir les alertes de nouvelles commandes
        </p>
      </div>

      {/* Big unlock button */}
      <button
        onClick={handleUnlock}
        disabled={unlocking}
        className="flex items-center gap-4 bg-[#DC2626] hover:bg-[#b91c1c] active:scale-95 text-white text-lg font-bold px-10 py-5 rounded-2xl transition-all shadow-lg shadow-red-900/40 disabled:opacity-50"
      >
        {unlocking ? (
          <Loader2 size={28} className="animate-spin" />
        ) : (
          <Volume2 size={28} />
        )}
        <span>{unlocking ? "Activation..." : "Activer les alertes sonores"}</span>
      </button>

      <p className="text-gray-600 text-xs text-center max-w-xs">
        Requis sur iPad/iPhone pour que les sons de notification fonctionnent
      </p>
    </div>
  );
}
