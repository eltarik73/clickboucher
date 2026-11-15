// src/lib/api/client-refusal.ts — what a screen shows when the API refuses an action.
//
// The API answers a refusal with the envelope of src/lib/api/errors.ts:
// `{ success: false, error: { code, message } }`, `message` already in French for the user.
// Anything else (a proxy's HTML error page, an empty or truncated body) gets a generic message.
import { z } from "zod";

const errorEnvelopeSchema = z.object({ error: z.object({ message: z.string().min(1) }) });

const FALLBACK_MESSAGE = "Une erreur est survenue";

/** The body as JSON, or null when it is not JSON: a body we did not write is not an envelope. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The French message of a refused action, read from the API's error envelope. */
export async function refusalMessage(res: Response): Promise<string> {
  const envelope = errorEnvelopeSchema.safeParse(parseJson(await res.text()));
  return envelope.success ? envelope.data.error.message : FALLBACK_MESSAGE;
}
