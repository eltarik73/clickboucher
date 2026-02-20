"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft, MapPin, Copy, AlertTriangle, RefreshCw, Trash2, Loader2, MessageSquare } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/ui/StarRating";

// ── Types ────────────────────────────────────────

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
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

interface OrderData {
  id: string;
  orderNumber: string;
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
  createdAt: string;
  items: OrderItem[];
  shop: OrderShop;
}

// ── Helpers ──────────────────────────────────────

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function unitLabel(unit: string) {
  if (unit === "KG") return "kg";
  if (unit === "PIECE") return "pc";
  return "barq.";
}

const TERMINAL = ["PICKED_UP", "COMPLETED", "DENIED", "CANCELLED"];

// ── Dots animation ───────────────────────────────

function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5 justify-center my-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-3 h-3 rounded-full bg-[#DC2626] animate-bounce"
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
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
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
      const total = Math.max(1, target - (target - 30 * 60_000)); // assume 30min window
      setMinsLeft(Math.ceil(remaining / 60_000));
      setPct(Math.min(100, Math.max(0, (remaining / (30 * 60_000)) * 100)));
    };
    update();
    const iv = setInterval(update, 10_000);
    return () => clearInterval(iv);
  }, [estimatedReady]);

  return (
    <div className="mt-4">
      <p className="text-sm font-semibold text-[#2a2018] dark:text-white text-center mb-2">
        Prete dans environ {minsLeft} min
      </p>
      <div className="h-2 bg-[#ece8e3] dark:bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#DC2626] rounded-full transition-all duration-1000"
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
    <div className="flex flex-col items-center mt-5">
      <div className="bg-white p-4 rounded-2xl border border-[#ece8e3] dark:border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
        <QRCodeSVG value={qrCode} size={size} level="M" />
      </div>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 mt-3 text-xs font-medium text-[#DC2626] hover:underline"
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
    <div className="mt-6 p-4 bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10">
      <h3 className="text-sm font-bold text-[#2a2018] dark:text-white mb-3">Recapitulatif</h3>
      {items.map((item) => (
        <div key={item.id} className="flex justify-between text-xs py-1.5">
          <div className="text-[#555] dark:text-gray-300">
            {item.name}
            <span className="text-[#999] dark:text-gray-400 ml-1">
              x{item.quantity} {unitLabel(item.unit)}
            </span>
          </div>
          <span className="font-semibold text-[#2a2018] dark:text-white">
            {fmtPrice(item.totalCents)}
          </span>
        </div>
      ))}
      <div className="border-t border-[#ece8e3] dark:border-white/10 pt-2 mt-2 flex justify-between">
        <span className="text-sm font-bold text-[#2a2018] dark:text-white">Total</span>
        <span className="text-sm font-extrabold text-[#2a2018] dark:text-white">
          {fmtPrice(totalCents)}
        </span>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────

export default function CommandePage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { isSignedIn } = useUser();

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
  const [decisions, setDecisions] = useState<Record<string, { action: "replace" | "remove"; replacementProductId?: string }>>({});
  const [submittingAlts, setSubmittingAlts] = useState(false);

  const orderId = params.id;

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      if (data.success) {
        setOrder(data.data);
        setError(null);
        if (data.data.rating !== null) setRatingDone(true);
      } else {
        setError(data.error?.message || "Erreur");
      }
    } catch {
      setError("Erreur reseau");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // Initial fetch + polling
  useEffect(() => {
    if (!orderId) return;
    fetchOrder();

    const iv = setInterval(() => {
      setOrder((prev) => {
        if (prev && TERMINAL.includes(prev.status)) {
          clearInterval(iv);
          return prev;
        }
        fetchOrder();
        return prev;
      });
    }, 5000);

    return () => clearInterval(iv);
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
      <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a] flex items-center justify-center">
        <LoadingDots />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a] flex flex-col items-center justify-center px-5">
        <p className="text-lg font-bold text-[#2a2018] dark:text-white mb-2">Erreur</p>
        <p className="text-sm text-[#999] dark:text-gray-400 mb-6">{error || "Commande introuvable"}</p>
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
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a] pb-10">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#f8f6f3]/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#ece8e3] dark:border-white/10 px-5 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <Link
            href="/commandes"
            className="flex items-center justify-center w-10 h-10 rounded-[14px] bg-white dark:bg-[#141414] border border-[#ece8e3] dark:border-white/10 shadow-sm"
          >
            <ArrowLeft size={17} className="text-[#333] dark:text-white" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-[#2a2018] dark:text-white">
              Commande {order.orderNumber}
            </h1>
            <p className="text-[11px] text-[#999] dark:text-gray-400">{order.shop.name}</p>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 mt-6">
        {/* ═══ PENDING ═══ */}
        {order.status === "PENDING" && (
          <div className="text-center p-6 bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10">
            <LoadingDots />
            <h2 className="text-xl font-bold text-[#2a2018] dark:text-white mt-2">
              En attente du boucher...
            </h2>
            <p className="text-sm text-[#999] dark:text-gray-400 mt-2">
              Votre commande a ete envoyee a{" "}
              <span className="font-semibold text-[#555] dark:text-gray-300">{order.shop.name}</span>.
              Le boucher va la confirmer.
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
        {order.status === "PARTIALLY_DENIED" && (() => {
          const unavailableItems = order.items.filter((i) => !i.available && !i.replacement);
          const availableItems = order.items.filter((i) => i.available);

          return (
            <div className="p-5 bg-white dark:bg-[#141414] rounded-2xl border border-orange-200 shadow-[0_0_20px_rgba(245,158,11,0.08)]">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={22} className="text-orange-500" />
                <h2 className="text-lg font-bold text-[#2a2018] dark:text-white">
                  Rupture de stock
                </h2>
              </div>
              <p className="text-sm text-[#777] dark:text-gray-400 mb-4">
                Certains articles ne sont plus disponibles chez{" "}
                <span className="font-semibold text-[#555] dark:text-gray-300">{order.shop.name}</span>.
                Choisis une alternative ou retire l&apos;article.
              </p>

              {/* Unavailable items with alternatives */}
              <div className="space-y-4 mb-4">
                {unavailableItems.map((item) => {
                  const alts = alternatives[item.productId] || [];
                  const decision = decisions[item.id];

                  return (
                    <div key={item.id} className="bg-red-50 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-red-800 line-through">
                          {item.name} — {item.quantity} {unitLabel(item.unit)}
                        </span>
                        <span className="text-xs text-red-500 font-medium">
                          Indisponible
                        </span>
                      </div>

                      {/* Alternative options */}
                      {alts.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-[#777] dark:text-gray-400">Alternatives :</p>
                          {alts.map((alt) => (
                            <button
                              key={alt.id}
                              onClick={() =>
                                setDecisions((prev) => ({
                                  ...prev,
                                  [item.id]: { action: "replace", replacementProductId: alt.id },
                                }))
                              }
                              className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-sm transition-colors ${
                                decision?.action === "replace" && decision.replacementProductId === alt.id
                                  ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                                  : "border-[#ece8e3] dark:border-white/10 bg-white dark:bg-[#141414] text-[#555] dark:text-gray-300 hover:border-emerald-300 hover:bg-emerald-50/50"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <RefreshCw size={13} className="text-emerald-500" />
                                <span>{alt.name}</span>
                              </div>
                              <span className="font-semibold">
                                {(alt.priceCents / 100).toFixed(2).replace(".", ",")} €/{alt.unit === "KG" ? "kg" : alt.unit === "PIECE" ? "pc" : "barq."}
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
                        className={`w-full flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-colors ${
                          decision?.action === "remove"
                            ? "border-red-400 bg-red-50 text-red-700"
                            : "border-[#ece8e3] dark:border-white/10 bg-white dark:bg-[#141414] text-[#999] dark:text-gray-400 hover:border-red-300"
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
                <div className="bg-emerald-50 rounded-xl p-3 mb-4">
                  <p className="text-xs font-medium text-emerald-700 mb-1">Toujours disponibles :</p>
                  {availableItems.map((item) => (
                    <p key={item.id} className="text-sm text-emerald-800">
                      • {item.name} — {item.quantity} {unitLabel(item.unit)}
                    </p>
                  ))}
                </div>
              )}

              {/* Submit button */}
              <Button
                onClick={handleSubmitAlternatives}
                disabled={submittingAlts || unavailableItems.some((i) => !decisions[i.id])}
                className="w-full bg-[#DC2626] hover:bg-[#b91c1c] gap-2"
              >
                {submittingAlts ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : null}
                {submittingAlts ? "Envoi..." : "Confirmer mes choix"}
              </Button>

              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full mt-2 text-xs text-[#999] dark:text-gray-400 hover:text-red-500 transition-colors text-center py-2"
              >
                {cancelling ? "Annulation..." : "Annuler la commande"}
              </button>
            </div>
          );
        })()}

        {/* ═══ ACCEPTED ═══ */}
        {order.status === "ACCEPTED" && (
          <div className="text-center p-6 bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10">
            <div className="text-5xl mb-3">✅</div>
            <h2 className="text-xl font-bold text-[#2a2018] dark:text-white">
              Commande acceptee !
            </h2>
            {order.estimatedReady && (
              <TimeProgress estimatedReady={order.estimatedReady} />
            )}
            {order.qrCode && <QRSection qrCode={order.qrCode} size={180} />}
          </div>
        )}

        {/* ═══ PREPARING ═══ */}
        {order.status === "PREPARING" && (
          <div className="text-center p-6 bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10">
            <div className="text-5xl mb-3">🔪</div>
            <h2 className="text-xl font-bold text-[#2a2018] dark:text-white">
              En preparation...
            </h2>
            {order.estimatedReady && (
              <TimeProgress estimatedReady={order.estimatedReady} />
            )}
            {order.qrCode && <QRSection qrCode={order.qrCode} size={180} />}
          </div>
        )}

        {/* ═══ READY ═══ */}
        {order.status === "READY" && (
          <div className="relative text-center p-6 bg-white dark:bg-[#141414] rounded-2xl border border-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
            <ConfettiBurst />
            <div className="text-6xl mb-3 animate-bounce relative z-10">🎉</div>
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
                <p className="text-xs text-[#999] dark:text-gray-400 mt-3">
                  Presentez ce QR code au boucher
                </p>
              </>
            )}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-5 px-6 py-3 bg-[#DC2626] text-white text-sm font-semibold rounded-xl hover:bg-[#b91c1c] transition-colors"
            >
              <MapPin size={16} />
              Ouvrir dans Maps
            </a>
          </div>
        )}

        {/* ═══ PICKED_UP / COMPLETED ═══ */}
        {(order.status === "PICKED_UP" || order.status === "COMPLETED") && (
          <div className="text-center p-6 bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10">
            <div className="text-5xl mb-3">✅</div>
            <h2 className="text-xl font-bold text-[#2a2018] dark:text-white">
              Commande recuperee !
            </h2>
            <p className="text-sm text-[#999] dark:text-gray-400 mt-1">Bon appetit ! 😊</p>

            {/* Rating */}
            {!ratingDone ? (
              <div className="mt-6 p-4 bg-[#f8f6f3] dark:bg-[#0a0a0a] rounded-2xl">
                <p className="text-sm font-semibold text-[#2a2018] dark:text-white mb-3">
                  Comment etait votre commande ?
                </p>
                <StarRating value={ratingValue} onChange={setRatingValue} size="lg" className="justify-center" />
                {ratingValue > 0 && (
                  <>
                    <textarea
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value)}
                      placeholder="Un commentaire ? (optionnel)"
                      maxLength={1000}
                      rows={3}
                      className="mt-3 w-full rounded-xl border border-[#ece8e3] dark:border-white/10 bg-white dark:bg-[#141414] px-4 py-3 text-sm text-[#2a2018] dark:text-white placeholder:text-[#ccc] dark:placeholder:text-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626] transition-colors"
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
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-sm text-emerald-700 font-medium">
                  Merci pour votre avis !
                </p>
              </div>
            )}
          </div>
        )}

        {/* ═══ DENIED ═══ */}
        {order.status === "DENIED" && (
          <div className="text-center p-6 bg-white dark:bg-[#141414] rounded-2xl border border-red-200">
            <div className="text-5xl mb-3">❌</div>
            <h2 className="text-xl font-bold text-[#2a2018] dark:text-white">
              Commande refusee
            </h2>
            {order.denyReason && (
              <div className="mt-3 p-3 bg-red-50 rounded-xl">
                <p className="text-sm text-red-700">{order.denyReason}</p>
              </div>
            )}
            <Button
              className="mt-5 bg-[#DC2626] hover:bg-[#b91c1c]"
              asChild
            >
              <Link href={`/boutique/${order.shop.slug}`}>Recommander</Link>
            </Button>
          </div>
        )}

        {/* ═══ CANCELLED ═══ */}
        {order.status === "CANCELLED" && (
          <div className="text-center p-6 bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10">
            <div className="text-5xl mb-3">🚫</div>
            <h2 className="text-xl font-bold text-[#2a2018] dark:text-white">
              Commande annulee
            </h2>
            <p className="text-sm text-[#999] dark:text-gray-400 mt-2">
              Cette commande a ete annulee.
            </p>
            <Button
              className="mt-5 bg-[#DC2626] hover:bg-[#b91c1c]"
              asChild
            >
              <Link href="/decouvrir">Decouvrir les boucheries</Link>
            </Button>
          </div>
        )}

        {/* ═══ BOUCHER NOTE ═══ */}
        {order.boucherNote && (
          <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200/60 dark:border-amber-800/30">
            <div className="flex items-center gap-2 mb-1.5">
              <MessageSquare size={14} className="text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300">
                Message du boucher
              </h3>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-400/80">
              {order.boucherNote}
            </p>
          </div>
        )}

        {/* ═══ ORDER RECAP ═══ */}
        <OrderRecap items={order.items} totalCents={order.totalCents} />
      </main>
    </div>
  );
}
