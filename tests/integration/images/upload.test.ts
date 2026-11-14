// @vitest-environment node
// POST /api/uploads/image sur la vraie base (schéma itest) : le formulaire construit par
// buildUploadForm, la ligne de registre écrite, le périmètre (boutique de la session ou
// plateforme), le quota de 30 photos par heure compté en base, et chaque refus sans ligne écrite.
// Seuls l'identité (helpers d'auth) et le transport de stockage (stockage en mémoire) sont simulés.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageStore } from "@/lib/images/store";
import { MemoryImageStore } from "../../fixtures/images/memory-store";
import { makeBytesOfSize, makeHtmlDeclaredJpeg, makeJpeg } from "../../fixtures/images/make-fixtures";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestShop } from "../helpers/factories";

const session = vi.hoisted(() => ({
  clerkId: null as string | null,
  boucher: null as unknown,
  admin: null as unknown,
}));
const helpers = vi.hoisted(() => ({
  getAuthenticatedBoucher: vi.fn(async () => session.boucher),
  requireAdmin: vi.fn(async () => session.admin),
}));
const storage = vi.hoisted(() => ({ store: null as ImageStore | null, unavailable: false }));

vi.mock("@/lib/auth/server-auth", () => ({
  getServerUserId: async () => session.clerkId,
  getBoucherOwnerUserId: async () => session.clerkId,
  getTestRole: () => null,
  isTestActivated: () => false,
}));
vi.mock("@/lib/boucher-auth", () => ({ getAuthenticatedBoucher: helpers.getAuthenticatedBoucher }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: helpers.requireAdmin }));
vi.mock("@/lib/images/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/images/store")>();
  const { StoreUnavailableError } = await import("@/lib/images/errors");
  return {
    ...actual,
    getImageStore: () => {
      if (storage.unavailable || storage.store === null) throw new StoreUnavailableError();
      return storage.store;
    },
  };
});

import { POST } from "@/app/api/uploads/image/route";
import { apiError } from "@/lib/api/errors";
import { buildUploadForm, UPLOAD_MESSAGES_FR, uploadResultSchema, type UploadPurpose } from "@/lib/images/upload-contract";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const MINUTE_MS = 60_000;
let store: MemoryImageStore;

function asBoucher(shopId: string, userId = `user_db_${shopId}`) {
  session.clerkId = `clerk_${userId}`;
  session.boucher = { userId, shopId };
  session.admin = { error: apiError("FORBIDDEN", "Accès réservé aux administrateurs") };
}

function asAdmin(clerkId = "user_admin_itest") {
  session.clerkId = clerkId;
  session.admin = { userId: clerkId };
  session.boucher = { error: apiError("FORBIDDEN", "Accès réservé aux bouchers") };
}

function upload(bytes: Uint8Array, purpose: UploadPurpose | string, type = "image/jpeg") {
  const file = new Blob([new Uint8Array(bytes)], { type });
  const form = buildUploadForm(file, purpose as UploadPurpose);
  return POST(new NextRequest("http://localhost/api/uploads/image", { method: "POST", body: form }));
}

async function errorOf(res: Response) {
  return ((await res.json()) as { error: { code: string; message: string } }).error;
}

async function plantUploads(shopId: string | null, count: number, minutesAgo: number, model = "UPLOAD", createdBy = "x") {
  await prisma.generatedImage.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      model,
      prompt: "",
      usage: "PRODUCT",
      imageUrl: `https://example.test/planted-${shopId ?? "platform"}-${minutesAgo}-${i}.webp`,
      shopId,
      createdBy,
      createdAt: new Date(Date.now() - minutesAgo * MINUTE_MS),
    })),
  });
}

beforeEach(() => {
  store = new MemoryImageStore();
  storage.store = store;
  storage.unavailable = false;
  helpers.getAuthenticatedBoucher.mockClear();
  helpers.requireAdmin.mockClear();
});

describe("POST /api/uploads/image — envoi accepté", () => {
  it("PRODUCT sans identifiant de produit : 200, résultat conforme au contrat, une ligne UPLOAD de la boutique", async () => {
    const shop = await createTestShop();
    asBoucher(shop.id);

    const res = await upload(await makeJpeg({ width: 1600, height: 1200 }), "PRODUCT");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown };
    expect(body.success).toBe(true);
    const result = uploadResultSchema.parse(body.data);
    expect(result.url).toContain(`/shops/${shop.id}/product/`);
    expect(store.files.has(result.url) && store.files.has(result.thumbUrl)).toBe(true);

    const rows = await prisma.generatedImage.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: result.id,
      model: "UPLOAD",
      prompt: "",
      usage: "PRODUCT",
      shopId: shop.id,
      createdBy: `user_db_${shop.id}`,
      imageUrl: result.url,
      width: 1600,
      height: 1200,
    });
  });

  it("RETOUCH_SOURCE : ligne d'usage RETOUCH_SOURCE dans la boutique", async () => {
    const shop = await createTestShop();
    asBoucher(shop.id);
    const res = await upload(await makeJpeg({ width: 800, height: 600 }), "RETOUCH_SOURCE");
    expect(res.status).toBe(200);
    const rows = await prisma.generatedImage.findMany();
    expect(rows.map((row) => [row.usage, row.shopId])).toEqual([["RETOUCH_SOURCE", shop.id]]);
    expect(rows[0].imageUrl).toContain(`/shops/${shop.id}/retouch-source/`);
  });

  it("REFERENCE par un administrateur : photo de la plateforme (shopId null) sous platform/reference/", async () => {
    asAdmin();
    const res = await upload(await makeJpeg({ width: 800, height: 600 }), "REFERENCE");
    expect(res.status).toBe(200);
    const rows = await prisma.generatedImage.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ shopId: null, usage: "PRODUCT", model: "UPLOAD", createdBy: "user_admin_itest" });
    expect(rows[0].imageUrl).toMatch(/\/platform\/reference\/[0-9a-f-]{36}\.webp$/);
    expect(helpers.getAuthenticatedBoucher).not.toHaveBeenCalled();
  });
});

describe("POST /api/uploads/image — refus", () => {
  it("sans session : 401, aucun helper d'accès appelé", async () => {
    session.clerkId = null;
    const res = await upload(await makeJpeg({ width: 100, height: 100 }), "PRODUCT");
    expect(res.status).toBe(401);
    expect(helpers.getAuthenticatedBoucher).not.toHaveBeenCalled();
    expect(await prisma.generatedImage.count()).toBe(0);
  });

  it("REFERENCE par un boucher : 403 (réponse de requireAdmin), rien d'écrit", async () => {
    const shop = await createTestShop();
    asBoucher(shop.id);
    const res = await upload(await makeJpeg({ width: 100, height: 100 }), "REFERENCE");
    expect(res.status).toBe(403);
    expect(store.puts).toEqual([]);
    expect(await prisma.generatedImage.count()).toBe(0);
  });

  it("31e photo de l'heure pour la boutique A : 429 en français ; la boutique B passe", async () => {
    const shopA = await createTestShop();
    const shopB = await createTestShop();
    await plantUploads(shopA.id, 30, 10);
    // Ne comptent pas : envois de plus d'une heure, images générées par l'IA.
    await plantUploads(shopB.id, 30, 61);
    await plantUploads(shopB.id, 30, 5, "FLUX_SCHNELL");

    asBoucher(shopA.id);
    const refused = await upload(await makeJpeg({ width: 100, height: 100 }), "PRODUCT");
    expect(refused.status).toBe(429);
    expect(refused.headers.get("retry-after")).toBe(String(50 * 60));
    expect(await errorOf(refused)).toEqual({ code: "RATE_LIMITED", message: UPLOAD_MESSAGES_FR.QUOTA(50) });
    expect(store.puts).toEqual([]);

    asBoucher(shopB.id);
    expect((await upload(await makeJpeg({ width: 100, height: 100 }), "PRODUCT")).status).toBe(200);
    expect(await prisma.generatedImage.count({ where: { shopId: shopA.id } })).toBe(30);
  });

  it("le quota d'un administrateur est le sien, pas celui des boutiques", async () => {
    await plantUploads(null, 30, 20, "UPLOAD", "user_admin_itest");
    asAdmin("user_admin_itest");
    expect((await upload(await makeJpeg({ width: 100, height: 100 }), "REFERENCE")).status).toBe(429);
    asAdmin("user_admin_other");
    expect((await upload(await makeJpeg({ width: 100, height: 100 }), "REFERENCE")).status).toBe(200);
  });

  it("4,2 Mio : 422 IMAGE_REJECTED, aucune ligne, aucun fichier", async () => {
    const shop = await createTestShop();
    asBoucher(shop.id);
    const res = await upload(makeBytesOfSize(Math.round(4.2 * 1024 * 1024)), "PRODUCT");
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toEqual({ code: "IMAGE_REJECTED", message: UPLOAD_MESSAGES_FR.TOO_LARGE });
    expect(store.puts).toEqual([]);
    expect(await prisma.generatedImage.count()).toBe(0);
  });

  it("Content-Length au-delà de 4 Mio + 64 Kio : 422 sans lire le corps ni appeler l'accès boutique", async () => {
    const shop = await createTestShop();
    asBoucher(shop.id);
    const req = new NextRequest("http://localhost/api/uploads/image", {
      method: "POST",
      headers: { "content-length": String(5 * 1024 * 1024) },
      body: buildUploadForm(new Blob([new Uint8Array([1])]), "PRODUCT"),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
    expect(req.bodyUsed).toBe(false);
    expect(helpers.getAuthenticatedBoucher).not.toHaveBeenCalled();
  });

  it("une page HTML annoncée image/jpeg : 422, aucune ligne", async () => {
    const shop = await createTestShop();
    asBoucher(shop.id);
    const res = await upload(makeHtmlDeclaredJpeg(), "PRODUCT");
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toEqual({ code: "IMAGE_REJECTED", message: UPLOAD_MESSAGES_FR.UNSUPPORTED_FORMAT });
    expect(await prisma.generatedImage.count()).toBe(0);
  });

  it("formulaire incomplet ou corps non multipart : 400 en français", async () => {
    const shop = await createTestShop();
    asBoucher(shop.id);
    const unknownPurpose = await upload(await makeJpeg({ width: 100, height: 100 }), "AVATAR");
    expect(unknownPurpose.status).toBe(400);
    expect((await errorOf(unknownPurpose)).message).toBe(UPLOAD_MESSAGES_FR.BAD_PURPOSE);

    const noFile = new FormData();
    noFile.append("purpose", "PRODUCT");
    const missing = await POST(new NextRequest("http://localhost/api/uploads/image", { method: "POST", body: noFile }));
    expect(missing.status).toBe(400);
    expect((await errorOf(missing)).message).toBe(UPLOAD_MESSAGES_FR.NO_FILE);

    const json = await POST(
      new NextRequest("http://localhost/api/uploads/image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose: "PRODUCT" }),
      })
    );
    expect(json.status).toBe(400);
    expect(await prisma.generatedImage.count()).toBe(0);
  });

  it("stockage indisponible : 503 SERVICE_DISABLED avec le message français, aucune ligne", async () => {
    const shop = await createTestShop();
    asBoucher(shop.id);
    storage.unavailable = true;
    const res = await upload(await makeJpeg({ width: 100, height: 100 }), "PRODUCT");
    expect(res.status).toBe(503);
    expect(await errorOf(res)).toEqual({ code: "SERVICE_DISABLED", message: UPLOAD_MESSAGES_FR.STORE_UNAVAILABLE });
    expect(await prisma.generatedImage.count()).toBe(0);
  });
});
