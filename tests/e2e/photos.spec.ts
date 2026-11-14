// Parcours photos de bout en bout (chantier C1-PHOTOS-A), sur un build de production local en mode
// test : une photo envoyée par le boucher arrive droite, enregistrée, et s'affiche partout où le
// produit se montre ; un envoi en échec se dit en français et bloque « Enregistrer » ; une photo
// morte ou expirante ne déclenche aucune boucle de requêtes et se replie sur une photo locale.
//
// Lancement : PLAYWRIGHT_BASE_URL=http://localhost:<port> E2E_TEST_SECRET=<TEST_SECRET du serveur>
//   DATABASE_URL=<base locale du serveur> npx playwright test tests/e2e/photos.spec.ts --project=chromium
// Sans E2E_TEST_SECRET le parcours est ignoré ; un site ou une base non locaux lèvent une erreur
// avant toute requête (photos-helpers.ts, e2eTarget).
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { imageBlobHost } from "@/lib/images/durable-url";
import { resolveProductPhoto } from "@/lib/images/product-photo";
import { UPLOAD_MESSAGES_FR } from "@/lib/images/upload-contract";
import {
  acceptOrder, addToCartFromStorefront, e2eTarget, escapeRegExp, expectPhotoLoaded, myShop, openAs,
  orderFromCart, photosNamed, routeDeadPhotos, seededPhotoProducts, showing, unloadedImages,
  uploadThroughField, watchPhotoRequests, writePhotoFixtures,
  type E2eTarget, type PhotoFixtures, type SeededProduct, type ShopInfo, type TestRole,
} from "./photos-helpers";

const target = e2eTarget();
test.skip(target === null, "E2E_TEST_SECRET absent : parcours photos non lancé.");
test.describe.configure({ mode: "serial", timeout: 120_000 });

const RUN = randomUUID().slice(0, 8);
const REPLICATE_URL = "https://x.replicate.delivery/a.png";
const LOCAL_PHOTO = /[?&]url=%2Fimg%2Fproducts%2F[a-z0-9-]+\.(jpg|jpeg|png|webp)(&|$)/;
const BLOCKING = "Terminez ou retirez les photos en erreur avant d'enregistrer.";
const softExpect = expect.configure({ soft: true });

let prisma: PrismaClient;
let fixtures: PhotoFixtures;
let shop: ShopInfo;
const sessions = new Map<TestRole, BrowserContext>();
let edited: SeededProduct | null = null;
let planted: { a: SeededProduct; b: SeededProduct } | null = null;

function site(): E2eTarget {
  if (target === null) throw new Error("Parcours photos lancé sans E2E_TEST_SECRET.");
  return target;
}

function session(role: TestRole): BrowserContext {
  const context = sessions.get(role);
  if (!context) throw new Error(`Aucune session ${role} ouverte.`);
  return context;
}

async function openNewProductForm(page: Page, name: string | null): Promise<void> {
  await page.goto("/boucher/produits/nouveau");
  await expect(page.getByRole("heading", { name: "Nouveau produit" })).toBeVisible({ timeout: 15_000 });
  if (name === null) return;
  await page.getByPlaceholder("Ex: Entrecote maturee").fill(name);
  await page.getByPlaceholder("Description courte du produit...").fill("Pièce de test du parcours photos");
  await page.getByRole("button", { name: /France$/ }).click();
  await chooseFirstCategory(page);
  await page.getByPlaceholder("0,00").fill("14.90");
}

async function chooseFirstCategory(page: Page): Promise<void> {
  const category = shop.categories[0];
  await page.getByRole("button", { name: new RegExp(`${escapeRegExp(category.name)}$`) }).click();
}

/** « Enregistrer » d'un nouveau produit : la réponse 201 de POST /api/products. */
async function saveNewProduct(page: Page): Promise<{ id: string; imageUrl: string | null; images: { url: string }[] }> {
  const answer = page.waitForResponse(
    (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/products"
  );
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  const response = await answer;
  expect(response.status(), "création du produit").toBe(201);
  return ((await response.json()) as { data: { id: string; imageUrl: string | null; images: { url: string }[] } }).data;
}

test.beforeAll(async ({ browser, baseURL }) => {
  expect(new URL(baseURL ?? "").origin, "baseURL de la configuration").toBe(site().origin);
  prisma = new PrismaClient({ datasources: { db: { url: site().databaseUrl } } });
  fixtures = await writePhotoFixtures();
  for (const role of ["CLIENT", "BOUCHER", "ADMIN"] as const) sessions.set(role, await openAs(browser, site(), role));
  shop = await myShop(session("BOUCHER"));
});

test.afterAll(async () => {
  if (planted !== null) {
    const { a, b } = planted;
    await prisma.productImage.deleteMany({ where: { productId: b.id, url: REPLICATE_URL } });
    await prisma.product.update({ where: { id: a.id }, data: { imageUrl: a.imageUrl } });
    await prisma.product.update({ where: { id: b.id }, data: { imageUrl: b.imageUrl } });
  }
  for (const context of Array.from(sessions.values())) await context.close();
  await prisma?.$disconnect();
  if (fixtures) rmSync(fixtures.dir, { recursive: true, force: true });
});

test("1. « Photo actuelle » : un produit du seed à imageUrl seule montre sa photo /img dans le formulaire", async () => {
  const [product] = await seededPhotoProducts(prisma, shop.id);
  expect(product, "un produit du seed n'ayant qu'une photo /img").toBeDefined();
  edited = product;
  const page = await session("BOUCHER").newPage();
  await page.goto(`/boucher/produits/${product.id}/modifier`);
  await expect(page.getByRole("heading", { name: "Modifier le produit" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Photo actuelle", { exact: true })).toBeVisible();
  await expectPhotoLoaded(photosNamed(page, "Photo 1"), showing(product.imageUrl));
});

test("2. photo de téléphone EXIF 6 : vignette droite, enregistrée, puis en boutique, au panier, en recherche et en cuisine", async () => {
  if (edited === null) throw new Error("Le scénario 1 n'a pas choisi de produit.");
  const product = edited;
  const name = `Onglet photo ${RUN}`;
  const page = await session("BOUCHER").newPage();
  await page.goto(`/boucher/produits/${product.id}/modifier`);
  await expect(page.getByText("Photo actuelle", { exact: true })).toBeVisible({ timeout: 15_000 });

  const uploaded = await uploadThroughField(page, fixtures.phoneJpeg);
  expect(uploaded.height, "photo stockée en portrait").toBeGreaterThan(uploaded.width);
  await expect(page.getByText("Photo actuelle", { exact: true })).toBeHidden();
  const tile = photosNamed(page, "Photo 1");
  await expectPhotoLoaded(tile, uploaded.thumbUrl);
  const [width, height] = await tile.evaluate((img) =>
    img instanceof HTMLImageElement ? [img.naturalWidth, img.naturalHeight] : [0, 0]
  );
  expect(height, "vignette droite (portrait)").toBeGreaterThan(width);

  await page.getByPlaceholder("Ex: Entrecote maturee").fill(name);
  await page.getByPlaceholder("0,00").fill("14.90");
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/products/${product.id}`
  );
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  expect((await saved).status(), "enregistrement du produit").toBe(200);
  await page.waitForURL("**/boucher/produits");
  await page.goto(`/boucher/produits/${product.id}/modifier`);
  await expectPhotoLoaded(photosNamed(page, "Photo 1"), uploaded.thumbUrl);
  await expect(page.getByText("Photo actuelle", { exact: true })).toBeHidden();

  const uploadedPhoto = showing(uploaded.url, uploaded.thumbUrl);
  const shopper = await session("CLIENT").newPage();
  await shopper.goto(`/boutique/${shop.slug}`);
  await expectPhotoLoaded(photosNamed(shopper, name), uploadedPhoto);
  await addToCartFromStorefront(shopper, name, product.unit);
  await shopper.goto("/panier");
  await expectPhotoLoaded(photosNamed(shopper, name), uploadedPhoto);
  const orderId = await orderFromCart(shopper, [product.id]);
  // /recherche ne lit pas ?q= : le client tape le nom dans le champ de recherche de la page.
  await shopper.goto("/recherche");
  await shopper.getByRole("searchbox").fill(name);
  await expectPhotoLoaded(photosNamed(shopper, name), uploadedPhoto);

  await acceptOrder(session("BOUCHER"), orderId);
  await page.goto("/boucher/commandes");
  await expectPhotoLoaded(photosNamed(page, name), uploadedPhoto);
});

test("3. « Nouveau produit » avec une photo envoyée : enregistré et affiché en boutique", async () => {
  const name = `Brochette photo ${RUN}`;
  const page = await session("BOUCHER").newPage();
  await openNewProductForm(page, name);
  const uploaded = await uploadThroughField(page, fixtures.phoneJpeg);
  const created = await saveNewProduct(page);
  expect(created.imageUrl).toBe(uploaded.url);
  expect(created.images.map((image) => image.url)).toEqual([uploaded.url]);

  const shopper = await session("CLIENT").newPage();
  await shopper.goto(`/boutique/${shop.slug}`);
  await expectPhotoLoaded(photosNamed(shopper, name), showing(uploaded.url, uploaded.thumbUrl));
});

test("4. produit importé du catalogue de référence : sa photo /img est gardée à l'enregistrement", async () => {
  const reference = await prisma.referenceProduct.findFirstOrThrow({
    where: { imageUrl: { startsWith: "/img/products/" }, images: { none: {} }, origin: { not: null } },
    orderBy: { name: "asc" },
    select: { name: true, imageUrl: true },
  });
  const photo = reference.imageUrl as string;
  const page = await session("ADMIN").newPage();
  await openNewProductForm(page, null);
  await page.getByRole("button", { name: "Importer depuis le catalogue" }).click();
  await page.getByRole("button", { name: new RegExp(`^${escapeRegExp(reference.name)}(\\s|$)`) }).click();
  await expect(page.getByPlaceholder("Ex: Entrecote maturee")).toHaveValue(reference.name);
  await expectPhotoLoaded(photosNamed(page, "Photo 1"), showing(photo));
  await page.getByPlaceholder("Description courte du produit...").fill("Importé du catalogue de référence");
  await chooseFirstCategory(page);
  const created = await saveNewProduct(page);
  expect(created.imageUrl).toBe(photo);
  expect(created.images.map((image) => image.url)).toEqual([photo]);
});

test("5. envoi en échec (504 text/plain) : message français, Réessayer, Enregistrer bloqué jusqu'à Réessayer ou Retirer", async () => {
  const page = await session("BOUCHER").newPage();
  await openNewProductForm(page, `Gigot photo ${RUN}`);
  const save = page.getByRole("button", { name: "Enregistrer", exact: true });
  await expect(save).toBeEnabled();
  const failUploads = () =>
    page.route("**/api/uploads/image", (route) =>
      route.fulfill({ status: 504, contentType: "text/plain", body: "An error occurred with your deployment\n\nFUNCTION_INVOCATION_TIMEOUT" })
    );

  await failUploads();
  await page.getByLabel("Ajouter une photo").setInputFiles(fixtures.phoneJpeg);
  await expect(page.getByRole("alert").filter({ hasText: UPLOAD_MESSAGES_FR.TIMEOUT })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: BLOCKING })).toBeVisible();
  await expect(save).toBeDisabled();
  await page.unroute("**/api/uploads/image");
  const retried = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/uploads/image");
  await page.getByRole("button", { name: "Réessayer (photo 1)" }).click();
  expect((await retried).status(), "nouvel envoi").toBe(200);
  await expect(save).toBeEnabled();
  await expect(page.getByRole("alert").filter({ hasText: UPLOAD_MESSAGES_FR.TIMEOUT })).toHaveCount(0);

  await failUploads();
  await page.getByLabel("Ajouter une photo").setInputFiles(fixtures.transparentPng);
  await expect(page.getByRole("button", { name: "Réessayer (photo 2)" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: UPLOAD_MESSAGES_FR.TIMEOUT })).toBeVisible();
  await expect(save).toBeDisabled();
  await page.getByRole("button", { name: "Retirer (photo 2)" }).click();
  await expect(page.getByRole("button", { name: "Réessayer (photo 2)" })).toHaveCount(0);
  await expect(save).toBeEnabled();
  await expect(photosNamed(page, "Photo 1")).toBeVisible();
  await page.unroute("**/api/uploads/image");
});

test("6. photo morte ou expirante : une requête au plus par candidate, repli local ; cuisine et panier sans image cassée", async () => {
  const pool = (await seededPhotoProducts(prisma, shop.id)).filter((product) => product.id !== edited?.id).reverse();
  const [a, b] = pool;
  expect(b, "deux produits du seed n'ayant qu'une photo /img").toBeDefined();
  const dead = `https://${imageBlobHost()}/e2e/dead-${randomUUID()}.webp`;
  planted = { a, b };
  await prisma.product.update({ where: { id: a.id }, data: { imageUrl: dead } });
  await prisma.product.update({
    where: { id: b.id },
    data: { imageUrl: REPLICATE_URL, images: { create: [{ url: REPLICATE_URL, alt: b.name, order: 0, isPrimary: true }] } },
  });
  const deadCandidates = resolveProductPhoto({ imageUrl: dead, name: a.name, category: a.category }).candidates;
  const expiringCandidates = resolveProductPhoto({
    images: [{ url: REPLICATE_URL, isPrimary: true, order: 0 }],
    imageUrl: REPLICATE_URL,
    name: b.name,
    category: b.category,
  }).candidates;
  expect(deadCandidates[0]).toBe(dead);
  expect(expiringCandidates.join(" ")).not.toContain("replicate.delivery");
  for (const role of ["CLIENT", "BOUCHER"] as const) await routeDeadPhotos(session(role), dead);

  const shopper = await session("CLIENT").newPage();
  const watched = Array.from(new Set([...deadCandidates, ...expiringCandidates]));
  const { counts, violation } = await watchPhotoRequests(shopper, site().origin, watched, 10_000, async () => {
    await shopper.goto(`/boutique/${shop.slug}`);
    await expectPhotoLoaded(photosNamed(shopper, a.name), LOCAL_PHOTO);
    await expectPhotoLoaded(photosNamed(shopper, b.name), LOCAL_PHOTO);
  });
  expect(violation, "requête d'image en trop pendant 10 s").toBeNull();
  expect(counts.get(dead), "la photo morte est essayée une fois").toBe(1);
  for (const candidate of watched) expect(counts.get(candidate) ?? 0, candidate).toBeLessThanOrEqual(1);
  expect(Array.from(counts.keys()).filter((url) => url.includes("replicate.delivery"))).toEqual([]);

  await addToCartFromStorefront(shopper, a.name, a.unit);
  await addToCartFromStorefront(shopper, b.name, b.unit);
  const orderId = await orderFromCart(shopper, [a.id, b.id]);
  await acceptOrder(session("BOUCHER"), orderId);

  const kitchen = await session("BOUCHER").newPage();
  await kitchen.goto("/boucher/commandes");
  for (const name of [a.name, b.name]) {
    await expect(photosNamed(kitchen, name).first()).toBeVisible({ timeout: 15_000 });
    for (const img of await photosNamed(kitchen, name).all()) await expectPhotoLoaded(img, LOCAL_PHOTO);
  }
  await softExpect.poll(() => unloadedImages(kitchen), { timeout: 30_000, message: "cuisine : images non affichées" }).toEqual([]);
  await shopper.goto("/panier");
  await expect(shopper.getByText(a.name, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await softExpect.poll(() => unloadedImages(shopper), { timeout: 30_000, message: "panier : images non affichées" }).toEqual([]);
});

test("7. PNG transparent : le fond transparent devient blanc dans la photo stockée", async () => {
  const page = await session("BOUCHER").newPage();
  await openNewProductForm(page, null);
  const uploaded = await uploadThroughField(page, fixtures.transparentPng);
  const stored = await session("BOUCHER").request.get(uploaded.url);
  expect(stored.status()).toBe(200);
  expect(stored.headers()["content-type"]).toBe("image/webp");
  const { data, info } = await sharp(await stored.body()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  expect([info.width, info.height]).toEqual([600, 400]);
  const pixel = (x: number, y: number) => {
    const offset = (y * info.width + x) * info.channels;
    return [data[offset], data[offset + 1], data[offset + 2]];
  };
  expect(Math.min(...pixel(75, 200)), "ancien pixel transparent : blanc").toBeGreaterThanOrEqual(245);
  const [red, green] = pixel(525, 200);
  expect(red, "moitié opaque : rouge").toBeGreaterThan(180);
  expect(green).toBeLessThan(90);
});
