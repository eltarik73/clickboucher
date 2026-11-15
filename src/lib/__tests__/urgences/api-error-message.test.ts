// @vitest-environment node
// apiErrorMessage turns any error body an API may send into the sentence shown to the user. Handing
// the apiError envelope's `error` object to toast or alert shows « [object Object] » or crashes the
// root Toaster (« Objects are not valid as a React child »).
import { describe, expect, it } from "vitest";
import { apiErrorMessage } from "@/lib/api/error-message";

const FALLBACK = "Erreur lors de la sauvegarde";

describe("apiErrorMessage", () => {
  it("reads the message of the apiError envelope", () => {
    const body = { success: false, error: { code: "FORBIDDEN", message: "Accès refusé" } };
    expect(apiErrorMessage(body, FALLBACK)).toBe("Accès refusé");
  });

  it("reads a legacy string error", () => {
    expect(apiErrorMessage({ error: "Trop de requêtes" }, FALLBACK)).toBe("Trop de requêtes");
  });

  it("reads a top-level message", () => {
    expect(apiErrorMessage({ message: "x" }, FALLBACK)).toBe("x");
  });

  it("prefers the envelope's message over a top-level message", () => {
    const body = { error: { code: "CONFLICT", message: "Déjà traitée" }, message: "autre" };
    expect(apiErrorMessage(body, FALLBACK)).toBe("Déjà traitée");
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a number", 42],
    ["a string body", "Forbidden"],
    ["an empty object", {}],
    ["an error object without message", { error: {} }],
    ["an empty message", { error: { message: "" } }],
    ["a blank message", { error: { message: "   " } }],
    ["a non-string message", { error: { message: 12 } }],
    ["an empty string error", { error: "" }],
    ["a non-string top-level message", { message: { text: "x" } }],
    ["an array", [{ error: "x" }]],
  ])("falls back on %s", (_label, body) => {
    expect(apiErrorMessage(body, FALLBACK)).toBe(FALLBACK);
  });
});
