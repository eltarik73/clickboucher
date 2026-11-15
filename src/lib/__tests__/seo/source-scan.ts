// Source reading for the SEO guard tests (claims-guard.test.ts, structure-guard.test.ts).
//
// Guards judge what the code publishes, not what its comments explain: a comment saying why
// there is no « shippingDetails » or no « 0,99 € » is not a published claim. Comments are removed
// with the TypeScript printer, which keeps strings, template literals, JSX text and regular
// expressions exactly as written (a naive « // » stripper would cut « https://… » and JSX text).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

export const ROOT = path.resolve(__dirname, "../../../..");

const CODE_FILE = /\.(?:ts|tsx|js|jsx|mjs)$/;
const TEST_FILE = /\.(?:test|spec)\.(?:ts|tsx)$/;
const TEST_DIRECTORY = "__tests__";

function toRepoPath(absolute: string): string {
  return path.relative(ROOT, absolute).split(path.sep).join("/");
}

/**
 * Repository-relative paths (« src/app/… ») of the files under `rel` (a directory or one file),
 * test files and __tests__ folders excluded. Throws when `rel` does not exist, so that a moved
 * folder fails the guard instead of silently leaving it.
 */
export function filesUnder(rel: string): string[] {
  const absolute = path.join(ROOT, rel);
  if (!existsSync(absolute)) {
    throw new Error(`Guarded path not found: ${rel}`);
  }
  if (statSync(absolute).isFile()) return [rel];
  return readdirSync(absolute, { withFileTypes: true })
    .flatMap((entry) => {
      if (entry.isDirectory()) {
        return entry.name === TEST_DIRECTORY ? [] : filesUnder(`${rel}/${entry.name}`);
      }
      return TEST_FILE.test(entry.name) ? [] : [toRepoPath(path.join(absolute, entry.name))];
    })
    .sort();
}

/** The code files under `rel`, tests excluded. */
export function codeFilesUnder(rel: string): string[] {
  return filesUnder(rel).filter((file) => CODE_FILE.test(file));
}

function scriptKind(fileName: string): ts.ScriptKind {
  if (fileName.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (fileName.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (fileName.endsWith(".ts")) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

/** Parses source text as the compiler would (TSX for .tsx files). */
export function parseSource(text: string, fileName: string): ts.SourceFile {
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, scriptKind(fileName));
}

const PRINTER = ts.createPrinter({ removeComments: true });

/** The source text without any comment (line, block and JSX comments). */
export function stripComments(text: string, fileName: string): string {
  return PRINTER.printFile(parseSource(text, fileName));
}

export function readRepoFile(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

/** What a file publishes: code without comments, or the whole text of a non-code file. */
export function publishedText(rel: string): string {
  const text = readRepoFile(rel);
  return CODE_FILE.test(rel) ? stripComments(text, rel) : text;
}

/** The parsed code of a repository file. */
export function parseRepoFile(rel: string): ts.SourceFile {
  return parseSource(readRepoFile(rel), rel);
}

function isExported(statement: ts.Statement): boolean {
  return (
    ts.canHaveModifiers(statement) &&
    (ts.getModifiers(statement) ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
    )
  );
}

/** The exported `const` declaration named `name`, or undefined. */
export function exportedConst(
  source: ts.SourceFile,
  name: string
): ts.VariableDeclaration | undefined {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) || !isExported(statement)) continue;
    const declaration = statement.declarationList.declarations.find(
      (candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === name
    );
    if (declaration) return declaration;
  }
  return undefined;
}

/** The text, comments removed, of the exported `const` named `name`. Throws when it is absent. */
export function exportedConstText(rel: string, name: string): string {
  const source = parseRepoFile(rel);
  const declaration = exportedConst(source, name);
  if (declaration === undefined) {
    throw new Error(`${rel} exports no const ${name}`);
  }
  return PRINTER.printNode(ts.EmitHint.Unspecified, declaration, source);
}
