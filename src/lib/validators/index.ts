// KLIK&GO — Zod Validation Schemas

import { z } from "zod";

// -- Reusable --

export const phoneSchema = z
  .string()
  .regex(/^(\+33[0-9]{9}|0[1-9][0-9]{8})$/, "Numero invalide (ex: 0612345678 ou +33612345678)");

export const siretSchema = z.string().regex(/^[0-9]{14}$/, "SIRET invalide (14 chiffres)");

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
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug invalide (minuscules, chiffres, tirets)"),
  address: z.string().min(5),
  city: z.string().min(2),
  phone: phoneSchema,
  imageUrl: z.string().url().optional(),
  description: z.string().max(1000).optional(),
  openingHours: z.record(z.object({ open: z.string(), close: z.string() })).optional(),
  ownerId: z.string().min(1, "ownerId (clerkId du boucher) requis"),
  commissionPct: z.number().min(0).max(100).optional(),
});

// Coordinate must be a finite number (rejects NaN, Infinity)
const safeLatitude = z
  .number()
  .min(-90)
  .max(90)
  .refine((v) => isFinite(v), "Latitude invalide");
const safeLongitude = z
  .number()
  .min(-180)
  .max(180)
  .refine((v) => isFinite(v), "Longitude invalide");

export const updateShopSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  address: z.string().min(5).optional(),
  city: z.string().min(2).optional(),
  phone: phoneSchema.optional(),
  email: z.string().email("Email invalide").nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  bannerUrl: z.string().url().nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  welcomeMessage: z.string().max(500).nullable().optional(),
  closedMessage: z.string().max(500).nullable().optional(),
  minOrderCents: z.number().int().min(0).max(100000).optional(),
  openingHours: z.record(z.object({ open: z.string(), close: z.string() })).optional(),
  commissionPct: z.number().min(0).max(100).optional(),
  latitude: safeLatitude.optional(),
  longitude: safeLongitude.optional(),
  deliveryRadius: z.number().min(1).max(100).optional(),
  pickupSlots: z
    .object({
      intervalMin: z.number().int().min(5).max(120),
      maxPerSlot: z.number().int().min(1).max(50),
      slots: z.record(z.object({ start: z.string(), end: z.string() })),
    })
    .optional(),
  acceptOnline: z.boolean().optional(),
  acceptOnPickup: z.boolean().optional(),
  priceAdjustmentThreshold: z.number().int().min(0).max(50).optional(),
  commissionMarkupPercent: z
    .number()
    .int()
    .refine((v) => [0, 30, 50, 80, 100].includes(v), "Markup invalide")
    .optional(),
  priceRoundingEnabled: z.boolean().optional(),
});

export const updateShopStatusSchema = z.object({
  busyMode: z.boolean().optional(),
  paused: z.boolean().optional(),
  status: z.enum(["OPEN", "BUSY", "PAUSED", "AUTO_PAUSED", "CLOSED", "VACATION"]).optional(),
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

// A cut option's price replaces the product price per kilogram for every customer: never 0.
const cutOptionSchema = z.object({
  name: z.string().min(1).max(100),
  priceCents: z.number().int().min(1, "Prix de la découpe requis"),
});

const productImageSchema = z.object({
  url: z.string().min(1),
  alt: z.string().max(200).optional(),
  order: z.number().int().min(0).default(0),
  isPrimary: z.boolean().default(false),
});

const productLabelInputSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().max(20).nullable().optional(),
});

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().url().optional(),
  priceCents: z.number().int().min(0),
  boutiquePriceCents: z.number().int().min(0).nullable().optional(),
  proPriceCents: z.number().int().min(0).nullable().optional(),
  unit: z.enum(["KG", "PIECE", "BARQUETTE", "TRANCHE"]),
  inStock: z.boolean().optional(),
  originRegion: z.string().max(200).nullable().optional(),
  raceDescription: z.string().max(500).nullable().optional(),
  elevageMode: z.string().max(200).nullable().optional(),
  elevageDetail: z.string().max(500).nullable().optional(),
  halalMethod: z.string().max(500).nullable().optional(),
  freshDate: z.string().datetime().nullable().optional(),
  freshDetail: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  stockQty: z.number().min(0).nullable().optional(),
  minWeightG: z.number().int().min(1).optional(),
  weightStepG: z.number().int().min(1).optional(),
  maxWeightG: z.number().int().min(1).optional(),
  displayOrder: z.number().int().min(0).optional(),
  featured: z.boolean().optional(),
  popular: z.boolean().optional(),
  categoryIds: z.array(z.string().cuid()).min(1).max(3),
  shopId: z.string().cuid(),
  tags: z.array(z.string().max(50)).optional(),
  origin: z
    .enum([
      "FRANCE",
      "EU",
      "ESPAGNE",
      "IRLANDE",
      "BELGIQUE",
      "ALLEMAGNE",
      "NOUVELLE_ZELANDE",
      "BRESIL",
      "POLOGNE",
      "ITALIE",
      "UK",
      "AUTRE",
    ])
    .optional(),
  halalOrg: z.string().max(200).nullable().optional(),
  race: z.string().max(200).nullable().optional(),
  freshness: z.enum(["FRAIS", "SURGELE", "SOUS_VIDE"]).optional(),
  customerNote: z.string().max(500).nullable().optional(),
  promoPct: z.number().int().min(1).max(99).nullable().optional(),
  promoEnd: z.string().datetime().nullable().optional(),
  promoType: z.enum(["PERCENTAGE", "FLASH", "BUY_X_GET_Y", "FIXED_AMOUNT"]).nullable().optional(),
  unitLabel: z.string().max(100).nullable().optional(),
  sliceOptions: z
    .object({
      defaultSlices: z.number().int().min(1).max(50),
      minSlices: z.number().int().min(1).max(50),
      maxSlices: z.number().int().min(1).max(50),
      thicknesses: z.array(z.enum(["chiffonnade", "fine", "moyenne", "normale", "epaisse"])),
    })
    .nullable()
    .optional(),
  variants: z.array(z.string().max(50)).max(10).optional(),
  weightPerPiece: z.number().int().min(1).max(5000).nullable().optional(),
  pieceLabel: z.string().max(100).nullable().optional(),
  weightMargin: z.number().int().min(1).max(50).optional(),
  cutOptions: z.array(cutOptionSchema).max(10).nullable().optional(),
  promoFixedCents: z.number().int().min(1).max(100000).nullable().optional(),
  packContent: z.string().max(500).nullable().optional(),
  packWeight: z.string().max(100).nullable().optional(),
  packOldPriceCents: z.number().int().min(0).nullable().optional(),
  images: z.array(productImageSchema).optional(),
  labels: z.array(productLabelInputSchema).optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  priceCents: z.number().int().min(0).optional(),
  boutiquePriceCents: z.number().int().min(0).nullable().optional(),
  proPriceCents: z.number().int().min(0).nullable().optional(),
  unit: z.enum(["KG", "PIECE", "BARQUETTE", "TRANCHE"]).optional(),
  inStock: z.boolean().optional(),
  isActive: z.boolean().optional(),
  originRegion: z.string().max(200).nullable().optional(),
  raceDescription: z.string().max(500).nullable().optional(),
  elevageMode: z.string().max(200).nullable().optional(),
  elevageDetail: z.string().max(500).nullable().optional(),
  halalMethod: z.string().max(500).nullable().optional(),
  freshDate: z.string().datetime().nullable().optional(),
  freshDetail: z.string().max(500).nullable().optional(),
  stockQty: z.number().min(0).nullable().optional(),
  minWeightG: z.number().int().min(1).optional(),
  weightStepG: z.number().int().min(1).optional(),
  maxWeightG: z.number().int().min(1).optional(),
  displayOrder: z.number().int().min(0).optional(),
  featured: z.boolean().optional(),
  popular: z.boolean().optional(),
  categoryIds: z.array(z.string().cuid()).min(1).max(3).optional(),
  tags: z.array(z.string().max(50)).optional(),
  origin: z
    .enum([
      "FRANCE",
      "EU",
      "ESPAGNE",
      "IRLANDE",
      "BELGIQUE",
      "ALLEMAGNE",
      "NOUVELLE_ZELANDE",
      "BRESIL",
      "POLOGNE",
      "ITALIE",
      "UK",
      "AUTRE",
    ])
    .optional(),
  halalOrg: z.string().max(200).nullable().optional(),
  race: z.string().max(200).nullable().optional(),
  freshness: z.enum(["FRAIS", "SURGELE", "SOUS_VIDE"]).optional(),
  customerNote: z.string().max(500).nullable().optional(),
  promoPct: z.number().int().min(1).max(99).nullable().optional(),
  promoEnd: z.string().datetime().nullable().optional(),
  promoType: z.enum(["PERCENTAGE", "FLASH", "BUY_X_GET_Y", "FIXED_AMOUNT"]).nullable().optional(),
  unitLabel: z.string().max(100).nullable().optional(),
  sliceOptions: z
    .object({
      defaultSlices: z.number().int().min(1).max(50),
      minSlices: z.number().int().min(1).max(50),
      maxSlices: z.number().int().min(1).max(50),
      thicknesses: z.array(z.enum(["chiffonnade", "fine", "moyenne", "normale", "epaisse"])),
    })
    .nullable()
    .optional(),
  variants: z.array(z.string().max(50)).max(10).optional(),
  weightPerPiece: z.number().int().min(1).max(5000).nullable().optional(),
  pieceLabel: z.string().max(100).nullable().optional(),
  weightMargin: z.number().int().min(1).max(50).optional(),
  cutOptions: z.array(cutOptionSchema).max(10).nullable().optional(),
  promoFixedCents: z.number().int().min(1).max(100000).nullable().optional(),
  packContent: z.string().max(500).nullable().optional(),
  packWeight: z.string().max(100).nullable().optional(),
  packOldPriceCents: z.number().int().min(0).nullable().optional(),
  images: z.array(productImageSchema).optional(),
  labels: z.array(productLabelInputSchema).optional(),
});

export const toggleStockSchema = z
  .object({
    inStock: z.boolean().optional(),
    stockQty: z.number().min(0).optional(),
  })
  .refine((d) => d.inStock !== undefined || d.stockQty !== undefined, {
    message: "inStock ou stockQty requis",
  });

export const reorderProductsSchema = z.object({
  shopId: z.string().cuid(),
  productIds: z.array(z.string().cuid()).min(1),
});

// -- Anti-Gaspi --

export const enableAntiGaspiSchema = z.object({
  productId: z.string().min(1),
  discountPercent: z.number().min(5).max(80),
  antiGaspiStock: z.number().int().min(1).optional(),
  reason: z.string().max(50).optional(),
  endAt: z.string().datetime().optional(),
});

export const updateAntiGaspiSchema = z.object({
  antiGaspiStock: z.number().int().min(0).optional(),
  discountPercent: z.number().min(5).max(80).optional(),
  reason: z.string().max(50).optional(),
  endAt: z.string().datetime().optional(),
  disable: z.boolean().optional(),
});

// -- Orders (quote and creation: src/lib/validators/order.ts; butcher actions:
//    src/lib/services/orders/commands/action-schema.ts) --

export const orderListQuerySchema = z.object({
  status: z.string().optional(),
  shopId: z.string().cuid().optional(),
});

export const rateOrderSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
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
  status: z.enum(["OPEN", "BUSY", "PAUSED", "AUTO_PAUSED", "CLOSED", "VACATION"]).optional(),
  autoAccept: z.boolean().optional(),
  maxOrdersPerHour: z.number().int().min(1).max(100).optional(),
  priceAdjustmentThreshold: z.number().int().min(0).max(50).optional(),
});

// -- Boucher Catalogue Update --

export const updateProductStockSchema = z.object({
  inStock: z.boolean().optional(),
  stockQty: z.number().min(0).optional(),
  priceCents: z.number().int().min(0).optional(),
  proPriceCents: z.number().int().min(0).nullable().optional(),
});

// -- Pro Access (per-shop) --

export const proAccessRequestSchema = z.object({
  companyName: z.string().min(2).max(200),
  siret: siretSchema,
  sector: z.enum(["RESTAURANT", "TRAITEUR", "COLLECTIVITE", "COMMERCE", "AUTRE"]),
  phone: phoneSchema.optional(),
});

export const proAccessReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  notes: z.string().max(500).optional(),
});

// -- Pro Request (legacy) --

export const proRequestSchema = z.object({
  userId: z.string().cuid(),
  siret: siretSchema,
  companyName: z.string().min(2).max(200),
  shopId: z.string().cuid(),
});

// ══════════════════════════════════════════
// WEBMASTER schemas
// ══════════════════════════════════════════

export const wmShopListQuerySchema = z.object({
  search: z.string().max(100).optional(),
  status: z.enum(["OPEN", "BUSY", "PAUSED", "AUTO_PAUSED", "CLOSED", "VACATION"]).optional(),
  subStatus: z.enum(["TRIAL", "PENDING", "ACTIVE", "SUSPENDED", "CANCELLED", "EXPIRED"]).optional(),
  city: z.string().optional(),
  sortBy: z.enum(["name", "createdAt", "rating", "orders"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const wmAuditLogQuerySchema = z.object({
  actorId: z.string().optional(),
  action: z.string().optional(),
  target: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
});

export const wmToggleFeatureFlagSchema = z.object({
  enabled: z.boolean(),
});

export const wmUpdateShopSchema = z.object({
  visible: z.boolean().optional(),
  featured: z.boolean().optional(),
  commissionPct: z.number().min(0).max(100).optional(),
  commissionEnabled: z.boolean().optional(),
  suspendReason: z.string().max(500).optional(),
});

export const wmSuspendShopSchema = z.object({
  reason: z.string().min(1).max(500),
});

// ══════════════════════════════════════════
// REFERENCE CATALOG schemas
// ══════════════════════════════════════════

export const createGlobalCategorySchema = z.object({
  name: z.string().min(1).max(100),
  emoji: z.string().max(10).optional(),
  order: z.number().int().min(0).default(0),
});

export const createReferenceProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().optional(),
  suggestedPrice: z.number().int().min(0).optional(),
  unit: z.enum(["KG", "PIECE", "BARQUETTE", "TRANCHE"]),
  categoryId: z.string().cuid(),
  origin: z
    .enum([
      "FRANCE",
      "EU",
      "ESPAGNE",
      "IRLANDE",
      "BELGIQUE",
      "ALLEMAGNE",
      "NOUVELLE_ZELANDE",
      "BRESIL",
      "POLOGNE",
      "ITALIE",
      "UK",
      "AUTRE",
    ])
    .optional(),
  pricePerKg: z.number().int().min(0).optional(),
  sliceWeights: z.array(z.number().int().min(1)).optional(),
  tags: z.array(z.string().max(50)).optional(),
  halalOrg: z.string().max(200).nullable().optional(),
  freshness: z.enum(["FRAIS", "SURGELE", "SOUS_VIDE"]).optional(),
  race: z.string().max(200).nullable().optional(),
  customerNote: z.string().max(500).nullable().optional(),
  minWeightG: z.number().int().min(1).optional(),
  weightStepG: z.number().int().min(1).optional(),
  maxWeightG: z.number().int().min(1).optional(),
  sliceOptions: z
    .object({
      defaultSlices: z.number().int().min(1).max(50),
      minSlices: z.number().int().min(1).max(50),
      maxSlices: z.number().int().min(1).max(50),
      thicknesses: z.array(z.enum(["chiffonnade", "fine", "moyenne", "normale", "epaisse"])),
    })
    .nullable()
    .optional(),
  variants: z.array(z.string().max(50)).max(10).optional(),
  weightPerPiece: z.number().int().min(1).max(5000).nullable().optional(),
  pieceLabel: z.string().max(100).nullable().optional(),
  weightMargin: z.number().int().min(1).max(50).optional(),
  images: z.array(productImageSchema).optional(),
  labels: z.array(productLabelInputSchema).optional(),
  isActive: z.boolean().optional(),
});

export const updateReferenceProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  suggestedPrice: z.number().int().min(0).nullable().optional(),
  unit: z.enum(["KG", "PIECE", "BARQUETTE", "TRANCHE"]).optional(),
  categoryId: z.string().cuid().optional(),
  origin: z
    .enum([
      "FRANCE",
      "EU",
      "ESPAGNE",
      "IRLANDE",
      "BELGIQUE",
      "ALLEMAGNE",
      "NOUVELLE_ZELANDE",
      "BRESIL",
      "POLOGNE",
      "ITALIE",
      "UK",
      "AUTRE",
    ])
    .nullable()
    .optional(),
  pricePerKg: z.number().int().min(0).nullable().optional(),
  sliceWeights: z.array(z.number().int().min(1)).nullable().optional(),
  tags: z.array(z.string().max(50)).optional(),
  halalOrg: z.string().max(200).nullable().optional(),
  freshness: z.enum(["FRAIS", "SURGELE", "SOUS_VIDE"]).optional(),
  race: z.string().max(200).nullable().optional(),
  customerNote: z.string().max(500).nullable().optional(),
  minWeightG: z.number().int().min(1).optional(),
  weightStepG: z.number().int().min(1).optional(),
  maxWeightG: z.number().int().min(1).optional(),
  sliceOptions: z
    .object({
      defaultSlices: z.number().int().min(1).max(50),
      minSlices: z.number().int().min(1).max(50),
      maxSlices: z.number().int().min(1).max(50),
      thicknesses: z.array(z.enum(["chiffonnade", "fine", "moyenne", "normale", "epaisse"])),
    })
    .nullable()
    .optional(),
  variants: z.array(z.string().max(50)).max(10).optional(),
  weightPerPiece: z.number().int().min(1).max(5000).nullable().optional(),
  pieceLabel: z.string().max(100).nullable().optional(),
  weightMargin: z.number().int().min(1).max(50).optional(),
  images: z.array(productImageSchema).optional(),
  labels: z.array(productLabelInputSchema).optional(),
  isActive: z.boolean().optional(),
});

export const promoteProductSchema = z.object({
  productId: z.string().min(1),
  categoryId: z.string().cuid(),
});

export const referenceCatalogQuerySchema = z.object({
  categoryId: z.string().cuid().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
});
