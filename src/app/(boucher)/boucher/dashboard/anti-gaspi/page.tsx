// src/app/(boucher)/boucher/dashboard/anti-gaspi/page.tsx — Anti-Gaspi Express
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Leaf, Loader2, Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  imageUrl: string | null;
  priceCents: number;
  unit: string;
  inStock: boolean;
  isAntiGaspi: boolean;
  antiGaspiStock: number | null;
  antiGaspiOrigPriceCents: number | null;
  antiGaspiReason: string | null;
  antiGaspiEndAt: string | null;
  categories: { id: string; name: string }[];
}

const REASONS = [
  { value: "DLC_PROCHE", label: "DLC proche" },
  { value: "SURPLUS", label: "Surplus" },
  { value: "DERNIER_LOT", label: "Dernier lot" },
  { value: "FIN_JOURNEE", label: "Fin de journee" },
];

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

export default function AntiGaspiPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  // Per-product form state for enabling anti-gaspi
  const [formState, setFormState] = useState<Record<string, { discount: number; stock: string; reason: string }>>({});

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/boucher/products");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setProducts(json.data || []);
    } catch {
      toast.error("Erreur de chargement des produits");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const getForm = (id: string) => formState[id] || { discount: 30, stock: "", reason: "DLC_PROCHE" };
  const setForm = (id: string, update: Partial<{ discount: number; stock: string; reason: string }>) => {
    setFormState((prev) => ({ ...prev, [id]: { ...getForm(id), ...update } }));
  };

  const toggleAntiGaspi = async (product: Product) => {
    setToggling((prev) => new Set(prev).add(product.id));
    try {
      if (product.isAntiGaspi) {
        // Disable
        const res = await fetch(`/api/boucher/anti-gaspi/${product.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        toast.success(`${product.name} — anti-gaspi desactive`);
      } else {
        // Enable
        const form = getForm(product.id);
        const body: Record<string, unknown> = {
          productId: product.id,
          discountPercent: form.discount,
        };
        if (form.stock) body.antiGaspiStock = parseInt(form.stock, 10);
        if (form.reason) body.reason = form.reason;

        const res = await fetch("/api/boucher/anti-gaspi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || "Erreur");
        }
        toast.success(`${product.name} — anti-gaspi active a -${form.discount}%`);
      }
      await fetchProducts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setToggling((prev) => { const s = new Set(prev); s.delete(product.id); return s; });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/boucher/dashboard" className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/10 flex items-center justify-center">
          <ArrowLeft size={16} className="text-gray-600 dark:text-gray-300" />
        </Link>
        <div className="flex items-center gap-2">
          <Leaf className="w-5 h-5 text-emerald-600" />
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Anti-Gaspi Express</h1>
        </div>
        <span className="ml-auto text-xs text-gray-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-full font-semibold">
          {products.filter(p => p.isAntiGaspi).length} actif(s)
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        <Input
          placeholder="Rechercher un produit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white dark:bg-[#141414]"
        />
      </div>

      {/* Product list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">Aucun produit trouve</p>
        )}
        {filtered.map((p) => {
          const form = getForm(p.id);
          const isProcessing = toggling.has(p.id);
          const discountedPrice = Math.round(p.priceCents * (1 - form.discount / 100));

          return (
            <div
              key={p.id}
              className={`rounded-xl border p-3 transition-colors ${
                p.isAntiGaspi
                  ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/30"
                  : "bg-white dark:bg-[#141414] border-gray-200 dark:border-white/10"
              }`}
            >
              {/* Top row: image + name + switch */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-white/5 flex-shrink-0">
                  {p.imageUrl ? (
                    <Image src={p.imageUrl} alt={p.name} width={48} height={48} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">🥩</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {p.isAntiGaspi && p.antiGaspiOrigPriceCents ? (
                      <>
                        <span className="text-emerald-600 font-bold">{fmtPrice(p.priceCents)}</span>
                        {" "}
                        <span className="line-through">{fmtPrice(p.antiGaspiOrigPriceCents)}</span>
                      </>
                    ) : (
                      fmtPrice(p.priceCents)
                    )}
                    {" "}/ {p.unit === "KG" ? "kg" : p.unit === "PIECE" ? "pce" : p.unit.toLowerCase()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isProcessing && <Loader2 size={14} className="animate-spin text-gray-400 dark:text-gray-500" />}
                  <Switch
                    checked={p.isAntiGaspi}
                    onCheckedChange={() => toggleAntiGaspi(p)}
                    disabled={isProcessing}
                  />
                </div>
              </div>

              {/* Config form (only when NOT yet anti-gaspi) */}
              {!p.isAntiGaspi && (
                <div className="mt-3 flex flex-wrap gap-2 items-end">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Remise %</label>
                    <Input
                      type="number"
                      min={5}
                      max={80}
                      value={form.discount}
                      onChange={(e) => setForm(p.id, { discount: parseInt(e.target.value, 10) || 30 })}
                      className="w-20 h-8 text-sm bg-white dark:bg-[#1a1a1a]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Stock</label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="illimite"
                      value={form.stock}
                      onChange={(e) => setForm(p.id, { stock: e.target.value })}
                      className="w-20 h-8 text-sm bg-white dark:bg-[#1a1a1a]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Raison</label>
                    <select
                      value={form.reason}
                      onChange={(e) => setForm(p.id, { reason: e.target.value })}
                      className="h-8 text-sm rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-2 text-gray-900 dark:text-white"
                    >
                      {REASONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                    Prix apres remise : <span className="font-bold text-emerald-600">{fmtPrice(discountedPrice)}</span>
                  </div>
                </div>
              )}

              {/* Active info */}
              {p.isAntiGaspi && (
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  {p.antiGaspiStock !== null && (
                    <span className="bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full font-semibold">
                      Stock: {p.antiGaspiStock}
                    </span>
                  )}
                  {p.antiGaspiReason && (
                    <span className="bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-full">
                      {REASONS.find(r => r.value === p.antiGaspiReason)?.label || p.antiGaspiReason}
                    </span>
                  )}
                  {p.antiGaspiEndAt && (
                    <span>Expire: {new Date(p.antiGaspiEndAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
