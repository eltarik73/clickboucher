// src/app/(boucher)/boucher/produits/nouveau/page.tsx — Create product page
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ProductFormPage, type Category } from "../ProductFormPage";

export default function NouveauProduitPage() {
  const [shopId, setShopId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/shops/my-shop");
        if (!res.ok) { setError("Impossible de charger votre boucherie"); return; }
        const json = await res.json();
        setShopId(json.data.id);
        setCategories(json.data.categories || []);
      } catch {
        setError("Erreur de connexion");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-stone-500" />
      </div>
    );
  }

  if (error || !shopId) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <p className="text-red-500 text-sm">{error || "Boutique introuvable"}</p>
      </div>
    );
  }

  return <ProductFormPage shopId={shopId} categories={categories} />;
}
