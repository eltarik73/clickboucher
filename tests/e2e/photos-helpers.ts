// tests/e2e/photos-helpers.ts — outils du parcours photos (tests/e2e/photos.spec.ts).
//
// Cible : un build de production local (`next start`) en mode test, sur une base locale jetable.
// e2eTarget() lève une erreur AVANT toute requête si l'adresse du site ou la base ne sont pas
// locales : ce parcours écrit (photos, produits, commandes) et ne doit jamais viser klikandgo.app.
// Les sessions s'ouvrent par POST /api/test-mode/activate ; la base n'est lue par Prisma que pour
// choisir des produits du seed, et écrite seulement pour planter puis rétablir les photos mortes.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { errors, expect, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import type { PrismaClient, Unit } from "@prisma/client";
import type { CartState } from "@/lib/cart/cart-line";
import { buildCreateOrderRequest, buildQuoteRequest, type CheckoutSelection } from "@/lib/cart/order-payload";
import { normalizeStoredCart } from "@/lib/cart/stored-cart";
import { uploadResultSchema, type UploadResult } from "@/lib/images/upload-contract";
import { makeJpeg, makeTransparentPng } from "../fixtures/images/make-fixtures";

export type TestRole = "CLIENT" | "BOUCHER" | "ADMIN";

export interface E2eTarget {
  baseURL: string;
  origin: string;
  databaseUrl: string;
  secret: string;
}

const LOCAL_SITE = /^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}\/?$/;
const LOCAL_DB_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const DB_HOST = /^postgres(?:ql)?:\/\/(?:[^@/]*@)?(\[[^\]]+\]|[^:/?#]+)/;

/**
 * null sans E2E_TEST_SECRET (le parcours est ignoré). Sinon le site visé et la base doivent être
 * locaux, ou une erreur est levée avant la moindre requête. Le message ne cite jamais l'URL de la
 * base (elle porte le mot de passe), seulement son hôte.
 */
export function e2eTarget(env: NodeJS.ProcessEnv = process.env): E2eTarget | null {
  const secret = env.E2E_TEST_SECRET;
  if (!secret) return null;
  const baseURL = env.PLAYWRIGHT_BASE_URL ?? "";
  if (!LOCAL_SITE.test(baseURL)) {
    throw new Error(
      `Parcours photos refusé : PLAYWRIGHT_BASE_URL doit être http://localhost:<port> ou ` +
        `http://127.0.0.1:<port> (reçu « ${baseURL || "absent"} »). Jamais la production.`
    );
  }
  const databaseUrl = env.DATABASE_URL ?? "";
  const host = DB_HOST.exec(databaseUrl)?.[1] ?? "";
  if (!LOCAL_DB_HOSTS.has(host)) {
    throw new Error(`Parcours photos refusé : DATABASE_URL doit viser une base locale (hôte « ${host || "absent"} »).`);
  }
  const trimmed = baseURL.replace(/\/$/, "");
  return { baseURL: trimmed, origin: new URL(trimmed).origin, databaseUrl, secret };
}

/** Un contexte de navigateur dont la session de test (jeton signé) a le rôle demandé. */
export async function openAs(browser: Browser, target: E2eTarget, role: TestRole): Promise<BrowserContext> {
  const context = await browser.newContext({
    baseURL: target.baseURL,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    serviceWorkers: "block",
  });
  const activated = await context.request.post("/api/test-mode/activate", {
    data: { secret: target.secret, role },
  });
  expect(activated.status(), `activation du mode test (${role})`).toBe(200);
  // Le mode cuisine attend un geste pour débloquer le son : la session le considère déjà fait.
  await context.addInitScript(() => window.sessionStorage.setItem("audioUnlocked", "true"));
  return context;
}

export interface PhotoFixtures {
  dir: string;
  /** ≈ 3 Mo, 4032 x 3024 stockés, orientation EXIF 6 : une photo de téléphone tenu en portrait. */
  phoneJpeg: string;
  /** 600 x 400, moitié gauche transparente, moitié droite rouge. */
  transparentPng: string;
}

/** Fabrique les photos de test dans un dossier temporaire (rien de binaire n'est suivi par git). */
export async function writePhotoFixtures(): Promise<PhotoFixtures> {
  const dir = mkdtempSync(path.join(tmpdir(), "klikgo-photos-e2e-"));
  const phoneJpeg = path.join(dir, "telephone-portrait.jpg");
  const transparentPng = path.join(dir, "fond-transparent.png");
  writeFileSync(phoneJpeg, await makeJpeg({ width: 4032, height: 3024, orientation: 6, noise: 40, quality: 82 }));
  writeFileSync(transparentPng, await makeTransparentPng());
  return { dir, phoneJpeg, transparentPng };
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Motif d'un src qui affiche l'une de ces URL, directement ou par l'optimiseur (/_next/image?url=…). */
export function showing(...urls: string[]): RegExp {
  const forms = urls.flatMap((url) => [
    `^${escapeRegExp(url)}$`,
    `[?&]url=${escapeRegExp(encodeURIComponent(url))}(&|$)`,
  ]);
  return new RegExp(forms.map((form) => `(${form})`).join("|"));
}

/** Les images visibles nommées `name` (texte alternatif exact). */
export function photosNamed(page: Page, name: string): Locator {
  return page.getByRole("img", { name, exact: true }).filter({ visible: true });
}

/** L'image affiche `src` et l'a réellement chargée (naturalWidth > 0). */
export async function expectPhotoLoaded(img: Locator, src: string | RegExp, timeout = 15_000): Promise<void> {
  await img.scrollIntoViewIfNeeded({ timeout });
  await expect(img).toHaveAttribute("src", src, { timeout });
  await expect
    .poll(() => img.evaluate((el) => (el instanceof HTMLImageElement && el.complete ? el.naturalWidth : 0)), { timeout })
    .toBeGreaterThan(0);
}

/**
 * Images visibles pas (encore) affichées : en attente ou cassées (naturalWidth 0). Fait défiler
 * jusqu'à la première image en attente, pour que le chargement différé la demande.
 */
export function unloadedImages(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const unloaded: string[] = [];
    let scrolled = false;
    for (const img of Array.from(document.images)) {
      if (img.getClientRects().length === 0) continue;
      if (img.complete && img.naturalWidth > 0) continue;
      if (!img.complete && !scrolled) {
        img.scrollIntoView({ block: "center" });
        scrolled = true;
      }
      unloaded.push(`${img.complete ? "cassée" : "en attente"} : ${img.alt || "(sans alt)"} → ${img.currentSrc || img.src}`);
    }
    return unloaded;
  });
}

/** Envoie `file` par le champ « Ajouter une photo » et rend la réponse 200 de l'envoi. */
export async function uploadThroughField(page: Page, file: string): Promise<UploadResult> {
  const answer = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/uploads/image" && response.request().method() === "POST"
  );
  await page.getByLabel("Ajouter une photo").setInputFiles(file);
  const response = await answer;
  expect(response.status(), "réponse de POST /api/uploads/image").toBe(200);
  return uploadResultSchema.parse(((await response.json()) as { data: unknown }).data);
}

/** Ajoute un produit au panier depuis sa carte en boutique (fiche de poids pour KG). */
export async function addToCartFromStorefront(page: Page, productName: string, unit: Unit): Promise<void> {
  const card = page.getByRole("button", { name: productName, exact: true });
  await card.scrollIntoViewIfNeeded();
  await card.getByRole("button", { name: "Ajouter au panier" }).click();
  if (unit === "KG") await page.getByRole("button", { name: /^Ajouter\s*\d/ }).click();
}

/** Le panier que la page garde dans sessionStorage, lu par le lecteur du site. */
async function pageCart(page: Page): Promise<CartState> {
  const raw = await page.evaluate(() => window.sessionStorage.getItem("klikgo-cart"));
  const stored: unknown = raw === null ? null : JSON.parse(raw);
  return normalizeStoredCart(stored);
}

/**
 * Passe commande des lignes du panier de la page (sessionStorage) qui portent ces produits, comme
 * /panier : devis du serveur, puis POST /api/orders avec le total confirmé et une clé neuve. Les
 * requêtes sont construites par src/lib/cart/order-payload.ts, seul constructeur du site.
 */
export async function orderFromCart(page: Page, productIds: readonly string[]): Promise<string> {
  const holdsAll = (cart: CartState) => productIds.every((id) => cart.items.some((item) => item.productId === id));
  await expect.poll(async () => holdsAll(await pageCart(page)), { message: "produits dans le panier de la page" }).toBe(true);
  const cart = await pageCart(page);
  expect(cart.shopId, "boutique du panier").not.toBeNull();
  const selection: CheckoutSelection = {
    shopId: cart.shopId as string,
    items: cart.items.filter((item) => productIds.includes(item.productId)),
    promoCode: null,
    requestedTime: "asap",
    pickupSlot: null,
    customerNote: "",
    weighTolerance: "STANDARD",
  };
  const quote = await page.request.post("/api/orders/quote", { data: buildQuoteRequest(selection) });
  expect(quote.status(), "devis du panier").toBe(200);
  const { amountDueCents } = ((await quote.json()) as { data: { amountDueCents: number } }).data;
  const created = await page.request.post("/api/orders", {
    data: buildCreateOrderRequest(selection, { expectedTotalCents: amountDueCents, idempotencyKey: randomUUID() }),
  });
  expect(created.status(), "création de la commande").toBe(201);
  return ((await created.json()) as { data: { id: string } }).data.id;
}

/** Le boucher accepte la commande (route du mode cuisine) : la carte passe « En cours », photos visibles. */
export async function acceptOrder(context: BrowserContext, orderId: string): Promise<void> {
  const accepted = await context.request.patch(`/api/boucher/orders/${orderId}/action`, {
    data: { action: "accept", estimatedMinutes: 15 },
  });
  expect(accepted.status(), "acceptation de la commande").toBe(200);
}

export type ShopInfo = { id: string; slug: string; categories: { name: string }[] };

/** La boutique sur laquelle la session BOUCHER ou ADMIN agit (GET /api/shops/my-shop). */
export async function myShop(context: BrowserContext): Promise<ShopInfo> {
  const response = await context.request.get("/api/shops/my-shop");
  expect(response.status(), "GET /api/shops/my-shop").toBe(200);
  return ((await response.json()) as { data: ShopInfo }).data;
}

export interface SeededProduct {
  id: string;
  name: string;
  unit: Unit;
  imageUrl: string;
  category: string;
}

/**
 * Produits du seed qui n'ont qu'une photo /img (aucune ProductImage), en vente, sans promotion ni
 * variante, au nom unique dans la boutique (une carte, une ligne de panier par nom).
 */
export async function seededPhotoProducts(prisma: PrismaClient, shopId: string): Promise<SeededProduct[]> {
  const rows = await prisma.product.findMany({
    where: { shopId },
    select: {
      id: true, name: true, unit: true, imageUrl: true, isActive: true, inStock: true, promoPct: true,
      variants: true, categories: { select: { name: true } }, _count: { select: { images: true } },
    },
    orderBy: { name: "asc" },
  });
  const nameCounts = new Map<string, number>();
  for (const row of rows) nameCounts.set(row.name, (nameCounts.get(row.name) ?? 0) + 1);
  return rows
    .filter(
      (row) =>
        row.isActive && row.inStock && row.promoPct === null && row.variants.length === 0 &&
        row._count.images === 0 && row.imageUrl?.startsWith("/img/products/") &&
        (row.unit === "KG" || row.unit === "PIECE" || row.unit === "BARQUETTE") &&
        nameCounts.get(row.name) === 1 && row.categories.length > 0
    )
    .map((row) => ({ id: row.id, name: row.name, unit: row.unit, imageUrl: row.imageUrl as string, category: row.categories[0].name }));
}

/** Cible d'une requête d'image : l'URL demandée à l'optimiseur, ou le chemin demandé directement. */
export function photoRequestTarget(requestUrl: string, origin: string): string {
  const url = new URL(requestUrl);
  if (url.origin !== origin) return requestUrl;
  return url.pathname === "/_next/image" ? (url.searchParams.get("url") ?? requestUrl) : url.pathname;
}

/**
 * Compte, pendant `windowMs` à partir de maintenant, les requêtes de chaque candidate pendant que
 * `act` s'exécute. S'arrête à la première violation : une 2e requête pour une même candidate, ou
 * une requête vers replicate.delivery. On attend ici un événement qui ne doit PAS arriver : la
 * fenêtre d'observation est la mesure elle-même, pas une attente fixe.
 */
export async function watchPhotoRequests(
  page: Page,
  origin: string,
  candidates: readonly string[],
  windowMs: number,
  act: () => Promise<void>
): Promise<{ counts: Map<string, number>; violation: string | null }> {
  const counts = new Map<string, number>();
  const violation = page
    .waitForEvent("request", {
      timeout: windowMs,
      predicate: (request) => {
        const target = photoRequestTarget(request.url(), origin);
        const count = (counts.get(target) ?? 0) + 1;
        counts.set(target, count);
        return /(^|\.)replicate\.delivery$/.test(new URL(target, origin).hostname) || (candidates.includes(target) && count > 1);
      },
    })
    .then(
      (request) => request.url(),
      (error: unknown) => {
        if (error instanceof errors.TimeoutError) return null;
        throw error;
      }
    );
  await act();
  return { counts, violation: await violation };
}

/** Les requêtes d'image vers une photo morte ou expirante répondent 404 (aucune sortie réseau). */
export async function routeDeadPhotos(context: BrowserContext, deadUrl: string): Promise<void> {
  const notFound = { status: 404, contentType: "text/plain", body: "introuvable" };
  await context.route(
    (url) => url.pathname === "/_next/image" && url.searchParams.get("url") === deadUrl,
    (route) => route.fulfill(notFound)
  );
  await context.route(
    (url) => url.href === deadUrl || /(^|\.)replicate\.delivery$/.test(url.hostname),
    (route) => route.fulfill(notFound)
  );
}
