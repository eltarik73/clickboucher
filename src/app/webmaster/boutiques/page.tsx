"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

type ShopAdmin = {
  id: string;
  name: string;
  city: string;
  imageUrl: string | null;
  status: string;
  visible: boolean;
  featured: boolean;
  rating: number;
  _count?: { orders: number; products: number };
};

function ShopAvatar({ src, name, size = 44 }: { src?: string | null; name: string; size?: number }) {
  return (
    <div
      className="rounded-[14px] overflow-hidden bg-stone-100 dark:bg-white/10 grid place-items-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-stone-400 font-bold" style={{ fontSize: size * 0.3 }}>
          {name?.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}

export default function WebmasterBoutiquesPage() {
  const [shops, setShops] = useState<ShopAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/shops")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json?.data) setShops(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggleField(id: string, field: "featured" | "visible") {
    setShops((prev) => {
      const shop = prev.find((s) => s.id === id);
      if (!shop) return prev;
      return prev.map((s) => (s.id === id ? { ...s, [field]: !s[field] } : s));
    });
    try {
      const shop = shops.find((s) => s.id === id);
      const newVal = shop ? !shop[field] : true;
      const res = await fetch(`/api/admin/shops/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newVal }),
      });
      if (!res.ok) {
        // Revert on HTTP error
        setShops((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: !newVal } : s)));
      }
    } catch {
      // Revert on network error
      setShops((prev) => {
        const shop = prev.find((s) => s.id === id);
        if (!shop) return prev;
        return prev.map((s) => (s.id === id ? { ...s, [field]: !s[field] } : s));
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#DC2626]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{shops.length} boucherie{shops.length > 1 ? "s" : ""}</p>
      {shops.map((s, i) => (
        <div
          key={s.id}
          className={`bg-white dark:bg-[#141414] rounded-[20px] border border-stone-200 dark:border-white/10 shadow-sm p-4 animate-fade-up transition-all ${
            !s.visible ? "opacity-40" : ""
          }`}
          style={{ animationDelay: `${i * 70}ms` } as React.CSSProperties}
        >
          <div className="flex gap-3.5 items-center">
            <ShopAvatar src={s.imageUrl} name={s.name} size={44} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-gray-900 dark:text-[#f8f6f3]">
                  {s.name}
                </p>
                {s.featured && (
                  <Badge variant="warning" className="text-[10px]">
                    Mise en avant
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={`text-[9px] ${
                    s.status === "OPEN" ? "text-emerald-600 border-emerald-200" :
                    s.status === "BUSY" ? "text-amber-600 border-amber-200" :
                    "text-red-500 border-red-200"
                  }`}
                >
                  {s.status}
                </Badge>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-gray-400 mt-0.5">
                {s.city} {s.rating > 0 ? `\u2605 ${s.rating.toFixed(1)}` : ""}
                {s._count ? ` \u00B7 ${s._count.products} produits \u00B7 ${s._count.orders} commandes` : ""}
              </p>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                onClick={() => toggleField(s.id, "featured")}
                className={`w-9 h-9 rounded-xl text-sm font-semibold transition-all flex items-center justify-center ${
                  s.featured
                    ? "bg-[#DC2626] text-white"
                    : "bg-stone-100 dark:bg-white/10 text-stone-500 dark:text-gray-400 hover:bg-stone-200 dark:hover:bg-white/15"
                }`}
                title={s.featured ? "Retirer la mise en avant" : "Mettre en avant"}
              >
                {s.featured ? "\u2605" : "\u2606"}
              </button>
              <button
                onClick={() => toggleField(s.id, "visible")}
                className={`w-9 h-9 rounded-xl text-sm font-semibold transition-all flex items-center justify-center ${
                  s.visible
                    ? "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400"
                    : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                }`}
                title={s.visible ? "Masquer la boutique" : "Rendre visible"}
              >
                {s.visible ? "\uD83D\uDC41" : "\uD83D\uDEAB"}
              </button>
            </div>
          </div>
        </div>
      ))}
      {shops.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-12">Aucune boucherie</p>
      )}
    </div>
  );
}
