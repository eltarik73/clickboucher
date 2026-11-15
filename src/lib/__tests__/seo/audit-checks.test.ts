// @vitest-environment node
// seo-audit cron checks (C1-SEO, FIX-13), page side: robots directives as Google reads them (one
// noindex anywhere wins, header included), list pages free of shop entities, ratings, reviews,
// Events and forbidden claims, real 404s, noindex on the auth pages. Shop pages, sitemap and
// robots.txt: audit-checks-shop-sitemap.test.ts. Pages: audit-fixtures.ts.
import { describe, expect, it } from "vitest";
import {
  alertLines,
  extractJsonLd,
  indexablePageProblems,
  listPageProblems,
  mustBeNoindexProblems,
  mustBeNotFoundProblems,
  robotsVerdict,
} from "@/lib/seo/audit-checks";
import { shopPath } from "@/lib/seo/routes";
import { absoluteUrl } from "@/lib/seo/site";
import { CHAMBERY_PATH, INDEX_METAS, SOFT_404, cityPage, html, ld, snap } from "./audit-fixtures";

describe("robotsVerdict", () => {
  it("reports the noindex of a soft 404 that also says « index, follow »", () => {
    const verdict = robotsVerdict(SOFT_404, null);
    expect(verdict.noindex).toBe(true);
    expect(verdict.directives).toEqual(expect.arrayContaining(["index", "follow", "noindex"]));
  });

  it("reports noindex from an X-Robots-Tag header alone", () => {
    expect(robotsVerdict(cityPage(), null).noindex).toBe(false);
    expect(robotsVerdict(cityPage(), "noindex").noindex).toBe(true);
    expect(robotsVerdict(cityPage(), "googlebot: noindex, nofollow").noindex).toBe(true);
  });

  it("ignores another agent's header and valued directives", () => {
    expect(robotsVerdict(cityPage(), "otherbot: noindex").noindex).toBe(false);
    const verdict = robotsVerdict(cityPage(), "max-snippet:-1, max-image-preview:large");
    expect(verdict.noindex).toBe(false);
    expect(verdict.directives).toEqual(expect.arrayContaining(["max-snippet:-1"]));
  });

  it("reads any attribute order and « none », but no meta inside a script", () => {
    expect(robotsVerdict("<meta content='none' name='GOOGLEBOT'>", null).noindex).toBe(true);
    const inScript =
      '<script>self.__next_f.push([1,"<meta name=\\"robots\\" content=\\"noindex\\">"])</script>';
    expect(robotsVerdict(`${INDEX_METAS}${inScript}`, null).noindex).toBe(false);
  });
});

describe("extractJsonLd", () => {
  it("parses every block, escaped characters included, and leaves out what is not JSON-LD", () => {
    const page = `${ld({ "@type": "WebPage", name: "</script> & co" })}<script>{"@type":"Store"}</script><script type="application/ld+json">{oops</script>`;
    expect(extractJsonLd(page)).toEqual([{ "@type": "WebPage", name: "</script> & co" }]);
  });
});

describe("listPageProblems", () => {
  it("finds nothing on a clean city page", () => {
    expect(listPageProblems(snap(CHAMBERY_PATH, cityPage()))).toEqual([]);
  });

  it("ignores scripts, attributes and the shop cards' own text", () => {
    const body = `<a class="active:scale-[0.99]" href="${shopPath("el-mektoub")}"><h3>La meilleure boucherie</h3><span>30<!-- --> min</span></a><script>self.__next_f.push([1,"Frais 0,99 €"])</script>`;
    expect(listPageProblems(snap(CHAMBERY_PATH, cityPage({ body })))).toEqual([]);
  });

  it("flags a shop entity, a rating, a review and an Event in the JSON-LD", () => {
    const jsonLd = [
      { "@type": ["Store", "FoodEstablishment", "LocalBusiness"], name: "El Mektoub" },
      {
        "@type": "ItemList",
        itemListElement: [{ "@type": "ListItem", item: { aggregateRating: { reviewCount: 89 } } }],
      },
      { "@type": "WebPage", review: [{ "@type": "Review", reviewBody: "Top" }] },
      { "@type": "FoodEvent", name: "Aïd al-Adha" },
      { "@type": "Product", name: "Merguez" },
    ];
    expect(listPageProblems(snap(CHAMBERY_PATH, cityPage({ jsonLd })))).toEqual([
      "entité boutique dans le JSON-LD (Store, FoodEstablishment, LocalBusiness)",
      "entité Product dans le JSON-LD",
      "aggregateRating dans le JSON-LD",
      "review dans le JSON-LD",
      "entité Event dans le JSON-LD (FoodEvent)",
    ]);
  });

  it("flags a « 0,99 » sentence in the text, the metadata or the FAQ JSON-LD", () => {
    const sentence = "Frais de service 0,99 € par commande.";
    const pages = [
      cityPage({ body: `<p>${sentence}</p>` }),
      cityPage({ head: `<meta property="og:description" content="${sentence}"/>` }),
      cityPage({
        jsonLd: [{ "@type": "FAQPage", mainEntity: [{ "@type": "Question", text: sentence }] }],
      }),
    ];
    for (const page of pages) {
      expect(listPageProblems(snap(CHAMBERY_PATH, page))).toEqual([
        "affirmation interdite (fee-amount) : « Frais de service 0,99 € »",
      ]);
    }
  });

  it("flags a non-200 status alone, and a noindex page", () => {
    expect(listPageProblems(snap(CHAMBERY_PATH, "<html></html>", 404))).toEqual([
      "statut HTTP 404 (attendu 200)",
    ]);
    expect(listPageProblems(snap(CHAMBERY_PATH, null, 0))).toEqual([
      "injoignable (délai dépassé ou erreur réseau)",
    ]);
    const noindex = cityPage({ head: '<meta name="robots" content="noindex"/>' });
    expect(listPageProblems(snap(CHAMBERY_PATH, noindex))).toEqual([
      "noindex (index, follow, max-video-preview:-1, max-image-preview:large, max-snippet:-1, noindex)",
    ]);
  });

  it("flags an unreadable JSON-LD block", () => {
    const page = cityPage({ body: '<script type="application/ld+json">{oops</script>' });
    expect(listPageProblems(snap(CHAMBERY_PATH, page))).toEqual(["1 bloc(s) JSON-LD illisible(s)"]);
  });
});

describe("indexablePageProblems", () => {
  const home = html({ path: "/", title: "Click & Collect Boucherie Halal" });

  it("accepts the home page with its root canonical, slash or not", () => {
    expect(indexablePageProblems(snap("/", home))).toEqual([]);
    const slash = home.replace(`href="${absoluteUrl("/")}"`, `href="${absoluteUrl("/")}/"`);
    expect(indexablePageProblems(snap("/", slash))).toEqual([]);
  });

  it("flags a missing title, a « halal halal » title and a foreign or missing canonical", () => {
    expect(indexablePageProblems(snap("/", home.replace(/<title>.*<\/title>/, "")))).toEqual([
      "titre absent ou trop court",
    ]);
    const doubled = html({ path: "/occasions/buffet/lyon", title: "Buffet halal halal à Lyon" });
    expect(indexablePageProblems(snap("/occasions/buffet/lyon", doubled))).toEqual([
      "titre avec « halal halal »",
    ]);
    expect(indexablePageProblems(snap(CHAMBERY_PATH, home))).toEqual([
      "canonical vers une autre URL (/)",
    ]);
    const preview = home.replace(absoluteUrl("/"), "https://preview.example.test");
    expect(indexablePageProblems(snap("/", preview))).toEqual([
      "canonical sur un autre domaine (https://preview.example.test)",
    ]);
    const withoutCanonical = home.replace(/<link rel="canonical"[^>]*>/, "");
    expect(indexablePageProblems(snap("/", withoutCanonical))).toEqual(["canonical absent"]);
  });
});

describe("mustBeNoindexProblems", () => {
  const signIn = html({ path: "/sign-in", title: "Connexion à Klik&Go" });

  it("flags an indexable page, accepts a noindex meta or header", () => {
    expect(mustBeNoindexProblems(snap("/sign-in", signIn))).toEqual([
      "indexable : aucune directive noindex",
    ]);
    const noindex = signIn.replace(
      INDEX_METAS,
      '<meta name="robots" content="noindex, nofollow"/>'
    );
    expect(mustBeNoindexProblems(snap("/sign-in", noindex))).toEqual([]);
    expect(mustBeNoindexProblems(snap("/sign-in", signIn, 200, "noindex"))).toEqual([]);
  });

  it("flags a page that does not answer 200", () => {
    expect(mustBeNoindexProblems(snap("/sign-in", "", 307))).toEqual([
      "statut HTTP 307 (attendu 200)",
    ]);
  });
});

describe("mustBeNotFoundProblems", () => {
  it("accepts a real 404 and flags a soft 404, a redirect and no answer", () => {
    const absentShop = shopPath("__audit-absent__");
    expect(mustBeNotFoundProblems(snap(absentShop, "", 404))).toEqual([]);
    expect(mustBeNotFoundProblems(snap(absentShop, SOFT_404, 200))).toEqual([
      "statut HTTP 200 au lieu de 404 (soft 404)",
    ]);
    expect(mustBeNotFoundProblems(snap("/boucherie-halal/__audit-absent__", "", 308))).toEqual([
      "statut HTTP 308 (attendu 404)",
    ]);
    expect(mustBeNotFoundProblems(snap(absentShop, null, 0))).toEqual([
      "injoignable (délai dépassé ou erreur réseau)",
    ]);
  });
});

describe("alertLines", () => {
  it("gives one line per problem with the paths it was found on", () => {
    const paths = Array.from({ length: 12 }, (_, index) => `/p${index}`);
    const checks = [
      ...paths.map((path) => ({ path, problems: ["noindex (noindex)"] })),
      { path: "/ok", problems: [] },
      { path: "/sitemap.xml", problems: ["pas de ligne Sitemap"] },
    ];
    expect(alertLines(checks)).toEqual([
      "noindex (noindex) — /p0, /p1, /p2, /p3, /p4, /p5, /p6, /p7, /p8, /p9 … (+2)",
      "pas de ligne Sitemap — /sitemap.xml",
    ]);
  });
});
