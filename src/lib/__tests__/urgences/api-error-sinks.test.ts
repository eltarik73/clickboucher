// @vitest-environment node
// Guard: an API error body is shown through apiErrorMessage (src/lib/api/error-message.ts), never by
// handing its bare `.error` member to toast, alert or new Error: that member is the apiError object
// { code, message }, displayed as « [object Object] » or crashing the root Toaster.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

const BARE_ERROR_SINK = /(toast\.\w+|alert|new Error)\(\s*[\w.?]+\.error\s*(\|\||\)|,)/g;

// Can only go down. src/app/(admin)/admin/shops/page.tsx belongs to lane B
// (C1-FAILLES-CRITIQUES), which switches its 3 calls to apiErrorMessage and removes this entry.
const BASELINE: Readonly<Record<string, number>> = {
  "src/app/(admin)/admin/shops/page.tsx": 3,
};

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

function sinkCount(text: string): number {
  return [...text.matchAll(BARE_ERROR_SINK)].length;
}

describe("API error bodies reach the UI through apiErrorMessage", () => {
  it("recognises the bare .error sinks and not the fixed form", () => {
    expect(sinkCount('toast.error(d.error || "Impossible de charger la configuration");')).toBe(1);
    expect(sinkCount('alert(err?.error || "Erreur");')).toBe(1);
    expect(sinkCount('throw new Error(json.error || "Erreur");')).toBe(1);
    expect(sinkCount("toast.error(data.error);")).toBe(1);
    expect(sinkCount('toast.error(apiErrorMessage(d, "Erreur lors de la sauvegarde"));')).toBe(0);
    expect(sinkCount('throw new Error(apiErrorMessage(err, "Erreur serveur"));')).toBe(0);
  });

  it("no file outside src/app/api passes a bare .error to toast, alert or new Error", () => {
    const files = sourceFiles(SRC)
      .map(relativePath)
      .filter((file) => !file.startsWith("src/app/api/"));
    expect(files).toContain("src/app/webmaster/parametres/page.tsx");

    const overBaseline = files
      .map((file) => ({ file, count: sinkCount(readFileSync(path.join(ROOT, file), "utf8")) }))
      .filter(({ file, count }) => count > (BASELINE[file] ?? 0));

    expect(overBaseline).toEqual([]);
  });
});
