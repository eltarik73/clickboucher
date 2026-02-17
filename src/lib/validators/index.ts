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
  open: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
});

// -- Shop Create/Update --

export const createShopSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, "Slug invalide (minuscules, chiffres, tirets)"),
  address: z.string().min(5),
  city: z.string().min(2),
  phone: phoneSchema,
  imageUrl: z.string().url().optional(),
  description: z.string().max(1000).optional(),
  openingHours: z.record(z.object({ open: z.string(), close: z.string() })).optional(),
  ownerId: z.string().min(1, "ownerId (clerkId du boucher) requis"),
  commissionPct: z.number().min(0).max(100).optional(),
});

export const updateShopSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  address: z.string().min(5).optional(),
  city: z.string().min(2).optional(),
  phone: phoneSchema.optional(),
  imageUrl: z.string().url().nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  openingHours: z.record(z.object({ open: z.string(), close: z.string() })).optional(),
  commissionPct: z.number().min(0).max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  deliveryRadius: z.number().min(1).max(100).optional(),
  pickupSlots: z.object({
    intervalMin: z.number().int().min(5).max(120),
    maxPerSlot: z.number().int().min(1).max(50),
    slots: z.record(z.object({ start: z.string(), end: z.string() })),
  }).optional(),
  acceptOnline: z.boolean().optional(),
  acceptOnPickup: z.boolean().optional(),
});

export const updateShopStatusSchema = z.object({
  busyMode: z.boolean().optional(),
  paused: z.boolean().optional(),
  status: z.enum(["OPEN","BUSY","PAUSED","AUTO_PAUSED","CLOSED","VACATION"]).optional(),
  prepTimeMin: z.number().int().min(5).max(120).optional(),
});

// -- Product Queries --

export const productListQuerySchema = z.object({
  shopId: z.string().cuid("shopId requis"),
  categoryId: z.string().cuid().optional(),
  inStock: z.enum(["true", "false"]).optional(),
  featured: z.enum(["true", "false"]).optional(),
  search: z.string().max(100).optional(),
  tag: z.string().optional(),
});

const productImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().max(200).optional(),
  order: z.number().int().min(0).default(0),
  isPrimary: z.boolean().default(false),
});

const productLabelInputSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().max(20).optional(),
});

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().url().optional(),
  priceCents: z.number().int().min(0),
  proPriceCents: z.number().int().min(0).nullable().optional(),
  unit: z.enum(["KG", "PIECE", "BARQUETTE"]),
  inStock: z.boolean().optional(),
  stockQty: z.number().min(0).nullable().optional(),
  minWeightG: z.number().int().min(1).optional(),
  weightStepG: z.number().int().min(1).optional(),
  maxWeightG: z.number().int().min(1).optional(),
  displayOrder: z.number().int().min(0).optional(),
  featured: z.boolean().optional(),
  popular: z.boolean().optional(),
  categoryId: z.string().cuid(),
  shopId: z.string().cuid(),
  tags: z.array(z.string().max(50)).optional(),
  origin: z.enum(["FRANCE","EU","ESPAGNE","IRLANDE","BELGIQUE","ALLEMAGNE","NOUVELLE_ZELANDE","BRESIL","POLOGNE","ITALIE","UK","AUTRE"]).optional(),
  halalOrg: z.string().max(200).nullable().optional(),
  race: z.string().max(200).nullable().optional(),
  freshness: z.enum(["FRAIS","SURGELE","SOUS_VIDE"]).optional(),
  customerNote: z.string().max(500).nullable().optional(),
  promoPct: z.number().int().min(1).max(99).nullable().optional(),
  promoEnd: z.string().datetime().nullable().optional(),
  promoType: z.enum(["PERCENTAGE","FLASH","BUY_X_GET_Y"]).nullable().optional(),
  images: z.array(productImageSchema).optional(),
  labels: z.array(productLabelInputSchema).optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  priceCents: z.number().int().min(0).optional(),
  proPriceCents: z.number().int().min(0).nullable().optional(),
  unit: z.enum(["KG", "PIECE", "BARQUETTE"]).optional(),
  inStock: z.boolean().optional(),
  stockQty: z.number().min(0).nullable().optional(),
  minWeightG: z.number().int().min(1).optional(),
  weightStepG: z.number().int().min(1).optional(),
  maxWeightG: z.number().int().min(1).optional(),
  displayOrder: z.number().int().min(0).optional(),
  featured: z.boolean().optional(),
  popular: z.boolean().optional(),
  categoryId: z.string().cuid().optional(),
  tags: z.array(z.string().max(50)).optional(),
  origin: z.enum(["FRANCE","EU","ESPAGNE","IRLANDE","BELGIQUE","ALLEMAGNE","NOUVELLE_ZELANDE","BRESIL","POLOGNE","ITALIE","UK","AUTRE"]).optional(),
  halalOrg: z.string().max(200).nullable().optional(),
  race: z.string().max(200).nullable().optional(),
  freshness: z.enum(["FRAIS","SURGELE","SOUS_VIDE"]).optional(),
  customerNote: z.string().max(500).nullable().optional(),
  promoPct: z.number().int().min(1).max(99).nullable().optional(),
  promoEnd: z.string().datetime().nullable().optional(),
  promoType: z.enum(["PERCENTAGE","FLASH","BUY_X_GET_Y"]).nullable().optional(),
  images: z.array(productImageSchema).optional(),
  labels: z.array(productLabelInputSchema).optional(),
});

export const toggleStockSchema = z.object({
  inStock: z.boolean().optional(),
  stockQty: z.number().min(0).optional(),
}).refine((d) => d.inStock !== undefined || d.stockQty !== undefined, {
  message: "inStock ou stockQty requis",
});

export const reorderProductsSchema = z.object({
  shopId: z.string().cuid(),
  productIds: z.array(z.string().cuid()).min(1),
});

// -- Cart / Order --

const cartItemSchema = z.object({
  productId: z.string().min(1, "productId requis"),
  quantity: z.number().min(0.01).max(100),
  weightGrams: z.number().int().min(1).optional(),
  itemNote: z.string().max(300).optional(),
});

export const createOrderSchema = z.object({
  shopId: z.string().min(1, "shopId requis"),
  items: z.array(cartItemSchema).min(1, "Au moins 1 article requis"),
  requestedTime: z.string().optional(),
  customerNote: z.string().max(500).optional(),
  pickupSlotStart: z.string().datetime().optional(),
  pickupSlotEnd: z.string().datetime().optional(),
  idempotencyKey: z.string().max(100).optional(),
  paymentMethod: z.enum(["ONLINE", "ON_PICKUP"]).optional(),
});

// -- Boucher unified action --

export const boucherActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept"), estimatedMinutes: z.number().int().min(1).max(480) }),
  z.object({ action: z.literal("deny"), reason: z.string().min(1).max(500) }),
  z.object({ action: z.literal("start_preparing"), addMinutes: z.number().int().min(0).max(120).optional() }),
  z.object({ action: z.literal("add_time"), addMinutes: z.number().int().min(1).max(120) }),
  z.object({ action: z.literal("mark_ready") }),
  z.object({ action: z.literal("item_unavailable"), itemIds: z.array(z.string().min(1)).min(1) }),
  z.object({ action: z.literal("adjust_weight"), items: z.array(z.object({ orderItemId: z.string().min(1), actualWeightGrams: z.number().int().min(1) })).min(1) }),
  z.object({ action: z.literal("adjust_price"), items: z.array(z.object({ orderItemId: z.string().min(1), newPriceCents: z.number().int().min(0) })).min(1) }),
  z.object({ action: z.literal("confirm_pickup"), qrCode: z.string().uuid() }),
  z.object({ action: z.literal("cancel"), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("add_note"), note: z.string().min(1).max(500) }),
]);

// -- Client respond to modifications --

export const respondModificationSchema = z.object({
  action: z.enum(["accept_changes", "cancel_order"]),
});

export const orderListQuerySchema = z.object({
  status: z.string().optional(),
  shopId: z.string().cuid().optional(),
});

export const acceptOrderSchema = z.object({
  estimatedMinutes: z.number().int().min(1).max(480),
});

export const denyOrderSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const pickupOrderSchema = z.object({
  qrCode: z.string().uuid(),
});

export const rateOrderSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
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
  status: z.enum(["OPEN","BUSY","PAUSED","AUTO_PAUSED","CLOSED","VACATION"]).optional(),
  autoAccept: z.boolean().optional(),
  maxOrdersPerHour: z.number().int().min(1).max(100).optional(),
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
