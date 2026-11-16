// src/lib/api/client-refusal.ts — what a screen shows when the API refuses an action.
//
// The API answers a refusal with the envelope of src/lib/api/errors.ts:
// `{ success: false, error: { code, message } }`, `message` already in French for the user.
// Two routes whose refusal a screen shows still answer the older `{ error: "texte" }`: /api/chat
// and /api/admin/scrape-butchers. Anything else (a proxy's HTML error page, an empty or truncated
// body, an error without a sentence) carries no message: the screen shows its fallback.
import { z } from "zod";

const sentence = z.string().regex(/\S/);
const refusalBodySchema = z.object({
  error: z.union([z.object({ message: sentence }), sentence]),
});

const FALLBACK_MESSAGE = "Une erreur est survenue";

/** The French sentence of a refusal body already read as JSON, or null when it carries none. */
export function refusalMessageOf(body: unknown): string | null {
  const parsed = refusalBodySchema.safeParse(body);
  if (!parsed.success) return null;
  const { error } = parsed.data;
  return typeof error === "string" ? error : error.message;
}

/** The body as JSON, or null when it is not JSON: a body we did not write is not an envelope. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The French sentence of a refused response, or `fallback` when its body carries none. */
export async function refusalMessage(res: Response, fallback = FALLBACK_MESSAGE): Promise<string> {
  return refusalMessageOf(parseJson(await res.text())) ?? fallback;
}
