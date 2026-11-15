// tests/lib/source-scan.ts — the source reader of the static guards in tests/lib (stripe-guard,
// image-writers-guard, order-writers-guard). They read the shipped code as text; one reader keeps
// them in agreement, tested once in source-scan.test.ts.
import { readdirSync } from "node:fs";
import path from "node:path";

/** Shipped code under `dir` (.ts, .tsx, .js, .mjs): tests, __tests__ and node_modules are left out. */
export function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "node_modules" || entry.name === "__tests__" ? [] : sourceFiles(full);
    }
    const isSource = /\.(?:ts|tsx|js|mjs)$/.test(entry.name);
    return isSource && !/\.(?:test|spec)\.[a-z]+$/.test(entry.name) ? [full] : [];
  });
}

/** The text without its comments; strings stay (module names are strings). */
export function withoutComments(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (c === "/" && next === "/") {
      const end = text.indexOf("\n", i);
      i = end === -1 ? text.length : end;
    } else if (c === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 2;
    } else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < text.length && text[j] !== c && (c === "`" || text[j] !== "\n")) {
        j += text[j] === "\\" ? 2 : 1;
      }
      out += text.slice(i, j + 1);
      i = j + 1;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

/**
 * Whether `code` (read through withoutComments) imports `specifier` or one of its subpaths:
 * import … from, side-effect import, export … from, dynamic import() or require(). An
 * `import type` counts unless typeImports is false (the module is then not loaded at run time).
 */
export function importsModule(
  code: string,
  specifier: string,
  options: { typeImports: boolean } = { typeImports: true }
): boolean {
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const name = `(['"\`])${escaped}(?:\\/[^'"\`]*)?\\1`;
  const notTypeOnly = options.typeImports ? "" : "(?!type\\b)";
  const forms = [
    `\\bimport\\s+${notTypeOnly}[^'"\`;]*?\\bfrom\\s*${name}`,
    `\\bimport\\s*${name}`,
    `\\bexport\\s+[^'"\`;]*?\\bfrom\\s*${name}`,
    `\\bimport\\s*\\(\\s*${name}\\s*\\)`,
    `\\brequire\\s*\\(\\s*${name}\\s*\\)`,
  ];
  return forms.some((form) => new RegExp(form).test(code));
}
