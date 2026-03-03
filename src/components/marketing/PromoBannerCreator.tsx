// src/components/marketing/PromoBannerCreator.tsx — Stub (used by images pages)
"use client";

import { useState } from "react";
import { Palette, Download } from "lucide-react";

const TEMPLATES = [
  { name: "Rouge Feu", gradient: "from-red-600 to-red-800", text: "white" },
  { name: "Or Premium", gradient: "from-amber-500 to-orange-600", text: "white" },
  { name: "Émeraude", gradient: "from-emerald-600 to-teal-700", text: "white" },
  { name: "Nuit", gradient: "from-gray-900 to-gray-700", text: "white" },
  { name: "Bleu Royal", gradient: "from-blue-600 to-indigo-700", text: "white" },
  { name: "Sunset", gradient: "from-pink-500 to-rose-600", text: "white" },
];

export default function PromoBannerCreator() {
  const [title, setTitle] = useState("Votre Offre Spéciale");
  const [subtitle, setSubtitle] = useState("Profitez de nos promotions");
  const [tpl, setTpl] = useState(0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {TEMPLATES.map((t, i) => (
          <button
            key={i}
            onClick={() => setTpl(i)}
            className={`h-10 rounded-lg bg-gradient-to-r ${t.gradient} text-white text-xs font-medium border-2 ${
              i === tpl ? "border-red-400 ring-2 ring-red-200" : "border-transparent"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border text-sm"
        placeholder="Titre"
      />
      <input
        value={subtitle}
        onChange={(e) => setSubtitle(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border text-sm"
        placeholder="Sous-titre"
      />
      <div
        id="promo-banner-preview"
        className={`bg-gradient-to-r ${TEMPLATES[tpl].gradient} rounded-xl p-8 text-center`}
      >
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <p className="text-white/80 mt-1">{subtitle}</p>
      </div>
      <p className="text-xs text-gray-400 text-center">
        Utilisez le nouvel outil Marketing Hub pour des bannières avancées
      </p>
    </div>
  );
}
