// src/lib/validators/order.ts — what the browser may send to quote and to create an order.
//
// The request carries quantities, choices and a promo code, never an amount: prices, cut prices,
// discounts and totals are recomputed by the server from the database. Every object is strict, so
// a field the server does not read (cutPriceCents, discountCents, offerId…) is refused instead of
// being silently ignored. A line has the cart's shape: see src/lib/pricing/line.ts.
import { z } from "zod";

import { MAX_LINE_QUANTITY, MAX_PORTION_GRAMS } from "@/lib/pricing/line";

/** Lines one order may carry. */
export const MAX_ORDER_LINES = 50;

const paymentMethodSchema = z.literal("ON_PICKUP", {
  errorMap: () => ({
    message: "Le paiement en ligne n'est pas encore disponible. Réglez sur place au retrait.",
  }),
});

export const orderLineInputSchema = z
  .object({
    productId: z.string().min(1, "productId requis").max(64),
    quantity: z
      .number()
      .int("La quantité doit être un nombre entier")
      .min(1, "Quantité minimale : 1")
      .max(MAX_LINE_QUANTITY, `Quantité maximale : ${MAX_LINE_QUANTITY}`),
    weightGrams: z
      .number()
      .int("Le poids doit être un nombre entier de grammes")
      .min(1, "Poids invalide")
      .max(MAX_PORTION_GRAMS, "Poids trop élevé")
      .optional(),
    cutOption: z.string().min(1).max(100).optional(),
    variant: z.string().max(50).optional(),
    sliceCount: z.number().int().min(1).max(100).optional(),
    sliceThickness: z.string().max(50).optional(),
    pieceCount: z.number().int().min(1).max(1000).optional(),
    pieceLabel: z.string().max(100).optional(),
    itemNote: z.string().max(300).optional(),
  })
  .strict();

export const orderQuoteRequestSchema = z
  .object({
    shopId: z.string().min(1, "shopId requis").max(64),
    items: z
      .array(orderLineInputSchema)
      .min(1, "Au moins 1 article requis")
      .max(MAX_ORDER_LINES, `${MAX_ORDER_LINES} articles au maximum`),
    paymentMethod: paymentMethodSchema,
    promoCode: z.string().trim().min(1).max(50).optional(),
  })
  .strict();

export const createOrderSchema = orderQuoteRequestSchema
  .extend({
    /** One per checkout attempt, kept across retries: a replay returns the order already created. */
    idempotencyKey: z.string().uuid(),
    /** The « Total à payer » the customer confirmed (OrderQuote.amountDueCents). */
    expectedTotalCents: z.number().int().min(0),
    requestedTime: z.string().max(50).optional(),
    customerNote: z.string().max(500).optional(),
    pickupSlotStart: z.string().datetime().optional(),
    pickupSlotEnd: z.string().datetime().optional(),
  })
  .strict();

export type OrderLineInput = z.infer<typeof orderLineInputSchema>;
export type OrderQuoteRequest = z.infer<typeof orderQuoteRequestSchema>;
export type CreateOrderRequest = z.infer<typeof createOrderSchema>;
