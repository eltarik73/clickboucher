// Content of the product x city pages (/produits/[produit]/[ville]): head, visible texts, links,
// FAQ and JSON-LD, computed from the editorial data and the number of shops the page lists.
// Pure: the page loads the shops and renders what this module returns.
//
// The page is about a kind of product in a city, not an offer: its JSON-LD is a WebPage about the
// product, never a Product, an AggregateOffer or a list of shops, and no sentence says which shop
// sells what, since only each shop page shows its catalogue. Every text stays true with zero
// shop and states no count; payment and halal answers come from src/lib/seo/facts.ts.

import { CITY_CONTENT_UPDATED, SEO_CITIES, type SeoCity } from "@/lib/seo/cities";
import { PRODUCT_VILLE_PRIORITY_SLUGS, SEO_PRODUCTS, type SeoProduct } from "@/lib/seo/products";
import { COMMON_FAQ, type Faq } from "@/lib/seo/facts";
import { departmentOfCity, productCityBreadcrumb } from "@/lib/seo/breadcrumbs";
import { cityPath, departmentPath, partnerPath, productCityPath } from "@/lib/seo/routes";
import { departmentLocative, productCityDescription, productCityTitle } from "@/lib/seo/titles";
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  webPageJsonLd,
  type JsonLdObject,
} from "@/lib/seo/jsonld/pages";

/** ISO date of the last real change of the product x city template and product texts. */
export const PRODUCT_CITY_CONTENT_UPDATED = "2026-11-15";

/** How many other products the page links to. */
const OTHER_PRODUCTS_SHOWN = 6;

export type PageLink = { label: string; path: string };

export type ProductCityHead = { path: string; title: string; description: string };

export type ProductCityContent = ProductCityHead & {
  heading: string;
  lastUpdated: string;
  cityLink: PageLink;
  departmentLink: PageLink;
  partnerLink: PageLink;
  /** Sentence presenting the city's specialities (city data, true with zero shop). */
  citySpecialty: string;
  shopListHeading: string;
  /** Under the shop list heading: how to check a shop's catalogue, or that none is listed. */
  shopListText: string;
  otherProducts: PageLink[];
  otherCities: PageLink[];
  faqs: Faq[];
  jsonLd: JsonLdObject[];
};

function cityBySlug(slug: string): SeoCity {
  const city = SEO_CITIES.find((c) => c.slug === slug);
  if (city === undefined) {
    throw new Error(`PRODUCT_VILLE_PRIORITY_SLUGS names "${slug}", which is not an SEO city`);
  }
  return city;
}

export function productCityHead(product: SeoProduct, city: SeoCity): ProductCityHead {
  return {
    path: productCityPath(product.slug, city.slug),
    title: productCityTitle(product, city),
    description: productCityDescription(product, city),
  };
}

/** The page shows the product texts and the city's specialities: the later change dates it. */
export function productCityLastUpdated(city: SeoCity): string {
  const cityUpdated = city.lastUpdated ?? CITY_CONTENT_UPDATED;
  return cityUpdated > PRODUCT_CITY_CONTENT_UPDATED ? cityUpdated : PRODUCT_CITY_CONTENT_UPDATED;
}

function whereToOrder(product: SeoProduct, city: SeoCity, shopCount: number): Faq {
  return {
    question: `${product.name} à ${city.name} : où commander ?`,
    answer:
      shopCount > 0
        ? `Cette page présente les boucheries halal inscrites sur Klik&Go à ${city.name}. Chacune affiche son catalogue et ses prix sur sa page boutique : vérifiez qu'elle propose ce produit, commandez en ligne, puis retirez votre commande en boutique.`
        : `Aucune boucherie halal n'est encore inscrite sur Klik&Go à ${city.name}. Les pages des autres villes présentent les boucheries qui y sont inscrites.`,
  };
}

/**
 * Everything the product x city page says and marks up. shopCount is the number of shops the
 * page lists; it only decides between the « listed shops » and the « no shop yet » wording.
 */
export function productCityContent(
  product: SeoProduct,
  city: SeoCity,
  shopCount: number
): ProductCityContent {
  if (!Number.isInteger(shopCount) || shopCount < 0) {
    throw new RangeError(`shopCount must be a natural number, got ${shopCount}`);
  }
  const head = productCityHead(product, city);
  const heading = `${product.name} à ${city.name}`;
  const department = departmentOfCity(city.slug);
  const faqs: Faq[] = [
    ...(product.servingQuestion ? [product.servingQuestion] : []),
    whereToOrder(product, city, shopCount),
    COMMON_FAQ.payment,
    COMMON_FAQ.fees,
    COMMON_FAQ.halal,
  ];

  return {
    ...head,
    heading,
    lastUpdated: productCityLastUpdated(city),
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
    citySpecialty: `Spécialités appréciées à ${city.name} : ${city.specialty}.`,
    shopListHeading: `Boucheries halal à ${city.name} sur Klik&Go`,
    shopListText:
      shopCount > 0
        ? "Chaque boucherie présente son catalogue et ses prix sur sa page : vérifiez qu'elle propose ce produit avant de commander."
        : `Aucune boucherie halal n'est encore inscrite sur Klik&Go à ${city.name}.`,
    otherProducts: SEO_PRODUCTS.filter((p) => p.slug !== product.slug)
      .slice(0, OTHER_PRODUCTS_SHOWN)
      .map((p) => ({ label: p.name, path: productCityPath(p.slug, city.slug) })),
    otherCities: PRODUCT_VILLE_PRIORITY_SLUGS.filter((slug) => slug !== city.slug)
      .map(cityBySlug)
      .map((c) => ({ label: c.name, path: productCityPath(product.slug, c.slug) })),
    faqs,
    jsonLd: [
      webPageJsonLd({
        name: heading,
        description: head.description,
        path: head.path,
        about: { type: "Thing", name: product.name },
      }),
      breadcrumbJsonLd(productCityBreadcrumb(product, city)),
      faqPageJsonLd(faqs),
    ],
  };
}
