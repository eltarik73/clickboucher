// src/lib/services/orders/commands/alternatives.ts — replacement products proposed for the
// out-of-stock lines of an order (to the butcher's kitchen and to the customer), and the pricing of
// the replacement the customer picks.
import type { OrderItem, Prisma, Unit } from "@prisma/client";
import prisma from "@/lib/prisma";
import { checkLineQuantity, lineQuantityFromStored, lineTotalCents } from "@/lib/pricing/line";
import { resolveUnitPrice } from "@/lib/pricing/unit-price";

const MAX_ALTERNATIVES = 3;

export interface Alternative {
  id: string;
  name: string;
  priceCents: number;
  unit: Unit;
}

/**
 * Up to three orderable products of the shop for each given line: same category, and the SAME
 * unit, since a replacement keeps the line's quantity. Keyed by the line's productId.
 */
export async function findAlternatives(
  shopId: string,
  lines: ReadonlyArray<{ productId: string; unit: Unit }>
): Promise<Record<string, Alternative[]>> {
  if (lines.length === 0) return {};
  const lineProducts = await prisma.product.findMany({
    where: { shopId, id: { in: lines.map((line) => line.productId) } },
    select: { id: true, categories: { select: { id: true } } },
  });
  const categoriesOf = new Map(
    lineProducts.map((p) => [p.id, new Set(p.categories.map((c) => c.id))])
  );
  const allCategoryIds = lineProducts.flatMap((p) => p.categories.map((c) => c.id));
  const candidates =
    allCategoryIds.length === 0
      ? []
      : await prisma.product.findMany({
          where: {
            shopId,
            isActive: true,
            inStock: true,
            snoozeType: "NONE",
            unit: { in: [...new Set(lines.map((line) => line.unit))] },
            categories: { some: { id: { in: allCategoryIds } } },
            id: { notIn: lines.map((line) => line.productId) },
          },
          select: {
            id: true,
            name: true,
            priceCents: true,
            unit: true,
            categories: { select: { id: true } },
          },
          orderBy: { priceCents: "asc" },
        });

  const alternatives: Record<string, Alternative[]> = {};
  for (const line of lines) {
    const categories = categoriesOf.get(line.productId) ?? new Set<string>();
    alternatives[line.productId] = candidates
      .filter((p) => p.unit === line.unit && p.categories.some((c) => categories.has(c.id)))
      .slice(0, MAX_ALTERNATIVES)
      .map(({ id, name, priceCents, unit }) => ({ id, name, priceCents, unit }));
  }
  return alternatives;
}

export type LineChange =
  | { id: string; remove: true }
  | { id: string; remove: false; data: Prisma.OrderItemUncheckedUpdateInput; totalCents: number };

export const REPLACEMENT_SELECT = {
  id: true,
  name: true,
  unit: true,
  isActive: true,
  inStock: true,
  snoozeType: true,
  priceCents: true,
  proPriceCents: true,
  promoPct: true,
  promoType: true,
  promoEnd: true,
  promoFixedCents: true,
} satisfies Prisma.ProductSelect;

type ReplacementProduct = Prisma.ProductGetPayload<{ select: typeof REPLACEMENT_SELECT }>;
type DecisionLine = Pick<OrderItem, "id" | "name" | "unit" | "quantity" | "weightGrams">;

/**
 * The new content of an out-of-stock line replaced by `product`: same unit and same quantity, priced
 * by the shared pricing module. A string is the French reason of a refusal.
 */
export function replacementChange(
  line: DecisionLine,
  product: ReplacementProduct | undefined,
  pricing: { isPro: boolean; now: Date }
): LineChange | string {
  if (
    product === undefined ||
    !product.isActive ||
    !product.inStock ||
    product.snoozeType !== "NONE"
  ) {
    return "Ce produit de remplacement n'est pas disponible";
  }
  if (product.unit !== line.unit)
    return "Le produit de remplacement doit être vendu dans la même unité";
  const quantity = lineQuantityFromStored(line);
  if (checkLineQuantity(quantity) !== null)
    return "Cette ligne ne peut pas être remplacée, retirez-la";
  const price = resolveUnitPrice(product, { isPro: pricing.isPro, now: pricing.now });
  if (!price.ok) return "Ce produit de remplacement n'est pas disponible";
  const totalCents = lineTotalCents(quantity, price.unitPriceCents);
  return {
    id: line.id,
    remove: false,
    totalCents,
    data: {
      productId: product.id,
      name: product.name,
      priceCents: price.unitPriceCents,
      totalCents,
      available: true,
      cutOption: null,
      cutPriceCents: null,
      variant: null,
      replacement: `Remplace: ${line.name}`,
    },
  };
}
