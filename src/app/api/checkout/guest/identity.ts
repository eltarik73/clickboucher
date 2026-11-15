// src/app/api/checkout/guest/identity.ts — the identity a guest types at checkout, and the address
// the request comes from. Pure: no database, no network.
//
// The e-mail and the phone are reduced to one spelling each, because the cap on orders awaiting
// the shop (guest-auth.ts) compares them: « Amina@X.fr » and « amina@x.fr », or « 06 12 34 56 78 »
// and « +33612345678 », are the same person.
import { z } from "zod";

import type { GuestIdentity } from "@/lib/auth/guest-auth";
import { firstNameSchema, lastNameSchema } from "@/lib/validators/person-name";

const PHONE_MESSAGE = "Téléphone invalide (ex. 06 12 34 56 78)";
/** Longest phone a person types, separators included; longer input is refused before parsing. */
const MAX_TYPED_PHONE_LENGTH = 40;
const PHONE_SEPARATORS = /[\s.\-()]/g;
const FRENCH_NATIONAL = /^0\d{9}$/;
const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * The phone in E.164 form (« +33612345678 »), or null when the text is not a phone number.
 * Spaces, dots, dashes and parentheses are dropped; a leading 00 becomes +; a French national
 * number 0XXXXXXXXX becomes +33XXXXXXXXX. An empty text is not a number either: the caller
 * treats an empty field as « no phone » before calling this.
 */
export function normalizeGuestPhone(raw: string): string | null {
  const compact = raw.replace(PHONE_SEPARATORS, "");
  const international = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  const e164 = FRENCH_NATIONAL.test(international) ? `+33${international.slice(1)}` : international;
  return E164.test(e164) ? e164 : null;
}

const guestPhoneSchema = z
  .string()
  .max(MAX_TYPED_PHONE_LENGTH, PHONE_MESSAGE)
  .optional()
  .transform((raw, ctx): string | null => {
    if (raw === undefined || raw.trim() === "") return null;
    const phone = normalizeGuestPhone(raw);
    if (phone === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: PHONE_MESSAGE });
      return z.NEVER;
    }
    return phone;
  });

/** The identity fields of POST /api/checkout/guest: e-mail trimmed and lowercased, phone in E.164. */
export const guestIdentitySchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide").max(200),
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  phone: guestPhoneSchema,
}) satisfies z.ZodType<GuestIdentity, z.ZodTypeDef, unknown>;

/**
 * The client's address as the hosting platform reports it: x-real-ip, else the first entry of
 * x-forwarded-for, else 'unknown'. On Vercel both headers are written by the platform.
 */
export function clientIp(req: { headers: Headers }): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}
