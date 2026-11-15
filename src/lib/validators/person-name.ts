// src/lib/validators/person-name.ts — the first or last name a person types (guest checkout).
// One spelling is kept: spaces trimmed around and collapsed inside, Unicode NFC (an accent typed
// as a combining mark is composed). Then only letters of any script, their combining marks,
// spaces, apostrophes (' and ’) and hyphens are accepted, starting with a letter: no markup, no
// digits, no line break, no invisible or direction-changing character.
import { z } from "zod";

export const PERSON_NAME_MAX_LENGTH = 50;

const PERSON_NAME_PATTERN = /^\p{L}[\p{L}\p{M} '’-]*$/u;
const SPACE_RUNS = / {2,}/g;

function normalizePersonName(raw: string): string {
  return raw.trim().normalize("NFC").replace(SPACE_RUNS, " ");
}

/** Length in characters (code points), not UTF-16 units: a letter outside the BMP counts once. */
function isPersonName(name: string): boolean {
  return [...name].length <= PERSON_NAME_MAX_LENGTH && PERSON_NAME_PATTERN.test(name);
}

/**
 * A name, normalised. Empty or absent -> messages.required; anything else refused -> messages.invalid.
 */
export function personNameSchema(messages: {
  required: string;
  invalid: string;
}): z.ZodType<string, z.ZodTypeDef, unknown> {
  return z
    .string({ required_error: messages.required, invalid_type_error: messages.invalid })
    .transform(normalizePersonName)
    .superRefine((name, ctx) => {
      if (name === "") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: messages.required });
      } else if (!isPersonName(name)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: messages.invalid });
      }
    });
}

export const firstNameSchema = personNameSchema({
  required: "Prénom requis",
  invalid:
    "Le prénom ne peut contenir que des lettres, espaces, apostrophes et tirets (50 caractères maximum)",
});

export const lastNameSchema = personNameSchema({
  required: "Nom requis",
  invalid:
    "Le nom ne peut contenir que des lettres, espaces, apostrophes et tirets (50 caractères maximum)",
});
