// src/components/shop/offers/ButcherOfferForm.tsx — Simplified offer creation form for boucher
"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Gift,
  Zap,
  Wand2,
  Percent,
  DollarSign,
  Truck,
  Copy,
  Package,
  Loader2,
  Users,
  UserPlus,
  Heart,
  Crown,
} from "lucide-react";
import { toast } from "sonner";

const OFFER_TYPES = [
  { value: "PERCENT", label: "Pourcentage", icon: Percent, color: "blue" },
  { value: "AMOUNT", label: "Montant fixe", icon: DollarSign, color: "emerald" },
  { value: "FREE_DELIVERY", label: "Frais offerts", icon: Truck, color: "purple" },
  { value: "BOGO", label: "1+1 offert", icon: Copy, color: "orange" },
  { value: "BUNDLE", label: "Pack", icon: Package, color: "pink" },
] as const;

const AUDIENCES = [
  { value: "ALL", label: "Tous", icon: Users },
  { value: "NEW", label: "Nouveaux", icon: UserPlus },
  { value: "LOYAL", label: "Fidèles", icon: Heart },
  { value: "VIP", label: "VIP", icon: Crown },
] as const;

function colorClasses(color: string, selected: boolean) {
  if (!selected) {
    return "border-gray-100 dark:border-white/10 bg-white dark:bg-[#141414] hover:border-gray-200 dark:hover:border-white/20";
  }
  switch (color) {
    case "blue":
      return "border-blue-400 dark:border-blue-500/60 bg-blue-50 dark:bg-blue-500/10";
    case "emerald":
      return "border-emerald-400 dark:border-emerald-500/60 bg-emerald-50 dark:bg-emerald-500/10";
    case "purple":
      return "border-purple-400 dark:border-purple-500/60 bg-purple-50 dark:bg-purple-500/10";
    case "orange":
      return "border-orange-400 dark:border-orange-500/60 bg-orange-50 dark:bg-orange-500/10";
    case "pink":
      return "border-pink-400 dark:border-pink-500/60 bg-pink-50 dark:bg-pink-500/10";
    default:
      return "border-red-400 dark:border-red-500/60 bg-red-50 dark:bg-red-500/10";
  }
}

function iconColor(color: string, selected: boolean) {
  if (!selected) return "text-gray-500 dark:text-gray-400";
  switch (color) {
    case "blue":
      return "text-blue-600 dark:text-blue-400";
    case "emerald":
      return "text-emerald-600 dark:text-emerald-400";
    case "purple":
      return "text-purple-600 dark:text-purple-400";
    case "orange":
      return "text-orange-600 dark:text-orange-400";
    case "pink":
      return "text-pink-600 dark:text-pink-400";
    default:
      return "text-gray-600 dark:text-gray-400";
  }
}

function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "KG-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateName(type: string) {
  switch (type) {
    case "PERCENT":
      return "Réduction spéciale";
    case "AMOUNT":
      return "Bon de réduction";
    case "FREE_DELIVERY":
      return "Frais de service offerts";
    case "BOGO":
      return "Offre 1 acheté = 1 offert";
    case "BUNDLE":
      return "Pack découverte";
    default:
      return "Offre spéciale";
  }
}

export function ButcherOfferForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("PERCENT");
  const [discountValue, setDiscountValue] = useState<number>(10);
  const [minOrder, setMinOrder] = useState<number>(0);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [maxUses, setMaxUses] = useState<number | "">("");
  const [audience, setAudience] = useState("ALL");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Le nom de l'offre est requis");
      return;
    }
    if (!code.trim()) {
      toast.error("Le code promo est requis");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Les dates sont requises");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/shop/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          type,
          discountValue,
          minOrder,
          payer: "BUTCHER",
          audience,
          startDate,
          endDate,
          maxUses: maxUses === "" ? null : maxUses,
          diffBadge: true,
          diffBanner: false,
          diffPopup: false,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error?.message || "Erreur lors de la création");
      }

      toast.success("Offre créée avec succès !");
      onCreated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-xl bg-white dark:bg-[#141414] border border-gray-100 dark:border-white/10 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
        >
          <ArrowLeft size={16} className="text-gray-600 dark:text-gray-400" />
        </button>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
          <Gift size={20} className="text-white" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">
          Créer une offre
        </h1>
      </div>

      {/* Form card */}
      <div className="max-w-2xl mx-auto bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 p-5 md:p-6 space-y-6">
        {/* Type selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Type d&apos;offre
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {OFFER_TYPES.map((t) => {
              const selected = type === t.value;
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${colorClasses(t.color, selected)}`}
                >
                  <Icon size={18} className={iconColor(t.color, selected)} />
                  <span
                    className={`text-[11px] font-medium leading-tight text-center ${
                      selected
                        ? "text-gray-900 dark:text-white"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Name + auto-generate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Nom de l&apos;offre
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Promo week-end"
              className="flex-1 px-3.5 py-2.5 text-sm bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-500 dark:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => setName(generateName(type))}
              className="shrink-0 px-3 py-2.5 text-xs font-medium bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 rounded-xl text-gray-600 dark:text-gray-400 transition-colors"
              title="Générer un nom"
            >
              <Wand2 size={14} />
            </button>
          </div>
        </div>

        {/* Code + auto-generate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Code promo
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="EX: PROMO20"
              className="flex-1 px-3.5 py-2.5 text-sm font-mono uppercase bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-500 dark:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors tracking-wider"
            />
            <button
              type="button"
              onClick={() => setCode(generateCode())}
              className="shrink-0 px-3 py-2.5 text-xs font-medium bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 rounded-xl text-gray-600 dark:text-gray-400 transition-colors"
              title="Générer un code"
            >
              <Wand2 size={14} />
            </button>
          </div>
        </div>

        {/* Discount value + min order (2-col) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {type === "PERCENT" ? "Réduction (%)" : type === "AMOUNT" ? "Montant (\u20AC)" : "Valeur"}
            </label>
            <input
              type="number"
              min={0}
              step={type === "PERCENT" ? 1 : 0.01}
              value={discountValue}
              onChange={(e) => setDiscountValue(Number(e.target.value))}
              disabled={type === "FREE_DELIVERY"}
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-500 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Commande min (&euro;)
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={minOrder}
              onChange={(e) => setMinOrder(Number(e.target.value))}
              placeholder="0"
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-500 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors"
            />
          </div>
        </div>

        {/* Dates (2-col) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Date début
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Date fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors"
            />
          </div>
        </div>

        {/* Max uses */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Utilisations max
            <span className="ml-1 text-xs text-gray-500 dark:text-gray-400 font-normal">
              (laisser vide = illimité)
            </span>
          </label>
          <input
            type="number"
            min={1}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="Illimité"
            className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-500 dark:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors"
          />
        </div>

        {/* Audience */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Audience
          </label>
          <div className="grid grid-cols-4 gap-2">
            {AUDIENCES.map((a) => {
              const selected = audience === a.value;
              const Icon = a.icon;
              return (
                <button
                  key={a.value}
                  onClick={() => setAudience(a.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    selected
                      ? "border-red-400 dark:border-red-500/60 bg-red-50 dark:bg-red-500/10"
                      : "border-gray-100 dark:border-white/10 bg-white dark:bg-[#0A0A0A] hover:border-gray-200 dark:hover:border-white/20"
                  }`}
                >
                  <Icon
                    size={16}
                    className={
                      selected
                        ? "text-red-600 dark:text-red-400"
                        : "text-gray-500 dark:text-gray-400"
                    }
                  />
                  <span
                    className={`text-[11px] font-medium ${
                      selected
                        ? "text-gray-900 dark:text-white"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {a.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Zap size={16} />
          )}
          Publier
        </button>
      </div>
    </div>
  );
}
