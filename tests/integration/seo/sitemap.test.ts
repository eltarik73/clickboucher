// @vitest-environment node
// /sitemap.xml sur PostgreSQL réel (C1-SEO, FIX-03, FIX-19, D8) : aucune page boutique, seules les
// recettes indexables, les pages produit d'une ville seulement si une boutique listée (visible, non
// suspendue) s'y trouve, et le lastmod d'une ville daté par la mise en ligne de sa boutique.
import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import sitemap from "@/app/sitemap";
import { CITY_CONTENT_UPDATED, SEO_CITIES } from "@/lib/seo/cities";
import { SEO_PRODUCTS } from "@/lib/seo/products";
import { SITE_URL } from "@/lib/seo/site";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestShop } from "../helpers/factories";

// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React
useCleanDatabase();

const LISTED_IN_LYON = new Date("2030-05-01T10:00:00.000Z");

function recipe(
  slug: string,
  flags: Pick<Prisma.RecipeCreateInput, "aiGenerated" | "featured" | "published">
): Prisma.RecipeCreateInput {
  return {
    slug,
    title: `Recette ${slug}`,
    description: "Recette de test",
    prepTime: 10,
    cookTime: 20,
    totalTime: 30,
    ingredients: [],
    steps: [],
    tags: [],
    meatType: "agneau",
    meatQuantity: "500 g",
    ...flags,
  };
}

async function seedCatalog(): Promise<{ shopSlugs: string[] }> {
  const listed = await createTestShop({ city: "Lyon 7e", validatedAt: LISTED_IN_LYON });
  const suspended = await createTestShop({
    city: "Grenoble",
    validatedAt: new Date("2030-06-01T10:00:00.000Z"),
    suspendedAt: new Date("2030-06-02T10:00:00.000Z"),
  });
  await prisma.recipe.createMany({
    data: [
      recipe("tajine-fait-main", { aiGenerated: false, featured: false, published: true }),
      recipe("kefta-ia-a-la-une", { aiGenerated: true, featured: true, published: true }),
      recipe("couscous-ia-non-revu", { aiGenerated: true, featured: false, published: true }),
      recipe("brouillon-fait-main", { aiGenerated: false, featured: false, published: false }),
    ],
  });
  return { shopSlugs: [listed.slug, suspended.slug] };
}

describe("sitemap.xml", () => {
  it("lists no shop page, even with listed shops in the database", async () => {
    const { shopSlugs } = await seedCatalog();
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls.filter((url) => url.includes("/boutique"))).toEqual([]);
    for (const slug of shopSlugs) expect(urls.join("\n")).not.toContain(slug);
  });

  it("lists the indexable recipes only", async () => {
    await seedCatalog();
    const recipeUrls = (await sitemap())
      .map((entry) => entry.url)
      .filter((url) => url.startsWith(`${SITE_URL}/recettes/`));

    expect(recipeUrls.sort()).toEqual([
      `${SITE_URL}/recettes/kefta-ia-a-la-une`,
      `${SITE_URL}/recettes/tajine-fait-main`,
    ]);
  });

  it("keeps the product pages of the listed shop's city and drops those of a suspended shop's city", async () => {
    await seedCatalog();
    const urls = (await sitemap()).map((entry) => entry.url);

    for (const product of SEO_PRODUCTS) {
      expect(urls).toContain(`${SITE_URL}/produits/${product.slug}/lyon`);
      expect(urls).not.toContain(`${SITE_URL}/produits/${product.slug}/grenoble`);
    }
    expect(urls).toContain(`${SITE_URL}/boucheries-halal-ouvertes-dimanche/lyon`);
    expect(urls).not.toContain(`${SITE_URL}/boucheries-halal-ouvertes-dimanche/grenoble`);
  });

  it("always lists every city and partner page, dated by the listing of the city's shop", async () => {
    await seedCatalog();
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    for (const city of SEO_CITIES) {
      expect(urls).toContain(`${SITE_URL}/boucherie-halal/${city.slug}`);
      expect(urls).toContain(`${SITE_URL}/devenir-boucher-partenaire/${city.slug}`);
    }
    const lastModified = (path: string) =>
      entries.find((entry) => entry.url === `${SITE_URL}${path}`)?.lastModified;
    expect(lastModified("/boucherie-halal/lyon")).toEqual(LISTED_IN_LYON);
    expect(lastModified("/boucherie-halal/grenoble")).toEqual(
      new Date(`${CITY_CONTENT_UPDATED}T00:00:00.000Z`)
    );
    expect(entries.find((entry) => entry.url === SITE_URL)?.lastModified).toEqual(LISTED_IN_LYON);
  });

  it("dates a never-validated shop's city by the shop's creation", async () => {
    const createdAt = new Date("2030-07-01T08:00:00.000Z");
    await createTestShop({ city: "Chambéry", validatedAt: null, createdAt });
    const entries = await sitemap();

    expect(
      entries.find((entry) => entry.url === `${SITE_URL}/boucherie-halal/chambery`)?.lastModified
    ).toEqual(createdAt);
  });
});
