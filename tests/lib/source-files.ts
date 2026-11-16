// tests/lib/source-files.ts — the shipped TypeScript files of a folder, for the static guards of
// tests/lib and src/lib/__tests__. Tests are left out: they quote on purpose what a guard forbids.
import { readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");

/**
 * Repo-relative POSIX paths of the .ts and .tsx files under `dir` (itself relative to the
 * repository root), without __tests__ folders nor *.test / *.spec files.
 */
export function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const file = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(file);
    return /\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name) ? [file] : [];
  });
}
