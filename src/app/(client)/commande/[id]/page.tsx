"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft, MapPin, Copy } from "lucide-react";
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
      <p className="text-sm font-semibold text-[#2a2018] text-center mb-2">
        Prete dans environ {minsLeft} min
      </p>
      <div className="h-2 bg-[#ece8e3] rounded-full overflow-hidden">
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
      <div className="bg-white p-4 rounded-2xl border border-[#ece8e3] shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
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
    <div className="mt-6 p-4 bg-white rounded-2xl border border-[#ece8e3]">
      <h3 className="text-sm font-bold text-[#2a2018] mb-3">Recapitulatif</h3>
      {items.map((item) => (
        <div key={item.id} className="flex justify-between text-xs py-1.5">
          <div className="text-[#555]">
            {item.name}
            <span className="text-[#999] ml-1">
              x{item.quantity} {unitLabel(item.unit)}
            </span>
          </div>
          <span className="font-semibold text-[#2a2018]">
            {fmtPrice(item.totalCents)}
          </span>
        </div>
      ))}
      <div className="border-t border-[#ece8e3] pt-2 mt-2 flex justify-between">
        <span className="text-sm font-bold text-[#2a2018]">Total</span>
        <span className="text-sm font-extrabold text-[#2a2018]">
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
  params: Promise<{ id: string }>;
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

  const [orderId, setOrderId] = useState<string | null>(null);

  // Resolve params promise
  useEffect(() => {
    params.then((p) => setOrderId(p.id));
  }, [params]);

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

  // Rate handler
  const handleRate = async () => {
    if (!order || ratingValue === 0) return;
    setRatingSubmitting(true);
    try {
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
      <div className="min-h-screen bg-[#f8f6f3] flex items-center justify-center">
        <LoadingDots />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#f8f6f3] flex flex-col items-center justify-center px-5">
        <p className="text-lg font-bold text-[#2a2018] mb-2">Erreur</p>
        <p className="text-sm text-[#999] mb-6">{error || "Commande introuvable"}</p>
        <Button className="bg-[#DC2626] hover:bg-[#DC2626]" asChild>
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
    <div className="min-h-screen bg-[#f8f6f3] pb-10">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#f8f6f3]/95 backdrop-blur-xl border-b border-[#ece8e3] px-5 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <Link
            href="/commandes"
            className="flex items-center justify-center w-10 h-10 rounded-[14px] bg-white border border-[#ece8e3] shadow-sm"
          >
            <ArrowLeft size={17} className="text-[#333]" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-[#2a2018]">
              Commande {order.orderNumber}
            </h1>
            <p className="text-[11px] text-[#999]">{order.shop.name}</p>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 mt-6">
        {/* ═══ PENDING ═══ */}
        {order.status === "PENDING" && (
          <div className="text-center p-6 bg-white rounded-2xl border border-[#ece8e3]">
            <LoadingDots />
            <h2 className="text-xl font-bold text-[#2a2018] mt-2">
              En attente du boucher...
            </h2>
            <p className="text-sm text-[#999] mt-2">
              Votre commande a ete envoyee a{" "}
              <span className="font-semibold text-[#555]">{order.shop.name}</span>.
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

        {/* ═══ ACCEPTED ═══ */}
        {order.status === "ACCEPTED" && (
          <div className="text-center p-6 bg-white rounded-2xl border border-[#ece8e3]">
            <div className="text-5xl mb-3">✅</div>
            <h2 className="text-xl font-bold text-[#2a2018]">
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
          <div className="text-center p-6 bg-white rounded-2xl border border-[#ece8e3]">
            <div className="text-5xl mb-3">🔪</div>
            <h2 className="text-xl font-bold text-[#2a2018]">
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
          <div className="text-center p-6 bg-white rounded-2xl border border-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
            <div className="text-6xl mb-3 animate-bounce">🎉</div>
            <h2 className="text-2xl font-bold text-[#2a2018]">
              Votre commande est prete !
            </h2>
            <div className="mt-4 flex items-center justify-center gap-1 text-sm text-[#555]">
              <MapPin size={14} className="text-[#DC2626]" />
              <span className="font-semibold">
                {order.shop.address}, {order.shop.city}
              </span>
            </div>
            {order.qrCode && (
              <>
                <QRSection qrCode={order.qrCode} size={220} />
                <p className="text-xs text-[#999] mt-3">
                  Presentez ce QR code au boucher
                </p>
              </>
            )}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-5 px-6 py-3 bg-[#DC2626] text-white text-sm font-semibold rounded-xl hover:bg-[#DC2626] transition-colors"
            >
              <MapPin size={16} />
              Ouvrir dans Maps
            </a>
          </div>
        )}

        {/* ═══ PICKED_UP / COMPLETED ═══ */}
        {(order.status === "PICKED_UP" || order.status === "COMPLETED") && (
          <div className="text-center p-6 bg-white rounded-2xl border border-[#ece8e3]">
            <div className="text-5xl mb-3">✅</div>
            <h2 className="text-xl font-bold text-[#2a2018]">
              Commande recuperee !
            </h2>
            <p className="text-sm text-[#999] mt-1">Bon appetit ! 😊</p>

            {/* Rating */}
            {!ratingDone ? (
              <div className="mt-6 p-4 bg-[#f8f6f3] rounded-2xl">
                <p className="text-sm font-semibold text-[#2a2018] mb-3">
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
                      className="mt-3 w-full rounded-xl border border-[#ece8e3] bg-white px-4 py-3 text-sm text-[#2a2018] placeholder:text-[#ccc] resize-none focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626] transition-colors"
                    />
                    <Button
                      onClick={handleRate}
                      disabled={ratingSubmitting}
                      className="mt-3 w-full bg-[#DC2626] hover:bg-[#DC2626]"
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
          <div className="text-center p-6 bg-white rounded-2xl border border-red-200">
            <div className="text-5xl mb-3">❌</div>
            <h2 className="text-xl font-bold text-[#2a2018]">
              Commande refusee
            </h2>
            {order.denyReason && (
              <div className="mt-3 p-3 bg-red-50 rounded-xl">
                <p className="text-sm text-red-700">{order.denyReason}</p>
              </div>
            )}
            <Button
              className="mt-5 bg-[#DC2626] hover:bg-[#DC2626]"
              asChild
            >
              <Link href={`/boutique/${order.shop.slug}`}>Recommander</Link>
            </Button>
          </div>
        )}

        {/* ═══ CANCELLED ═══ */}
        {order.status === "CANCELLED" && (
          <div className="text-center p-6 bg-white rounded-2xl border border-[#ece8e3]">
            <div className="text-5xl mb-3">🚫</div>
            <h2 className="text-xl font-bold text-[#2a2018]">
              Commande annulee
            </h2>
            <p className="text-sm text-[#999] mt-2">
              Cette commande a ete annulee.
            </p>
            <Button
              className="mt-5 bg-[#DC2626] hover:bg-[#DC2626]"
              asChild
            >
              <Link href="/decouvrir">Decouvrir les boucheries</Link>
            </Button>
          </div>
        )}

        {/* ═══ ORDER RECAP ═══ */}
        <OrderRecap items={order.items} totalCents={order.totalCents} />
      </main>
    </div>
  );
}
