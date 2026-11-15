// Content of the city page /boucherie-halal/[ville]: links to the hubs, empty-list text, FAQ and
// JSON-LD. Pure: the page passes the city and the number of shops it lists (from the database)
// and renders what comes back, so the visible FAQ and the FAQPage JSON-LD are one source.
//
// Wording rules D6 of chantier C1-SEO: every sentence stays true with zero shop, a count is only
// given when the page computed it and names what it counts, and the answers on fees, payment and
// halal are the shared facts (src/lib/seo/facts.ts). The JSON-LD describes the page, never a
// shop: no Store / LocalBusiness entity and no rating on a list page (decision D2).

import { cityBreadcrumb, departmentOfCity } from "@/lib/seo/breadcrumbs";
import type { SeoCity } from "@/lib/seo/cities";
import { COMMON_FAQ, FACT_PICKUP, type Faq } from "@/lib/seo/facts";
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  webPageJsonLd,
  type JsonLdObject,
} from "@/lib/seo/jsonld/pages";
import { REGIONAL_HUB_PATH, cityPath, departmentPath } from "@/lib/seo/routes";
import { departmentLocative } from "@/lib/seo/titles";

export type PageLink = { label: string; path: string };

export type CityPageContent = {
  departmentLink: PageLink;
  regionalHubLink: PageLink;
  emptyText: string;
  faqs: Faq[];
  jsonLd: JsonLdObject[];
};

export const REGIONAL_HUB_LINK: PageLink = {
  label: "Toutes les villes d'Auvergne-Rhône-Alpes",
  path: REGIONAL_HUB_PATH,
};

/** How an order is placed, for the city-family FAQs. */
export const HOW_TO_ORDER_ANSWER = `Choisissez votre ville, puis une boucherie inscrite sur Klik&Go, ajoutez vos produits au panier et validez votre commande. ${FACT_PICKUP}`;

/** Invitation to butchers, for the answers given when no shop is listed. */
export const BUTCHER_INVITE =
  "Vous êtes boucher ? Vous pouvez inscrire votre boutique depuis l'espace boucher.";

/** « Aucune boucherie inscrite », « 1 boucherie inscrite », « 12 boucheries inscrites ». */
export function shopCountLabel(count: number): string {
  if (count === 0) return "Aucune boucherie inscrite";
  return count === 1 ? "1 boucherie inscrite" : `${count} boucheries inscrites`;
}

function listedShopsAnswer(city: SeoCity, shopCount: number): string {
  if (shopCount === 0) {
    return `Aucune boucherie halal de ${city.name} n'est encore inscrite sur Klik&Go. ${BUTCHER_INVITE}`;
  }
  if (shopCount === 1) {
    return `Une boucherie halal de ${city.name} est inscrite sur Klik&Go : vous la trouverez dans la liste de cette page, avec ses horaires et ses produits.`;
  }
  return `${shopCount} boucheries halal de ${city.name} sont inscrites sur Klik&Go : vous les trouverez dans la liste de cette page, avec leurs horaires et leurs produits.`;
}

function cityFaqs(city: SeoCity, shopCount: number): Faq[] {
  return [
    {
      question: `Comment commander de la viande halal en click & collect à ${city.name} ?`,
      answer: `Choisissez une boucherie halal de ${city.name} inscrite sur Klik&Go, sélectionnez vos produits et validez votre commande. ${FACT_PICKUP}`,
    },
    {
      question: `Quelles boucheries halal de ${city.name} sont sur Klik&Go ?`,
      answer: listedShopsAnswer(city, shopCount),
    },
    COMMON_FAQ.payment,
    COMMON_FAQ.fees,
    COMMON_FAQ.halal,
  ];
}

export function cityPageContent(city: SeoCity, shopCount: number): CityPageContent {
  const department = departmentOfCity(city.slug);
  const faqs = cityFaqs(city, shopCount);
  return {
    departmentLink: {
      label: `Boucheries halal ${departmentLocative(department)}`,
      path: departmentPath(department.slug),
    },
    regionalHubLink: REGIONAL_HUB_LINK,
    emptyText: `Aucune boucherie halal de ${city.name} n'est encore inscrite sur Klik&Go.`,
    faqs,
    jsonLd: [
      breadcrumbJsonLd(cityBreadcrumb(city)),
      webPageJsonLd({
        name: `Boucherie halal à ${city.name}`,
        description: city.description,
        path: cityPath(city.slug),
        about: { type: "Place", name: city.name },
      }),
      faqPageJsonLd(faqs),
    ],
  };
}
