// src/components/boucher/AntiGaspiActiveInfo.tsx — state of a product whose anti-gaspi mode is on,
// on the butcher's Anti-Gaspi page: remaining stock, reason, end time, and « Épuisé » once the
// counter reaches 0 (the quote then refuses it: src/lib/pricing/limited-stock.ts).
import { limitedStockSoldOut, type LimitedStockFields } from "@/lib/pricing/limited-stock";

export const ANTI_GASPI_REASONS = [
  { value: "DLC_PROCHE", label: "DLC proche" },
  { value: "SURPLUS", label: "Surplus" },
  { value: "DERNIER_LOT", label: "Dernier lot" },
  { value: "FIN_JOURNEE", label: "Fin de journée" },
];

interface ActiveAntiGaspiProduct extends LimitedStockFields {
  antiGaspiStock: number | null;
  antiGaspiReason: string | null;
  antiGaspiEndAt: string | null;
}

export function AntiGaspiActiveInfo({ product }: { product: ActiveAntiGaspiProduct }) {
  const reason = product.antiGaspiReason;
  return (
    <>
      {limitedStockSoldOut(product) && (
        <p
          role="status"
          className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300"
        >
          <span className="font-bold">Épuisé</span> : les clients ne peuvent plus le commander.
          Désactivez puis relancez l&apos;offre pour remettre du stock.
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        {product.antiGaspiStock !== null && (
          <span className="rounded-full bg-orange-50 px-2 py-0.5 font-semibold text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
            Stock: {product.antiGaspiStock}
          </span>
        )}
        {reason && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 dark:bg-white/5">
            {ANTI_GASPI_REASONS.find((r) => r.value === reason)?.label || reason}
          </span>
        )}
        {product.antiGaspiEndAt && (
          <span>
            Expire:{" "}
            {new Date(product.antiGaspiEndAt).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
    </>
  );
}
