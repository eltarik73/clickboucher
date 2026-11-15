// src/app/api/boucher/shop/status/action-schema.ts — what the butcher may ask of their shop's status
// (PATCH /api/boucher/shop/status). Each action is strict: a key outside it (commissionPct,
// visible…) answers 400 and nothing is written. Publication is not an action: only the admin
// lists, unlists, suspends or reactivates a shop (src/lib/services/shops/moderation.ts).
import { z } from "zod";
import { FIELD_NOT_EDITABLE_HERE } from "@/lib/validators";

export const shopStatusActionSchema = z
  .discriminatedUnion("action", [
    z
      .object({
        action: z.literal("pause"),
        reason: z.string().trim().max(200).optional(),
        durationMin: z.number().int().min(1).max(1440).optional(),
      })
      .strict(FIELD_NOT_EDITABLE_HERE),
    z.object({ action: z.literal("resume") }).strict(FIELD_NOT_EDITABLE_HERE),
    z
      .object({
        action: z.literal("busy"),
        extraMin: z.number().int().min(5).max(60),
        durationMin: z.number().int().min(15).max(480),
      })
      .strict(FIELD_NOT_EDITABLE_HERE),
    z.object({ action: z.literal("end_busy") }).strict(FIELD_NOT_EDITABLE_HERE),
    z
      .object({
        action: z.literal("vacation"),
        start: z.string().datetime(),
        end: z.string().datetime(),
        message: z.string().trim().max(200).optional(),
      })
      .strict(FIELD_NOT_EDITABLE_HERE),
    z.object({ action: z.literal("end_vacation") }).strict(FIELD_NOT_EDITABLE_HERE),
    z.object({ action: z.literal("close") }).strict(FIELD_NOT_EDITABLE_HERE),
    z
      .object({
        action: z.literal("update_settings"),
        prepTimeMin: z.number().int().min(5).max(120).optional(),
        autoAccept: z.boolean().optional(),
        acceptTimeoutMin: z.number().int().min(3).max(60).optional(),
        maxOrdersPerSlot: z.number().int().min(1).max(100).optional(),
        maxOrdersPerHour: z.number().int().min(1).max(500).optional(),
        autoBusyThreshold: z.number().int().min(3).max(100).optional(),
        soundNotif: z.boolean().optional(),
        flashNotif: z.boolean().optional(),
        vibrateNotif: z.boolean().optional(),
      })
      .strict(FIELD_NOT_EDITABLE_HERE),
  ])
  .superRefine((action, ctx) => {
    if (action.action === "vacation" && Date.parse(action.end) <= Date.parse(action.start)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end"],
        message: "La fin des congés doit être après leur début",
      });
    }
  });
