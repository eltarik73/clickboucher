import { test, expect, type Locator, type Page } from "@playwright/test";

// Socle d'interface (C1-SOCLE-UI) : polices, contraste des boutons rouges, thème avant hydratation,
// mouvement réduit, taille du bouton de thème, hauteur du logo de l'en-tête. Les tests @readonly peuvent
// viser n'importe quel hôte : hors local, toute requête autre que GET est bloquée (beforeEach), y compris
// celles des scripts de la page. Les autres se connectent en mode test et ne tournent qu'en local.

type Role = "CLIENT" | "BOUCHER" | "ADMIN";

function isLocal(baseURL: string | undefined): boolean {
  if (!baseURL) return false;
  return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname);
}

const LOCAL_ONLY = "connexion en mode test : serveur local et TEST_SECRET requis";

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

/** Écarte ce qui recouvre l'écran sans être le sujet : bandeau de consentement, invite PWA, écran du son. */
async function dismissOverlays(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("klikgo-analytics-consent", "refused");
    window.localStorage.setItem("klikgo-pwa-dismiss", String(Date.now()));
    window.sessionStorage.setItem("audioUnlocked", "true");
  });
}

/** Ouvre une boutique ouverte depuis l'accueil, ajoute son premier produit, confirme la feuille de poids si elle s'ouvre. */
async function addFirstProductToCart(page: Page): Promise<void> {
  await page.goto("/");
  const shop = page.getByRole("link", { name: /Voir la boutique/ }).filter({ hasNotText: "Fermé" }).first();
  const href = await shop.getAttribute("href");
  expect(href, "lien de boutique sur l'accueil").toMatch(/^\/boutique\//);
  await page.goto(href as string);
  await page.getByRole("button", { name: "Ajouter au panier" }).first().click();
  const confirm = page.getByRole("button", { name: /^Ajouter\s+\d/ });
  const sheetOpened = await confirm.waitFor({ state: "visible", timeout: 3_000 }).then(
    () => true,
    () => false,
  );
  if (sheetOpened) await confirm.click();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("klikgo-cart") ?? "{}").items?.length ?? 0))
    .toBeGreaterThan(0);
}

type Rgba = [number, number, number, number];

/** Couleur du texte et fond effectif (couches semi-transparentes composées jusqu'au premier fond opaque). */
async function colours(locator: Locator): Promise<{ text: Rgba; background: Rgba }> {
  return locator.evaluate((element) => {
    const parse = (value: string): Rgba => {
      const parts = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
      return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
    };
    const layers: Rgba[] = [];
    for (let node: Element | null = element; node; node = node.parentElement) {
      const layer = parse(getComputedStyle(node).backgroundColor);
      if (layer[3] > 0) layers.push(layer);
      if (layer[3] >= 1) break;
    }
    let background: Rgba = [255, 255, 255, 1];
    for (const [r, g, b, a] of layers.reverse()) {
      background = [r * a + background[0] * (1 - a), g * a + background[1] * (1 - a), b * a + background[2] * (1 - a), 1];
    }
    return { text: parse(getComputedStyle(element).color), background };
  });
}

function luminance([r, g, b]: Rgba): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

async function expectWhiteOnRed(control: Locator): Promise<void> {
  await expect(control).toBeVisible();
  const { text, background } = await colours(control);
  expect(`rgb(${text.slice(0, 3).join(", ")})`, "couleur du texte").toBe("rgb(255, 255, 255)");
  expect(background[0] >= 150 && background[1] < 100 && background[2] < 100, `fond rouge (${background})`).toBe(true);
  expect(contrastRatio(text, background), "contraste texte / fond").toBeGreaterThanOrEqual(4.5);
}

test.describe("polices", () => {
  for (const url of ["/", "/a-propos"]) {
    test(`@readonly DM Sans et Outfit chargées sur ${url}`, async ({ page }) => {
      await page.goto(url);
      const fonts = await page.evaluate(async () => {
        await document.fonts.ready;
        const unquote = (family: string) => family.replace(/["']/g, "").trim();
        const faces = [...document.fonts].map((face) => ({
          family: unquote(face.family),
          status: face.status,
          weight: face.weight,
        }));
        const preloads = [...document.querySelectorAll('link[rel="preload"][as="font"]')]
          .map((link) => link.getAttribute("href") ?? "")
          .filter((href) => href.endsWith(".woff2"));
        return { faces, preloads, body: getComputedStyle(document.body).fontFamily };
      });
      const real = (prefix: string) =>
        fonts.faces.filter((face) => face.family.includes(prefix) && !face.family.includes("Fallback"));
      const dmSans = real("__DM_Sans");
      const outfit = real("__Outfit");

      expect(dmSans.some((face) => face.status === "loaded"), "une face DM Sans chargée").toBe(true);
      expect(outfit.some((face) => face.status === "loaded"), "une face Outfit chargée").toBe(true);
      const bodyFirst = fonts.body.split(",")[0].replace(/["']/g, "").trim();
      expect(bodyFirst, "police calculée de <body>").toBe(dmSans[0]?.family);
      for (const face of [...dmSans, ...outfit]) {
        const [min, max = min] = face.weight.split(/\s+/).map(Number);
        expect(min <= 400 && max >= 900, `${face.family} déclare les graisses ${face.weight}`).toBe(true);
      }
      expect(fonts.preloads, "fichiers de police préchargés").toHaveLength(2);
    });
  }
});

test.describe("boutons rouges en mode clair", () => {
  test.use({ colorScheme: "light" });

  test("@readonly « Découvrir les boucheries » du panier vide", async ({ page }) => {
    await page.goto("/panier");
    await expectWhiteOnRed(page.getByRole("link", { name: "Découvrir les boucheries" }));
  });

  test("@readonly « Demander l'accès PRO » sur /pro", async ({ page }) => {
    await page.goto("/pro");
    await expectWhiteOnRed(page.getByRole("link", { name: "Demander l'accès PRO" }));
  });

  test("« Confirmer ma commande » du panier", async ({ page, baseURL }) => {
    test.skip(!isLocal(baseURL) || !process.env.TEST_SECRET, LOCAL_ONLY);
    await dismissOverlays(page);
    await signIn(page, "CLIENT");
    await addFirstProductToCart(page);
    await page.goto("/panier");
    await expectWhiteOnRed(page.getByRole("button", { name: "Confirmer ma commande" }));
  });

  test("« Ajouter » de /boucher/produits", async ({ page, baseURL }) => {
    test.skip(!isLocal(baseURL) || !process.env.TEST_SECRET, LOCAL_ONLY);
    await dismissOverlays(page);
    await signIn(page, "BOUCHER");
    await page.goto("/boucher/produits");
    await expectWhiteOnRed(page.getByRole("button", { name: "Ajouter", exact: true }));
  });
});

test.describe("thème", () => {
  test("@readonly theme=dark : <html> est sombre avant toute hydratation", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("theme", "dark"));
    await page.route("**/_next/static/chunks/**", (route) => route.abort());
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/(^|\s)dark(\s|$)/);
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(background, "fond de <body> en mode sombre").not.toBe("rgb(255, 255, 255)");
  });

  test("@readonly première visite : rien n'est écrit sous la clé theme", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => window.localStorage.getItem("theme"))).toBeNull();
  });

  test("@readonly le bouton « Mode sombre » pose le thème et il survit au rechargement", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).not.toHaveClass(/(^|\s)dark(\s|$)/);
    await page.getByRole("button", { name: "Mode sombre", exact: true }).click();
    await expect(html).toHaveClass(/(^|\s)dark(\s|$)/);
    expect(await page.evaluate(() => window.localStorage.getItem("theme"))).toBe("dark");
    await page.reload();
    await expect(html).toHaveClass(/(^|\s)dark(\s|$)/);
  });
});

/** Animations CSS ou Web Animations infinies, hors rotation des indicateurs de chargement. */
async function infiniteAnimations(page: Page): Promise<string[]> {
  const reduced = await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  expect(reduced, "préférence « mouvement réduit » émulée").toBe(true);
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().iterations === Infinity)
      .map((animation) => (animation instanceof CSSAnimation ? animation.animationName : "(Web Animation)"))
      .filter((name) => name !== "spin"),
  );
}

test.describe("mouvement réduit", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("@readonly aucune animation infinie sur l'accueil", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(await infiniteAnimations(page)).toEqual([]);
  });

  test("aucune animation infinie sur /boucher/commandes", async ({ page, baseURL }) => {
    test.skip(!isLocal(baseURL) || !process.env.TEST_SECRET, LOCAL_ONLY);
    await dismissOverlays(page);
    await signIn(page, "BOUCHER");
    await page.goto("/boucher/commandes");
    await page.waitForLoadState("networkidle");
    expect(await infiniteAnimations(page)).toEqual([]);
  });
});

test.describe("cible tactile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("@readonly le bouton « Mode sombre » de l'accueil mesure au moins 44 × 44 px à 375 px", async ({ page }) => {
    await page.goto("/");
    const box = await page.getByRole("button", { name: "Mode sombre", exact: true }).boundingBox();
    expect(box, "bouton « Mode sombre » visible").not.toBeNull();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("@readonly le bouton du logo de l'en-tête a la hauteur de sa pastille (40 px)", async ({ page }) => {
    await page.goto("/");
    const logoButton = page
      .locator("header button")
      .filter({ has: page.locator('svg[viewBox="0 0 100 100"]') })
      .filter({ hasText: "Klik&Go" })
      .first();
    await expect(logoButton).toBeVisible();
    const sizes = await logoButton.evaluate((button) => ({
      button: button.getBoundingClientRect().height,
      mark: (button.querySelector('svg[viewBox="0 0 100 100"]') as SVGElement).getBoundingClientRect().height,
    }));
    expect(sizes.mark, "pastille du lockup").toBe(40);
    expect(sizes.button, "bouton du logo, sans place réservée aux jambages").toBe(sizes.mark);
  });
});
