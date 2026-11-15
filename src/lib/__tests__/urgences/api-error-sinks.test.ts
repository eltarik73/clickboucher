// @vitest-environment node
// Guard: an API error body is shown through apiErrorMessage (src/lib/api/error-message.ts), never by
// handing its bare `.error` member to toast, alert or new Error, directly or through a variable
// (`const err = data?.error || "…"`): that member is the apiError object { code, message },
// displayed as « [object Object] » or crashing the root Toaster.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

const BARE_ERROR_SINK = /(toast\.\w+|alert|new Error)\(\s*[\w.?]+\.error\s*(\|\||\)|,)/g;
const BARE_ERROR_ASSIGNMENT = /=\s*[\w.?]+\.error\s*\|\|/g;

// Can only go down. Empty: the last sinks (src/app/(admin)/admin/shops/page.tsx) read the refusal
// through src/lib/api/client-refusal.ts since C1-FAILLES-CRITIQUES.
const SINK_BASELINE: Readonly<Record<string, number>> = {};

// Can only go down. Empty: the last assignment (src/app/webmaster/prospects/page.tsx) was fixed here.
const ASSIGNMENT_BASELINE: Readonly<Record<string, number>> = {};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      return name === "__tests__" ? [] : sourceFiles(full);
    }
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

function relativePath(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function countOf(pattern: RegExp, text: string): number {
  return [...text.matchAll(pattern)].length;
}

function uiFiles(): string[] {
  return sourceFiles(SRC)
    .map(relativePath)
    .filter((file) => !file.startsWith("src/app/api/"));
}

function overBaseline(pattern: RegExp, baseline: Readonly<Record<string, number>>) {
  return uiFiles()
    .map((file) => ({ file, count: countOf(pattern, readFileSync(path.join(ROOT, file), "utf8")) }))
    .filter(({ file, count }) => count > (baseline[file] ?? 0));
}

describe("API error bodies reach the UI through apiErrorMessage", () => {
  it("recognises the bare .error sinks and not the fixed form", () => {
    const sinks = (text: string) => countOf(BARE_ERROR_SINK, text);
    expect(sinks('toast.error(d.error || "Impossible de charger la configuration");')).toBe(1);
    expect(sinks('alert(err?.error || "Erreur");')).toBe(1);
    expect(sinks('throw new Error(json.error || "Erreur");')).toBe(1);
    expect(sinks("toast.error(data.error);")).toBe(1);
    expect(sinks('toast.error(apiErrorMessage(d, "Erreur lors de la sauvegarde"));')).toBe(0);
    expect(sinks('throw new Error(apiErrorMessage(err, "Erreur serveur"));')).toBe(0);
  });

  it("recognises a bare .error put in a variable with a fallback, and not the fixed form", () => {
    const assignments = (text: string) => countOf(BARE_ERROR_ASSIGNMENT, text);
    expect(assignments('const err = data?.error || "Erreur scraping";')).toBe(1);
    expect(assignments('message = json.error || "Erreur";')).toBe(1);
    expect(assignments('const err = apiErrorMessage(data, "Erreur scraping");')).toBe(0);
    expect(assignments("if (authResult.error) return authResult.error;")).toBe(0);
  });

  it("no file outside src/app/api passes a bare .error to toast, alert or new Error", () => {
    expect(uiFiles()).toContain("src/app/webmaster/parametres/page.tsx");

    expect(overBaseline(BARE_ERROR_SINK, SINK_BASELINE)).toEqual([]);
  });

  it("no file outside src/app/api puts a bare .error in a variable with a fallback", () => {
    expect(uiFiles()).toContain("src/app/webmaster/prospects/page.tsx");

    expect(overBaseline(BARE_ERROR_ASSIGNMENT, ASSIGNMENT_BASELINE)).toEqual([]);
  });
});
