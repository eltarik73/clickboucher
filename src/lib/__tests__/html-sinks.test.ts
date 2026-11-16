// @vitest-environment node
// Guard: HTML written by hand goes through src/lib/html/escape.ts (C1-FAILLES-CRITIQUES, D5).
//
// Until 2026-11-15 the printable order export interpolated a guest's name into its HTML: a first
// name `<img src=x onerror=…>` ran script in the butcher's session (SEC-01). This test reads src/
// with the TypeScript compiler and counts, per file, the substitutions that reach HTML unescaped:
// - in a template literal whose text contains an HTML tag, every `${…}` that is not a direct call
//   escapeHtml(…), unless the template is tagged with the `html` tag of the escape module (which
//   escapes it); a template tagged with anything else escapes nothing and is counted;
// - in a `+` concatenation with a string literal that contains an HTML tag, every operand that is
//   neither a literal nor escapeHtml(…).
// The escaper and the tag count only when imported from "@/lib/html/escape": a local function of
// the same name is not trusted. Not seen: HTML assembled through `+=` or across variables.
//
// New code is at 0: build the document with html`…`. The legacy builders below keep their measured
// count, which can only go down (lower the entry, or remove it at 0, in the same change).
// Also enforced: trustedHtml(…) takes a string literal only, and no file defines its own escaper.
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { sourceFiles } from "../../../tests/lib/source-scan";

const ROOT = path.resolve(__dirname, "../../..");
const ESCAPE_MODULE = "@/lib/html/escape";
const ESCAPE_MODULE_FILE = "src/lib/html/escape.ts";
const HTML_TAG = /<\/?[a-zA-Z][a-zA-Z0-9-]*(?=[\s/>]|$)|<!DOCTYPE/i;
const ESCAPER_NAME = /^(esc|escapeHtml|escapeHTML|escHtml|htmlEscape)$/;

/** Legacy hand-built HTML: measured count of unescaped substitutions, and why it is not yet 0. */
const LEGACY_BASELINE: Readonly<Record<string, { count: number; reason: string }>> = {
  "src/components/boucher/OrderTicket.tsx": {
    count: 21,
    reason: "ticket built with escapeHtml on every typed value; the rest are its own fragments",
  },
  "src/lib/email-templates.ts": {
    count: 44,
    reason:
      "notification e-mails built with escapeHtml on every typed value; the rest are its own " +
      "fragments: the layout slot, 28 buttons, 4 optional blocks, 10 numbers and amounts it " +
      "formats, 1 title chosen between two literals",
  },
  "src/lib/notifications.ts": {
    count: 3,
    reason:
      "inline e-mails built with escapeHtml on every typed value; the rest are 3 optional blocks",
  },
  "src/lib/marketing/send-campaign.ts": {
    count: 11,
    reason: "admin campaign e-mail: body is HTML by design; title, image URL and code inserted raw",
  },
};

/** Paths rebuilt on the escape module by this chantier: never in the baseline, always at 0. */
const ESCAPED_PATHS = ["src/app/api/orders/export/", "src/lib/emails/", "src/lib/html/"];

type Scan = { unescaped: number; violations: string[] };

function importedNames(source: ts.SourceFile, exported: string): Set<string> {
  const names = new Set<string>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (statement.moduleSpecifier.text !== ESCAPE_MODULE) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings === undefined || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      if ((element.propertyName ?? element.name).text === exported) names.add(element.name.text);
    }
  }
  return names;
}

const isLiteralText = (
  node: ts.Node
): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);

const isPlus = (node: ts.Node): node is ts.BinaryExpression =>
  ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken;

/** Unescaped substitutions and rule violations of one source file. */
function scanSource(fileName: string, text: string): Scan {
  const kind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
  const tags = importedNames(source, "html");
  const escapers = importedNames(source, "escapeHtml");
  const trusted = importedNames(source, "trustedHtml");
  const scan: Scan = { unescaped: 0, violations: [] };
  const where = (node: ts.Node) =>
    `${fileName}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`;

  const isEscaped = (node: ts.Expression) =>
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    escapers.has(node.expression.text);
  const isHtmlTagged = (node: ts.Node) =>
    ts.isTaggedTemplateExpression(node) && ts.isIdentifier(node.tag) && tags.has(node.tag.text);
  const unescapedSpans = (template: ts.TemplateExpression) =>
    template.templateSpans.filter((span) => !isEscaped(span.expression)).length;
  const plusOperands = (node: ts.Expression): ts.Expression[] =>
    isPlus(node) ? [...plusOperands(node.left), ...plusOperands(node.right)] : [node];

  function concatenatedUnescaped(operand: ts.Expression): number {
    if (isLiteralText(operand) || ts.isNumericLiteral(operand) || isEscaped(operand)) return 0;
    if (isHtmlTagged(operand)) return 0;
    if (ts.isTemplateExpression(operand)) {
      const texts = [operand.head.text, ...operand.templateSpans.map((span) => span.literal.text)];
      // A template with a tag of its own is counted where it stands.
      return texts.some((piece) => HTML_TAG.test(piece)) ? 0 : unescapedSpans(operand);
    }
    return 1;
  }

  function visit(node: ts.Node): void {
    if (ts.isTemplateExpression(node) && !isHtmlTagged(node.parent)) {
      const texts = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)];
      if (texts.some((piece) => HTML_TAG.test(piece))) scan.unescaped += unescapedSpans(node);
    }
    if (isPlus(node) && !isPlus(node.parent)) {
      const operands = plusOperands(node);
      if (operands.some((operand) => isLiteralText(operand) && HTML_TAG.test(operand.text))) {
        scan.unescaped += operands.reduce(
          (sum, operand) => sum + concatenatedUnescaped(operand),
          0
        );
      }
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const [argument] = node.arguments;
      const literalOnly = node.arguments.length === 1 && isLiteralText(argument);
      if (trusted.has(node.expression.text) && !literalOnly) {
        scan.violations.push(`${where(node)} trustedHtml takes a string literal only`);
      }
    }
    const declared =
      ts.isFunctionDeclaration(node) ||
      (ts.isVariableDeclaration(node) &&
        node.initializer !== undefined &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)));
    if (declared && node.name !== undefined && ts.isIdentifier(node.name)) {
      if (ESCAPER_NAME.test(node.name.text) && fileName !== ESCAPE_MODULE_FILE) {
        scan.violations.push(`${where(node)} defines its own escaper ${node.name.text}`);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return scan;
}

function scanSrc(): Map<string, Scan> {
  const scans = new Map<string, Scan>();
  for (const file of sourceFiles("src")) {
    scans.set(file, scanSource(file, readFileSync(path.join(ROOT, file), "utf8")));
  }
  return scans;
}

describe("the scanner", () => {
  const IMPORTS = 'import { escapeHtml, html, trustedHtml } from "@/lib/html/escape";\n';

  it.each([
    ["an interpolated value", "const page = `<p>${name}</p>`;", 1],
    [
      "the same value through escapeHtml",
      `${IMPORTS}const page = \`<p>\${escapeHtml(name)}</p>\`;`,
      0,
    ],
    ["the same value inside html``", `${IMPORTS}const page = html\`<p>\${name}</p>\`;`, 0],
    [
      "a tag named html not imported from the module",
      "const html = String.raw;\nconst page = html`<p>${name}</p>`;",
      1,
    ],
    ["an escapeHtml not imported from the module", "const page = `<p>${escapeHtml(name)}</p>`;", 1],
    [
      "a literal through trustedHtml",
      `${IMPORTS}const css = trustedHtml("<style>p{}</style>");`,
      0,
    ],
    ["a + concatenation", 'const page = "<p>" + name + "</p>";', 1],
    ["a template without markup", "const label = `${count} pièces`;", 0],
  ])("%s", (_case, source, expected) => {
    expect(scanSource("src/fixture.ts", source)).toEqual({ unescaped: expected, violations: [] });
  });

  it("refuses trustedHtml on anything but a literal, and a private escaper", () => {
    const source = `${IMPORTS}const style = trustedHtml(css);\nfunction esc(s: string) { return s; }`;

    expect(scanSource("src/fixture.ts", source).violations).toEqual([
      "src/fixture.ts:2 trustedHtml takes a string literal only",
      "src/fixture.ts:3 defines its own escaper esc",
    ]);
  });
});

describe("hand-built HTML in src", () => {
  const scans = scanSrc();

  it("breaks no rule: trustedHtml on literals only, no escaper outside the escape module", () => {
    expect([...scans.values()].flatMap((scan) => scan.violations)).toEqual([]);
  });

  it("matches the legacy baseline exactly: no new file, no file above or below its entry", () => {
    const measured = Object.fromEntries(
      [...scans]
        .filter(([, scan]) => scan.unescaped > 0)
        .map(([file, scan]) => [file, scan.unescaped])
    );
    const baseline = Object.fromEntries(
      Object.entries(LEGACY_BASELINE).map(([file, entry]) => [file, entry.count])
    );

    expect(measured).toEqual(baseline);
  });

  it("keeps the documents rebuilt on the escape module at 0, outside the baseline", () => {
    const files = [...scans.keys()].filter((file) =>
      ESCAPED_PATHS.some((dir) => file.startsWith(dir))
    );

    expect(files).toContain("src/app/api/orders/export/print-document.ts");
    expect(files.filter((file) => (scans.get(file)?.unescaped ?? 0) > 0)).toEqual([]);
    expect(Object.keys(LEGACY_BASELINE).filter((file) => files.includes(file))).toEqual([]);
  });
});
