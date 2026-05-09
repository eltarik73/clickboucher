"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Phone, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import PriceAdjustmentBanner from "@/components/client/PriceAdjustmentBanner";

// ── Types ──

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  totalCents: number;
  weightGrams: number | null;
}

interface PriceAdjustmentData {
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
}

interface OrderData {
  id: string;
  orderNumber: string;
  displayNumber: string;
  status: string;
  totalCents: number;
  customerNote: string | null;
  boucherNote: string | null;
  estimatedReady: string | null;
  actualReady: string | null;
  pickedUpAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  shop: { id: string; name: string; address: string; city: string; phone: string };
  user: { firstName: string; lastName: string; customerNumber: string | null };
  priceAdjustment: PriceAdjustmentData | null;
}

// ── Helpers ──

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtQty(item: OrderItem) {
  if (item.unit === "KG" && item.weightGrams) {
    return `${(item.weightGrams / 1000).toFixed(1).replace(".", ",")} kg`;
  }
  return `${item.quantity}x`;
}

const TERMINAL = ["PICKED_UP", "COMPLETED", "DENIED", "CANCELLED", "AUTO_CANCELLED"];

// ── Timeline steps ──

const STEPS = [
  { key: "PENDING", label: "Commande reçue", emoji: "📋" },
  { key: "ACCEPTED", label: "Acceptée", emoji: "✅" },
  { key: "PREPARING", label: "En préparation", emoji: "👨‍🍳" },
  { key: "READY", label: "Prête", emoji: "🎉" },
  { key: "PICKED_UP", label: "Retirée", emoji: "✅" },
];

function getStepIndex(status: string) {
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

// ── Component ──

// ── Status toast labels ──
const STATUS_TOAST: Record<string, { label: string; emoji: string }> = {
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
  const isTerminal = TERMINAL.includes(order.status);
  const isCollected = order.status === "PICKED_UP" || order.status === "COMPLETED";
  const isReady = order.status === "READY";
  const readySince = order.actualReady ? Date.now() - new Date(order.actualReady).getTime() : 0;
  const readyOver30 = isReady && readySince > 30 * 60 * 1000;

  const customerName = `${order.user.firstName} ${order.user.lastName.charAt(0)}.`;
  const stepIdx = getStepIndex(order.status);

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

  // ── Polling 5s ──
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${order.id}/status`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setOrder((prev) => ({
            ...prev,
            status: json.data.status,
            totalCents: json.data.totalCents ?? prev.totalCents,
            boucherNote: json.data.boucherNote ?? prev.boucherNote,
            estimatedReady: json.data.estimatedReady ?? prev.estimatedReady,
            actualReady: json.data.actualReady ?? prev.actualReady,
            pickedUpAt: json.data.pickedUpAt ?? prev.pickedUpAt,
            updatedAt: json.data.updatedAt ?? prev.updatedAt,
            displayNumber: json.data.displayNumber ?? prev.displayNumber,
            items: json.data.items?.length ? json.data.items : prev.items,
            priceAdjustment:
              json.data.priceAdjustment !== undefined
                ? json.data.priceAdjustment
                : prev.priceAdjustment,
          }));
        }
      }
    } catch {}
  }, [order.id]);

  // ── Polling adaptatif + Page Visibility (audit CTO #3 UX 2026-05-09) ──
  // - Si onglet caché : pause polling (économie batterie + bande passante)
  // - Cadence : 3s pendant PREPARING/ACCEPTED (high anticipation), 5s en
  //   PENDING, 10s en READY (déjà notifié), aucun polling en terminal
  // - Refresh immédiat au retour sur l'onglet
  useEffect(() => {
    if (isTerminal) return;

    let intervalMs = 5_000;
    if (order.status === "ACCEPTED" || order.status === "PREPARING") intervalMs = 3_000;
    else if (order.status === "READY") intervalMs = 10_000;

    let iv: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (iv) return;
      iv = setInterval(fetchStatus, intervalMs);
    };
    const stop = () => {
      if (iv) {
        clearInterval(iv);
        iv = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchStatus(); // refresh immédiat
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchStatus, isTerminal, order.status]);

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[#ece8e3] bg-[#f8f6f3]/95 px-5 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#0a0a0a]/95">
        <div className="mx-auto flex max-w-[500px] items-center gap-3">
          <Link
            href="/commandes"
            className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#ece8e3] bg-white shadow-sm dark:border-white/10 dark:bg-[#141414]"
          >
            <ArrowLeft size={17} className="text-gray-900 dark:text-white" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-gray-900 dark:text-white">Suivi commande</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{order.shop.name}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[500px] space-y-5 px-5 py-6">
        {/* ══════════════════════════════════════════════ */}
        {/* HERO — Big ticket number (shown to boucher) */}
        {/* ══════════════════════════════════════════════ */}
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
              {order.user.customerNumber && (
                <div className="mt-1 text-[14px] text-gray-500 dark:text-gray-400">
                  Client {order.user.customerNumber}
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

        {/* ══════════════════════════════════════════════ */}
        {/* 30-min reminder banner */}
        {/* ══════════════════════════════════════════════ */}
        {readyOver30 && (
          <div className="animate-pulse rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-800/40 dark:bg-amber-900/20">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
              ⏰ Votre commande {order.displayNumber} vous attend au comptoir depuis{" "}
              {Math.round(readySince / 60000)} minutes !
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════════════ */}
        {/* STATUS BADGE */}
        {/* ══════════════════════════════════════════════ */}
        {!isCollected && <StatusBadge status={order.status} />}

        {/* ══════════════════════════════════════════════ */}
        {/* PRICE ADJUSTMENT BANNER */}
        {/* ══════════════════════════════════════════════ */}
        {order.priceAdjustment && (
          <PriceAdjustmentBanner
            orderId={order.id}
            adjustment={order.priceAdjustment}
            onUpdate={fetchStatus}
          />
        )}

        {/* ══════════════════════════════════════════════ */}
        {/* TIMELINE */}
        {/* ══════════════════════════════════════════════ */}
        <div className="rounded-2xl border border-[#ece8e3] bg-white p-5 dark:border-white/10 dark:bg-[#141414]">
          <div className="space-y-0">
            {STEPS.map((step, i) => {
              const isDone = i < stepIdx;
              const isCurrent = i === stepIdx;
              const isFuture = i > stepIdx;
              const time =
                step.key === "PENDING"
                  ? fmtTime(order.createdAt)
                  : step.key === "ACCEPTED" && isDone
                    ? fmtTime(order.updatedAt)
                    : step.key === "READY" && order.actualReady
                      ? fmtTime(order.actualReady)
                      : step.key === "PICKED_UP" && order.pickedUpAt
                        ? fmtTime(order.pickedUpAt)
                        : null;

              return (
                <div key={step.key} className="flex items-start gap-3">
                  {/* Dot + line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${
                        isDone
                          ? "bg-emerald-100 dark:bg-emerald-900/30"
                          : isCurrent
                            ? "animate-pulse bg-blue-100 dark:bg-blue-900/30"
                            : "bg-gray-100 dark:bg-white/5"
                      }`}
                    >
                      {isDone ? "✅" : isCurrent ? "🔵" : "○"}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div
                        className={`h-8 w-0.5 ${
                          isDone
                            ? "bg-emerald-300 dark:bg-emerald-700"
                            : "bg-gray-200 dark:bg-white/10"
                        }`}
                      />
                    )}
                  </div>

                  {/* Label */}
                  <div className="pt-1">
                    <span
                      className={`text-sm font-semibold ${
                        isFuture
                          ? "text-gray-500 dark:text-gray-400 dark:text-gray-600"
                          : "text-gray-900 dark:text-white"
                      }`}
                    >
                      {step.label}
                    </span>
                    {time && (
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{time}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════════ */}
        {/* ITEMS */}
        {/* ══════════════════════════════════════════════ */}
        <div className="rounded-2xl border border-[#ece8e3] bg-white p-5 dark:border-white/10 dark:bg-[#141414]">
          <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">Détails</h3>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <div className="min-w-0">
                  <span className="text-gray-900 dark:text-white">{item.name}</span>
                  <span className="ml-1.5 text-gray-500 dark:text-gray-400">{fmtQty(item)}</span>
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

        {/* ══════════════════════════════════════════════ */}
        {/* BOUCHER NOTE */}
        {/* ══════════════════════════════════════════════ */}
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

        {/* ══════════════════════════════════════════════ */}
        {/* SHOP INFO */}
        {/* ══════════════════════════════════════════════ */}
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

        {/* ══════════════════════════════════════════════ */}
        {/* ESTIMATED TIME + COUNTDOWN */}
        {/* ══════════════════════════════════════════════ */}
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
          })}
        </p>
      </main>
    </div>
  );
}

// ── Estimated Countdown ──

function EstimatedCountdown({ estimatedReady }: { estimatedReady: string }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const target = new Date(estimatedReady).getTime();
  const diffMs = target - now;
  const isLate = diffMs < 0;
  const absDiff = Math.abs(diffMs);
  const minutes = Math.floor(absDiff / 60_000);
  const seconds = Math.floor((absDiff % 60_000) / 1000);

  return (
    <div
      className={`rounded-2xl border p-5 text-center ${
        isLate
          ? "border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/20"
          : "border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-900/20"
      }`}
    >
      <p
        className={`mb-1 text-xs font-medium ${isLate ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"}`}
      >
        {isLate ? "Retrait estimé dépassé de" : "Prête dans environ"}
      </p>
      <p
        className={`text-3xl font-black tabular-nums tracking-tight ${
          isLate ? "text-amber-800 dark:text-amber-300" : "text-blue-800 dark:text-blue-300"
        }`}
      >
        {minutes > 0 ? `${minutes} min ${seconds.toString().padStart(2, "0")}s` : `${seconds}s`}
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Retrait estimé : {fmtTime(estimatedReady)}
      </p>
    </div>
  );
}

// ── Status Badge ──

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    PENDING: {
      label: "📦 En attente de validation",
      color: "text-amber-800 dark:text-amber-300",
      bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40",
    },
    ACCEPTED: {
      label: "✅ Commande acceptée",
      color: "text-blue-800 dark:text-blue-300",
      bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40",
    },
    PREPARING: {
      label: "👨‍🍳 En préparation",
      color: "text-indigo-800 dark:text-indigo-300",
      bg: "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/40",
    },
    READY: {
      label: "🎉 Commande prête !",
      color: "text-emerald-800 dark:text-emerald-300",
      bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40",
    },
    DENIED: {
      label: "❌ Commande refusée",
      color: "text-red-800 dark:text-red-300",
      bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40",
    },
    CANCELLED: {
      label: "🚫 Commande annulée",
      color: "text-gray-600 dark:text-gray-400",
      bg: "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800/40",
    },
    AUTO_CANCELLED: {
      label: "⏰ Commande expirée",
      color: "text-gray-600 dark:text-gray-400",
      bg: "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800/40",
    },
    PARTIALLY_DENIED: {
      label: "⚠️ Partiellement refusée",
      color: "text-orange-800 dark:text-orange-300",
      bg: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/40",
    },
  };

  const c = config[status] || config.PENDING;

  return (
    <div className={`rounded-2xl border p-4 text-center ${c.bg}`}>
      <p className={`text-sm font-bold ${c.color}`}>{c.label}</p>
    </div>
  );
}
