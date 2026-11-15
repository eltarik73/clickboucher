// @vitest-environment node
// Guard: the SEO sources print none of the forbidden claims of src/lib/seo/claims.ts.
//
// Facts (src/lib/seo/facts.ts): payment in the shop at pickup, no service fee, click and collect
// only, no delivery, nothing promised about preparation time, Klik&Go certifies and verifies no
// shop, no figure the page does not compute. Until 2026-11-15 the city, product and occasion pages,
// their FAQ JSON-LD, the landing pages and public/llms.txt said « 0,99 € », « payez en ligne »,
// « halal certifié », « en moins de 30 minutes »… (FIX-05, FIX-12 of the SEO audit).
//
// Every page, data module, JSON-LD builder and text of the chantier's paths is read with its
// comments removed (source-scan.ts) and must give no findForbiddenClaims hit. A failure names the
// file and the matched text: rewrite the sentence or take it from facts.ts. Never add a file to
// EXCLUDED to make the guard pass; claims.ts is excluded because it holds the rules themselves.
import { describe, expect, it } from "vitest";
import { findForbiddenClaims } from "@/lib/seo/claims";
import { exportedConstText, filesUnder, publishedText, stripComments } from "./source-scan";

const SCANNED: readonly string[] = [
  "src/lib/seo",
  "src/components/seo",
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
  "src/app/(client)/recettes",
  "src/app/(client)/a-propos",
  "src/app/(client)/presse",
  "src/app/(client)/(accueil)",
  "src/components/landing/HowItWorks.tsx",
  "src/components/layout/SeoFooter.tsx",
  "public/llms.txt",
];

const EXCLUDED = new Set(["src/lib/seo/claims.ts"]);

// The root layout publishes its metadata to every page (its JSON-LD comes from
// src/components/seo, scanned above). The rest of the file is providers and resource hints whose
// host names (« js.stripe.com ») say nothing to a reader.
const ROOT_LAYOUT = "src/app/layout.tsx";

const FILES = SCANNED.flatMap((root) => filesUnder(root)).filter((file) => !EXCLUDED.has(file));

describe("the SEO sources print no forbidden claim", () => {
  it("reads every guarded path", () => {
    for (const root of SCANNED) {
      expect(
        FILES.some((file) => file === root || file.startsWith(`${root}/`)),
        root
      ).toBe(true);
    }
  });

  it.each(FILES)("%s", (file) => {
    expect(findForbiddenClaims(publishedText(file)), `forbidden claim in ${file}`).toEqual([]);
  });

  it(`${ROOT_LAYOUT}: metadata`, () => {
    expect(findForbiddenClaims(exportedConstText(ROOT_LAYOUT, "metadata"))).toEqual([]);
  });
});

describe("the guard reads what a page publishes", () => {
  const source = [
    "// Never write « livraison » or « 0,99 € » here.",
    "/* The old page said: payez en ligne. */",
    'export const SITE = "https://klikandgo.app"; // trailing: halal certifié',
    "export function Fee() {",
    "  return (",
    '    <p title="Retrait au créneau choisi">',
    "      {/* JSX comment: livraison à domicile */}",
    "      Voir https://exemple.fr // in JSX this is text: frais de service 0,99 €",
    "    </p>",
    "  );",
    "}",
  ].join("\n");

  it("ignores comments and keeps strings and JSX text", () => {
    const published = stripComments(source, "page.tsx");

    expect(published).toContain('"https://klikandgo.app"');
    expect(published).toContain("Retrait au créneau choisi");
    expect(findForbiddenClaims(published)).toEqual([
      { id: "fee-amount", match: "frais de service 0,99 €" },
    ]);
  });
});
