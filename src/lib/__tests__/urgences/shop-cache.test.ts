// @vitest-environment node
// Cache Redis de la vitrine /boutique/[slug]. Une entrée relue doit rendre au code de la page les
// mêmes types que Prisma (Date, BigInt) : la page appelle toISOString() sur freshDate, promoEnd et
// antiGaspiEndAt, et plantait dès qu'Upstash était configuré, car l'entrée revenait avec des chaînes.
// Seul le client Redis est remplacé, par un magasin en mémoire qui sérialise et désérialise comme
// @upstash/redis 1.36 (chaîne écrite telle quelle, JSON.parse automatique à la lecture).
import { beforeEach, describe, expect, it, vi } from "vitest";
// Installe BigInt.prototype.toJSON (rendu en Number) comme dans le serveur de production : le cache
// doit conserver un BigInt au-delà de Number.MAX_SAFE_INTEGER malgré ce correctif global.
import "@/lib/api/errors";
import { logger } from "@/lib/logger";
import {
  decodeCachedShop,
  encodeCachedShop,
  readCachedShop,
  shopCacheKey,
  writeCachedShop,
} from "@/lib/cache/shop-cache";

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
  },
}));

const SLUG = "boucherie-du-test";

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
  monthlyGmvCents: bigint;
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
    // 2^53 + 1 : un passage par Number le rendrait 9007199254740992.
    monthlyGmvCents: BigInt("9007199254740993"),
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
  expect(shop).not.toBeNull();
  if (shop === null) return;
  const [product] = shop.products;
  expect(product.freshDate).toBeInstanceOf(Date);
  expect(product.antiGaspiEndAt).toBeInstanceOf(Date);
  expect(product.promoEnd).toBeInstanceOf(Date);
  expect(product.createdAt).toBeInstanceOf(Date);
  expect(shop.createdAt).toBeInstanceOf(Date);
  expect(product.images[0].createdAt).toBeInstanceOf(Date);
  // Forme exacte de l'ancien plantage de la page : toISOString() sur la valeur relue.
  expect(product.freshDate?.toISOString()).toBe("2026-11-14T05:30:00.000Z");
  expect(product.antiGaspiEndAt?.toISOString()).toBe("2026-11-15T18:00:00.000Z");
  expect(product.promoEnd?.toISOString()).toBe("2026-11-20T22:59:59.000Z");
  expect(product.createdAt.toISOString()).toBe("2026-03-04T10:15:00.000Z");
  expect(shop.createdAt.toISOString()).toBe("2026-01-02T08:00:00.000Z");
  expect(product.images[0].createdAt.toISOString()).toBe("2026-03-05T09:00:00.000Z");
  expect(typeof shop.monthlyGmvCents).toBe("bigint");
  expect(shop.monthlyGmvCents).toBe(BigInt("9007199254740993"));
  expect(shop.closedUntil).toBeNull();
  expect(product.cutOptions).toEqual({ note: "2026-11-14T05:30:00.000Z" });
  expect(shop.openingHours).toEqual({ lundi: { open: "08:00", close: "19:00" } });
}

beforeEach(() => {
  store.entries.clear();
  store.writes = [];
  store.automaticDeserialization = true;
  vi.restoreAllMocks();
});

describe("shopCacheKey", () => {
  it("préfixe la clé par la version du format : shop:v2:<slug>", () => {
    expect(shopCacheKey(SLUG)).toBe("shop:v2:boucherie-du-test");
  });
});

describe("writeCachedShop puis readCachedShop", () => {
  it("écrit sous la clé versionnée avec une expiration de 60 s", async () => {
    await writeCachedShop(SLUG, fixtureShop());

    expect(store.writes).toEqual([{ key: "shop:v2:boucherie-du-test", opts: { ex: 60 } }]);
    expect(store.entries.has("shop:boucherie-du-test")).toBe(false);
  });

  it("rend des Date et un BigInt quand Upstash a déjà analysé le JSON (comportement par défaut)", async () => {
    await writeCachedShop(SLUG, fixtureShop());

    expectPrismaTypes(await readCachedShop<FixtureShop>(SLUG));
  });

  it("rend des Date et un BigInt quand l'entrée revient sous forme de chaîne", async () => {
    store.automaticDeserialization = false;
    await writeCachedShop(SLUG, fixtureShop());

    expectPrismaTypes(await readCachedShop<FixtureShop>(SLUG));
  });

  it("rend null sans journaliser quand la clé est absente", async () => {
    const warn = vi.spyOn(logger, "warn");

    expect(await readCachedShop<FixtureShop>(SLUG)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });
});

function envelope(shop: unknown, version: unknown = 2): string {
  return JSON.stringify({ v: version, shop });
}

const validShopJson = {
  id: "shop_1",
  slug: SLUG,
  products: [{ id: "prod_1", freshDate: { $date: "2026-11-14T05:30:00.000Z" } }],
};

// Ce qu'écrivait l'ancienne page : JSON.stringify(shop), dates en chaînes, sans enveloppe.
const legacyShopJson = JSON.stringify({
  id: "shop_1",
  slug: SLUG,
  products: [{ id: "prod_1", freshDate: "2026-11-14T05:30:00.000Z" }],
});

describe("une entrée illisible est un défaut de cache", () => {
  it.each([
    ["ancien format (boutique nue, dates en chaînes)", legacyShopJson],
    ["JSON tronqué", '{"v":2,"shop":{"id":"shop_1"'],
    ["version 1", envelope(validShopJson, 1)],
    ["version absente", JSON.stringify({ shop: validShopJson })],
    ["autre boutique", envelope({ ...validShopJson, slug: "autre-boucherie" })],
    ["boutique sans products", envelope({ id: "shop_1", slug: SLUG })],
    ["products qui n'est pas un tableau", envelope({ ...validShopJson, products: {} })],
    ["produit sans id", envelope({ ...validShopJson, products: [{ name: "Merguez" }] })],
    ["boutique sans id", envelope({ slug: SLUG, products: [] })],
    ["shop qui est un tableau", envelope([validShopJson])],
    [
      "date illisible",
      envelope({
        ...validShopJson,
        products: [{ id: "prod_1", freshDate: { $date: "pas une date" } }],
      }),
    ],
    [
      "date qui n'est pas une chaîne",
      envelope({ ...validShopJson, products: [{ id: "prod_1", freshDate: { $date: 12 } }] }),
    ],
    ["BigInt illisible", envelope({ ...validShopJson, monthlyGmvCents: { $bigint: "12.5" } })],
    ["valeur scalaire", JSON.stringify("shop")],
  ])("%s → null et un seul avertissement qui ne cite que la clé", async (_label, text) => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    store.entries.set("shop:v2:boucherie-du-test", text);

    expect(await readCachedShop<FixtureShop>(SLUG)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("[shop-cache] entrée illisible ignorée", {
      key: "shop:v2:boucherie-du-test",
    });
  });
});

describe("encodeCachedShop / decodeCachedShop", () => {
  it("accepte la chaîne comme l'objet déjà analysé, pour le même slug seulement", () => {
    const text = encodeCachedShop(fixtureShop());

    expectPrismaTypes(decodeCachedShop<FixtureShop>(text, SLUG));
    expectPrismaTypes(decodeCachedShop<FixtureShop>(JSON.parse(text), SLUG));
    expect(decodeCachedShop<FixtureShop>(text, "autre-boucherie")).toBeNull();
  });

  it("rend null pour null, undefined et un nombre", () => {
    expect(decodeCachedShop(null, SLUG)).toBeNull();
    expect(decodeCachedShop(undefined, SLUG)).toBeNull();
    expect(decodeCachedShop(42, SLUG)).toBeNull();
  });
});
