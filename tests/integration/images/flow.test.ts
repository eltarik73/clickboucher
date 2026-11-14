// @vitest-environment node
// Une photo envoyée par le boucher arrive partout où le produit s'affiche : après l'envoi
// (POST /api/uploads/image) et l'enregistrement du produit (POST /api/products), le miroir
// Product.imageUrl porte l'URL envoyée, que lisent le tableau cuisine, le panier, la recherche et la
// page boutique. Retirer la photo du produit n'efface jamais le fichier ; la galerie refuse (409)
// de supprimer une photo encore utilisée. Vrais handlers et vrais chargeurs sur PostgreSQL réel :
// seuls l'identité (helpers d'auth) et le transport de stockage (en mémoire) sont simulés.
import { isValidElement, type ReactNode } from "react";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Shop, User } from "@prisma/client";
import type { ImageStore } from "@/lib/images/store";
import { MemoryImageStore } from "../../fixtures/images/memory-store";
import { makeJpeg } from "../../fixtures/images/make-fixtures";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestOrder, createTestShop, createTestUser } from "../helpers/factories";

const session = vi.hoisted(() => ({
  clerkId: null as string | null,
  userId: null as string | null,
  shopId: null as string | null,
  role: undefined as string | undefined,
}));
const storage = vi.hoisted(() => ({ store: null as ImageStore | null }));

vi.mock("@/lib/auth/server-auth", () => ({
  getServerUserId: async () => session.clerkId,
  getBoucherOwnerUserId: async () => session.clerkId,
  resolveUserRole: async () => session.role,
  getTestRole: () => null,
  isTestActivated: () => false,
}));
vi.mock("@/lib/boucher-auth", () => ({
  getAuthenticatedBoucher: async () =>
    session.userId && session.shopId
      ? { userId: session.userId, shopId: session.shopId }
      : { error: new Response(null, { status: 401 }) },
}));
vi.mock("@/lib/images/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/images/store")>()),
  getImageStore: () => storage.store as ImageStore,
}));
// React.cache n'existe que sous la condition « react-server » de Next : hors Next, une identité.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

import { POST as uploadRoute } from "@/app/api/uploads/image/route";
import { POST as createProductRoute } from "@/app/api/products/route";
import { PATCH as updateProductRoute } from "@/app/api/products/[id]/route";
import { GET as getCartRoute, POST as syncCartRoute } from "@/app/api/cart/route";
import { DELETE as deleteGalleryImageRoute } from "@/app/api/boucher/images/[id]/route";
import { ShopProductsClient } from "@/components/shop/ShopProductsClient";
import { searchProducts } from "@/lib/ai-search";
import { buildUploadForm, uploadResultSchema, type UploadResult } from "@/lib/images/upload-contract";
import { getKitchenBoard } from "@/lib/services/orders/kitchen";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const { default: BoutiquePage } = await import("@/app/(client)/boutique/[slug]/page");

type World = { owner: User; customer: User; shop: Shop; categoryId: string };
type ApiBody<T> = { success: boolean; data: T; error?: { code: string; message: string } };
type ProductRow = { id: string; imageUrl: string | null; images: { url: string }[] };

const PRODUCT_NAME = "Onglet photographie";
let store: MemoryImageStore;

beforeEach(() => {
  store = new MemoryImageStore();
  storage.store = store;
});

async function createWorld(): Promise<World> {
  const owner = await createTestUser({ role: "BOUCHER" });
  const customer = await createTestUser();
  const shop = await createTestShop({ ownerId: owner.id });
  const category = await prisma.category.create({ data: { name: "Boeuf", shopId: shop.id } });
  return { owner, customer, shop, categoryId: category.id };
}

function actAsOwner(world: World): void {
  session.clerkId = world.owner.clerkId;
  session.userId = world.owner.id;
  session.shopId = world.shop.id;
  session.role = world.owner.role;
}

function actAsCustomer(world: World): void {
  session.clerkId = world.customer.clerkId;
  session.userId = null;
  session.shopId = null;
  session.role = world.customer.role;
}

function jsonRequest(path: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function read<T>(response: Response): Promise<{ status: number; body: ApiBody<T> }> {
  return { status: response.status, body: (await response.json()) as ApiBody<T> };
}

async function uploadPhoto(): Promise<UploadResult> {
  const jpeg = await makeJpeg({ width: 1200, height: 900 });
  const form = buildUploadForm(new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }), "PRODUCT");
  const request = new NextRequest("http://localhost/api/uploads/image", { method: "POST", body: form });
  const { status, body } = await read<unknown>(await uploadRoute(request));
  expect(status).toBe(200);
  return uploadResultSchema.parse(body.data);
}

async function createProductWith(world: World, url: string): Promise<string> {
  const { status, body } = await read<{ id: string }>(
    await createProductRoute(
      jsonRequest("/api/products", "POST", {
        name: PRODUCT_NAME,
        priceCents: 2890,
        unit: "KG",
        categoryIds: [world.categoryId],
        shopId: world.shop.id,
        images: [{ url }],
      })
    )
  );
  expect(status).toBe(201);
  return body.data.id;
}

async function patchImages(productId: string, images: { url: string }[]): Promise<number> {
  const response = await updateProductRoute(
    jsonRequest(`/api/products/${productId}`, "PATCH", { images }),
    { params: { id: productId } }
  );
  return response.status;
}

function photoRow(productId: string): Promise<ProductRow> {
  return prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: { id: true, imageUrl: true, images: { select: { url: true } } },
  });
}

/** Every prop of every element of a server-rendered tree whose type is `component`. */
function propsOf<P>(node: ReactNode, component: unknown): P[] {
  if (Array.isArray(node)) return node.flatMap((child) => propsOf<P>(child, component));
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  const own = node.type === component ? [node.props as P] : [];
  return [...own, ...propsOf<P>(node.props.children, component)];
}

describe("une photo envoyée puis enregistrée sur un produit", () => {
  it("devient Product.imageUrl et s'affiche en cuisine, au panier, en recherche et sur la page boutique", async () => {
    const world = await createWorld();
    actAsOwner(world);
    const uploaded = await uploadPhoto();
    const productId = await createProductWith(world, uploaded.url);

    expect(await photoRow(productId)).toEqual({
      id: productId,
      imageUrl: uploaded.url,
      images: [{ url: uploaded.url }],
    });

    await createTestOrder({
      shopId: world.shop.id,
      userId: world.customer.id,
      items: [{ productId }],
    });
    const board = await getKitchenBoard(world.shop.id);
    expect(board.active.flatMap((order) => order.items.map((item) => item.product.imageUrl))).toEqual([
      uploaded.url,
    ]);

    actAsCustomer(world);
    const synced = await syncCartRoute(
      jsonRequest("/api/cart", "POST", {
        shopId: world.shop.id,
        items: [{ productId, quantity: 1, weightGrams: 500 }],
      })
    );
    expect(synced.status).toBe(200);
    const cart = await read<{ items: { productId: string; imageUrl: string }[] }>(await getCartRoute());
    expect(cart.body.data.items).toEqual([expect.objectContaining({ productId, imageUrl: uploaded.url })]);

    const found = (await searchProducts(PRODUCT_NAME, world.shop.id)) as { id: string; imageUrl: string | null }[];
    expect(found.map((result) => [result.id, result.imageUrl])).toEqual([[productId, uploaded.url]]);

    const tree = await BoutiquePage({ params: { slug: world.shop.slug } });
    const [catalogue] = propsOf<{ products: { id: string; imageUrl: string | null; images: { url: string }[] }[] }>(
      tree,
      ShopProductsClient
    );
    expect(catalogue.products).toEqual([
      expect.objectContaining({
        id: productId,
        imageUrl: uploaded.url,
        images: [expect.objectContaining({ url: uploaded.url, isPrimary: true })],
      }),
    ]);
  });

  it("retirer la photo du produit n'efface aucun fichier ; la galerie refuse (409) de supprimer la photo remise", async () => {
    const world = await createWorld();
    actAsOwner(world);
    const uploaded = await uploadPhoto();
    const productId = await createProductWith(world, uploaded.url);

    expect(await patchImages(productId, [])).toBe(200);
    expect(await photoRow(productId)).toEqual({ id: productId, imageUrl: null, images: [] });
    expect(store.dels).toEqual([]);
    expect(store.files.has(uploaded.url) && store.files.has(uploaded.thumbUrl)).toBe(true);

    expect(await patchImages(productId, [{ url: uploaded.url }])).toBe(200);
    expect((await photoRow(productId)).imageUrl).toBe(uploaded.url);

    const response = await deleteGalleryImageRoute(
      new NextRequest(`http://localhost/api/boucher/images/${uploaded.id}`, { method: "DELETE" }),
      { params: { id: uploaded.id } }
    );
    const { status, body } = await read<never>(response);
    expect(status).toBe(409);
    expect(body.error?.code).toBe("CONFLICT");
    expect(body.error?.message).toContain(PRODUCT_NAME);
    expect(store.dels).toEqual([]);
    expect(store.files.has(uploaded.url) && store.files.has(uploaded.thumbUrl)).toBe(true);
    expect(await prisma.generatedImage.count({ where: { id: uploaded.id } })).toBe(1);
  });
});
