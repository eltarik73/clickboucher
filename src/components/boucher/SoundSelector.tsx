// SoundSelector — Pick notification sound (Marimba, Steel Pan, Koto)
"use client";

import { useState } from "react";
import {
  type SoundType,
  SOUND_OPTIONS,
  getSelectedSound,
  setSelectedSound,
  playMarimbaSong,
  playSteelPan,
  playKoto,
} from "@/lib/sounds";

const PLAY_MAP: Record<SoundType, () => void> = {
  marimba: playMarimbaSong,
  steelpan: playSteelPan,
  koto: playKoto,
};

export default function SoundSelector() {
  const [selected, setSelected] = useState<SoundType>(getSelectedSound);

  function handleSelect(sound: SoundType) {
    setSelected(sound);
    setSelectedSound(sound);
    PLAY_MAP[sound]();
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <p className="text-xs text-gray-400 font-medium mb-1">Son de notification</p>
      <div className="flex gap-2">
        {SOUND_OPTIONS.map((opt) => {
          const active = selected === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => handleSelect(opt.key)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all ${
                active
                  ? "border-[#DC2626] bg-[#DC2626]/10 ring-2 ring-[#DC2626]"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <span className="text-2xl">{opt.emoji}</span>
              <span
                className={`text-[11px] font-semibold leading-tight text-center ${
                  active ? "text-white" : "text-gray-400"
                }`}
              >
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
