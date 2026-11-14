// @vitest-environment node
// Règle d'écriture des URL d'image, sur PostgreSQL réel : un produit ou une boutique n'enregistre
// qu'une URL durable (notre magasin Blob, une photo /img du site) ; une valeur historique déjà
// enregistrée sur la même ligne est acceptée telle quelle (droit acquis), toute autre est refusée
// en 400 avec un message en français. Handlers appelés directement, identité simulée. À qui
// appartient un fichier de notre magasin (périmètre boutique / plateforme) : write-scope.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Shop, User } from "@prisma/client";

vi.mock("@/lib/auth/server-auth", async () => (await import("./product-routes-harness")).serverAuthMock);
vi.mock("@/lib/boucher-auth", async () => (await import("./product-routes-harness")).boucherAuthMock);

import { POST as createProductRoute } from "@/app/api/products/route";
import { PATCH as updateProductRoute } from "@/app/api/products/[id]/route";
import { POST as duplicateProductRoute } from "@/app/api/products/duplicate/route";
import { POST as createShopRoute } from "@/app/api/shops/route";
import { PATCH as updateShopRoute } from "@/app/api/shops/[id]/route";
import { IMAGE_URL_REFUSED_FR } from "@/lib/images/durable-url";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestProduct, createTestShop, createTestUser } from "../helpers/factories";
import { actAs, call, registeredPhoto } from "./product-routes-harness";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const FOREIGN = "https://evil.example/x.jpg";
const EXPIRING = "https://replicate.delivery/xezq/abc/out-0.webp";
const UNSPLASH_STORED = "https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=800&q=80";
const UNSPLASH_OTHER = "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=800&q=80";
const CATALOGUE_PHOTO = "/img/products/filet-dinde.jpg";
const NEW_SHOP_SLUG = "boucherie-neuve";

let owner: User;
let shop: Shop;
let categoryId: string;

async function actAsAdmin(): Promise<void> {
  actAs(await createTestUser({ role: "ADMIN" }), null);
}

function postProduct(extra: Record<string, unknown>) {
  const body = { name: "Filet", priceCents: 1490, unit: "KG", categoryIds: [categoryId], ...extra };
  return call(createProductRoute, "/api/products", "POST", { ...body, shopId: shop.id });
}

function patchProduct(id: string, body: Record<string, unknown>) {
  return call(updateProductRoute, `/api/products/${id}`, "PATCH", body, id);
}

function patchShop(body: Record<string, unknown>) {
  return call(updateShopRoute, `/api/shops/${shop.id}`, "PATCH", body, shop.id);
}

function postShop(imageUrl: string) {
  const body = { name: "Boucherie Neuve", slug: NEW_SHOP_SLUG, address: "1 rue Neuve" };
  const contact = { city: "Chambéry", phone: "0479000000", ownerId: owner.id, imageUrl };
  return call(createShopRoute, "/api/shops", "POST", { ...body, ...contact });
}

async function photosOf(productId: string) {
  return prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: { imageUrl: true, images: { orderBy: { order: "asc" }, select: { url: true } } },
  });
}

async function shopPhotos() {
  return prisma.shop.findUniqueOrThrow({
    where: { id: shop.id },
    select: { imageUrl: true, bannerUrl: true },
  });
}

/** Produit historique dont la photo Unsplash est à la fois imageUrl et photo principale. */
async function legacyUnsplashProduct() {
  return createTestProduct(shop.id, {
    imageUrl: UNSPLASH_STORED,
    images: { create: [{ url: UNSPLASH_STORED, order: 0, isPrimary: true }] },
  });
}

async function expectLegacyPhotoKept(productId: string) {
  expect(await photosOf(productId)).toEqual({
    imageUrl: UNSPLASH_STORED,
    images: [{ url: UNSPLASH_STORED }],
  });
}

beforeEach(async () => {
  owner = await createTestUser({ role: "BOUCHER" });
  shop = await createTestShop({ ownerId: owner.id });
  categoryId = (await prisma.category.create({ data: { name: "Volaille", shopId: shop.id } })).id;
  actAs(owner, shop.id);
});

describe("Produits : une nouvelle URL doit être durable", () => {
  it.each([
    ["une photo étrangère dans images", { images: [{ url: FOREIGN }] }],
    ["une photo étrangère dans imageUrl", { imageUrl: FOREIGN }],
    ["une URL replicate.delivery dans images", { images: [{ url: EXPIRING }] }],
    ["une URL Unsplash dans imageUrl", { imageUrl: UNSPLASH_OTHER }],
  ])("création avec %s → 400 en français, aucun produit", async (_case, extra) => {
    const { status, body } = await postProduct(extra);

    expect(status).toBe(400);
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(body.error?.message).toBe(IMAGE_URL_REFUSED_FR);
    expect(await prisma.product.count()).toBe(0);
  });

  it.each([
    ["images : enregistrée, et miroir", { images: [{ url: CATALOGUE_PHOTO }] }, [CATALOGUE_PHOTO]],
    ["imageUrl : enregistrée", { imageUrl: CATALOGUE_PHOTO }, []],
  ])("création avec une photo du catalogue du site dans %s", async (_case, extra, images) => {
    const { status, body } = await postProduct(extra);

    expect(status).toBe(201);
    expect(await photosOf(body.data!.id)).toEqual({
      imageUrl: CATALOGUE_PHOTO,
      images: images.map((url) => ({ url })),
    });
  });

  it.each([
    ["images", { images: [{ url: UNSPLASH_STORED, isPrimary: true }], name: "Filet" }],
    ["imageUrl", { imageUrl: UNSPLASH_STORED, name: "Filet" }],
  ])("modification qui renvoie l'URL Unsplash enregistrée dans %s → 200", async (_case, body) => {
    const product = await legacyUnsplashProduct();

    const { status } = await patchProduct(product.id, body);

    expect(status).toBe(200);
    await expectLegacyPhotoKept(product.id);
  });

  it.each([
    ["une autre URL Unsplash dans images", { images: [{ url: UNSPLASH_OTHER }] }],
    ["une autre URL Unsplash dans imageUrl", { imageUrl: UNSPLASH_OTHER }],
    ["une URL replicate.delivery dans imageUrl", { imageUrl: EXPIRING }],
    [
      "replicate.delivery à côté de la photo gardée",
      { images: [{ url: UNSPLASH_STORED }, { url: EXPIRING }] },
    ],
  ])("modification avec %s → 400 en français, rien ne change", async (_case, body) => {
    const product = await legacyUnsplashProduct();

    const response = await patchProduct(product.id, body);

    expect(response.status).toBe(400);
    expect(response.body.error?.message).toBe(IMAGE_URL_REFUSED_FR);
    await expectLegacyPhotoKept(product.id);
  });

  it("le droit acquis vaut pour la ligne : l'URL Unsplash d'un autre produit est refusée", async () => {
    await legacyUnsplashProduct();
    const other = await createTestProduct(shop.id, { imageUrl: null });

    const { status, body } = await patchProduct(other.id, { images: [{ url: UNSPLASH_STORED }] });

    expect(status).toBe(400);
    expect(body.error?.message).toBe(IMAGE_URL_REFUSED_FR);
    expect(await photosOf(other.id)).toEqual({ imageUrl: null, images: [] });
  });

  it("une photo de notre magasin Blob remplace la photo historique", async () => {
    const product = await legacyUnsplashProduct();
    const upload = await registeredPhoto(shop.id);

    const { status } = await patchProduct(product.id, { images: [{ url: upload }] });

    expect(status).toBe(200);
    expect(await photosOf(product.id)).toEqual({ imageUrl: upload, images: [{ url: upload }] });
  });

  it("la duplication d'un produit à photo historique garde cette photo", async () => {
    const product = await legacyUnsplashProduct();

    const { status, body } = await call(duplicateProductRoute, "/api/products/duplicate", "POST", {
      productId: product.id,
    });

    expect(status).toBe(200);
    await expectLegacyPhotoKept(body.data!.id);
  });
});

describe("Boutiques : imageUrl et bannerUrl n'acceptent qu'une URL durable", () => {
  it("l'admin choisit une photo par défaut /img/shops/shop-3.jpg → 200, enregistrée", async () => {
    await actAsAdmin();

    const { status } = await patchShop({ imageUrl: "/img/shops/shop-3.jpg" });

    expect(status).toBe(200);
    expect(await shopPhotos()).toEqual({ imageUrl: "/img/shops/shop-3.jpg", bannerUrl: null });
  });

  it("l'admin pose une bannière de notre magasin Blob, puis retire la photo (null) → 200", async () => {
    await prisma.shop.update({
      where: { id: shop.id },
      data: { imageUrl: "/img/shops/shop-1.jpg" },
    });
    await actAsAdmin();
    const banner = await registeredPhoto(shop.id);

    expect((await patchShop({ bannerUrl: banner })).status).toBe(200);
    expect((await patchShop({ imageUrl: null })).status).toBe(200);

    expect(await shopPhotos()).toEqual({ imageUrl: null, bannerUrl: banner });
  });

  it.each(["imageUrl", "bannerUrl"] as const)(
    "l'admin envoie une %s étrangère → 400, message en français dans details, rien ne change",
    async (field) => {
      await prisma.shop.update({
        where: { id: shop.id },
        data: { imageUrl: "/img/shops/shop-1.jpg" },
      });
      await actAsAdmin();

      const { status, body } = await patchShop({ [field]: FOREIGN });

      expect(status).toBe(400);
      expect(body.error?.details?.[field]).toEqual([IMAGE_URL_REFUSED_FR]);
      expect(await shopPhotos()).toEqual({ imageUrl: "/img/shops/shop-1.jpg", bannerUrl: null });
    }
  );

  it("création d'une boutique avec une photo étrangère → 400, aucune boutique", async () => {
    await actAsAdmin();

    const { status, body } = await postShop(FOREIGN);

    expect(status).toBe(400);
    expect(body.error?.details?.imageUrl).toEqual([IMAGE_URL_REFUSED_FR]);
    expect(await prisma.shop.findUnique({ where: { slug: NEW_SHOP_SLUG } })).toBeNull();
  });

  it("création d'une boutique avec une photo par défaut du site → 201, enregistrée", async () => {
    await actAsAdmin();

    const { status } = await postShop("/img/shops/shop-1.jpg");

    expect(status).toBe(201);
    const created = await prisma.shop.findUniqueOrThrow({ where: { slug: NEW_SHOP_SLUG } });
    expect(created.imageUrl).toBe("/img/shops/shop-1.jpg");
  });
});
