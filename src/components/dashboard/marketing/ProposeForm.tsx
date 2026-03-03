"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Gift,
  Store,
  Tag,
  PanelTop,
  MousePointerClick,
  Mail,
  X,
  Loader2,
  MapPin,
  Star,
  Check,
  Info,
  Calendar,
  Shield,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OfferType = "BOGO" | "PERCENT" | "BUNDLE" | "FREE_DELIVERY";
type Payer = "KLIKGO" | "BUTCHER";

interface ProposeFormProps {
  onClose: () => void;
  onCreated: () => void;
}

type Shop = {
  id: string;
  name: string;
  city: string | null;
  averageRating: number | null;
  slug: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OFFER_TYPES: {
  key: OfferType;
  emoji: string;
  label: string;
  desc: string;
}[] = [
  { key: "BOGO", emoji: "\u{1F381}", label: "1+1 Offert", desc: "Achetez 1, recevez 1 gratuit" },
  { key: "PERCENT", emoji: "\u{1F4B0}", label: "Reduction %", desc: "Pourcentage de reduction" },
  { key: "BUNDLE", emoji: "\u{1F4E6}", label: "Pack", desc: "Offre groupee speciale" },
  { key: "FREE_DELIVERY", emoji: "\u{1F389}", label: "Frais offerts", desc: "Frais de service offerts" },
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

function typeLabel(type: OfferType): string {
  return OFFER_TYPES.find((t) => t.key === type)?.label ?? type;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProposeForm({ onClose, onCreated }: ProposeFormProps) {
  // ---- Form state -----------------------------------------------------------

  const [type, setType] = useState<OfferType>("BOGO");
  const [name, setName] = useState("");
  const [payer, setPayer] = useState<Payer>("KLIKGO");
  const [discountValue, setDiscountValue] = useState("10");
  const [code, setCode] = useState(generateCode());
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );
  const [minOrder, setMinOrder] = useState("");

  const parseNum = (v: string) => parseFloat(v.replace(",", ".")) || 0;

  // Shops
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopIds, setSelectedShopIds] = useState<Set<string>>(new Set());
  const [loadingShops, setLoadingShops] = useState(true);

  // Diffusion
  const [diffBadge] = useState(true);
  const [diffBanner, setDiffBanner] = useState(false);
  const [diffPopup, setDiffPopup] = useState(false);
  const [diffEmail, setDiffEmail] = useState(false);

  // UI
  const [submitting, setSubmitting] = useState(false);

  // ---- Fetch shops ----------------------------------------------------------

  useEffect(() => {
    async function fetchShops() {
      setLoadingShops(true);
      try {
        const res = await fetch("/api/shops?all=true");
        const json = await res.json();
        if (json.success) {
          setShops(json.data ?? json.shops ?? []);
        } else {
          // Fallback to admin endpoint
          const res2 = await fetch("/api/admin/shops");
          const json2 = await res2.json();
          if (json2.success) {
            setShops(json2.data ?? json2.shops ?? []);
          }
        }
      } catch {
        toast.error("Impossible de charger les boucheries");
      } finally {
        setLoadingShops(false);
      }
    }
    fetchShops();
  }, []);

  // ---- Shop selection -------------------------------------------------------

  const toggleShop = useCallback((shopId: string) => {
    setSelectedShopIds((prev) => {
      const next = new Set(prev);
      if (next.has(shopId)) {
        next.delete(shopId);
      } else {
        next.add(shopId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedShopIds.size === shops.length) {
      setSelectedShopIds(new Set());
    } else {
      setSelectedShopIds(new Set(shops.map((s) => s.id)));
    }
  }, [shops, selectedShopIds.size]);

  // ---- Submit ---------------------------------------------------------------

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      toast.error("Veuillez donner un nom a l'offre");
      return;
    }
    if (selectedShopIds.size === 0) {
      toast.error("Veuillez selectionner au moins une boucherie");
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: Create the offer
      const offerBody = {
        name: name.trim(),
        type,
        discountValue: parseNum(discountValue),
        code: code.trim().toUpperCase(),
        audience: "ALL",
        startDate: new Date(startDate + "T00:00:00").toISOString(),
        endDate: new Date(endDate + "T23:59:59").toISOString(),
        minOrder: minOrder ? parseNum(minOrder) : 0,
        payer,
        status: "ACTIVE",
        diffBadge,
        diffBanner,
        diffPopup,
      };

      const res = await fetch("/api/dashboard/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(offerBody),
      });
      const json = await res.json();

      if (!json.success) {
        toast.error(json.error ?? "Erreur lors de la creation de l'offre");
        setSubmitting(false);
        return;
      }

      const offerId = json.data?.id;

      // Step 2: Propose to selected shops
      const proposeRes = await fetch(
        `/api/dashboard/offers/${offerId}/propose`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shopIds: Array.from(selectedShopIds) }),
        }
      );
      const proposeJson = await proposeRes.json();

      if (proposeJson.success) {
        toast.success(
          `Proposition envoyee a ${selectedShopIds.size} boucherie${
            selectedShopIds.size > 1 ? "s" : ""
          }`
        );
        onCreated();
      } else {
        toast.error(
          proposeJson.error ?? "Erreur lors de l'envoi des propositions"
        );
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setSubmitting(false);
    }
  }, [
    name,
    type,
    discountValue,
    code,
    startDate,
    endDate,
    minOrder,
    payer,
    diffBadge,
    diffBanner,
    diffPopup,
    selectedShopIds,
    onCreated,
  ]);

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
            Proposer une offre aux boucheries
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 transition"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* ---- Amber info banner ---- */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center gap-2 text-sm text-amber-700">
          <Store className="h-4 w-4 flex-shrink-0" />
          <span>
            Les bouchers recevront la proposition et pourront accepter ou
            refuser. S&apos;ils acceptent, ils choisiront leurs produits
            eligibles.
          </span>
        </div>

        {/* ---- 2-Column Layout ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* ========== LEFT COLUMN — Formulaire ========== */}
          <div className="col-span-1 lg:col-span-3 space-y-4">
            {/* 1. Type selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Type d&apos;offre
              </label>
              <div className="grid grid-cols-2 gap-2">
                {OFFER_TYPES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setType(t.key)}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                      type === t.key
                        ? "border-red-300 bg-red-50 dark:bg-red-500/10 border-2"
                        : "border-gray-100 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"
                    }`}
                  >
                    <span className="text-2xl leading-none">{t.emoji}</span>
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {t.label}
                      </div>
                      <div className="text-xs text-gray-500">{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Details */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/10 p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <Gift className="h-4 w-4 text-red-600" />
                Details de l&apos;offre
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Nom de l&apos;offre
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Promo Eid, Pack Famille..."
                  className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                />
              </div>

              {/* Who pays */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Qui finance ?
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPayer("KLIKGO")}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition ${
                      payer === "KLIKGO"
                        ? "border-red-300 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-2"
                        : "border-gray-100 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
                    }`}
                  >
                    <Shield className="h-4 w-4" />
                    Klik&amp;Go
                  </button>
                  <button
                    onClick={() => setPayer("BUTCHER")}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition ${
                      payer === "BUTCHER"
                        ? "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-2"
                        : "border-gray-100 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
                    }`}
                  >
                    <Store className="h-4 w-4" />
                    Boucher
                  </button>
                </div>
              </div>

              {/* Value + Min order */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {type === "PERCENT"
                      ? "Pourcentage (%)"
                      : type === "BOGO"
                      ? "Nb articles offerts"
                      : type === "BUNDLE"
                      ? "Reduction pack (EUR)"
                      : "Valeur (EUR)"}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 10 ou 0,99"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Commande minimum (EUR)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={minOrder}
                    onChange={(e) => setMinOrder(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                  />
                </div>
              </div>

              {/* Dates */}
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
            </div>

            {/* 3. Shop selection */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/10 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <Store className="h-4 w-4 text-amber-500" />
                  Boucheries ciblees
                  {selectedShopIds.size > 0 && (
                    <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      {selectedShopIds.size}
                    </span>
                  )}
                </div>
                <button
                  onClick={selectAll}
                  className="text-xs font-medium text-red-600 hover:text-red-700 transition"
                >
                  {selectedShopIds.size === shops.length
                    ? "Tout deselectionner"
                    : "Selectionner tout"}
                </button>
              </div>

              {loadingShops ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : shops.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  Aucune boucherie trouvee
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {shops.map((shop) => {
                    const selected = selectedShopIds.has(shop.id);
                    return (
                      <button
                        key={shop.id}
                        onClick={() => toggleShop(shop.id)}
                        className={`w-full rounded-xl border p-3 flex items-center gap-3 cursor-pointer transition text-left ${
                          selected
                            ? "border-red-300 bg-red-50/50 dark:bg-red-500/10"
                            : "border-gray-100 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition ${
                            selected
                              ? "border-red-500 bg-red-500"
                              : "border-gray-300 dark:border-white/20"
                          }`}
                        >
                          {selected && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex-shrink-0">
                          <Store className="h-4 w-4 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {shop.name}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                            {shop.city && (
                              <span className="inline-flex items-center gap-0.5">
                                <MapPin className="h-3 w-3" />
                                {shop.city}
                              </span>
                            )}
                            {shop.averageRating != null &&
                              shop.averageRating > 0 && (
                                <span className="inline-flex items-center gap-0.5">
                                  <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                                  {shop.averageRating.toFixed(1)}
                                </span>
                              )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. Diffusion */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-white/10 p-5 space-y-3">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                Diffusion automatique
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                    diffBadge
                      ? "border-red-200 bg-red-50/30 dark:bg-red-500/5"
                      : "border-gray-100 dark:border-white/10"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={diffBadge}
                    disabled
                    className="h-4 w-4 rounded accent-red-600"
                  />
                  <Tag className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Badge
                  </span>
                </label>
                <label
                  className={`flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                    diffBanner
                      ? "border-red-200 bg-red-50/30 dark:bg-red-500/5"
                      : "border-gray-100 dark:border-white/10"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={diffBanner}
                    onChange={(e) => setDiffBanner(e.target.checked)}
                    className="h-4 w-4 rounded accent-red-600"
                  />
                  <PanelTop className="h-4 w-4 text-purple-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Banniere
                  </span>
                </label>
                <label
                  className={`flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                    diffPopup
                      ? "border-red-200 bg-red-50/30 dark:bg-red-500/5"
                      : "border-gray-100 dark:border-white/10"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={diffPopup}
                    onChange={(e) => setDiffPopup(e.target.checked)}
                    className="h-4 w-4 rounded accent-red-600"
                  />
                  <MousePointerClick className="h-4 w-4 text-purple-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Popup
                  </span>
                </label>
                <label
                  className={`flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                    diffEmail
                      ? "border-red-200 bg-red-50/30 dark:bg-red-500/5"
                      : "border-gray-100 dark:border-white/10"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={diffEmail}
                    onChange={(e) => setDiffEmail(e.target.checked)}
                    className="h-4 w-4 rounded accent-red-600"
                  />
                  <Mail className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Email
                  </span>
                </label>
              </div>
            </div>

            {/* 5. Submit button */}
            <button
              onClick={handleSubmit}
              disabled={submitting || selectedShopIds.size === 0}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition shadow-sm"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Store className="h-4 w-4" />
              )}
              Envoyer la proposition a {selectedShopIds.size} boucherie
              {selectedShopIds.size > 1 ? "s" : ""}
            </button>
          </div>

          {/* ========== RIGHT COLUMN — Preview ========== */}
          <div className="col-span-1 lg:col-span-2 lg:sticky lg:top-6 self-start">
            <div className="space-y-3">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Apercu de la proposition
              </div>

              {/* Mock notification card */}
              <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-white/10 shadow-lg max-w-xs mx-auto overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-400 to-orange-400 rounded-t-2xl p-4">
                  <div className="flex items-center gap-2 text-white">
                    <Gift className="h-5 w-5" />
                    <div>
                      <div className="text-sm font-bold">
                        Nouvelle proposition Klik&amp;Go
                      </div>
                      <div className="text-xs text-white/80 mt-0.5">
                        {name || "Nom de l'offre"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4 space-y-3">
                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-2">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                        Qui paie
                      </div>
                      <div className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5">
                        {payer === "KLIKGO" ? "Klik&Go" : "Boucher"}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-2">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                        Periode
                      </div>
                      <div className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5">
                        {formatDateShort(startDate)} &mdash;{" "}
                        {formatDateShort(endDate)}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-2">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                        Type
                      </div>
                      <div className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5">
                        {typeLabel(type)}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-2">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                        Commande min
                      </div>
                      <div className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5">
                        {minOrder === "" || minOrder === "0"
                          ? "Aucune"
                          : `${minOrder}\u20AC`}
                      </div>
                    </div>
                  </div>

                  {/* Green notice if KLIKGO pays */}
                  {payer === "KLIKGO" && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
                      <CheckCheck className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-emerald-700 font-medium">
                        Klik&amp;Go finance &mdash; vous ne payez rien
                      </p>
                    </div>
                  )}

                  {/* Blue notice */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-700">
                      Si vous acceptez, vous choisirez les produits eligibles
                      dans votre catalogue.
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      disabled
                      className="flex-1 bg-emerald-600 text-white text-sm font-semibold rounded-xl py-2.5 opacity-90"
                    >
                      Accepter
                    </button>
                    <button
                      disabled
                      className="flex-1 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl py-2.5 opacity-90"
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              </div>

              {/* Diffusion summary */}
              <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3 space-y-2">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Canaux de diffusion
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 text-xs font-medium px-2 py-1 rounded-lg">
                    <Tag className="h-3 w-3" />
                    Badge
                  </span>
                  {diffBanner && (
                    <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-600 text-xs font-medium px-2 py-1 rounded-lg">
                      <PanelTop className="h-3 w-3" />
                      Banniere
                    </span>
                  )}
                  {diffPopup && (
                    <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-600 text-xs font-medium px-2 py-1 rounded-lg">
                      <MousePointerClick className="h-3 w-3" />
                      Popup
                    </span>
                  )}
                  {diffEmail && (
                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 text-xs font-medium px-2 py-1 rounded-lg">
                      <Mail className="h-3 w-3" />
                      Email
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {selectedShopIds.size} boucherie
                    {selectedShopIds.size > 1 ? "s" : ""} selectionnee
                    {selectedShopIds.size > 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
