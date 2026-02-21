"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Phone, MessageSquare } from "lucide-react";

// ── Types ──

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  totalCents: number;
  weightGrams: number | null;
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

export default function SuiviClient({ order: initial }: { order: OrderData }) {
  const [order, setOrder] = useState(initial);
  const isTerminal = TERMINAL.includes(order.status);
  const isCollected = order.status === "PICKED_UP" || order.status === "COMPLETED";
  const isReady = order.status === "READY";
  const readySince = order.actualReady ? Date.now() - new Date(order.actualReady).getTime() : 0;
  const readyOver30 = isReady && readySince > 30 * 60 * 1000;

  const customerName = `${order.user.firstName} ${order.user.lastName.charAt(0)}.`;
  const stepIdx = getStepIndex(order.status);

  // ── Polling 10s ──
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${order.id}/status`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setOrder((prev) => ({
            ...prev,
            status: json.data.status,
            boucherNote: json.data.boucherNote ?? prev.boucherNote,
            estimatedReady: json.data.estimatedReady ?? prev.estimatedReady,
            actualReady: json.data.actualReady ?? prev.actualReady,
            pickedUpAt: json.data.pickedUpAt ?? prev.pickedUpAt,
            updatedAt: json.data.updatedAt ?? prev.updatedAt,
            displayNumber: json.data.displayNumber ?? prev.displayNumber,
          }));
        }
      }
    } catch {}
  }, [order.id]);

  useEffect(() => {
    if (isTerminal) return;
    const iv = setInterval(fetchStatus, 10_000);
    return () => clearInterval(iv);
  }, [fetchStatus, isTerminal]);

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#f8f6f3]/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#ece8e3] dark:border-white/10 px-5 py-3">
        <div className="max-w-[500px] mx-auto flex items-center gap-3">
          <Link
            href="/commandes"
            className="flex items-center justify-center w-10 h-10 rounded-[14px] bg-white dark:bg-[#141414] border border-[#ece8e3] dark:border-white/10 shadow-sm"
          >
            <ArrowLeft size={17} className="text-gray-900 dark:text-white" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-gray-900 dark:text-white">
              Suivi commande
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{order.shop.name}</p>
          </div>
        </div>
      </header>

      <main className="max-w-[500px] mx-auto px-5 py-6 space-y-5">
        {/* ══════════════════════════════════════════════ */}
        {/* HERO — Big ticket number (shown to boucher) */}
        {/* ══════════════════════════════════════════════ */}
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 py-10 px-6 text-center">
          {isCollected ? (
            <>
              <div className="text-5xl mb-3">✅</div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                Commande retirée — Merci !
              </p>
            </>
          ) : (
            <>
              <div
                className="text-[72px] leading-none font-black text-[#DC2626] tracking-tight"
                style={{ fontFamily: "DM Sans, sans-serif" }}
              >
                {order.displayNumber}
              </div>
              <div className="mt-3 text-[28px] font-bold text-gray-900 dark:text-white leading-tight">
                {customerName}
              </div>
              {order.user.customerNumber && (
                <div className="mt-1 text-[14px] text-gray-400 dark:text-gray-500">
                  Client {order.user.customerNumber}
                </div>
              )}
              <p className="mt-4 text-[13px] text-gray-400 dark:text-gray-500 leading-relaxed">
                Présentez ce numéro au comptoir<br />pour retirer votre commande.
              </p>
            </>
          )}
        </div>

        {/* ══════════════════════════════════════════════ */}
        {/* 30-min reminder banner */}
        {/* ══════════════════════════════════════════════ */}
        {readyOver30 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4 text-center animate-pulse">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
              ⏰ Votre commande {order.displayNumber} vous attend au comptoir depuis {Math.round(readySince / 60000)} minutes !
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════════════ */}
        {/* STATUS BADGE */}
        {/* ══════════════════════════════════════════════ */}
        {!isCollected && (
          <StatusBadge status={order.status} />
        )}

        {/* ══════════════════════════════════════════════ */}
        {/* TIMELINE */}
        {/* ══════════════════════════════════════════════ */}
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-5">
          <div className="space-y-0">
            {STEPS.map((step, i) => {
              const isDone = i < stepIdx;
              const isCurrent = i === stepIdx;
              const isFuture = i > stepIdx;
              const time =
                step.key === "PENDING" ? fmtTime(order.createdAt)
                : step.key === "ACCEPTED" && isDone ? fmtTime(order.updatedAt)
                : step.key === "READY" && order.actualReady ? fmtTime(order.actualReady)
                : step.key === "PICKED_UP" && order.pickedUpAt ? fmtTime(order.pickedUpAt)
                : null;

              return (
                <div key={step.key} className="flex items-start gap-3">
                  {/* Dot + line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 ${
                        isDone
                          ? "bg-emerald-100 dark:bg-emerald-900/30"
                          : isCurrent
                          ? "bg-blue-100 dark:bg-blue-900/30 animate-pulse"
                          : "bg-gray-100 dark:bg-white/5"
                      }`}
                    >
                      {isDone ? "✅" : isCurrent ? "🔵" : "○"}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div
                        className={`w-0.5 h-8 ${
                          isDone ? "bg-emerald-300 dark:bg-emerald-700" : "bg-gray-200 dark:bg-white/10"
                        }`}
                      />
                    )}
                  </div>

                  {/* Label */}
                  <div className="pt-1">
                    <span
                      className={`text-sm font-semibold ${
                        isFuture ? "text-gray-400 dark:text-gray-600" : "text-gray-900 dark:text-white"
                      }`}
                    >
                      {step.label}
                    </span>
                    {time && (
                      <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{time}</span>
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
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Détails</h3>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <div className="min-w-0">
                  <span className="text-gray-900 dark:text-white">{item.name}</span>
                  <span className="text-gray-400 dark:text-gray-500 ml-1.5">{fmtQty(item)}</span>
                </div>
                <span className="font-semibold text-gray-900 dark:text-white shrink-0">
                  {fmtPrice(item.totalCents)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-[#ece8e3] dark:border-white/10 pt-3 mt-3 flex justify-between">
            <span className="text-sm font-bold text-gray-900 dark:text-white">Total</span>
            <span className="text-lg font-extrabold text-gray-900 dark:text-white">
              {fmtPrice(order.totalCents)}
            </span>
          </div>
          {order.customerNote && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 italic">
              Note : {order.customerNote}
            </p>
          )}
        </div>

        {/* ══════════════════════════════════════════════ */}
        {/* BOUCHER NOTE */}
        {/* ══════════════════════════════════════════════ */}
        {order.boucherNote && (
          <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200/60 dark:border-amber-800/30 p-4">
            <div className="flex items-center gap-2 mb-1.5">
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
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
            📍 {order.shop.name}
          </h3>
          <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <MapPin size={12} />
            {order.shop.address}, {order.shop.city}
          </p>
          {order.shop.phone && (
            <a
              href={`tel:${order.shop.phone}`}
              className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 mt-1.5"
            >
              <Phone size={12} />
              {order.shop.phone}
            </a>
          )}
        </div>

        {/* ══════════════════════════════════════════════ */}
        {/* ESTIMATED TIME */}
        {/* ══════════════════════════════════════════════ */}
        {order.estimatedReady && !isCollected && (
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              🕐 Retrait estimé : <span className="font-bold text-gray-900 dark:text-white">{fmtTime(order.estimatedReady)}</span>
            </p>
          </div>
        )}

        {/* Date */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
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

// ── Status Badge ──

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    PENDING: { label: "📦 En attente de validation", color: "text-amber-800 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40" },
    ACCEPTED: { label: "✅ Commande acceptée", color: "text-blue-800 dark:text-blue-300", bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40" },
    PREPARING: { label: "👨‍🍳 En préparation", color: "text-indigo-800 dark:text-indigo-300", bg: "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/40" },
    READY: { label: "🎉 Commande prête !", color: "text-emerald-800 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40" },
    DENIED: { label: "❌ Commande refusée", color: "text-red-800 dark:text-red-300", bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40" },
    CANCELLED: { label: "🚫 Commande annulée", color: "text-gray-600 dark:text-gray-400", bg: "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800/40" },
    AUTO_CANCELLED: { label: "⏰ Commande expirée", color: "text-gray-600 dark:text-gray-400", bg: "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800/40" },
    PARTIALLY_DENIED: { label: "⚠️ Partiellement refusée", color: "text-orange-800 dark:text-orange-300", bg: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/40" },
  };

  const c = config[status] || config.PENDING;

  return (
    <div className={`rounded-2xl border p-4 text-center ${c.bg}`}>
      <p className={`text-sm font-bold ${c.color}`}>{c.label}</p>
    </div>
  );
}
