// src/app/(boucher)/boucher/commandes/PauseModal.tsx — choose how long to suspend orders
// (15, 30 or 60 min). Mounted on each opening, so the choice starts at 15 min every time.
"use client";

import { useState } from "react";

type Props = {
  onClose: () => void;
  onConfirm: (durationMin: number) => void;
};

export default function PauseModal({ onClose, onConfirm }: Props) {
  const [selectedPauseDuration, setSelectedPauseDuration] = useState(15);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm space-y-5 rounded-2xl border border-[#3F3F46] bg-[#1C1C1E] p-6"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: "Outfit, sans-serif" }}
      >
        <div>
          <h3 className="text-lg font-bold text-white">Suspendre les commandes</h3>
          <p className="mt-1 text-sm text-[#78716C]">
            Les clients verront que votre boutique est temporairement indisponible.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[15, 30, 60].map((min) => (
            <button
              key={min}
              onClick={() => setSelectedPauseDuration(min)}
              className={`rounded-xl border py-4 text-center transition-all ${
                selectedPauseDuration === min
                  ? "border-[#F59E0B] bg-[#F59E0B]/10 text-[#F59E0B]"
                  : "border-[#3F3F46] bg-white/5 text-gray-500 hover:bg-white/10 dark:text-gray-400"
              }`}
            >
              <span className="block text-2xl font-bold">{min}</span>
              <span className="mt-0.5 block text-xs opacity-70">minutes</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => onConfirm(selectedPauseDuration)}
          className="w-full rounded-xl bg-[#F59E0B] py-3.5 text-sm font-bold text-black transition-colors hover:bg-[#D97706]"
        >
          Suspendre pendant {selectedPauseDuration} min
        </button>
        <button
          onClick={onClose}
          className="w-full rounded-xl py-2.5 text-sm text-[#78716C] transition-colors hover:text-white"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
