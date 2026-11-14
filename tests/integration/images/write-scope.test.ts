// @vitest-environment node
// Périmètre de la règle d'écriture, sur PostgreSQL réel : une NOUVELLE URL de notre magasin n'est
// acceptée sur un produit ou une boutique que si le fichier est enregistré pour cette boutique ou
// pour la plateforme, ou publié dans le catalogue de référence. Le fichier d'une autre boutique, ou
// un chemin qui ne correspond à aucun fichier enregistré, est refusé (400, message français) : une
// boutique ne peut pas attacher la photo d'une autre et l'empêcher ainsi de la supprimer. Simulés :
// l'identité (helpers d'auth) et le stockage (en mémoire) ; handlers et base réels.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Shop, User } from "@prisma/client";
import type { ImageStore } from "@/lib/images/store";
import { MemoryImageStore } from "../../fixtures/images/memory-store";

const storage = vi.hoisted(() => ({ store: null as ImageStore | null }));

vi.mock("@/lib/auth/server-auth", async () => (await import("./product-routes-harness")).serverAuthMock);
vi.mock("@/lib/boucher-auth", async () => (await import("./product-routes-harness")).boucherAuthMock);
vi.mock("@/lib/images/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/images/store")>()),
  getImageStore: () => storage.store as ImageStore,
}));

import { POST as createProductRoute } from "@/app/api/products/route";
import { PATCH as updateProductRoute } from "@/app/api/products/[id]/route";
import { POST as createShopRoute } from "@/app/api/shops/route";
import { PATCH as updateShopRoute } from "@/app/api/shops/[id]/route";
import { DELETE as deleteGalleryImageRoute } from "@/app/api/boucher/images/[id]/route";
import { IMAGE_URL_REFUSED_FR, imageBlobHost } from "@/lib/images/durable-url";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestProduct, createTestShop, createTestUser } from "../helpers/factories";
import { actAs, call, photosOf, registeredPhoto, storeUrl } from "./product-routes-harness";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

type Side = { owner: User; shop: Shop; categoryId: string };

let mine: Side;
let rival: Side;

async function createSide(): Promise<Side> {
  const owner = await createTestUser({ role: "BOUCHER" });
  const shop = await createTestShop({ ownerId: owner.id });
  const category = await prisma.category.create({ data: { name: "Volaille", shopId: shop.id } });
  return { owner, shop, categoryId: category.id };
}

function postProduct(side: Side, extra: Record<string, unknown>) {
  const body = { name: "Filet", priceCents: 1490, unit: "KG", categoryIds: [side.categoryId], ...extra };
  return call(createProductRoute, "/api/products", "POST", { ...body, shopId: side.shop.id });
}

function patchProduct(id: string, body: Record<string, unknown>) {
  return call(updateProductRoute, `/api/products/${id}`, "PATCH", body, id);
}

function patchShop(shopId: string, body: Record<string, unknown>) {
  return call(updateShopRoute, `/api/shops/${shopId}`, "PATCH", body, shopId);
}

async function actAsAdmin(): Promise<void> {
  actAs(await createTestUser({ role: "ADMIN" }), null);
}

function expectRefused(response: { status: number; body: { error?: { message: string } } }) {
  expect(response.status).toBe(400);
  expect(response.body.error?.message).toBe(IMAGE_URL_REFUSED_FR);
}

/** Photo d'un produit du catalogue de référence, sans ligne au registre (photo historique). */
async function referenceCatalogueUrl(where: "imageUrl" | "images"): Promise<string> {
  const url = storeUrl("generated");
  const category = await prisma.globalCategory.create({ data: { name: `Volailles ${where}` } });
  await prisma.referenceProduct.create({
    data: {
      name: "Filet de dinde",
      categoryId: category.id,
      ...(where === "imageUrl" ? { imageUrl: url } : { images: { create: [{ url, isPrimary: true }] } }),
    },
  });
  return url;
}

beforeEach(async () => {
  storage.store = new MemoryImageStore();
  mine = await createSide();
  rival = await createSide();
  actAs(mine.owner, mine.shop.id);
});

describe("Produits : le fichier doit appartenir à la boutique ou à la plateforme", () => {
  it("le fichier envoyé par une autre boutique → 400 en création, aucun produit", async () => {
    const theirs = await registeredPhoto(rival.shop.id);

    expectRefused(await postProduct(mine, { images: [{ url: theirs }] }));
    expectRefused(await postProduct(mine, { imageUrl: theirs }));
    expect(await prisma.product.count()).toBe(0);
  });

  it.each<[string, (theirs: string) => Record<string, unknown>]>([
    ["dans images", (theirs) => ({ images: [{ url: theirs }] })],
    ["dans imageUrl", (theirs) => ({ imageUrl: theirs })],
  ])("le fichier d'une autre boutique %s → 400 en modification, rien ne change", async (_case, body) => {
    const product = await createTestProduct(mine.shop.id, { imageUrl: "/img/products/filet-dinde.jpg" });

    expectRefused(await patchProduct(product.id, body(await registeredPhoto(rival.shop.id))));
    expect(await photosOf(product.id)).toEqual({ imageUrl: "/img/products/filet-dinde.jpg", images: [] });
  });

  it.each([
    ["un chemin du magasin local d'une autre boutique", () => `/local-images/shops/${rival.shop.id}/retouch-source/0b0e3c5e-1111-4222-8333-444455556666.webp`],
    ["un chemin de sa propre boutique sans fichier enregistré", () => storeUrl(`shops/${mine.shop.id}/product`)],
    ["un fichier de notre magasin hors de tout dossier connu", () => storeUrl("e2e")],
  ])("%s → 400", async (_case, url) => {
    const product = await createTestProduct(mine.shop.id, { imageUrl: null });

    expectRefused(await patchProduct(product.id, { images: [{ url: url() }] }));
    expect(await photosOf(product.id)).toEqual({ imageUrl: null, images: [] });
  });

  it("son propre envoi → 201 en création, 200 en modification", async () => {
    const [first, second] = [await registeredPhoto(mine.shop.id), await registeredPhoto(mine.shop.id)];

    const created = await postProduct(mine, { images: [{ url: first }] });
    expect(created.status).toBe(201);
    expect((await patchProduct(created.body.data!.id, { images: [{ url: second }] })).status).toBe(200);
    expect(await photosOf(created.body.data!.id)).toMatchObject({ imageUrl: second, images: [{ url: second }] });
  });

  it("un fichier de la plateforme (registre sans boutique) → 201", async () => {
    const platform = await registeredPhoto(null);

    const { status, body } = await postProduct(mine, { images: [{ url: platform }] });

    expect(status).toBe(201);
    expect((await photosOf(body.data!.id)).imageUrl).toBe(platform);
  });

  it.each(["imageUrl", "images"] as const)(
    "une photo du catalogue de référence (%s), importée telle quelle → 201",
    async (where) => {
      const url = await referenceCatalogueUrl(where);

      const { status, body } = await postProduct(mine, { images: [{ url, isPrimary: true }] });

      expect(status).toBe(201);
      expect((await photosOf(body.data!.id)).imageUrl).toBe(url);
    }
  );

  it("un fichier historique products/product-….webp déjà sur la ligne, renvoyé tel quel → 200", async () => {
    const legacy = `https://${imageBlobHost()}/products/product-1772114082715-3e9f77cb76d4b0eb.webp`;
    const product = await createTestProduct(mine.shop.id, {
      imageUrl: legacy,
      images: { create: [{ url: legacy, order: 0, isPrimary: true }] },
    });

    expect((await patchProduct(product.id, { images: [{ url: legacy, isPrimary: true }] })).status).toBe(200);
    expect(await photosOf(product.id)).toEqual({ imageUrl: legacy, images: [{ url: legacy, order: 0, isPrimary: true }] });
  });

  it("la photo d'une boutique ne peut pas être prise en otage : refusée chez l'autre, elle reste supprimable", async () => {
    const mineUpload = await registeredPhoto(mine.shop.id);
    const image = await prisma.generatedImage.findFirstOrThrow({ where: { imageUrl: mineUpload } });
    const theirProduct = await createTestProduct(rival.shop.id, { imageUrl: null });
    actAs(rival.owner, rival.shop.id);

    expectRefused(await patchProduct(theirProduct.id, { images: [{ url: mineUpload }] }));

    actAs(mine.owner, mine.shop.id);
    const request = new NextRequest(`http://localhost/api/boucher/images/${image.id}`, { method: "DELETE" });
    const response = await deleteGalleryImageRoute(request, { params: { id: image.id } });
    expect(response.status).toBe(200);
    expect(await prisma.generatedImage.count({ where: { id: image.id } })).toBe(0);
  });
});

describe("Boutiques : même règle sur imageUrl et bannerUrl (admin)", () => {
  it.each(["imageUrl", "bannerUrl"] as const)(
    "%s : le fichier d'une autre boutique → 400, message dans details, rien ne change",
    async (field) => {
      const theirs = await registeredPhoto(rival.shop.id);
      await actAsAdmin();

      const { status, body } = await patchShop(mine.shop.id, { [field]: theirs });

      expect(status).toBe(400);
      expect(body.error?.details?.[field]).toEqual([IMAGE_URL_REFUSED_FR]);
      const shop = await prisma.shop.findUniqueOrThrow({ where: { id: mine.shop.id } });
      expect([shop.imageUrl, shop.bannerUrl]).toEqual([null, null]);
    }
  );

  it("un fichier de la boutique, puis un fichier de la plateforme → 200, enregistrés", async () => {
    const own = await registeredPhoto(mine.shop.id);
    const platform = await registeredPhoto(null);
    await actAsAdmin();

    expect((await patchShop(mine.shop.id, { imageUrl: own })).status).toBe(200);
    expect((await patchShop(mine.shop.id, { bannerUrl: platform, imageUrl: own })).status).toBe(200);

    const shop = await prisma.shop.findUniqueOrThrow({ where: { id: mine.shop.id } });
    expect([shop.imageUrl, shop.bannerUrl]).toEqual([own, platform]);
  });

  it("création : le fichier d'une boutique → 400 ; un fichier de la plateforme → 201", async () => {
    const shopFile = await registeredPhoto(rival.shop.id);
    const platform = await registeredPhoto(null);
    await actAsAdmin();
    const shopBody = (slug: string, imageUrl: string) => ({
      name: "Boucherie Neuve", slug, address: "1 rue Neuve", city: "Chambéry", phone: "0479000000", ownerId: mine.owner.id, imageUrl,
    });

    const refused = await call(createShopRoute, "/api/shops", "POST", shopBody("refusee", shopFile));
    const created = await call(createShopRoute, "/api/shops", "POST", shopBody("acceptee", platform));

    expect(refused.status).toBe(400);
    expect(refused.body.error?.details?.imageUrl).toEqual([IMAGE_URL_REFUSED_FR]);
    expect(created.status).toBe(201);
    expect(await prisma.shop.findMany({ where: { slug: { in: ["refusee", "acceptee"] } }, select: { slug: true } })).toEqual([
      { slug: "acceptee" },
    ]);
  });
});
