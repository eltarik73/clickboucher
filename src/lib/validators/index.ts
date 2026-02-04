// ═══════════════════════════════════════════════
// CLICKBOUCHER — Zod Validation Schemas
// ═══════════════════════════════════════════════

import { z } from "zod";

// ── Reusable ─────────────────────────────────

export const phoneSchema = z
  .string()
  .regex(/^\+33[0-9]{9}$/, "Numéro au format +33XXXXXXXXX");

export const siretSchema = z
  .string()
  .regex(/^[0-9]{14}$/, "SIRET invalide (14 chiffres)");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
});

// ── Auth ─────────────────────────────────────

export const sendOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().length(6, "Code OTP à 6 chiffres"),
});

// ── Shop Queries ─────────────────────────────

export const shopListQuerySchema = z.object({
  city: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
});

// ── Cart / Order ─────────────────────────────

const cartItemSchema = z.object({
  productId: z.string().cuid().optional(),
  packId: z.string().cuid().optional(),
  quantity: z.number().int().min(1).max(100),
  weightGrams: z.number().int().min(0).optional(),
}).refine(
  (data) => data.productId || data.packId,
  { message: "productId ou packId requis" }
);

export const createOrderSchema = z.object({
  shopId: z.string().cuid(),
  items: z.array(cartItemSchema).min(1, "Au moins 1 article requis"),
  paymentMethod: z.enum(["CB_ONLINE", "CB_SHOP", "CASH", "PRO_ACCOUNT"]),
  guestPhone: phoneSchema.optional(),
  userId: z.string().cuid().optional(),
}).refine(
  (data) => data.userId || data.guestPhone,
  { message: "userId ou guestPhone requis (checkout sans compte possible)" }
);

// ── Order Status Update (boucher) ────────────

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "ACCEPTED",
    "PREPARING",
    "WEIGHING",
    "WEIGHT_REVIEW",
    "STOCK_ISSUE",
    "READY",
    "COLLECTED",
    "CANCELLED",
  ]),
  message: z.string().max(500).optional(),
});

// ── Weight Update (boucher pesée) ────────────

export const updateWeightSchema = z.object({
  items: z.array(
    z.object({
      orderItemId: z.string().cuid(),
      actualWeightGrams: z.number().int().min(1),
    })
  ).min(1),
});

// ── Weight Validation (client) ───────────────

export const validateWeightSchema = z.object({
  accepted: z.boolean(),
});

// ── Stock Action (boucher rupture) ───────────

export const stockActionSchema = z.object({
  orderItemId: z.string().cuid(),
  action: z.enum(["REPLACE", "REMOVE", "CONTACT"]),
  replacementProductId: z.string().cuid().optional(),
  replacementName: z.string().max(200).optional(),
});

// ── Favorites ────────────────────────────────

export const toggleFavoriteSchema = z.object({
  userId: z.string().cuid(),
  shopId: z.string().cuid(),
});

// ── Cart Reservation (dernière minute) ───────

export const cartReserveSchema = z.object({
  offerId: z.string().cuid(),
  quantity: z.number().int().min(1).max(10),
});

// ── Boucher Service Toggle ───────────────────

export const updateServiceSchema = z.object({
  isServiceActive: z.boolean().optional(),
  isSurchargeMode: z.boolean().optional(),
  prepTimeMinutes: z.number().int().min(5).max(120).optional(),
  maxOrdersPer15: z.number().int().min(1).max(50).optional(),
});

// ── Boucher Catalogue Update ─────────────────

export const updateProductStockSchema = z.object({
  isInStock: z.boolean().optional(),
  stockQty: z.number().int().min(0).optional(),
  priceCents: z.number().int().min(0).optional(),
  proPriceCents: z.number().int().min(0).nullable().optional(),
});

// ── Pro Request ──────────────────────────────

export const proRequestSchema = z.object({
  userId: z.string().cuid(),
  siret: siretSchema,
  companyName: z.string().min(2).max(200),
  shopId: z.string().cuid(),
});

// ── Payment Webhook (stub) ───────────────────

export const paymentWebhookSchema = z.object({
  orderId: z.string().cuid(),
  status: z.enum(["COMPLETED", "FAILED"]),
  providerRef: z.string().optional(),
});

// ── Offers Query ─────────────────────────────

export const offersQuerySchema = z.object({
  shopId: z.string().cuid().optional(),
  sponsoredFirst: z.coerce.boolean().default(true),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
});
