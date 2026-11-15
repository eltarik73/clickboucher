// @vitest-environment node
// runImageCensus (scripts/images/lib/census.ts) sur la vraie base : comptes exacts par table, colonne
// et catégorie (NULL compris), lignes portant le nom du produit et le slug de la boutique, lecture
// par lots au-delà de 1 000 valeurs. Les lignes sont plantées avec les fabriques : le motif de
// production (64 photos Unsplash sur 8 boutiques, plus une ligne non publiée d'un autre nom), deux
// photos de notre Blob, un lien Replicate, une image data:, un ancien chemin /api/uploads, des NULL.
import { describe, expect, it } from "vitest";
import { imageBlobHost } from "@/lib/images/durable-url";
import { runImageCensus, type CensusCount } from "../../../scripts/images/lib/census";
import { UNSPLASH_PRODUCTS, UNSPLASH_PRODUCT_NAMES } from "../../fixtures/images/unsplash-pattern";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestOffer, createTestProduct, createTestShop } from "../helpers/factories";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const BLOB = (name: string) => `https://${imageBlobHost()}/products/${name}.webp`;
const UNPUBLISHED_NAME = "Merguez maison";

async function plantProductionPattern() {
  const shops = [];
  for (let i = 0; i < 9; i += 1) shops.push(await createTestShop());
  await prisma.shop.update({
    where: { id: shops[0].id },
    data: { imageUrl: "/img/shops/shop-3.jpg" },
  });

  for (const shop of shops.slice(0, 8)) {
    for (const name of UNSPLASH_PRODUCT_NAMES) {
      await createTestProduct(shop.id, { name, imageUrl: UNSPLASH_PRODUCTS[name] });
    }
  }
  const unpublished = await createTestProduct(shops[8].id, {
    name: UNPUBLISHED_NAME,
    isActive: false,
    imageUrl: UNSPLASH_PRODUCTS["Steak de bœuf"],
  });

  const tarik = shops[8];
  await createTestProduct(tarik.id, { name: "Brochettes de bœuf", imageUrl: BLOB("product-a") });
  await createTestProduct(tarik.id, { name: "Rumsteak", imageUrl: "/img/products/rumsteak.jpg" });
  const withoutImageUrl = await createTestProduct(tarik.id, { name: "Jarret de veau" });
  await prisma.productImage.createMany({
    data: [
      { productId: withoutImageUrl.id, url: BLOB("product-b"), isPrimary: true },
      {
        productId: withoutImageUrl.id,
        url: "/api/uploads/products/product-1771234567890.webp",
        order: 1,
      },
    ],
  });
  await prisma.generatedImage.create({
    data: {
      model: "FLUX_SCHNELL",
      prompt: "steak",
      usage: "PRODUCT",
      imageUrl: "https://replicate.delivery/xezq/abc/out-0.webp",
      shopId: tarik.id,
      createdBy: "user_x",
    },
  });
  await createTestOffer({ shopId: tarik.id, bannerImageUrl: "data:image/png;base64,iVBORw0KGgo=" });
  return { shops, unpublished, withoutImageUrl };
}

describe("runImageCensus", () => {
  it("compte chaque colonne par catégorie, NULL compris, dans l'ordre de l'inventaire", async () => {
    await plantProductionPattern();
    const { counts } = await runImageCensus(prisma);

    const expected: CensusCount[] = [
      { table: "products", column: "image_url", kind: "BLOB", count: 1 },
      { table: "products", column: "image_url", kind: "LOCAL_STATIC", count: 1 },
      { table: "products", column: "image_url", kind: "LEGACY_DISPLAY", count: 65 },
      { table: "products", column: "image_url", kind: "NULL", count: 1 },
      { table: "product_images", column: "url", kind: "BLOB", count: 1 },
      { table: "product_images", column: "url", kind: "LEGACY_UPLOAD_PATH", count: 1 },
      { table: "shops", column: "image_url", kind: "LOCAL_STATIC", count: 1 },
      { table: "shops", column: "image_url", kind: "NULL", count: 8 },
      { table: "shops", column: "banner_url", kind: "NULL", count: 9 },
      { table: "shops", column: "owner_photo_url", kind: "NULL", count: 9 },
      { table: "shops", column: "halal_cert_url", kind: "NULL", count: 9 },
      { table: "generated_images", column: "image_url", kind: "EXPIRING", count: 1 },
      { table: "offers", column: "banner_image_url", kind: "DATA", count: 1 },
      { table: "offers", column: "popup_image_url", kind: "NULL", count: 1 },
    ];
    expect(counts).toEqual(expected);
  });

  it("les lignes Unsplash portent le nom du produit et le slug de leur boutique", async () => {
    const { shops, unpublished } = await plantProductionPattern();
    const { rows } = await runImageCensus(prisma);

    const unsplash = rows.filter((row) => row.kind === "LEGACY_DISPLAY");
    expect(unsplash).toHaveLength(65);
    expect(unsplash.every((row) => row.table === "products" && row.column === "image_url")).toBe(
      true
    );

    for (const shop of shops.slice(0, 8)) {
      const ofShop = unsplash.filter((row) => row.shopId === shop.id);
      expect(ofShop.map((row) => row.label).sort()).toEqual([...UNSPLASH_PRODUCT_NAMES].sort());
      expect(ofShop.every((row) => row.shopSlug === shop.slug)).toBe(true);
      expect(ofShop.every((row) => row.value === UNSPLASH_PRODUCTS[row.label as string])).toBe(
        true
      );
    }
    expect(unsplash.find((row) => row.id === unpublished.id)).toEqual({
      table: "products",
      column: "image_url",
      id: unpublished.id,
      value: UNSPLASH_PRODUCTS["Steak de bœuf"],
      kind: "LEGACY_DISPLAY",
      shopId: shops[8].id,
      shopSlug: shops[8].slug,
      label: UNPUBLISHED_NAME,
    });
  });

  it("une photo de produit porte le nom et la boutique de son produit ; le slug pour shops ; rien ailleurs", async () => {
    const { shops, withoutImageUrl } = await plantProductionPattern();
    const { rows } = await runImageCensus(prisma);

    const legacyUpload = rows.find((row) => row.kind === "LEGACY_UPLOAD_PATH");
    expect(legacyUpload).toMatchObject({
      table: "product_images",
      column: "url",
      shopId: withoutImageUrl.shopId,
      shopSlug: shops[8].slug,
      label: "Jarret de veau",
    });
    expect(rows.find((row) => row.table === "shops")).toMatchObject({
      id: shops[0].id,
      shopId: shops[0].id,
      shopSlug: shops[0].slug,
      label: shops[0].slug,
      kind: "LOCAL_STATIC",
    });
    expect(rows.find((row) => row.table === "generated_images")).toMatchObject({
      kind: "EXPIRING",
      shopId: shops[8].id,
      shopSlug: shops[8].slug,
      label: null,
    });
    expect(rows.find((row) => row.table === "offers")).toMatchObject({
      kind: "DATA",
      shopSlug: shops[8].slug,
    });
  });

  it("lit plus de 1 000 valeurs d'une colonne par lots, sans doublon ni oubli", async () => {
    const shop = await createTestShop();
    await prisma.product.createMany({
      data: Array.from({ length: 1001 }, (_, i) => ({
        shopId: shop.id,
        name: `Produit ${i}`,
        unit: "KG" as const,
        priceCents: 1000,
        imageUrl: "/img/products/rumsteak.jpg",
      })),
    });
    const { counts, rows } = await runImageCensus(prisma);
    expect(counts).toContainEqual({
      table: "products",
      column: "image_url",
      kind: "LOCAL_STATIC",
      count: 1001,
    });
    const ids = rows.filter((row) => row.table === "products").map((row) => row.id);
    expect(new Set(ids).size).toBe(1001);
  });
});
