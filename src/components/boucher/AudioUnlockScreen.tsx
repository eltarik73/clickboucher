// AudioUnlockScreen — Full-screen overlay requiring user gesture to unlock iOS audio
"use client";

import { useState } from "react";
import { Volume2, Loader2 } from "lucide-react";
import { soundManager } from "@/lib/notification-sound";
import { playSelectedSound } from "@/lib/sounds";
import SoundSelector from "@/components/boucher/SoundSelector";

type Props = {
  onUnlocked: () => void;
};

export default function AudioUnlockScreen({ onUnlocked }: Props) {
  const [unlocking, setUnlocking] = useState(false);

  async function handleUnlock() {
    setUnlocking(true);
    // Unlock iOS AudioContext first (user gesture required)
    await soundManager.unlock();
    // Play the selected sound as confirmation
    playSelectedSound();
    // Mark as unlocked for this session
    sessionStorage.setItem("audioUnlocked", "true");
    onUnlocked();
  }

  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col items-center justify-center gap-8 p-6">
      {/* Marimba icon */}
      <div className="text-7xl">🪘</div>

      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-white">Alertes sonores</h1>
        <p className="text-gray-400 text-sm max-w-xs">
          Choisissez votre melodie puis activez le son pour recevoir les alertes
        </p>
      </div>

      {/* Sound selector */}
      <div className="w-full max-w-sm">
        <SoundSelector />
      </div>

      {/* Big unlock button */}
      <button
        onClick={handleUnlock}
        disabled={unlocking}
        className="flex items-center gap-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xl font-bold px-10 h-16 rounded-2xl transition-all shadow-lg shadow-emerald-900/40 disabled:opacity-50"
      >
        {unlocking ? (
          <Loader2 size={28} className="animate-spin" />
        ) : (
          <Volume2 size={28} />
        )}
        <span>{unlocking ? "Activation..." : "ACTIVER LE SON"}</span>
      </button>

      <p className="text-gray-600 text-xs text-center max-w-xs">
        Requis sur iPad/iPhone pour que les sons de notification fonctionnent
      </p>
    </div>
  );
}
