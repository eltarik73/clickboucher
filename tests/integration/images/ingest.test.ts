// @vitest-environment node
// persistImage (src/lib/images/ingest.ts) on real PostgreSQL: the registry row written last, with
// every column, beside the photo and its thumbnail; and when that insert fails, both files are
// deleted and the database error comes back. Only the storage transport is in memory.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { persistImage, type PersistImageInput } from "@/lib/images/ingest";
import { thumbnailOf } from "@/lib/images/thumbnail";
import { UPLOAD_MAX_BYTES } from "@/lib/images/upload-contract";
import { makeJpeg } from "../../fixtures/images/make-fixtures";
import { MemoryImageStore } from "../../fixtures/images/memory-store";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestShop } from "../helpers/factories";

// eslint-disable-next-line react-hooks/rules-of-hooks -- not a React hook
useCleanDatabase();

function input(shopId: string, bytes: Uint8Array): PersistImageInput {
  return {
    bytes,
    owner: { shopId, createdBy: "user_boucher_1" },
    registry: { model: "UPLOAD", prompt: "", usage: "PRODUCT", metadata: { source: "itest" } },
    maxBytes: UPLOAD_MAX_BYTES,
    folder: "product",
  };
}

describe("persistImage — registry row", () => {
  it("the photo, then its thumbnail, are stored, then the row with every column", async () => {
    const shop = await createTestShop();
    const store = new MemoryImageStore();

    const result = await persistImage(
      input(shop.id, await makeJpeg({ width: 4032, height: 3024 })),
      store
    );

    expect(result.url).toMatch(new RegExp(`/shops/${shop.id}/product/[0-9a-f-]{36}\\.webp$`));
    expect(result.thumbUrl).toBe(thumbnailOf(result.url));
    expect(store.puts.map((put) => [put.url, put.contentType])).toEqual([
      [result.url, "image/webp"],
      [result.thumbUrl, "image/webp"],
    ]);

    const row = await prisma.generatedImage.findUniqueOrThrow({ where: { id: result.id } });
    expect(row).toMatchObject({
      model: "UPLOAD",
      prompt: "",
      usage: "PRODUCT",
      metadata: { source: "itest" },
      imageUrl: result.url,
      width: 2048,
      height: 1536,
      shopId: shop.id,
      createdBy: "user_boucher_1",
    });
    expect([result.width, result.height]).toEqual([2048, 1536]);
  });

  it("the insert fails (unknown shop): both files deleted, the database error comes back, no row", async () => {
    const store = new MemoryImageStore();

    const error = await persistImage(
      input("unknown-shop", await makeJpeg({ width: 800, height: 600 })),
      store
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(error).toMatchObject({ code: "P2003" });
    expect(store.puts).toHaveLength(2);
    expect(store.dels).toEqual(store.puts.map((put) => put.url));
    expect(store.files.size).toBe(0);
    expect(await prisma.generatedImage.count()).toBe(0);
  });
});
