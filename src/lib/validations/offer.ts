// src/lib/validations/offer.ts — Zod schemas for Offer CRUD
import { z } from "zod";

export const createOfferSchema = z.object({
  name: z.string().min(2, "Nom requis (min 2 car.)").max(100),
  code: z
    .string()
    .min(3, "Code requis (min 3 car.)")
    .max(20)
    .transform((v) => v.toUpperCase().trim()),
  type: z.enum(["PERCENT", "AMOUNT", "FREE_DELIVERY", "BOGO", "BUNDLE"]),
  discountValue: z.number().min(0),
  minOrder: z.number().min(0).default(0),
  payer: z.enum(["KLIKGO", "BUTCHER"]),
  audience: z.enum(["ALL", "NEW", "LOYAL", "VIP"]).default("ALL"),
  startDate: z.string().min(1, "Date début requise"),
  endDate: z.string().min(1, "Date fin requise"),
  maxUses: z.number().int().positive().nullable().optional(),
  shopId: z.string().nullable().optional(),

  // Diffusion
  diffBadge: z.boolean().default(true),
  diffBanner: z.boolean().default(false),
  diffPopup: z.boolean().default(false),

  // Banner visuals
  bannerTitle: z.string().max(100).nullable().optional(),
  bannerSubtitle: z.string().max(200).nullable().optional(),
  bannerColor: z.string().max(20).nullable().optional(),
  bannerPosition: z.string().max(30).nullable().optional(),
  bannerImageUrl: z.string().max(2000).nullable().optional(),

  // Popup visuals
  popupTitle: z.string().max(100).nullable().optional(),
  popupMessage: z.string().max(500).nullable().optional(),
  popupColor: z.string().max(20).nullable().optional(),
  popupFrequency: z.string().max(20).nullable().optional(),
  popupImageUrl: z.string().max(2000).nullable().optional(),
});

export const updateOfferSchema = createOfferSchema.partial().extend({
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "EXPIRED"]).optional(),
});

export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type UpdateOfferInput = z.infer<typeof updateOfferSchema>;
