// src/lib/validations/campaign.ts — Zod schemas for Campaign CRUD
import { z } from "zod";

export const createCampaignSchema = z.object({
  title: z.string().min(2, "Titre requis").max(200),
  type: z.enum([
    "NEWSLETTER",
    "ONBOARDING",
    "REACTIVATION",
    "PROMO",
    "UPDATE",
    "REMINDER",
    "REPORT",
    "EDUCATION",
  ]),
  audience: z.enum([
    "CLIENTS_ALL",
    "CLIENTS_NEW",
    "CLIENTS_LOYAL",
    "CLIENTS_INACTIVE",
    "BUTCHERS_ALL",
    "BUTCHERS_NEW",
    "BUTCHERS_ACTIVE",
  ]),
  subject: z.string().min(2, "Objet requis").max(200),
  body: z.string().min(10, "Contenu requis (min 10 car.)"),

  // Visual header
  visualTitle: z.string().max(100).nullable().optional(),
  visualSubtitle: z.string().max(200).nullable().optional(),
  visualColor: z.string().max(20).nullable().optional(),
  visualImageUrl: z.string().max(2000).nullable().optional(),

  // Attached offer
  offerId: z.string().nullable().optional(),

  // Scheduling
  status: z.enum(["DRAFT", "SCHEDULED"]).default("DRAFT"),
  scheduledAt: z.string().nullable().optional(),
});

export const updateCampaignSchema = createCampaignSchema.partial().extend({
  status: z
    .enum(["DRAFT", "SCHEDULED", "SENDING", "SENT", "PAUSED"])
    .optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
