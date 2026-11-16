// The weighing tolerance the customer accepted with his order, frozen on it: shown under the total
// on /suivi/[id] and /commande/[id]. An order without a frozen tolerance shows nothing.
import {
  formatToleranceTerms,
  frozenAllowanceCents,
  frozenToleranceOf,
  type FrozenToleranceColumns,
} from "@/lib/pricing/tolerance";
import { formatPrice } from "@/lib/utils";

export default function WeighToleranceNote({ order }: { order: FrozenToleranceColumns }) {
  const tolerance = frozenToleranceOf(order);
  if (tolerance === null) return null;
  const allowance = formatPrice(frozenAllowanceCents(tolerance));
  return (
    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
      {`Marge de pesée acceptée : ${formatToleranceTerms(tolerance)}, soit jusqu'à ${allowance} sur cette commande.`}
    </p>
  );
}
