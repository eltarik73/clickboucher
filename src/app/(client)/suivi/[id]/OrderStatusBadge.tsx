import type { OrderStatus } from "@prisma/client";

interface BadgeStyle {
  label: string;
  color: string;
  bg: string;
}

const PENDING_BADGE: BadgeStyle = {
  label: "📦 En attente de validation",
  color: "text-amber-800 dark:text-amber-300",
  bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40",
};

// PICKED_UP and COMPLETED have no badge: the page shows « Commande retirée » instead.
const BADGES: Partial<Record<OrderStatus, BadgeStyle>> = {
  PENDING: PENDING_BADGE,
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

/** Status of the order, announced to screen readers when polling changes it (live region). */
export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const badge = BADGES[status] ?? PENDING_BADGE;

  return (
    <div
      role="status"
      aria-label="Statut de la commande"
      className={`rounded-2xl border p-4 text-center ${badge.bg}`}
    >
      <p className={`text-sm font-bold ${badge.color}`}>{badge.label}</p>
    </div>
  );
}
