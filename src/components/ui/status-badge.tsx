import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── Order Status ─────────────────────────────────

const ORDER_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING:          { label: "En attente",      className: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700/30" },
  ACCEPTED:         { label: "Acceptée",        className: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700/30" },
  PREPARING:        { label: "En préparation",  className: "bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700/30" },
  READY:            { label: "Prête",           className: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/30" },
  PICKED_UP:        { label: "Récupérée",       className: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700" },
  COMPLETED:        { label: "Terminée",        className: "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700/30" },
  DENIED:           { label: "Refusée",         className: "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700/30" },
  CANCELLED:        { label: "Annulée",         className: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700" },
  AUTO_CANCELLED:   { label: "Expirée",         className: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700" },
  PARTIALLY_DENIED: { label: "Partielle",       className: "bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700/30" },
};

const ORDER_FALLBACK = { label: "Inconnu", className: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700" };

export function OrderStatusBadge({ status, className }: { status: string; className?: string }) {
  const config = ORDER_STATUS_CONFIG[status] ?? ORDER_FALLBACK;
  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}

// ── Shop Status ──────────────────────────────────

const SHOP_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  OPEN:        { label: "Ouvert",     className: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/30" },
  BUSY:        { label: "Occupé",     className: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700/30" },
  PAUSED:      { label: "En pause",   className: "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700/30" },
  AUTO_PAUSED: { label: "Pause auto", className: "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700/30" },
  CLOSED:      { label: "Fermé",      className: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700" },
  VACATION:    { label: "Vacances",   className: "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700/30" },
};

const SHOP_FALLBACK = { label: "Inconnu", className: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700" };

export function ShopStatusBadge({ status, className }: { status: string; className?: string }) {
  const config = SHOP_STATUS_CONFIG[status] ?? SHOP_FALLBACK;
  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
