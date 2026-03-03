import { z } from "zod";

export const createOfferSchema = z.object({
  name: z.string().min(3, "Nom requis (3 chars min)").max(100),
  code: z.string().min(3).max(30).transform((v) => v.toUpperCase().trim()),
  type: z.enum(["PERCENT", "AMOUNT", "FREE_DELIVERY", "BOGO", "BUNDLE"]),
  discountValue: z.number().positive("Valeur requise"),
  minOrder: z.number().min(0).default(0),
  payer: z.enum(["KLIKGO", "BUTCHER"]),
  audience: z.enum(["ALL", "NEW", "LOYAL", "VIP"]).default("ALL"),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  maxUses: z.number().int().min(1).optional(),
  shopId: z.string().optional(),
  // Diffusion
  diffBadge: z.boolean().default(true),
  diffBanner: z.boolean().default(false),
  diffPopup: z.boolean().default(false),
  // Banner visuals
  bannerTitle: z.string().max(100).optional(),
  bannerSubtitle: z.string().max(200).optional(),
  bannerColor: z.enum(["red", "black", "green", "orange", "blue"]).default("red"),
  bannerPosition: z.enum(["discover_top", "shop_page", "all_pages"]).default("discover_top"),
  bannerImageUrl: z.string().url().optional(),
  // Popup visuals
  popupTitle: z.string().max(100).optional(),
  popupMessage: z.string().max(500).optional(),
  popupColor: z.enum(["red", "black", "green", "orange", "blue"]).default("red"),
  popupFrequency: z.enum(["once_user", "once_day", "every_visit"]).default("once_user"),
  popupImageUrl: z.string().url().optional(),
}).refine((d) => new Date(d.endDate) > new Date(d.startDate), {
  message: "La date de fin doit être après la date de début",
  path: ["endDate"],
});

export const updateOfferSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "EXPIRED"]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  maxUses: z.number().int().min(1).optional(),
  diffBadge: z.boolean().optional(),
  diffBanner: z.boolean().optional(),
  diffPopup: z.boolean().optional(),
  bannerTitle: z.string().max(100).optional(),
  bannerSubtitle: z.string().max(200).optional(),
  bannerColor: z.enum(["red", "black", "green", "orange", "blue"]).optional(),
  bannerPosition: z.enum(["discover_top", "shop_page", "all_pages"]).optional(),
  bannerImageUrl: z.string().url().nullable().optional(),
  popupTitle: z.string().max(100).optional(),
  popupMessage: z.string().max(500).optional(),
  popupColor: z.enum(["red", "black", "green", "orange", "blue"]).optional(),
  popupFrequency: z.enum(["once_user", "once_day", "every_visit"]).optional(),
  popupImageUrl: z.string().url().nullable().optional(),
});

export const proposeOfferSchema = z.object({
  shopIds: z.array(z.string().min(1)).min(1, "Au moins 1 boucherie"),
});

export const offerProductsSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1, "Au moins 1 produit"),
  shopId: z.string().min(1, "shopId requis"),
});
