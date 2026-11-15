// Content of the Sunday page /boucheries-halal-ouvertes-dimanche/[ville]: intro, count line,
// empty-list text, editorial text, links to the other Sunday cities, FAQ and JSON-LD. Pure: the
// page passes the city and the number of listed shops whose hours include Sunday.
//
// Opening hours are the ones each shop entered: the texts say so and promise nothing about
// them (no live update, no typical hours). The JSON-LD is a CollectionPage that carries the
// page's own name and description and no item: the shops are not described in markup (D2).

import { sundayBreadcrumb } from "@/lib/seo/breadcrumbs";
import { SEO_CITIES, type SeoCity } from "@/lib/seo/cities";
import { COMMON_FAQ, FACT_FEES, FACT_PAYMENT, FACT_PICKUP, type Faq } from "@/lib/seo/facts";
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  webPageJsonLd,
  type JsonLdObject,
} from "@/lib/seo/jsonld/pages";
import { sundayPath } from "@/lib/seo/routes";
import { SUNDAY_CITY_SLUGS } from "@/lib/seo/sunday";
import { sundayDescription } from "@/lib/seo/titles";

export type SundayPageContent = {
  heading: string;
  intro: string;
  countLine: string;
  emptyText: string;
  editorial: string[];
  otherCities: SeoCity[];
  faqs: Faq[];
  jsonLd: JsonLdObject[];
};

/** The SEO city of a Sunday page; undefined when the slug is not in SUNDAY_CITY_SLUGS. */
export function findSundayCity(slug: string): SeoCity | undefined {
  if (!SUNDAY_CITY_SLUGS.includes(slug)) return undefined;
  return SEO_CITIES.find((city) => city.slug === slug);
}

function sundayCity(slug: string): SeoCity {
  const city = findSundayCity(slug);
  if (city === undefined) throw new Error(`Sunday city "${slug}" is not a SEO city`);
  return city;
}

function countLine(city: SeoCity, count: number): string {
  if (count === 0) {
    return `Aucune boucherie inscrite n'indique d'ouverture le dimanche à ${city.name} pour l'instant`;
  }
  return count === 1
    ? `1 boucherie inscrite ouverte le dimanche à ${city.name}`
    : `${count} boucheries inscrites ouvertes le dimanche à ${city.name}`;
}

function openOnSundayAnswer(city: SeoCity, count: number): string {
  if (count === 0) {
    return `Aucune boucherie halal de ${city.name} inscrite sur Klik&Go n'indique d'ouverture le dimanche pour l'instant. La page des boucheries halal de ${city.name} présente celles qui sont inscrites, avec leurs horaires.`;
  }
  return count === 1
    ? `Une boucherie halal de ${city.name} inscrite sur Klik&Go indique une ouverture le dimanche : elle figure dans la liste de cette page, avec ses horaires.`
    : `${count} boucheries halal de ${city.name} inscrites sur Klik&Go indiquent une ouverture le dimanche : elles figurent dans la liste de cette page, avec leurs horaires.`;
}

function sundayFaqs(city: SeoCity, count: number): Faq[] {
  return [
    {
      question: `Quelles boucheries halal sont ouvertes le dimanche à ${city.name} ?`,
      answer: openOnSundayAnswer(city, count),
    },
    {
      question: "Comment commander de la viande halal pour le dimanche ?",
      answer: `Choisissez une boucherie ouverte le dimanche, sélectionnez vos produits et validez votre commande. ${FACT_PICKUP}`,
    },
    {
      question: `Quels sont les horaires des boucheries halal à ${city.name} le dimanche ?`,
      answer:
        "Chaque boucherie fixe ses horaires du dimanche. Ceux que vous voyez sur sa fiche Klik&Go sont ceux qu'elle a indiqués : en cas de doute, appelez-la avant de vous déplacer.",
    },
    COMMON_FAQ.payment,
    COMMON_FAQ.fees,
    COMMON_FAQ.halal,
  ];
}

export function sundayPageContent(city: SeoCity, sundayShopCount: number): SundayPageContent {
  const heading = `Boucherie halal ouverte le dimanche à ${city.name}`;
  const faqs = sundayFaqs(city, sundayShopCount);
  return {
    heading,
    intro: `Les boucheries halal de ${city.name} inscrites sur Klik&Go qui indiquent une ouverture le dimanche, avec leurs horaires. Commandez en click & collect et retirez votre commande en boutique.`,
    countLine: countLine(city, sundayShopCount),
    emptyText: `Aucune boucherie halal de ${city.name} inscrite sur Klik&Go n'indique d'ouverture le dimanche pour l'instant.`,
    editorial: [
      `Le dimanche est souvent le jour des repas de famille. Les horaires du dimanche varient d'une boucherie à l'autre : cette page ne présente que les boucheries de ${city.name} inscrites sur Klik&Go qui indiquent une ouverture ce jour-là.`,
      "Avec le click & collect, vous passez commande à l'avance et la boucherie la prépare pour le retrait : pratique pour un repas de famille, un méchoui ou le gigot du dimanche.",
      `${FACT_PAYMENT} ${FACT_FEES}`,
    ],
    otherCities: SUNDAY_CITY_SLUGS.filter((slug) => slug !== city.slug).map(sundayCity),
    faqs,
    jsonLd: [
      breadcrumbJsonLd(sundayBreadcrumb(city)),
      // A CollectionPage of its own name and description only: no shop item (decision D2).
      {
        ...webPageJsonLd({
          name: heading,
          description: sundayDescription(city),
          path: sundayPath(city.slug),
        }),
        "@type": "CollectionPage",
      },
      faqPageJsonLd(faqs),
    ],
  };
}
