import { z } from "zod";

export const createCampaignSchema = z.object({
  title: z.string().min(3, "Titre requis").max(200),
  type: z.enum(["NEWSLETTER", "ONBOARDING", "REACTIVATION", "PROMO", "UPDATE", "REMINDER", "REPORT", "EDUCATION"]),
  audience: z.enum(["CLIENTS_ALL", "CLIENTS_NEW", "CLIENTS_LOYAL", "CLIENTS_INACTIVE", "BUTCHERS_ALL", "BUTCHERS_NEW", "BUTCHERS_ACTIVE"]),
  subject: z.string().min(3, "Objet requis").max(200),
  body: z.string().min(10, "Contenu requis"),
  // Visual header
  visualTitle: z.string().max(100).optional(),
  visualSubtitle: z.string().max(200).optional(),
  visualColor: z.enum(["red", "black", "green", "orange", "blue"]).default("red"),
  visualImageUrl: z.string().url().optional(),
  // Linked offer
  offerId: z.string().optional(),
  // Schedule
  scheduledAt: z.string().datetime().optional(),
});

export const updateCampaignSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  type: z.enum(["NEWSLETTER", "ONBOARDING", "REACTIVATION", "PROMO", "UPDATE", "REMINDER", "REPORT", "EDUCATION"]).optional(),
  subject: z.string().min(3).max(200).optional(),
  body: z.string().min(10).optional(),
  visualTitle: z.string().max(100).optional(),
  visualSubtitle: z.string().max(200).optional(),
  visualColor: z.enum(["red", "black", "green", "orange", "blue"]).optional(),
  visualImageUrl: z.string().url().nullable().optional(),
  offerId: z.string().nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "PAUSED"]).optional(),
});
