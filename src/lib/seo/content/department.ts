// Content of the department hub /boucheries-halal/[departement]: heading, its city pages, FAQ and
// JSON-LD. Pure: the page passes the department and the number of shops it lists.
//
// The only figure is the number of city pages of the department, computed from the data. The
// page's shop list is capped, so its length is never presented as the department's total. The
// JSON-LD is a CollectionPage whose items are plain links to the department's city pages
// (decision D2: no Place with invented coordinates, no shop entity).

import { departmentBreadcrumb } from "@/lib/seo/breadcrumbs";
import { SEO_CITIES, type SeoCity, type SeoDepartment } from "@/lib/seo/cities";
import { BUTCHER_INVITE, HOW_TO_ORDER_ANSWER } from "@/lib/seo/content/city";
import { COMMON_FAQ, type Faq } from "@/lib/seo/facts";
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  faqPageJsonLd,
  type JsonLdObject,
} from "@/lib/seo/jsonld/pages";
import { cityPath, departmentPath } from "@/lib/seo/routes";
import { departmentLocative } from "@/lib/seo/titles";

export type DepartmentPageContent = {
  /** « en Savoie », « dans le Rhône ». */
  locative: string;
  /** « Boucheries halal en Savoie », « Boucheries halal dans le Rhône ». */
  heading: string;
  /** The department's city pages, in the order of its data. */
  cities: SeoCity[];
  citiesIntro: string;
  faqs: Faq[];
  jsonLd: JsonLdObject[];
};

/** The city pages of a department, in the order of its data. */
export function departmentCities(dept: SeoDepartment): SeoCity[] {
  return dept.citySlugs.map((slug) => {
    const city = SEO_CITIES.find((c) => c.slug === slug);
    if (city === undefined) throw new Error(`The department "${dept.slug}" lists "${slug}"`);
    return city;
  });
}

function citiesSentence(count: number, locative: string): string {
  return count > 1
    ? `${count} villes ${locative} ont leur page sur Klik&Go`
    : `1 ville ${locative} a sa page sur Klik&Go`;
}

function departmentFaqs(cities: SeoCity[], locative: string, shopCount: number): Faq[] {
  return [
    {
      question: `Quelles villes ${locative} ont une page sur Klik&Go ?`,
      answer: `${citiesSentence(cities.length, locative)} : ${cities.map((c) => c.name).join(", ")}. Chaque page de ville liste les boucheries halal de la ville inscrites sur Klik&Go.`,
    },
    {
      question: `Des boucheries halal ${locative} sont-elles inscrites sur Klik&Go ?`,
      answer:
        shopCount > 0
          ? `Oui. Les boucheries halal ${locative} inscrites sur Klik&Go sont présentées sur cette page et sur la page de leur ville.`
          : `Pas encore : aucune boucherie halal ${locative} n'est inscrite sur Klik&Go pour le moment. ${BUTCHER_INVITE}`,
    },
    {
      question: `Comment commander de la viande halal en click & collect ${locative} ?`,
      answer: HOW_TO_ORDER_ANSWER,
    },
    COMMON_FAQ.payment,
    COMMON_FAQ.fees,
    COMMON_FAQ.halal,
  ];
}

export function departmentPageContent(
  dept: SeoDepartment,
  shopCount: number
): DepartmentPageContent {
  const locative = departmentLocative(dept);
  const heading = `Boucheries halal ${locative}`;
  const cities = departmentCities(dept);
  const faqs = departmentFaqs(cities, locative, shopCount);
  return {
    locative,
    heading,
    cities,
    citiesIntro: `${citiesSentence(cities.length, locative)} : choisissez la vôtre.`,
    faqs,
    jsonLd: [
      breadcrumbJsonLd(departmentBreadcrumb(dept)),
      collectionPageJsonLd({
        name: heading,
        description: dept.description,
        path: departmentPath(dept.slug),
        items: cities.map((city) => ({
          name: `Boucherie halal à ${city.name}`,
          path: cityPath(city.slug),
        })),
      }),
      faqPageJsonLd(faqs),
    ],
  };
}
