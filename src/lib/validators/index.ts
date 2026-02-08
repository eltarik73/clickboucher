// KLIK&GO — Zod Validation Schemas

import { z } from "zod";

// -- Reusable --

export const phoneSchema = z
  .string()
  .regex(/^\+33[0-9]{9}$/, "Numero au format +33XXXXXXXXX");

export const siretSchema = z
  .string()
  .regex(/^[0-9]{14}$/, "SIRET invalide (14 chiffres)");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
});

// -- Auth --

export const sendOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().length(6, "Code OTP a 6 chiffres"),
});

// -- Shop Queries --

export const shopListQuerySchema = z.object({
  city: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
});

// -- Cart / Order --

const cartItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().min(0.1).max(100),
});

export const createOrderSchema = z.object({
  shopId: z.string().cuid(),
  items: z.array(cartItemSchema).min(1, "Au moins 1 article requis"),
  userId: z.string().cuid(),
  requestedTime: z.string().optional(),
  customerNote: z.string().max(500).optional(),
});

// -- Order Status Update (boucher) --

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "ACCEPTED",
    "PREPARING",
    "READY",
    "PICKED_UP",
    "COMPLETED",
    "DENIED",
    "CANCELLED",
    "PARTIALLY_DENIED",
  ]),
  boucherNote: z.string().max(500).optional(),
  denyReason: z.string().max(500).optional(),
});

// -- Favorites --

export const toggleFavoriteSchema = z.object({
  userId: z.string().cuid(),
  shopId: z.string().cuid(),
});

// -- Boucher Service Toggle --

export const updateServiceSchema = z.object({
  prepTimeMin: z.number().int().min(5).max(120).optional(),
  busyMode: z.boolean().optional(),
  busyExtraMin: z.number().int().min(0).max(60).optional(),
  paused: z.boolean().optional(),
  isOpen: z.boolean().optional(),
  autoAccept: z.boolean().optional(),
  maxOrdersHour: z.number().int().min(1).max(100).optional(),
});

// -- Boucher Catalogue Update --

export const updateProductStockSchema = z.object({
  inStock: z.boolean().optional(),
  stockQty: z.number().min(0).optional(),
  priceCents: z.number().int().min(0).optional(),
  proPriceCents: z.number().int().min(0).nullable().optional(),
});

// -- Pro Request --

export const proRequestSchema = z.object({
  userId: z.string().cuid(),
  siret: siretSchema,
  companyName: z.string().min(2).max(200),
  shopId: z.string().cuid(),
});

// -- Payment Webhook (stub) --

export const paymentWebhookSchema = z.object({
  orderId: z.string().cuid(),
  status: z.enum(["COMPLETED", "FAILED"]),
  providerRef: z.string().optional(),
});

// -- Offers Query (stub) --

export const offersQuerySchema = z.object({
  shopId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
});

// -- Cart Reserve (stub) --

export const cartReserveSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().min(1).max(10),
});

// -- Weight Update (stub) --

export const updateWeightSchema = z.object({
  items: z.array(
    z.object({
      orderItemId: z.string().cuid(),
      actualWeightGrams: z.number().int().min(1),
    })
  ).min(1),
});

// -- Weight Validation (stub) --

export const validateWeightSchema = z.object({
  accepted: z.boolean(),
});

// -- Stock Action (stub) --

export const stockActionSchema = z.object({
  orderItemId: z.string().cuid(),
  action: z.enum(["REPLACE", "REMOVE", "CONTACT"]),
  replacementProductId: z.string().cuid().optional(),
  replacementName: z.string().max(200).optional(),
});
