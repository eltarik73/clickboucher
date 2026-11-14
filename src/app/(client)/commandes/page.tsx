"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft, ShoppingBag, RotateCcw, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/hooks/use-cart";
import { cartItemFromOrderLine } from "@/lib/cart/stored-cart";
import type { SaleUnit } from "@/lib/pricing/line";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/ui/StarRating";

// ── Types ────────────────────────────────────────

interface OrderItem {
  id: string;
  productId: string;
  name: string;
  /** Kilograms for KG and TRANCHE, count otherwise (OrderItem storage). */
  quantity: number;
  unit: SaleUnit;
  weightGrams: number | null;
  priceCents: number;
  totalCents: number;
  cutOption: string | null;
  variant: string | null;
  sliceCount: number | null;
  sliceThickness: string | null;
  pieceCount: number | null;
  pieceLabel: string | null;
  product: { imageUrl: string | null } | null;
}

interface PriceAdjustment {
  id: string;
  originalTotal: number;
  newTotal: number;
  status: string;
  autoApproveAt: string | null;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalCents: number;
  createdAt: string;
  estimatedReady: string | null;
  rating: number | null;
  items: OrderItem[];
  priceAdjustment: PriceAdjustment | null;
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
  return (
    d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }) +
    " à " +
    d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  );
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: {
    label: "En attente",
    color:
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800",
  },
  ACCEPTED: {
    label: "Acceptée",
    color:
      "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800",
  },
  PREPARING: {
    label: "En préparation",
    color:
      "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800",
  },
  READY: {
    label: "Prête !",
    color:
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800",
  },
  PICKED_UP: {
    label: "Récupérée",
    color:
      "bg-stone-100 text-stone-600 border-stone-200 dark:bg-stone-900/30 dark:text-stone-400 dark:border-stone-700",
  },
  COMPLETED: {
    label: "Terminée",
    color:
      "bg-stone-100 text-stone-600 border-stone-200 dark:bg-stone-900/30 dark:text-stone-400 dark:border-stone-700",
  },
  DENIED: {
    label: "Refusée",
    color:
      "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800",
  },
  CANCELLED: {
    label: "Annulée",
    color:
      "bg-stone-100 text-stone-500 border-stone-200 dark:bg-stone-900/30 dark:text-stone-400 dark:border-stone-700",
  },
  AUTO_CANCELLED: {
    label: "Expirée",
    color:
      "bg-stone-100 text-stone-500 border-stone-200 dark:bg-stone-900/30 dark:text-stone-400 dark:border-stone-700",
  },
  PARTIALLY_DENIED: {
    label: "Partielle",
    color:
      "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800",
  },
};

// ── Order Card ───────────────────────────────────

function OrderCard({ order, onReorder }: { order: Order; onReorder: (order: Order) => void }) {
  const status = STATUS_MAP[order.status] ?? {
    label: order.status,
    color: "bg-stone-100 text-stone-600 border-stone-200",
  };
  const articleCount = order.items.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#ece8e3] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-[#141414]">
      {/* Clickable card body */}
      <Link href={`/commande/${order.id}`} className="block p-4">
        {/* Top row: order number + status badge */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
              {order.orderNumber}
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              <ShoppingBag size={12} className="shrink-0 text-[#DC2626]" />
              <span className="truncate text-xs text-gray-500 dark:text-gray-400">
                {order.shop.name}
              </span>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${status.color}`}
          >
            {status.label}
          </span>
        </div>

        {/* Estimated time for active orders */}
        {["PENDING", "ACCEPTED", "PREPARING", "READY"].includes(order.status) &&
          order.estimatedReady && (
            <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-[#DC2626]/5 px-2.5 py-1.5 dark:bg-[#DC2626]/10">
              <Clock size={12} className="shrink-0 text-[#DC2626]" />
              <span className="text-xs font-semibold text-[#DC2626]">
                {order.status === "READY"
                  ? "Prête au retrait"
                  : `Prête vers ${new Date(order.estimatedReady).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
              </span>
            </div>
          )}

        {/* Price adjustment badges */}
        {order.priceAdjustment?.status === "PENDING" && (
          <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 dark:bg-amber-500/15">
            <AlertTriangle size={12} className="shrink-0 text-amber-500" />
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              Ajustement +
              {fmtPrice(order.priceAdjustment.newTotal - order.priceAdjustment.originalTotal)} —
              Cliquez pour valider
            </span>
          </div>
        )}
        {order.priceAdjustment?.status === "AUTO_APPROVED" && (
          <p className="mb-1 text-[10px] text-gray-500 dark:text-gray-400">
            Prix ajuste (variation de poids)
          </p>
        )}

        {/* Info row */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{fmtDate(order.createdAt)}</span>
          <span>
            {articleCount} article{articleCount > 1 ? "s" : ""}
          </span>
        </div>

        {/* Total + rating */}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-base font-extrabold text-gray-900 dark:text-white">
            {fmtPrice(order.totalCents)}
          </span>
          {order.status === "COMPLETED" && order.rating && (
            <StarRating value={order.rating} size="sm" />
          )}
        </div>
      </Link>

      {/* Reorder button for completed/picked-up orders */}
      {(order.status === "COMPLETED" || order.status === "PICKED_UP") && (
        <div className="border-t border-[#ece8e3] px-4 py-3 dark:border-white/10">
          <button
            onClick={() => onReorder(order)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#DC2626]/5 py-2.5 text-sm font-semibold text-[#DC2626] transition-colors hover:bg-[#b91c1c]/10"
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
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    fetch("/api/orders")
      .then((res) => {
        if (!res.ok && res.status === 401) {
          setOrders([]);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        if (data.success && Array.isArray(data.data)) {
          setOrders(data.data);
        } else if (Array.isArray(data)) {
          setOrders(data);
        } else {
          setOrders([]);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [isLoaded, isSignedIn]);

  const handleReorder = (order: Order) => {
    const lines = order.items.map((item) =>
      cartItemFromOrderLine({ ...item, imageUrl: item.product?.imageUrl })
    );
    const valid = lines.filter((line) => line !== null);
    if (valid.length === 0) {
      toast.error("Ces articles ne peuvent plus être commandés en ligne");
      return;
    }
    clear();
    for (const line of valid) {
      addItem(line, { id: order.shop.id, name: order.shop.name, slug: order.shop.slug });
    }
    if (valid.length < lines.length) {
      toast.warning("Panier recréé, sauf les articles qui ne peuvent plus être commandés en ligne");
    } else {
      toast.success("Panier recréé !");
    }
    router.push("/panier");
  };

  // ── Loading state ──────────────────────────────
  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
        <Header />
        <main className="mx-auto mt-8 max-w-xl px-5">
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border border-[#ece8e3] bg-white p-4 dark:border-white/10 dark:bg-[#141414]"
              >
                <div className="mb-3 h-4 w-1/3 rounded bg-stone-200 dark:bg-white/10" />
                <div className="mb-2 h-3 w-1/2 rounded bg-stone-100 dark:bg-white/5" />
                <div className="h-3 w-2/3 rounded bg-stone-100 dark:bg-white/5" />
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
      <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
        <Header />
        <main className="mx-auto mt-8 max-w-xl px-5">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 text-5xl">🔒</div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Connexion requise</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Connectez-vous pour voir vos commandes.
            </p>
            <Button className="mt-6 bg-[#DC2626] hover:bg-[#b91c1c]" size="lg" asChild>
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
      <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
        <Header />
        <main className="mx-auto mt-8 max-w-xl px-5">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 text-5xl">⚠️</div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Erreur de chargement
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Impossible de charger vos commandes.
            </p>
            <Button
              className="mt-6 bg-[#DC2626] hover:bg-[#b91c1c]"
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
      <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
        <Header />
        <main className="mx-auto mt-8 max-w-xl px-5">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="relative mb-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#DC2626]/10">
                <ShoppingBag size={36} className="animate-pulse text-[#DC2626]" />
              </div>
            </div>
            <h2 className="font-display text-xl font-bold text-gray-900 dark:text-white">
              Aucune commande
            </h2>
            <p className="mt-2 max-w-xs text-sm text-gray-500 dark:text-gray-400">
              Passez votre première commande et retrouvez-la ici avec le suivi en temps réel.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button className="bg-[#DC2626] hover:bg-[#b91c1c]" size="lg" asChild>
                <Link href="/">Découvrir les boucheries</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/favoris">Mes favoris</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Filter logic
  const ACTIVE_STATUSES = ["PENDING", "ACCEPTED", "PREPARING", "READY", "PARTIALLY_DENIED"];
  const filteredOrders =
    filter === "all"
      ? orders
      : filter === "active"
        ? orders.filter((o) => ACTIVE_STATUSES.includes(o.status))
        : orders.filter((o) => !ACTIVE_STATUSES.includes(o.status));

  const activeCount = orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length;

  // ── Orders list ────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f6f3] pb-8 dark:bg-[#0a0a0a]">
      <Header />
      <main className="mx-auto mt-6 max-w-xl px-5">
        {/* Filter tabs */}
        <div className="mb-4 flex gap-2">
          {[
            { key: "all" as const, label: "Toutes", count: orders.length },
            { key: "active" as const, label: "En cours", count: activeCount },
            { key: "done" as const, label: "Terminées", count: orders.length - activeCount },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                filter === tab.key
                  ? "bg-[#DC2626] text-white"
                  : "border border-gray-200 bg-white text-gray-500 dark:border-white/10 dark:bg-[#141414] dark:text-gray-400"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`ml-1 ${filter === tab.key ? "text-white/70" : "text-gray-500 dark:text-gray-400"}`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {filteredOrders.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filter === "active"
                ? "Aucune commande en cours"
                : filter === "done"
                  ? "Aucune commande terminee"
                  : "Aucune commande"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredOrders.map((order) => (
              <OrderCard key={order.id} order={order} onReorder={handleReorder} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Shared Header ────────────────────────────────

function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-[#ece8e3] bg-[#f8f6f3]/95 px-5 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#0a0a0a]/95">
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <Link
          href="/"
          className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#ece8e3] bg-white shadow-sm dark:border-white/10 dark:bg-[#141414]"
        >
          <ArrowLeft size={17} className="text-gray-900 dark:text-white" />
        </Link>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Mes commandes</h1>
      </div>
    </header>
  );
}
