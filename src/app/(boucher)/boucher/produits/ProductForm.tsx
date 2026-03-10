// src/app/(boucher)/boucher/produits/ProductForm.tsx — 4-step product form
"use client";

import { useState, useRef } from "react";
import Image from "next/image";
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
  Package,
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
  suggestedPrice?: number | null;
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
  maxWeightG?: number;
  popular: boolean;
  isActive: boolean;
  unitLabel: string | null;
  sliceOptions: { defaultSlices: number; minSlices: number; maxSlices: number; thicknesses: string[] } | null;
  variants: string[];
  weightPerPiece: number | null;
  pieceLabel: string | null;
  weightMargin: number;
  cutOptions?: Array<{ name: string; priceCents: number }> | null;
  promoFixedCents?: number | null;
  packContent?: string | null;
  packWeight?: string | null;
  packOldPriceCents?: number | null;
  images: { id: string; url: string; alt: string | null; order: number; isPrimary: boolean }[];
  labels: { id: string; name: string; color: string | null }[];
};

interface Props {
  shopId?: string;
  categories: Category[];
  product?: EditProduct | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
  mode?: "shop" | "reference";
  referenceProductId?: string;
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
export function ProductForm({ shopId, categories, product, onClose, onSaved, onDeleted, mode = "shop", referenceProductId }: Props) {
  const isReference = mode === "reference";
  const isEdit = !!product;
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showCatalogImport, setShowCatalogImport] = useState(false);
  type CatalogRef = {
    id: string; name: string; description: string | null; imageUrl: string | null;
    suggestedPrice: number | null; unit: string; origin: string | null; tags: string[];
    category: { name: string; emoji: string | null };
    halalOrg?: string | null; freshness?: string | null; race?: string | null;
    customerNote?: string | null; minWeightG?: number; weightStepG?: number; maxWeightG?: number;
    sliceOptions?: { defaultSlices: number; minSlices: number; maxSlices: number; thicknesses: string[] } | null;
    variants?: string[]; weightPerPiece?: number | null; pieceLabel?: string | null; weightMargin?: number;
    images?: { url: string; alt: string | null; order: number; isPrimary: boolean }[];
    labels?: { name: string; color: string | null }[];
  };
  const [catalogProducts, setCatalogProducts] = useState<CatalogRef[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const { notify } = useNotify();

  // Step 1 — Produit
  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [categoryId, setCategoryId] = useState(product?.categoryId || "");
  const [unit, setUnit] = useState<"KG" | "PIECE" | "BARQUETTE" | "TRANCHE">(
    (product?.unit as "KG" | "PIECE" | "BARQUETTE" | "TRANCHE") || "KG"
  );
  const [unitLabel, setUnitLabel] = useState(product?.unitLabel || "");
  const [isActive, setIsActive] = useState(product?.isActive !== false);

  // Step 2 — Prix
  const initPrice = isReference && product?.suggestedPrice ? product.suggestedPrice : product?.priceCents ?? 0;
  const [priceCents, setPriceCents] = useState(initPrice ? (initPrice / 100).toFixed(2) : "");
  const [proPriceCents, setProPriceCents] = useState(
    product?.proPriceCents ? (product.proPriceCents / 100).toFixed(2) : ""
  );
  const [promoEnabled, setPromoEnabled] = useState((product?.promoPct ?? 0) > 0);
  const [promoPct, setPromoPct] = useState(product?.promoPct || 10);
  const [isFlash, setIsFlash] = useState(product?.promoType === "FLASH");
  const [flashHours, setFlashHours] = useState(3);
  const [minWeightG, setMinWeightG] = useState(product?.minWeightG || 200);
  const [weightStepG, setWeightStepG] = useState(product?.weightStepG || 50);

  // Slice options (TRANCHE)
  const [defaultSlices, setDefaultSlices] = useState(product?.sliceOptions?.defaultSlices ?? 6);
  const [minSlices, setMinSlices] = useState(product?.sliceOptions?.minSlices ?? 2);
  const [maxSlices, setMaxSlices] = useState(product?.sliceOptions?.maxSlices ?? 20);
  const [thicknesses, setThicknesses] = useState<string[]>(
    product?.sliceOptions?.thicknesses ?? ["chiffonnade", "fine", "moyenne"]
  );

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

  // Variantes (saveurs)
  const [variants, setVariants] = useState<string[]>(product?.variants || []);
  const [variantInput, setVariantInput] = useState("");

  // Calculateur poids/pièces
  const [weightPerPiece, setWeightPerPiece] = useState<number | null>(product?.weightPerPiece ?? null);
  const [pieceLabel, setPieceLabel] = useState(product?.pieceLabel || "");
  const [weightMargin, setWeightMargin] = useState(product?.weightMargin ?? 15);

  // Cut Options (decoupe)
  const [cutEnabled, setCutEnabled] = useState(Array.isArray(product?.cutOptions) && product.cutOptions.length > 0);
  const [cutOptionsList, setCutOptionsList] = useState<Array<{ name: string; priceCents: number }>>(
    (product?.cutOptions as Array<{ name: string; priceCents: number }>) || []
  );

  // Promo mode (percent vs fixed)
  const [promoMode, setPromoMode] = useState<"percent" | "fixed">(product?.promoType === "FIXED_AMOUNT" ? "fixed" : "percent");
  const [promoFixedVal, setPromoFixedVal] = useState(product?.promoFixedCents ? (product.promoFixedCents / 100).toFixed(2) : "");

  // Pack promo
  const [packEnabled, setPackEnabled] = useState(!!product?.packContent);
  const [packContent, setPackContent] = useState(product?.packContent || "");
  const [packWeightVal, setPackWeightVal] = useState(product?.packWeight || "");
  const [packOldPrice, setPackOldPrice] = useState(product?.packOldPriceCents ? (product.packOldPriceCents / 100).toFixed(2) : "");

  // ── Import from reference catalog ──
  async function openCatalogImport() {
    setShowCatalogImport(true);
    setCatalogLoading(true);
    try {
      const res = await fetch("/api/webmaster/catalog/reference?perPage=100");
      if (res.ok) {
        const json = await res.json();
        setCatalogProducts(json.data || []);
      }
    } catch { /* silent */ }
    setCatalogLoading(false);
  }

  function importFromCatalog(ref: CatalogRef) {
    setName(ref.name);
    setDescription(ref.description || "");
    if (ref.unit) setUnit(ref.unit as "KG" | "PIECE" | "BARQUETTE" | "TRANCHE");
    if (ref.origin) setOrigin(ref.origin);
    if (ref.suggestedPrice) setPriceCents((ref.suggestedPrice / 100).toFixed(2));
    // Enriched fields from reference catalog
    if (ref.halalOrg) setHalalOrg(ref.halalOrg);
    if (ref.freshness) setFreshness(ref.freshness);
    if (ref.race) setRace(ref.race);
    if (ref.customerNote) setCustomerNote(ref.customerNote);
    if (ref.minWeightG) setMinWeightG(ref.minWeightG);
    if (ref.weightStepG) setWeightStepG(ref.weightStepG);
    if (ref.variants?.length) setVariants(ref.variants);
    if (ref.weightPerPiece) setWeightPerPiece(ref.weightPerPiece);
    if (ref.pieceLabel) setPieceLabel(ref.pieceLabel);
    if (ref.weightMargin) setWeightMargin(ref.weightMargin);
    if (ref.labels?.length) setLabels(ref.labels.map((l) => ({ name: l.name, color: l.color })));
    if (ref.sliceOptions) {
      setDefaultSlices(ref.sliceOptions.defaultSlices);
      setMinSlices(ref.sliceOptions.minSlices);
      setMaxSlices(ref.sliceOptions.maxSlices);
      setThicknesses(ref.sliceOptions.thicknesses);
    }
    // Images: use reference images if available, else fallback to single imageUrl
    if (ref.images?.length) {
      setImages(ref.images.map((img, i) => ({ url: img.url, alt: img.alt || ref.name, isPrimary: img.isPrimary ?? i === 0, order: img.order ?? i })));
    } else if (ref.imageUrl) {
      setImages([{ url: ref.imageUrl, alt: ref.name, isPrimary: true, order: 0 }]);
    }
    setShowCatalogImport(false);
    notify("success", `"${ref.name}" importe du catalogue`);
  }

  const filteredCatalog = catalogProducts.filter((p) =>
    !catalogSearch || p.name.toLowerCase().includes(catalogSearch.toLowerCase())
  );

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
    // Delete from server if it's uploaded (blob or legacy)
    if (img.url.startsWith("/api/uploads/") || img.url.includes(".public.blob.vercel-storage.com")) {
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
      origin: origin || null,
      halalOrg: halalOrg || null,
      race: race.trim() || null,
      freshness: freshness || null,
      customerNote: customerNote.trim() || null,
      tags: [],
      isActive,
    };

    if (isReference) {
      body.suggestedPrice = priceVal;
    } else {
      body.priceCents = priceVal;
      body.proPriceCents = proVal;
      body.shopId = shopId;
      if (promoEnabled && promoMode === "fixed") {
        body.promoFixedCents = Math.round(parseFloat(promoFixedVal || "0") * 100);
        body.promoType = "FIXED_AMOUNT";
        body.promoPct = null;
        body.promoEnd = null;
      } else {
        body.promoPct = promoEnabled ? promoPct : null;
        body.promoType = promoEnabled && isFlash ? "FLASH" : promoEnabled ? "PERCENTAGE" : null;
        body.promoEnd = promoEnabled && isFlash
          ? new Date(Date.now() + flashHours * 3600_000).toISOString()
          : null;
        body.promoFixedCents = null;
      }
      body.unitLabel = unitLabel.trim() || null;
      body.packContent = packEnabled ? packContent.trim() || null : null;
      body.packWeight = packEnabled ? packWeightVal.trim() || null : null;
      body.packOldPriceCents = packEnabled && packOldPrice ? Math.round(parseFloat(packOldPrice) * 100) : null;
    }

    if (unit === "KG" || unit === "TRANCHE") {
      body.minWeightG = minWeightG;
      body.weightStepG = weightStepG;
    }

    if (unit === "TRANCHE") {
      body.sliceOptions = { defaultSlices, minSlices, maxSlices, thicknesses };
    } else {
      body.sliceOptions = null;
    }

    // Variantes
    body.variants = variants;

    // Cut options
    body.cutOptions = cutEnabled && cutOptionsList.length > 0 ? cutOptionsList : null;

    // Calculateur pièces (KG only)
    if (unit === "KG" && weightPerPiece) {
      body.weightPerPiece = weightPerPiece;
      body.pieceLabel = pieceLabel.trim() || null;
      body.weightMargin = weightMargin;
    } else {
      body.weightPerPiece = null;
      body.pieceLabel = null;
    }

    // Images (server-uploaded: blob URLs or legacy /api/ URLs)
    // Always send images array (even empty) so the API can delete removed images
    const uploadedImages = images.filter((i) => !i.uploading && (i.url.startsWith("/api/") || i.url.startsWith("https://")));
    body.images = uploadedImages.map((img, i) => ({
      url: img.url,
      alt: img.alt || name,
      order: i,
      isPrimary: img.isPrimary,
    }));

    // Labels — always send so the API can sync (empty = remove all)
    body.labels = labels.map((l) => ({ name: l.name, color: l.color }));

    try {
      const url = isReference
        ? (referenceProductId ? `/api/webmaster/catalog/reference/${referenceProductId}` : "/api/webmaster/catalog/reference")
        : (isEdit ? `/api/products/${product!.id}` : "/api/products");
      const method = (isReference ? !!referenceProductId : isEdit) ? "PATCH" : "POST";

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
      const deleteUrl = isReference
        ? `/api/webmaster/catalog/reference/${product.id}`
        : `/api/products/${product.id}`;
      const res = await fetch(deleteUrl, { method: "DELETE" });
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
      <div className="absolute inset-0 bg-black/50" role="presentation" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-[#141414] rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* ── Header ── */}
        <div className="sticky top-0 bg-white dark:bg-[#141414] border-b border-[#ece8e3] dark:border-white/10 px-5 pt-4 pb-3 z-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {isReference
                ? (referenceProductId ? "Modifier le produit reference" : "Nouveau produit reference")
                : (isEdit ? "Modifier le produit" : "Nouveau produit")}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-white/15"
            >
              <X size={16} className="text-gray-500 dark:text-gray-400" />
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
              {/* Import from catalog (shop mode only) */}
              {!isEdit && !isReference && (
                <button
                  type="button"
                  onClick={openCatalogImport}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[#DC2626]/30 rounded-xl text-sm font-medium text-[#DC2626] hover:bg-[#DC2626]/5 transition-colors"
                >
                  <Package size={16} />
                  Importer depuis le catalogue
                </button>
              )}
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
                    { value: "KG" as const, label: "Au poids", emoji: "\u{1F969}", desc: "Prix au kg" },
                    { value: "PIECE" as const, label: "A l'unite", emoji: "\u{1F4E6}", desc: "Prix / piece" },
                    { value: "TRANCHE" as const, label: "A la tranche", emoji: "\u{1F52A}", desc: "Prix au kg" },
                  ]).map((opt) => {
                    const isSelected = unit === opt.value || (opt.value === "PIECE" && unit === "BARQUETTE");
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setUnit(opt.value)}
                        className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all min-h-[80px] ${
                          isSelected
                            ? "bg-[#DC2626]/10 border-[#DC2626] text-[#DC2626]"
                            : "bg-white dark:bg-[#0a0a0a] border-[#ece8e3] dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-white/20"
                        }`}
                      >
                        <span className="text-2xl">{opt.emoji}</span>
                        <span className="text-xs font-bold">{opt.label}</span>
                        <span className="text-[10px] opacity-60">{opt.desc}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Sub-option: Barquette under "À l'unité" */}
                {(unit === "PIECE" || unit === "BARQUETTE") && (
                  <div className="flex items-center gap-2 mt-2 pl-1">
                    <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={unit === "BARQUETTE"}
                        onChange={(e) => setUnit(e.target.checked ? "BARQUETTE" : "PIECE")}
                        className="rounded border-gray-300 dark:border-gray-700"
                      />
                      Barquette (vendu en barquette)
                    </label>
                  </div>
                )}
              </div>

              {/* Variantes / Saveurs (optionnel) */}
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Variantes / Saveurs <span className="text-gray-500 dark:text-gray-400 font-normal text-xs">(optionnel)</span>
                </label>
                {variants.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {variants.map((v, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/20">
                        {v}
                        <button type="button" onClick={() => setVariants(variants.filter((_, j) => j !== i))} className="hover:text-[#DC2626]">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {["Nature", "Tex-Mex", "Curry", "Herbes", "Piment", "Ail"].filter(s => !variants.includes(s)).slice(0, 6).map(s => (
                    <button key={s} type="button" onClick={() => setVariants([...variants, s])}
                      className="px-2.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-[#0a0a0a] border border-[#ece8e3] dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      + {s}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={variantInput} onChange={e => setVariantInput(e.target.value)}
                    placeholder="Autre saveur..." className="h-9 text-sm"
                    onKeyDown={e => { if (e.key === "Enter" && variantInput.trim()) { e.preventDefault(); if (!variants.includes(variantInput.trim())) setVariants([...variants, variantInput.trim()]); setVariantInput(""); } }} />
                  <Button type="button" variant="outline" size="sm" disabled={!variantInput.trim() || variants.includes(variantInput.trim())}
                    onClick={() => { if (variantInput.trim() && !variants.includes(variantInput.trim())) setVariants([...variants, variantInput.trim()]); setVariantInput(""); }}>
                    <Plus size={14} />
                  </Button>
                </div>
              </div>

              {/* ── Options de decoupe (KG only) ── */}
              {unit === "KG" && (
                <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Options de decoupe</span>
                    <button type="button" onClick={() => setCutEnabled(!cutEnabled)}
                      className={`w-11 h-6 rounded-full transition-all relative ${cutEnabled ? "bg-[#DC2626]" : "bg-gray-300 dark:bg-white/15"}`}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white dark:bg-gray-900 shadow transition-all ${cutEnabled ? "left-[22px]" : "left-0.5"}`} />
                    </button>
                  </div>
                  {cutEnabled && (
                    <>
                      {/* Presets */}
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: "Viande", options: [{ name: "Avec os", priceCents: 0 }, { name: "Sans os", priceCents: 0 }, { name: "Desossee", priceCents: 0 }] },
                          { label: "Charcuterie", options: [{ name: "Entiere", priceCents: 0 }, { name: "Tranchee", priceCents: 0 }, { name: "En des", priceCents: 0 }] },
                          { label: "Volaille", options: [{ name: "Entier", priceCents: 0 }, { name: "Filet", priceCents: 0 }, { name: "Cuisses", priceCents: 0 }] },
                        ].map(preset => (
                          <button key={preset.label} type="button"
                            onClick={() => setCutOptionsList(preset.options.map(o => ({ ...o, priceCents: Math.round(parseFloat(priceCents || "0") * 100) })))}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-[#0a0a0a] border border-[#ece8e3] dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      {/* Editable lines */}
                      {cutOptionsList.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input value={opt.name} onChange={e => { const next = [...cutOptionsList]; next[idx] = { ...next[idx], name: e.target.value }; setCutOptionsList(next); }}
                            placeholder="Nom option" className="h-9 text-sm flex-1" />
                          <div className="relative w-28">
                            <Input type="number" step="0.01" min="0" value={(opt.priceCents / 100).toFixed(2)}
                              onChange={e => { const next = [...cutOptionsList]; next[idx] = { ...next[idx], priceCents: Math.round(parseFloat(e.target.value || "0") * 100) }; setCutOptionsList(next); }}
                              className="h-9 text-sm pr-8" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400">{"\u20AC"}/kg</span>
                          </div>
                          <button type="button" onClick={() => setCutOptionsList(cutOptionsList.filter((_, i) => i !== idx))}
                            className="text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors"><X size={16} /></button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setCutOptionsList([...cutOptionsList, { name: "", priceCents: Math.round(parseFloat(priceCents || "0") * 100) }])}
                        className="flex items-center gap-1 text-xs font-medium text-[#DC2626] hover:underline">
                        <Plus size={14} /> Ajouter une option
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══ STEP 1: Prix ═══ */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                  {isReference ? "Prix suggere *" : "Prix principal *"} {unit === "KG" ? "(au kg)" : unit === "PIECE" ? "(la piece)" : unit === "TRANCHE" ? "(au kg)" : "(la barquette)"}
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
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-500 dark:text-gray-400">{"\u20AC"}</span>
                </div>
              </div>

              {/* PRO price + Promo (shop mode only) */}
              {!isReference && (<>
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
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Visible uniquement par les clients professionnels</p>
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
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white dark:bg-gray-900 shadow transition-all ${promoEnabled ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </div>

                {promoEnabled && (
                  <>
                    {/* Segmented control: Pourcentage | Montant fixe */}
                    <div className="flex rounded-lg overflow-hidden border border-[#ece8e3] dark:border-white/10">
                      {(["percent", "fixed"] as const).map(m => (
                        <button key={m} type="button" onClick={() => setPromoMode(m)}
                          className={`flex-1 py-2 text-xs font-bold transition-all ${promoMode === m ? "bg-[#DC2626] text-white" : "bg-white dark:bg-[#0a0a0a] text-gray-600 dark:text-gray-400"}`}>
                          {m === "percent" ? "Pourcentage" : "Montant fixe"}
                        </button>
                      ))}
                    </div>

                    {promoMode === "percent" ? (
                      <>
                        <div className="flex flex-wrap gap-1.5">
                          {PROMO_PCTS.map((pct) => (
                            <button key={pct} type="button" onClick={() => setPromoPct(pct)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] ${
                                promoPct === pct ? "bg-[#DC2626] text-white" : "bg-white dark:bg-[#0a0a0a] border border-[#ece8e3] dark:border-white/10 text-gray-600 dark:text-gray-400"
                              }`}>
                              -{pct}%
                            </button>
                          ))}
                        </div>
                        {priceParsed > 0 && (
                          <div className="flex items-center gap-2 bg-white dark:bg-[#0a0a0a] rounded-lg p-3 border border-[#ece8e3] dark:border-white/10">
                            <span className="text-sm text-gray-500 dark:text-gray-400 line-through">{fmtPrice(priceParsed)}</span>
                            <span className="text-lg font-bold text-[#DC2626]">{fmtPrice(promoPreviewPrice)}</span>
                            <span className="px-2 py-0.5 bg-[#DC2626] text-white text-[10px] font-bold rounded">-{promoPct}%</span>
                          </div>
                        )}
                        {/* Flash promo */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Promo Flash</span>
                          <button type="button" onClick={() => setIsFlash(!isFlash)}
                            className={`w-11 h-6 rounded-full transition-all relative ${isFlash ? "bg-orange-500" : "bg-gray-300 dark:bg-white/15"}`}>
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white dark:bg-gray-900 shadow transition-all ${isFlash ? "left-[22px]" : "left-0.5"}`} />
                          </button>
                        </div>
                        {isFlash && (
                          <div className="flex flex-wrap gap-1.5">
                            {FLASH_DURATIONS.map((d) => (
                              <button key={d.hours} type="button" onClick={() => setFlashHours(d.hours)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold min-h-[36px] transition-all ${
                                  flashHours === d.hours ? "bg-orange-500 text-white" : "bg-white dark:bg-[#0a0a0a] border border-[#ece8e3] dark:border-white/10 text-gray-600 dark:text-gray-400"
                                }`}>
                                {d.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="relative">
                          <Input type="number" step="0.01" min="0" value={promoFixedVal}
                            onChange={(e) => setPromoFixedVal(e.target.value)}
                            placeholder="Montant de la reduction" className="h-10 pr-8" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">{"\u20AC"}</span>
                        </div>
                        {priceParsed > 0 && parseFloat(promoFixedVal || "0") > 0 && (
                          <div className="flex items-center gap-2 bg-white dark:bg-[#0a0a0a] rounded-lg p-3 border border-[#ece8e3] dark:border-white/10">
                            <span className="text-sm text-gray-500 dark:text-gray-400 line-through">{fmtPrice(priceParsed)}</span>
                            <span className="text-lg font-bold text-[#DC2626]">{fmtPrice(Math.max(0, priceParsed - Math.round(parseFloat(promoFixedVal) * 100)))}</span>
                            <span className="px-2 py-0.5 bg-[#DC2626] text-white text-[10px] font-bold rounded">-{parseFloat(promoFixedVal).toFixed(2)}{"\u20AC"}</span>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Pack promo (PIECE / BARQUETTE only) */}
              {(unit === "PIECE" || unit === "BARQUETTE") && (
                <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Pack promo</span>
                    <button type="button" onClick={() => setPackEnabled(!packEnabled)}
                      className={`w-11 h-6 rounded-full transition-all relative ${packEnabled ? "bg-[#DC2626]" : "bg-gray-300 dark:bg-white/15"}`}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white dark:bg-gray-900 shadow transition-all ${packEnabled ? "left-[22px]" : "left-0.5"}`} />
                    </button>
                  </div>
                  {packEnabled && (
                    <>
                      <Input value={packContent} onChange={e => setPackContent(e.target.value)}
                        placeholder="Contenu du pack (ex: 4 steaks haches + 2 merguez)" className="h-9 text-sm" />
                      <Input value={packWeightVal} onChange={e => setPackWeightVal(e.target.value)}
                        placeholder="Poids total (ex: 1.2 kg)" className="h-9 text-sm" />
                      <div className="relative">
                        <Input type="number" step="0.01" min="0" value={packOldPrice}
                          onChange={e => setPackOldPrice(e.target.value)}
                          placeholder="Ancien prix (avant pack)" className="h-9 text-sm pr-8" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400">{"\u20AC"}</span>
                      </div>
                      {priceParsed > 0 && parseFloat(packOldPrice || "0") > 0 && (
                        <div className="flex items-center gap-2 bg-white dark:bg-[#0a0a0a] rounded-lg p-3 border border-[#ece8e3] dark:border-white/10">
                          <span className="text-sm text-gray-500 dark:text-gray-400 line-through">{fmtPrice(Math.round(parseFloat(packOldPrice) * 100))}</span>
                          <span className="text-lg font-bold text-green-600">{fmtPrice(priceParsed)}</span>
                          <span className="px-2 py-0.5 bg-green-600 text-white text-[10px] font-bold rounded">
                            -{Math.round((1 - priceParsed / Math.round(parseFloat(packOldPrice) * 100)) * 100)}%
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              </>)}

              {/* Weight config (for KG and TRANCHE) */}
              {(unit === "KG" || unit === "TRANCHE") && (
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

              {/* Calculateur pièces (only for KG) */}
              {unit === "KG" && (
                <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl p-4 space-y-3 border border-blue-200 dark:border-blue-800/30">
                  <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                    Calculateur pieces <span className="text-blue-400 font-normal text-xs">(optionnel)</span>
                  </span>
                  <p className="text-xs text-blue-500 dark:text-blue-400">
                    Si ce produit se vend aussi a la piece (ex: merguez 80g/piece), le client pourra choisir un nombre de pieces.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Poids par piece (g)</p>
                      <Input type="number" value={weightPerPiece ?? ""} onChange={e => setWeightPerPiece(e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="ex: 80" className="h-9 text-sm" min={1} max={5000} />
                    </div>
                    <div>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Nom de la piece</p>
                      <Input value={pieceLabel} onChange={e => setPieceLabel(e.target.value)}
                        placeholder="ex: merguez" className="h-9 text-sm" />
                    </div>
                  </div>
                  {weightPerPiece && (
                    <div>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Marge estimation (%)</p>
                      <div className="flex gap-1.5">
                        {[5, 10, 15, 20, 25].map(m => (
                          <button key={m} type="button" onClick={() => setWeightMargin(m)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold min-h-[36px] transition-all ${
                              weightMargin === m ? "bg-blue-600 text-white" : "bg-white dark:bg-[#0a0a0a] border border-[#ece8e3] dark:border-white/10 text-gray-600 dark:text-gray-400"
                            }`}>
                            &plusmn;{m}%
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Slice options (only for TRANCHE) */}
              {unit === "TRANCHE" && (
                <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-4 space-y-3">
                  <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">Options tranches</span>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Par defaut</p>
                      <Input
                        type="number"
                        value={defaultSlices}
                        onChange={(e) => setDefaultSlices(Number(e.target.value))}
                        min={1} max={50} className="h-9"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Min</p>
                      <Input
                        type="number"
                        value={minSlices}
                        onChange={(e) => setMinSlices(Number(e.target.value))}
                        min={1} max={50} className="h-9"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Max</p>
                      <Input
                        type="number"
                        value={maxSlices}
                        onChange={(e) => setMaxSlices(Number(e.target.value))}
                        min={1} max={50} className="h-9"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Epaisseurs disponibles</p>
                    <div className="flex flex-wrap gap-2">
                      {([
                        { key: "chiffonnade", label: "Chiffonnade", weight: "15g/tr" },
                        { key: "fine", label: "Fine", weight: "30g/tr" },
                        { key: "moyenne", label: "Moyenne", weight: "50g/tr" },
                      ] as const).map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() =>
                            setThicknesses((prev) =>
                              prev.includes(t.key) ? prev.filter((x) => x !== t.key) : [...prev, t.key]
                            )
                          }
                          className={`px-3 py-2 rounded-lg text-xs font-bold min-h-[36px] transition-all ${
                            thicknesses.includes(t.key)
                              ? "bg-amber-600 text-white"
                              : "bg-white dark:bg-[#0a0a0a] border border-[#ece8e3] dark:border-white/10 text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {t.label} ({t.weight})
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* isActive toggle */}
              <div className="flex items-center justify-between bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Visible par les clients</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Desactive = le produit n&apos;apparait pas dans la boutique
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`w-12 h-6 rounded-full transition-all relative ${
                    isActive ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white dark:bg-gray-900 shadow-sm transition-all ${
                      isActive ? "left-[26px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
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
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">Le drapeau s&apos;affiche automatiquement sur la fiche produit</p>
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
                          <Loader2 className="w-6 h-6 animate-spin text-gray-500 dark:text-gray-400" />
                        </div>
                      ) : (
                        <Image src={img.url} alt={img.alt} width={120} height={120} className="w-full h-full object-cover" />
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
                      className="aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-white/15 flex flex-col items-center justify-center gap-1 text-gray-500 dark:text-gray-400 hover:border-[#DC2626] hover:text-[#DC2626] transition-all"
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
                      {unit === "KG" ? "Au poids" : unit === "PIECE" ? "A l'unite" : unit === "TRANCHE" ? "A la tranche" : "Barquette"}
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
            <div className="absolute inset-0 bg-black/40 rounded-t-2xl sm:rounded-2xl" role="presentation" onClick={() => setShowDeleteConfirm(false)} />
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

      {/* ── Catalog Import Dialog ── */}
      {showCatalogImport && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900 dark:text-white">Catalogue de reference</h3>
                <button onClick={() => setShowCatalogImport(false)} className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center">
                  <X size={14} className="text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              <input
                type="text"
                placeholder="Rechercher..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {catalogLoading ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Loader2 size={20} className="animate-spin mx-auto" />
                </div>
              ) : filteredCatalog.length === 0 ? (
                <p className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">Aucun produit trouve</p>
              ) : (
                filteredCatalog.map((ref) => (
                  <button
                    key={ref.id}
                    onClick={() => importFromCatalog(ref)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 text-left transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/10 overflow-hidden flex-shrink-0">
                      {ref.imageUrl ? (
                        <Image src={ref.imageUrl} alt="" width={40} height={40} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Package size={16} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ref.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {ref.category.emoji} {ref.category.name}
                        {ref.suggestedPrice ? ` • ${(ref.suggestedPrice / 100).toFixed(2)} €` : ""}
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
