// src/app/(boucher)/boucher/produits/[id]/modifier/page.tsx — Edit product page
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ProductFormPage, type Category, type EditProduct } from "../../ProductFormPage";

export default function ModifierProduitPage() {
  const params = useParams();
  const productId = params.id as string;

  const [shopId, setShopId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [product, setProduct] = useState<EditProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Load shop data
        const shopRes = await fetch("/api/shops/my-shop");
        if (!shopRes.ok) { setError("Impossible de charger votre boucherie"); return; }
        const shopJson = await shopRes.json();
        setShopId(shopJson.data.id);
        setCategories(shopJson.data.categories || []);

        // Load product data
        const prodRes = await fetch(`/api/products/${productId}`);
        if (!prodRes.ok) { setError("Produit introuvable"); return; }
        const prodJson = await prodRes.json();
        setProduct(prodJson.data);
      } catch {
        setError("Erreur de connexion");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [productId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-stone-500" />
      </div>
    );
  }

  if (error || !shopId || !product) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <p className="text-red-500 text-sm">{error || "Produit introuvable"}</p>
      </div>
    );
  }

  return <ProductFormPage shopId={shopId} categories={categories} product={product} />;
}
