"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Gift,
  Crown,
  Store,
  Sparkles,
  Wand2,
  Globe,
  UserCheck,
  Heart,
  Tag,
  PanelTop,
  MousePointerClick,
  Mail,
  Eye,
  Shield,
  CheckCircle,
  Check,
  Zap,
  Info,
  Star,
} from "lucide-react";
import { toast } from "sonner";

type Shop = {
  id: string;
  name: string;
  city: string | null;
  rating: number | null;
  _count?: { products: number };
};

type AudienceCounts = {
  total: number;
  newClients: number;
  loyal: number;
  vip: number;
};

const OFFER_TYPES = [
  { value: "BOGO", emoji: "\ud83c\udf81", label: "1+1 Offert", desc: "Achetez 1, recevez 1" },
  { value: "PERCENT", emoji: "\ud83d\udcb0", label: "R\u00e9duction %", desc: "Pourcentage" },
  { value: "AMOUNT", emoji: "\ud83c\udff7\ufe0f", label: "R\u00e9duction \u20ac", desc: "Montant fixe" },
  { value: "FREE_DELIVERY", emoji: "\ud83d\ude80", label: "Frais offerts", desc: "0,99\u20ac offerts" },
  { value: "BUNDLE", emoji: "\ud83d\udce6", label: "Pack", desc: "Offre group\u00e9e" },
];

const AUDIENCES = [
  { value: "ALL", icon: Globe, label: "Tous les clients", countKey: "total" as const, desc: null },
  { value: "NEW", icon: UserCheck, label: "Nouveaux clients", countKey: "newClients" as const, desc: "0 \u00e0 1 commande" },
  { value: "LOYAL", icon: Heart, label: "Fid\u00e8les", countKey: "loyal" as const, desc: "5+ commandes" },
  { value: "VIP", icon: Crown, label: "VIP", countKey: "vip" as const, desc: "10+ commandes" },
];

const BANNER_COLORS = [
  { name: "red", bg: "bg-red-500", ring: "ring-red-400" },
  { name: "black", bg: "bg-gray-900", ring: "ring-gray-600" },
  { name: "green", bg: "bg-emerald-500", ring: "ring-emerald-400" },
  { name: "orange", bg: "bg-orange-500", ring: "ring-orange-400" },
  { name: "blue", bg: "bg-blue-500", ring: "ring-blue-400" },
];

const POPUP_FREQUENCIES = [
  { value: "once_user", label: "1 fois par utilisateur" },
  { value: "once_day", label: "1 fois par jour" },
  { value: "every_visit", label: "Chaque visite" },
];

function getBannerGradient(color: string) {
  switch (color) {
    case "red": return "from-red-600 to-red-500";
    case "black": return "from-gray-900 to-gray-800";
    case "green": return "from-emerald-600 to-emerald-500";
    case "orange": return "from-orange-600 to-orange-500";
    case "blue": return "from-blue-600 to-blue-500";
    default: return "from-red-600 to-red-500";
  }
}

function getBadgePreview(type: string, discountValue: string) {
  const v = parseFloat(discountValue) || 0;
  switch (type) {
    case "FREE_DELIVERY": return "\ud83d\ude80 FRAIS OFFERTS";
    case "PERCENT": return `\ud83d\udcb0 -${v}%`;
    case "BOGO": return "\ud83c\udf81 1+1 OFFERT";
    case "AMOUNT": return `\ud83c\udff7\ufe0f -${v}\u20ac`;
    case "BUNDLE": return `\ud83d\udce6 PACK -${v}\u20ac`;
    default: return "\ud83c\udff7\ufe0f PROMO";
  }
}

function getAudienceValidationText(audience: string, minOrder: string) {
  const min = parseFloat(minOrder) || 0;
  const minText = min > 0 ? ` et un panier minimum de ${min}\u20ac` : "";
  switch (audience) {
    case "ALL": return `Tous les clients peuvent utiliser ce code${minText}.`;
    case "NEW": return `R\u00e9serv\u00e9 aux clients avec 0 ou 1 commande${minText}.`;
    case "LOYAL": return `R\u00e9serv\u00e9 aux clients fid\u00e8les (5+ commandes)${minText}.`;
    case "VIP": return `R\u00e9serv\u00e9 aux clients VIP (10+ commandes)${minText}.`;
    default: return "";
  }
}

function autoGenerateName(type: string, discountValue: string) {
  const v = parseFloat(discountValue) || 0;
  switch (type) {
    case "PERCENT": return `Bienvenue -${v || 10}%`;
    case "AMOUNT": return `R\u00e9duction ${v || 5}\u20ac`;
    case "FREE_DELIVERY": return "Frais offerts";
    case "BOGO": return "1+1 Offert";
    case "BUNDLE": return `Pack sp\u00e9cial -${v || 5}\u20ac`;
    default: return "Offre sp\u00e9ciale";
  }
}

export function OfferForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [payer, setPayer] = useState<"KLIKGO" | "BUTCHER">("KLIKGO");
  const [type, setType] = useState<string>("PERCENT");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrder, setMinOrder] = useState("0");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [audience, setAudience] = useState<string>("ALL");
  const [shopIds, setShopIds] = useState<string[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [audienceCounts, setAudienceCounts] = useState<AudienceCounts | null>(null);
  const [saving, setSaving] = useState(false);

  // Diffusion
  const [diffBadge] = useState(true);
  const [diffBanner, setDiffBanner] = useState(false);
  const [diffPopup, setDiffPopup] = useState(false);

  // Banner
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerSubtitle, setBannerSubtitle] = useState("");
  const [bannerColor, setBannerColor] = useState("red");

  // Popup
  const [popupTitle, setPopupTitle] = useState("");
  const [popupMessage, setPopupMessage] = useState("");
  const [popupColor, setPopupColor] = useState("red");
  const [popupFrequency, setPopupFrequency] = useState("once_user");

  useEffect(() => {
    fetch("/api/shops")
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setShops(json.data);
        else if (Array.isArray(json)) setShops(json);
      })
      .catch(() => {});

    fetch("/api/dashboard/marketing/audiences")
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setAudienceCounts(json.data);
        else setAudienceCounts(json);
      })
      .catch(() => {});
  }, []);

  function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "";
    for (let i = 0; i < 8; i++) result += chars[Math.floor(Math.random() * chars.length)];
    setCode(result);
  }

  function toggleShop(shopId: string) {
    setShopIds((prev) =>
      prev.includes(shopId) ? prev.filter((id) => id !== shopId) : [...prev, shopId]
    );
  }

  async function handleSubmit() {
    if (!name.trim()) { toast.error("Nom requis"); return; }
    if (!code.trim()) { toast.error("Code requis"); return; }
    if (type !== "FREE_DELIVERY" && !discountValue) { toast.error("Valeur de r\u00e9duction requise"); return; }

    setSaving(true);
    try {
      const payload = {
        name,
        code,
        type,
        discountValue: type === "FREE_DELIVERY" ? 0.99 : parseFloat(discountValue) || 0,
        minOrder: parseFloat(minOrder) || 0,
        payer,
        audience,
        startDate,
        endDate,
        maxUses: maxUses ? parseInt(maxUses) : null,
        shopId: payer === "BUTCHER" && shopIds.length === 1 ? shopIds[0] : null,
        diffBadge,
        diffBanner,
        diffPopup,
        bannerTitle: diffBanner ? bannerTitle : null,
        bannerSubtitle: diffBanner ? bannerSubtitle : null,
        bannerColor: diffBanner ? bannerColor : null,
        popupTitle: diffPopup ? popupTitle : null,
        popupMessage: diffPopup ? popupMessage : null,
        popupColor: diffPopup ? popupColor : null,
        popupFrequency: diffPopup ? popupFrequency : null,
      };

      const res = await fetch("/api/dashboard/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "Erreur");
        return;
      }

      if (payer === "BUTCHER" && shopIds.length > 0) {
        await fetch(`/api/dashboard/offers/${json.data.id}/propose`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shopIds }),
        });
      }

      toast.success("Offre cr\u00e9\u00e9e !");
      onCreated();
    } catch {
      toast.error("Erreur r\u00e9seau");
    } finally {
      setSaving(false);
    }
  }

  // ── Helpers for summary ──
  const discountBadgeText = type === "FREE_DELIVERY"
    ? "0,99\u20ac"
    : type === "PERCENT"
    ? `${discountValue || 0}%`
    : type === "BOGO"
    ? "1+1"
    : `${discountValue || 0}\u20ac`;

  const typeLabel = OFFER_TYPES.find((t) => t.value === type)?.label || type;
  const audienceLabel = AUDIENCES.find((a) => a.value === audience)?.label || audience;
  const min = parseFloat(minOrder) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
          <Gift className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nouvelle offre</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Cr\u00e9ez une offre promotionnelle</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ═══════════════ LEFT COLUMN ═══════════════ */}
        <div className="lg:col-span-2 space-y-5">

          {/* ── Section 1: Qui finance ? ── */}
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Qui finance l&apos;offre ?
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPayer("KLIKGO")}
                className={`rounded-xl border-2 p-4 text-left transition-all ${
                  payer === "KLIKGO"
                    ? "border-red-300 dark:border-red-500/50 bg-red-50/50 dark:bg-red-500/10"
                    : "border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20"
                }`}
              >
                <div className="w-10 h-10 bg-red-100 dark:bg-red-500/20 rounded-lg flex items-center justify-center mb-2">
                  <Crown className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm">Klik&Go paie</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">La plateforme finance</p>
              </button>
              <button
                onClick={() => setPayer("BUTCHER")}
                className={`rounded-xl border-2 p-4 text-left transition-all ${
                  payer === "BUTCHER"
                    ? "border-amber-300 dark:border-amber-500/50 bg-amber-50/50 dark:bg-amber-500/10"
                    : "border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20"
                }`}
              >
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/20 rounded-lg flex items-center justify-center mb-2">
                  <Store className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm">Le boucher paie</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Le boucher finance</p>
              </button>
            </div>
            {payer === "KLIKGO" && (
              <div className="mt-3 flex items-start gap-2 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-lg p-3">
                <Shield className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-700 dark:text-red-300">Le co\u00fbt est \u00e0 votre charge. La r\u00e9duction sera d\u00e9duite de vos revenus.</p>
              </div>
            )}
            {payer === "BUTCHER" && (
              <div className="mt-3 flex items-start gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-lg p-3">
                <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">Le boucher finance la r\u00e9duction. L&apos;offre lui sera propos\u00e9e pour acceptation.</p>
              </div>
            )}
          </div>

          {/* ── Section 2: S\u00e9lection boucheries (BUTCHER only) ── */}
          {payer === "BUTCHER" && (
            <div className="bg-white dark:bg-[#141414] rounded-2xl border-2 border-amber-200 dark:border-amber-500/30 p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Store className="w-4 h-4" />
                S\u00e9lection des boucheries
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {shops.map((shop) => {
                  const selected = shopIds.includes(shop.id);
                  return (
                    <button
                      key={shop.id}
                      onClick={() => toggleShop(shop.id)}
                      className={`rounded-xl border-2 p-3 w-full flex items-center gap-3 transition-all ${
                        selected
                          ? "border-amber-300 dark:border-amber-500/50 bg-amber-50/30 dark:bg-amber-500/10"
                          : "border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                          selected ? "bg-amber-500" : "border-2 border-gray-300 dark:border-white/20"
                        }`}
                      >
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <Store className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="text-left flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{shop.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {shop.city || "Ville"} &middot; {shop.rating ?? 0}<Star className="w-3 h-3 inline ml-0.5 text-amber-400" /> &middot; {shop._count?.products ?? 0} produits
                        </p>
                      </div>
                    </button>
                  );
                })}
                {shops.length === 0 && (
                  <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Chargement des boucheries...</p>
                )}
              </div>
            </div>
          )}

          {/* ── Section 3: Type d'offre ── */}
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Type d&apos;offre</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {OFFER_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`rounded-xl border-2 p-3 text-center transition-all ${
                    type === t.value
                      ? "border-red-300 dark:border-red-500/50 bg-red-50/50 dark:bg-red-500/10 shadow-sm"
                      : "border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20"
                  }`}
                >
                  <div className="text-2xl mb-1">{t.emoji}</div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">{t.label}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Section 4: D\u00e9tails ── */}
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">D\u00e9tails</h3>

            {/* Name + auto-generate */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nom de l'offre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-300"
              />
              <button
                onClick={() => setName(autoGenerateName(type, discountValue))}
                className="px-3 py-2.5 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors"
                title="G\u00e9n\u00e9rer un nom"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>

            {/* 3-col: discount, code, min order */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">R\u00e9duction</label>
                <input
                  type="number"
                  placeholder={type === "PERCENT" ? "10" : "5"}
                  value={type === "FREE_DELIVERY" ? "" : discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  disabled={type === "FREE_DELIVERY"}
                  className={`w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-300 ${
                    type === "FREE_DELIVERY" ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                />
                {type === "FREE_DELIVERY" && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Fix\u00e9 \u00e0 0,99\u20ac</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Code</label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="CODE123"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm font-mono text-gray-900 dark:text-white uppercase placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-300"
                  />
                  <button
                    onClick={generateCode}
                    className="px-2.5 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors shrink-0"
                    title="G\u00e9n\u00e9rer un code"
                  >
                    <Wand2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Cmd min</label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0"
                    value={minOrder}
                    onChange={(e) => setMinOrder(e.target.value)}
                    className="w-full px-3 py-2.5 pr-7 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-300"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">\u20ac</span>
                </div>
              </div>
            </div>

            {/* 2-col: dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">D\u00e9but</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-300"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Fin</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-300"
                />
              </div>
            </div>

            {/* Max uses */}
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Utilisations max</label>
              <input
                type="number"
                placeholder="Illimit\u00e9"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-300"
              />
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Laisser vide = illimit\u00e9</p>
            </div>
          </div>

          {/* ── Section 5: Audience ── */}
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Qui peut utiliser ce code ?</h3>
            <div className="grid grid-cols-2 gap-2">
              {AUDIENCES.map((a) => {
                const Icon = a.icon;
                const count = audienceCounts ? audienceCounts[a.countKey] : null;
                const selected = audience === a.value;
                return (
                  <button
                    key={a.value}
                    onClick={() => setAudience(a.value)}
                    className={`rounded-xl border-2 p-3 flex items-center gap-3 text-left transition-all ${
                      selected
                        ? "border-red-300 dark:border-red-500/50 bg-red-50/30 dark:bg-red-500/10"
                        : "border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20"
                    }`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${selected ? "text-red-500" : "text-gray-400 dark:text-gray-500"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{a.label}</p>
                        {selected && <Check className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {count !== null && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{count} clients</span>
                        )}
                        {a.desc && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">&middot; {a.desc}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-lg p-3">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                {getAudienceValidationText(audience, minOrder)}
              </p>
            </div>
          </div>

          {/* ── Section 6: Diffusion ── */}
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Diffusion</h3>

            {/* Badge (always on) */}
            <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3 flex items-center gap-3">
              <Tag className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Badge sur les boucheries</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Toujours actif</p>
              </div>
              <div className="w-5 h-5 rounded bg-gray-300 dark:bg-white/20 flex items-center justify-center cursor-not-allowed">
                <Check className="w-3 h-3 text-white" />
              </div>
            </div>

            {/* Banner */}
            <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
              <button
                onClick={() => setDiffBanner(!diffBanner)}
                className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <PanelTop className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <p className="text-sm font-medium text-gray-900 dark:text-white flex-1 text-left">Banni\u00e8re</p>
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                    diffBanner ? "bg-red-500" : "border-2 border-gray-300 dark:border-white/20"
                  }`}
                >
                  {diffBanner && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
              {diffBanner && (
                <div className="p-3 pt-0 space-y-3 border-t border-gray-100 dark:border-white/5">
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <input
                      type="text"
                      placeholder="Titre de la banni\u00e8re"
                      value={bannerTitle}
                      onChange={(e) => setBannerTitle(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                    />
                    <input
                      type="text"
                      placeholder="Sous-titre"
                      value={bannerSubtitle}
                      onChange={(e) => setBannerSubtitle(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {BANNER_COLORS.map((c) => (
                      <button
                        key={c.name}
                        onClick={() => setBannerColor(c.name)}
                        className={`w-7 h-7 rounded-full ${c.bg} transition-all ${
                          bannerColor === c.name ? `ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#141414] ${c.ring}` : ""
                        }`}
                      />
                    ))}
                  </div>
                  {/* Live preview */}
                  <div className={`bg-gradient-to-r ${getBannerGradient(bannerColor)} rounded-xl p-4 text-white`}>
                    <p className="font-bold text-sm">{bannerTitle || "Titre de la banni\u00e8re"}</p>
                    <p className="text-xs opacity-90 mt-0.5">{bannerSubtitle || "Sous-titre de la banni\u00e8re"}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-mono px-2 py-0.5 rounded">
                        {code || "CODE"}
                      </span>
                      <span className="text-xs font-semibold underline">J&apos;en profite &rarr;</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Popup */}
            <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
              <button
                onClick={() => setDiffPopup(!diffPopup)}
                className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <MousePointerClick className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <p className="text-sm font-medium text-gray-900 dark:text-white flex-1 text-left">Popup</p>
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                    diffPopup ? "bg-red-500" : "border-2 border-gray-300 dark:border-white/20"
                  }`}
                >
                  {diffPopup && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
              {diffPopup && (
                <div className="p-3 pt-0 space-y-3 border-t border-gray-100 dark:border-white/5">
                  <div className="space-y-2 mt-3">
                    <input
                      type="text"
                      placeholder="Titre du popup"
                      value={popupTitle}
                      onChange={(e) => setPopupTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                    />
                    <input
                      type="text"
                      placeholder="Message du popup"
                      value={popupMessage}
                      onChange={(e) => setPopupMessage(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {BANNER_COLORS.map((c) => (
                      <button
                        key={c.name}
                        onClick={() => setPopupColor(c.name)}
                        className={`w-7 h-7 rounded-full ${c.bg} transition-all ${
                          popupColor === c.name ? `ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#141414] ${c.ring}` : ""
                        }`}
                      />
                    ))}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Fr\u00e9quence</label>
                    <select
                      value={popupFrequency}
                      onChange={(e) => setPopupFrequency(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/30"
                    >
                      {POPUP_FREQUENCIES.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Email info */}
            <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3 flex items-center gap-3">
              <Mail className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <p className="text-sm font-medium text-gray-900 dark:text-white flex-1">Email</p>
              <span className="text-[10px] bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                Les emails se cr\u00e9ent dans une campagne
              </span>
            </div>
          </div>

          {/* ── Action Buttons ── */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => handleSubmit()}
              disabled={saving}
              className="flex-1 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              {saving ? "Cr\u00e9ation..." : "Publier l\u2019offre"}
            </button>
          </div>
        </div>

        {/* ═══════════════ RIGHT COLUMN ═══════════════ */}
        <div className="space-y-4 lg:sticky lg:top-6 self-start">

          {/* ── Card 1: R\u00e9sum\u00e9 ── */}
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">R\u00e9sum\u00e9 de l&apos;offre</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Type</span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">{typeLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">R\u00e9duction</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">
                  {discountBadgeText}
                </span>
              </div>
              {code && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Code</span>
                  <span className="text-xs font-mono font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded">
                    {code}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Financ\u00e9 par</span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">
                  {payer === "KLIKGO" ? "Klik&Go" : "Boucher"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Audience</span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">{audienceLabel}</span>
              </div>
              {min > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Cmd min</span>
                  <span className="text-xs font-medium text-gray-900 dark:text-white">{min}\u20ac</span>
                </div>
              )}
              {(startDate || endDate) && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">P\u00e9riode</span>
                  <span className="text-xs font-medium text-gray-900 dark:text-white">
                    {startDate || "..."} &rarr; {endDate || "..."}
                  </span>
                </div>
              )}
              {payer === "BUTCHER" && shopIds.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Boucheries</span>
                  <span className="text-xs font-medium text-gray-900 dark:text-white">
                    {shopIds.length} s\u00e9lectionn\u00e9e{shopIds.length > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Card 2: Validation au checkout ── */}
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Validation au checkout</h3>
            </div>
            <div className="space-y-2">
              {[
                "Code existe et actif",
                "Dates valides",
                "Utilisations restantes",
                `Audience : ${audienceLabel.toLowerCase()}`,
                ...(min > 0 ? [`Panier \u2265 ${min}\u20ac`] : []),
                ...(type === "BOGO" ? ["Produit \u00e9ligible dans le panier"] : []),
                "Pas d\u00e9j\u00e0 utilis\u00e9 par ce client",
              ].map((rule, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">{rule}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-3">
              Toutes ces v\u00e9rifications sont faites c\u00f4t\u00e9 serveur.
            </p>
          </div>

          {/* ── Card 3: Aper\u00e7u badge ── */}
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Aper\u00e7u badge client</p>
            <div className="flex items-center justify-center">
              <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {getBadgePreview(type, discountValue)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
