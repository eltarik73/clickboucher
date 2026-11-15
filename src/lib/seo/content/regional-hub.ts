// Content of the regional hub /boucheries-halal-rhone-alpes: metadata, intro, featured city pages,
// departments, editorial text, pillars, FAQ and JSON-LD. Pure: the page passes the number of
// listed shops it counted and renders what comes back.
//
// Figures are computed and name what they count (city pages, departments, listed shops). The
// editorial text is built from the shared facts (src/lib/seo/facts.ts): no fee, no online
// payment, no delivery, no certification by Klik&Go, no ranking of cities. The JSON-LD is a
// CollectionPage whose items are plain links to the featured city pages (decision D2).

import type { Crumb } from "@/lib/seo/breadcrumbs";
import { SEO_CITIES, SEO_DEPARTMENTS, type SeoCity, type SeoDepartment } from "@/lib/seo/cities";
import { BUTCHER_INVITE, HOW_TO_ORDER_ANSWER, shopCountLabel } from "@/lib/seo/content/city";
import { departmentCities } from "@/lib/seo/content/department";
import {
  COMMON_FAQ,
  FACT_FEES,
  FACT_HALAL,
  FACT_PAYMENT,
  FACT_PICKUP,
  type Faq,
} from "@/lib/seo/facts";
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  faqPageJsonLd,
  type JsonLdObject,
} from "@/lib/seo/jsonld/pages";
import { HOME_PATH, REGIONAL_HUB_PATH, cityPath } from "@/lib/seo/routes";
import { absoluteUrl } from "@/lib/seo/site";

const HUB_NAME = "Boucheries halal en Auvergne-Rhône-Alpes";
// The departments, in French with their articles; pinned against SEO_DEPARTMENTS by a test.
const DEPARTMENTS_PHRASE = "de Savoie, de Haute-Savoie, d'Isère, du Rhône et de la Loire";

export const REGIONAL_HUB_TITLE = `${HUB_NAME} — Click & collect`;
export const REGIONAL_HUB_DESCRIPTION = `${HUB_NAME} : ${SEO_CITIES.length} villes ${DEPARTMENTS_PHRASE}. Click & collect et paiement en boutique.`;

// City pages linked from the hub, Chambéry first (priority of the owner's local strategy).
const FEATURED_CITY_SLUGS: readonly string[] = [
  "chambery",
  "aix-les-bains",
  "lyon",
  "grenoble",
  "saint-etienne",
  "annecy",
  "villeurbanne",
  "venissieux",
  "annemasse",
  "voiron",
  "bourgoin-jallieu",
  "roanne",
];

export type Pillar = { emoji: string; title: string; text: string };

export type RegionalHubContent = {
  intro: string;
  shopCountLabel: string;
  featuredCities: SeoCity[];
  departments: { department: SeoDepartment; cities: SeoCity[] }[];
  editorial: string[];
  pillars: Pillar[];
  faqs: Faq[];
  jsonLd: JsonLdObject[];
};

const PILLARS: Pillar[] = [
  {
    emoji: "📍",
    title: "Près de chez vous",
    text: "Trouvez une boucherie halal inscrite près de chez vous grâce à la géolocalisation.",
  },
  {
    emoji: "🛍️",
    title: "Click & collect",
    text: "Commandez à l'avance et retirez en boutique, dès que c'est prêt ou au créneau choisi.",
  },
  {
    emoji: "🏪",
    title: "Paiement en boutique",
    text: "Vous réglez au retrait, directement à la boucherie.",
  },
  {
    emoji: "💶",
    title: "Sans frais de service",
    text: "Vous payez les prix fixés par la boucherie.",
  },
];

/** « a », « a et b », « a, b et c ». */
export function frenchList(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

function featuredCities(): SeoCity[] {
  return FEATURED_CITY_SLUGS.map((slug) => {
    const city = SEO_CITIES.find((c) => c.slug === slug);
    if (city === undefined) throw new Error(`Featured city "${slug}" is not a SEO city`);
    return city;
  });
}

function hubBreadcrumb(): Crumb[] {
  return [
    { name: "Accueil", url: absoluteUrl(HOME_PATH) },
    { name: "Boucheries halal Rhône-Alpes", url: absoluteUrl(REGIONAL_HUB_PATH) },
  ];
}

function shopsAnswer(shopCount: number): string {
  if (shopCount === 0) {
    return `Aucune boucherie n'est encore inscrite sur Klik&Go. ${BUTCHER_INVITE}`;
  }
  if (shopCount === 1) {
    return "Une boucherie halal est inscrite sur Klik&Go. Retrouvez-la sur la page de sa ville.";
  }
  return `${shopCount} boucheries halal sont inscrites sur Klik&Go. Retrouvez celles de votre ville sur sa page.`;
}

function hubFaqs(shopCount: number, featured: SeoCity[]): Faq[] {
  const departmentNames = frenchList(SEO_DEPARTMENTS.map((d) => d.name));
  const byDepartment = SEO_DEPARTMENTS.map((dept) => {
    const names = featured.filter((c) => dept.citySlugs.includes(c.slug)).map((c) => c.name);
    return names.length > 0 ? `${dept.name} pour ${frenchList(names)}` : dept.name;
  });
  return [
    {
      question: "Combien de villes d'Auvergne-Rhône-Alpes ont une page sur Klik&Go ?",
      answer: `${SEO_CITIES.length} villes, réparties sur ${SEO_DEPARTMENTS.length} départements : ${departmentNames}. Chaque page de ville liste les boucheries halal de la ville inscrites sur Klik&Go.`,
    },
    {
      question: "Combien de boucheries halal sont inscrites sur Klik&Go ?",
      answer: shopsAnswer(shopCount),
    },
    {
      question: "Quel département choisir pour trouver une boucherie halal ?",
      answer: `Chaque département a sa page : ${byDepartment.join(" ; ")}.`,
    },
    {
      question: "Comment commander de la viande halal en click & collect ?",
      answer: HOW_TO_ORDER_ANSWER,
    },
    COMMON_FAQ.delivery,
    COMMON_FAQ.payment,
    COMMON_FAQ.fees,
    COMMON_FAQ.halal,
  ];
}

export function regionalHubContent(shopCount: number): RegionalHubContent {
  const featured = featuredCities();
  const faqs = hubFaqs(shopCount, featured);
  return {
    intro: `Klik&Go présente ${SEO_CITIES.length} villes ${DEPARTMENTS_PHRASE}. Commandez votre viande halal en click & collect et retirez-la en boutique.`,
    shopCountLabel: shopCountLabel(shopCount),
    featuredCities: featured,
    departments: SEO_DEPARTMENTS.map((department) => ({
      department,
      cities: departmentCities(department),
    })),
    editorial: [
      `Klik&Go présente ${SEO_CITIES.length} villes d'Auvergne-Rhône-Alpes, réparties sur ${SEO_DEPARTMENTS.length} départements. Chaque page de ville présente la ville et ses quartiers, et liste les boucheries halal de la ville inscrites sur Klik&Go, avec leurs horaires et leurs produits.`,
      "Commander à l'avance aide à préparer les grands moments : le Ramadan, l'Aïd al-Fitr, l'Aïd al-Adha, un mariage ou un méchoui.",
      `${FACT_PICKUP} ${FACT_PAYMENT} ${FACT_FEES}`,
      FACT_HALAL,
    ],
    pillars: PILLARS,
    faqs,
    jsonLd: [
      breadcrumbJsonLd(hubBreadcrumb()),
      collectionPageJsonLd({
        name: HUB_NAME,
        description: REGIONAL_HUB_DESCRIPTION,
        path: REGIONAL_HUB_PATH,
        items: featured.map((city) => ({
          name: `Boucherie halal à ${city.name}`,
          path: cityPath(city.slug),
        })),
      }),
      faqPageJsonLd(faqs),
    ],
  };
}
