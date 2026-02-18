export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import prisma from "@/lib/prisma";
import OrderTracker from "@/components/order/OrderTracker";
import ReorderSection from "@/components/order/ReorderSection";

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

// ── Page ─────────────────────────────────────────

export default async function SuiviPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { name: true } } } },
      shop: { select: { name: true, address: true, city: true, slug: true } },
    },
  });

  if (!order) notFound();

  const st = STATUS_LABELS[order.status] || STATUS_LABELS.PENDING;
  const isReady = order.status === "READY";
  const isCompleted = order.status === "COMPLETED" || order.status === "PICKED_UP";

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
        {/* Real-time order tracker with SSE */}
        <OrderTracker
          orderId={order.id}
          status={order.status as "PENDING" | "ACCEPTED" | "PREPARING" | "READY" | "PICKED_UP" | "COMPLETED" | "DENIED" | "CANCELLED" | "PARTIALLY_DENIED" | "AUTO_CANCELLED"}
          estimatedReady={order.estimatedReady?.toISOString() ?? null}
          actualReady={order.actualReady?.toISOString() ?? null}
          denyReason={order.denyReason}
          shopName={order.shop.name}
          enableSSE
        />

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
                      : `×${item.quantity}`}
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

        {/* Reorder section for completed orders */}
        {isCompleted && (
          <ReorderSection orderId={order.id} shopName={order.shop.name} />
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
