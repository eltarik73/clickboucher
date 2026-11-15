// @vitest-environment node
// Cache Redis de la vitrine /boutique/[slug], par ses seules fonctions publiques. Une entrée relue
// rend au code de la page les mêmes types que Prisma : la page appelle toISOString() sur freshDate,
// promoEnd et antiGaspiEndAt. Seul le client Redis est remplacé, par un magasin en mémoire qui
// sérialise et désérialise comme @upstash/redis 1.36 (chaîne écrite telle quelle, JSON.parse
// automatique à la lecture).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/logger";
import { invalidateCachedShop, readCachedShop, writeCachedShop } from "@/lib/cache/shop-cache";

const store = vi.hoisted(() => ({
  entries: new Map<string, string>(),
  writes: [] as Array<{ key: string; opts: unknown }>,
  // @upstash/redis désérialise par défaut ; false reproduit automaticDeserialization: false.
  automaticDeserialization: true,
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    async get(key: string): Promise<unknown> {
      const text = store.entries.get(key);
      if (text === undefined) return null;
      if (!store.automaticDeserialization) return text;
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    },
    async set(key: string, value: unknown, opts?: { ex?: number }): Promise<void> {
      store.entries.set(key, typeof value === "string" ? value : JSON.stringify(value));
      store.writes.push({ key, opts });
    },
    async del(key: string): Promise<void> {
      store.entries.delete(key);
    },
  },
}));

const SLUG = "boucherie-du-test";
const KEY = "shop:v3:boucherie-du-test";

interface FixtureProduct {
  id: string;
  name: string;
  freshDate: Date | null;
  antiGaspiEndAt: Date | null;
  promoEnd: Date | null;
  createdAt: Date;
  cutOptions: unknown;
  images: Array<{ id: string; createdAt: Date }>;
}

interface FixtureShop {
  id: string;
  slug: string;
  name: string;
  createdAt: Date;
  closedUntil: Date | null;
  openingHours: unknown;
  products: FixtureProduct[];
}

function fixtureShop(): FixtureShop {
  return {
    id: "shop_1",
    slug: SLUG,
    name: "Boucherie du Test",
    createdAt: new Date("2026-01-02T08:00:00.000Z"),
    closedUntil: null,
    openingHours: { lundi: { open: "08:00", close: "19:00" } },
    products: [
      {
        id: "prod_1",
        name: "Merguez",
        freshDate: new Date("2026-11-14T05:30:00.000Z"),
        antiGaspiEndAt: new Date("2026-11-15T18:00:00.000Z"),
        promoEnd: new Date("2026-11-20T22:59:59.000Z"),
        createdAt: new Date("2026-03-04T10:15:00.000Z"),
        // Colonne Json : une chaîne qui ressemble à une date reste une chaîne.
        cutOptions: { note: "2026-11-14T05:30:00.000Z" },
        images: [{ id: "img_1", createdAt: new Date("2026-03-05T09:00:00.000Z") }],
      },
    ],
  };
}

function expectPrismaTypes(shop: FixtureShop | null): void {
  expect(shop).toEqual(fixtureShop());
  const [product] = shop?.products ?? [];
  expect(product.freshDate).toBeInstanceOf(Date);
  // Forme exacte de l'ancien plantage de la page : toISOString() sur la valeur relue.
  expect(product.antiGaspiEndAt?.toISOString()).toBe("2026-11-15T18:00:00.000Z");
  expect(product.images[0].createdAt.toISOString()).toBe("2026-03-05T09:00:00.000Z");
}

beforeEach(() => {
  store.entries.clear();
  store.writes = [];
  store.automaticDeserialization = true;
  vi.restoreAllMocks();
});

describe("writeCachedShop puis readCachedShop", () => {
  it("écrit sous la clé versionnée avec une expiration de 60 s", async () => {
    await writeCachedShop(SLUG, fixtureShop());

    expect(store.writes).toEqual([{ key: KEY, opts: { ex: 60 } }]);
  });

  it("rend les Date quand Upstash a déjà analysé le JSON (comportement par défaut)", async () => {
    await writeCachedShop(SLUG, fixtureShop());

    expectPrismaTypes(await readCachedShop<FixtureShop>(SLUG));
  });

  it("rend les Date quand l'entrée revient sous forme de chaîne", async () => {
    store.automaticDeserialization = false;
    await writeCachedShop(SLUG, fixtureShop());

    expectPrismaTypes(await readCachedShop<FixtureShop>(SLUG));
  });

  it("rend null sans journaliser quand la clé est absente", async () => {
    const warn = vi.spyOn(logger, "warn");

    expect(await readCachedShop<FixtureShop>(SLUG)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("ne lit jamais l'entrée d'une version précédente", async () => {
    const warn = vi.spyOn(logger, "warn");
    store.entries.set("shop:v2:boucherie-du-test", JSON.stringify({ v: 2, shop: fixtureShop() }));

    expect(await readCachedShop<FixtureShop>(SLUG)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("invalidateCachedShop efface l'entrée", async () => {
    await writeCachedShop(SLUG, fixtureShop());

    await invalidateCachedShop(SLUG);

    expect(await readCachedShop<FixtureShop>(SLUG)).toBeNull();
  });
});

const validShop = { id: "shop_1", slug: SLUG, products: [{ id: "prod_1" }] };

describe("une entrée illisible est un défaut de cache", () => {
  it.each([
    ["JSON tronqué", '{"id":"shop_1"'],
    ["autre boutique", JSON.stringify({ ...validShop, slug: "autre-boucherie" })],
    ["boutique sans products", JSON.stringify({ id: "shop_1", slug: SLUG })],
    ["products qui n'est pas un tableau", JSON.stringify({ ...validShop, products: {} })],
    ["produit sans id", JSON.stringify({ ...validShop, products: [{ name: "Merguez" }] })],
    ["boutique sans id", JSON.stringify({ slug: SLUG, products: [] })],
    ["boutique qui est un tableau", JSON.stringify([validShop])],
    [
      "date illisible",
      JSON.stringify({ ...validShop, products: [{ id: "prod_1", freshDate: { $date: "x" } }] }),
    ],
    ["valeur scalaire", JSON.stringify("shop")],
  ])("%s → null et un seul avertissement qui ne cite que la clé", async (_label, text) => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    store.entries.set(KEY, text);

    expect(await readCachedShop<FixtureShop>(SLUG)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("[shop-cache] unreadable entry ignored", { key: KEY });
  });
});
