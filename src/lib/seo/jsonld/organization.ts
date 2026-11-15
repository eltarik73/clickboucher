// Organization and WebSite JSON-LD of the root layout, the entities every page builder points to
// by @id (src/lib/seo/jsonld/pages.ts). The description takes its facts from src/lib/seo/facts.ts:
// no pickup-time promise. No areaServed: the cities where a shop takes orders change with the
// shops, and an organisation-wide list would name cities without any. No SearchAction: its target
// /recherche is disallowed in robots.txt and Google retired the sitelinks search box.
// Pure: no I/O, no clock.

import { FACT_SUMMARY_SHORT } from "@/lib/seo/facts";
import type { JsonLdObject } from "@/lib/seo/jsonld/pages";
import { ORGANIZATION_ID, SITE_URL, WEBSITE_ID, absoluteUrl } from "@/lib/seo/site";

const NAME = "Klik&Go";

export function buildOrganizationJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: NAME,
    alternateName: ["Klik and Go", "KlikAndGo"],
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/icons/icon-512.png"),
      width: 512,
      height: 512,
    },
    image: absoluteUrl("/og-image.png"),
    description: `Plateforme de click & collect pour boucheries halal de proximité. ${FACT_SUMMARY_SHORT}`,
    foundingDate: "2025",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "contact@klikandgo.app",
      availableLanguage: ["French"],
      areaServed: "FR",
    },
  };
}

export function buildWebSiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE_URL,
    name: NAME,
    description: "Click & collect pour boucheries halal",
    inLanguage: "fr-FR",
    publisher: { "@id": ORGANIZATION_ID },
  };
}
