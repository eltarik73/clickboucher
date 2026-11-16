// @vitest-environment node
// applyRepairs et purgeImage (scripts/images/lib/maintenance.ts) sur la vraie base : copie dans notre
// stockage puis compare-and-swap, mise à NULL, ligne modifiée depuis le recensement laissée
// intacte, journal, échecs d'une source ; effacement d'une image refusé tant qu'elle est utilisée.
// Seuls le stockage (en mémoire) et le téléchargement des sources sont simulés.
import { beforeEach, describe, expect, it } from "vitest";
import { imageBlobHost } from "@/lib/images/durable-url";
import { thumbnailOf } from "@/lib/images/thumbnail";
import { runImageCensus } from "../../../scripts/images/lib/census";
import {
  applyRepairs,
  planPurge,
  purgeImage,
  PurgeRefusedError,
  type RepairJournalEntry,
} from "../../../scripts/images/lib/maintenance";
import { planRepairs, type ProbeResult } from "../../../scripts/images/lib/repair-plan";
import { makeHtmlDeclaredJpeg, makeJpeg } from "../../fixtures/images/make-fixtures";
import { MemoryImageStore } from "../../fixtures/images/memory-store";
import { UNSPLASH_DEAD_PHOTO, UNSPLASH_PRODUCTS } from "../../fixtures/images/unsplash-pattern";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestProduct, createTestShop } from "../helpers/factories";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const LIVE = UNSPLASH_PRODUCTS["Steak de bœuf"];
const HTML_SOURCE = "https://images.pexels.com/photos/1/page.jpeg";
const DOWN_SOURCE = "https://images.pexels.com/photos/2/down.jpeg";
const NOW = new Date("2026-11-20T09:00:00.000Z");

let store: MemoryImageStore;
let journal: RepairJournalEntry[];
let jpeg: Buffer;

beforeEach(async () => {
  store = new MemoryImageStore();
  journal = [];
  jpeg ??= await makeJpeg({ width: 800, height: 600 });
});

function probes(alive: string[], gone: string[] = []): Map<string, ProbeResult> {
  const results: ProbeResult[] = [
    ...alive.map((url) => ({ url, alive: true, status: 200, contentType: "image/jpeg" })),
    ...gone.map((url) => ({ url, alive: false, status: 404, contentType: "text/html" })),
  ];
  return new Map(results.map((probe) => [probe.url, probe]));
}

async function fetchSource(url: string): Promise<Uint8Array> {
  if (url === HTML_SOURCE) return makeHtmlDeclaredJpeg();
  if (url === DOWN_SOURCE) throw new Error("délai dépassé");
  return jpeg;
}

async function planAndApply(
  probeMap: Map<string, ProbeResult>,
  beforeApply?: () => Promise<unknown>
) {
  const { rows } = await runImageCensus(prisma);
  const actions = planRepairs(rows, probeMap, { localFileExists: () => true });
  await beforeApply?.();
  const summary = await applyRepairs(actions, {
    store,
    fetchSource,
    journal: (entry) => journal.push(entry),
    now: () => NOW,
  });
  return { actions, summary };
}

describe("applyRepairs", () => {
  it("copie une source par boutique, remplace produit et photo du produit, enregistre REPAIR et journalise", async () => {
    const shopA = await createTestShop();
    const shopB = await createTestShop();
    const a = await createTestProduct(shopA.id, { name: "Steak de bœuf", imageUrl: LIVE });
    const image = await prisma.productImage.create({
      data: { productId: a.id, url: LIVE, isPrimary: true },
    });
    const b = await createTestProduct(shopB.id, { name: "Steak de bœuf", imageUrl: LIVE });

    const { summary } = await planAndApply(probes([LIVE]));

    expect(summary).toEqual({
      copied: 3,
      nulled: 0,
      skippedChanged: 0,
      untouched: 0,
      failures: [],
    });
    const copies = await prisma.generatedImage.findMany({ orderBy: { createdAt: "asc" } });
    expect(copies).toHaveLength(2);
    for (const copy of copies) {
      expect(copy).toMatchObject({
        model: "REPAIR",
        prompt: "",
        usage: "PRODUCT",
        createdBy: "repair",
      });
      expect(copy.imageUrl).toMatch(
        new RegExp(`^https://${imageBlobHost()}/shops/${copy.shopId}/repair/[0-9a-f-]{36}\\.webp$`)
      );
      expect(store.files.has(copy.imageUrl)).toBe(true);
      expect(store.files.has(thumbnailOf(copy.imageUrl) as string)).toBe(true);
    }
    const copyOf = (shopId: string) => copies.find((copy) => copy.shopId === shopId)?.imageUrl;

    expect((await prisma.product.findUniqueOrThrow({ where: { id: a.id } })).imageUrl).toBe(
      copyOf(shopA.id)
    );
    expect((await prisma.productImage.findUniqueOrThrow({ where: { id: image.id } })).url).toBe(
      copyOf(shopA.id)
    );
    expect((await prisma.product.findUniqueOrThrow({ where: { id: b.id } })).imageUrl).toBe(
      copyOf(shopB.id)
    );

    expect(journal).toHaveLength(3);
    expect(journal).toContainEqual({
      at: NOW.toISOString(),
      table: "product_images",
      column: "url",
      id: image.id,
      old: LIVE,
      new: copyOf(shopA.id),
      action: "copied",
    });
  });

  it("une source morte : NULL sur Product.imageUrl, photo de produit laissée pour décision", async () => {
    const shop = await createTestShop();
    const product = await createTestProduct(shop.id, {
      name: "Escalope de dinde",
      imageUrl: UNSPLASH_DEAD_PHOTO,
    });
    const image = await prisma.productImage.create({
      data: { productId: product.id, url: UNSPLASH_DEAD_PHOTO },
    });

    const { summary } = await planAndApply(probes([], [UNSPLASH_DEAD_PHOTO]));

    expect(summary).toMatchObject({ copied: 0, nulled: 1, untouched: 1 });
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).imageUrl
    ).toBeNull();
    expect((await prisma.productImage.findUniqueOrThrow({ where: { id: image.id } })).url).toBe(
      UNSPLASH_DEAD_PHOTO
    );
    expect(journal).toEqual([
      expect.objectContaining({
        table: "products",
        id: product.id,
        old: UNSPLASH_DEAD_PHOTO,
        new: null,
        action: "nulled",
      }),
    ]);
    expect(store.puts).toHaveLength(0);
  });

  it("une ligne modifiée depuis le recensement n'est pas touchée ; la copie devenue inutile est retirée", async () => {
    const shop = await createTestShop();
    const copied = await createTestProduct(shop.id, { imageUrl: LIVE });
    const dead = await createTestProduct(shop.id, { imageUrl: UNSPLASH_DEAD_PHOTO });

    const { summary } = await planAndApply(probes([LIVE], [UNSPLASH_DEAD_PHOTO]), () =>
      prisma.product.updateMany({
        where: { id: { in: [copied.id, dead.id] } },
        data: { imageUrl: "/img/products/rumsteak.jpg" },
      })
    );

    expect(summary).toMatchObject({ copied: 0, nulled: 0, skippedChanged: 2 });
    const after = await prisma.product.findMany({
      where: { shopId: shop.id },
      select: { imageUrl: true },
    });
    expect(after.map((row) => row.imageUrl)).toEqual([
      "/img/products/rumsteak.jpg",
      "/img/products/rumsteak.jpg",
    ]);
    expect(journal.map((entry) => entry.action)).toEqual(["skipped-changed", "skipped-changed"]);
    expect(await prisma.generatedImage.count()).toBe(0);
    expect(store.puts).toHaveLength(2);
    expect([...store.dels].sort()).toEqual(store.puts.map((put) => put.url).sort());
  });

  it("une source qui ne répond pas ou n'est pas une image : rien d'écrit, l'échec est rendu en français", async () => {
    const shop = await createTestShop();
    const down = await createTestProduct(shop.id, { imageUrl: DOWN_SOURCE });
    const html = await createTestProduct(shop.id, { imageUrl: HTML_SOURCE });

    const { summary } = await planAndApply(probes([DOWN_SOURCE, HTML_SOURCE]));

    expect(summary.failures).toEqual([
      { source: DOWN_SOURCE, rows: 1, messageFr: "téléchargement impossible : délai dépassé" },
      {
        source: HTML_SOURCE,
        rows: 1,
        messageFr: expect.stringContaining("Format non pris en charge"),
      },
    ]);
    expect(summary.copied).toBe(0);
    expect(store.puts).toHaveLength(0);
    expect(await prisma.generatedImage.count()).toBe(0);
    const values = await prisma.product.findMany({
      where: { id: { in: [down.id, html.id] } },
      select: { imageUrl: true },
    });
    expect(values.map((row) => row.imageUrl).sort()).toEqual([DOWN_SOURCE, HTML_SOURCE].sort());
    expect(journal).toEqual([]);
  });

  it("les valeurs durables et les décisions ne sont jamais écrites", async () => {
    const shop = await createTestShop();
    await createTestProduct(shop.id, { imageUrl: "/img/products/rumsteak.jpg" });
    await createTestProduct(shop.id, { imageUrl: "data:image/png;base64,AAAA" });

    const { summary } = await planAndApply(probes([]));

    expect(summary).toEqual({
      copied: 0,
      nulled: 0,
      skippedChanged: 0,
      untouched: 2,
      failures: [],
    });
    expect(journal).toEqual([]);
  });
});

describe("purgeImage", () => {
  async function storedImage(shopId: string) {
    const url = `https://${imageBlobHost()}/shops/${shopId}/product/0f8c2a8e-4b1d-4c3e-9a5f-1d2e3f4a5b6c.webp`;
    store.seed(url);
    store.seed(thumbnailOf(url) as string);
    await prisma.generatedImage.create({
      data: {
        model: "UPLOAD",
        prompt: "",
        usage: "PRODUCT",
        imageUrl: url,
        shopId,
        createdBy: "u",
      },
    });
    return url;
  }

  it("refuse tant qu'une colonne utilise l'image ou sa vignette, et ne touche à rien", async () => {
    const shop = await createTestShop();
    const url = await storedImage(shop.id);
    await createTestProduct(shop.id, { imageUrl: thumbnailOf(url) });

    const plan = await planPurge(url);
    expect(plan).toMatchObject({ files: [url, thumbnailOf(url)], registryRows: 1 });
    expect(plan.refusal).toContain("encore utilisée par 1 ligne");
    await expect(purgeImage(url, store)).rejects.toBeInstanceOf(PurgeRefusedError);
    expect(store.dels).toEqual([]);
    expect(await prisma.generatedImage.count()).toBe(1);
  });

  it("efface la photo, sa vignette et la ligne du registre quand plus rien ne l'utilise", async () => {
    const shop = await createTestShop();
    const url = await storedImage(shop.id);

    await expect(purgeImage(url, store)).resolves.toEqual({
      files: [url, thumbnailOf(url)],
      deletedRows: 1,
    });
    expect(store.files.size).toBe(0);
    expect(await prisma.generatedImage.count()).toBe(0);
  });

  it("refuse une adresse hors de notre stockage", async () => {
    const plan = await planPurge(LIVE);
    expect(plan.refusal).toContain("pas un fichier de notre stockage");
    await expect(purgeImage(LIVE, store)).rejects.toBeInstanceOf(PurgeRefusedError);
  });
});
