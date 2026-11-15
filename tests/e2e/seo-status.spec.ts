// What search engines receive from the production build (chantier C1-SEO): HTTP statuses, robots,
// titles, JSON-LD, breadcrumbs, sitemap, and no geolocation call on the home page at mount.
// These can only be checked on `next build` + `next start`: a loading.tsx turned the 404 of an
// unknown shop or recipe into a 200 (soft 404 in Search Console), which no unit test sees.
//
// Run: PLAYWRIGHT_BASE_URL=http://localhost:<port> [E2E_TEST_SECRET=<server TEST_SECRET>]
//   npx playwright test tests/e2e/seo-status.spec.ts --project=chromium
// Read-only: GET requests only, plus the test-mode activation (POST /api/test-mode/activate) for the
// two pages that need a session. Never a cron, IndexNow or admin call. Without PLAYWRIGHT_BASE_URL
// the file is skipped (the default configuration targets production); a non-local address throws.
import { errors, expect, test, type APIRequestContext, type Page } from "@playwright/test";

const LOCAL_SITE = /^http:\/\/(?:localhost|127\.0\.0\.1):\d{2,5}\/?$/;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL;
if (BASE_URL !== undefined && !LOCAL_SITE.test(BASE_URL)) {
  throw new Error(
    `seo-status.spec.ts : PLAYWRIGHT_BASE_URL doit être http://localhost:<port> (reçu « ${BASE_URL} »). Jamais la production.`
  );
}
test.skip(BASE_URL === undefined, "PLAYWRIGHT_BASE_URL absent : contrôles SEO non lancés.");
test.beforeEach(() => {
  test.skip(test.info().project.name !== "chromium", "Contrôles HTTP : projet chromium seulement.");
});

const NOT_FOUND = [
  "/boutique/does-not-exist",
  "/recettes/does-not-exist",
  "/boucherie-halal/does-not-exist",
  "/produits/merguez-halal/does-not-exist",
  "/occasions/does-not-exist/lyon",
];

// Business-critical pages: indexed even without any shop (rule OR of the seo-anti-penalty skill).
const INDEXED = [
  "/",
  "/boucherie-halal/chambery",
  "/boucherie-halal/lyon",
  "/boucherie-halal/aix-les-bains",
  "/boucheries-halal/savoie",
  "/occasions/aid-al-adha/chambery",
  "/devenir-boucher-partenaire/chambery",
];

// Pages that list shops or talk about a city, a product or an occasion: no shop entity, no
// rating, no Product, no Event (D2, FIX-04, FIX-08).
const LIST_PAGES = [
  ...INDEXED,
  "/boucherie-halal/lyon/la-guillotiere",
  "/boucheries-halal-rhone-alpes",
  "/boucheries-halal-ouvertes-dimanche/chambery",
  "/produits/merguez-halal/chambery",
];

const SEEDED_SHOP = "/boutique/el-mektoub";
const SITEMAP_CITIES = INDEXED.filter((path) => path.startsWith("/boucherie-halal/"));

const SHOP_TYPES = new Set(["Store", "LocalBusiness", "FoodEstablishment"]);
const RATING_TYPES = ["AggregateRating", "Review"];
const OFFER_TYPES = ["Product", "Offer", "AggregateOffer"];
const LIST_FORBIDDEN_TYPES = new Set([...SHOP_TYPES, ...RATING_TYPES, ...OFFER_TYPES]);
const NOWHERE_TYPES = new Set(["SearchAction", "SpeakableSpecification"]);
const NOWHERE_KEYS = ["speakable", "shippingDetails", "hasMerchantReturnPolicy", "priceValidUntil"];

type Html = { status: number; html: string; xRobotsTag: string | null };
type Entity = Record<string, unknown>;

async function get(request: APIRequestContext, path: string): Promise<Html> {
  const response = await request.get(path, { maxRedirects: 0 });
  return {
    status: response.status(),
    html: await response.text(),
    xRobotsTag: response.headers()["x-robots-tag"] ?? null,
  };
}

async function getPage(request: APIRequestContext, path: string): Promise<Html> {
  const page = await get(request, path);
  expect(page.status, `${path} : statut HTTP`).toBe(200);
  return page;
}

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, "i").exec(tag);
  return match ? match[1] : null;
}

/** Directives of every robots and googlebot meta tag, plus the X-Robots-Tag header. */
function robotsDirectives(page: Html): string[] {
  const contents = (page.html.match(/<meta\b[^>]*>/gi) ?? [])
    .filter((tag) => /^(?:robots|googlebot)$/i.test(attribute(tag, "name") ?? ""))
    .map((tag) => attribute(tag, "content") ?? "");
  if (page.xRobotsTag !== null) contents.push(page.xRobotsTag);
  return contents.flatMap((content) => content.split(",").map((part) => part.trim().toLowerCase()));
}

function titleOf(page: Html): string {
  return /<title[^>]*>([\s\S]*?)<\/title>/i.exec(page.html)?.[1].replace(/&amp;/g, "&") ?? "";
}

function jsonLd(page: Html): unknown[] {
  const blocks = page.html.matchAll(
    /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  );
  return [...blocks].map((block) => JSON.parse(block[1]) as unknown);
}

function isEntity(value: unknown): value is Entity {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Every object of the JSON-LD, nested ones included. */
function objectsOf(value: unknown): Entity[] {
  if (Array.isArray(value)) return value.flatMap(objectsOf);
  if (!isEntity(value)) return [];
  return [value, ...Object.values(value).flatMap(objectsOf)];
}

function typesOf(entity: Entity): string[] {
  const type = entity["@type"];
  if (typeof type === "string") return [type];
  return Array.isArray(type) ? type.filter((t): t is string => typeof t === "string") : [];
}

function offerPrice(product: Entity): unknown {
  const offers = isEntity(product.offers) ? product.offers : {};
  const specification = isEntity(offers.priceSpecification) ? offers.priceSpecification : {};
  return offers.price ?? specification.price;
}

function crumbPaths(page: Html): string[] {
  return objectsOf(jsonLd(page))
    .filter((entity) => typesOf(entity).includes("BreadcrumbList"))
    .flatMap((list) => (Array.isArray(list.itemListElement) ? list.itemListElement : []))
    .filter(isEntity)
    .map((item) => new URL(String(item.item)).pathname);
}

function expectNothingUnbacked(objects: Entity[], path: string): void {
  for (const entity of objects) {
    for (const type of typesOf(entity)) {
      expect(NOWHERE_TYPES.has(type) || /Event$/.test(type), `${path} : @type ${type}`).toBe(false);
    }
    for (const key of NOWHERE_KEYS) expect(entity, `${path} : ${key}`).not.toHaveProperty(key);
  }
}

test.describe("page absente : vrai 404", () => {
  for (const path of NOT_FOUND) {
    test(`${path} répond 404`, async ({ request }) => {
      expect((await get(request, path)).status).toBe(404);
    });
  }
});

test.describe("pages clés : 200, index, follow", () => {
  for (const path of INDEXED) {
    test(`${path} est indexable`, async ({ request }) => {
      const page = await getPage(request, path);
      const directives = robotsDirectives(page);
      expect(directives, "aucune directive noindex ou nofollow").not.toContain("noindex");
      expect(directives).not.toContain("nofollow");
      expect(directives).toEqual(expect.arrayContaining(["index", "follow"]));
      expect(titleOf(page)).not.toMatch(/halal\s+halal/i);
    });
  }
});

test.describe("pages privées : noindex", () => {
  const expectNoindex = (page: Html): void => {
    const directives = robotsDirectives(page);
    expect(directives).toContain("noindex");
    expect(directives, "aucune balise ne dit « index »").not.toContain("index");
  };

  for (const path of ["/sign-in", "/sign-up"]) {
    test(`${path} répond noindex`, async ({ request }) => {
      expectNoindex(await getPage(request, path));
    });
  }

  const secret = process.env.E2E_TEST_SECRET;
  for (const [path, role] of [
    ["/shop/offers", "BOUCHER"],
    ["/commande/x", "CLIENT"],
  ] as const) {
    test(`${path} répond noindex (session de test ${role})`, async ({ request }) => {
      test.skip(!secret, "E2E_TEST_SECRET absent : session de test impossible.");
      const activated = await request.post("/api/test-mode/activate", { data: { secret, role } });
      expect(activated.status(), "activation du mode test").toBe(200);
      expectNoindex(await getPage(request, path));
    });
  }
});

test.describe("données structurées", () => {
  for (const path of LIST_PAGES) {
    test(`${path} : ni boutique, ni note, ni Product, ni Event`, async ({ request }) => {
      const objects = objectsOf(jsonLd(await getPage(request, path)));
      expect(objects.length, "au moins un bloc JSON-LD").toBeGreaterThan(0);
      for (const entity of objects) {
        for (const type of typesOf(entity)) {
          expect(LIST_FORBIDDEN_TYPES.has(type), `@type ${type}`).toBe(false);
        }
        expect(entity).not.toHaveProperty("aggregateRating");
        expect(entity).not.toHaveProperty("review");
      }
      expectNothingUnbacked(objects, path);
    });
  }

  test(`${SEEDED_SHOP} : une boutique sans note inventée, des produits exacts`, async ({
    request,
  }) => {
    const objects = objectsOf(jsonLd(await getPage(request, SEEDED_SHOP)));
    const shops = objects.filter((entity) => typesOf(entity).some((type) => SHOP_TYPES.has(type)));
    expect(shops, "une seule entité boutique").toHaveLength(1);
    expect(shops[0], "aucun avis vérifié : pas de note").not.toHaveProperty("aggregateRating");
    expect(shops[0]).not.toHaveProperty("review");

    const products = objects.filter((entity) => typesOf(entity).includes("Product"));
    expect(products.length, "les produits du seed").toBeGreaterThan(0);
    for (const product of products) {
      expect(product).not.toHaveProperty("aggregateRating");
      expect(product).not.toHaveProperty("review");
      expect(offerPrice(product), `prix de « ${String(product.name)} »`).toBeDefined();
    }
    expectNothingUnbacked(objects, SEEDED_SHOP);
  });

  test("chaque élément des fils d'Ariane répond 200", async ({ request }) => {
    const crumbs = new Set<string>();
    for (const path of [...LIST_PAGES.filter((path) => path !== "/"), SEEDED_SHOP]) {
      const paths = crumbPaths(await getPage(request, path));
      expect(paths.length, `${path} : fil d'Ariane`).toBeGreaterThan(0);
      for (const crumb of paths) crumbs.add(crumb);
    }
    for (const crumb of crumbs) {
      expect((await get(request, crumb)).status, `élément ${crumb}`).toBe(200);
    }
  });
});

test("sitemap.xml : aucune boutique, les villes clés présentes", async ({ request }) => {
  const sitemap = await getPage(request, "/sitemap.xml");
  const paths = [...sitemap.html.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (loc) => new URL(loc[1].trim()).pathname
  );
  expect(paths.length).toBeGreaterThan(100);
  expect(paths.filter((path) => path === "/boutique" || path.startsWith("/boutique/"))).toEqual([]);
  expect(paths).toEqual(expect.arrayContaining(SITEMAP_CITIES));
});

const GEO_APIS = /^\/api\/(?:geo|shops\/nearby)(?:\/|$)/;

function isGeoCall(url: string, origin: string): boolean {
  const parsed = new URL(url);
  return parsed.origin === origin && GEO_APIS.test(parsed.pathname);
}

/** Geolocation calls during the load of « / » and the 3 seconds after it. */
async function geoCallsOnHome(page: Page, origin: string): Promise<string[]> {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (isGeoCall(request.url(), origin)) calls.push(new URL(request.url()).pathname);
  });
  await page.goto("/");
  await page
    .waitForRequest((request) => isGeoCall(request.url(), origin), { timeout: 3_000 })
    .catch((error: unknown) => {
      if (!(error instanceof errors.TimeoutError)) throw error;
    });
  return calls;
}

test.describe("accueil : aucun appel de géolocalisation au montage (visiteur anonyme)", () => {
  test("première visite", async ({ page, baseURL }) => {
    expect(await geoCallsOnHome(page, new URL(baseURL as string).origin)).toEqual([]);
  });

  // The position card loads the cached position without announcing it: only the GPS button or a
  // typed city sorts the list, and NearbyShops sorts from the cache for a signed-in visitor only.
  test("visiteur revenu avec une position mémorisée", async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      const chambery = { lat: 45.5646, lng: 5.9178, city: "Chambéry", ts: Date.now() };
      window.localStorage.setItem("klikgo-geo", JSON.stringify(chambery));
    });
    expect(await geoCallsOnHome(page, new URL(baseURL as string).origin)).toEqual([]);
  });
});
