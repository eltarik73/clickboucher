// @vitest-environment node
// Guard: an API error body is shown through src/lib/api/client-refusal.ts (refusalMessage,
// refusalMessageOf), never by handing its bare `.error` member to toast, alert or new Error, directly
// or through a variable (`const err = data?.error || "…"`): that member is the apiError object
// { code, message }, displayed as « [object Object] » or crashing the root Toaster.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sourceFiles } from "../../../tests/lib/source-files";

const BARE_ERROR_SINK = /(toast\.\w+|alert|new Error)\(\s*[\w.?]+\.error\s*(\|\||\)|,)/g;
const BARE_ERROR_ASSIGNMENT = /=\s*[\w.?]+\.error\s*\|\|/g;

const UI_FILES = sourceFiles("src").filter((file) => !file.startsWith("src/app/api/"));

function countOf(pattern: RegExp, text: string): number {
  return [...text.matchAll(pattern)].length;
}

function filesMatching(pattern: RegExp): string[] {
  return UI_FILES.filter((file) => countOf(pattern, readFileSync(file, "utf8")) > 0);
}

describe("API error bodies reach the UI through client-refusal", () => {
  it("recognises the bare .error sinks and not the fixed form", () => {
    const sinks = (text: string) => countOf(BARE_ERROR_SINK, text);
    expect(sinks('toast.error(d.error || "Impossible de charger la configuration");')).toBe(1);
    expect(sinks('alert(err?.error || "Erreur");')).toBe(1);
    expect(sinks('throw new Error(json.error || "Erreur");')).toBe(1);
    expect(sinks("toast.error(data.error);")).toBe(1);
    expect(sinks('toast.error(refusalMessageOf(d) ?? "Erreur lors de la sauvegarde");')).toBe(0);
    expect(sinks('toast.error(await refusalMessage(res, "Erreur serveur"));')).toBe(0);
  });

  it("recognises a bare .error put in a variable with a fallback, and not the fixed form", () => {
    const assignments = (text: string) => countOf(BARE_ERROR_ASSIGNMENT, text);
    expect(assignments('const err = data?.error || "Erreur scraping";')).toBe(1);
    expect(assignments('message = json.error || "Erreur";')).toBe(1);
    expect(assignments('const err = refusalMessageOf(data) ?? "Erreur scraping";')).toBe(0);
    expect(assignments("if (authResult.error) return authResult.error;")).toBe(0);
  });

  it("no file outside src/app/api passes a bare .error to toast, alert or new Error", () => {
    expect(UI_FILES).toContain("src/app/webmaster/parametres/page.tsx");

    expect(filesMatching(BARE_ERROR_SINK)).toEqual([]);
  });

  it("no file outside src/app/api puts a bare .error in a variable with a fallback", () => {
    expect(UI_FILES).toContain("src/app/webmaster/prospects/page.tsx");

    expect(filesMatching(BARE_ERROR_ASSIGNMENT)).toEqual([]);
  });
});
