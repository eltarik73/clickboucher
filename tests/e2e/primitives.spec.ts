import { test, expect, type Page } from "@playwright/test";

// Primitives accessibles (C1-SOCLE-UI) essayées sur de vraies pages : Dialog de l'administration,
// confirmations « Vider le panier ? » et « Changer de boutique ? », zone tactile des switchs.
// Local seulement ; rien n'est soumis, aucune commande créée. Hors local, toute requête autre que GET
// est bloquée (beforeEach) : la lecture seule ne dépend pas d'une déclaration.

type Role = "CLIENT" | "BOUCHER" | "ADMIN";

function isLocal(baseURL: string | undefined): boolean {
  if (!baseURL) return false;
  return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname);
}

const LOCAL_ONLY = "connexion en mode test : serveur local et TEST_SECRET requis";
const LOCAL_SERVER_ONLY = "parcours invité qui modifie le panier : serveur local requis";

test.beforeEach(async ({ context, baseURL }) => {
  if (!isLocal(baseURL)) {
    await context.route("**/*", (route) => (route.request().method() === "GET" ? route.continue() : route.abort()));
  }
});

async function signIn(page: Page, role: Role): Promise<void> {
  const response = await page.context().request.post("/api/test-mode/activate", {
    data: { secret: process.env.TEST_SECRET, role },
  });
  expect(response.ok(), `activation du mode test (${role})`).toBe(true);
}

/** Écarte ce qui recouvre l'écran sans être le sujet : bandeau de consentement, invite PWA. */
async function dismissOverlays(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("klikgo-analytics-consent", "refused");
    window.localStorage.setItem("klikgo-pwa-dismiss", String(Date.now()));
  });
}

function cartItemCount(page: Page): Promise<number> {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem("klikgo-cart") ?? "{}").items?.length ?? 0);
}

function cartShopSlug(page: Page): Promise<string | null> {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem("klikgo-cart") ?? "{}").shopSlug ?? null);
}

/** Liens des boutiques ouvertes de l'accueil, dans l'ordre d'affichage, sans doublon. */
async function openShopLinks(page: Page): Promise<string[]> {
  await page.goto("/");
  const links = page.getByRole("link", { name: /Voir la boutique/ }).filter({ hasNotText: "Fermé" });
  await expect(links.first()).toBeVisible();
  const hrefs = await links.evaluateAll((anchors) => anchors.map((a) => a.getAttribute("href") ?? ""));
  return [...new Set(hrefs)].filter((href) => href.startsWith("/boutique/"));
}

/** Ouvre la boutique, clique « Ajouter au panier » sur son premier produit, confirme la feuille de poids si elle s'ouvre. */
async function clickAddOnFirstProduct(page: Page, href: string): Promise<void> {
  await page.goto(href);
  await page.getByRole("button", { name: "Ajouter au panier" }).first().click();
  const confirm = page.getByRole("button", { name: /^Ajouter\s+\d/ });
  const sheetOpened = await confirm.waitFor({ state: "visible", timeout: 3_000 }).then(
    () => true,
    () => false,
  );
  if (sheetOpened) await confirm.click();
}

/** Ajoute le premier produit de la première boutique ouverte de l'accueil. */
async function addFirstProductToCart(page: Page): Promise<string> {
  const [first] = await openShopLinks(page);
  expect(first, "une boutique ouverte sur l'accueil").toBeTruthy();
  await clickAddOnFirstProduct(page, first);
  await expect.poll(() => cartItemCount(page)).toBeGreaterThan(0);
  return first;
}

type Point = [number, number];

/**
 * Enregistre, image par image pendant 400 ms dès l'apparition du premier élément du rôle donné,
 * le centre de sa boîte, et le centre du bloc conteneur d'un élément fixe (la fenêtre).
 * À installer avant l'ouverture ; lire ensuite avec readCentreTrack.
 */
async function recordCentreTrack(page: Page, role: "dialog" | "alertdialog"): Promise<void> {
  await page.evaluate((r) => {
    const store = { frames: [] as Point[], viewport: [0, 0] as Point, done: false };
    (window as unknown as { __centreTrack: typeof store }).__centreTrack = store;
    const centre = (rect: DOMRect): Point => [rect.left + rect.width / 2, rect.top + rect.height / 2];
    const observer = new MutationObserver(() => {
      const target = document.querySelector(`[role="${r}"]`);
      if (!target) return;
      observer.disconnect();
      const probe = document.createElement("div");
      probe.style.cssText = "position:fixed;inset:0;pointer-events:none;visibility:hidden";
      document.body.appendChild(probe);
      store.viewport = centre(probe.getBoundingClientRect());
      probe.remove();
      const start = performance.now();
      const frame = (now: number) => {
        store.frames.push(centre(target.getBoundingClientRect()));
        if (now - start < 400) requestAnimationFrame(frame);
        else store.done = true;
      };
      requestAnimationFrame(frame);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }, role);
}

async function expectCentredWithoutDrift(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => (window as unknown as { __centreTrack: { done: boolean } }).__centreTrack.done)).toBe(true);
  const track = await page.evaluate(
    () => (window as unknown as { __centreTrack: { frames: Point[]; viewport: Point } }).__centreTrack,
  );
  expect(track.frames.length, "images enregistrées pendant l'animation").toBeGreaterThan(2);
  const first = track.frames[0];
  const last = track.frames[track.frames.length - 1];
  expect(Math.abs(last[0] - first[0]), `dérive horizontale du centre (${first} -> ${last})`).toBeLessThanOrEqual(2);
  expect(Math.abs(last[1] - first[1]), `dérive verticale du centre (${first} -> ${last})`).toBeLessThanOrEqual(2);
  expect(Math.abs(last[0] - track.viewport[0]), "centre horizontal de la fenêtre").toBeLessThanOrEqual(1);
  expect(Math.abs(last[1] - track.viewport[1]), "centre vertical de la fenêtre").toBeLessThanOrEqual(1);
}

/** Vrai si l'élément actif est dans le premier élément du rôle donné. */
function focusInside(page: Page, role: "dialog" | "alertdialog"): Promise<boolean> {
  return page.evaluate((r) => {
    const container = document.querySelector(`[role="${r}"]`);
    return !!container && container.contains(document.activeElement);
  }, role);
}

test.describe("Dialog : « Nouvelle boucherie » de /admin/shops", () => {
  test("nom, piège du focus, défilement bloqué, Échap et retour du focus", async ({ page, baseURL }) => {
    test.skip(!isLocal(baseURL) || !process.env.TEST_SECRET, LOCAL_ONLY);
    await dismissOverlays(page);
    await signIn(page, "ADMIN");
    await page.goto("/admin/shops");

    const opener = page.getByRole("button", { name: "Ajouter une boucherie" });
    await opener.focus();
    await recordCentreTrack(page, "dialog");
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Nouvelle boucherie" });
    await expect(dialog).toBeVisible();
    await expectCentredWithoutDrift(page);
    await expect.poll(() => focusInside(page, "dialog"), "focus dans le dialogue à l'ouverture").toBe(true);

    const tabbable = await dialog
      .locator(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      .count();
    for (let press = 1; press <= tabbable + 2; press += 1) {
      await page.keyboard.press("Tab");
      expect(await focusInside(page, "dialog"), `focus dans le dialogue après ${press} Tab`).toBe(true);
    }

    expect(await page.evaluate(() => getComputedStyle(document.body).overflow), "défilement de la page").toBe("hidden");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener, "focus rendu au bouton d'ouverture").toBeFocused();
  });
});

test.describe("AlertDialog : « Vider le panier ? »", () => {
  test("rôle alertdialog, focus sur Annuler, clic extérieur sans effet, Échap rend le focus", async ({ page, baseURL }) => {
    test.skip(!isLocal(baseURL) || !process.env.TEST_SECRET, LOCAL_ONLY);
    await dismissOverlays(page);
    await addFirstProductToCart(page);
    await page.goto("/panier");

    const opener = page.getByRole("button", { name: "Vider", exact: true });
    await opener.focus();
    await recordCentreTrack(page, "alertdialog");
    await page.keyboard.press("Enter");

    const name = "Vider le panier ?";
    // Trouvée sous l'un ou l'autre rôle, puis le rôle est vérifié : un mauvais rôle échoue sur sa valeur.
    const alert = page.getByRole("alertdialog", { name }).or(page.getByRole("dialog", { name }));
    await expect(alert).toBeVisible();
    await expect(alert, "rôle de la confirmation").toHaveAttribute("role", "alertdialog");
    await expect(alert.getByRole("button", { name: "Annuler" }), "focus initial sur Annuler").toBeFocused();
    await expectCentredWithoutDrift(page);

    // Coin haut gauche : sur le voile, hors du dialogue centré.
    await page.mouse.click(4, 4);
    await expect(alert, "un clic sur le voile ne ferme pas la confirmation").toBeVisible();

    await page.keyboard.press("Escape");
    await expect(alert).toBeHidden();
    await expect(opener, "focus rendu au bouton « Vider »").toBeFocused();
    expect(await cartItemCount(page), "le panier garde son article").toBeGreaterThan(0);
  });
});

test.describe("AlertDialog : « Changer de boutique ? » aux libellés longs", () => {
  for (const width of [375, 320]) {
    test.describe(`à ${width} px`, () => {
      test.use({ viewport: { width, height: 700 } });

      test("les boutons tiennent dans le dialogue, Échap garde le premier panier", async ({ page, baseURL }) => {
        test.skip(!isLocal(baseURL), LOCAL_SERVER_ONLY);
        await dismissOverlays(page);
        const shops = await openShopLinks(page);
        expect(shops.length, "deux boutiques ouvertes sur l'accueil").toBeGreaterThanOrEqual(2);
        await clickAddOnFirstProduct(page, shops[0]);
        await expect.poll(() => cartItemCount(page)).toBeGreaterThan(0);
        const firstSlug = await cartShopSlug(page);
        expect(firstSlug, "panier de la première boutique").toBeTruthy();

        await clickAddOnFirstProduct(page, shops[1]);
        const alert = page.getByRole("alertdialog", { name: "Changer de boutique ?" });
        await expect(alert).toBeVisible();
        await alert.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));

        const layout = await alert.evaluate((element) => ({
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          right: element.getBoundingClientRect().right,
          buttons: [...element.querySelectorAll("button")].map((button) => {
            const rect = button.getBoundingClientRect();
            return { label: button.textContent?.trim() ?? "", right: rect.right, height: rect.height };
          }),
        }));
        expect(layout.scrollWidth, "aucun défilement horizontal dans le dialogue").toBe(layout.clientWidth);
        expect(layout.buttons.map((button) => button.label)).toEqual(["Garder mon panier", "Vider et ajouter"]);
        for (const button of layout.buttons) {
          expect(button.right, `« ${button.label} » dans le dialogue, marge comprise`).toBeLessThanOrEqual(layout.right - 24);
          expect(button.height, `« ${button.label} » mesure au moins 44 px`).toBeGreaterThanOrEqual(44);
        }

        await page.keyboard.press("Escape");
        await expect(alert).toBeHidden();
        expect(await cartShopSlug(page), "le panier reste à la première boutique").toBe(firstSlug);
      });
    });
  }
});

test.describe("Switch : zone tactile de 44 px sur /boucher/parametres", () => {
  test("le pseudo-élément mesure 44 × 44 et capte un appui à 9,5 px de la piste aux deux bouts", async ({ page, baseURL }) => {
    test.skip(!isLocal(baseURL) || !process.env.TEST_SECRET, LOCAL_ONLY);
    await dismissOverlays(page);
    await signIn(page, "BOUCHER");
    await page.goto("/boucher/parametres");
    const firstSwitch = page.getByRole("switch").first();
    await expect(firstSwitch).toBeVisible();
    await firstSwitch.evaluate((element) => element.scrollIntoView({ block: "center" }));

    const hit = await firstSwitch.evaluate((element) => {
      const after = getComputedStyle(element, "::after");
      const rect = element.getBoundingClientRect();
      const hits = (x: number, y: number) => {
        const found = document.elementFromPoint(x, y);
        return !!found && (found === element || element.contains(found));
      };
      const ends = { left: rect.left + 1, right: rect.right - 1 };
      return {
        width: after.width,
        height: after.height,
        points: {
          "au-dessus, à gauche": hits(ends.left, rect.top - 9.5),
          "au-dessus, à droite": hits(ends.right, rect.top - 9.5),
          "en dessous, à gauche": hits(ends.left, rect.bottom + 9.5),
          "en dessous, à droite": hits(ends.right, rect.bottom + 9.5),
        },
      };
    });
    expect(hit.width, "largeur de la zone tactile").toBe("44px");
    expect(hit.height, "hauteur de la zone tactile").toBe("44px");
    expect(hit.points).toEqual({
      "au-dessus, à gauche": true,
      "au-dessus, à droite": true,
      "en dessous, à gauche": true,
      "en dessous, à droite": true,
    });
  });
});
