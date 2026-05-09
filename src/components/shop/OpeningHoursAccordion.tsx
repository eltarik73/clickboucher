// src/components/shop/OpeningHoursAccordion.tsx
// Audit CTO #3 UX 2026-05-09 : horaires d'ouverture jamais affichés sur la
// page boutique → estimation -8 à -15% conversion (décision tardive bloquée).
// Composant Server par défaut (pas d'interactivité besoin), <details> natif.
import { Clock } from "lucide-react";
import { getShopStatus, type OpeningHours } from "@/lib/shop-hours";

const DAYS_FR: { key: string; label: string }[] = [
  { key: "mon", label: "Lundi" },
  { key: "tue", label: "Mardi" },
  { key: "wed", label: "Mercredi" },
  { key: "thu", label: "Jeudi" },
  { key: "fri", label: "Vendredi" },
  { key: "sat", label: "Samedi" },
  { key: "sun", label: "Dimanche" },
];

function jsDayToKey(jsDay: number): string {
  // 0 = Sunday, 1 = Monday … 6 = Saturday
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][jsDay];
}

function fmtRange(value: { open: string; close: string } | null | undefined): string {
  if (!value || !value.open || !value.close) return "Fermé";
  return `${value.open} – ${value.close}`;
}

export function OpeningHoursAccordion({ hours }: { hours: OpeningHours | null | undefined }) {
  if (!hours || Object.keys(hours).length === 0) return null;

  const status = getShopStatus(hours);
  const todayKey = jsDayToKey(new Date().getDay());

  const statusLabel =
    status.status === "OPEN"
      ? "Ouvert maintenant"
      : status.status === "CLOSING_SOON"
        ? `Ferme bientôt (${status.minutesLeft} min)`
        : "Fermé";

  const statusColor =
    status.status === "OPEN"
      ? "bg-emerald-500"
      : status.status === "CLOSING_SOON"
        ? "bg-amber-500"
        : "bg-gray-400";

  return (
    <details className="group mx-5 mb-2 overflow-hidden rounded-xl border border-[#ece8e3] bg-white dark:border-white/10 dark:bg-white/[0.03]">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
        <span className="flex items-center gap-2">
          <Clock size={14} className="shrink-0 text-gray-500 dark:text-gray-400" />
          <span className="font-semibold">Horaires d&apos;ouverture</span>
          <span className="flex items-center gap-1.5 text-xs font-normal text-gray-600 dark:text-gray-400">
            <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} aria-hidden="true" />
            {statusLabel}
          </span>
        </span>
        <span className="shrink-0 text-gray-500 transition-transform group-open:rotate-180 dark:text-gray-400">
          ▼
        </span>
      </summary>
      <ul className="border-t border-[#ece8e3] bg-[#f8f6f3] px-4 py-3 dark:border-white/10 dark:bg-black/20">
        {DAYS_FR.map(({ key, label }) => {
          const isToday = key === todayKey;
          return (
            <li
              key={key}
              className={`flex items-center justify-between py-1 text-sm ${
                isToday
                  ? "font-bold text-gray-900 dark:text-white"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              <span>
                {label}
                {isToday && (
                  <span className="ml-2 text-xs font-normal text-[#DC2626]">aujourd&apos;hui</span>
                )}
              </span>
              <span>
                {fmtRange(hours[key] as { open: string; close: string } | null | undefined)}
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
