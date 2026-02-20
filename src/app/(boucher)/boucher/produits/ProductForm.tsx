// src/app/(boucher)/boucher/produits/ProductForm.tsx — 4-step product form
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  X,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Check,
  Camera,
  Plus,
  Trash2,
  Star,
  AlertTriangle,
} from "lucide-react";
import { getFlag } from "@/lib/flags";
import { useNotify } from "@/components/ui/NotificationToast";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export type Category = {
  id: string;
  name: string;
  emoji: string | null;
  order: number;
};

type ImageItem = {
  url: string;
  alt: string;
  isPrimary: boolean;
  order: number;
  uploading?: boolean;
  file?: File;
};

type LabelItem = { name: string; color: string | null };

// Product to edit (from list)
export type EditProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number;
  proPriceCents: number | null;
  unit: string;
  categoryId: string;
  tags: string[];
  origin: string | null;
  halalOrg: string | null;
  race: string | null;
  freshness: string | null;
  promoPct: number | null;
  promoEnd: string | null;
  promoType: string | null;
  customerNote: string | null;
  minWeightG: number;
  weightStepG: number;
  popular: boolean;
  images: { id: string; url: string; alt: string | null; order: number; isPrimary: boolean }[];
  labels: { id: string; name: string; color: string | null }[];
};

interface Props {
  shopId: string;
  categories: Category[];
  product?: EditProduct | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const STEPS = ["Produit", "Prix", "Qualite", "Photos"];

const ORIGINS = [
  { label: "France", value: "FRANCE", flag: "france" },
  { label: "Espagne", value: "ESPAGNE", flag: "espagne" },
  { label: "Irlande", value: "IRLANDE", flag: "irlande" },
  { label: "Belgique", value: "BELGIQUE", flag: "belgique" },
  { label: "Allemagne", value: "ALLEMAGNE", flag: "allemagne" },
  { label: "Italie", value: "ITALIE", flag: "italie" },
  { label: "Pologne", value: "POLOGNE", flag: "pologne" },
  { label: "UK", value: "UK", flag: "uk" },
  { label: "Pays-Bas", value: "EU", flag: "pays-bas" },
  { label: "Argentine", value: "AUTRE", flag: "argentine" },
  { label: "Bresil", value: "BRESIL", flag: "bresil" },
  { label: "Australie", value: "AUTRE", flag: "australie" },
];

const HALAL_ORGS = ["AVS", "Mosquee de Paris", "ARGML", "Achahada", "Autre"];
const FRESHNESS_OPTIONS = [
  { label: "Frais", value: "FRAIS", emoji: "\u{1F969}" },
  { label: "Surgele", value: "SURGELE", emoji: "\u{1F9CA}" },
  { label: "Sous vide", value: "SOUS_VIDE", emoji: "\u{1F4E6}" },
];
const SUGGESTED_LABELS = [
  "Label Rouge", "Bio", "Fait maison", "Race a viande",
  "Nourri a l'herbe", "Maturation longue", "Decoupe artisanale", "Sans additif",
];
const PROMO_PCTS = [5, 10, 15, 20, 25, 30];
const FLASH_DURATIONS = [
  { label: "1h", hours: 1 },
  { label: "2h", hours: 2 },
  { label: "3h", hours: 3 },
  { label: "6h", hours: 6 },
  { label: "12h", hours: 12 },
  { label: "24h", hours: 24 },
];
const MIN_WEIGHTS = [100, 200, 250, 300, 500];
const WEIGHT_STEPS = [25, 50, 100];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

// ─────────────────────────────────────────────
// Form Component
// ─────────────────────────────────────────────
export function ProductForm({ shopId, categories, product, onClose, onSaved, onDeleted }: Props) {
  const isEdit = !!product;
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { notify } = useNotify();

  // Step 1 — Produit
  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [categoryId, setCategoryId] = useState(product?.categoryId || "");
  const [unit, setUnit] = useState<"KG" | "PIECE" | "BARQUETTE">(
    (product?.unit as "KG" | "PIECE" | "BARQUETTE") || "KG"
  );

  // Step 2 — Prix
  const [priceCents, setPriceCents] = useState(product ? (product.priceCents / 100).toFixed(2) : "");
  const [proPriceCents, setProPriceCents] = useState(
    product?.proPriceCents ? (product.proPriceCents / 100).toFixed(2) : ""
  );
  const [promoEnabled, setPromoEnabled] = useState((product?.promoPct ?? 0) > 0);
  const [promoPct, setPromoPct] = useState(product?.promoPct || 10);
  const [isFlash, setIsFlash] = useState(product?.promoType === "FLASH");
  const [flashHours, setFlashHours] = useState(3);
  const [minWeightG, setMinWeightG] = useState(product?.minWeightG || 200);
  const [weightStepG, setWeightStepG] = useState(product?.weightStepG || 50);

  // Step 3 — Qualite
  const [origin, setOrigin] = useState(product?.origin || "");
  const [halalOrg, setHalalOrg] = useState(product?.halalOrg || "");
  const [freshness, setFreshness] = useState(product?.freshness || "FRAIS");
  const [race, setRace] = useState(product?.race || "");
  const [labels, setLabels] = useState<LabelItem[]>(
    product?.labels.map((l) => ({ name: l.name, color: l.color })) || []
  );
  const [customLabel, setCustomLabel] = useState("");

  // Step 4 — Photos
  const [images, setImages] = useState<ImageItem[]>(
    product?.images.map((img) => ({
      url: img.url,
      alt: img.alt || "",
      isPrimary: img.isPrimary,
      order: img.order,
    })) || []
  );
  const [customerNote, setCustomerNote] = useState(product?.customerNote || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Validation per step ──
  function isStepValid(s: number): boolean {
    switch (s) {
      case 0:
        return name.trim().length > 0 && categoryId !== "";
      case 1:
        return parseFloat(priceCents) > 0;
      case 2:
        return true; // All optional
      case 3:
        return true;
      default:
        return true;
    }
  }

  // ── Image upload ──
  async function handleImageUpload(files: FileList) {
    for (let i = 0; i < files.length; i++) {
      if (images.length + i >= 5) break;
      const file = files[i];
      const tempUrl = URL.createObjectURL(file);
      const newImg: ImageItem = {
        url: tempUrl,
        alt: name || "Produit",
        isPrimary: images.length === 0 && i === 0,
        order: images.length + i,
        uploading: true,
        file,
      };
      setImages((prev) => [...prev, newImg]);

      // Upload
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/uploads/product-image", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const json = await res.json();
          setImages((prev) =>
            prev.map((img) =>
              img.url === tempUrl ? { ...img, url: json.data.url, uploading: false } : img
            )
          );
        } else {
          // Remove failed upload
          setImages((prev) => prev.filter((img) => img.url !== tempUrl));
        }
      } catch {
        setImages((prev) => prev.filter((img) => img.url !== tempUrl));
      }
    }
  }

  function removeImage(idx: number) {
    const img = images[idx];
    // Delete from server if it's a real URL
    if (img.url.startsWith("/api/uploads/")) {
      fetch("/api/uploads/product-image", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: img.url }),
      }).catch(() => {});
    }
    const updated = images.filter((_, i) => i !== idx);
    // Ensure first is primary
    if (updated.length > 0 && !updated.some((i) => i.isPrimary)) {
      updated[0].isPrimary = true;
    }
    setImages(updated.map((img, i) => ({ ...img, order: i })));
  }

  function setPrimary(idx: number) {
    setImages((prev) =>
      prev.map((img, i) => ({ ...img, isPrimary: i === idx }))
    );
  }

  // ── Add/remove labels ──
  function addLabel(name: string) {
    if (labels.some((l) => l.name === name)) return;
    setLabels([...labels, { name, color: "#DC2626" }]);
  }

  function removeLabel(name: string) {
    setLabels(labels.filter((l) => l.name !== name));
  }

  // ── Submit ──
  async function handleSubmit() {
    setSubmitting(true);
    setApiError(null);

    const priceVal = Math.round(parseFloat(priceCents) * 100);
    const proVal = proPriceCents ? Math.round(parseFloat(proPriceCents) * 100) : null;

    const body: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || null,
      categoryId,
      unit,
      priceCents: priceVal,
      proPriceCents: proVal,
      shopId,
      origin: origin || null,
      halalOrg: halalOrg || null,
      race: race.trim() || null,
      freshness: freshness || null,
      customerNote: customerNote.trim() || null,
      tags: [],
      promoPct: promoEnabled ? promoPct : null,
      promoType: promoEnabled && isFlash ? "FLASH" : promoEnabled ? "PERCENTAGE" : null,
      promoEnd: promoEnabled && isFlash
        ? new Date(Date.now() + flashHours * 3600_000).toISOString()
        : null,
    };

    if (unit === "KG") {
      body.minWeightG = minWeightG;
      body.weightStepG = weightStepG;
    }

    // Images (only server-uploaded ones)
    const uploadedImages = images.filter((i) => !i.uploading && i.url.startsWith("/api/"));
    if (uploadedImages.length > 0) {
      body.images = uploadedImages.map((img, i) => ({
        url: img.url,
        alt: img.alt || name,
        order: i,
        isPrimary: img.isPrimary,
      }));
    }

    // Labels
    if (labels.length > 0) {
      body.labels = labels.map((l) => ({ name: l.name, color: l.color }));
    }

    try {
      const url = isEdit ? `/api/products/${product!.id}` : "/api/products";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => onSaved(), 1200);
      } else {
        const json = await res.json();
        setApiError(json.error?.message || "Erreur lors de l'enregistrement");
      }
    } catch {
      setApiError("Erreur de connexion");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Delete product ──
  async function handleDelete() {
    if (!product) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      if (res.ok) {
        notify("success", "Produit supprime avec succes");
        onClose();
        onDeleted?.();
      } else {
        const json = await res.json().catch(() => null);
        notify("error", json?.error?.message || "Erreur lors de la suppression");
      }
    } catch {
      notify("error", "Erreur de connexion au serveur");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  // ── Success overlay ──
  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white dark:bg-[#141414] rounded-2xl p-8 flex flex-col items-center gap-3 animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {isEdit ? "Modifications enregistrees !" : "Produit enregistre !"}
          </p>
        </div>
      </div>
    );
  }

  // ── Price preview ──
  const priceParsed = Math.round(parseFloat(priceCents || "0") * 100);
  const promoPreviewPrice = promoEnabled ? Math.round(priceParsed * (1 - promoPct / 100)) : priceParsed;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-[#141414] rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* ── Header ── */}
        <div className="sticky top-0 bg-white dark:bg-[#141414] border-b border-[#ece8e3] dark:border-white/10 px-5 pt-4 pb-3 z-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {isEdit ? "Modifier le produit" : "Nouveau produit"}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-white/15"
            >
              <X size={16} className="text-gray-500" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center flex-1">
                <button
                  onClick={() => { if (i < step || isStepValid(step)) setStep(i); }}
                  className={`flex items-center gap-1.5 w-full transition-all ${
                    i <= step ? "" : "opacity-40"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all shrink-0 ${
                      i < step
                        ? "bg-emerald-500 text-white"
                        : i === step
                          ? "bg-[#DC2626] text-white"
                          : "bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {i < step ? <Check size={12} /> : i + 1}
                  </div>
                  <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 hidden sm:block">{s}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 rounded ${i < step ? "bg-emerald-500" : "bg-gray-200 dark:bg-white/10"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* ═══ STEP 0: Produit ═══ */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Nom du produit *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Entrecote naturee"
                  className="h-11"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Decrivez le produit..."
                  rows={2}
                  className="w-full rounded-xl border border-[#ece8e3] dark:border-white/10 bg-white dark:bg-[#0a0a0a] px-3 py-2.5 text-sm text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626]"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                  Categorie *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryId(cat.id)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all min-h-[60px] ${
                        categoryId === cat.id
                          ? "bg-[#DC2626]/10 border-[#DC2626] text-[#DC2626]"
                          : "bg-white dark:bg-[#0a0a0a] border-[#ece8e3] dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-white/20"
                      }`}
                    >
                      <span className="text-lg">{cat.emoji || "\u{1F969}"}</span>
                      <span className="text-[11px] font-medium leading-tight text-center">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                  Mode de vente *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: "KG", label: "Au poids", emoji: "\u2696\uFE0F" },
                    { value: "PIECE", label: "A l'unite", emoji: "\u{1F522}" },
                    { value: "BARQUETTE", label: "Barquette", emoji: "\u{1F4E6}" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setUnit(opt.value)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all min-h-[60px] ${
                        unit === opt.value
                          ? "bg-[#DC2626]/10 border-[#DC2626] text-[#DC2626]"
                          : "bg-white dark:bg-[#0a0a0a] border-[#ece8e3] dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-white/20"
                      }`}
                    >
                      <span className="text-lg">{opt.emoji}</span>
                      <span className="text-[11px] font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ STEP 1: Prix ═══ */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Prix principal * {unit === "KG" ? "(au kg)" : unit === "PIECE" ? "(la piece)" : "(la barquette)"}
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceCents}
                    onChange={(e) => setPriceCents(e.target.value)}
                    placeholder="0,00"
                    className="h-14 text-2xl font-bold text-center pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-400">{"\u20AC"}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Prix PRO
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={proPriceCents}
                  onChange={(e) => setProPriceCents(e.target.value)}
                  placeholder="Optionnel"
                  className="h-10"
                />
                <p className="text-[10px] text-gray-400 mt-1">Visible uniquement par les clients professionnels</p>
              </div>

              {/* Promo toggle */}
              <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Promotion</span>
                  <button
                    type="button"
                    onClick={() => setPromoEnabled(!promoEnabled)}
                    className={`w-11 h-6 rounded-full transition-all relative ${promoEnabled ? "bg-[#DC2626]" : "bg-gray-300 dark:bg-white/15"}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${promoEnabled ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </div>

                {promoEnabled && (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {PROMO_PCTS.map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setPromoPct(pct)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] ${
                            promoPct === pct
                              ? "bg-[#DC2626] text-white"
                              : "bg-white dark:bg-[#0a0a0a] border border-[#ece8e3] dark:border-white/10 text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          -{pct}%
                        </button>
                      ))}
                    </div>

                    {/* Preview */}
                    {priceParsed > 0 && (
                      <div className="flex items-center gap-2 bg-white dark:bg-[#0a0a0a] rounded-lg p-3 border border-[#ece8e3] dark:border-white/10">
                        <span className="text-sm text-gray-400 line-through">{fmtPrice(priceParsed)}</span>
                        <span className="text-lg font-bold text-[#DC2626]">{fmtPrice(promoPreviewPrice)}</span>
                        <span className="px-2 py-0.5 bg-[#DC2626] text-white text-[10px] font-bold rounded">-{promoPct}%</span>
                      </div>
                    )}

                    {/* Flash promo */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Promo Flash</span>
                      <button
                        type="button"
                        onClick={() => setIsFlash(!isFlash)}
                        className={`w-11 h-6 rounded-full transition-all relative ${isFlash ? "bg-orange-500" : "bg-gray-300 dark:bg-white/15"}`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${isFlash ? "left-[22px]" : "left-0.5"}`} />
                      </button>
                    </div>
                    {isFlash && (
                      <div className="flex flex-wrap gap-1.5">
                        {FLASH_DURATIONS.map((d) => (
                          <button
                            key={d.hours}
                            type="button"
                            onClick={() => setFlashHours(d.hours)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold min-h-[36px] transition-all ${
                              flashHours === d.hours
                                ? "bg-orange-500 text-white"
                                : "bg-white dark:bg-[#0a0a0a] border border-[#ece8e3] dark:border-white/10 text-gray-600 dark:text-gray-400"
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Weight config (only for KG) */}
              {unit === "KG" && (
                <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 space-y-3">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Configuration poids</span>

                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Poids minimum</p>
                    <div className="flex flex-wrap gap-1.5">
                      {MIN_WEIGHTS.map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setMinWeightG(w)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold min-h-[36px] transition-all ${
                            minWeightG === w
                              ? "bg-[#2A2018] text-white"
                              : "bg-white dark:bg-[#0a0a0a] border border-[#ece8e3] dark:border-white/10 text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {w}g
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Palier de poids</p>
                    <div className="flex flex-wrap gap-1.5">
                      {WEIGHT_STEPS.map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setWeightStepG(w)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold min-h-[36px] transition-all ${
                            weightStepG === w
                              ? "bg-[#2A2018] text-white"
                              : "bg-white dark:bg-[#0a0a0a] border border-[#ece8e3] dark:border-white/10 text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {w}g
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ STEP 2: Qualite ═══ */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Origin */}
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                  Provenance
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ORIGINS.map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      onClick={() => setOrigin(origin === o.value ? "" : o.value)}
                      className={`flex items-center gap-1.5 p-2.5 rounded-xl border transition-all min-h-[44px] ${
                        origin === o.value
                          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                          : "bg-white dark:bg-[#0a0a0a] border-[#ece8e3] dark:border-white/10 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      <span className="text-base">{getFlag(o.flag)}</span>
                      <span className="text-[11px] font-medium">{o.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">Le drapeau s&apos;affiche automatiquement sur la fiche produit</p>
              </div>

              {/* Halal org */}
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                  Certification Halal
                </label>
                <div className="space-y-1.5">
                  {HALAL_ORGS.map((org) => (
                    <button
                      key={org}
                      type="button"
                      onClick={() => setHalalOrg(halalOrg === org ? "" : org)}
                      className={`w-full flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left min-h-[44px] ${
                        halalOrg === org
                          ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                          : "bg-white dark:bg-[#0a0a0a] border-[#ece8e3] dark:border-white/10 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        halalOrg === org ? "border-emerald-500" : "border-gray-300 dark:border-white/20"
                      }`}>
                        {halalOrg === org && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                      </span>
                      <span className="text-sm font-medium">{org}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Freshness */}
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                  Etat produit
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {FRESHNESS_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setFreshness(opt.value)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all min-h-[60px] ${
                        freshness === opt.value
                          ? "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                          : "bg-white dark:bg-[#0a0a0a] border-[#ece8e3] dark:border-white/10 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      <span className="text-lg">{opt.emoji}</span>
                      <span className="text-[11px] font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Race */}
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Race / Type
                </label>
                <Input
                  value={race}
                  onChange={(e) => setRace(e.target.value)}
                  placeholder="Ex: Charolaise, Label Rouge..."
                  className="h-10"
                />
              </div>

              {/* Labels */}
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                  Labels & caracteristiques
                </label>

                {/* Selected labels */}
                {labels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {labels.map((l) => (
                      <span
                        key={l.name}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#DC2626]/10 border border-[#DC2626]/30 rounded-lg text-xs font-semibold text-[#DC2626]"
                      >
                        {l.name}
                        <button type="button" onClick={() => removeLabel(l.name)} className="ml-0.5 hover:text-red-800">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Suggestions */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {SUGGESTED_LABELS
                    .filter((s) => !labels.some((l) => l.name === s))
                    .map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => addLabel(s)}
                        className="px-2.5 py-1 rounded-lg border border-dashed border-gray-300 dark:border-white/15 text-xs text-gray-500 dark:text-gray-400 hover:border-[#DC2626] hover:text-[#DC2626] transition-all min-h-[32px]"
                      >
                        + {s}
                      </button>
                    ))}
                </div>

                {/* Custom label */}
                <div className="flex gap-2">
                  <Input
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="Label personnalise..."
                    className="h-9 text-sm flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customLabel.trim()) {
                        e.preventDefault();
                        addLabel(customLabel.trim());
                        setCustomLabel("");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-3"
                    disabled={!customLabel.trim()}
                    onClick={() => { addLabel(customLabel.trim()); setCustomLabel(""); }}
                  >
                    <Plus size={14} />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ═══ STEP 3: Photos & Finalisation ═══ */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Photos grid */}
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                  Photos (max 5)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-[#ece8e3] dark:border-white/10 bg-gray-100 dark:bg-white/5">
                      {img.uploading ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                      ) : (
                        <img src={img.url} alt={img.alt} className="w-full h-full object-cover" />
                      )}

                      {/* Primary badge */}
                      {img.isPrimary && (
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-[#DC2626] text-white text-[8px] font-bold rounded">
                          Principale
                        </div>
                      )}

                      {/* Actions */}
                      <div className="absolute top-1 right-1 flex gap-1">
                        {!img.isPrimary && !img.uploading && (
                          <button
                            type="button"
                            onClick={() => setPrimary(idx)}
                            className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70"
                          >
                            <Star size={10} className="text-white" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center hover:bg-red-600"
                        >
                          <X size={10} className="text-white" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add button */}
                  {images.length < 5 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-white/15 flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-gray-500 hover:border-[#DC2626] hover:text-[#DC2626] transition-all"
                    >
                      <Camera size={20} />
                      <span className="text-[10px] font-medium">Ajouter</span>
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
                />
              </div>

              {/* Customer note */}
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Note pour le client
                </label>
                <textarea
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="Ex: A consommer dans les 48h..."
                  rows={2}
                  className="w-full rounded-xl border border-[#ece8e3] dark:border-white/10 bg-white dark:bg-[#0a0a0a] px-3 py-2.5 text-sm text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626]"
                />
              </div>

              {/* Recap */}
              <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Recapitulatif</h3>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Produit</span>
                    <span className="font-medium text-gray-900 dark:text-white">{name || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Categorie</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {categories.find((c) => c.id === categoryId)?.name || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Prix</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {priceParsed > 0 ? fmtPrice(priceParsed) : "—"}
                      {promoEnabled && <span className="text-[#DC2626] ml-1">-{promoPct}%</span>}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Vente</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {unit === "KG" ? "Au poids" : unit === "PIECE" ? "A l'unite" : "Barquette"}
                    </span>
                  </div>
                  {origin && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Origine</span>
                      <span className="font-medium text-gray-900 dark:text-white">{getFlag(origin)} {origin}</span>
                    </div>
                  )}
                  {halalOrg && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Halal</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">{halalOrg}</span>
                    </div>
                  )}
                  {labels.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Labels</span>
                      <span className="font-medium text-gray-900 dark:text-white">{labels.map((l) => l.name).join(", ")}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Photos</span>
                    <span className="font-medium text-gray-900 dark:text-white">{images.filter((i) => !i.uploading).length}</span>
                  </div>
                </div>
              </div>

              {apiError && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300">
                  {apiError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer navigation ── */}
        <div className="sticky bottom-0 bg-white dark:bg-[#141414] border-t border-[#ece8e3] dark:border-white/10 px-5 py-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="h-11 px-4 gap-1 border-[#ece8e3] dark:border-white/10"
              >
                <ChevronLeft size={16} /> Retour
              </Button>
            )}
            <div className="flex-1" />
            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!isStepValid(step)}
                className="h-11 px-6 gap-1 bg-[#DC2626] hover:bg-[#b91c1c] disabled:opacity-40"
              >
                Suivant <ChevronRight size={16} />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !isStepValid(0) || !isStepValid(1)}
                className="h-11 px-6 gap-1.5 bg-[#DC2626] hover:bg-[#b91c1c] disabled:opacity-40"
              >
                {submitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>Enregistrer</>
                )}
              </Button>
            )}
          </div>

          {/* Delete button (edit mode only) */}
          {isEdit && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              className="h-10 w-full gap-1.5 border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:border-red-300 dark:hover:border-red-700"
            >
              <Trash2 size={14} /> Supprimer ce produit
            </Button>
          )}
        </div>

        {/* ── Delete confirmation dialog ── */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 rounded-t-2xl sm:rounded-2xl" onClick={() => setShowDeleteConfirm(false)} />
            <div className="relative bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 mx-6 max-w-sm w-full shadow-2xl space-y-4">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Supprimer le produit</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Etes-vous sur de vouloir supprimer ce produit ? Cette action est irreversible.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="flex-1 h-11 border-[#ece8e3] dark:border-white/10"
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white gap-1.5"
                >
                  {deleting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Trash2 size={14} /> Supprimer
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
