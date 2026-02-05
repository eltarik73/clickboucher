"use client";

import { useState, useMemo } from "react";
import { CartProvider, useCartState } from "@/lib/hooks/useCart";
import { ProductCard, type Product } from "@/components/product/ProductCard";
import { FilterChips } from "@/components/product/FilterChips";
import { CartPanel } from "@/components/cart/CartPanel";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartFAB } from "@/components/cart/CartFAB";
import { Toast } from "@/components/ui/Toast";

const MOCK_PRODUCTS: Product[] = [
  { id: "1", shopId: "s1", name: "Merguez maison", subtitle: "BBQ \u00b7 Halal", category: "merguez", prixAuKg: 12.90, badges: ["BBQ", "Top vente"] },
  { id: "2", shopId: "s1", name: "Viande hach\u00e9e 5%", subtitle: "Pur boeuf charolais", category: "viande_hachee", prixAuKg: 14.50, badges: ["Best-seller"] },
  { id: "3", shopId: "s1", name: "Entrec\u00f4te charolaise", subtitle: "Persill\u00e9", category: "entrecote", prixAuKg: 38.00, badges: ["Premium"] },
  { id: "4", shopId: "s1", name: "Chipolatas", subtitle: "Porc fran\u00e7ais", category: "chipolata", prixAuKg: 11.50, badges: ["BBQ"] },
  { id: "5", shopId: "s1", name: "Brochettes mixtes", subtitle: "Boeuf & agneau", category: "brochette", prixAuKg: 22.00, badges: ["Nouveau"] },
  { id: "6", shopId: "s1", name: "C\u00f4tes d'agneau", subtitle: "Premi\u00e8re qualit\u00e9", category: "cote_agneau", prixAuKg: 28.50 },
  { id: "7", shopId: "s1", name: "Steak hach\u00e9 15%", subtitle: "Format burger", category: "steak", prixAuKg: 16.00, badges: ["Promo"] },
  { id: "8", shopId: "s1", name: "Escalope de poulet", subtitle: "Plein air", category: "escalope", prixAuKg: 15.90 },
  { id: "9", shopId: "s1", name: "Cuisses de poulet", subtitle: "Label Rouge", category: "cuisse_poulet", prixAuKg: 8.90 },
  { id: "10", shopId: "s1", name: "Saucisses de Toulouse", subtitle: "Artisanale", category: "saucisse", prixAuKg: 13.50, badges: ["Artisanal"] },
  { id: "11", shopId: "s1", name: "Poulet entier", subtitle: "Fermier", category: "poulet_entier", prixAuKg: 9.90 },
  { id: "12", shopId: "s1", name: "Viande hach\u00e9e 15%", subtitle: "Bolognaise", category: "viande_hachee", prixAuKg: 12.90 },
];

const CATEGORIES = [
  { id: "all", label: "Tout" },
  { id: "bbq", label: "BBQ" },
  { id: "boeuf", label: "Boeuf" },
  { id: "volaille", label: "Volaille" },
  { id: "agneau", label: "Agneau" },
  { id: "hache", label: "Hach\u00e9" },
  { id: "saucisse", label: "Saucisses" },
];

const CATEGORY_MAP: Record<string, string[]> = {
  all: [],
  bbq: ["merguez", "chipolata", "brochette", "saucisse"],
  boeuf: ["viande_hachee", "entrecote", "steak"],
  volaille: ["escalope", "cuisse_poulet", "poulet_entier"],
  agneau: ["cote_agneau"],
  hache: ["viande_hachee", "steak"],
  saucisse: ["merguez", "chipolata", "saucisse"],
};

function DecouvrirContent() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = useMemo(() => {
    let results = MOCK_PRODUCTS;
    if (activeFilter !== "all") {
      const cats = CATEGORY_MAP[activeFilter] ?? [];
      results = results.filter(p => cats.includes(p.category));
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.subtitle?.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q)
      );
    }
    return results;
  }, [search, activeFilter]);

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <header className="bg-white/80 backdrop-blur-md border-b border-[#E8E5E1] sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl" role="img" aria-label="meat">&#x1F969;</span>
            <h1 className="text-lg font-bold tracking-tight text-[#1A1A1A]">ClickBoucher</h1>
          </div>
          <button type="button" className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#6B6560] bg-[#F5F3F0] hover:bg-[#EBE8E4] transition-colors">
            Se connecter
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="space-y-3 mb-6">
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9C9590]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un produit..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[#E8E5E1] text-sm text-[#1A1A1A] placeholder:text-[#9C9590] focus:outline-none focus:ring-2 focus:ring-[#7A1023]/15 focus:border-[#7A1023]/30 transition-all" />
          </div>
          <FilterChips categories={CATEGORIES} active={activeFilter} onChange={setActiveFilter} />
        </div>

        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#9C9590] mb-4">{filtered.length} produit{filtered.length > 1 ? "s" : ""}</p>
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm font-medium text-[#6B6560]">Aucun produit trouve</p>
                <button type="button" onClick={() => { setSearch(""); setActiveFilter("all"); }}
                  className="mt-4 px-4 py-2 rounded-lg text-xs font-medium text-[#7A1023] bg-[#F9F0F2] hover:bg-[#F0E0E4] transition-colors">
                  Reinitialiser
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>

          <div className="hidden lg:block w-[320px] shrink-0">
            <CartPanel />
          </div>
        </div>
      </div>

      <CartFAB onClick={() => setDrawerOpen(true)} />
      <CartDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <Toast />
    </div>
  );
}

export default function DecouvrirPage() {
  const cartState = useCartState();
  return (
    <CartProvider value={cartState}>
      <DecouvrirContent />
    </CartProvider>
  );
}
