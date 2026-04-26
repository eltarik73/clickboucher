// src/app/(boucher)/boucher/produits/ProductFormPage.tsx — Single-page product form (dark mode)
// TODO(refactor): largely duplicated with ProductForm.tsx (1708L), unify in a future refactor.
// This variant is the single-page version (used by boucher /produits/nouveau and /produits/[id]/modifier).
// ProductForm.tsx is the modal/4-step version (used by webmaster /catalogue/reference).
"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Loader2,
  Plus,
  X,
  Camera,
  Star,
  Trash2,
  AlertTriangle,
  Package,
  ChevronRight,
  Check,
  Search,
  Sparkles,
  Image as ImageIcon,
} from "lucide-react";
import { getFlag } from "@/lib/flags";
import { useNotify } from "@/components/ui/NotificationToast";
import ImageSearchModal from "@/components/boucher/ImageSearchModal";
import ImageGenerateModal from "@/components/boucher/ImageGenerateModal";
import ImageRetouchModal from "@/components/boucher/ImageRetouchModal";

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

type CutOption = { name: string; priceCents: number };

export type EditProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number;
  suggestedPrice?: number | null;
  proPriceCents: number | null;
  unit: string;
  categories: { id: string }[];
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
  cutOptions?: Array<CutOption> | null;
  promoFixedCents?: number | null;
  packContent?: string | null;
  packWeight?: string | null;
  packOldPriceCents?: number | null;
  originRegion?: string | null;
  raceDescription?: string | null;
  elevageMode?: string | null;
  elevageDetail?: string | null;
  halalMethod?: string | null;
  freshDate?: string | null;
  freshDetail?: string | null;
  images: { id: string; url: string; alt: string | null; order: number; isPrimary: boolean }[];
  labels: { id: string; name: string; color: string | null }[];
};

interface Props {
  shopId: string;
  categories: Category[];
  product?: EditProduct | null;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
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

const DEFAULT_LABELS: Array<{ name: string; type: "halal" | "quality" | "artisan" }> = [
  { name: "AVS", type: "halal" },
  { name: "Achahada", type: "halal" },
  { name: "Mosquee de Paris", type: "halal" },
  { name: "ARGML", type: "halal" },
  { name: "Halal Service", type: "halal" },
  { name: "Label Rouge", type: "quality" },
  { name: "Bio", type: "quality" },
  { name: "Race a Viande", type: "quality" },
  { name: "Fermier", type: "quality" },
  { name: "AOP", type: "quality" },
  { name: "IGP", type: "quality" },
  { name: "Fait Maison", type: "artisan" },
  { name: "Sans Additifs", type: "artisan" },
  { name: "Sans Nitrites", type: "artisan" },
];

const CUT_PRESETS: Record<string, CutOption[]> = {
  viande: [
    { name: "Avec os", priceCents: 0 },
    { name: "Sans os", priceCents: 0 },
    { name: "Desossee", priceCents: 0 },
  ],
  charcuterie: [
    { name: "Tranche normale", priceCents: 0 },
    { name: "Tranche fine", priceCents: 0 },
    { name: "Chiffonnade", priceCents: 0 },
  ],
  volaille: [
    { name: "Entier", priceCents: 0 },
    { name: "Decoupe", priceCents: 0 },
    { name: "Desosse", priceCents: 0 },
  ],
};

const ELEVAGE_MODES = [
  { label: "Plein air", value: "PLEIN_AIR" },
  { label: "Paturage", value: "PATURAGE" },
  { label: "Extensif", value: "EXTENSIF" },
  { label: "Label Rouge", value: "LABEL_ROUGE" },
  { label: "Bio", value: "BIO" },
  { label: "Conventionnel", value: "CONVENTIONNEL" },
];

const PROMO_PCTS = [5, 10, 15, 20, 25, 30];
const MIN_WEIGHTS = [100, 200, 250, 300, 500];
const WEIGHT_STEPS = [25, 50, 100];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function getLabelChipClass(type: "halal" | "quality" | "artisan", active: boolean) {
  if (!active) return "border-stone-700 bg-stone-800 text-stone-500";
  switch (type) {
    case "halal": return "border-green-600 bg-green-600/10 text-green-400";
    case "quality": return "border-red-600 bg-red-600/10 text-red-400";
    case "artisan": return "border-amber-500 bg-amber-500/10 text-amber-400";
  }
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export function ProductFormPage({ shopId, categories, product }: Props) {
  const router = useRouter();
  const isEdit = !!product;
  const { notify } = useNotify();

  // ── State ──
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Catalog import
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

  // Informations
  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [categoryIds, setCategoryIds] = useState<string[]>(product?.categories?.map((c) => c.id) || []);
  const [unit, setUnit] = useState<"KG" | "PIECE" | "BARQUETTE" | "TRANCHE">(
    (product?.unit as "KG" | "PIECE" | "BARQUETTE" | "TRANCHE") || "KG"
  );
  const [unitLabel, setUnitLabel] = useState(product?.unitLabel || "");
  const [isActive, setIsActive] = useState(product?.isActive !== false);

  // Origin
  const [origin, setOrigin] = useState(product?.origin || "");

  // Prix
  const initPrice = product?.priceCents ?? 0;
  const [priceCents, setPriceCents] = useState(initPrice ? (initPrice / 100).toFixed(2) : "");
  const [proPriceCents, setProPriceCents] = useState(
    product?.proPriceCents ? (product.proPriceCents / 100).toFixed(2) : ""
  );

  // Poids
  const [minWeightG, setMinWeightG] = useState(product?.minWeightG || 200);
  const [weightStepG, setWeightStepG] = useState(product?.weightStepG || 50);

  // Slice options (TRANCHE)
  const [defaultSlices, setDefaultSlices] = useState(product?.sliceOptions?.defaultSlices ?? 6);
  const [minSlices, setMinSlices] = useState(product?.sliceOptions?.minSlices ?? 2);
  const [maxSlices, setMaxSlices] = useState(product?.sliceOptions?.maxSlices ?? 20);
  const [thicknesses, setThicknesses] = useState<string[]>(
    product?.sliceOptions?.thicknesses ?? ["chiffonnade", "fine", "moyenne"]
  );

  // Qualite
  const [halalOrg, setHalalOrg] = useState(product?.halalOrg || "");
  const [freshness, setFreshness] = useState(product?.freshness || "FRAIS");
  const [race, setRace] = useState(product?.race || "");
  const [customerNote, setCustomerNote] = useState(product?.customerNote || "");

  // Tracabilite
  const [originRegion, setOriginRegion] = useState(product?.originRegion || "");
  const [raceDescription, setRaceDescription] = useState(product?.raceDescription || "");
  const [elevageMode, setElevageMode] = useState(product?.elevageMode || "");
  const [elevageDetail, setElevageDetail] = useState(product?.elevageDetail || "");
  const [halalMethod, setHalalMethod] = useState(product?.halalMethod || "");
  const [freshDate, setFreshDate] = useState(product?.freshDate ? product.freshDate.split("T")[0] : "");
  const [freshDetail, setFreshDetail] = useState(product?.freshDetail || "");

  // Labels
  const [labels, setLabels] = useState<LabelItem[]>(
    product?.labels.map((l) => ({ name: l.name, color: l.color })) || []
  );
  const [customLabel, setCustomLabel] = useState("");

  // Promo
  const [promoEnabled, setPromoEnabled] = useState(
    (product?.promoPct ?? 0) > 0 || (product?.promoFixedCents ?? 0) > 0
  );
  const [promoMode, setPromoMode] = useState<"percent" | "fixed">(
    product?.promoType === "FIXED_AMOUNT" ? "fixed" : "percent"
  );
  const [promoPct, setPromoPct] = useState(product?.promoPct || 10);
  const [promoFixedVal, setPromoFixedVal] = useState(
    product?.promoFixedCents ? (product.promoFixedCents / 100).toFixed(2) : ""
  );
  const [isFlash, setIsFlash] = useState(product?.promoType === "FLASH");
  const [flashHours, setFlashHours] = useState(3);

  // Cut options
  const [cutEnabled, setCutEnabled] = useState(
    Array.isArray(product?.cutOptions) && product.cutOptions.length > 0
  );
  const [cutOptionsList, setCutOptionsList] = useState<CutOption[]>(
    (product?.cutOptions as CutOption[]) || []
  );

  // Variantes
  const [variantsEnabled, setVariantsEnabled] = useState(
    (product?.variants?.length ?? 0) > 0
  );
  const [variants, setVariants] = useState<string[]>(product?.variants || []);
  const [variantInput, setVariantInput] = useState("");

  // Poids par piece
  const [piecesEnabled, setPiecesEnabled] = useState(!!product?.weightPerPiece);
  const [weightPerPiece, setWeightPerPiece] = useState<number | null>(product?.weightPerPiece ?? null);
  const [pieceLabel, setPieceLabel] = useState(product?.pieceLabel || "");
  const [weightMargin, setWeightMargin] = useState(product?.weightMargin ?? 15);

  // Pack promo
  const [packEnabled, setPackEnabled] = useState(!!product?.packContent);
  const [packContent, setPackContent] = useState(product?.packContent || "");
  const [packWeightVal, setPackWeightVal] = useState(product?.packWeight || "");
  const [packOldPrice, setPackOldPrice] = useState(
    product?.packOldPriceCents ? (product.packOldPriceCents / 100).toFixed(2) : ""
  );

  // Photos
  const [images, setImages] = useState<ImageItem[]>(
    product?.images.map((img) => ({
      url: img.url,
      alt: img.alt || "",
      isPrimary: img.isPrimary,
      order: img.order,
    })) || []
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Image Studio modals ──
  const [searchOpen, setSearchOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [retouchOpen, setRetouchOpen] = useState(false);

  function handleStudioSelect(url: string, alt: string) {
    setImages((prev) => {
      if (prev.length >= 5) return prev;
      return [
        ...prev,
        {
          url,
          alt: alt || name || "Produit",
          isPrimary: prev.length === 0,
          order: prev.length,
        },
      ];
    });
  }

  // ── Derived ──
  const priceParsed = Math.round(parseFloat(priceCents || "0") * 100);
  const promoPreviewPrice = promoEnabled && promoMode === "percent"
    ? Math.round(priceParsed * (1 - promoPct / 100))
    : promoEnabled && promoMode === "fixed"
      ? Math.max(0, priceParsed - Math.round(parseFloat(promoFixedVal || "0") * 100))
      : priceParsed;

  // ── Catalog import ──
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
    if (ref.halalOrg) setHalalOrg(ref.halalOrg);
    if (ref.freshness) setFreshness(ref.freshness);
    if (ref.race) setRace(ref.race);
    if (ref.customerNote) setCustomerNote(ref.customerNote);
    if (ref.minWeightG) setMinWeightG(ref.minWeightG);
    if (ref.weightStepG) setWeightStepG(ref.weightStepG);
    if (ref.variants?.length) { setVariants(ref.variants); setVariantsEnabled(true); }
    if (ref.weightPerPiece) { setWeightPerPiece(ref.weightPerPiece); setPiecesEnabled(true); }
    if (ref.pieceLabel) setPieceLabel(ref.pieceLabel);
    if (ref.weightMargin) setWeightMargin(ref.weightMargin);
    if (ref.labels?.length) setLabels(ref.labels.map((l) => ({ name: l.name, color: l.color })));
    if (ref.sliceOptions) {
      setDefaultSlices(ref.sliceOptions.defaultSlices);
      setMinSlices(ref.sliceOptions.minSlices);
      setMaxSlices(ref.sliceOptions.maxSlices);
      setThicknesses(ref.sliceOptions.thicknesses);
    }
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

  // ── Image handling ──
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
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/uploads/product-image", { method: "POST", body: formData });
        if (res.ok) {
          const json = await res.json();
          setImages((prev) => prev.map((img) => img.url === tempUrl ? { ...img, url: json.data.url, uploading: false } : img));
        } else {
          setImages((prev) => prev.filter((img) => img.url !== tempUrl));
        }
      } catch {
        setImages((prev) => prev.filter((img) => img.url !== tempUrl));
      }
    }
  }

  function removeImage(idx: number) {
    const img = images[idx];
    if (img.url.startsWith("/api/uploads/") || img.url.includes(".public.blob.vercel-storage.com")) {
      fetch("/api/uploads/product-image", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: img.url }),
      }).catch(() => {});
    }
    const updated = images.filter((_, i) => i !== idx);
    if (updated.length > 0 && !updated.some((i) => i.isPrimary)) {
      updated[0].isPrimary = true;
    }
    setImages(updated.map((img, i) => ({ ...img, order: i })));
  }

  function setPrimary(idx: number) {
    setImages((prev) => prev.map((img, i) => ({ ...img, isPrimary: i === idx })));
  }

  // ── Labels ──
  function addLabel(labelName: string) {
    if (labels.some((l) => l.name === labelName)) return;
    const def = DEFAULT_LABELS.find((d) => d.name === labelName);
    const color = def
      ? def.type === "halal" ? "#16a34a" : def.type === "quality" ? "#DC2626" : "#f59e0b"
      : "#DC2626";
    setLabels([...labels, { name: labelName, color }]);
  }

  function removeLabel(labelName: string) {
    setLabels(labels.filter((l) => l.name !== labelName));
  }

  // ── Submit ──
  async function handleSubmit() {
    if (!name.trim() || categoryIds.length === 0 || parseFloat(priceCents) <= 0) {
      setApiError("Veuillez remplir le nom, au moins une categorie et le prix");
      return;
    }

    setSubmitting(true);
    setApiError(null);

    const priceVal = Math.round(parseFloat(priceCents) * 100);
    const proVal = proPriceCents ? Math.round(parseFloat(proPriceCents) * 100) : null;

    const body: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || null,
      categoryIds,
      unit,
      origin: origin || null,
      halalOrg: halalOrg || null,
      race: race.trim() || null,
      freshness: freshness || null,
      customerNote: customerNote.trim() || null,
      originRegion: originRegion.trim() || null,
      raceDescription: raceDescription.trim() || null,
      elevageMode: elevageMode || null,
      elevageDetail: elevageDetail.trim() || null,
      halalMethod: halalMethod.trim() || null,
      freshDate: freshDate ? new Date(freshDate).toISOString() : null,
      freshDetail: freshDetail.trim() || null,
      tags: [],
      isActive,
      priceCents: priceVal,
      proPriceCents: proVal,
      shopId,
      unitLabel: unitLabel.trim() || null,
    };

    // Promo
    if (promoEnabled && promoMode === "fixed") {
      body.promoFixedCents = Math.round(parseFloat(promoFixedVal || "0") * 100);
      body.promoType = "FIXED_AMOUNT";
      body.promoPct = null;
      body.promoEnd = null;
    } else if (promoEnabled && promoMode === "percent") {
      body.promoPct = promoPct;
      body.promoType = isFlash ? "FLASH" : "PERCENTAGE";
      body.promoEnd = isFlash ? new Date(Date.now() + flashHours * 3600_000).toISOString() : null;
      body.promoFixedCents = null;
    } else {
      body.promoPct = null;
      body.promoType = null;
      body.promoEnd = null;
      body.promoFixedCents = null;
    }

    // Pack
    body.packContent = packEnabled ? packContent.trim() || null : null;
    body.packWeight = packEnabled ? packWeightVal.trim() || null : null;
    body.packOldPriceCents = packEnabled && packOldPrice ? Math.round(parseFloat(packOldPrice) * 100) : null;

    // Weight config
    if (unit === "KG" || unit === "TRANCHE") {
      body.minWeightG = minWeightG;
      body.weightStepG = weightStepG;
    }

    // Slice options
    if (unit === "TRANCHE") {
      body.sliceOptions = { defaultSlices, minSlices, maxSlices, thicknesses };
    } else {
      body.sliceOptions = null;
    }

    // Variantes
    body.variants = variantsEnabled ? variants : [];

    // Cut options
    body.cutOptions = cutEnabled && cutOptionsList.length > 0 ? cutOptionsList : null;

    // Calculateur pieces
    if (piecesEnabled && unit === "KG" && weightPerPiece) {
      body.weightPerPiece = weightPerPiece;
      body.pieceLabel = pieceLabel.trim() || null;
      body.weightMargin = weightMargin;
    } else {
      body.weightPerPiece = null;
      body.pieceLabel = null;
    }

    // Images
    const uploadedImages = images.filter((i) => !i.uploading && (i.url.startsWith("/api/") || i.url.startsWith("https://")));
    body.images = uploadedImages.map((img, i) => ({
      url: img.url,
      alt: img.alt || name,
      order: i,
      isPrimary: img.isPrimary,
    }));

    // Labels
    body.labels = labels.map((l) => ({ name: l.name, color: l.color }));

    try {
      const url = isEdit ? `/api/products/${product!.id}` : "/api/products";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        notify("success", isEdit ? "Produit modifie !" : "Produit cree !");
        router.push("/boucher/produits");
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

  // ── Delete ──
  async function handleDelete() {
    if (!product) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      if (res.ok) {
        notify("success", "Produit supprime");
        router.push("/boucher/produits");
      } else {
        const json = await res.json().catch(() => null);
        notify("error", json?.error?.message || "Erreur lors de la suppression");
      }
    } catch {
      notify("error", "Erreur de connexion");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  // ── Scroll to top on mount ──
  useEffect(() => { window.scrollTo(0, 0); }, []);

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-950 pb-24">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-stone-950/95 backdrop-blur border-b border-stone-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/boucher/produits")}
            className="w-9 h-9 rounded-full bg-stone-800 flex items-center justify-center hover:bg-stone-700 transition-colors"
          >
            <ArrowLeft size={18} className="text-stone-300" />
          </button>
          <h1 className="text-lg font-bold text-white font-[family-name:var(--font-outfit)]">
            {isEdit ? "Modifier le produit" : "Nouveau produit"}
          </h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ── Import from catalog (create mode only) ── */}
        {!isEdit && (
          <button
            type="button"
            onClick={openCatalogImport}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-red-600/30 rounded-2xl text-sm font-medium text-red-500 hover:bg-red-600/5 transition-colors"
          >
            <Package size={16} />
            Importer depuis le catalogue
          </button>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION 1: Informations                     */}
        {/* ═══════════════════════════════════════════ */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Package size={16} className="text-stone-400" />
            Informations
          </h2>

          {/* Nom */}
          <div>
            <label className="text-xs font-semibold text-stone-400 mb-1.5 block">Nom du produit *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Entrecote maturee"
              className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-red-600/40 focus:border-red-600"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-stone-400 mb-1.5 block">
              Description <span className="text-stone-600 font-normal">({description.length}/120)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 120))}
              placeholder="Description courte du produit..."
              rows={2}
              className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-stone-500 resize-none focus:outline-none focus:ring-2 focus:ring-red-600/40 focus:border-red-600"
            />
          </div>

          {/* Categories (multi-select, max 3) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-stone-400">Categories * <span className="text-stone-500 font-normal">(max 3)</span></label>
              {categoryIds.length > 0 && (
                <span className="text-[10px] font-bold text-red-500">{categoryIds.length}/3</span>
              )}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {categories.map((cat) => {
                const isSelected = categoryIds.includes(cat.id);
                const isMax = categoryIds.length >= 3 && !isSelected;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    disabled={isMax}
                    onClick={() => {
                      if (isSelected) {
                        setCategoryIds(categoryIds.filter((id) => id !== cat.id));
                      } else {
                        setCategoryIds([...categoryIds, cat.id]);
                      }
                    }}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all min-h-[56px] relative ${
                      isSelected
                        ? "bg-red-600/10 border-red-600 text-red-500"
                        : isMax
                        ? "bg-stone-900 border-stone-800 text-stone-600 cursor-not-allowed opacity-40"
                        : "bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center">
                        <Check size={10} className="text-white" />
                      </div>
                    )}
                    <span className="text-lg">{cat.emoji || "\u{1F969}"}</span>
                    <span className="text-[10px] font-medium leading-tight text-center">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Origine */}
          <div>
            <label className="text-xs font-semibold text-stone-400 mb-2 block">Origine</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {ORIGINS.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setOrigin(origin === o.value ? "" : o.value)}
                  className={`flex items-center gap-1.5 p-2 rounded-xl border transition-all ${
                    origin === o.value
                      ? "bg-blue-600/10 border-blue-600 text-blue-400"
                      : "bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-600"
                  }`}
                >
                  <span className="text-sm">{getFlag(o.flag)}</span>
                  <span className="text-[10px] font-medium">{o.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Prix + Unite */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-stone-400 mb-1.5 block">Prix *</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceCents}
                  onChange={(e) => setPriceCents(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm text-white pr-8 focus:outline-none focus:ring-2 focus:ring-red-600/40 focus:border-red-600"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500">{"\u20AC"}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-400 mb-1.5 block">Unite</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as "KG" | "PIECE" | "BARQUETTE" | "TRANCHE")}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-600/40 focus:border-red-600"
              >
                <option value="KG">Au kilo (kg)</option>
                <option value="PIECE">A la piece</option>
                <option value="BARQUETTE">Barquette</option>
                <option value="TRANCHE">A la tranche</option>
              </select>
            </div>
          </div>

          {/* Prix PRO */}
          <div>
            <label className="text-xs font-semibold text-stone-400 mb-1.5 block">
              Prix PRO <span className="text-stone-600 font-normal">(optionnel)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={proPriceCents}
                onChange={(e) => setProPriceCents(e.target.value)}
                placeholder="Visible par les pros"
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm text-white pr-8 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-red-600/40 focus:border-red-600"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500">{"\u20AC"}</span>
            </div>
          </div>

          {/* Weight config (KG / TRANCHE) */}
          {(unit === "KG" || unit === "TRANCHE") && (
            <div className="bg-stone-800/50 rounded-xl p-4 space-y-3">
              <span className="text-xs font-semibold text-stone-300">Configuration poids</span>
              <div>
                <p className="text-[10px] text-stone-500 mb-1.5">Poids minimum</p>
                <div className="flex flex-wrap gap-1.5">
                  {MIN_WEIGHTS.map((w) => (
                    <button key={w} type="button" onClick={() => setMinWeightG(w)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        minWeightG === w ? "bg-white dark:bg-gray-900 text-stone-900" : "bg-stone-800 border border-stone-700 text-stone-400"
                      }`}>
                      {w}g
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-stone-500 mb-1.5">Palier de poids</p>
                <div className="flex flex-wrap gap-1.5">
                  {WEIGHT_STEPS.map((w) => (
                    <button key={w} type="button" onClick={() => setWeightStepG(w)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        weightStepG === w ? "bg-white dark:bg-gray-900 text-stone-900" : "bg-stone-800 border border-stone-700 text-stone-400"
                      }`}>
                      {w}g
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Slice options (TRANCHE) */}
          {unit === "TRANCHE" && (
            <div className="bg-amber-950/30 border border-amber-800/30 rounded-xl p-4 space-y-3">
              <span className="text-xs font-semibold text-amber-400">Options tranches</span>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] text-stone-500 mb-1">Par defaut</p>
                  <input type="number" value={defaultSlices} onChange={(e) => setDefaultSlices(Number(e.target.value))}
                    min={1} max={50} className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <p className="text-[10px] text-stone-500 mb-1">Min</p>
                  <input type="number" value={minSlices} onChange={(e) => setMinSlices(Number(e.target.value))}
                    min={1} max={50} className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <p className="text-[10px] text-stone-500 mb-1">Max</p>
                  <input type="number" value={maxSlices} onChange={(e) => setMaxSlices(Number(e.target.value))}
                    min={1} max={50} className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-white" />
                </div>
              </div>
              <div>
                <p className="text-[10px] text-stone-500 mb-2">Epaisseurs</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: "chiffonnade", label: "Chiffonnade", weight: "15g/tr" },
                    { key: "fine", label: "Fine", weight: "30g/tr" },
                    { key: "moyenne", label: "Moyenne", weight: "50g/tr" },
                  ] as const).map((t) => (
                    <button key={t.key} type="button"
                      onClick={() => setThicknesses((prev) => prev.includes(t.key) ? prev.filter((x) => x !== t.key) : [...prev, t.key])}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        thicknesses.includes(t.key) ? "bg-amber-600 text-white" : "bg-stone-800 border border-stone-700 text-stone-400"
                      }`}>
                      {t.label} ({t.weight})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Visible toggle */}
          <div className="flex items-center justify-between bg-stone-800/50 rounded-xl px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-stone-300">Visible par les clients</p>
              <p className="text-[10px] text-stone-600 mt-0.5">Desactive = le produit n&apos;apparait pas</p>
            </div>
            <ToggleSwitch checked={isActive} onChange={setIsActive} color="emerald" />
          </div>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION 2: Pack promo (conditional)         */}
        {/* ═══════════════════════════════════════════ */}
        {(unit === "PIECE" || unit === "BARQUETTE") && (
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="text-base">🏷️</span> Pack promo
              </h2>
              <ToggleSwitch checked={packEnabled} onChange={setPackEnabled} />
            </div>
            {packEnabled && (
              <>
                <input value={packContent} onChange={(e) => setPackContent(e.target.value)}
                  placeholder="Contenu du pack (ex: 4 steaks + 2 merguez)"
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-stone-500" />
                <input value={packWeightVal} onChange={(e) => setPackWeightVal(e.target.value)}
                  placeholder="Poids total (ex: 1.2 kg)"
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-stone-500" />
                <div className="relative">
                  <input type="number" step="0.01" min="0" value={packOldPrice}
                    onChange={(e) => setPackOldPrice(e.target.value)}
                    placeholder="Ancien prix (avant pack)"
                    className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm text-white pr-8 placeholder:text-stone-500" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500">{"\u20AC"}</span>
                </div>
                {priceParsed > 0 && parseFloat(packOldPrice || "0") > 0 && (
                  <div className="flex items-center gap-2 bg-stone-800 rounded-xl p-3 border border-stone-700">
                    <span className="text-sm text-stone-500 line-through">{fmtPrice(Math.round(parseFloat(packOldPrice) * 100))}</span>
                    <span className="text-lg font-bold text-green-500">{fmtPrice(priceParsed)}</span>
                    <span className="px-2 py-0.5 bg-green-600 text-white text-[10px] font-bold rounded">
                      -{Math.round((1 - priceParsed / Math.round(parseFloat(packOldPrice) * 100)) * 100)}%
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION 3: Labels & Certifications          */}
        {/* ═══════════════════════════════════════════ */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="text-base">🏅</span> Labels & Certifications
          </h2>

          {/* Label chips */}
          <div className="flex flex-wrap gap-1.5">
            {DEFAULT_LABELS.map((dl) => {
              const active = labels.some((l) => l.name === dl.name);
              return (
                <button
                  key={dl.name}
                  type="button"
                  onClick={() => active ? removeLabel(dl.name) : addLabel(dl.name)}
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${getLabelChipClass(dl.type, active)}`}
                >
                  {active && <Check size={12} className="inline mr-1" />}
                  {dl.name}
                </button>
              );
            })}
          </div>

          {/* Custom label input */}
          <div className="flex gap-2">
            <input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Label personnalise..."
              className="flex-1 bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-stone-500"
              onKeyDown={(e) => {
                if (e.key === "Enter" && customLabel.trim()) {
                  e.preventDefault();
                  addLabel(customLabel.trim());
                  setCustomLabel("");
                }
              }}
            />
            <button
              type="button"
              disabled={!customLabel.trim()}
              onClick={() => { addLabel(customLabel.trim()); setCustomLabel(""); }}
              className="px-3 py-2 bg-stone-800 border border-stone-700 rounded-xl text-stone-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Active labels preview */}
          {labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {labels.map((l) => {
                const dl = DEFAULT_LABELS.find((d) => d.name === l.name);
                const type = dl?.type || "artisan";
                return (
                  <span
                    key={l.name}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${getLabelChipClass(type, true)}`}
                  >
                    {l.name}
                    <button type="button" onClick={() => removeLabel(l.name)} className="ml-0.5 hover:opacity-70">
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION 3b: Tracabilite                     */}
        {/* ═══════════════════════════════════════════ */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="text-base">🛡️</span> Fiche Confiance — Tracabilite
          </h2>
          <p className="text-[11px] text-stone-500">
            Ces informations apparaissent sur la fiche produit cote client. Plus vous remplissez, plus votre score de transparence augmente.
          </p>

          {/* Origine region */}
          <div>
            <label className="text-xs text-stone-400 mb-1 block">Region d&apos;origine</label>
            <input
              value={originRegion}
              onChange={(e) => setOriginRegion(e.target.value)}
              placeholder="Ex: Auvergne, Limousin, Galice..."
              className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-stone-500"
            />
          </div>

          {/* Race description */}
          {race && (
            <div>
              <label className="text-xs text-stone-400 mb-1 block">Description de la race ({race})</label>
              <textarea
                value={raceDescription}
                onChange={(e) => setRaceDescription(e.target.value)}
                placeholder="Ex: Race rustique elevee en montagne, chair persilee et gout prononce..."
                rows={2}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-stone-500 resize-none"
              />
            </div>
          )}

          {/* Elevage mode */}
          <div>
            <label className="text-xs text-stone-400 mb-1.5 block">Mode d&apos;elevage</label>
            <div className="flex flex-wrap gap-1.5">
              {ELEVAGE_MODES.map((em) => (
                <button
                  key={em.value}
                  type="button"
                  onClick={() => setElevageMode(elevageMode === em.value ? "" : em.value)}
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                    elevageMode === em.value
                      ? "border-green-600 bg-green-600/10 text-green-400"
                      : "border-stone-700 bg-stone-800 text-stone-500"
                  }`}
                >
                  {elevageMode === em.value && <Check size={12} className="inline mr-1" />}
                  {em.label}
                </button>
              ))}
            </div>
          </div>

          {/* Elevage detail */}
          {elevageMode && (
            <div>
              <label className="text-xs text-stone-400 mb-1 block">Detail elevage</label>
              <input
                value={elevageDetail}
                onChange={(e) => setElevageDetail(e.target.value)}
                placeholder="Ex: Ferme familiale depuis 3 generations, nourri a l'herbe..."
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-stone-500"
              />
            </div>
          )}

          {/* Halal method */}
          {halalOrg && (
            <div>
              <label className="text-xs text-stone-400 mb-1 block">Methode d&apos;abattage halal</label>
              <textarea
                value={halalMethod}
                onChange={(e) => setHalalMethod(e.target.value)}
                placeholder="Ex: Abattage rituel certifie, sans etourdissement prealable..."
                rows={2}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-stone-500 resize-none"
              />
            </div>
          )}

          {/* Freshness date + detail */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-400 mb-1 block">Date de fraicheur</label>
              <input
                type="date"
                value={freshDate}
                onChange={(e) => setFreshDate(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-stone-400 mb-1 block">Detail fraicheur</label>
              <input
                value={freshDetail}
                onChange={(e) => setFreshDetail(e.target.value)}
                placeholder="Ex: Arrivage du jour"
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-stone-500"
              />
            </div>
          </div>

          {/* Transparency score preview */}
          {(() => {
            const fields = [origin, originRegion, race, raceDescription, elevageMode, elevageDetail, halalOrg, halalMethod, freshDate, freshDetail];
            const filled = fields.filter(Boolean).length;
            const score = Math.round((filled / fields.length) * 100);
            return filled > 0 ? (
              <div className="flex items-center gap-3 mt-2 p-3 rounded-xl bg-stone-800/50 border border-stone-700/50">
                <div className="relative w-10 h-10 flex-shrink-0">
                  <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#292524" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15" fill="none" stroke={score >= 70 ? "#16A34A" : score >= 40 ? "#CA8A04" : "#DC2626"} strokeWidth="3" strokeDasharray={`${score * 0.94} 100`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">{score}%</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Score transparence : {score}%</p>
                  <p className="text-[10px] text-stone-500">{filled}/{fields.length} champs remplis — {score >= 70 ? "Excellent !" : score >= 40 ? "Bien, continuez !" : "Ajoutez plus de details"}</p>
                </div>
              </div>
            ) : null;
          })()}
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION 4: Reduction                        */}
        {/* ═══════════════════════════════════════════ */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="text-base text-red-500">🔴</span> Reduction
            </h2>
            <ToggleSwitch checked={promoEnabled} onChange={setPromoEnabled} />
          </div>

          {promoEnabled && (
            <>
              {/* Mode selector */}
              <div className="flex rounded-xl overflow-hidden border border-stone-700">
                {(["percent", "fixed"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setPromoMode(m)}
                    className={`flex-1 py-2.5 text-xs font-bold transition-all ${
                      promoMode === m ? "bg-red-600 text-white" : "bg-stone-800 text-stone-400"
                    }`}>
                    {m === "percent" ? "Pourcentage" : "Montant fixe"}
                  </button>
                ))}
              </div>

              {promoMode === "percent" ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {PROMO_PCTS.map((pct) => (
                      <button key={pct} type="button" onClick={() => setPromoPct(pct)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          promoPct === pct ? "bg-red-600 text-white" : "bg-stone-800 border border-stone-700 text-stone-400"
                        }`}>
                        -{pct}%
                      </button>
                    ))}
                  </div>
                  {/* Flash toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-stone-400">Promo Flash</span>
                    <ToggleSwitch checked={isFlash} onChange={setIsFlash} color="orange" />
                  </div>
                  {isFlash && (
                    <div className="flex flex-wrap gap-1.5">
                      {[1, 2, 3, 6, 12, 24].map((h) => (
                        <button key={h} type="button" onClick={() => setFlashHours(h)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            flashHours === h ? "bg-orange-500 text-white" : "bg-stone-800 border border-stone-700 text-stone-400"
                          }`}>
                          {h}h
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="relative">
                  <input type="number" step="0.01" min="0" value={promoFixedVal}
                    onChange={(e) => setPromoFixedVal(e.target.value)}
                    placeholder="Montant de la reduction"
                    className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm text-white pr-8 placeholder:text-stone-500" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500">{"\u20AC"}</span>
                </div>
              )}

              {/* Price preview */}
              {priceParsed > 0 && (promoMode === "percent" || parseFloat(promoFixedVal || "0") > 0) && (
                <div className="flex items-center gap-2 bg-stone-800 rounded-xl p-3 border border-stone-700">
                  <span className="text-sm text-stone-500 line-through">{fmtPrice(priceParsed)}</span>
                  <span className="text-lg font-bold text-red-500">{fmtPrice(promoPreviewPrice)}</span>
                  <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded">
                    {promoMode === "percent" ? `-${promoPct}%` : `-${parseFloat(promoFixedVal || "0").toFixed(2)}\u20AC`}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION 5: Options de decoupe               */}
        {/* ═══════════════════════════════════════════ */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="text-base">🔪</span> Options de decoupe
            </h2>
            <ToggleSwitch checked={cutEnabled} onChange={setCutEnabled} />
          </div>

          {cutEnabled && (
            <>
              {/* Presets */}
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(CUT_PRESETS).map(([key, options]) => (
                  <button key={key} type="button"
                    onClick={() => setCutOptionsList(options.map((o) => ({
                      ...o,
                      priceCents: priceParsed,
                    })))}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-stone-800 border border-stone-700 text-stone-400 hover:bg-stone-700 transition-colors capitalize">
                    {key === "viande" ? "🥩 Viande" : key === "charcuterie" ? "🔪 Charcuterie" : "🍗 Volaille"}
                  </button>
                ))}
                <button type="button"
                  onClick={() => setCutOptionsList([])}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-stone-800 border border-stone-700 text-stone-400 hover:bg-stone-700 transition-colors">
                  ✏️ Vide
                </button>
              </div>

              {/* Editable rows */}
              {cutOptionsList.map((opt, idx) => (
                <div key={idx} className="bg-stone-800 border border-stone-700 rounded-xl p-3 flex items-center gap-2">
                  <input value={opt.name}
                    onChange={(e) => { const next = [...cutOptionsList]; next[idx] = { ...next[idx], name: e.target.value }; setCutOptionsList(next); }}
                    placeholder="Nom option"
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-stone-500 focus:outline-none" />
                  <div className="relative w-24">
                    <input type="number" step="0.01" min="0"
                      value={(opt.priceCents / 100).toFixed(2)}
                      onChange={(e) => { const next = [...cutOptionsList]; next[idx] = { ...next[idx], priceCents: Math.round(parseFloat(e.target.value || "0") * 100) }; setCutOptionsList(next); }}
                      className="w-full bg-stone-700 border border-stone-600 rounded-lg px-2 py-1.5 text-sm text-white pr-7" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-stone-500">{"\u20AC"}/kg</span>
                  </div>
                  <button type="button" onClick={() => setCutOptionsList(cutOptionsList.filter((_, i) => i !== idx))}
                    className="text-stone-500 hover:text-red-500 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              ))}

              <button type="button"
                onClick={() => setCutOptionsList([...cutOptionsList, { name: "", priceCents: priceParsed }])}
                className="flex items-center gap-1 text-xs font-medium text-red-500 hover:underline">
                <Plus size={14} /> Ajouter une option
              </button>
            </>
          )}
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION 6: Variantes de gout                */}
        {/* ═══════════════════════════════════════════ */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="text-base">🌶️</span> Variantes de gout
            </h2>
            <ToggleSwitch checked={variantsEnabled} onChange={setVariantsEnabled} />
          </div>

          {variantsEnabled && (
            <>
              {/* Tags */}
              {variants.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {variants.map((v, i) => (
                    <span key={i} className="bg-red-600/10 text-red-500 px-3 py-1.5 rounded-lg text-sm font-semibold inline-flex items-center gap-1">
                      {v}
                      <button type="button" onClick={() => setVariants(variants.filter((_, j) => j !== i))}
                        className="hover:text-red-300">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Quick add */}
              <div className="flex flex-wrap gap-1.5">
                {["Nature", "Tex-Mex", "Curry", "Herbes", "Piment", "Ail"].filter((s) => !variants.includes(s)).map((s) => (
                  <button key={s} type="button" onClick={() => setVariants([...variants, s])}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium bg-stone-800 border border-stone-700 text-stone-400 hover:bg-stone-700 transition-colors">
                    + {s}
                  </button>
                ))}
              </div>

              {/* Custom input */}
              <div className="flex gap-2">
                <input value={variantInput} onChange={(e) => setVariantInput(e.target.value)}
                  placeholder="Autre saveur..."
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-stone-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && variantInput.trim()) {
                      e.preventDefault();
                      if (!variants.includes(variantInput.trim())) setVariants([...variants, variantInput.trim()]);
                      setVariantInput("");
                    }
                  }} />
                <button type="button"
                  disabled={!variantInput.trim() || variants.includes(variantInput.trim())}
                  onClick={() => { if (variantInput.trim() && !variants.includes(variantInput.trim())) setVariants([...variants, variantInput.trim()]); setVariantInput(""); }}
                  className="px-3 py-2 bg-stone-800 border border-stone-700 rounded-xl text-stone-400 hover:text-white disabled:opacity-30 transition-colors">
                  <Plus size={16} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION 7: Poids par piece                  */}
        {/* ═══════════════════════════════════════════ */}
        {unit === "KG" && (
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="text-base">⚖️</span> Poids par piece
              </h2>
              <ToggleSwitch checked={piecesEnabled} onChange={setPiecesEnabled} />
            </div>

            {piecesEnabled && (
              <>
                <p className="text-[10px] text-stone-500">
                  Si le produit se vend aussi a la piece (ex: merguez 80g/piece), le client pourra choisir un nombre de pieces.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-stone-500 mb-1 block">Poids par piece (g)</label>
                    <input type="number" value={weightPerPiece ?? ""} onChange={(e) => setWeightPerPiece(e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="ex: 80" min={1} max={5000}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-stone-500" />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-500 mb-1 block">Nom de la piece</label>
                    <input value={pieceLabel} onChange={(e) => setPieceLabel(e.target.value)}
                      placeholder="ex: merguez"
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-stone-500" />
                  </div>
                </div>
                {weightPerPiece && (
                  <div>
                    <p className="text-[10px] text-stone-500 mb-1.5">Marge estimation (%)</p>
                    <div className="flex gap-1.5">
                      {[5, 10, 15, 20, 25].map((m) => (
                        <button key={m} type="button" onClick={() => setWeightMargin(m)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            weightMargin === m ? "bg-blue-600 text-white" : "bg-stone-800 border border-stone-700 text-stone-400"
                          }`}>
                          &plusmn;{m}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION 8: Photo & Apercu                   */}
        {/* ═══════════════════════════════════════════ */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Camera size={16} className="text-stone-400" />
            Photo & Apercu
          </h2>

          <div className="grid grid-cols-2 gap-4">
            {/* Upload zone */}
            <div className="space-y-2">
              <p className="text-[10px] text-stone-500">Photos (max 5)</p>
              {images.length < 5 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[44px] px-3 py-2 text-[11px] font-semibold rounded-lg bg-stone-800 border border-stone-700 text-stone-200 hover:border-red-600 hover:text-red-500 flex items-center gap-1.5 transition-all"
                  >
                    <Camera size={14} /> Upload
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchOpen(true)}
                    className="min-h-[44px] px-3 py-2 text-[11px] font-semibold rounded-lg bg-stone-800 border border-stone-700 text-stone-200 hover:border-red-600 hover:text-red-500 flex items-center gap-1.5 transition-all"
                  >
                    <Search size={14} /> Chercher
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenerateOpen(true)}
                    className="min-h-[44px] px-3 py-2 text-[11px] font-semibold rounded-lg bg-gradient-to-r from-red-600 to-red-700 text-white hover:opacity-90 flex items-center gap-1.5 transition-all"
                  >
                    <Sparkles size={14} /> Générer IA
                  </button>
                  <button
                    type="button"
                    onClick={() => setRetouchOpen(true)}
                    className="min-h-[44px] px-3 py-2 text-[11px] font-semibold rounded-lg bg-stone-800 border border-stone-700 text-stone-200 hover:border-red-600 hover:text-red-500 flex items-center gap-1.5 transition-all"
                  >
                    <ImageIcon size={14} /> Retoucher
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                {images.map((img, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-stone-700 bg-stone-800">
                    {img.uploading ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-stone-500" />
                      </div>
                    ) : (
                      <Image src={img.url} alt={img.alt} width={120} height={120} className="w-full h-full object-cover" />
                    )}
                    {img.isPrimary && (
                      <div className="absolute top-0.5 left-0.5 px-1 py-0.5 bg-red-600 text-white text-[7px] font-bold rounded">
                        #1
                      </div>
                    )}
                    <div className="absolute top-0.5 right-0.5 flex gap-0.5">
                      {!img.isPrimary && !img.uploading && (
                        <button type="button" onClick={() => setPrimary(idx)}
                          className="w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                          <Star size={8} className="text-white" />
                        </button>
                      )}
                      <button type="button" onClick={() => removeImage(idx)}
                        className="w-5 h-5 rounded-full bg-black/60 flex items-center justify-center hover:bg-red-600">
                        <X size={8} className="text-white" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                onChange={(e) => e.target.files && handleImageUpload(e.target.files)} />
            </div>

            {/* Live preview (client card) */}
            <div className="space-y-2">
              <p className="text-[10px] text-stone-500">Apercu client</p>
              <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-stone-200 shadow-sm">
                <div className="aspect-[4/3] bg-stone-100 relative overflow-hidden">
                  {images.length > 0 && !images[0].uploading ? (
                    <Image src={images[0].url} alt={name || "Produit"} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl text-stone-300">
                      {categories.find((c) => categoryIds.includes(c.id))?.emoji || "🥩"}
                    </div>
                  )}
                  {/* Promo badge */}
                  {promoEnabled && (
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-bold rounded">
                      {promoMode === "percent" ? `-${promoPct}%` : `-${parseFloat(promoFixedVal || "0").toFixed(2)}\u20AC`}
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 truncate">{name || "Nom du produit"}</p>
                  {/* Labels preview */}
                  {labels.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-1">
                      {labels.slice(0, 3).map((l) => {
                        const dl = DEFAULT_LABELS.find((d) => d.name === l.name);
                        const bgColor = dl?.type === "halal" ? "bg-green-100 text-green-700" : dl?.type === "quality" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";
                        return (
                          <span key={l.name} className={`px-1 py-0.5 rounded text-[7px] font-bold ${bgColor}`}>
                            {l.name}
                          </span>
                        );
                      })}
                      {labels.length > 3 && (
                        <span className="px-1 py-0.5 rounded text-[7px] font-bold bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400">+{labels.length - 3}</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-baseline gap-1.5 mt-1">
                    {promoEnabled && priceParsed > 0 ? (
                      <>
                        <span className="text-xs text-gray-500 dark:text-gray-400 line-through">{fmtPrice(priceParsed)}</span>
                        <span className="text-sm font-bold text-red-600">{fmtPrice(promoPreviewPrice)}</span>
                      </>
                    ) : (
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{priceParsed > 0 ? fmtPrice(priceParsed) : "—"}</span>
                    )}
                    <span className="text-[9px] text-gray-500 dark:text-gray-400">
                      /{unit === "KG" ? "kg" : unit === "PIECE" ? "pce" : unit === "TRANCHE" ? "kg" : "barq."}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Customer note */}
          <div>
            <label className="text-xs font-semibold text-stone-400 mb-1.5 block">Note pour le client</label>
            <textarea
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              placeholder="Ex: A consommer dans les 48h..."
              rows={2}
              className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-stone-500 resize-none focus:outline-none focus:ring-2 focus:ring-red-600/40 focus:border-red-600"
            />
          </div>
        </div>

        {/* Error display */}
        {apiError && (
          <div className="bg-red-950/40 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-400">
            {apiError}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* SAVE BAR (fixed bottom)                     */}
      {/* ═══════════════════════════════════════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-stone-950/95 backdrop-blur border-t border-stone-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {isEdit && (
            <button type="button" onClick={() => setShowDeleteConfirm(true)}
              className="p-2.5 rounded-xl border border-red-800/40 text-red-500 hover:bg-red-950/30 transition-colors">
              <Trash2 size={18} />
            </button>
          )}
          <div className="flex-1" />
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/boucher/produits")}
            className="h-11 px-5 border-stone-700 text-stone-400 hover:bg-stone-800"
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !name.trim() || categoryIds.length === 0 || parseFloat(priceCents || "0") <= 0}
            className="h-11 px-6 gap-1.5 bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <Check size={16} />
                Enregistrer
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Delete confirmation dialog ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 mx-6 max-w-sm w-full space-y-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-red-950/50 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-base font-bold text-white">Supprimer le produit</h3>
              <p className="text-sm text-stone-400">
                Cette action est irreversible. Le produit sera supprime definitivement.
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                className="flex-1 h-11 border-stone-700 text-stone-400">
                Annuler
              </Button>
              <Button type="button" onClick={handleDelete} disabled={deleting}
                className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white gap-1.5">
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <><Trash2 size={14} /> Supprimer</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Catalog import dialog ── */}
      {showCatalogImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-white">Catalogue de reference</h3>
                <button onClick={() => setShowCatalogImport(false)} className="w-7 h-7 rounded-full bg-stone-800 flex items-center justify-center">
                  <X size={14} className="text-stone-400" />
                </button>
              </div>
              <input type="text" placeholder="Rechercher..." value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-xl text-sm text-white placeholder:text-stone-500" />
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {catalogLoading ? (
                <div className="text-center py-8 text-stone-500"><Loader2 size={20} className="animate-spin mx-auto" /></div>
              ) : filteredCatalog.length === 0 ? (
                <p className="text-center py-8 text-sm text-stone-500">Aucun produit trouve</p>
              ) : (
                filteredCatalog.map((ref) => (
                  <button key={ref.id} onClick={() => importFromCatalog(ref)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-stone-800 text-left transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-stone-800 overflow-hidden flex-shrink-0">
                      {ref.imageUrl ? (
                        <Image src={ref.imageUrl} alt="" width={40} height={40} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-600"><Package size={16} /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{ref.name}</p>
                      <p className="text-xs text-stone-500">
                        {ref.category.emoji} {ref.category.name}
                        {ref.suggestedPrice ? ` \u2022 ${(ref.suggestedPrice / 100).toFixed(2)} \u20AC` : ""}
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-stone-600 flex-shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* Image Studio modals                          */}
      {/* ═══════════════════════════════════════════ */}
      <ImageSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleStudioSelect}
        defaultQuery={name}
        usage="PRODUCT"
      />
      <ImageGenerateModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onSelect={handleStudioSelect}
        defaultQuery={name}
        usage="PRODUCT"
      />
      <ImageRetouchModal
        open={retouchOpen}
        onClose={() => setRetouchOpen(false)}
        onSelect={handleStudioSelect}
        sourceImageUrl={images[0]?.url}
        usage="PRODUCT"
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Toggle Switch (reusable)
// ─────────────────────────────────────────────
function ToggleSwitch({
  checked,
  onChange,
  color = "red",
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  color?: "red" | "emerald" | "orange";
}) {
  const bgActive = color === "emerald" ? "bg-emerald-500" : color === "orange" ? "bg-orange-500" : "bg-red-600";
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full transition-all relative flex-shrink-0 ${checked ? bgActive : "bg-stone-700"}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white dark:bg-gray-900 shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}
