// @vitest-environment node
// Sérialisation JSON-LD : un texte venu de la base (avis, nom de boutique…)
// ne doit jamais pouvoir fermer le <script type="application/ld+json">.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { serializeJsonLd } from "@/lib/seo/jsonld/serialize";

const PAYLOAD = "</script><script>window.__x=1</script>";
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

const reviewSchema = {
  "@context": "https://schema.org",
  "@type": "Store",
  name: "Boucherie <b>Test</b>",
  review: [
    {
      "@type": "Review",
      reviewBody: PAYLOAD,
      author: { "@type": "Person", name: "Fatima.A" },
    },
  ],
};

describe("serializeJsonLd", () => {
  it("neutralise la charge de reproduction : aucun < ni > dans la sortie", () => {
    const out = serializeJsonLd(reviewSchema);
    expect(out).not.toBeNull();
    expect(out).not.toMatch(/[<>]/);
    expect(out).toContain("\\u003c/script\\u003e");
    expect(JSON.parse(out as string)).toEqual(reviewSchema);
  });

  it("ne peut produire ni </script, ni <!--, ni ]]>", () => {
    const out = serializeJsonLd({ a: "<!-- x -->", b: "<![CDATA[ y ]]>", c: "</SCRIPT >" });
    expect(out).not.toMatch(/<\/script|<!--|\]\]>/i);
  });

  it("échappe &, U+2028 et U+2029 en \\uXXXX", () => {
    const out = serializeJsonLd({ t: `Klik&Go${LS}ligne${PS}fin` }) as string;
    expect(out).toBe('{"t":"Klik\\u0026Go\\u2028ligne\\u2029fin"}');
    expect(out).not.toContain("&");
    expect(out).not.toContain(LS);
    expect(out).not.toContain(PS);
  });

  it("aller-retour JSON.parse identique (accents, emojis, guillemets, antislash, tableaux imbriqués)", () => {
    const data = {
      "@context": "https://schema.org",
      name: "Boucherie Élégance — Chambéry 🥩🔥",
      quote: 'Il a dit "parfait" & c\'est <vrai>',
      path: "C:\\dossier\\fichier",
      separators: `${LS}${PS}`,
      nested: [[1, 2, [3, { deep: ["<", ">", "&"] }]], { ok: true, none: null }],
      number: 12.5,
    };
    const out = serializeJsonLd(data) as string;
    expect(out).not.toMatch(/[<>&]/);
    expect(JSON.parse(out)).toEqual(data);
  });

  it("garde la sortie de JSON.stringify quand rien n'est à échapper", () => {
    const data = { "@type": "BreadcrumbList", itemListElement: [{ position: 1, name: "Accueil" }] };
    expect(serializeJsonLd(data)).toBe(JSON.stringify(data));
  });

  it("retourne null pour une valeur non sérialisable (undefined, fonction, symbole)", () => {
    expect(serializeJsonLd(undefined)).toBeNull();
    expect(serializeJsonLd(() => 1)).toBeNull();
    expect(serializeJsonLd(Symbol("x"))).toBeNull();
  });

  it("sérialise null et les primitives comme JSON.stringify", () => {
    expect(serializeJsonLd(null)).toBe("null");
    expect(serializeJsonLd("a<b")).toBe('"a\\u003cb"');
    expect(serializeJsonLd(3)).toBe("3");
  });
});

// JsonLd.tsx n'est pas importable ici (JSX non transformé par cette config
// Vitest) : on rend la même balise que le composant, via createElement.
describe("rendu du <script> JSON-LD", () => {
  it("un seul bloc, fermé une seule fois, même avec la charge", () => {
    const html = renderToStaticMarkup(
      createElement("script", {
        id: "shop",
        type: "application/ld+json",
        dangerouslySetInnerHTML: { __html: serializeJsonLd(reviewSchema) as string },
      })
    );
    expect(html.startsWith('<script id="shop" type="application/ld+json">')).toBe(true);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html.endsWith("</script>")).toBe(true);
  });
});

describe("garde-fou : JSON dans <script> uniquement via JsonLd", () => {
  const SRC = path.join(process.cwd(), "src");
  const ALLOWED = path.join(SRC, "components", "seo", "JsonLd.tsx");
  const THIS_FILE = fileURLToPath(import.meta.url);

  function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return /\.(tsx?|jsx?|mjs)$/.test(entry.name) ? [full] : [];
    });
  }

  it("aucun autre fichier de src/ n'écrit de JSON-LD avec dangerouslySetInnerHTML", () => {
    const offenders = walk(SRC).filter((file) => {
      if (file === ALLOWED || file === THIS_FILE) return false;
      const content = fs.readFileSync(file, "utf8");
      return content.includes("application/ld+json") && content.includes("dangerouslySetInnerHTML");
    });
    expect(offenders.map((f) => path.relative(process.cwd(), f))).toEqual([]);
  });
});
