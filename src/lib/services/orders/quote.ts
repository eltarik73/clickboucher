// src/lib/services/orders/quote.ts — the server's price of a basket.
// The cart shows this quote and the order is created from it, priced from database rows only by
// src/lib/pricing (unit prices, lines, discounts, totals); this module loads the rows, checks
// availability and assembles the result.
import type { Prisma, Role } from "@prisma/client";

import prisma from "@/lib/prisma";
import {
  LINE_QUANTITY_ISSUE_MESSAGES,
  checkLineQuantity,
  lineTotalCents as computeLineTotal,
  lineUnits,
  type LineQuantity,
  type SaleUnit,
} from "@/lib/pricing/line";
import { limitedStockRemaining } from "@/lib/pricing/limited-stock";
import { PREPARATION_ISSUE_MESSAGES, checkPreparation } from "@/lib/pricing/preparation";
import { CUT_OPTION_ISSUE_MESSAGES, resolveUnitPrice } from "@/lib/pricing/unit-price";
import { computeOrderTotals, serviceFeeCentsFor } from "@/lib/pricing/totals";
import type { OrderLineInput, OrderQuoteRequest } from "@/lib/validators/order";
import { resolveDiscount, type ResolvedDiscount } from "./discount";

export interface OrderCustomer {
  id: string;
  role: Role;
  isGuest: boolean;
  firstName: string;
  email: string;
}

export interface QuotedLine {
  productId: string;
  name: string;
  unit: SaleUnit;
  quantity: number;
  weightGrams: number | null;
  baseUnitPriceCents: number;
  unitPriceCents: number;
  lineTotalCents: number;
  cutOption: string | null;
  cutPriceCents: number | null;
  variant: string | null;
  sliceCount: number | null;
  sliceThickness: string | null;
  pieceCount: number | null;
  pieceLabel: string | null;
  itemNote: string | null;
}

export interface OrderQuote {
  shopId: string;
  paymentMethod: "ON_PICKUP";
  /** Same order as request.items. */
  lines: QuotedLine[];
  subtotalCents: number;
  discount: { code: string; label: string; discountCents: number } | null;
  /** A code was given and refused; the quote is still returned, without discount. */
  discountRejection: { reason: string; message: string } | null;
  serviceFeeCents: number;
  /** subtotal - discount = Order.totalCents. */
  totalCents: number;
  /** totalCents + serviceFeeCents = « Total à payer ». */
  amountDueCents: number;
  minOrderCents: number;
  belowMinimumOrder: boolean;
}

export type QuoteFailure = {
  ok: false;
  code: "VALIDATION_ERROR" | "NOT_FOUND" | "PRODUCTS_MISSING" | "STOCK_INSUFFICIENT";
  message: string;
  details?: Record<string, string[]>;
};

export const orderShopSelect = {
  id: true,
  name: true,
  address: true,
  city: true,
  autoAccept: true,
  acceptTimeoutMin: true,
  busyMode: true,
  busyExtraMin: true,
  prepTimeMin: true,
  maxOrdersPerSlot: true,
  maxOrdersPerHour: true,
  autoBusyThreshold: true,
  minOrderCents: true,
  commissionPct: true,
  commissionEnabled: true,
} satisfies Prisma.ShopSelect;

export type OrderShop = Prisma.ShopGetPayload<{ select: typeof orderShopSelect }>;

const quotedProductSelect = {
  id: true,
  name: true,
  unit: true,
  priceCents: true,
  proPriceCents: true,
  promoPct: true,
  promoType: true,
  promoEnd: true,
  promoFixedCents: true,
  cutOptions: true,
  variants: true,
  weightPerPiece: true,
  pieceLabel: true,
  sliceOptions: true,
  isActive: true,
  inStock: true,
  snoozeType: true,
  isAntiGaspi: true,
  antiGaspiStock: true,
  isFlashSale: true,
  flashSaleStock: true,
} satisfies Prisma.ProductSelect;

type QuotedProduct = Prisma.ProductGetPayload<{ select: typeof quotedProductSelect }>;
type ProductsById = ReadonlyMap<string, QuotedProduct>;

const INVALID_LINES_MESSAGE = "Certains articles du panier sont invalides";

/** What createOrder needs beyond the quote. Never sent to the browser. */
export interface PreparedOrder {
  ok: true;
  quote: OrderQuote;
  shop: OrderShop;
  discount: ResolvedDiscount | null;
}

function priceLines(
  items: readonly OrderLineInput[],
  products: ProductsById,
  isPro: boolean,
  now: Date
): { lines: QuotedLine[] } | QuoteFailure {
  const details: Record<string, string[]> = {};
  const lines: QuotedLine[] = [];
  items.forEach((item, index) => {
    const product = products.get(item.productId) as QuotedProduct;
    const refuse = (field: string, message: string): void => {
      details[`items.${index}.${field}`] = [`${product.name} : ${message}`];
    };
    const weightGrams = item.weightGrams ?? null;
    const quantity: LineQuantity = { unit: product.unit, quantity: item.quantity, weightGrams };
    const issue = checkLineQuantity(quantity);
    if (issue !== null) {
      const field = issue === "QUANTITY_INVALID" ? "quantity" : "weightGrams";
      return refuse(field, LINE_QUANTITY_ISSUE_MESSAGES[issue]);
    }
    const preparation = checkPreparation(product, item);
    if (!preparation.ok)
      return refuse(preparation.field, PREPARATION_ISSUE_MESSAGES[preparation.issue]);
    const price = resolveUnitPrice(product, { isPro, cutOption: item.cutOption ?? null, now });
    if (!price.ok) return refuse("cutOption", CUT_OPTION_ISSUE_MESSAGES[price.error]);
    lines.push({
      productId: product.id,
      name: product.name,
      unit: product.unit,
      quantity: item.quantity,
      weightGrams,
      baseUnitPriceCents: price.baseCents,
      unitPriceCents: price.unitPriceCents,
      lineTotalCents: computeLineTotal(quantity, price.unitPriceCents),
      cutOption: price.cutOption?.name ?? null,
      cutPriceCents: price.cutOption?.priceCents ?? null,
      variant: item.variant ?? null,
      sliceCount: item.sliceCount ?? null,
      sliceThickness: item.sliceThickness ?? null,
      pieceCount: item.pieceCount ?? null,
      pieceLabel: preparation.pieceLabel,
      itemNote: item.itemNote ?? null,
    });
  });
  if (Object.keys(details).length === 0) return { lines };
  return { ok: false, code: "VALIDATION_ERROR", message: INVALID_LINES_MESSAGE, details };
}

/** Products that cannot be sold now: inactive, out of stock, snoozed, or above their limited stock. */
function unavailableProducts(lines: readonly QuotedLine[], products: ProductsById) {
  const unitsByProduct = new Map<string, number>();
  for (const line of lines) {
    unitsByProduct.set(line.productId, (unitsByProduct.get(line.productId) ?? 0) + lineUnits(line));
  }
  return [...unitsByProduct].flatMap(([productId, units]) => {
    const product = products.get(productId) as QuotedProduct;
    const remaining = limitedStockRemaining(product);
    const blocked =
      !product.isActive ||
      !product.inStock ||
      product.snoozeType !== "NONE" ||
      (remaining !== null && units > remaining);
    return blocked ? [product] : [];
  });
}

/** Quote plus the internal data createOrder writes (shop row, discount references). */
export async function prepareOrder(
  request: OrderQuoteRequest,
  customer: OrderCustomer | null,
  now: Date
): Promise<PreparedOrder | QuoteFailure> {
  const productIds = [...new Set(request.items.map((item) => item.productId))];
  const [shop, productRows] = await Promise.all([
    prisma.shop.findUnique({ where: { id: request.shopId }, select: orderShopSelect }),
    prisma.product.findMany({
      where: { id: { in: productIds }, shopId: request.shopId },
      select: quotedProductSelect,
    }),
  ]);
  if (shop === null) return { ok: false, code: "NOT_FOUND", message: "Boucherie introuvable" };

  const products = new Map(productRows.map((product) => [product.id, product]));
  const missingProductIds = productIds.filter((id) => !products.has(id));
  if (missingProductIds.length > 0) {
    return {
      ok: false,
      code: "PRODUCTS_MISSING",
      message: `${missingProductIds.length} produit(s) introuvable(s) — ils ont peut-être été supprimés. Actualisez votre panier.`,
      details: { missingProductIds },
    };
  }

  const priced = priceLines(request.items, products, customer?.role === "CLIENT_PRO", now);
  if ("ok" in priced) return priced;

  const unavailable = unavailableProducts(priced.lines, products);
  if (unavailable.length > 0) {
    return {
      ok: false,
      code: "STOCK_INSUFFICIENT",
      message: `${unavailable.map((product) => product.name).join(", ")} — produit(s) indisponible(s)`,
      details: { unavailableProductIds: unavailable.map((product) => product.id) },
    };
  }

  const lineTotalsCents = priced.lines.map((line) => line.lineTotalCents);
  const baseTotals = computeOrderTotals({
    lineTotalsCents,
    discountCents: 0,
    serviceFeeCents: serviceFeeCentsFor(request.paymentMethod),
  });
  const resolution =
    request.promoCode === undefined
      ? null
      : await resolveDiscount({
          code: request.promoCode,
          shopId: shop.id,
          customer,
          subtotalCents: baseTotals.subtotalCents,
          serviceFeeCents: baseTotals.serviceFeeCents,
          now,
        });
  const discount = resolution?.ok ? resolution.discount : null;
  const totals = computeOrderTotals({
    lineTotalsCents,
    discountCents: discount?.discountCents ?? 0,
    serviceFeeCents: discount?.waivesServiceFee ? 0 : baseTotals.serviceFeeCents,
  });

  return {
    ok: true,
    shop,
    discount,
    quote: {
      shopId: shop.id,
      paymentMethod: request.paymentMethod,
      lines: priced.lines,
      subtotalCents: totals.subtotalCents,
      discount: discount && {
        code: discount.code,
        label: discount.label,
        discountCents: totals.discountCents,
      },
      discountRejection:
        resolution && !resolution.ok
          ? { reason: resolution.reason, message: resolution.message }
          : null,
      serviceFeeCents: totals.serviceFeeCents,
      totalCents: totals.totalCents,
      amountDueCents: totals.amountDueCents,
      minOrderCents: shop.minOrderCents,
      belowMinimumOrder: shop.minOrderCents > 0 && totals.subtotalCents < shop.minOrderCents,
    },
  };
}

/** customer = null for an anonymous visitor (no pro price, promo code refused). */
export async function quoteOrder(
  request: OrderQuoteRequest,
  customer: OrderCustomer | null,
  now: Date
): Promise<{ ok: true; quote: OrderQuote } | QuoteFailure> {
  const prepared = await prepareOrder(request, customer, now);
  return prepared.ok ? { ok: true, quote: prepared.quote } : prepared;
}
