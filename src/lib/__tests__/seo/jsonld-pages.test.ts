// @vitest-environment node
//
// Page-level JSON-LD: breadcrumbs, FAQ, WebPage and CollectionPage. Lists are plain links
// (ListItem with url and name), pages point to the site's WebSite and Organization by @id, and
// nothing here can describe a business, an event or a product.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  faqPageJsonLd,
  webPageJsonLd,
} from "@/lib/seo/jsonld/pages";
import { COMMON_FAQ } from "@/lib/seo/facts";
import { cityBreadcrumb } from "@/lib/seo/breadcrumbs";
import { SEO_CITIES } from "@/lib/seo/cities";
import { SITE_URL } from "@/lib/seo/site";
import { serializeJsonLd } from "@/lib/seo/jsonld/serialize";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";

const FORBIDDEN_TYPES =
  /"@type":"(Store|LocalBusiness|FoodEstablishment|Event|FoodEvent|Product|Offer|AggregateRating|Review)"/;

function typesIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(typesIn);
  if (value === null || typeof value !== "object") return [];
  const own = (value as Record<string, unknown>)["@type"];
  return [
    ...(typeof own === "string" ? [own] : []),
    ...Object.values(value as Record<string, unknown>).flatMap(typesIn),
  ];
}

describe("collectionPageJsonLd", () => {
  const page = collectionPageJsonLd({
    name: "Boucheries halal en Savoie",
    description: "Les villes de Savoie.",
    path: "/boucheries-halal/savoie",
    items: [
      { name: "Chambéry", path: "/boucherie-halal/chambery" },
      { name: "Aix-les-Bains", path: "/boucherie-halal/aix-les-bains" },
    ],
  });

  it("emits only ListItem links with url and name (no nested typed item)", () => {
    const list = page.mainEntity as {
      "@type": string;
      numberOfItems: number;
      itemListElement: unknown[];
    };
    expect(list["@type"]).toBe("ItemList");
    expect(list.numberOfItems).toBe(2);
    expect(list.itemListElement).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        url: `${SITE_URL}/boucherie-halal/chambery`,
        name: "Chambéry",
      },
      {
        "@type": "ListItem",
        position: 2,
        url: `${SITE_URL}/boucherie-halal/aix-les-bains`,
        name: "Aix-les-Bains",
      },
    ]);
    expect(typesIn(page).sort()).toEqual(["CollectionPage", "ItemList", "ListItem", "ListItem"]);
  });

  it("references the site and its publisher by @id", () => {
    expect(page).toMatchObject({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      url: `${SITE_URL}/boucheries-halal/savoie`,
      isPartOf: { "@id": `${SITE_URL}#website` },
      publisher: { "@id": `${SITE_URL}#organization` },
    });
  });

  it("counts an empty list as zero items", () => {
    const empty = collectionPageJsonLd({
      name: "Vide",
      description: "Aucun lien.",
      path: "/recettes",
      items: [],
    });
    expect(empty.mainEntity).toEqual({
      "@type": "ItemList",
      numberOfItems: 0,
      itemListElement: [],
    });
  });
});

describe("webPageJsonLd", () => {
  it("references #website and #organization by @id", () => {
    const page = webPageJsonLd({
      name: "Aïd al-Adha à Chambéry",
      description: "Conseils et quantités.",
      path: "/occasions/aid-al-adha/chambery",
    });
    expect(page).toEqual({
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${SITE_URL}/occasions/aid-al-adha/chambery#webpage`,
      url: `${SITE_URL}/occasions/aid-al-adha/chambery`,
      name: "Aïd al-Adha à Chambéry",
      description: "Conseils et quantités.",
      inLanguage: "fr-FR",
      isPartOf: { "@id": `${SITE_URL}#website` },
      publisher: { "@id": `${SITE_URL}#organization` },
    });
  });

  it("describes its subject as a plain Thing or Place, never an Event", () => {
    const page = webPageJsonLd({
      name: "Ramadan à Lyon",
      description: "Conseils.",
      path: "/occasions/ramadan/lyon",
      about: { type: "Thing", name: "Ramadan" },
    });
    expect(page.about).toEqual({ "@type": "Thing", name: "Ramadan" });
    expect(typesIn(page)).toEqual(["WebPage", "Thing"]);
  });

  it("refuses a relative path", () => {
    expect(() => webPageJsonLd({ name: "x", description: "y", path: "recettes" })).toThrow(
      TypeError
    );
  });
});

describe("breadcrumbJsonLd", () => {
  it("lists the crumbs in order with absolute item URLs", () => {
    const chambery = SEO_CITIES.find((c) => c.slug === "chambery")!;
    const json = breadcrumbJsonLd(cityBreadcrumb(chambery));
    expect(json["@type"]).toBe("BreadcrumbList");
    expect(json.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "Boucheries halal Savoie",
        item: `${SITE_URL}/boucheries-halal/savoie`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Chambéry",
        item: `${SITE_URL}/boucherie-halal/chambery`,
      },
    ]);
  });

  it("refuses an empty trail", () => {
    expect(() => breadcrumbJsonLd([])).toThrow(RangeError);
  });

  it("is what <BreadcrumbSchema> renders, escaped by <JsonLd>", () => {
    const items = [
      { name: "Accueil", url: SITE_URL },
      { name: "Boucherie <Test>", url: `${SITE_URL}/boutique/test` },
    ];
    const html = renderToStaticMarkup(createElement(BreadcrumbSchema, { items }));
    expect(html).toBe(
      `<script type="application/ld+json">${serializeJsonLd(breadcrumbJsonLd(items))}</script>`
    );
    expect(html).not.toContain("<Test>");
  });
});

describe("faqPageJsonLd", () => {
  it("maps each question to a Question with its accepted Answer", () => {
    const json = faqPageJsonLd([COMMON_FAQ.fees, COMMON_FAQ.delivery]);
    expect(json).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: COMMON_FAQ.fees.question,
          acceptedAnswer: { "@type": "Answer", text: COMMON_FAQ.fees.answer },
        },
        {
          "@type": "Question",
          name: COMMON_FAQ.delivery.question,
          acceptedAnswer: { "@type": "Answer", text: COMMON_FAQ.delivery.answer },
        },
      ],
    });
  });

  it("refuses an empty FAQ", () => {
    expect(() => faqPageJsonLd([])).toThrow(RangeError);
  });
});

describe("page builders", () => {
  it("never emit a business, event, product, offer or rating entity", () => {
    const outputs = [
      collectionPageJsonLd({
        name: "a",
        description: "b",
        path: "/",
        items: [{ name: "c", path: "/recettes" }],
      }),
      webPageJsonLd({
        name: "a",
        description: "b",
        path: "/",
        about: { type: "Place", name: "Lyon" },
      }),
      breadcrumbJsonLd([{ name: "Accueil", url: SITE_URL }]),
      faqPageJsonLd([COMMON_FAQ.payment]),
    ];
    for (const output of outputs) expect(serializeJsonLd(output)).not.toMatch(FORBIDDEN_TYPES);
  });
});
