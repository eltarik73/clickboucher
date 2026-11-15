// Content of the district page /boucherie-halal/[ville]/[quartier]: list heading and intro, FAQ
// and JSON-LD. Pure: the page passes what its shop query found and renders what comes back.
//
// The page lists the shops whose address matches the district (postal code or name) and, when
// none does, shops of the whole city: the texts say which of the two the visitor sees, never
// present city-wide shops as shops of the district, and state no count (both lists are capped).
// The JSON-LD is a WebPage about the district as a place (decision D2: no shop entity).

import { districtBreadcrumb } from "@/lib/seo/breadcrumbs";
import type { SeoCity } from "@/lib/seo/cities";
import type { SeoDistrict } from "@/lib/seo/districts";
import { COMMON_FAQ, FACT_PICKUP, type Faq } from "@/lib/seo/facts";
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  webPageJsonLd,
  type JsonLdObject,
} from "@/lib/seo/jsonld/pages";
import { districtPath } from "@/lib/seo/routes";

/** What the page lists: how many shops, and whether they are in the district or city-wide. */
export type DistrictListing = { shown: number; inDistrict: boolean };

export type DistrictPageContent = {
  listHeading: string;
  listIntro: string;
  faqs: Faq[];
  jsonLd: JsonLdObject[];
};

function listIntro(city: SeoCity, district: SeoDistrict, listing: DistrictListing): string {
  if (listing.shown === 0) {
    return `Aucune boucherie halal de ${city.name} n'est encore inscrite sur Klik&Go.`;
  }
  if (listing.inDistrict) {
    return `Les boucheries halal inscrites sur Klik&Go à ${district.name} et alentour.`;
  }
  return `Aucune boucherie inscrite sur Klik&Go n'a encore son adresse à ${district.name} : voici des boucheries halal inscrites ailleurs à ${city.name}.`;
}

function listedShopsAnswer(city: SeoCity, district: SeoDistrict, listing: DistrictListing): string {
  if (listing.shown === 0) {
    return `Aucune boucherie halal de ${city.name} n'est encore inscrite sur Klik&Go.`;
  }
  if (listing.inDistrict) {
    return `Des boucheries halal inscrites sur Klik&Go ont leur adresse à ${district.name} ou alentour : elles sont présentées sur cette page, avec leurs horaires.`;
  }
  return `Aucune boucherie inscrite sur Klik&Go n'a encore son adresse à ${district.name}. Cette page présente des boucheries halal inscrites ailleurs à ${city.name}.`;
}

function districtFaqs(city: SeoCity, district: SeoDistrict, listing: DistrictListing): Faq[] {
  const access: Faq[] =
    district.transports && district.transports.length > 0
      ? [
          {
            question: `Comment se rendre à ${district.name} ?`,
            answer: `Le quartier ${district.name} est desservi par : ${district.transports.join(", ")}.`,
          },
        ]
      : [];
  return [
    {
      question: `Quelles boucheries halal près de ${district.name} sont sur Klik&Go ?`,
      answer: listedShopsAnswer(city, district, listing),
    },
    ...access,
    {
      question: "Puis-je commander en ligne et récupérer en boutique ?",
      answer: `Oui. ${FACT_PICKUP}`,
    },
    COMMON_FAQ.payment,
    COMMON_FAQ.fees,
    COMMON_FAQ.halal,
  ];
}

export function districtPageContent(
  city: SeoCity,
  district: SeoDistrict,
  listing: DistrictListing
): DistrictPageContent {
  const faqs = districtFaqs(city, district, listing);
  const place = listing.inDistrict ? district.name : city.name;
  return {
    listHeading: `Boucheries halal à ${place} sur Klik&Go`,
    listIntro: listIntro(city, district, listing),
    faqs,
    jsonLd: [
      breadcrumbJsonLd(districtBreadcrumb(city, district)),
      webPageJsonLd({
        name: `Boucherie halal à ${district.name} (${city.name})`,
        description: district.description,
        path: districtPath(city.slug, district.slug),
        about: { type: "Place", name: `${district.name}, ${city.name}` },
      }),
      faqPageJsonLd(faqs),
    ],
  };
}
