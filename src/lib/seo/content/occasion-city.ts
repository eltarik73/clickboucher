// Content of the occasion x city pages (/occasions/[occasion]/[ville]): head, visible texts,
// links, FAQ and JSON-LD, computed from the editorial data and the number of shops the page lists.
// Pure: the page loads the shops and renders what this module returns.
//
// An occasion (Aïd, Ramadan, wedding, barbecue…) is not an event organised by Klik&Go: every
// occasion page is a WebPage about the occasion, never an Event, an Offer or a list of shops, and
// the expected dates of a feast stay in the visible text of the occasion data. Every text stays
// true with zero shop and states no count; payment and halal answers come from
// src/lib/seo/facts.ts.

import { SEO_CITIES, type SeoCity } from "@/lib/seo/cities";
import {
  OCCASION_VILLE_PRIORITY_SLUGS,
  SEO_OCCASIONS,
  type SeoOccasion,
} from "@/lib/seo/occasions";
import { COMMON_FAQ, type Faq } from "@/lib/seo/facts";
import { departmentOfCity, occasionCityBreadcrumb } from "@/lib/seo/breadcrumbs";
import { cityPath, departmentPath, occasionCityPath, partnerPath } from "@/lib/seo/routes";
import { departmentLocative, occasionCityDescription, occasionCityTitle } from "@/lib/seo/titles";
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  webPageJsonLd,
  type JsonLdObject,
} from "@/lib/seo/jsonld/pages";

/** ISO date of the last real change of the occasion x city template texts. */
export const OCCASION_CITY_CONTENT_UPDATED = "2026-11-15";

export type PageLink = { label: string; path: string };

export type OccasionCityHead = { path: string; title: string; description: string };

export type OccasionCityContent = OccasionCityHead & {
  heading: string;
  lastUpdated: string;
  cityLink: PageLink;
  departmentLink: PageLink;
  partnerLink: PageLink;
  shopListHeading: string;
  /** Under the shop list heading: how to check a shop's catalogue, or that none is listed. */
  shopListText: string;
  otherOccasions: PageLink[];
  otherCities: PageLink[];
  faqs: Faq[];
  jsonLd: JsonLdObject[];
};

function cityBySlug(slug: string): SeoCity {
  const city = SEO_CITIES.find((c) => c.slug === slug);
  if (city === undefined) {
    throw new Error(`OCCASION_VILLE_PRIORITY_SLUGS names "${slug}", which is not an SEO city`);
  }
  return city;
}

export function occasionCityHead(occasion: SeoOccasion, city: SeoCity): OccasionCityHead {
  return {
    path: occasionCityPath(occasion.slug, city.slug),
    title: occasionCityTitle(occasion, city),
    description: occasionCityDescription(occasion, city),
  };
}

/** The later of the occasion's own text change and the template's. */
export function occasionCityLastUpdated(occasion: SeoOccasion): string {
  return occasion.lastUpdated > OCCASION_CITY_CONTENT_UPDATED
    ? occasion.lastUpdated
    : OCCASION_CITY_CONTENT_UPDATED;
}

function whereToOrder(occasion: SeoOccasion, city: SeoCity, shopCount: number): Faq {
  return {
    question: `${occasion.name} à ${city.name} : où commander ?`,
    answer:
      shopCount > 0
        ? `Cette page présente les boucheries halal inscrites sur Klik&Go à ${city.name}. Chacune affiche son catalogue et ses prix sur sa page boutique : vérifiez qu'elle propose les produits et les quantités qu'il vous faut, commandez en ligne, puis retirez votre commande en boutique.`
        : `Aucune boucherie halal n'est encore inscrite sur Klik&Go à ${city.name}. Les pages des autres villes présentent les boucheries qui y sont inscrites.`,
  };
}

/**
 * Everything the occasion x city page says and marks up. shopCount is the number of shops the
 * page lists; it only decides between the « listed shops » and the « no shop yet » wording.
 */
export function occasionCityContent(
  occasion: SeoOccasion,
  city: SeoCity,
  shopCount: number
): OccasionCityContent {
  if (!Number.isInteger(shopCount) || shopCount < 0) {
    throw new RangeError(`shopCount must be a natural number, got ${shopCount}`);
  }
  const head = occasionCityHead(occasion, city);
  const heading = `${occasion.name} halal à ${city.name}`;
  const department = departmentOfCity(city.slug);
  const faqs: Faq[] = [
    occasion.servingTip,
    {
      question: `${occasion.name} à ${city.name} : quand commander ?`,
      answer: occasion.bookingDelay,
    },
    whereToOrder(occasion, city, shopCount),
    COMMON_FAQ.payment,
    COMMON_FAQ.fees,
    COMMON_FAQ.halal,
  ];

  return {
    ...head,
    heading,
    lastUpdated: occasionCityLastUpdated(occasion),
    cityLink: {
      label: `Boucheries halal à ${city.name}`,
      path: cityPath(city.slug),
    },
    departmentLink: {
      label: `Boucheries halal ${departmentLocative(department)}`,
      path: departmentPath(department.slug),
    },
    partnerLink: {
      label: `Boucher à ${city.name} ? Proposez vos produits sur Klik&Go`,
      path: partnerPath(city.slug),
    },
    shopListHeading: `Boucheries halal à ${city.name} sur Klik&Go`,
    shopListText:
      shopCount > 0
        ? "Chaque boucherie présente son catalogue et ses prix sur sa page : vérifiez qu'elle propose les produits et les quantités qu'il vous faut avant de commander."
        : `Aucune boucherie halal n'est encore inscrite sur Klik&Go à ${city.name}.`,
    otherOccasions: SEO_OCCASIONS.filter((o) => o.slug !== occasion.slug).map((o) => ({
      label: o.name,
      path: occasionCityPath(o.slug, city.slug),
    })),
    otherCities: OCCASION_VILLE_PRIORITY_SLUGS.filter((slug) => slug !== city.slug)
      .map(cityBySlug)
      .map((c) => ({ label: c.name, path: occasionCityPath(occasion.slug, c.slug) })),
    faqs,
    jsonLd: [
      webPageJsonLd({
        name: heading,
        description: head.description,
        path: head.path,
        about: { type: "Thing", name: occasion.name },
      }),
      breadcrumbJsonLd(occasionCityBreadcrumb(occasion, city)),
      faqPageJsonLd(faqs),
    ],
  };
}
