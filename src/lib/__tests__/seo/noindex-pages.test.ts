// @vitest-environment node
// Robots metadata of the pages handled by C1-SEO-T7, read from the modules Next.js reads it from:
// - the sign-in, sign-up, butcher tool (/shop/…) and order (/commande/[id]) pages answer
//   noindex, nofollow; robots.txt leaves them crawlable so that engines can read it;
// - the partner pages /devenir-boucher-partenaire/[ville] stay indexable (business-critical,
//   rule OR of the seo-anti-penalty skill), take their title and description from the shared
//   builders and close their list of cities;
// - the landing pages of this task print none of the forbidden claims.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { metadata as signInMetadata } from "@/app/(auth)/sign-in/[[...sign-in]]/page";
import { metadata as signUpMetadata } from "@/app/(auth)/sign-up/[[...sign-up]]/page";
import { metadata as shopToolsMetadata } from "@/app/shop/layout";
import { metadata as orderMetadata } from "@/app/(client)/commande/[id]/layout";
import { generateMetadata as partnerMetadata } from "@/app/devenir-boucher-partenaire/[ville]/layout";
import * as partnerPage from "@/app/devenir-boucher-partenaire/[ville]/page";
import { SEO_CITIES, type SeoCity } from "@/lib/seo/cities";
import { findForbiddenClaims } from "@/lib/seo/claims";
import { partnerPath } from "@/lib/seo/routes";
import { absoluteUrl } from "@/lib/seo/site";
import { partnerDescription, partnerTitle } from "@/lib/seo/titles";

const NOINDEX = { index: false, follow: false };

function cityBySlug(slug: string): SeoCity {
  const city = SEO_CITIES.find((candidate) => candidate.slug === slug);
  if (city === undefined) throw new Error(`Unknown SEO city ${slug}`);
  return city;
}

describe("private pages answer noindex", () => {
  it.each([
    ["/sign-in", signInMetadata],
    ["/sign-up", signUpMetadata],
    ["/shop/…", shopToolsMetadata],
    ["/commande/[id]", orderMetadata],
  ])("%s carries robots noindex, nofollow", (_path, metadata) => {
    expect(metadata.robots).toEqual(NOINDEX);
  });
});

describe("partner pages stay indexable", () => {
  it.each(["chambery", "lyon", "voglans", "saint-etienne"])(
    "/devenir-boucher-partenaire/%s: shared title and description, no robots override",
    async (slug) => {
      const city = cityBySlug(slug);
      const metadata = await partnerMetadata({ params: { ville: slug } });

      expect(metadata.title).toBe(partnerTitle(city));
      expect(metadata.description).toBe(partnerDescription(city));
      expect(metadata.robots).toBeUndefined();
      expect(metadata.alternates?.canonical).toBe(absoluteUrl(partnerPath(slug)));
      expect(metadata.openGraph?.url).toBe(absoluteUrl(partnerPath(slug)));
    }
  );

  it("answers not found for a city outside the list", async () => {
    await expect(partnerMetadata({ params: { ville: "atlantis" } })).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
  });

  it("closes its list of cities: one page per SEO city, any other slug is a 404", async () => {
    expect(partnerPage.dynamicParams).toBe(false);
    const params = await partnerPage.generateStaticParams();
    expect(params.map((param) => param.ville)).toEqual(SEO_CITIES.map((city) => city.slug));
  });
});

const LANDING_PAGE_SOURCES = [
  "src/app/devenir-boucher-partenaire/[ville]/layout.tsx",
  "src/app/devenir-boucher-partenaire/[ville]/page.tsx",
  "src/app/trouver-boucherie-halal/page.tsx",
  "src/app/(client)/click-and-collect-halal/page.tsx",
  "src/app/(client)/commander-viande-halal/page.tsx",
  "src/app/(client)/a-propos/page.tsx",
  "src/app/(client)/presse/page.tsx",
];

describe("landing pages print no forbidden claim", () => {
  it.each(LANDING_PAGE_SOURCES)("%s", (file) => {
    const source = readFileSync(path.resolve(process.cwd(), file), "utf8");
    expect(findForbiddenClaims(source)).toEqual([]);
    expect(source).not.toMatch(/SpeakableSchema|className="sr-only"/);
  });
});
