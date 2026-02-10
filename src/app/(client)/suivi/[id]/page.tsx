export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, MapPin, Check, Package, Truck } from "lucide-react";
import prisma from "@/lib/prisma";

// ── Helpers ──────────────────────────────────────

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:          { label: "En attente",     color: "text-amber-700",   bg: "bg-amber-50" },
  ACCEPTED:         { label: "Acceptee",       color: "text-blue-700",    bg: "bg-blue-50" },
  PREPARING:        { label: "En preparation", color: "text-indigo-700",  bg: "bg-indigo-50" },
  READY:            { label: "Prete !",        color: "text-emerald-700", bg: "bg-emerald-50" },
  PICKED_UP:        { label: "Retiree",        color: "text-gray-600",    bg: "bg-gray-50" },
  COMPLETED:        { label: "Terminee",       color: "text-green-700",   bg: "bg-green-50" },
  DENIED:           { label: "Refusee",        color: "text-red-700",     bg: "bg-red-50" },
  CANCELLED:        { label: "Annulee",        color: "text-gray-500",    bg: "bg-gray-50" },
  PARTIALLY_DENIED: { label: "Partielle",      color: "text-orange-700",  bg: "bg-orange-50" },
};

const STEPS = [
  { key: "PENDING",    label: "Commande recue",   icon: Check },
  { key: "ACCEPTED",   label: "Acceptee",         icon: Check },
  { key: "PREPARING",  label: "En preparation",   icon: Package },
  { key: "READY",      label: "Prete au retrait", icon: Truck },
  { key: "PICKED_UP",  label: "Retiree",          icon: Check },
];

const STATUS_INDEX: Record<string, number> = {
  PENDING: 0, ACCEPTED: 1, PREPARING: 2, READY: 3, PICKED_UP: 4, COMPLETED: 4,
  DENIED: -1, CANCELLED: -1, PARTIALLY_DENIED: 1,
};

// ── Page ─────────────────────────────────────────

export default async function SuiviPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { name: true } } } },
      shop: { select: { name: true, address: true, city: true, slug: true } },
    },
  });

  if (!order) notFound();

  const currentIdx = STATUS_INDEX[order.status] ?? 0;
  const st = STATUS_LABELS[order.status] || STATUS_LABELS.PENDING;
  const isReady = order.status === "READY";
  const isDone = order.status === "PICKED_UP" || order.status === "COMPLETED";
  const isDenied = order.status === "DENIED" || order.status === "CANCELLED";

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#f8f6f3]/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#ece8e3] dark:border-white/10 px-5 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <Link
            href="/commandes"
            className="flex items-center justify-center w-10 h-10 rounded-[14px] bg-white dark:bg-[#141414] border border-[#ece8e3] dark:border-white/10 shadow-sm"
          >
            <ArrowLeft size={17} className="text-gray-900 dark:text-white" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              Commande #{order.orderNumber}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {order.shop.name}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${st.color} ${st.bg}`}>
            {st.label}
          </span>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 py-6 space-y-5">
        {/* Status card */}
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-6 text-center">
          <div
            className={`w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center ${
              isReady || isDone
                ? "bg-emerald-100"
                : isDenied
                ? "bg-red-100"
                : "bg-amber-100"
            }`}
          >
            {isReady || isDone ? (
              <Check size={24} className="text-emerald-600" />
            ) : isDenied ? (
              <span className="text-red-500 text-xl">✕</span>
            ) : (
              <Clock size={24} className="text-amber-600" />
            )}
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {isReady
              ? "Ta commande est prete !"
              : isDone
              ? "Commande terminee"
              : isDenied
              ? "Commande refusee"
              : "En cours de traitement"}
          </h2>
          {order.estimatedReady && !isDone && !isDenied && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center justify-center gap-1">
              <Clock size={13} />
              Estimee prete a{" "}
              {new Date(order.estimatedReady).toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
          {order.denyReason && (
            <p className="text-sm text-red-600 mt-2">Raison : {order.denyReason}</p>
          )}
        </div>

        {/* Timeline (hide if denied) */}
        {!isDenied && (
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Suivi</h3>
            <div className="space-y-0">
              {STEPS.map((s, i) => {
                const done = i <= currentIdx;
                const current = i === currentIdx;
                return (
                  <div key={s.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-3 h-3 rounded-full border-2 ${
                          done
                            ? "bg-[#DC2626] border-[#DC2626]"
                            : "bg-white dark:bg-[#0a0a0a] border-gray-300 dark:border-gray-600"
                        } ${current ? "ring-4 ring-[#DC2626]/15" : ""}`}
                      />
                      {i < STEPS.length - 1 && (
                        <div
                          className={`w-0.5 h-8 ${
                            done ? "bg-[#DC2626]" : "bg-gray-200 dark:bg-gray-700"
                          }`}
                        />
                      )}
                    </div>
                    <div className="pb-6">
                      <span
                        className={`text-sm ${
                          done
                            ? "text-gray-900 dark:text-white font-medium"
                            : "text-gray-400 dark:text-gray-500"
                        } ${current ? "font-bold" : ""}`}
                      >
                        {s.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Shop info */}
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
            {order.shop.name}
          </h3>
          <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <MapPin size={12} />
            {order.shop.address}, {order.shop.city}
          </p>
        </div>

        {/* Items */}
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Articles</h3>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <div className="min-w-0">
                  <span className="text-gray-900 dark:text-white">{item.name}</span>
                  <span className="text-gray-400 dark:text-gray-500 ml-1.5">
                    {item.unit === "KG"
                      ? `${item.quantity.toFixed(1)} kg`
                      : `\u00d7${item.quantity}`}
                  </span>
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

        {/* QR Code section for ready orders */}
        {isReady && order.qrCode && (
          <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-6 text-center">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Presente ce code au retrait
            </p>
            <div className="bg-gray-100 dark:bg-[#1a1a1a] rounded-xl p-4 font-mono text-lg font-bold tracking-widest text-gray-900 dark:text-white">
              {order.qrCode.slice(0, 8).toUpperCase()}
            </div>
          </div>
        )}

        {/* Date */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          Commande passee le{" "}
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
