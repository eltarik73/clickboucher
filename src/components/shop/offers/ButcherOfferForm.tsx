"use client";

import { useEffect, useState, useCallback } from "react";
import {
  X,
  Loader2,
  Tag,
  Percent,
  Gift,
  Truck,
  Package,
  Hash,
  Calendar,
  Users,
  Sparkles,
  ShoppingBag,
  Check,
  Image as ImageIcon,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────
type Product = {
  id: string;
  name: string;
  priceCents: number;
  unit: string;
  imageUrl?: string | null;
  category?: { name: string } | null;
};

type OfferType = "PERCENT" | "AMOUNT" | "FREE_DELIVERY" | "BOGO" | "BUNDLE";
type Audience = "ALL" | "NEW" | "LOYAL" | "VIP";

type Props = {
  onClose: () => void;
  onCreated: () => void;
};

// ── Config ─────────────────────────────────────────────────
const TYPE_OPTIONS: { value: OfferType; label: string; icon: typeof Percent; desc: string }[] = [
  { value: "PERCENT", label: "Réduction %", icon: Percent, desc: "Pourcentage de réduction" },
  { value: "AMOUNT", label: "Montant fixe", icon: Tag, desc: "Réduction en euros" },
  { value: "FREE_DELIVERY", label: "Frais offerts", icon: Truck, desc: "Livraison gratuite" },
  { value: "BOGO", label: "1+1 Offert", icon: Gift, desc: "Achetez-en 1, recevez-en 1" },
];

const AUDIENCE_OPTIONS: { value: Audience; label: string }[] = [
  { value: "ALL", label: "Tous les clients" },
  { value: "NEW", label: "Nouveaux clients" },
  { value: "LOYAL", label: "Clients fidèles" },
  { value: "VIP", label: "Clients VIP" },
];

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "KG-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ── Component ──────────────────────────────────────────────
export default function ButcherOfferForm({ onClose, onCreated }: Props) {
  // ── Step state ──
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // ── Step 1: Offer details ──
  const [name, setName] = useState("");
  const [type, setType] = useState<OfferType>("PERCENT");
  const [discountValue, setDiscountValue] = useState<string>("10");
  const [code, setCode] = useState(generateCode());
  const [audience, setAudience] = useState<Audience>("ALL");
  const [minOrder, setMinOrder] = useState<string>("0");
  const [maxUses, setMaxUses] = useState<string>("");
  const [startDate, setStartDate] = useState(formatDateInput(new Date()));
  const [endDate, setEndDate] = useState(
    formatDateInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
  );

  // ── Step 2: Product selection ──
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [productSearch, setProductSearch] = useState("");
  const [productsLoading, setProductsLoading] = useState(false);

  // ── Step 3: Banner (optional) ──
  const [diffBanner, setDiffBanner] = useState(false);
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerSubtitle, setBannerSubtitle] = useState("");
  const [bannerColor, setBannerColor] = useState<string>("red");

  // ── Submit state ──
  const [submitting, setSubmitting] = useState(false);

  // ── Fetch products when entering step 2 ──
  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const res = await fetch("/api/products?shopId=mine");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setProducts(json.data?.products || json.data || []);
    } catch {
      toast.error("Impossible de charger vos produits");
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step === 2 && products.length === 0) {
      fetchProducts();
    }
  }, [step, products.length, fetchProducts]);

  // ── Toggle product ──
  function toggleProduct(id: string) {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Validation ──
  function isStep1Valid(): boolean {
    return (
      name.trim().length >= 3 &&
      code.trim().length >= 3 &&
      parseFloat(discountValue.replace(",", ".")) > 0 &&
      !!startDate &&
      !!endDate &&
      new Date(endDate) > new Date(startDate)
    );
  }

  // ── Submit ──
  async function handleSubmit() {
    if (!isStep1Valid()) {
      toast.error("Vérifiez les informations de l'offre");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create the offer
      const offerRes = await fetch("/api/shop/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          type,
          discountValue: parseFloat(discountValue.replace(",", ".")) || 0,
          minOrder: parseFloat(minOrder.replace(",", ".")) || 0,
          audience,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          maxUses: maxUses ? parseInt(maxUses) : undefined,
          diffBanner,
          bannerTitle: diffBanner ? bannerTitle : undefined,
          bannerSubtitle: diffBanner ? bannerSubtitle : undefined,
          bannerColor: diffBanner ? bannerColor : undefined,
        }),
      });

      if (!offerRes.ok) {
        const data = await offerRes.json().catch(() => null);
        throw new Error(data?.message || "Erreur lors de la création");
      }

      const offerData = await offerRes.json();
      const offerId = offerData.data?.id;

      // 2. Assign products if selected
      if (offerId && selectedProductIds.size > 0) {
        await fetch(`/api/shop/offers/${offerId}/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: Array.from(selectedProductIds) }),
        });
      }

      toast.success("Offre créée avec succès !");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Filtered products ──
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  // ── Banner color options ──
  const BANNER_COLORS = [
    { value: "red", bg: "bg-red-500", label: "Rouge" },
    { value: "black", bg: "bg-gray-900", label: "Noir" },
    { value: "green", bg: "bg-emerald-500", label: "Vert" },
    { value: "orange", bg: "bg-orange-500", label: "Orange" },
    { value: "blue", bg: "bg-blue-500", label: "Bleu" },
  ];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-200 dark:border-white/10 max-h-[90vh] flex flex-col">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">Créer une offre</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Étape {step}/3 —{" "}
                {step === 1 ? "Détails" : step === 2 ? "Produits" : "Bannière"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Step indicator ── */}
        <div className="px-5 pt-3 flex gap-2 shrink-0">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                s <= step
                  ? "bg-red-500"
                  : "bg-gray-200 dark:bg-white/10"
              }`}
            />
          ))}
        </div>

        {/* ── Content (scrollable) ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* ════ STEP 1: Offer details ════ */}
          {step === 1 && (
            <>
              {/* Type selector */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">
                  Type d&apos;offre
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {TYPE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isActive = type === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setType(opt.value)}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                          isActive
                            ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                            : "border-gray-100 dark:border-white/10 hover:border-gray-200 dark:hover:border-white/20"
                        }`}
                      >
                        <Icon
                          size={18}
                          className={isActive ? "text-red-500" : "text-gray-400 dark:text-gray-500"}
                        />
                        <div>
                          <p
                            className={`text-sm font-semibold ${
                              isActive ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {opt.label}
                          </p>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500">{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">
                  Nom de l&apos;offre
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Promo weekend -20%"
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                />
              </div>

              {/* Value + Code */}
              <div className="grid grid-cols-2 gap-3">
                {/* Value */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">
                    {type === "PERCENT" ? "Réduction (%)" : type === "AMOUNT" ? "Montant (\u20AC)" : "Valeur"}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 10 ou 0,99"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    disabled={type === "FREE_DELIVERY"}
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:opacity-50"
                  />
                </div>

                {/* Code */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">
                    Code promo
                  </label>
                  <div className="relative">
                    <Hash
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      className="w-full pl-8 pr-10 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setCode(generateCode())}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                      title="Générer un nouveau code"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <Calendar size={12} />
                    Date de début
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <Calendar size={12} />
                    Date de fin
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/40"
                  />
                </div>
              </div>

              {/* Audience + Min order + Max uses */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <Users size={12} />
                    Audience
                  </label>
                  <select
                    value={audience}
                    onChange={(e) => setAudience(e.target.value as Audience)}
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/40"
                  >
                    {AUDIENCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">
                    Min. commande (\u20AC)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 15 ou 9,99"
                    value={minOrder}
                    onChange={(e) => setMinOrder(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">
                    Max. utilisations
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    placeholder="Illimité"
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                  />
                </div>
              </div>
            </>
          )}

          {/* ════ STEP 2: Product selection ════ */}
          {step === 2 && (
            <>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 rounded-xl p-3 flex items-center gap-2">
                <Package size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Sélectionnez les produits concernés par cette offre (optionnel)
                </p>
              </div>

              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Rechercher un produit..."
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                />
                <Package
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
              </div>

              {productsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingBag className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Aucun produit trouvé</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {filteredProducts.map((product) => {
                    const isSelected = selectedProductIds.has(product.id);
                    return (
                      <button
                        key={product.id}
                        onClick={() => toggleProduct(product.id)}
                        className={`relative rounded-xl border-2 p-2.5 text-left transition-all ${
                          isSelected
                            ? "border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                            : "border-gray-100 dark:border-white/10 hover:border-gray-200 dark:hover:border-white/20"
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                        <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                          {product.name}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                          {formatPrice(product.priceCents)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedProductIds.size > 0 && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium text-center">
                  {selectedProductIds.size} produit{selectedProductIds.size > 1 ? "s" : ""} sélectionné{selectedProductIds.size > 1 ? "s" : ""}
                </p>
              )}
            </>
          )}

          {/* ════ STEP 3: Banner (optional) ════ */}
          {step === 3 && (
            <>
              {/* Banner toggle */}
              <div className="flex items-center justify-between bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <ImageIcon size={18} className="text-gray-500 dark:text-gray-400" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      Afficher une bannière
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Visible sur votre page boutique
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDiffBanner(!diffBanner)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    diffBanner ? "bg-red-500" : "bg-gray-300 dark:bg-white/20"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      diffBanner ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              {diffBanner && (
                <div className="space-y-3 animate-in fade-in duration-200">
                  {/* Banner title */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">
                      Titre bannière
                    </label>
                    <input
                      type="text"
                      value={bannerTitle}
                      onChange={(e) => setBannerTitle(e.target.value)}
                      placeholder="Ex: -20% sur tout le magasin !"
                      className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                    />
                  </div>

                  {/* Banner subtitle */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">
                      Sous-titre (optionnel)
                    </label>
                    <input
                      type="text"
                      value={bannerSubtitle}
                      onChange={(e) => setBannerSubtitle(e.target.value)}
                      placeholder="Ex: Jusqu'au 30 mars"
                      className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                    />
                  </div>

                  {/* Color selector */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">
                      Couleur
                    </label>
                    <div className="flex items-center gap-2">
                      {BANNER_COLORS.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => setBannerColor(c.value)}
                          className={`w-8 h-8 rounded-full ${c.bg} transition-all ${
                            bannerColor === c.value
                              ? "ring-2 ring-offset-2 ring-gray-400 dark:ring-white/40 dark:ring-offset-[#1a1a1a] scale-110"
                              : "opacity-60 hover:opacity-80"
                          }`}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Live preview */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">
                      Aperçu
                    </label>
                    <div
                      className={`rounded-xl p-4 text-white text-center ${
                        bannerColor === "red"
                          ? "bg-gradient-to-r from-red-600 to-red-500"
                          : bannerColor === "black"
                          ? "bg-gradient-to-r from-gray-900 to-gray-800"
                          : bannerColor === "green"
                          ? "bg-gradient-to-r from-emerald-600 to-emerald-500"
                          : bannerColor === "orange"
                          ? "bg-gradient-to-r from-orange-600 to-orange-500"
                          : "bg-gradient-to-r from-blue-600 to-blue-500"
                      }`}
                    >
                      <p className="font-bold text-sm">
                        {bannerTitle || "Titre de la bannière"}
                      </p>
                      {(bannerSubtitle || !bannerTitle) && (
                        <p className="text-xs opacity-80 mt-0.5">
                          {bannerSubtitle || "Sous-titre optionnel"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10 space-y-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Récapitulatif
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Offre</span>
                    <span className="font-medium text-gray-900 dark:text-white">{name || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Code</span>
                    <span className="font-mono font-medium text-gray-900 dark:text-white">{code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Type</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {TYPE_OPTIONS.find((t) => t.value === type)?.label}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Période</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {startDate} — {endDate}
                    </span>
                  </div>
                  {selectedProductIds.size > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Produits</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        {selectedProductIds.size} sélectionné{selectedProductIds.size > 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Footer: Navigation + Submit ── */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-white/10 shrink-0 flex items-center gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep((step - 1) as 1 | 2)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors text-sm"
            >
              <ChevronLeft size={16} />
              Retour
            </button>
          )}

          <div className="flex-1" />

          {step < 3 ? (
            <button
              onClick={() => {
                if (step === 1 && !isStep1Valid()) {
                  toast.error("Remplissez tous les champs obligatoires");
                  return;
                }
                setStep((step + 1) as 2 | 3);
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors text-sm shadow-md shadow-red-600/20"
            >
              Suivant
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || !isStep1Valid()}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors text-sm shadow-md shadow-red-600/20"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Sparkles size={16} />
                  Créer l&apos;offre
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
