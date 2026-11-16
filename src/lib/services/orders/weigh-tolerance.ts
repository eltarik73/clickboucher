// src/lib/services/orders/weigh-tolerance.ts — the weighing tolerance at order creation: which
// choice applies to the order, the columns frozen on it, and the member's saved preference.
//
// The choice is active: a member who never chose (users.weigh_tolerance NULL) and sends no choice
// is refused, never given a default. A member's choice, once sent, is saved for his next orders.
// A guest sends his choice with every order and it is never read from nor written to the users
// row, which may be an account the guest proved nothing about (order-person.ts). The request names
// a choice only: rate and cap come from WEIGH_TOLERANCE_TERMS (src/lib/pricing/tolerance.ts).
import type { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import {
  formatToleranceTerms,
  WEIGH_TOLERANCE_CHOICES,
  WEIGH_TOLERANCE_TERMS,
  type WeighToleranceChoice,
  type WeighToleranceTerms,
} from "@/lib/pricing/tolerance";

export type ToleranceResolution =
  | { ok: true; choice: WeighToleranceChoice; terms: WeighToleranceTerms; saveOnUser: boolean }
  | { ok: false; code: "VALIDATION_ERROR"; message: string; details: Record<string, string[]> };

const WEIGH_TOLERANCE_REQUIRED_MESSAGE = "Choisissez votre marge de pesée avant de commander.";

/** The choices named as the cart shows them: "5 % du total estimé, 10,00 € au plus ou …". */
const CHOICE_REQUIRED_DETAIL = `Choix requis : ${WEIGH_TOLERANCE_CHOICES.map((choice) =>
  formatToleranceTerms(WEIGH_TOLERANCE_TERMS[choice])
).join(" ou ")}`;

function chosen(choice: WeighToleranceChoice, saveOnUser: boolean): ToleranceResolution {
  return { ok: true, choice, terms: WEIGH_TOLERANCE_TERMS[choice], saveOnUser };
}

/**
 * The tolerance of the order about to be created. The request's choice wins; a member (memberId)
 * without one in the request gets his saved preference (read only then); otherwise the order is
 * refused. A guest (memberId null) is never read from nor saved to the users row. saveOnUser: a
 * member whose request carried a choice (saved in the creation transaction).
 */
export async function resolveWeighTolerance(
  request: { weighTolerance?: WeighToleranceChoice },
  memberId: string | null
): Promise<ToleranceResolution> {
  if (request.weighTolerance !== undefined) {
    return chosen(request.weighTolerance, memberId !== null);
  }
  if (memberId !== null) {
    const saved = await prisma.user.findUnique({
      where: { id: memberId },
      select: { weighTolerance: true },
    });
    if (saved?.weighTolerance) return chosen(saved.weighTolerance, false);
  }
  return {
    ok: false,
    code: "VALIDATION_ERROR",
    message: WEIGH_TOLERANCE_REQUIRED_MESSAGE,
    details: { weighTolerance: [CHOICE_REQUIRED_DETAIL] },
  };
}

/** The columns frozen on the order: the terms and the estimated total they apply to. */
export function frozenToleranceColumns(
  terms: WeighToleranceTerms,
  estimatedTotalCents: number
): { weighToleranceRateBps: number; weighToleranceCapCents: number; estimatedTotalCents: number } {
  return {
    weighToleranceRateBps: terms.rateBps,
    weighToleranceCapCents: terms.capCents,
    estimatedTotalCents,
  };
}

/**
 * Saves the member's choice, inside the creation transaction. The row is written (and locked)
 * only when the choice differs from the saved one, a NULL preference included.
 */
export async function saveWeighTolerancePreference(
  tx: Prisma.TransactionClient,
  userId: string,
  choice: WeighToleranceChoice
): Promise<void> {
  await tx.user.updateMany({
    where: { id: userId, OR: [{ weighTolerance: null }, { weighTolerance: { not: choice } }] },
    data: { weighTolerance: choice },
  });
}
