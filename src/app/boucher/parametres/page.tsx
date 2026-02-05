"use client";

import { useState } from "react";
import { Card, Toggle } from "@/components/ui/shared";

export default function BoucherParametresPage() {
  const [serviceOn, setServiceOn] = useState(true);
  const [prepBonus, setPrepBonus] = useState(0);

  return (
    <div className="animate-fade-up flex flex-col gap-4">
      <h2 className="font-display text-xl font-bold">Réglages boutique</h2>

      {/* Service toggle */}
      <Card className="p-5">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm font-semibold">Service Click & Collect</p>
            <p className="text-xs text-stone-500 mt-0.5">
              Active ou désactive les commandes en ligne
            </p>
          </div>
          <Toggle on={serviceOn} onToggle={() => setServiceOn(!serviceOn)} />
        </div>
      </Card>

      {/* Prep time bonus */}
      <Card className="p-5">
        <p className="text-sm font-semibold">Temps de prépa additionnel</p>
        <p className="text-xs text-stone-500 mt-0.5">
          Ajoute du temps si tu es débordé
        </p>
        <div className="flex gap-2.5 mt-4">
          {[0, 5, 10, 15].map((m) => (
            <button
              key={m}
              onClick={() => setPrepBonus(m)}
              className={`flex-1 py-3 rounded-[10px] text-sm font-semibold transition-all ${
                prepBonus === m
                  ? "border-2 border-[#7A1023] bg-[#FDF2F4] text-[#7A1023]"
                  : "border border-stone-200 bg-white text-stone-900 hover:bg-stone-50"
              }`}
            >
              {m === 0 ? "Normal" : `+${m} min`}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
