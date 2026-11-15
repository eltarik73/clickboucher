// @vitest-environment node
// Copie Redis de la page /boutique/[slug] (src/app/(client)/boutique/[slug]/load-shop.ts), sur
// PostgreSQL réel. Redis (Upstash, frontière réseau) est remplacé par un faux en mémoire, qui ne
// lève jamais d'erreur, comme le wrapper src/lib/redis.ts ; React.cache par l'identité (il
// n'existe que sous la condition « react-server » de Next).
//
// Avant : une entrée illisible était avalée par un `catch {}` vide, sans trace. Désormais c'est un
// raté explicite : la boutique est relue en base et l'incident est journalisé.
import { afterEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => new Map<string, unknown>());
vi.mock("@/lib/redis", () => ({
  redis: {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: unknown) => {
      store.set(key, value);
    },
    del: async (key: string) => {
      store.delete(key);
    },
  },
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

import { loadPublicShop } from "@/app/(client)/boutique/[slug]/load-shop";
import { useCleanDatabase } from "../helpers/db";
import { createTestShop } from "../helpers/factories";

// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React
useCleanDatabase();

afterEach(() => {
  store.clear();
  vi.restoreAllMocks();
});

describe("copie Redis de la page boutique", () => {
  it("une entrée illisible est un raté : boutique relue en base, incident journalisé, copie refaite", async () => {
    const shop = await createTestShop();
    const key = `shop:${shop.slug}`;
    store.set(key, '{"id":"tronqu');
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const loaded = await loadPublicShop(shop.slug);

    expect(loaded?.id).toBe(shop.id);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("Redis");
    expect(warn.mock.calls[0][1]).toMatchObject({ cacheKey: key });
    expect(JSON.parse(String(store.get(key)))).toMatchObject({ id: shop.id, slug: shop.slug });
  });

  it("une entrée déjà décodée par Upstash est servie telle quelle, sans relire la base", async () => {
    const shop = await createTestShop();
    const fromDb = await loadPublicShop(shop.slug);
    store.set(`shop:${shop.slug}`, { ...fromDb, name: "Nom en cache" });

    expect((await loadPublicShop(shop.slug))?.name).toBe("Nom en cache");
  });
});
