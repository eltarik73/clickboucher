"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Copy,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Loader2,
  MessageSquare,
} from "lucide-react";
import dynamic from "next/dynamic";

const QRCodeSVG = dynamic(() => import("qrcode.react").then((m) => m.QRCodeSVG), {
  ssr: false,
  loading: () => (
    <div className="h-[180px] w-[180px] animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5" />
  ),
});
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/ui/StarRating";
import PriceAdjustmentBanner from "@/components/client/PriceAdjustmentBanner";
import type { SaleUnit } from "@/lib/pricing/line";
import { formatStoredLineQuantity } from "@/lib/pricing/format";
import { startVisiblePolling, nextOrderPollDelay } from "@/hooks/useVisiblePolling";

// ── Types ────────────────────────────────────────

interface OrderItem {
  id: string;
  name: string;
  /** Stored OrderItem.quantity: kilograms for KG and TRANCHE, a count otherwise. */
  quantity: number;
  unit: SaleUnit;
  weightGrams: number | null;
  priceCents: number;
  totalCents: number;
  available: boolean;
  replacement: string | null;
  productId: string;
}

interface Alternative {
  id: string;
  name: string;
  priceCents: number;
  unit: string;
}

interface OrderShop {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  phone: string;
  imageUrl: string | null;
}

interface OrderUser {
  id: string;
  firstName: string;
  lastName: string;
}

interface OrderData {
  id: string;
  orderNumber: string;
  dailyNumber: number | null;
  displayNumber: string | null;
  status: string;
  totalCents: number;
  estimatedReady: string | null;
  actualReady: string | null;
  pickedUpAt: string | null;
  qrCode: string | null;
  rating: number | null;
  ratingComment: string | null;
  customerNote: string | null;
  boucherNote: string | null;
  denyReason: string | null;
  requestedTime: string | null;
  paymentMethod: string | null;
  createdAt: string;
  items: OrderItem[];
  shop: OrderShop;
  user: OrderUser;
  priceAdjustment?: {
    id: string;
    originalTotal: number;
    newTotal: number;
    reason: string | null;
    adjustmentType: string;
    status: string;
    tier: number;
    autoApproveAt: string | null;
    escalateAt: string | null;
    createdAt: string;
  } | null;
}

// ── Helpers ──────────────────────────────────────

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

const TERMINAL = ["PICKED_UP", "COMPLETED", "DENIED", "CANCELLED", "AUTO_CANCELLED"];

// ── Dots animation ───────────────────────────────

function LoadingDots() {
  return (
    <div className="my-4 flex items-center justify-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-3 w-3 animate-bounce rounded-full bg-[#DC2626]"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

// ── Confetti burst ──────────────────────────────

function ConfettiBurst() {
  const particles = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * 360;
    const distance = 60 + Math.random() * 80;
    const x = Math.cos((angle * Math.PI) / 180) * distance;
    const y = Math.sin((angle * Math.PI) / 180) * distance;
    const colors = ["#DC2626", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899"];
    const color = colors[i % colors.length];
    const size = 4 + Math.random() * 4;
    const delay = Math.random() * 0.3;
    return { x, y, color, size, delay, angle };
  });

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/3"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: i % 3 === 0 ? "50%" : i % 3 === 1 ? "0" : "2px",
            animation: `confetti-burst 1.2s ${p.delay}s ease-out forwards`,
            transform: `translate(-50%, -50%)`,
            opacity: 0,
            ["--tx" as string]: `${p.x}px`,
            ["--ty" as string]: `${p.y}px`,
            ["--rot" as string]: `${p.angle + 180}deg`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-burst {
          0% { opacity: 1; transform: translate(-50%, -50%) scale(0) rotate(0deg); }
          30% { opacity: 1; }
          100% { opacity: 0; transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(1) rotate(var(--rot)); }
        }
      `}</style>
    </div>
  );
}

// ── Progress bar ─────────────────────────────────

function TimeProgress({ estimatedReady }: { estimatedReady: string }) {
  const [pct, setPct] = useState(100);
  const [minsLeft, setMinsLeft] = useState(0);

  useEffect(() => {
    const target = new Date(estimatedReady).getTime();
    const update = () => {
      const now = Date.now();
      const remaining = Math.max(0, target - now);
      setMinsLeft(Math.ceil(remaining / 60_000));
      setPct(Math.min(100, Math.max(0, (remaining / (30 * 60_000)) * 100)));
    };
    update();
    const iv = setInterval(update, 10_000);
    return () => clearInterval(iv);
  }, [estimatedReady]);

  return (
    <div className="mt-4">
      <p className="mb-2 text-center text-sm font-semibold text-[#2a2018] dark:text-white">
        Prete dans environ {minsLeft} min
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-[#ece8e3] dark:bg-white/10">
        <div
          className="h-full rounded-full bg-[#DC2626] transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── QR Code Section ──────────────────────────────

function QRSection({ qrCode, size = 180 }: { qrCode: string; size?: number }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrCode);
      toast.success("Code copie !");
    } catch {
      toast.error("Impossible de copier");
    }
  };

  return (
    <div className="mt-5 flex flex-col items-center">
      <div className="rounded-2xl border border-[#ece8e3] bg-white p-4 shadow-[0_4px_16px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-gray-900">
        <QRCodeSVG value={qrCode} size={size} level="M" />
      </div>
      <button
        onClick={handleCopy}
        className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[#DC2626] hover:underline"
      >
        <Copy size={12} />
        Copier le code
      </button>
    </div>
  );
}

// ── Order Items Recap ────────────────────────────

function OrderRecap({ items, totalCents }: { items: OrderItem[]; totalCents: number }) {
  return (
    <div className="mt-6 rounded-2xl border border-[#ece8e3] bg-white p-4 dark:border-white/10 dark:bg-[#141414]">
      <h3 className="mb-3 text-sm font-bold text-[#2a2018] dark:text-white">Recapitulatif</h3>
      {items.map((item) => (
        <div key={item.id} className="flex justify-between py-1.5 text-xs">
          <div className="text-[#555] dark:text-gray-300">
            {item.name}
            <span className="ml-1 text-[#999] dark:text-gray-400">
              {formatStoredLineQuantity(item)}
            </span>
          </div>
          <span className="font-semibold text-[#2a2018] dark:text-white">
            {fmtPrice(item.totalCents)}
          </span>
        </div>
      ))}
      <div className="mt-2 flex justify-between border-t border-[#ece8e3] pt-2 dark:border-white/10">
        <span className="text-sm font-bold text-[#2a2018] dark:text-white">Total</span>
        <span className="text-sm font-extrabold text-[#2a2018] dark:text-white">
          {fmtPrice(totalCents)}
        </span>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────

export default function CommandePage({ params }: { params: { id: string } }) {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Rating state
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);

  // Alternatives state
  const [alternatives, setAlternatives] = useState<Record<string, Alternative[]>>({});
  const [decisions, setDecisions] = useState<
    Record<string, { action: "replace" | "remove"; replacementProductId?: string }>
  >({});
  const [submittingAlts, setSubmittingAlts] = useState(false);

  const orderId = params.id;
  const orderLoadedRef = useRef(false);

  // Renvoie le statut HTTP (0 = erreur réseau) et le statut de la commande si elle a été chargée
  const fetchOrder = useCallback(async (): Promise<{
    httpStatus: number;
    orderStatus: string | null;
  }> => {
    if (!orderId) return { httpStatus: 0, orderStatus: null };
    let httpStatus = 0;
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      httpStatus = res.status;
      const data = await res.json();
      if (data.success) {
        orderLoadedRef.current = true;
        setOrder(data.data);
        setError(null);
        if (data.data.rating !== null) setRatingDone(true);
        return { httpStatus, orderStatus: data.data.status as string };
      }
      // Une fois la commande affichée, un échec ponctuel du polling ne doit pas
      // remplacer la page (QR code de retrait) par l'écran d'erreur.
      if (!orderLoadedRef.current) setError(data.error?.message || "Erreur");
    } catch {
      if (!orderLoadedRef.current) setError("Erreur reseau");
    } finally {
      setLoading(false);
    }
    return { httpStatus, orderStatus: null };
  }, [orderId]);

  // Initial fetch + polling : 5 s tant que l'onglet est visible, arrêt sur statut terminal.
  // Échecs : 404 = arrêt ; 401/403 avant tout chargement = 3 essais puis arrêt (écran d'erreur) ;
  // sinon backoff 5 → 60 s, remis à zéro au retour sur l'onglet (visibilité, focus, réseau).
  useEffect(() => {
    if (!orderId) return;
    let failures = 0;
    let everLoaded = false;

    return startVisiblePolling(
      async () => {
        const { httpStatus, orderStatus } = await fetchOrder();
        if (orderStatus !== null) {
          everLoaded = true;
          failures = 0;
          if (TERMINAL.includes(orderStatus)) return null;
        } else {
          failures += 1;
        }
        return nextOrderPollDelay({ httpStatus, everLoaded, failures });
      },
      {
        onWake: () => {
          failures = 0;
        },
        wakeOn: ["focus", "online"],
      }
    );
  }, [orderId, fetchOrder]);

  // Fetch alternatives when PARTIALLY_DENIED
  useEffect(() => {
    if (!order || order.status !== "PARTIALLY_DENIED") return;
    const unavailableItems = order.items.filter((i) => !i.available && !i.replacement);
    if (unavailableItems.length === 0) return;

    (async () => {
      try {
        // Re-fetch the stock-issue data to get alternatives
        // Since alternatives aren't stored, we query products in the same categories
        const productIds = unavailableItems.map((i) => i.productId).join(",");
        const res = await fetch(`/api/orders/${order.id}/alternatives?products=${productIds}`);
        if (res.ok) {
          const data = await res.json();
          if (data.data) setAlternatives(data.data);
        }
      } catch {
        // Non-critical — alternatives just won't show
      }
    })();
  }, [order]);

  // Submit alternative choices
  const handleSubmitAlternatives = async () => {
    if (!order) return;
    const unavailableItems = order.items.filter((i) => !i.available && !i.replacement);
    // Ensure all items have a decision
    const allDecided = unavailableItems.every((i) => decisions[i.id]);
    if (!allDecided) {
      toast.error("Choisis une option pour chaque article");
      return;
    }

    setSubmittingAlts(true);
    try {
      const decisionsPayload = Object.entries(decisions).map(([orderItemId, d]) => ({
        orderItemId,
        action: d.action,
        replacementProductId: d.replacementProductId,
      }));

      const res = await fetch(`/api/orders/${order.id}/choose-alternatives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisions: decisionsPayload }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Choix enregistres !");
        setDecisions({});
        await fetchOrder();
      } else {
        toast.error(data.error?.message || "Erreur");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setSubmittingAlts(false);
    }
  };

  // Cancel handler
  const handleCancel = async () => {
    if (!order) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setOrder({ ...order, status: "CANCELLED" });
        toast.success("Commande annulee");
      } else {
        toast.error(data.error?.message || "Impossible d'annuler");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setCancelling(false);
    }
  };

  // Rate handler — also creates a Review via /api/reviews
  const handleRate = async () => {
    if (!order || ratingValue === 0) return;
    setRatingSubmitting(true);
    try {
      // 1) Rate the order (marks COMPLETED + updates shop avg)
      const res = await fetch(`/api/orders/${order.id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: ratingValue,
          comment: ratingComment.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRatingDone(true);
        toast.success("Merci pour votre avis !");

        // 2) Also create a Review entry (non-blocking)
        fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shopId: order.shop.id,
            rating: ratingValue,
            comment: ratingComment.trim() || undefined,
            orderId: order.id,
          }),
        }).catch(() => {});
      } else {
        toast.error(data.error?.message || "Erreur");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setRatingSubmitting(false);
    }
  };

  // ── Loading / Error states ─────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f6f3] dark:bg-[#0a0a0a]">
        <LoadingDots />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8f6f3] px-5 dark:bg-[#0a0a0a]">
        <p className="mb-2 text-lg font-bold text-[#2a2018] dark:text-white">Erreur</p>
        <p className="mb-6 text-sm text-[#999] dark:text-gray-400">
          {error || "Commande introuvable"}
        </p>
        <Button className="bg-[#DC2626] hover:bg-[#b91c1c]" asChild>
          <Link href="/commandes">Mes commandes</Link>
        </Button>
      </div>
    );
  }

  const mapsUrl = `https://maps.google.com/maps?q=${encodeURIComponent(
    `${order.shop.address}, ${order.shop.city}`
  )}`;

  // ── Render ─────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f6f3] pb-10 dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[#ece8e3] bg-[#f8f6f3]/95 px-5 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#0a0a0a]/95">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <Link
            href="/commandes"
            className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#ece8e3] bg-white shadow-sm dark:border-white/10 dark:bg-[#141414]"
          >
            <ArrowLeft size={17} className="text-[#333] dark:text-white" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-[#2a2018] dark:text-white">
              Commande {order.displayNumber || order.orderNumber}
            </h1>
            <p className="text-[11px] text-[#999] dark:text-gray-400">{order.shop.name}</p>
          </div>
        </div>
      </header>

      {/* ── Ticket hero zone ── */}
      <div className="mx-auto mt-6 max-w-xl px-5 text-center">
        <p className="text-[56px] font-black leading-none tracking-tight text-[#DC2626]">
          {order.displayNumber || `#${order.orderNumber.split("-").pop()}`}
        </p>
        <p className="mt-1 text-[22px] font-bold text-[#2a2018] dark:text-white">
          {order.user?.firstName || ""}
        </p>
        <p className="mt-1 text-xs text-[#999] dark:text-gray-400">
          {order.shop.name} —{" "}
          {new Date(order.createdAt).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      <main className="mx-auto mt-6 max-w-xl px-5">
        {/* ═══ PENDING ═══ */}
        {order.status === "PENDING" && (
          <div className="rounded-2xl border border-[#ece8e3] bg-white p-6 text-center dark:border-white/10 dark:bg-[#141414]">
            <LoadingDots />
            <h2 className="mt-2 text-xl font-bold text-[#2a2018] dark:text-white">
              En attente du boucher...
            </h2>
            <p className="mt-2 text-sm text-[#999] dark:text-gray-400">
              Votre commande a ete envoyee a{" "}
              <span className="font-semibold text-[#555] dark:text-gray-300">
                {order.shop.name}
              </span>
              . Le boucher va la confirmer.
            </p>
            <Button
              onClick={handleCancel}
              disabled={cancelling}
              variant="outline"
              className="mt-5 border-red-200 text-red-600 hover:bg-red-50"
            >
              {cancelling ? "Annulation..." : "Annuler la commande"}
            </Button>
          </div>
        )}

        {/* ═══ PARTIALLY_DENIED ═══ */}
        {order.status === "PARTIALLY_DENIED" &&
          (() => {
            const unavailableItems = order.items.filter((i) => !i.available && !i.replacement);
            const availableItems = order.items.filter((i) => i.available);

            return (
              <div className="rounded-2xl border border-orange-200 bg-white p-5 shadow-[0_0_20px_rgba(245,158,11,0.08)] dark:bg-[#141414]">
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle size={22} className="text-orange-500" />
                  <h2 className="text-lg font-bold text-[#2a2018] dark:text-white">
                    Rupture de stock
                  </h2>
                </div>
                <p className="mb-4 text-sm text-[#777] dark:text-gray-400">
                  Certains articles ne sont plus disponibles chez{" "}
                  <span className="font-semibold text-[#555] dark:text-gray-300">
                    {order.shop.name}
                  </span>
                  . Choisis une alternative ou retire l&apos;article.
                </p>

                {/* Unavailable items with alternatives */}
                <div className="mb-4 space-y-4">
                  {unavailableItems.map((item) => {
                    const alts = alternatives[item.productId] || [];
                    const decision = decisions[item.id];

                    return (
                      <div key={item.id} className="space-y-2 rounded-xl bg-red-50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-red-800 line-through">
                            {item.name} — {formatStoredLineQuantity(item)}
                          </span>
                          <span className="text-xs font-medium text-red-500">Indisponible</span>
                        </div>

                        {/* Alternative options */}
                        {alts.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-[#777] dark:text-gray-400">
                              Alternatives :
                            </p>
                            {alts.map((alt) => (
                              <button
                                key={alt.id}
                                onClick={() =>
                                  setDecisions((prev) => ({
                                    ...prev,
                                    [item.id]: { action: "replace", replacementProductId: alt.id },
                                  }))
                                }
                                className={`flex w-full items-center justify-between rounded-lg border p-2.5 text-sm transition-colors ${
                                  decision?.action === "replace" &&
                                  decision.replacementProductId === alt.id
                                    ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                                    : "border-[#ece8e3] bg-white text-[#555] hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-white/10 dark:bg-[#141414] dark:text-gray-300"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <RefreshCw size={13} className="text-emerald-500" />
                                  <span>{alt.name}</span>
                                </div>
                                <span className="font-semibold">
                                  {(alt.priceCents / 100).toFixed(2).replace(".", ",")} €/
                                  {alt.unit === "KG" ? "kg" : alt.unit === "PIECE" ? "pc" : "barq."}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Remove option */}
                        <button
                          onClick={() =>
                            setDecisions((prev) => ({
                              ...prev,
                              [item.id]: { action: "remove" },
                            }))
                          }
                          className={`flex w-full items-center gap-2 rounded-lg border p-2.5 text-sm transition-colors ${
                            decision?.action === "remove"
                              ? "border-red-400 bg-red-50 text-red-700"
                              : "border-[#ece8e3] bg-white text-[#999] hover:border-red-300 dark:border-white/10 dark:bg-[#141414] dark:text-gray-400"
                          }`}
                        >
                          <Trash2 size={13} />
                          <span>Retirer cet article</span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Still available items */}
                {availableItems.length > 0 && (
                  <div className="mb-4 rounded-xl bg-emerald-50 p-3">
                    <p className="mb-1 text-xs font-medium text-emerald-700">
                      Toujours disponibles :
                    </p>
                    {availableItems.map((item) => (
                      <p key={item.id} className="text-sm text-emerald-800">
                        • {item.name} — {formatStoredLineQuantity(item)}
                      </p>
                    ))}
                  </div>
                )}

                {/* Submit button */}
                <Button
                  onClick={handleSubmitAlternatives}
                  disabled={submittingAlts || unavailableItems.some((i) => !decisions[i.id])}
                  className="w-full gap-2 bg-[#DC2626] hover:bg-[#b91c1c]"
                >
                  {submittingAlts ? <Loader2 size={16} className="animate-spin" /> : null}
                  {submittingAlts ? "Envoi..." : "Confirmer mes choix"}
                </Button>

                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="mt-2 w-full py-2 text-center text-xs text-[#999] transition-colors hover:text-red-500 dark:text-gray-400"
                >
                  {cancelling ? "Annulation..." : "Annuler la commande"}
                </button>
              </div>
            );
          })()}

        {/* ═══ ACCEPTED ═══ */}
        {order.status === "ACCEPTED" && (
          <div className="space-y-4">
            {order.priceAdjustment && (
              <PriceAdjustmentBanner
                orderId={order.id}
                adjustment={order.priceAdjustment}
                onUpdate={fetchOrder}
              />
            )}
            <div className="rounded-2xl border border-[#ece8e3] bg-white p-6 text-center dark:border-white/10 dark:bg-[#141414]">
              <div className="mb-3 text-5xl">✅</div>
              <h2 className="text-xl font-bold text-[#2a2018] dark:text-white">
                Commande acceptee !
              </h2>
              {order.estimatedReady && <TimeProgress estimatedReady={order.estimatedReady} />}
              {order.qrCode && <QRSection qrCode={order.qrCode} size={180} />}
            </div>
          </div>
        )}

        {/* ═══ PREPARING ═══ */}
        {order.status === "PREPARING" && (
          <div className="space-y-4">
            {order.priceAdjustment && (
              <PriceAdjustmentBanner
                orderId={order.id}
                adjustment={order.priceAdjustment}
                onUpdate={fetchOrder}
              />
            )}
            <div className="rounded-2xl border border-[#ece8e3] bg-white p-6 text-center dark:border-white/10 dark:bg-[#141414]">
              <div className="mb-3 text-5xl">🔪</div>
              <h2 className="text-xl font-bold text-[#2a2018] dark:text-white">
                En preparation...
              </h2>
              {order.estimatedReady && <TimeProgress estimatedReady={order.estimatedReady} />}
              {order.qrCode && <QRSection qrCode={order.qrCode} size={180} />}
            </div>
          </div>
        )}

        {/* ═══ READY ═══ */}
        {order.status === "READY" && (
          <div className="relative rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-[0_0_20px_rgba(16,185,129,0.1)] dark:bg-[#141414]">
            <ConfettiBurst />
            <div className="relative z-10 mb-3 animate-bounce text-6xl">🎉</div>
            <h2 className="text-2xl font-bold text-[#2a2018] dark:text-white">
              Votre commande est prete !
            </h2>
            <div className="mt-4 flex items-center justify-center gap-1 text-sm text-[#555] dark:text-gray-300">
              <MapPin size={14} className="text-[#DC2626]" />
              <span className="font-semibold">
                {order.shop.address}, {order.shop.city}
              </span>
            </div>
            {order.qrCode && (
              <>
                <QRSection qrCode={order.qrCode} size={220} />
                <p className="mt-3 text-xs text-[#999] dark:text-gray-400">
                  Presentez ce QR code au boucher
                </p>
              </>
            )}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#DC2626] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#b91c1c]"
            >
              <MapPin size={16} />
              Ouvrir dans Maps
            </a>
          </div>
        )}

        {/* ═══ PICKED_UP / COMPLETED ═══ */}
        {(order.status === "PICKED_UP" || order.status === "COMPLETED") && (
          <div className="rounded-2xl border border-[#ece8e3] bg-white p-6 text-center dark:border-white/10 dark:bg-[#141414]">
            <div className="mb-3 text-5xl">✅</div>
            <h2 className="text-xl font-bold text-[#2a2018] dark:text-white">
              Commande recuperee !
            </h2>
            <p className="mt-1 text-sm text-[#999] dark:text-gray-400">Bon appetit ! 😊</p>

            {/* Rating */}
            {!ratingDone ? (
              <div className="mt-6 rounded-2xl bg-[#f8f6f3] p-4 dark:bg-[#0a0a0a]">
                <p className="mb-3 text-sm font-semibold text-[#2a2018] dark:text-white">
                  Comment etait votre commande ?
                </p>
                <StarRating
                  value={ratingValue}
                  onChange={setRatingValue}
                  size="lg"
                  className="justify-center"
                />
                {ratingValue > 0 && (
                  <>
                    <textarea
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value)}
                      placeholder="Un commentaire ? (optionnel)"
                      maxLength={1000}
                      rows={3}
                      className="mt-3 w-full resize-none rounded-xl border border-[#ece8e3] bg-white px-4 py-3 text-sm text-[#2a2018] transition-colors placeholder:text-[#ccc] focus:border-[#DC2626] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#141414] dark:text-white dark:placeholder:text-gray-500"
                    />
                    <Button
                      onClick={handleRate}
                      disabled={ratingSubmitting}
                      className="mt-3 w-full bg-[#DC2626] hover:bg-[#b91c1c]"
                    >
                      {ratingSubmitting ? "Envoi..." : "Envoyer mon avis"}
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm font-medium text-emerald-700">Merci pour votre avis !</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ DENIED ═══ */}
        {order.status === "DENIED" && (
          <div className="rounded-2xl border border-red-200 bg-white p-6 text-center dark:bg-[#141414]">
            <div className="mb-3 text-5xl">❌</div>
            <h2 className="text-xl font-bold text-[#2a2018] dark:text-white">Commande refusee</h2>
            {order.denyReason && (
              <div className="mt-3 rounded-xl bg-red-50 p-3">
                <p className="text-sm text-red-700">{order.denyReason}</p>
              </div>
            )}
            <Button className="mt-5 bg-[#DC2626] hover:bg-[#b91c1c]" asChild>
              <Link href={`/boutique/${order.shop.slug}`}>Recommander</Link>
            </Button>
          </div>
        )}

        {/* ═══ CANCELLED ═══ */}
        {order.status === "CANCELLED" && (
          <div className="rounded-2xl border border-[#ece8e3] bg-white p-6 text-center dark:border-white/10 dark:bg-[#141414]">
            <div className="mb-3 text-5xl">🚫</div>
            <h2 className="text-xl font-bold text-[#2a2018] dark:text-white">Commande annulee</h2>
            <p className="mt-2 text-sm text-[#999] dark:text-gray-400">
              Cette commande a ete annulee.
            </p>
            <Button className="mt-5 bg-[#DC2626] hover:bg-[#b91c1c]" asChild>
              <Link href="/">Découvrir les boucheries</Link>
            </Button>
          </div>
        )}

        {/* ═══ AUTO_CANCELLED ═══ */}
        {order.status === "AUTO_CANCELLED" && (
          <div className="rounded-2xl border border-amber-200 bg-white p-6 text-center dark:border-amber-800/30 dark:bg-[#141414]">
            <div className="mb-3 text-5xl">⏰</div>
            <h2 className="text-xl font-bold text-[#2a2018] dark:text-white">Commande expiree</h2>
            <p className="mt-2 text-sm text-[#999] dark:text-gray-400">
              Le boucher n&apos;a pas pu confirmer votre commande a temps. Vous pouvez reessayer ou
              choisir une autre boucherie.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Button className="bg-[#DC2626] hover:bg-[#b91c1c]" asChild>
                <Link href={`/boutique/${order.shop.slug}`}>Recommander</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">Autres boucheries</Link>
              </Button>
            </div>
          </div>
        )}

        {/* ═══ BOUCHER NOTE ═══ */}
        {order.boucherNote && (
          <div className="mt-6 rounded-2xl border border-amber-200/60 bg-amber-50 p-4 dark:border-amber-800/30 dark:bg-amber-900/10">
            <div className="mb-1.5 flex items-center gap-2">
              <MessageSquare size={14} className="text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300">
                Message du boucher
              </h3>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-400/80">{order.boucherNote}</p>
          </div>
        )}

        {/* ═══ ORDER RECAP ═══ */}
        <OrderRecap items={order.items} totalCents={order.totalCents} />
      </main>
    </div>
  );
}
