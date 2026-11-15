// @vitest-environment node
// Copie Redis de la page /boutique/[slug] (src/app/(client)/boutique/[slug]/load-shop.ts), sur
// PostgreSQL réel. Redis (Upstash, frontière réseau) est remplacé par un faux en mémoire, qui ne
// lève jamais d'erreur, comme le wrapper src/lib/redis.ts ; React.cache par l'identité (il
// n'existe que sous la condition « react-server » de Next).
//
// Les entrées sont écrites et lues par src/lib/cache/shop-cache.ts seul. Une entrée illisible est
// un raté journalisé : la boutique est relue en base. La modération et les congés (début, fin par
// le boucher, fin par le cron) effacent la copie et le statut en cache : la page montre le
// changement aussitôt.
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
import { readCachedShop, writeCachedShop } from "@/lib/cache/shop-cache";
import { logger } from "@/lib/logger";
import { suspendShop } from "@/lib/services/shops/moderation";
import { endExpiredVacations, endVacationMode, setVacationMode } from "@/lib/shop-vacation";
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
    await loadPublicShop(shop.slug);
    for (const key of store.keys()) store.set(key, '{"id":"tronqu');
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    const loaded = await loadPublicShop(shop.slug);

    expect(loaded?.id).toBe(shop.id);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("shop-cache"), {
      key: expect.stringContaining(shop.slug),
    });
    expect(await readCachedShop(shop.slug)).toMatchObject({ id: shop.id, slug: shop.slug });
  });

  it("une entrée déjà décodée par Upstash est servie telle quelle, sans relire la base", async () => {
    const shop = await createTestShop();
    const fromDb = await loadPublicShop(shop.slug);
    if (fromDb === null) throw new Error("boutique de test introuvable");
    await writeCachedShop(shop.slug, { ...fromDb, name: "Nom en cache" });
    // Upstash rend le JSON déjà analysé.
    for (const [key, text] of store) store.set(key, JSON.parse(String(text)));

    expect((await loadPublicShop(shop.slug))?.name).toBe("Nom en cache");
  });

  it("une suspension par l'administration efface la copie : la page disparaît aussitôt", async () => {
    const shop = await createTestShop();
    expect((await loadPublicShop(shop.slug))?.id).toBe(shop.id);
    expect(await readCachedShop(shop.slug)).not.toBeNull();

    expect(await suspendShop(shop.id, "Contrôle sanitaire")).toEqual({ ok: true });

    expect(await readCachedShop(shop.slug)).toBeNull();
    expect(await loadPublicShop(shop.slug)).toBeNull();
  });
});

describe("congés : la copie de la page et le statut en cache sont effacés à chaque changement", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  type CachedShop = { id: string; slug: string };
  const cache = async (shop: CachedShop) => {
    await writeCachedShop(shop.slug, { id: shop.id, slug: shop.slug, products: [] });
    store.set(`shop:status:${shop.id}`, "OPEN");
  };
  const cachedEntriesOf = async (shop: CachedShop) => ({
    page: (await readCachedShop(shop.slug)) !== null,
    status: store.has(`shop:status:${shop.id}`),
  });
  const NONE = { page: false, status: false };
  const BOTH = { page: true, status: true };

  it("début et fin des congés par le boucher", async () => {
    const shop = await createTestShop();
    const start = new Date();
    const end = new Date(start.getTime() + 7 * DAY_MS);

    await cache(shop);
    expect(await setVacationMode(shop.id, { start, end })).toEqual({ ok: true });
    expect(await cachedEntriesOf(shop)).toEqual(NONE);

    await cache(shop);
    expect(await endVacationMode(shop.id)).toEqual({ ok: true });
    expect(await cachedEntriesOf(shop)).toEqual(NONE);
  });

  it("fin des congés par le cron, pour chaque boutique remise en ligne", async () => {
    const ended = new Date(Date.UTC(2026, 10, 1));
    const first = await createTestShop({ visible: false, vacationMode: true, vacationEnd: ended });
    const second = await createTestShop({ visible: false, vacationMode: true, vacationEnd: ended });
    const untouched = await createTestShop();
    for (const shop of [first, second, untouched]) await cache(shop);

    expect(await endExpiredVacations(new Date(Date.UTC(2026, 10, 2)))).toBe(2);
    expect(await cachedEntriesOf(first)).toEqual(NONE);
    expect(await cachedEntriesOf(second)).toEqual(NONE);
    expect(await cachedEntriesOf(untouched)).toEqual(BOTH);
  });

  it("un refus ne touche à aucune entrée", async () => {
    const shop = await createTestShop({ visible: false });
    await cache(shop);

    expect(await endVacationMode(shop.id)).toEqual({ ok: false, reason: "NOT_ON_VACATION" });
    expect(await cachedEntriesOf(shop)).toEqual(BOTH);
  });
});
