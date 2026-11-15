// tests/e2e/helpers.ts — what the browser specs share: the read-only guard for any host that is not
// local, the test-mode session, the overlays to dismiss and the cart set-up through the storefront.
import { expect, type BrowserContext, type Page } from "@playwright/test";

/** Reason given by the tests that sign in: they need the local server and its TEST_SECRET. */
export const LOCAL_ONLY = "connexion en mode test : serveur local et TEST_SECRET requis";

export function isLocal(baseURL: string | undefined): boolean {
  if (!baseURL) return false;
  return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname);
}

/**
 * Off localhost every request other than GET is aborted, the page's own scripts included: a run
 * against production stays read-only whatever a test does.
 */
export async function guardRemote(
  context: BrowserContext,
  baseURL: string | undefined
): Promise<void> {
  if (isLocal(baseURL)) return;
  await context.route("**/*", (route) =>
    route.request().method() === "GET" ? route.continue() : route.abort()
  );
}

export async function signIn(page: Page, role: "CLIENT" | "BOUCHER" | "ADMIN"): Promise<void> {
  const response = await page.context().request.post("/api/test-mode/activate", {
    data: { secret: process.env.TEST_SECRET, role },
  });
  expect(response.ok(), `activation du mode test (${role})`).toBe(true);
}

/** Dismisses what covers the screen without being tested: consent banner, PWA prompt, sound unlock. */
export async function dismissOverlays(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("klikgo-analytics-consent", "refused");
    window.localStorage.setItem("klikgo-pwa-dismiss", String(Date.now()));
    window.sessionStorage.setItem("audioUnlocked", "true");
  });
}

export function cartItemCount(page: Page): Promise<number> {
  return page.evaluate(
    () => JSON.parse(sessionStorage.getItem("klikgo-cart") ?? "{}").items?.length ?? 0
  );
}

/** Links to the open shops of the home page, in display order, without duplicates. */
export async function openShopLinks(page: Page): Promise<string[]> {
  await page.goto("/");
  const links = page
    .getByRole("link", { name: /Voir la boutique/ })
    .filter({ hasNotText: "Fermé" });
  await expect(links.first()).toBeVisible();
  const hrefs = await links.evaluateAll((anchors) =>
    anchors.map((anchor) => anchor.getAttribute("href") ?? "")
  );
  return [...new Set(hrefs)].filter((href) => href.startsWith("/boutique/"));
}

/** Opens the shop and adds its first product, confirming the weight sheet when it opens. */
export async function clickAddOnFirstProduct(page: Page, href: string): Promise<void> {
  await page.goto(href);
  await page.getByRole("button", { name: "Ajouter au panier" }).first().click();
  const confirm = page.getByRole("button", { name: /^Ajouter\s+\d/ });
  const sheetOpened = await confirm.waitFor({ state: "visible", timeout: 3_000 }).then(
    () => true,
    () => false
  );
  if (sheetOpened) await confirm.click();
}

/** Adds the first product of the first open shop of the home page. */
export async function addFirstProductToCart(page: Page): Promise<void> {
  const [first] = await openShopLinks(page);
  expect(first, "une boutique ouverte sur l'accueil").toBeTruthy();
  await clickAddOnFirstProduct(page, first);
  await expect.poll(() => cartItemCount(page)).toBeGreaterThan(0);
}
