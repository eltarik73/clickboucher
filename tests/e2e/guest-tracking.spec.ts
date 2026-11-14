import { randomUUID } from "node:crypto";
import {
  test as base,
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

// Suivi d'une commande invité (C1-INVITES), à 375 × 812. Chaque commande a son propre jeton d'accès :
// cookie httpOnly klikgo-order-<id> pour le navigateur qui l'a passée, segment de chemin
// /suivi/<id>/acces/<jeton> dans l'e-mail. Le navigateur de l'invité n'est jamais connecté ; le
// boucher agit par un APIRequestContext à part, en mode test (rôle BOUCHER, première boutique du seed).
//
// La commande est postée par la page /panier elle-même (fetch du navigateur, qui reçoit le cookie
// comme en vrai), avec la requête de devis que la page construit et le total coté par le serveur :
// avec les clés Clerk factices du serveur local, clerk-js ne se charge pas et le formulaire invité
// du panier reste sur « Chargement... ».
//
// Local seulement : hors local ou sans TEST_SECRET, le fichier est ignoré avant toute requête, et les
// fixtures refusent une cible non locale ; hors local, le navigateur ne peut envoyer que des GET.

const VIEWPORT = { width: 375, height: 812 };
/** Une période de la sonde du suivi (useOrderTracker, 5 s), plus la marge d'une requête et d'un rendu. */
const ONE_POLL_INTERVAL_MS = 5_000 + 2_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const LOCAL_ONLY = "commandes invité et mode test : serveur local et TEST_SECRET requis";

function isLocal(baseURL: string | undefined): baseURL is string {
  if (!baseURL) return false;
  return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname);
}

/**
 * Navigateur d'un invité sur le serveur local : bandeaux écartés (consentement, invite PWA, écran du
 * son), et navigateur Clerk de développement déconnecté. Les clés Clerk locales sont factices : sans
 * cookie __clerk_db_jwt, clerkMiddleware renvoie toute page du matcher (/suivi, /sign-in) vers la
 * poignée de main d'une instance de développement qui n'existe pas (400). Avec ce cookie, sans
 * session, il traite le visiteur en déconnecté, comme la production un nouveau visiteur. Les appels
 * à l'instance Clerk sont coupés : ils échouent de toute façon.
 */
async function prepareGuestBrowser(context: BrowserContext, baseURL: string): Promise<void> {
  await context.addInitScript(() => {
    window.localStorage.setItem("klikgo-analytics-consent", "refused");
    window.localStorage.setItem("klikgo-pwa-dismiss", String(Date.now()));
    window.sessionStorage.setItem("audioUnlocked", "true");
  });
  await context.addCookies([{ name: "__clerk_db_jwt", value: "e2e-deconnecte", url: baseURL }]);
  await context.route("https://*.clerk.accounts.dev/**", (route) => route.abort());
}

interface GuestFixtures {
  /** API du boucher de test (mode test, rôle BOUCHER), sans lien avec le navigateur de l'invité. */
  butcher: APIRequestContext;
  /** Boutique sur laquelle agit ce boucher : l'invité y commande. */
  shopSlug: string;
  /** Ouvre une page dans un autre navigateur, sans jeton ni session (le téléphone qui ouvre l'e-mail). */
  openOtherDevice: () => Promise<Page>;
}

const test = base.extend<GuestFixtures>({
  butcher: async ({ request, baseURL }, provide) => {
    if (!isLocal(baseURL)) throw new Error(LOCAL_ONLY);
    const response = await request.post("/api/test-mode/activate", {
      data: { secret: process.env.TEST_SECRET, role: "BOUCHER" },
    });
    expect(response.ok(), "activation du mode test (BOUCHER)").toBe(true);
    await provide(request);
  },
  shopSlug: async ({ butcher }, provide) => {
    const response = await butcher.get("/api/shops/my-shop");
    expect(response.ok(), "boutique du boucher de test").toBe(true);
    const { data } = (await response.json()) as { data: { slug: string } };
    await provide(data.slug);
  },
  openOtherDevice: async ({ browser, baseURL }, provide) => {
    if (!isLocal(baseURL)) throw new Error(LOCAL_ONLY);
    const devices: BrowserContext[] = [];
    await provide(async () => {
      const device = await browser.newContext({ baseURL, viewport: VIEWPORT });
      devices.push(device);
      await prepareGuestBrowser(device, baseURL);
      return device.newPage();
    });
    await Promise.all(devices.map((device) => device.close()));
  },
});

test.use({ viewport: VIEWPORT });
test.skip(({ baseURL }) => !isLocal(baseURL) || !process.env.TEST_SECRET, LOCAL_ONLY);

test.beforeEach(async ({ context, baseURL }) => {
  if (isLocal(baseURL)) {
    await prepareGuestBrowser(context, baseURL);
  } else {
    await context.route("**/*", (route) =>
      route.request().method() === "GET" ? route.continue() : route.abort()
    );
  }
});

function uniqueEmail(testInfo: TestInfo): string {
  return `e2e-invite-${Date.now()}-${testInfo.parallelIndex}@example.test`;
}

/** Lien de l'e-mail de confirmation : le jeton est un segment du chemin, jamais une query string. */
function accessLink(orderId: string, token: string): string {
  return `/suivi/${encodeURIComponent(orderId)}/acces/${encodeURIComponent(token)}`;
}

function statusBadge(page: Page): Locator {
  return page.getByRole("status", { name: "Statut de la commande" });
}

/** Ouvre la boutique, ajoute son premier produit, confirme la feuille de poids si elle s'ouvre. */
async function addFirstProduct(page: Page, shopSlug: string): Promise<void> {
  await page.goto(`/boutique/${shopSlug}`);
  await page.getByRole("button", { name: "Ajouter au panier" }).first().click();
  const confirm = page.getByRole("button", { name: /^Ajouter\s+\d/ });
  const sheetOpened = await confirm.waitFor({ state: "visible", timeout: 3_000 }).then(
    () => true,
    () => false
  );
  if (sheetOpened) await confirm.click();
  const cartLines = () =>
    page.evaluate(() => JSON.parse(sessionStorage.getItem("klikgo-cart") ?? "{}").items?.length);
  await expect.poll(cartLines).toBeGreaterThan(0);
}

interface PlacedGuestOrder {
  id: string;
  displayNumber: string;
  /** Valeur du cookie klikgo-order-<id> : le jeton de la commande. */
  token: string;
}

/**
 * Passe le panier en commande invité depuis /panier, puis ouvre /suivi/<id> comme le fait le panier.
 * Le jeton n'arrive que dans un cookie httpOnly SameSite=Lax de 30 jours : ni dans le corps de la
 * réponse, ni dans l'adresse, ni dans document.cookie ; aucun jeton par personne n'est posé.
 */
async function placeGuestOrder(page: Page, email: string): Promise<PlacedGuestOrder> {
  const quoted = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/orders/quote" &&
      response.request().method() === "POST"
  );
  await page.goto("/panier");
  const quote = await quoted;
  expect(quote.ok(), "devis du panier").toBe(true);
  const { data: quoteData } = (await quote.json()) as { data: { amountDueCents: number } };
  const order = {
    ...(quote.request().postDataJSON() as Record<string, unknown>),
    idempotencyKey: randomUUID(),
    expectedTotalCents: quoteData.amountDueCents,
    email,
    firstName: "Invité",
    lastName: "Testeur",
  };

  const answer = await page.evaluate(async (body) => {
    const response = await fetch("/api/checkout/guest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, text: await response.text() };
  }, order);
  expect(answer.status, `commande invité : ${answer.text}`).toBe(201);
  type Answer = { data: { order: Omit<PlacedGuestOrder, "token"> } };
  const placed = (JSON.parse(answer.text) as Answer).data.order;
  expect(placed.displayNumber, "numéro affiché de la commande").toBeTruthy();

  const cookies = await page.context().cookies();
  const cookie = cookies.find((candidate) => candidate.name === `klikgo-order-${placed.id}`);
  if (!cookie) throw new Error(`aucun cookie klikgo-order-${placed.id} après la commande`);
  expect(cookie.httpOnly, "cookie httpOnly").toBe(true);
  expect(cookie.sameSite, "cookie SameSite").toBe("Lax");
  const lifetimeDays = (cookie.expires * 1000 - Date.now()) / DAY_MS;
  expect(Math.abs(lifetimeDays - 30), `vie du cookie : ${lifetimeDays} j`).toBeLessThan(1);
  expect(
    cookies.map((c) => c.name),
    "jeton par personne"
  ).not.toContain("klikgo-guest-token");
  expect(answer.text, "jeton dans le corps de la réponse").not.toContain(cookie.value);
  expect(answer.text, "jeton dans le corps de la réponse").not.toContain("guestToken");

  await page.goto(`/suivi/${encodeURIComponent(placed.id)}`);
  await expect(statusBadge(page)).toBeVisible();
  expect(new URL(page.url()).pathname, "suivi ouvert sans connexion").toBe(`/suivi/${placed.id}`);
  expect(page.url(), "query string dans l'adresse").not.toContain("?");
  expect(page.url(), "jeton dans l'adresse").not.toContain(cookie.value);
  const scriptCookies = await page.evaluate(() => document.cookie);
  expect(scriptCookies, "jeton lisible par le script de la page").not.toContain(cookie.value);
  return { id: placed.id, displayNumber: placed.displayNumber, token: cookie.value };
}

type ButcherAction =
  | { action: "accept"; estimatedMinutes: number }
  | { action: "start_preparing" }
  | { action: "mark_ready" };

async function butcherActs(butcher: APIRequestContext, orderId: string, actions: ButcherAction[]) {
  for (const action of actions) {
    const url = `/api/boucher/orders/${encodeURIComponent(orderId)}/action`;
    const response = await butcher.patch(url, { data: action });
    expect(response.ok(), `${action.action} : ${await response.text()}`).toBe(true);
  }
}

type WindowWithMarker = Window & { __noReload?: boolean };

test("prête sans recharger", async ({ page, butcher, shopSlug }, testInfo) => {
  await addFirstProduct(page, shopSlug);
  const order = await placeGuestOrder(page, uniqueEmail(testInfo));
  const status = statusBadge(page);
  await expect(status).toContainText("En attente de validation");
  await page.evaluate(() => {
    (window as WindowWithMarker).__noReload = true;
  });

  await butcherActs(butcher, order.id, [
    { action: "accept", estimatedMinutes: 10 },
    { action: "start_preparing" },
    { action: "mark_ready" },
  ]);

  await expect(status).toContainText("Commande prête", { timeout: ONE_POLL_INTERVAL_MS });
  const marker = await page.evaluate(() => (window as WindowWithMarker).__noReload);
  expect(marker, "la page n'a pas été rechargée").toBe(true);
});

test("annulation invité", async ({ page, shopSlug }, testInfo) => {
  await addFirstProduct(page, shopSlug);
  const order = await placeGuestOrder(page, uniqueEmail(testInfo));

  await page.getByRole("button", { name: "Annuler la commande", exact: true }).click();
  const confirmation = page.getByRole("alertdialog", { name: "Annuler la commande ?" });
  await confirmation.getByRole("button", { name: "Oui, annuler" }).click();
  await expect(confirmation).toBeHidden();
  await expect(statusBadge(page)).toContainText("Commande annulée");

  const response = await page.request.get(`/api/orders/${encodeURIComponent(order.id)}/status`);
  expect(response.status(), "statut lu avec le cookie de la commande").toBe(200);
  const { data } = (await response.json()) as { data: { status: string } };
  expect(data.status).toBe("CANCELLED");
});

test("lien sur un autre appareil", async ({ page, shopSlug, openOtherDevice }, testInfo) => {
  // Deux commandes avec le même e-mail : chacune a son propre jeton, qui n'ouvre qu'elle.
  const email = uniqueEmail(testInfo);
  await addFirstProduct(page, shopSlug);
  const first = await placeGuestOrder(page, email);
  const second = await placeGuestOrder(page, email);
  expect(second.token, "un jeton par commande").not.toBe(first.token);

  const phone = await openOtherDevice();
  await phone.goto(accessLink(first.id, first.token));
  await expect(phone.getByText(first.displayNumber, { exact: true })).toBeVisible();
  await expect(statusBadge(phone)).toContainText("En attente de validation");
  const landed = new URL(phone.url());
  expect(landed.pathname, "suivi ouvert par le lien, sans connexion").toBe(`/suivi/${first.id}`);
  expect(landed.search, "le jeton quitte l'adresse").toBe("");
  const phoneCookies = await phone.context().cookies();
  const phoneCookie = phoneCookies.find((cookie) => cookie.name === `klikgo-order-${first.id}`);
  expect(phoneCookie?.httpOnly, "cookie httpOnly posé par le lien").toBe(true);

  const stranger = await openOtherDevice();
  await stranger.goto(accessLink(first.id, second.token));
  await expect(stranger, "sans accès : connexion").toHaveURL((url) => url.pathname === "/sign-in");
  await expect(stranger.getByText(first.displayNumber, { exact: true })).toHaveCount(0);
  const strangerCookies = (await stranger.context().cookies()).map((cookie) => cookie.name);
  expect(strangerCookies, "cookie posé pour le jeton d'une autre commande").not.toContain(
    `klikgo-order-${first.id}`
  );

  // Rend la capacité horaire de la boutique : une commande annulée n'y compte pas.
  for (const order of [first, second]) {
    const cancelled = await page.request.post(`/api/orders/${encodeURIComponent(order.id)}/cancel`);
    expect(cancelled.ok(), `annulation de ${order.displayNumber}`).toBe(true);
  }
});

test("focus après Vider le panier", async ({ page, shopSlug }) => {
  await addFirstProduct(page, shopSlug);
  await page.goto("/panier");
  await page.getByRole("button", { name: "Vider", exact: true }).click();
  const confirmation = page.getByRole("alertdialog", { name: "Vider le panier ?" });
  await confirmation.getByRole("button", { name: "Vider le panier" }).click();
  await expect(confirmation).toBeHidden();
  await expect(page.getByRole("heading", { name: "Mon panier", level: 1 })).toBeFocused();
});
