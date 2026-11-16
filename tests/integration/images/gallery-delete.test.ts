// @vitest-environment node
// DELETE /api/boucher/images/[id] sur la vraie base : refus (409) tant que l'image est utilisée,
// sans nommer les produits d'une autre boutique ; effacement de la ligne puis des deux fichiers
// sinon ; 404 pour l'image d'une autre boutique. Seuls l'identité et le stockage sont simulés.
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryImageStore } from "../../fixtures/images/memory-store";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestOffer, createTestProduct, createTestShop } from "../helpers/factories";

vi.mock(
  "@/lib/boucher-auth",
  async () => (await import("./product-routes-harness")).boucherAuthMock
);
vi.mock("@/lib/images/store", async (importOriginal) =>
  (await import("./store-mock")).imageStoreModule(importOriginal)
);

import { DELETE } from "@/app/api/boucher/images/[id]/route";
import { imageBlobHost } from "@/lib/images/durable-url";
import { thumbnailOf } from "@/lib/images/thumbnail";
import { actAsButcherOf } from "./product-routes-harness";
import { storage } from "./store-mock";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

let store: MemoryImageStore;

beforeEach(() => {
  store = new MemoryImageStore();
  storage.store = store;
});

/** Image de la galerie de la boutique : la ligne et ses deux fichiers dans le stockage. */
async function galleryImage(shopId: string) {
  const url = `https://${imageBlobHost()}/shops/${shopId}/product/${randomUUID()}.webp`;
  const thumb = thumbnailOf(url) as string;
  store.seed(url);
  store.seed(thumb);
  const row = await prisma.generatedImage.create({
    data: {
      model: "UPLOAD",
      prompt: "",
      usage: "PRODUCT",
      imageUrl: url,
      width: 800,
      height: 600,
      shopId,
      createdBy: "u",
    },
  });
  return { id: row.id, url, thumb };
}

function remove(shopId: string, id: string) {
  actAsButcherOf(shopId);
  return DELETE(
    new NextRequest(`http://localhost/api/boucher/images/${id}`, { method: "DELETE" }),
    {
      params: { id },
    }
  );
}

async function conflictOf(res: Response) {
  expect(res.status).toBe(409);
  const { error } = (await res.json()) as {
    error: { code: string; message: string; details: { products: string[] } };
  };
  expect(error.code).toBe("CONFLICT");
  return error;
}

async function expectKept(image: { id: string; url: string; thumb: string }) {
  expect(store.dels).toEqual([]);
  expect(store.files.has(image.url) && store.files.has(image.thumb)).toBe(true);
  expect(await prisma.generatedImage.count({ where: { id: image.id } })).toBe(1);
}

describe("DELETE /api/boucher/images/[id] — image encore utilisée : 409", () => {
  it("utilisée par Product.imageUrl d'un produit de la boutique : le nom dans le message et les détails", async () => {
    const shop = await createTestShop();
    const image = await galleryImage(shop.id);
    await createTestProduct(shop.id, { name: "Côte de bœuf", imageUrl: image.url });

    const error = await conflictOf(await remove(shop.id, image.id));
    expect(error.message).toBe(
      "Cette photo est utilisée par : Côte de bœuf. Changez la photo de ce produit avant de la supprimer."
    );
    expect(error.details.products).toEqual(["Côte de bœuf"]);
    await expectKept(image);
  });

  it("utilisée par une ProductImage (ou par sa vignette) : 409, produits nommés dans l'ordre", async () => {
    const shop = await createTestShop();
    const image = await galleryImage(shop.id);
    const merguez = await createTestProduct(shop.id, { name: "Merguez" });
    const agneau = await createTestProduct(shop.id, { name: "Gigot d'agneau" });
    await prisma.productImage.create({
      data: { productId: merguez.id, url: image.url, order: 0, isPrimary: true },
    });
    await prisma.productImage.create({
      data: { productId: agneau.id, url: image.thumb, order: 0, isPrimary: true },
    });

    const error = await conflictOf(await remove(shop.id, image.id));
    expect(error.message).toBe(
      "Cette photo est utilisée par : Gigot d'agneau, Merguez. Changez la photo de ces produits avant de la supprimer."
    );
    expect(error.details.products).toEqual(["Gigot d'agneau", "Merguez"]);
    await expectKept(image);
  });

  it("plus de cinq produits : cinq noms puis « et N autres »", async () => {
    const shop = await createTestShop();
    const image = await galleryImage(shop.id);
    for (const name of ["A1", "A2", "A3", "A4", "A5", "A6", "A7"]) {
      await createTestProduct(shop.id, { name, imageUrl: image.url });
    }
    const error = await conflictOf(await remove(shop.id, image.id));
    expect(error.message).toBe(
      "Cette photo est utilisée par : A1, A2, A3, A4, A5 et 2 autres. Changez la photo de ces produits avant de la supprimer."
    );
    expect(error.details.products).toHaveLength(7);
  });

  it.each([
    ["la bannière de la boutique", "banner"],
    ["une offre", "offer"],
    ["un produit d'une autre boutique", "foreign-product"],
  ])("utilisée seulement par %s : 409 sans aucun nom de produit", async (_label, use) => {
    const shop = await createTestShop();
    const image = await galleryImage(shop.id);
    if (use === "banner")
      await prisma.shop.update({ where: { id: shop.id }, data: { bannerUrl: image.url } });
    if (use === "offer") await createTestOffer({ shopId: shop.id, bannerImageUrl: image.url });
    if (use === "foreign-product") {
      const other = await createTestShop();
      await createTestProduct(other.id, {
        name: "Produit secret d'une autre boutique",
        imageUrl: image.url,
      });
    }

    const error = await conflictOf(await remove(shop.id, image.id));
    expect(error.message).toBe(
      "Cette photo est encore utilisée sur Klik&Go : elle ne peut pas être supprimée."
    );
    expect(error.details.products).toEqual([]);
    await expectKept(image);
  });
});

describe("DELETE /api/boucher/images/[id] — suppression", () => {
  it("image inutilisée : 200, ligne supprimée, la photo puis sa vignette effacées", async () => {
    const shop = await createTestShop();
    const image = await galleryImage(shop.id);
    await createTestProduct(shop.id, { name: "Sans photo" });

    const res = await remove(shop.id, image.id);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { deleted: true } });
    expect(await prisma.generatedImage.count({ where: { id: image.id } })).toBe(0);
    expect(store.dels).toEqual([image.url, image.thumb]);
    expect(store.files.size).toBe(0);
  });

  it("l'effacement du fichier échoue : la réponse reste 200, la ligne est supprimée", async () => {
    const shop = await createTestShop();
    const image = await galleryImage(shop.id);
    store = new MemoryImageStore({ failDel: true });
    storage.store = store;

    const res = await remove(shop.id, image.id);
    expect(res.status).toBe(200);
    expect(await prisma.generatedImage.count({ where: { id: image.id } })).toBe(0);
    expect(store.dels).toEqual([image.url, image.thumb]);
  });

  it("une image hors de notre stockage (ancienne URL) : ligne supprimée, aucun fichier effacé", async () => {
    const shop = await createTestShop();
    const row = await prisma.generatedImage.create({
      data: {
        model: "FLUX_SCHNELL",
        prompt: "p",
        usage: "PRODUCT",
        imageUrl: "https://replicate.delivery/x/out-0.webp",
        shopId: shop.id,
        createdBy: "u",
      },
    });
    expect((await remove(shop.id, row.id)).status).toBe(200);
    expect(store.dels).toEqual([]);
  });

  it("l'image d'une autre boutique : 404, rien n'est supprimé", async () => {
    const shop = await createTestShop();
    const other = await createTestShop();
    const image = await galleryImage(other.id);

    const res = await remove(shop.id, image.id);
    expect(res.status).toBe(404);
    await expectKept(image);
  });

  it("l'image d'une autre boutique, utilisée là-bas : 404 aussi (ni 409, ni indice d'existence)", async () => {
    const shop = await createTestShop();
    const other = await createTestShop();
    const image = await galleryImage(other.id);
    await createTestProduct(other.id, { name: "Produit de l'autre boutique", imageUrl: image.url });

    const res = await remove(shop.id, image.id);
    expect(res.status).toBe(404);
    expect(JSON.stringify(await res.json())).not.toContain("autre boutique");
    await expectKept(image);
  });
});
