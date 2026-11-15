// JSON-LD builders of the public pages that describe a page, not a business: breadcrumbs, FAQ,
// web page, collection page. Pure functions; the output goes through <JsonLd data={…} />.
//
// A page about an occasion, a product category or a city is a WebPage or a CollectionPage: it
// never carries an Event, a Product or a shop entity (Store / LocalBusiness), which belong to
// pages that publish verifiable data of that entity (src/lib/seo/jsonld/shop.ts, product.ts).
// Lists are ItemList of plain ListItem { position, url, name } links, never nested typed items.

import type { Crumb } from "@/lib/seo/breadcrumbs";
import type { Faq } from "@/lib/seo/facts";
import { ORGANIZATION_ID, WEBSITE_ID, absoluteUrl } from "@/lib/seo/site";

export type JsonLdObject = Record<string, unknown>;

const CONTEXT = "https://schema.org";
const LANGUAGE = "fr-FR";

export function breadcrumbJsonLd(crumbs: Crumb[]): JsonLdObject {
  if (crumbs.length === 0) throw new RangeError("A breadcrumb needs at least one crumb");
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

export function faqPageJsonLd(faqs: Faq[]): JsonLdObject {
  if (faqs.length === 0) throw new RangeError("An FAQ page needs at least one question");
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

function pageIdentity(type: string, name: string, description: string, path: string): JsonLdObject {
  const url = absoluteUrl(path);
  return {
    "@context": CONTEXT,
    "@type": type,
    "@id": `${url}#webpage`,
    url,
    name,
    description,
    inLanguage: LANGUAGE,
    isPartOf: { "@id": WEBSITE_ID },
    publisher: { "@id": ORGANIZATION_ID },
  };
}

export function webPageJsonLd(input: {
  name: string;
  description: string;
  path: string;
  about?: { type: "Thing" | "Place"; name: string };
}): JsonLdObject {
  const page = pageIdentity("WebPage", input.name, input.description, input.path);
  if (input.about === undefined) return page;
  return { ...page, about: { "@type": input.about.type, name: input.about.name } };
}

export function collectionPageJsonLd(input: {
  name: string;
  description: string;
  path: string;
  items: { name: string; path: string }[];
}): JsonLdObject {
  return {
    ...pageIdentity("CollectionPage", input.name, input.description, input.path),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: input.items.length,
      itemListElement: input.items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(item.path),
        name: item.name,
      })),
    },
  };
}
