// @vitest-environment node
// Product.imageUrl, miroir tenu par le serveur, sur PostgreSQL réel : création, modification et
// duplication d'un produit écrivent la photo principale dans imageUrl ; clearImageUrl l'efface ; un
// produit à imageUrl seule garde sa photo ; un produit à photos garde le miroir de sa principale
// même quand une demande sans photos tente de l'effacer ou de le remplacer ; le remplacement des
// photos est atomique. Les handlers sont appelés directement ; seule l'identité est simulée.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Shop, User } from "@prisma/client";

vi.mock(
  "@/lib/auth/server-auth",
  async () => (await import("./product-routes-harness")).serverAuthMock
);
vi.mock(
  "@/lib/boucher-auth",
  async () => (await import("./product-routes-harness")).boucherAuthMock
);

import { POST as createRoute } from "@/app/api/products/route";
import { PATCH as updateRoute } from "@/app/api/products/[id]/route";
import { POST as duplicateRoute } from "@/app/api/products/duplicate/route";
import { PRIMARY_PHOTO_DECIDES_FR } from "@/lib/images/product-image-write";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestProduct, createTestShop, createTestUser } from "../helpers/factories";
import {
  actAs,
  call,
  photosOf,
  registeredPhoto,
  storeUrl,
  type Photo,
} from "./product-routes-harness";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

type World = { owner: User; shop: Shop; categoryId: string };

const CATALOGUE_PHOTO = "/img/products/veau-2.jpg";

/** Une photo envoyée par la boutique sur notre magasin (enregistrée au registre). */
function ownPhoto(): Promise<string> {
  return registeredPhoto(world.shop.id);
}

/** Photo déjà enregistrée sur le produit (droit acquis : pas besoin du registre). */
function storedPhoto(): string {
  return storeUrl(`shops/${world.shop.id}/product`);
}

function photo(url: string, order: number, isPrimary: boolean): Photo {
  return { url, order, isPrimary };
}

async function createWorld(): Promise<World> {
  const owner = await createTestUser({ role: "BOUCHER" });
  const shop = await createTestShop({ ownerId: owner.id });
  const category = await prisma.category.create({ data: { name: "Boeuf", shopId: shop.id } });
  return { owner, shop, categoryId: category.id };
}

function postProduct(extra: Record<string, unknown>) {
  const body = {
    name: "Entrecôte",
    priceCents: 2990,
    unit: "KG",
    categoryIds: [world.categoryId],
    ...extra,
  };
  return call(createRoute, "/api/products", "POST", { ...body, shopId: world.shop.id });
}

function patchProduct(id: string, body: Record<string, unknown>) {
  return call(updateRoute, `/api/products/${id}`, "PATCH", body, id);
}

function duplicateProduct(productId: string) {
  return call(duplicateRoute, "/api/products/duplicate", "POST", { productId });
}

async function expectPhotos(productId: string, imageUrl: string | null, images: Photo[]) {
  expect(await photosOf(productId)).toEqual({ imageUrl, images });
}

async function productWithPhotos(imageUrl: string | null, images: Photo[]) {
  return createTestProduct(world.shop.id, {
    imageUrl,
    ...(images.length > 0 && { images: { create: images } }),
  });
}

/** Produit à deux photos : A principale (et miroir), B. */
async function twoPhotoProduct() {
  const photos = [photo(storedPhoto(), 0, true), photo(storedPhoto(), 1, false)];
  return { product: await productWithPhotos(photos[0].url, photos), photos };
}

let world: World;

beforeEach(async () => {
  world = await createWorld();
  actAs(world.owner, world.shop.id);
});

describe("POST /api/products : imageUrl suit la photo principale", () => {
  it("images [A, B principale] → imageUrl = B, ordres 0 et 1, une seule principale", async () => {
    const [a, b] = [await ownPhoto(), await ownPhoto()];

    const { status, body } = await postProduct({
      images: [{ url: a }, { url: b, isPrimary: true }],
    });

    expect(status).toBe(201);
    await expectPhotos(body.data!.id, b, [photo(a, 0, false), photo(b, 1, true)]);
  });

  it("6 photos → 400 « 5 photos maximum par produit. », aucun produit créé", async () => {
    const images = await Promise.all(
      Array.from({ length: 6 }, async () => ({ url: await ownPhoto() }))
    );

    const { status, body } = await postProduct({ images });

    expect(status).toBe(400);
    expect(body.error?.details?.images).toEqual(["5 photos maximum par produit."]);
    expect(await prisma.product.count()).toBe(0);
  });

  it("sans champ photo → ni photo ni imageUrl", async () => {
    const { status, body } = await postProduct({});

    expect(status).toBe(201);
    await expectPhotos(body.data!.id, null, []);
  });
});

describe("PATCH /api/products/[id] : miroir, effacement explicite, remplacement atomique", () => {
  it("images [C] remplace toutes les photos : seule C reste, principale et miroir", async () => {
    const { product } = await twoPhotoProduct();
    const c = await ownPhoto();

    const { status } = await patchProduct(product.id, { images: [{ url: c }] });

    expect(status).toBe(200);
    await expectPhotos(product.id, c, [photo(c, 0, true)]);
  });

  it.each<[string, Record<string, unknown>, string | null]>([
    ["images [] : la photo actuelle est gardée", { images: [] }, CATALOGUE_PHOTO],
    ["clearImageUrl: true avec images [] → null", { images: [], clearImageUrl: true }, null],
    ["clearImageUrl: true sans images → null", { clearImageUrl: true }, null],
    ["sans champ photo → imageUrl telle qu'enregistrée", { name: "Onglet" }, CATALOGUE_PHOTO],
  ])("produit à imageUrl seule, %s", async (_case, body, imageUrl) => {
    const product = await productWithPhotos(CATALOGUE_PHOTO, []);

    const { status } = await patchProduct(product.id, body);

    expect(status).toBe(200);
    await expectPhotos(product.id, imageUrl, []);
  });

  it.each<[string, Record<string, unknown>]>([
    ["clearImageUrl: true", { clearImageUrl: true }],
    ["imageUrl: /img/products/merguez.jpg", { imageUrl: "/img/products/merguez.jpg" }],
    ["imageUrl: null", { imageUrl: null }],
  ])(
    "produit à photos, %s sans images → 400, imageUrl reste la principale",
    async (_case, body) => {
      const { product, photos } = await twoPhotoProduct();

      const response = await patchProduct(product.id, { ...body, name: "Renommé" });

      expect(response.status).toBe(400);
      expect(response.body.error?.message).toBe(PRIMARY_PHOTO_DECIDES_FR);
      await expectPhotos(product.id, photos[0].url, photos);
      expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).name).toBe(
        product.name
      );
    }
  );

  it("produit à photos, imageUrl enregistrée renvoyée sans images → 200, rien ne change", async () => {
    const { product, photos } = await twoPhotoProduct();

    const { status } = await patchProduct(product.id, { imageUrl: photos[0].url, name: "Renommé" });

    expect(status).toBe(200);
    await expectPhotos(product.id, photos[0].url, photos);
  });

  it("clearImageUrl avec une imageUrl → 400, rien ne change", async () => {
    const product = await productWithPhotos(CATALOGUE_PHOTO, []);

    const { status, body } = await patchProduct(product.id, {
      clearImageUrl: true,
      imageUrl: await ownPhoto(),
    });

    expect(status).toBe(400);
    expect(body.error?.message).toBe(
      "Choisissez : retirer la photo ou en indiquer une, pas les deux."
    );
    await expectPhotos(product.id, CATALOGUE_PHOTO, []);
  });

  it("une première photo à soi sur un produit à imageUrl seule devient la principale et le miroir", async () => {
    const own = await ownPhoto();
    const product = await productWithPhotos(CATALOGUE_PHOTO, []);

    const { status } = await patchProduct(product.id, { images: [{ url: own }] });

    expect(status).toBe(200);
    await expectPhotos(product.id, own, [photo(own, 0, true)]);
  });

  it("images [] après une photo [A] devenue le miroir → imageUrl null", async () => {
    const a = await ownPhoto();
    const product = await productWithPhotos(null, []);

    expect((await patchProduct(product.id, { images: [{ url: a }] })).status).toBe(200);
    expect((await photosOf(product.id)).imageUrl).toBe(a);

    const { status } = await patchProduct(product.id, { images: [] });

    expect(status).toBe(200);
    await expectPhotos(product.id, null, []);
  });

  it("une modification sans champ photo ne touche pas aux photos", async () => {
    const { product, photos } = await twoPhotoProduct();

    const { status } = await patchProduct(product.id, { name: "Entrecôte maturée" });

    expect(status).toBe(200);
    await expectPhotos(product.id, photos[0].url, photos);
  });

  it.each<[string, { images: { alt?: string }[]; displayOrder?: number }]>([
    // 2^31 passe la validation mais dépasse la colonne INT4 : l'écriture du produit échoue.
    ["l'écriture du produit", { images: [{}], displayOrder: 2147483648 }],
    // PostgreSQL refuse l'octet NUL dans un texte : l'insertion de la nouvelle photo échoue,
    // après la suppression des anciennes dans la même écriture.
    ["l'insertion de la nouvelle photo", { images: [{ alt: "a\u0000b" }] }],
  ])("quand %s échoue, photos, imageUrl et nom restent intacts", async (_case, body) => {
    const { product, photos } = await twoPhotoProduct();
    const images = await Promise.all(
      body.images.map(async (image) => ({ ...image, url: await ownPhoto() }))
    );

    const { status } = await patchProduct(product.id, { ...body, images, name: "Renommé" });

    expect(status).toBe(500);
    await expectPhotos(product.id, photos[0].url, photos);
    const stored = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(stored.name).toBe(product.name);
  });

  it("le boucher d'une autre boutique ne peut pas remplacer les photos : 403, rien ne change", async () => {
    const { product, photos } = await twoPhotoProduct();
    const rival = await createWorld();
    actAs(rival.owner, rival.shop.id);

    const { status } = await patchProduct(product.id, {
      images: [{ url: await registeredPhoto(rival.shop.id) }],
    });

    expect(status).toBe(403);
    await expectPhotos(product.id, photos[0].url, photos);
  });
});

describe("POST /api/products/duplicate : la copie a les mêmes photos et le même miroir", () => {
  it.each([
    ["imageUrl = principale", true],
    ["source incohérente, imageUrl null", false],
  ])(
    "copie photos, ordre et principale ; %s → imageUrl de la copie = principale",
    async (_case, mirrored) => {
      const photos = [photo(storedPhoto(), 0, false), photo(storedPhoto(), 1, true)];
      const source = await productWithPhotos(mirrored ? photos[1].url : null, photos);

      const { status, body } = await duplicateProduct(source.id);

      expect(status).toBe(200);
      expect(body.data!.id).not.toBe(source.id);
      await expectPhotos(body.data!.id, photos[1].url, photos);
    }
  );

  it.each([CATALOGUE_PHOTO, null])("source sans photo, imageUrl %s → copiée", async (imageUrl) => {
    const source = await productWithPhotos(imageUrl, []);

    const { status, body } = await duplicateProduct(source.id);

    expect(status).toBe(200);
    await expectPhotos(body.data!.id, imageUrl, []);
  });
});
