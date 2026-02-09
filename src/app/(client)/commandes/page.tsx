"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft, ShoppingBag, RotateCcw, Star } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/hooks/use-cart";
import { Button } from "@/components/ui/button";

// ── Types ────────────────────────────────────────

interface OrderItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unit: string;
  priceCents: number;
  totalCents: number;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalCents: number;
  createdAt: string;
  rating: number | null;
  items: OrderItem[];
  shop: {
    id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
  };
}

// ── Helpers ──────────────────────────────────────

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }) + " à " + d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING:    { label: "En attente",      color: "bg-amber-100 text-amber-800 border-amber-200" },
  ACCEPTED:   { label: "Acceptée",        color: "bg-blue-100 text-blue-800 border-blue-200" },
  PREPARING:  { label: "En préparation",  color: "bg-orange-100 text-orange-800 border-orange-200" },
  READY:      { label: "Prête !",         color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  PICKED_UP:  { label: "Récupérée",       color: "bg-stone-100 text-stone-600 border-stone-200" },
  COMPLETED:  { label: "Terminée",        color: "bg-stone-100 text-stone-600 border-stone-200" },
  DENIED:     { label: "Refusée",         color: "bg-red-100 text-red-800 border-red-200" },
  CANCELLED:  { label: "Annulée",         color: "bg-stone-100 text-stone-500 border-stone-200" },
};

// ── Stars (read-only) ────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5 mt-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={12}
          className={s <= rating ? "fill-amber-400 text-amber-400" : "text-stone-300"}
        />
      ))}
    </div>
  );
}

// ── Order Card ───────────────────────────────────

function OrderCard({
  order,
  onReorder,
}: {
  order: Order;
  onReorder: (order: Order) => void;
}) {
  const status = STATUS_MAP[order.status] ?? { label: order.status, color: "bg-stone-100 text-stone-600 border-stone-200" };
  const articleCount = order.items.length;

  return (
    <div className="bg-white rounded-2xl border border-[#ece8e3] shadow-[0_1px_4px_rgba(0,0,0,0.03)] overflow-hidden">
      {/* Clickable card body */}
      <Link href={`/commande/${order.id}`} className="block p-4">
        {/* Top row: order number + status badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#2a2018] truncate">
              {order.orderNumber}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <ShoppingBag size={12} className="text-[#8b2500] shrink-0" />
              <span className="text-xs text-[#999] truncate">
                {order.shop.name}
              </span>
            </div>
          </div>
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border shrink-0 ${status.color}`}>
            {status.label}
          </span>
        </div>

        {/* Info row */}
        <div className="flex items-center justify-between text-xs text-[#999]">
          <span>{fmtDate(order.createdAt)}</span>
          <span>{articleCount} article{articleCount > 1 ? "s" : ""}</span>
        </div>

        {/* Total + rating */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-base font-extrabold text-[#2a2018]">
            {fmtPrice(order.totalCents)}
          </span>
          {order.status === "COMPLETED" && order.rating && (
            <Stars rating={order.rating} />
          )}
        </div>
      </Link>

      {/* Reorder button for completed orders */}
      {order.status === "COMPLETED" && (
        <div className="border-t border-[#ece8e3] px-4 py-3">
          <button
            onClick={() => onReorder(order)}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#8b2500]/5 hover:bg-[#8b2500]/10 text-[#8b2500] text-sm font-semibold transition-colors"
          >
            <RotateCcw size={14} />
            Recommander
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────

export default function CommandesPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const { addItem, clear } = useCart();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    fetch("/api/orders")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setOrders(data.data);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [isLoaded, isSignedIn]);

  const handleReorder = (order: Order) => {
    clear();
    for (const item of order.items) {
      addItem(
        {
          id: item.productId,
          productId: item.productId,
          name: item.name,
          imageUrl: "",
          unit: item.unit as "KG" | "PIECE" | "BARQUETTE",
          priceCents: item.priceCents,
          quantity: item.quantity,
        },
        { id: order.shop.id, name: order.shop.name, slug: order.shop.slug }
      );
    }
    toast.success("Panier recréé !");
    router.push("/panier");
  };

  // ── Loading state ──────────────────────────────
  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f3]">
        <Header />
        <main className="max-w-xl mx-auto px-5 mt-8">
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#ece8e3] p-4 animate-pulse">
                <div className="h-4 bg-stone-200 rounded w-1/3 mb-3" />
                <div className="h-3 bg-stone-100 rounded w-1/2 mb-2" />
                <div className="h-3 bg-stone-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // ── Not signed in ──────────────────────────────
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#f8f6f3]">
        <Header />
        <main className="max-w-xl mx-auto px-5 mt-8">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-lg font-bold text-[#2a2018]">
              Connexion requise
            </h2>
            <p className="text-sm text-[#999] mt-2">
              Connectez-vous pour voir vos commandes.
            </p>
            <Button className="mt-6 bg-[#8b2500] hover:bg-[#6d1d00]" size="lg" asChild>
              <Link href="/sign-in?redirect_url=/commandes">Se connecter</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ── Error state ────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f6f3]">
        <Header />
        <main className="max-w-xl mx-auto px-5 mt-8">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-lg font-bold text-[#2a2018]">
              Erreur de chargement
            </h2>
            <p className="text-sm text-[#999] mt-2">
              Impossible de charger vos commandes.
            </p>
            <Button
              className="mt-6 bg-[#8b2500] hover:bg-[#6d1d00]"
              size="lg"
              onClick={() => window.location.reload()}
            >
              Réessayer
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────
  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-[#f8f6f3]">
        <Header />
        <main className="max-w-xl mx-auto px-5 mt-8">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-lg font-bold text-[#2a2018]">
              Pas encore de commande
            </h2>
            <p className="text-sm text-[#999] mt-2">
              Vos commandes apparaîtront ici après votre premier achat.
            </p>
            <Button className="mt-6 bg-[#8b2500] hover:bg-[#6d1d00]" size="lg" asChild>
              <Link href="/decouvrir">Découvrir les boucheries</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ── Orders list ────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f6f3] pb-8">
      <Header />
      <main className="max-w-xl mx-auto px-5 mt-6">
        <p className="text-xs text-[#999] mb-4">
          {orders.length} commande{orders.length > 1 ? "s" : ""}
        </p>
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} onReorder={handleReorder} />
          ))}
        </div>
      </main>
    </div>
  );
}

// ── Shared Header ────────────────────────────────

function Header() {
  return (
    <header className="sticky top-0 z-10 bg-[#f8f6f3]/95 backdrop-blur-xl border-b border-[#ece8e3] px-5 py-4">
      <div className="max-w-xl mx-auto flex items-center gap-3">
        <Link
          href="/decouvrir"
          className="flex items-center justify-center w-10 h-10 rounded-[14px] bg-white border border-[#ece8e3] shadow-sm"
        >
          <ArrowLeft size={17} className="text-[#333]" />
        </Link>
        <h1 className="text-lg font-bold text-[#2a2018]">Mes commandes</h1>
      </div>
    </header>
  );
}
