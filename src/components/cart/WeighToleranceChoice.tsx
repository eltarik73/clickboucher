// The customer's weighing tolerance, chosen above the order button (/panier) and in the profile.
// Two native radios, none checked until the customer picks one (no pre-ticked box, Code de la
// consommation L121-17). The terms and amounts come from src/lib/pricing/tolerance.ts, the only
// authority on them.
"use client";

import { useId, type ReactNode } from "react";
import { Scale } from "lucide-react";
import {
  WEIGH_TOLERANCE_CHOICES,
  WEIGH_TOLERANCE_TERMS,
  formatToleranceTerms,
  toleranceCents,
  type WeighToleranceChoice as Choice,
} from "@/lib/pricing/tolerance";
import { formatPrice } from "@/lib/utils";

const EXPLANATION =
  "Pour gagner du temps, votre boucher ajuste le prix après la pesée sans vous déranger, dans la limite choisie.";
const BEYOND = "Au-delà, il vous demande votre accord ; une baisse de prix s'applique toujours.";

interface WeighToleranceChoiceProps {
  /** The choice shown as checked; null = nothing checked. */
  value: Choice | null;
  /** The customer's saved choice, marked « Votre choix enregistré ». */
  saved: Choice | null;
  /** Goods total of this order (quote.totalCents); null when unknown, then no amount is shown. */
  estimatedTotalCents: number | null;
  onChange: (choice: Choice) => void;
  disabled?: boolean;
  /** Cart: a polite live region under the options asks for a choice while none is checked. */
  requireChoice?: boolean;
  /** Rendered at the bottom of the card (the profile's save button). */
  children?: ReactNode;
}

export function WeighToleranceChoice({
  value,
  saved,
  estimatedTotalCents,
  onChange,
  disabled = false,
  requireChoice = false,
  children,
}: WeighToleranceChoiceProps) {
  const id = useId();
  const explanationId = `${id}-explanation`;

  return (
    <div className="rounded-2xl border border-[#ece8e3] bg-white p-4 dark:border-white/10 dark:bg-[#141414]">
      <fieldset aria-describedby={explanationId} disabled={disabled} className="min-w-0">
        <legend className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          <Scale size={16} className="text-[#DC2626]" aria-hidden="true" />
          Marge de pesée
        </legend>
        <p id={explanationId} className="mb-3 text-xs text-gray-600 dark:text-gray-400">
          {EXPLANATION} {BEYOND}
        </p>
        <div className="space-y-2">
          {WEIGH_TOLERANCE_CHOICES.map((choice) => {
            const terms = WEIGH_TOLERANCE_TERMS[choice];
            return (
              <label
                key={choice}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#ece8e3] p-3 transition-colors hover:bg-gray-50 has-[:disabled]:cursor-not-allowed has-[:checked]:border-[#DC2626] has-[:checked]:bg-[#DC2626]/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring dark:border-white/10 dark:hover:bg-white/5 dark:has-[:checked]:border-[#DC2626] dark:has-[:checked]:bg-[#DC2626]/10"
              >
                <input
                  type="radio"
                  name={`${id}-weigh-tolerance`}
                  value={choice}
                  checked={value === choice}
                  onChange={() => onChange(choice)}
                  className="h-5 w-5 shrink-0 accent-[#DC2626]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-900 dark:text-white">
                    {formatToleranceTerms(terms)}
                  </span>{" "}
                  {estimatedTotalCents !== null && (
                    <span className="block text-xs text-gray-600 dark:text-gray-400">
                      {`soit jusqu'à ${formatPrice(toleranceCents(terms, estimatedTotalCents))} sur cette commande`}
                    </span>
                  )}{" "}
                  {saved === choice && (
                    <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Votre choix enregistré
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {requireChoice && (
        <p
          aria-live="polite"
          className="text-xs font-medium text-red-700 dark:text-red-400 [&:not(:empty)]:mt-2"
        >
          {value === null ? "Choisissez votre marge de pesée pour commander" : ""}
        </p>
      )}
      {children}
    </div>
  );
}
