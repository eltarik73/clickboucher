// @vitest-environment node
// scripts/images/backfill-image-url.sql states the photo-ranking rule in SQL for stored rows. Its
// candidate query, run as written on real PostgreSQL, must pick the photo rankProductPhotos picks.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rankProductPhotos } from "@/lib/images/rank";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestProduct, createTestShop } from "../helpers/factories";
import { storeUrl } from "./product-routes-harness";

// eslint-disable-next-line react-hooks/rules-of-hooks -- not a React hook
useCleanDatabase();

const SCRIPT = readFileSync(
  path.resolve(__dirname, "../../../scripts/images/backfill-image-url.sql"),
  "utf8"
);
/** The SELECT that fills the script's journal: the products to update and their new image_url. */
const CANDIDATES = SCRIPT.match(
  /CREATE TEMP TABLE backfill_image_url_journal ON COMMIT DROP AS\n([^;]+);/
)?.[1];

const at = (minute: number) => new Date(Date.UTC(2026, 10, 1, 9, minute));

describe("backfill-image-url.sql and rankProductPhotos", () => {
  it.each<[string, { order: number; isPrimary: boolean }[]]>([
    [
      "flagged photo second",
      [
        { order: 0, isPrimary: false },
        { order: 1, isPrimary: true },
      ],
    ],
    [
      "no flag, stored out of order",
      [
        { order: 2, isPrimary: false },
        { order: 0, isPrimary: false },
        { order: 1, isPrimary: false },
      ],
    ],
    [
      "no flag, same order",
      [
        { order: 0, isPrimary: false },
        { order: 0, isPrimary: false },
      ],
    ],
    [
      "two flags",
      [
        { order: 3, isPrimary: true },
        { order: 1, isPrimary: true },
        { order: 0, isPrimary: false },
      ],
    ],
  ])("%s: the script copies the URL rankProductPhotos picks", async (_case, photos) => {
    if (CANDIDATES === undefined) throw new Error("Candidate query not found in the script");
    const shop = await createTestShop();
    const create = photos.map((photo, minute) => ({
      ...photo,
      url: storeUrl(`shops/${shop.id}/product`),
      createdAt: at(minute),
    }));
    const product = await createTestProduct(shop.id, { imageUrl: null, images: { create } });

    const picked = await prisma.$queryRawUnsafe<{ id: string; new_url: string }[]>(CANDIDATES);

    // Insertion order: rankProductPhotos sorts by order itself, ties by position like the script.
    const images = await prisma.productImage.findMany({
      where: { productId: product.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { url: true, order: true, isPrimary: true },
    });
    expect(picked.map((row) => [row.id, row.new_url])).toEqual([
      [product.id, rankProductPhotos(images).primary?.url],
    ]);
  });
});
