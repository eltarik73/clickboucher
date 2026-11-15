// @vitest-environment node
//
// Organization and WebSite JSON-LD of the root layout. The WebSite carries no SearchAction: its
// target /recherche is blocked by robots.txt and the sitelinks search box is retired. The
// Organization states no time promise and no city where no shop may exist, and both entities
// carry the @ids the page builders point to (src/lib/seo/jsonld/pages.ts).

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { buildOrganizationJsonLd, buildWebSiteJsonLd } from "@/lib/seo/jsonld/organization";
import { findForbiddenClaims } from "@/lib/seo/claims";
import { serializeJsonLd } from "@/lib/seo/jsonld/serialize";
import { ORGANIZATION_ID, SITE_URL, WEBSITE_ID } from "@/lib/seo/site";
import { OrganizationSchema } from "@/components/seo/OrganizationSchema";

/** Every key present anywhere in the value, nested objects and arrays included. */
function keysIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysIn);
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => [
    key,
    ...keysIn(nested),
  ]);
}

describe("buildWebSiteJsonLd", () => {
  const website = buildWebSiteJsonLd();

  it("has no SearchAction and no potentialAction", () => {
    expect(keysIn(website)).not.toContain("potentialAction");
    expect(serializeJsonLd(website)).not.toMatch(/SearchAction|search_term_string|\/recherche/);
  });

  it("is the WebSite the pages point to, published by the Organization", () => {
    expect(website).toMatchObject({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      url: SITE_URL,
      name: "Klik&Go",
      inLanguage: "fr-FR",
      publisher: { "@id": ORGANIZATION_ID },
    });
  });
});

describe("buildOrganizationJsonLd", () => {
  const organization = buildOrganizationJsonLd();

  it("has no action of any kind", () => {
    expect(keysIn(organization)).not.toContain("potentialAction");
    expect(serializeJsonLd(organization)).not.toMatch(/SearchAction/);
  });

  it("is the Organization the pages point to, with absolute logo and image", () => {
    expect(organization).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name: "Klik&Go",
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icons/icon-512.png` },
      image: `${SITE_URL}/og-image.png`,
    });
  });

  it("describes the service without a time promise or any other forbidden claim", () => {
    const description = organization.description;
    expect(typeof description).toBe("string");
    expect(description).not.toMatch(/\d+\s?min/);
    expect(findForbiddenClaims(serializeJsonLd(organization) ?? "")).toEqual([]);
    expect(findForbiddenClaims(serializeJsonLd(buildWebSiteJsonLd()) ?? "")).toEqual([]);
  });

  it("names no served city: no city can be promised a shop", () => {
    expect(organization).not.toHaveProperty("areaServed");
    expect(serializeJsonLd(organization)).not.toMatch(/"City"|"State"/);
  });
});

describe("<OrganizationSchema>", () => {
  it("renders the Organization then the WebSite, each in its own JSON-LD script", () => {
    const html = renderToStaticMarkup(createElement(OrganizationSchema));
    expect(html).toBe(
      `<script type="application/ld+json">${serializeJsonLd(buildOrganizationJsonLd())}</script>` +
        `<script type="application/ld+json">${serializeJsonLd(buildWebSiteJsonLd())}</script>`
    );
  });
});
