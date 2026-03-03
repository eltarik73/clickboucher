"use client";

import { useState, useCallback } from "react";
import {
  Gift,
  Shield,
  Sparkles,
  Wand2,
  Globe,
  UserCheck,
  Heart,
  Crown,
  Tag,
  PanelTop,
  MousePointerClick,
  Mail,
  Calendar,
  Zap,
  Check,
  Copy,
  Megaphone,
  X,
  Store,
  Loader2,
  MapPin,
  Star,
  Info,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OfferType = "PERCENT" | "AMOUNT" | "FREE_DELIVERY" | "BOGO" | "BUNDLE";
type Audience = "ALL" | "NEW" | "LOYAL" | "VIP";
type BannerPosition = "discover_top" | "shop_page" | "all_pages";
type PopupFrequency = "once_user" | "once_day" | "every_visit";

interface OfferFormProps {
  onClose: () => void;
  onCreated: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OFFER_TYPES: {
  key: OfferType;
  emoji: string;
  label: string;
  desc: string;
}[] = [
  { key: "PERCENT", emoji: "\u{1F4B0}", label: "Reduction %", desc: "Pourcentage" },
  { key: "AMOUNT", emoji: "\u{1F4B6}", label: "Montant fixe", desc: "Euros" },
  { key: "FREE_DELIVERY", emoji: "\u{1F680}", label: "Frais offerts", desc: "Livraison" },
  { key: "BOGO", emoji: "\u{1F381}", label: "1+1 Offert", desc: "BOGO" },
  { key: "BUNDLE", emoji: "\u{1F4E6}", label: "Pack", desc: "Bundle" },
];

const AUDIENCES: {
  key: Audience;
  icon: typeof Globe;
  label: string;
  desc: string;
}[] = [
  { key: "ALL", icon: Globe, label: "Tous", desc: "Tous les clients" },
  { key: "NEW", icon: UserCheck, label: "Nouveaux", desc: "1ere commande" },
  { key: "LOYAL", icon: Heart, label: "Fideles", desc: "3+ commandes" },
  { key: "VIP", icon: Crown, label: "VIP", desc: "10+ commandes" },
];

const BANNER_COLORS = [
  { key: "red", from: "from-red-500", to: "to-rose-600", bg: "bg-red-500" },
  { key: "purple", from: "from-purple-500", to: "to-indigo-600", bg: "bg-purple-500" },
  { key: "blue", from: "from-blue-500", to: "to-cyan-600", bg: "bg-blue-500" },
  { key: "green", from: "from-emerald-500", to: "to-teal-600", bg: "bg-emerald-500" },
  { key: "amber", from: "from-amber-500", to: "to-orange-600", bg: "bg-amber-500" },
];

const POPUP_COLORS = [
  { key: "red", bg: "bg-red-500", btn: "bg-red-600" },
  { key: "purple", bg: "bg-purple-500", btn: "bg-purple-600" },
  { key: "blue", bg: "bg-blue-500", btn: "bg-blue-600" },
  { key: "green", bg: "bg-emerald-500", btn: "bg-emerald-600" },
  { key: "amber", bg: "bg-amber-500", btn: "bg-amber-600" },
];

const BANNER_POSITIONS: { key: BannerPosition; label: string }[] = [
  { key: "discover_top", label: "Haut /decouvrir" },
  { key: "shop_page", label: "Page boucherie" },
  { key: "all_pages", label: "Toutes pages" },
];

const POPUP_FREQUENCIES: { key: PopupFrequency; label: string }[] = [
  { key: "once_user", label: "1x/client" },
  { key: "once_day", label: "1x/jour" },
  { key: "every_visit", label: "Chaque visite" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function valueLabel(type: OfferType): string {
  switch (type) {
    case "PERCENT":
      return "Pourcentage (%)";
    case "AMOUNT":
      return "Montant (EUR)";
    case "FREE_DELIVERY":
      return "Valeur frais (EUR)";
    case "BOGO":
      return "Nb articles offerts";
    case "BUNDLE":
      return "Reduction pack (EUR)";
    default:
      return "Valeur";
  }
}

function badgeText(type: OfferType, value: number): string {
  switch (type) {
    case "PERCENT":
      return `-${value}%`;
    case "AMOUNT":
      return `-${value}\u20AC`;
    case "FREE_DELIVERY":
      return "Frais offerts";
    case "BOGO":
      return "1+1 Offert";
    case "BUNDLE":
      return "Pack promo";
    default:
      return "Promo";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OfferForm({ onClose, onCreated }: OfferFormProps) {
  // ---- Form state -----------------------------------------------------------

  const [name, setName] = useState("");
  const [type, setType] = useState<OfferType>("PERCENT");
  const [discountValue, setDiscountValue] = useState("10");
  const [code, setCode] = useState(generateCode());
  const [audience, setAudience] = useState<Audience>("ALL");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );
  const [minOrder, setMinOrder] = useState("");

  // Parse number from string (supports comma and dot)
  const parseNum = (v: string) => parseFloat(v.replace(",", ".")) || 0;

  // Diffusion
  const [diffBadge] = useState(true);
  const [diffBanner, setDiffBanner] = useState(false);
  const [diffPopup, setDiffPopup] = useState(false);
  const [diffEmail, setDiffEmail] = useState(false);

  // Banner
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerSubtitle, setBannerSubtitle] = useState("");
  const [bannerColor, setBannerColor] = useState("red");
  const [bannerPosition, setBannerPosition] = useState<BannerPosition>("discover_top");

  // Popup
  const [popupTitle, setPopupTitle] = useState("");
  const [popupMessage, setPopupMessage] = useState("");
  const [popupColor, setPopupColor] = useState("red");
  const [popupFrequency, setPopupFrequency] = useState<PopupFrequency>("once_user");

  // UI
  const [submitting, setSubmitting] = useState(false);
  const [generatingName, setGeneratingName] = useState(false);

  // ---- AI name generation ---------------------------------------------------

  const generateName = useCallback(async () => {
    setGeneratingName(true);
    const names: Record<OfferType, string[]> = {
      PERCENT: ["Promo du Moment", "Offre Speciale", "Reduction Exclusive", "Bon Plan Viande", "Happy Hour Boucher"],
      AMOUNT: ["Cadeau Fidelite", "Remise VIP", "Offre Decouverte", "Bon de Reduction", "Promo Flash"],
      FREE_DELIVERY: ["Frais Offerts", "Livraison Gratuite", "Click & Go Gratuit", "Zero Frais", "Retrait Offert"],
      BOGO: ["1 Achete 1 Offert", "Double Plaisir", "Duo Gourmand", "Le 2eme Offert", "Offre Duo"],
      BUNDLE: ["Pack Famille", "Assortiment Malin", "Le Bon Pack", "Mega Pack", "Pack Decouverte"],
    };
    const options = names[type] || names.PERCENT;
    const pick = options[Math.floor(Math.random() * options.length)];
    setName(pick);
    setGeneratingName(false);
  }, [type]);

  // ---- Submit ---------------------------------------------------------------

  const handleSubmit = useCallback(
    async (asDraft: boolean) => {
      if (!name.trim()) {
        toast.error("Veuillez donner un nom a l'offre");
        return;
      }
      if (!code.trim()) {
        toast.error("Veuillez definir un code promo");
        return;
      }

      setSubmitting(true);
      try {
        const body = {
          name: name.trim(),
          type,
          discountValue: parseNum(discountValue),
          code: code.trim().toUpperCase(),
          audience,
          startDate: new Date(startDate + "T00:00:00").toISOString(),
          endDate: new Date(endDate + "T23:59:59").toISOString(),
          minOrder: minOrder ? parseNum(minOrder) : 0,
          payer: "KLIKGO",
          status: asDraft ? "DRAFT" : "ACTIVE",
          diffBadge,
          diffBanner,
          diffPopup,
          ...(diffBanner && {
            bannerTitle,
            bannerSubtitle,
            bannerColor,
            bannerPosition,
          }),
          ...(diffPopup && {
            popupTitle,
            popupMessage,
            popupColor,
            popupFrequency,
          }),
        };

        const res = await fetch("/api/dashboard/offers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();

        if (json.success) {
          toast.success(
            asDraft ? "Offre programmee avec succes" : "Offre publiee avec succes"
          );
          onCreated();
        } else {
          toast.error(json.error ?? "Erreur lors de la creation");
        }
      } catch {
        toast.error("Erreur reseau");
      } finally {
        setSubmitting(false);
      }
    },
    [
      name,
      type,
      discountValue,
      code,
      audience,
      startDate,
      endDate,
      minOrder,
      diffBadge,
      diffBanner,
      diffPopup,
      bannerTitle,
      bannerSubtitle,
      bannerColor,
      bannerPosition,
      popupTitle,
      popupMessage,
      popupColor,
      popupFrequency,
      onCreated,
    ]
  );

  // ---- Helpers for banner/popup color lookup --------------------------------

  const bc = BANNER_COLORS.find((c) => c.key === bannerColor) ?? BANNER_COLORS[0];
  const pc = POPUP_COLORS.find((c) => c.key === popupColor) ?? POPUP_COLORS[0];

  // ---- Render ---------------------------------------------------------------

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#141414] rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Nouvelle offre
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 transition"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* ---- Red info banner ---- */}
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center gap-2 text-sm text-red-700">
          <Shield className="h-4 w-4 flex-shrink-0" />
          <span>
            Klik&Go finance cette offre &mdash; vos clients profitent, vous
            maitrisez le budget
          </span>
        </div>

        {/* ---- 2-Column Layout ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ========== LEFT COLUMN — L'offre ========== */}
          <div className="col-span-1">
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/10 p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <Gift className="h-4 w-4 text-red-600" />
                L&apos;offre
              </div>

              {/* 1. Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Nom de l&apos;offre
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Promo printemps"
                    className="flex-1 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                  />
                  <button
                    onClick={generateName}
                    disabled={generatingName}
                    className="bg-purple-50 text-purple-600 rounded-lg px-2 py-1.5 hover:bg-purple-100 transition disabled:opacity-50"
                    title="Generer avec l'IA"
                  >
                    {generatingName ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* 2. Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Type
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {OFFER_TYPES.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setType(t.key)}
                      className={`flex flex-col items-center gap-0.5 rounded-xl border p-2 text-center transition ${
                        type === t.key
                          ? "border-red-300 bg-red-50 dark:bg-red-500/10 border-2"
                          : "border-gray-100 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <span className="text-lg leading-none">{t.emoji}</span>
                      <span className="text-[10px] font-semibold text-gray-900 dark:text-white leading-tight">
                        {t.label}
                      </span>
                      <span className="text-[9px] text-gray-500 leading-tight">
                        {t.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Value + Code */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {valueLabel(type)}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 10 ou 0,99"
                    value={discountValue}
                    onChange={(e) =>
                      setDiscountValue(e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Code promo
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.toUpperCase())
                      }
                      className="flex-1 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/30"
                    />
                    <button
                      onClick={() => setCode(generateCode())}
                      className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-white/10 transition"
                      title="Generer un code"
                    >
                      <Wand2 className="h-4 w-4 text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. Audience */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Audience
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {AUDIENCES.map((a) => {
                    const Icon = a.icon;
                    return (
                      <button
                        key={a.key}
                        onClick={() => setAudience(a.key)}
                        className={`flex items-center gap-2 rounded-xl border p-3 text-left transition ${
                          audience === a.key
                            ? "border-red-300 bg-red-50/50 dark:bg-red-500/10"
                            : "border-gray-100 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 flex-shrink-0 ${
                            audience === a.key
                              ? "text-red-600"
                              : "text-gray-400"
                          }`}
                        />
                        <div>
                          <div className="text-xs font-semibold text-gray-900 dark:text-white">
                            {a.label}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {a.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Date de debut
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Date de fin
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/30"
                  />
                </div>
              </div>

              {/* 6. Min order */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Commande minimum (EUR, optionnel)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={minOrder}
                  onChange={(e) => setMinOrder(e.target.value)}
                  placeholder="Ex: 15 ou 9,99"
                  className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                />
              </div>
            </div>
          </div>

          {/* ========== RIGHT COLUMN — Diffusion ========== */}
          <div className="col-span-1 lg:col-span-2 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
              <Megaphone className="h-4 w-4 text-purple-600" />
              Diffusion
            </div>

            {/* ---- Channel 1: Badge (always on) ---- */}
            <div
              className={`rounded-xl border-2 transition ${
                diffBadge
                  ? "border-red-200 bg-red-50/30 dark:bg-red-500/5"
                  : "border-gray-100 dark:border-white/10"
              }`}
            >
              <div className="flex items-center gap-3 p-4">
                <input
                  type="checkbox"
                  checked={diffBadge}
                  disabled
                  className="h-4 w-4 rounded accent-red-600"
                />
                <Tag className="h-4 w-4 text-red-600" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    Badge boutique
                  </div>
                  <div className="text-xs text-gray-500">Toujours actif</div>
                </div>
              </div>
              <div className="px-4 pb-4">
                <p className="text-xs text-gray-500 mb-3">
                  Le badge apparait sur la carte boutique dans la page decouvrir.
                </p>
                {/* Mini shop card preview */}
                <div className="w-44 rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden shadow-sm">
                  <div className="relative bg-gradient-to-r from-amber-100 to-orange-100 h-16 flex items-center justify-center">
                    <Store className="h-6 w-6 text-amber-600/40" />
                    <span className="absolute top-1 left-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {badgeText(type, parseNum(discountValue))}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-[#1a1a1a] px-2.5 py-2">
                    <div className="text-xs font-semibold text-gray-900 dark:text-white">
                      Boucherie Tarik
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5">
                      <MapPin className="h-2.5 w-2.5" />
                      Chambery
                      <span className="mx-0.5">&middot;</span>
                      <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />
                      4.8
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ---- Channel 2: Banner ---- */}
            <div
              className={`rounded-xl border-2 transition ${
                diffBanner
                  ? "border-red-200 bg-red-50/30 dark:bg-red-500/5"
                  : "border-gray-100 dark:border-white/10"
              }`}
            >
              <div className="flex items-center gap-3 p-4">
                <input
                  type="checkbox"
                  checked={diffBanner}
                  onChange={(e) => setDiffBanner(e.target.checked)}
                  className="h-4 w-4 rounded accent-red-600"
                />
                <PanelTop className="h-4 w-4 text-purple-600" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    Banniere
                  </div>
                  <div className="text-xs text-gray-500">
                    Bandeau promotionnel en haut de page
                  </div>
                </div>
              </div>

              {diffBanner && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Title + Subtitle */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        Titre
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={bannerTitle}
                          onChange={(e) => setBannerTitle(e.target.value)}
                          placeholder="Offre speciale"
                          className="flex-1 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                        />
                        <button className="bg-purple-50 text-purple-600 rounded-lg px-2 py-1.5 hover:bg-purple-100 transition">
                          <Sparkles className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        Sous-titre
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={bannerSubtitle}
                          onChange={(e) =>
                            setBannerSubtitle(e.target.value)
                          }
                          placeholder="Profitez-en vite !"
                          className="flex-1 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                        />
                        <button className="bg-purple-50 text-purple-600 rounded-lg px-2 py-1.5 hover:bg-purple-100 transition">
                          <Sparkles className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Colors */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Couleur
                    </label>
                    <div className="flex items-center gap-2">
                      {BANNER_COLORS.map((c) => (
                        <button
                          key={c.key}
                          onClick={() => setBannerColor(c.key)}
                          className={`w-8 h-8 rounded-full ${c.bg} transition relative ${
                            bannerColor === c.key
                              ? "ring-2 ring-red-400 ring-offset-2"
                              : ""
                          }`}
                        >
                          {bannerColor === c.key && (
                            <Check className="h-4 w-4 text-white absolute inset-0 m-auto" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Position */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Position
                    </label>
                    <div className="flex items-center gap-2">
                      {BANNER_POSITIONS.map((p) => (
                        <button
                          key={p.key}
                          onClick={() => setBannerPosition(p.key)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                            bannerPosition === p.key
                              ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                              : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/20"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Banner Live Preview */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Apercu
                    </label>
                    <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
                      {/* Browser top bar */}
                      <div className="bg-gray-100 dark:bg-white/5 px-3 py-2 flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                          <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                        </div>
                        <div className="bg-white dark:bg-white/10 rounded-lg px-3 py-1 text-xs text-gray-400 flex-1">
                          klikandgo.app/decouvrir
                        </div>
                      </div>
                      {/* Banner */}
                      <div
                        className={`bg-gradient-to-r ${bc.from} ${bc.to} px-4 py-3 relative`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-white font-bold text-sm">
                              {bannerTitle || "Titre de la banniere"}
                            </div>
                            <div className="text-white/80 text-xs mt-0.5">
                              {bannerSubtitle || "Sous-titre"}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-mono font-bold px-2 py-0.5 rounded-lg">
                                {code || "CODE"}
                              </span>
                              <button className="bg-white text-gray-900 text-xs font-semibold px-3 py-1 rounded-lg">
                                Commander
                              </button>
                            </div>
                          </div>
                          <button className="text-white/60 hover:text-white">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {/* Placeholder content below */}
                      <div className="bg-gray-50 dark:bg-white/5 p-4 space-y-3">
                        <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-3/4" />
                        <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-1/2" />
                        <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-2/3" />
                        <div className="grid grid-cols-3 gap-2 mt-3">
                          <div className="h-16 bg-gray-200 dark:bg-white/10 rounded-lg" />
                          <div className="h-16 bg-gray-200 dark:bg-white/10 rounded-lg" />
                          <div className="h-16 bg-gray-200 dark:bg-white/10 rounded-lg" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ---- Channel 3: Popup ---- */}
            <div
              className={`rounded-xl border-2 transition ${
                diffPopup
                  ? "border-red-200 bg-red-50/30 dark:bg-red-500/5"
                  : "border-gray-100 dark:border-white/10"
              }`}
            >
              <div className="flex items-center gap-3 p-4">
                <input
                  type="checkbox"
                  checked={diffPopup}
                  onChange={(e) => setDiffPopup(e.target.checked)}
                  className="h-4 w-4 rounded accent-red-600"
                />
                <MousePointerClick className="h-4 w-4 text-purple-600" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    Popup
                  </div>
                  <div className="text-xs text-gray-500">
                    Fenetre promotionnelle au chargement
                  </div>
                </div>
              </div>

              {diffPopup && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Title */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Titre
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={popupTitle}
                        onChange={(e) => setPopupTitle(e.target.value)}
                        placeholder="Offre exclusive"
                        className="flex-1 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                      />
                      <button className="bg-purple-50 text-purple-600 rounded-lg px-2 py-1.5 hover:bg-purple-100 transition">
                        <Sparkles className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Frequency */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Frequence
                    </label>
                    <div className="flex items-center gap-2">
                      {POPUP_FREQUENCIES.map((f) => (
                        <button
                          key={f.key}
                          onClick={() => setPopupFrequency(f.key)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                            popupFrequency === f.key
                              ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                              : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/20"
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Message */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Message
                    </label>
                    <textarea
                      value={popupMessage}
                      onChange={(e) => setPopupMessage(e.target.value)}
                      rows={3}
                      placeholder="Utilisez le code promo pour profiter de cette offre..."
                      className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 resize-none"
                    />
                  </div>

                  {/* Colors */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Couleur
                    </label>
                    <div className="flex items-center gap-2">
                      {POPUP_COLORS.map((c) => (
                        <button
                          key={c.key}
                          onClick={() => setPopupColor(c.key)}
                          className={`w-8 h-8 rounded-full ${c.bg} transition relative ${
                            popupColor === c.key
                              ? "ring-2 ring-red-400 ring-offset-2"
                              : ""
                          }`}
                        >
                          {popupColor === c.key && (
                            <Check className="h-4 w-4 text-white absolute inset-0 m-auto" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Popup Live Preview */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Apercu
                    </label>
                    <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden bg-gray-50 dark:bg-white/5 relative p-6">
                      {/* Grayed background placeholder */}
                      <div className="opacity-30 space-y-2">
                        <div className="h-3 bg-gray-300 dark:bg-white/20 rounded w-3/4" />
                        <div className="h-3 bg-gray-300 dark:bg-white/20 rounded w-1/2" />
                        <div className="h-3 bg-gray-300 dark:bg-white/20 rounded w-2/3" />
                        <div className="grid grid-cols-3 gap-2 mt-3">
                          <div className="h-12 bg-gray-300 dark:bg-white/20 rounded-lg" />
                          <div className="h-12 bg-gray-300 dark:bg-white/20 rounded-lg" />
                          <div className="h-12 bg-gray-300 dark:bg-white/20 rounded-lg" />
                        </div>
                      </div>

                      {/* Popup overlay */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl w-72 overflow-hidden">
                          {/* Colored header */}
                          <div
                            className={`${pc.bg} h-16 relative flex items-center justify-center`}
                          >
                            <span className="text-3xl">{"\u{1F381}"}</span>
                            <button className="absolute top-2 right-2 text-white/60">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          {/* Content */}
                          <div className="p-4 space-y-3 text-center">
                            <div className="text-sm font-bold text-gray-900 dark:text-white">
                              {popupTitle || "Titre du popup"}
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                              {popupMessage || "Votre message apparaitra ici..."}
                            </div>
                            {/* Code pill */}
                            <div className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-white/10 rounded-lg px-3 py-1.5">
                              <span className="text-sm font-mono font-bold text-gray-900 dark:text-white">
                                {code || "CODE"}
                              </span>
                              <Copy className="h-3.5 w-3.5 text-gray-400" />
                            </div>
                            {/* CTA button */}
                            <div>
                              <button
                                className={`${pc.btn} text-white text-sm font-semibold px-6 py-2 rounded-xl w-full`}
                              >
                                J&apos;en profite
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ---- Channel 4: Email ---- */}
            <div
              className={`rounded-xl border-2 transition ${
                diffEmail
                  ? "border-red-200 bg-red-50/30 dark:bg-red-500/5"
                  : "border-gray-100 dark:border-white/10"
              }`}
            >
              <div className="flex items-center gap-3 p-4">
                <input
                  type="checkbox"
                  checked={diffEmail}
                  onChange={(e) => setDiffEmail(e.target.checked)}
                  className="h-4 w-4 rounded accent-red-600"
                />
                <Mail className="h-4 w-4 text-purple-600" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    Email
                  </div>
                  <div className="text-xs text-gray-500">
                    Campagne email aux clients
                  </div>
                </div>
              </div>

              {diffEmail && (
                <div className="px-4 pb-4">
                  <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                      Les emails se creent dans l&apos;onglet Campagnes. Allez
                      dans{" "}
                      <span className="font-semibold">
                        Campagnes &rarr; Nouvelle campagne
                      </span>{" "}
                      &rarr; attachez ce code promo.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ---- Bottom buttons ---- */}
        <div className="flex gap-3 justify-end pt-4 border-t border-gray-100 dark:border-white/10">
          <button
            onClick={onClose}
            disabled={submitting}
            className="bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-gray-200 dark:hover:bg-white/20 transition disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            className="inline-flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Calendar className="h-4 w-4" />
            )}
            Programmer
          </button>
          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="inline-flex items-center gap-2 bg-red-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Publier maintenant
          </button>
        </div>
      </div>
    </div>
  );
}
