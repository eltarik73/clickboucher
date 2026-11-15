// @vitest-environment node
// Guard: structural rules of the SEO markup, read from the sources (C1-SEO, 2026-11-15).
//
// - A shop entity (Store / LocalBusiness / FoodEstablishment) and its rating exist only on the
//   shop page, built by src/lib/seo/jsonld/shop.ts from verified reviews (D1, D2): until this
//   chantier the city, department and Sunday pages published every shop with its seeded rating.
// - A Product and its offer exist only in src/lib/seo/jsonld/product.ts (D4); no Event at all (D16).
// - No Speakable, no hidden « En bref » summary, no WebSite SearchAction, no invented shipping,
//   return policy, offer end date or recipe nutrition (FIX-07, FIX-10, CRIT-11), and no hidden
//   text on the home page: its visible hero heading is its h1.
// - The seven routes whose list is closed answer 404 for any other slug (dynamicParams = false).
// - Only three places call notifyIndexNow, none of them with a shop URL, and only
//   src/lib/indexnow.ts talks to IndexNow (D7).
// Comments are ignored (source-scan.ts): a comment explaining why a field is absent is fine.
import { existsSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  ROOT,
  codeFilesUnder,
  exportedConst,
  parseRepoFile,
  publishedText,
  stripComments,
} from "./source-scan";

const SOURCE_FILES = codeFilesUnder("src");

const SHOP_PAGE = "src/app/(client)/boutique/[slug]/page.tsx";
const SHOP_JSONLD = "src/lib/seo/jsonld/shop.ts";
const PRODUCT_JSONLD = "src/lib/seo/jsonld/product.ts";

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function propertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return null;
}

function literalStrings(expression: ts.Expression): string[] {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return [expression.text];
  }
  if (ts.isArrayLiteralExpression(expression)) {
    return expression.elements.flatMap((element) => literalStrings(element));
  }
  return [];
}

/** Every literal JSON-LD @type and every property key written in the file. */
function markupOf(file: string): { types: Set<string>; keys: Set<string> } {
  const types = new Set<string>();
  const keys = new Set<string>();
  walk(parseRepoFile(file), (node) => {
    if (!ts.isPropertyAssignment(node)) return;
    const name = propertyName(node.name);
    if (name === null) return;
    keys.add(name);
    if (name === "@type") for (const type of literalStrings(node.initializer)) types.add(type);
  });
  return { types, keys };
}

const MARKUP = new Map(SOURCE_FILES.map((file) => [file, markupOf(file)]));

function filesWithType(predicate: (type: string) => boolean): string[] {
  return SOURCE_FILES.filter((file) => [...(MARKUP.get(file)?.types ?? [])].some(predicate));
}

function filesWithKey(key: string): string[] {
  return SOURCE_FILES.filter((file) => MARKUP.get(file)?.keys.has(key));
}

describe("JSON-LD entities have one builder each", () => {
  it.each([
    ["Store", SHOP_JSONLD],
    ["LocalBusiness", SHOP_JSONLD],
    ["FoodEstablishment", SHOP_JSONLD],
    ["AggregateRating", SHOP_JSONLD],
    ["Review", SHOP_JSONLD],
    ["Product", PRODUCT_JSONLD],
    ["Offer", PRODUCT_JSONLD],
    ["UnitPriceSpecification", PRODUCT_JSONLD],
  ])("@type « %s » is written only by %s", (type, builder) => {
    expect(filesWithType((candidate) => candidate === type)).toEqual([builder]);
  });

  it("writes no AggregateOffer and no Event of any kind", () => {
    expect(filesWithType((type) => type === "AggregateOffer")).toEqual([]);
    expect(filesWithType((type) => /Event$/.test(type))).toEqual([]);
  });

  it("writes aggregateRating only in the shop builder", () => {
    expect(filesWithKey("aggregateRating")).toEqual([SHOP_JSONLD]);
  });

  it("renders <ShopSchema> on the shop page only", () => {
    const users = SOURCE_FILES.filter((file) => {
      let found = false;
      walk(parseRepoFile(file), (node) => {
        if (
          (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
          node.tagName.getText() === "ShopSchema"
        ) {
          found = true;
        }
        if (
          ts.isImportDeclaration(node) &&
          ts.isStringLiteral(node.moduleSpecifier) &&
          node.moduleSpecifier.text === "@/components/seo/ShopSchema"
        ) {
          found = true;
        }
      });
      return found;
    });
    expect(users).toEqual([SHOP_PAGE]);
  });
});

const BANNED_MARKUP: readonly [string, RegExp][] = [
  ["SpeakableSchema", /SpeakableSchema/],
  ["speakable", /speakable/i],
  ['data-purpose="ai-summary"', /data-purpose\s*=\s*\{?\s*["'`]ai-summary["'`]/],
  ["SearchAction", /SearchAction/],
  ["shippingDetails", /shippingDetails/],
  ["hasMerchantReturnPolicy", /hasMerchantReturnPolicy/],
  ["priceValidUntil", /priceValidUntil/],
  ["NutritionInformation", /NutritionInformation/],
];

const PUBLISHED_CODE = new Map(SOURCE_FILES.map((file) => [file, publishedText(file)]));

describe("markup Klik&Go cannot back is gone", () => {
  it("deleted src/components/seo/SpeakableSchema.tsx", () => {
    expect(existsSync(path.join(ROOT, "src/components/seo/SpeakableSchema.tsx"))).toBe(false);
  });

  it.each(BANNED_MARKUP)("no source file contains %s", (_label, pattern) => {
    const offenders = SOURCE_FILES.filter((file) => pattern.test(PUBLISHED_CODE.get(file) ?? ""));
    expect(offenders).toEqual([]);
  });

  // Hidden summaries (« En bref », sr-only) on the pages this chantier rewrote: text a visitor does
  // not see is hidden text for a search engine.
  it.each([
    "src/app/boucherie-halal",
    "src/app/boucheries-halal",
    "src/app/boucheries-halal-rhone-alpes",
    "src/app/boucheries-halal-ouvertes-dimanche",
    "src/app/produits",
    "src/app/occasions",
    "src/app/devenir-boucher-partenaire",
    "src/app/trouver-boucherie-halal",
    "src/app/(client)/click-and-collect-halal",
    "src/app/(client)/commander-viande-halal",
    "src/app/(client)/(accueil)",
    "src/components/seo",
  ])("%s hides no text with sr-only", (root) => {
    const offenders = codeFilesUnder(root).filter((file) =>
      /\bsr-only\b/.test(PUBLISHED_CODE.get(file) ?? "")
    );
    expect(offenders).toEqual([]);
  });

  it("detects the banned markup in code but not in a comment", () => {
    const code = stripComments(
      [
        "// No speakable, no SearchAction: Google retired them.",
        'export const page = { "@type": "WebPage", speakable: { cssSelector: ["h1"] } };',
      ].join("\n"),
      "probe.ts"
    );
    expect(
      BANNED_MARKUP.filter(([, pattern]) => pattern.test(code)).map(([label]) => label)
    ).toEqual(["speakable"]);
  });
});

const CLOSED_LIST_ROUTES = [
  "src/app/boucherie-halal/[ville]/page.tsx",
  "src/app/boucherie-halal/[ville]/[quartier]/page.tsx",
  "src/app/boucheries-halal/[departement]/page.tsx",
  "src/app/boucheries-halal-ouvertes-dimanche/[ville]/page.tsx",
  "src/app/produits/[produit]/[ville]/page.tsx",
  "src/app/occasions/[occasion]/[ville]/page.tsx",
  "src/app/devenir-boucher-partenaire/[ville]/page.tsx",
];

function exportsFunction(source: ts.SourceFile, name: string): boolean {
  return source.statements.some(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === name &&
      (ts.getModifiers(statement) ?? []).some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      )
  );
}

describe("closed-list routes answer 404 for an unknown slug", () => {
  it.each(CLOSED_LIST_ROUTES)("%s: export const dynamicParams = false", (file) => {
    const source = parseRepoFile(file);
    const declaration = exportedConst(source, "dynamicParams");
    expect(declaration?.initializer?.kind, "dynamicParams = false").toBe(
      ts.SyntaxKind.FalseKeyword
    );
    expect(exportsFunction(source, "generateStaticParams"), "generateStaticParams").toBe(true);
  });
});

const INDEXNOW_TRANSPORT = "src/lib/indexnow.ts";
const INDEXNOW_CALLERS = [
  "src/app/api/admin/shops/[shopId]/validate/route.ts",
  "src/app/api/cron/indexnow-fresh/route.ts",
  "src/app/api/seo/indexnow/route.ts",
];

function callsTo(file: string, callee: string): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  walk(parseRepoFile(file), (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === callee
    ) {
      calls.push(node);
    }
  });
  return calls;
}

function functionBody(file: string, name: string): string {
  const source = parseRepoFile(file);
  const declaration = source.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name
  );
  if (declaration?.body === undefined) throw new Error(`${file} declares no function ${name}`);
  return declaration.body.getText(source);
}

describe("no shop URL reaches IndexNow", () => {
  it("calls notifyIndexNow only from the cron, the admin validation and the admin endpoint", () => {
    const callers = SOURCE_FILES.filter(
      (file) => file !== INDEXNOW_TRANSPORT && callsTo(file, "notifyIndexNow").length > 0
    );
    expect(callers).toEqual(INDEXNOW_CALLERS);
  });

  it("never writes a shop URL in a file that calls notifyIndexNow", () => {
    for (const file of INDEXNOW_CALLERS) {
      const code = PUBLISHED_CODE.get(file) ?? "";
      expect(code, file).not.toMatch(/\/boutique/);
      expect(code, file).not.toMatch(/\bshopPath\b/);
    }
  });

  it("feeds the cron and the validation from the sitemap-based URL lists", () => {
    const [cronCall] = callsTo("src/app/api/cron/indexnow-fresh/route.ts", "notifyIndexNow");
    expect(cronCall.arguments[0].getText()).toBe("urls");
    expect(
      callsTo("src/app/api/cron/indexnow-fresh/route.ts", "freshIndexNowUrls"),
      "urls = freshIndexNowUrls(…)"
    ).toHaveLength(1);

    const [validationCall] = callsTo(
      "src/app/api/admin/shops/[shopId]/validate/route.ts",
      "notifyIndexNow"
    );
    const argument = validationCall.arguments[0];
    expect(
      ts.isCallExpression(argument) && argument.expression.getText(),
      "notifyIndexNow(validationIndexNowUrls(…))"
    ).toBe("validationIndexNowUrls");
    // notifyIndexNow never throws: a .catch after it would be unreachable code.
    expect(ts.isAwaitExpression(validationCall.parent), "await notifyIndexNow(…);").toBe(true);
  });

  it("filters every URL through the submission policy and sends only from production", () => {
    const body = functionBody(INDEXNOW_TRANSPORT, "notifyIndexNow");
    expect(body).toMatch(/\bisProductionDeployment\(\)/);
    expect(body).toMatch(/\bisSubmittableToEngines\(/);
  });

  it("talks to the IndexNow endpoint from src/lib/indexnow.ts only", () => {
    const senders = SOURCE_FILES.filter((file) =>
      /indexnow\.org/i.test(PUBLISHED_CODE.get(file) ?? "")
    );
    expect(senders).toEqual([INDEXNOW_TRANSPORT]);
  });
});
