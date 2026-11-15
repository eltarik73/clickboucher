/**
 * The sentence to show the user for an API error body: the `message` of the apiError envelope
 * (`{ success: false, error: { code, message } }`, src/lib/api/errors.ts), else a string `error`,
 * else a string `message`, else `fallback`. Never an object, never a blank string.
 */
export function apiErrorMessage(body: unknown, fallback: string): string {
  if (typeof body !== "object" || body === null) return fallback;
  const error = "error" in body ? body.error : undefined;
  const envelopeMessage =
    typeof error === "object" && error !== null && "message" in error ? error.message : undefined;
  const topLevelMessage = "message" in body ? body.message : undefined;
  return firstText([envelopeMessage, error, topLevelMessage]) ?? fallback;
}

function firstText(candidates: readonly unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim() !== "") return candidate;
  }
  return null;
}
