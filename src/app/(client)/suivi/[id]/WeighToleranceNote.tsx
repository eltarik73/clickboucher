// The weighing tolerance the customer accepted with his order, frozen on it at creation: shown next
// to the total on /suivi/[id] and /commande/[id]. Orders placed before the tolerance existed carry
// none (frozenToleranceOf gives null) and show nothing.
import {
  formatToleranceTerms,
  toleranceCents,
  type FrozenTolerance,
} from "@/lib/pricing/tolerance";
import { formatPrice } from "@/lib/utils";

export interface WeighToleranceNoteProps {
  /** frozenToleranceOf(order): null on orders placed before the tolerance existed. */
  tolerance: FrozenTolerance | null;
}

export default function WeighToleranceNote({ tolerance }: WeighToleranceNoteProps) {
  if (tolerance === null) return null;
  const allowance = formatPrice(toleranceCents(tolerance, tolerance.estimatedTotalCents));
  return (
    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
      {`Marge de pesée acceptée : ${formatToleranceTerms(tolerance)}, soit jusqu'à ${allowance} sur cette commande.`}
    </p>
  );
}
