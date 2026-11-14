// src/app/(boucher)/boucher/dashboard/anti-gaspi/page.tsx — Anti-Gaspi Express
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Leaf, Loader2, Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ANTI_GASPI_REASONS, AntiGaspiActiveInfo } from "@/components/boucher/AntiGaspiActiveInfo";

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

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

export default function AntiGaspiPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  // Per-product form state for enabling anti-gaspi
  const [formState, setFormState] = useState<
    Record<string, { discount: number; stock: string; reason: string }>
  >({});

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

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  const getForm = (id: string) =>
    formState[id] || { discount: 30, stock: "", reason: "DLC_PROCHE" };
  const setForm = (
    id: string,
    update: Partial<{ discount: number; stock: string; reason: string }>
  ) => {
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
      setToggling((prev) => {
        const s = new Set(prev);
        s.delete(product.id);
        return s;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/boucher/dashboard"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/10"
        >
          <ArrowLeft size={16} className="text-gray-600 dark:text-gray-300" />
        </Link>
        <div className="flex items-center gap-2">
          <Leaf className="h-5 w-5 text-emerald-600" />
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Anti-Gaspi Express</h1>
        </div>
        <span className="ml-auto rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 text-gray-500 dark:bg-emerald-900/30 dark:text-emerald-300">
          {products.filter((p) => p.isAntiGaspi).length} actif(s)
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
        />
        <Input
          placeholder="Rechercher un produit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white pl-9 dark:bg-[#141414]"
        />
      </div>

      {/* Product list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Aucun produit trouve
          </p>
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
                  ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/30 dark:bg-emerald-900/10"
                  : "border-gray-200 bg-white dark:border-white/10 dark:bg-[#141414]"
              }`}
            >
              {/* Top row: image + name + switch */}
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-white/5">
                  {p.imageUrl ? (
                    <Image
                      src={p.imageUrl}
                      alt={p.name}
                      width={48}
                      height={48}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl">
                      🥩
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                    {p.name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {p.isAntiGaspi && p.antiGaspiOrigPriceCents ? (
                      <>
                        <span className="font-bold text-emerald-600">{fmtPrice(p.priceCents)}</span>{" "}
                        <span className="line-through">{fmtPrice(p.antiGaspiOrigPriceCents)}</span>
                      </>
                    ) : (
                      fmtPrice(p.priceCents)
                    )}{" "}
                    / {p.unit === "KG" ? "kg" : p.unit === "PIECE" ? "pce" : p.unit.toLowerCase()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isProcessing && (
                    <Loader2 size={14} className="animate-spin text-gray-500 dark:text-gray-400" />
                  )}
                  <Switch
                    checked={p.isAntiGaspi}
                    onCheckedChange={() => toggleAntiGaspi(p)}
                    disabled={isProcessing}
                  />
                </div>
              </div>

              {/* Config form (only when NOT yet anti-gaspi) */}
              {!p.isAntiGaspi && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-400">
                      Remise %
                    </label>
                    <Input
                      type="number"
                      min={5}
                      max={80}
                      value={form.discount}
                      onChange={(e) =>
                        setForm(p.id, { discount: parseInt(e.target.value, 10) || 30 })
                      }
                      className="h-8 w-20 bg-white text-sm dark:bg-[#1a1a1a]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-400">
                      Stock
                    </label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="illimite"
                      value={form.stock}
                      onChange={(e) => setForm(p.id, { stock: e.target.value })}
                      className="h-8 w-20 bg-white text-sm dark:bg-[#1a1a1a]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-400">
                      Raison
                    </label>
                    <select
                      value={form.reason}
                      onChange={(e) => setForm(p.id, { reason: e.target.value })}
                      className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-900 dark:border-white/10 dark:bg-[#1a1a1a] dark:text-white"
                    >
                      {ANTI_GASPI_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                    Prix apres remise :{" "}
                    <span className="font-bold text-emerald-600">{fmtPrice(discountedPrice)}</span>
                  </div>
                </div>
              )}

              {p.isAntiGaspi && <AntiGaspiActiveInfo product={p} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
