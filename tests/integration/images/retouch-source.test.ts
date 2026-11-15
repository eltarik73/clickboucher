// @vitest-environment node
// Source d'une retouche, sur la vraie base : la photo passe par POST /api/uploads/image (usage
// RETOUCH_SOURCE : WebP réencodé par persistImage, ligne UPLOAD, quota de l'heure de la boutique),
// puis POST /api/boucher/images/retouch reçoit son URL en JSON. La route de retouche ne reçoit plus
// jamais d'octets : un envoi multipart y est refusé sans rien stocker. Simulés : l'identité, le
// stockage (en mémoire) et le fournisseur d'IA (configuré, chaque appel échoue : la suite de la
// retouche relève de C1-PHOTOS-B).
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryImageStore } from "../../fixtures/images/memory-store";
import { makeJpeg } from "../../fixtures/images/make-fixtures";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestShop } from "../helpers/factories";

const provider = vi.hoisted(() => ({ run: vi.fn() }));

vi.mock(
  "@/lib/auth/server-auth",
  async () => (await import("./product-routes-harness")).serverAuthMock
);
vi.mock(
  "@/lib/boucher-auth",
  async () => (await import("./product-routes-harness")).boucherAuthMock
);
vi.mock("@/lib/replicate", () => ({
  isReplicateConfigured: () => true,
  getReplicateClient: () => ({ run: provider.run }),
}));
vi.mock("@vercel/blob", () => ({
  put: () => {
    throw new Error(
      "Vercel Blob ne doit pas être appelé : le fournisseur échoue avant toute sortie"
    );
  },
}));
vi.mock("@/lib/images/store", async (importOriginal) =>
  (await import("./store-mock")).imageStoreModule(importOriginal)
);

import { POST as retouchRoute } from "@/app/api/boucher/images/retouch/route";
import { POST as uploadRoute } from "@/app/api/uploads/image/route";
import { uploadResultSchema } from "@/lib/images/upload-contract";
import { actAsButcherOf, uploadRequest } from "./product-routes-harness";
import { storage } from "./store-mock";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

let store: MemoryImageStore;

beforeEach(() => {
  store = new MemoryImageStore();
  storage.store = store;
  provider.run.mockReset();
  provider.run.mockRejectedValue(new Error("fournisseur indisponible"));
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

function uploadSource(bytes: Uint8Array) {
  return uploadRoute(uploadRequest(bytes, "RETOUCH_SOURCE"));
}

function retouch(body: Record<string, unknown>) {
  return retouchRoute(
    new NextRequest("http://localhost/api/boucher/images/retouch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

const isWebp = (bytes: Uint8Array) =>
  Buffer.from(bytes.subarray(0, 4)).toString("latin1") === "RIFF" &&
  Buffer.from(bytes.subarray(8, 12)).toString("latin1") === "WEBP";

describe("retouche : la source passe par l'envoi commun", () => {
  it("JPEG envoyé en RETOUCH_SOURCE : WebP stocké, ligne UPLOAD / RETOUCH_SOURCE, puis son URL part au fournisseur", async () => {
    const shop = await createTestShop();
    actAsButcherOf(shop.id);
    const jpeg = await makeJpeg({ width: 1200, height: 900 });

    const uploaded = await uploadSource(jpeg);
    expect(uploaded.status).toBe(200);
    const source = uploadResultSchema.parse(((await uploaded.json()) as { data: unknown }).data);

    const res = await retouch({ imageUrl: source.url, preset: "STUDIO_LIGHT", variations: 1 });
    // Le fournisseur simulé échoue : la retouche elle-même ne produit rien (C1-PHOTOS-B).
    expect(res.status).toBe(500);
    const sourceSent = (provider.run.mock.calls[0][1] as { input: { input_image: string } }).input
      .input_image;
    expect(sourceSent).toBe(source.url);

    expect(store.puts).toHaveLength(2);
    expect(store.puts.every((put) => put.contentType === "image/webp" && isWebp(put.bytes))).toBe(
      true
    );
    expect(store.puts.some((put) => Buffer.from(put.bytes).equals(jpeg))).toBe(false);
    expect(store.puts[0].pathname).toMatch(
      new RegExp(`^shops/${shop.id}/retouch-source/[0-9a-f-]{36}\\.webp$`)
    );
    const rows = await prisma.generatedImage.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      model: "UPLOAD",
      prompt: "",
      usage: "RETOUCH_SOURCE",
      shopId: shop.id,
      createdBy: `user_${shop.id}`,
      imageUrl: source.url,
      width: 1200,
      height: 900,
    });
  });

  it("un envoi multipart à la route de retouche : 400, rien stocké, fournisseur non appelé", async () => {
    const shop = await createTestShop();
    actAsButcherOf(shop.id);
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(await makeJpeg({ width: 400, height: 300 }))], {
        type: "image/jpeg",
      }),
      "s.jpg"
    );
    form.append("preset", "STUDIO_LIGHT");

    const res = await retouchRoute(
      new NextRequest("http://localhost/api/boucher/images/retouch", { method: "POST", body: form })
    );

    expect(res.status).toBe(400);
    expect(store.puts).toEqual([]);
    expect(provider.run).not.toHaveBeenCalled();
    expect(await prisma.generatedImage.count()).toBe(0);
  });

  it("la source compte dans le quota de 30 photos par heure de la boutique : 429 au-delà", async () => {
    const shop = await createTestShop();
    actAsButcherOf(shop.id);
    await prisma.generatedImage.createMany({
      data: Array.from({ length: 30 }, (_, i) => ({
        model: "UPLOAD",
        prompt: "",
        usage: "PRODUCT",
        imageUrl: `https://example.test/planted-${i}.webp`,
        shopId: shop.id,
        createdBy: "u",
      })),
    });

    const res = await uploadSource(await makeJpeg({ width: 400, height: 300 }));

    expect(res.status).toBe(429);
    const { error } = (await res.json()) as { error: { message: string } };
    expect(error.message).toMatch(
      /^Limite atteinte : 30 photos par heure\. Réessayez dans \d+ min\.$/
    );
    expect(store.puts).toEqual([]);
  });
});
