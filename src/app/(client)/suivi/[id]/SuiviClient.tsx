"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Phone, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import type { OrderStatus } from "@prisma/client";
import PriceAdjustmentBanner from "@/components/client/PriceAdjustmentBanner";
import { Button } from "@/components/ui/button";
import { useOrderTracker, type TrackedOrder } from "@/hooks/useOrderTracker";
import { PARIS_TIME_ZONE } from "@/lib/paris-time";
import { formatStoredLineQuantity } from "@/lib/pricing/format";
import CancelOrderButton from "./CancelOrderButton";
import EstimatedCountdown from "./EstimatedCountdown";
import OrderStatusBadge from "./OrderStatusBadge";
import TrackingTimeline from "./TrackingTimeline";

interface OrderData extends Omit<TrackedOrder, "displayNumber"> {
  orderNumber: string;
  displayNumber: string;
  /** Customer number in this shop, already formatted ("C-012"); null when the order has none. */
  customerNumber: string | null;
  customerNote: string | null;
  shop: { id: string; name: string; address: string; city: string; phone: string };
  user: { firstName: string; lastName: string };
}

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}

/**
 * The page's order with a fresh read applied: the fields that change while the customer watches.
 * A read older than the order on screen (an answer overtaken by a later one) changes nothing.
 */
function withUpdate(prev: OrderData, fresh: TrackedOrder): OrderData {
  if (Date.parse(fresh.updatedAt) < Date.parse(prev.updatedAt)) return prev;
  return {
    ...prev,
    status: fresh.status,
    totalCents: fresh.totalCents,
    boucherNote: fresh.boucherNote,
    estimatedReady: fresh.estimatedReady,
    actualReady: fresh.actualReady,
    pickedUpAt: fresh.pickedUpAt,
    updatedAt: fresh.updatedAt,
    displayNumber: fresh.displayNumber ?? prev.displayNumber,
    items: fresh.items,
    priceAdjustment: fresh.priceAdjustment,
  };
}

const READY_REMINDER_MS = 30 * 60 * 1000;

// Toast shown when polling brings a new status.
const STATUS_TOAST: Partial<Record<OrderStatus, { label: string; emoji: string }>> = {
  ACCEPTED: { label: "Commande acceptée !", emoji: "✅" },
  PREPARING: { label: "En préparation...", emoji: "👨‍🍳" },
  READY: { label: "Commande prête — venez la chercher !", emoji: "🎉" },
  PICKED_UP: { label: "Commande retirée — bon appétit !", emoji: "🥩" },
  DENIED: { label: "Commande refusée", emoji: "❌" },
  CANCELLED: { label: "Commande annulée", emoji: "🚫" },
};

export default function SuiviClient({ order: initial }: { order: OrderData }) {
  const [order, setOrder] = useState(initial);
  const prevStatusRef = useRef(initial.status);
  // Time the order has waited at the counter, read after mount and at each update (no clock in
  // the server render).
  const [readySinceMs, setReadySinceMs] = useState<number | null>(null);
  const isCollected = order.status === "PICKED_UP" || order.status === "COMPLETED";
  const isReady = order.status === "READY";
  const waitingMinutes =
    readySinceMs !== null && readySinceMs > READY_REMINDER_MS
      ? Math.round(readySinceMs / 60_000)
      : null;

  const customerName = `${order.user.firstName} ${order.user.lastName.charAt(0)}.`;

  // ── Live tracking (polling while the tab is visible) ──
  const applyUpdate = useCallback(
    (fresh: TrackedOrder) => setOrder((prev) => withUpdate(prev, fresh)),
    []
  );
  const { refresh } = useOrderTracker({
    orderId: order.id,
    status: order.status,
    onUpdate: applyUpdate,
  });
  const onCancelled = useCallback(
    (cancelled: TrackedOrder) => {
      // The cancel button has already confirmed it: no second toast for this change.
      prevStatusRef.current = cancelled.status;
      applyUpdate(cancelled);
    },
    [applyUpdate]
  );

  // ── Toast on status change ──
  useEffect(() => {
    if (order.status !== prevStatusRef.current) {
      const info = STATUS_TOAST[order.status];
      if (info) {
        toast(info.label, { icon: info.emoji });
      }
      prevStatusRef.current = order.status;
    }
  }, [order.status]);

  useEffect(() => {
    setReadySinceMs(
      order.status === "READY" && order.actualReady
        ? Date.now() - Date.parse(order.actualReady)
        : null
    );
  }, [order]);

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[#ece8e3] bg-[#f8f6f3]/95 px-5 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#0a0a0a]/95">
        <div className="mx-auto flex max-w-[500px] items-center gap-3">
          <Link
            href="/commandes"
            prefetch={false}
            aria-label="Mes commandes"
            className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#ece8e3] bg-white shadow-sm dark:border-white/10 dark:bg-[#141414]"
          >
            <ArrowLeft size={17} className="text-gray-900 dark:text-white" aria-hidden="true" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-gray-900 dark:text-white">Suivi commande</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{order.shop.name}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[500px] space-y-5 px-5 py-6">
        {/* HERO — Big ticket number (shown to boucher) */}
        <div className="rounded-2xl border border-[#ece8e3] bg-white px-6 py-10 text-center dark:border-white/10 dark:bg-[#141414]">
          {isCollected ? (
            <>
              <div className="mb-3 text-5xl">✅</div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                Commande retirée — Merci !
              </p>
            </>
          ) : (
            <>
              <div
                className="text-[72px] font-black leading-none tracking-tight text-[#DC2626]"
                style={{ fontFamily: "var(--font-body), sans-serif" }}
              >
                {order.displayNumber}
              </div>
              <div className="mt-3 text-[28px] font-bold leading-tight text-gray-900 dark:text-white">
                {customerName}
              </div>
              {order.customerNumber && (
                <div className="mt-1 text-[14px] text-gray-500 dark:text-gray-400">
                  Client {order.customerNumber}
                </div>
              )}
              <p className="mt-4 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
                Présentez ce numéro au comptoir
                <br />
                pour retirer votre commande.
              </p>
            </>
          )}
        </div>

        {/* 30-min reminder banner */}
        {waitingMinutes !== null && (
          <div className="animate-pulse rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-800/40 dark:bg-amber-900/20">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
              ⏰ Votre commande {order.displayNumber} vous attend au comptoir depuis{" "}
              {waitingMinutes} minutes !
            </p>
          </div>
        )}

        {/* STATUS, CANCEL, OUT-OF-STOCK QUESTION */}
        {!isCollected && <OrderStatusBadge status={order.status} />}
        <CancelOrderButton
          orderId={order.id}
          status={order.status}
          createdAt={order.createdAt}
          onCancelled={onCancelled}
        />
        {order.status === "PARTIALLY_DENIED" && (
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-center dark:border-orange-800/40 dark:bg-orange-900/20">
            <p className="text-sm font-bold text-orange-800 dark:text-orange-300">
              Un article n'est plus disponible
            </p>
            <Button asChild className="mt-3 w-full">
              <Link href={`/commande/${order.id}`} prefetch={false}>
                Choisir un remplacement
              </Link>
            </Button>
          </div>
        )}

        {/* PRICE ADJUSTMENT BANNER */}
        {order.priceAdjustment && (
          <PriceAdjustmentBanner
            orderId={order.id}
            adjustment={order.priceAdjustment}
            onUpdate={refresh}
          />
        )}

        <TrackingTimeline order={order} />

        {/* ITEMS */}
        <div className="rounded-2xl border border-[#ece8e3] bg-white p-5 dark:border-white/10 dark:bg-[#141414]">
          <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">Détails</h3>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <div className="min-w-0">
                  <span className="text-gray-900 dark:text-white">{item.name}</span>
                  <span className="ml-1.5 text-gray-500 dark:text-gray-400">
                    {formatStoredLineQuantity(item)}
                  </span>
                </div>
                <span className="shrink-0 font-semibold text-gray-900 dark:text-white">
                  {fmtPrice(item.totalCents)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t border-[#ece8e3] pt-3 dark:border-white/10">
            <span className="text-sm font-bold text-gray-900 dark:text-white">Total</span>
            <span className="text-lg font-extrabold text-gray-900 dark:text-white">
              {fmtPrice(order.totalCents)}
            </span>
          </div>
          {order.customerNote && (
            <p className="mt-3 text-xs italic text-gray-500 dark:text-gray-400">
              Note : {order.customerNote}
            </p>
          )}
        </div>

        {/* BOUCHER NOTE */}
        {order.boucherNote && (
          <div className="rounded-2xl border border-amber-200/60 bg-amber-50 p-4 dark:border-amber-800/30 dark:bg-amber-900/10">
            <div className="mb-1.5 flex items-center gap-2">
              <MessageSquare size={14} className="text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300">
                Message du boucher
              </h3>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-400/80">{order.boucherNote}</p>
          </div>
        )}

        {/* SHOP INFO */}
        <div className="rounded-2xl border border-[#ece8e3] bg-white p-4 dark:border-white/10 dark:bg-[#141414]">
          <h3 className="mb-2 text-sm font-bold text-gray-900 dark:text-white">
            📍 {order.shop.name}
          </h3>
          <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <MapPin size={12} />
            {order.shop.address}, {order.shop.city}
          </p>
          {order.shop.phone && (
            <a
              href={`tel:${order.shop.phone}`}
              className="mt-1.5 flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400"
            >
              <Phone size={12} />
              {order.shop.phone}
            </a>
          )}
        </div>

        {/* ESTIMATED TIME + COUNTDOWN */}
        {order.estimatedReady && !isCollected && !isReady && (
          <EstimatedCountdown estimatedReady={order.estimatedReady} />
        )}

        {/* Date */}
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">
          Commande passée le{" "}
          {new Date(order.createdAt).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: PARIS_TIME_ZONE,
          })}
        </p>
      </div>
    </div>
  );
}
