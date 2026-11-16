import { test, expect, type Locator, type Page } from "@playwright/test";
import { contrastRatio } from "../helpers/wcag-contrast";
import {
  LOCAL_ONLY,
  addFirstProductToCart,
  dismissOverlays,
  guardRemote,
  isLocal,
  signIn,
} from "./helpers";

// Design foundation: fonts, contrast of the red buttons, theme before hydration, reduced motion,
// size of the theme button, height of the header logo. The @readonly tests may target any host:
// off localhost every request other than GET is aborted (guardRemote). The others sign in with the
// test mode and run only locally.

test.beforeEach(({ context, baseURL }) => guardRemote(context, baseURL));

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
      background = [
        r * a + background[0] * (1 - a),
        g * a + background[1] * (1 - a),
        b * a + background[2] * (1 - a),
        1,
      ];
    }
    return { text: parse(getComputedStyle(element).color), background };
  });
}

async function expectWhiteOnRed(control: Locator): Promise<void> {
  await expect(control).toBeVisible();
  const { text, background } = await colours(control);
  expect(`rgb(${text.slice(0, 3).join(", ")})`, "couleur du texte").toBe("rgb(255, 255, 255)");
  expect(
    background[0] >= 150 && background[1] < 100 && background[2] < 100,
    `fond rouge (${background})`
  ).toBe(true);
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
        fonts.faces.filter(
          (face) => face.family.includes(prefix) && !face.family.includes("Fallback")
        );
      const dmSans = real("__DM_Sans");
      const outfit = real("__Outfit");

      expect(
        dmSans.some((face) => face.status === "loaded"),
        "une face DM Sans chargée"
      ).toBe(true);
      expect(
        outfit.some((face) => face.status === "loaded"),
        "une face Outfit chargée"
      ).toBe(true);
      const bodyFirst = fonts.body.split(",")[0].replace(/["']/g, "").trim();
      expect(bodyFirst, "police calculée de <body>").toBe(dmSans[0]?.family);
      for (const face of [...dmSans, ...outfit]) {
        const [min, max = min] = face.weight.split(/\s+/).map(Number);
        expect(min <= 400 && max >= 900, `${face.family} déclare les graisses ${face.weight}`).toBe(
          true
        );
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

  test("« Commander avec obligation de paiement » du panier", async ({ page, baseURL }) => {
    test.skip(!isLocal(baseURL) || !process.env.TEST_SECRET, LOCAL_ONLY);
    await dismissOverlays(page);
    await signIn(page, "CLIENT");
    await addFirstProductToCart(page);
    await page.goto("/panier");
    // The button stays disabled until a weighing tolerance is chosen (nothing is pre-ticked).
    await page.getByRole("radio", { name: /^5\s% du total estimé/ }).check();
    const order = page.getByRole("button", { name: "Commander avec obligation de paiement" });
    await expect(order).toBeEnabled();
    await expectWhiteOnRed(order);
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

  test("@readonly le bouton « Mode sombre » pose le thème et il survit au rechargement", async ({
    page,
  }) => {
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
  const reduced = await page.evaluate(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  expect(reduced, "préférence « mouvement réduit » émulée").toBe(true);
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().iterations === Infinity)
      .map((animation) =>
        animation instanceof CSSAnimation ? animation.animationName : "(Web Animation)"
      )
      .filter((name) => name !== "spin")
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

  test("@readonly le bouton « Mode sombre » de l'accueil mesure au moins 44 × 44 px à 375 px", async ({
    page,
  }) => {
    await page.goto("/");
    const box = await page.getByRole("button", { name: "Mode sombre", exact: true }).boundingBox();
    expect(box, "bouton « Mode sombre » visible").not.toBeNull();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("@readonly le bouton du logo de l'en-tête a la hauteur de sa pastille (40 px)", async ({
    page,
  }) => {
    await page.goto("/");
    const logoButton = page
      .locator("header button")
      .filter({ has: page.locator('svg[viewBox="0 0 100 100"]') })
      .filter({ hasText: "Klik&Go" })
      .first();
    await expect(logoButton).toBeVisible();
    const sizes = await logoButton.evaluate((button) => ({
      button: button.getBoundingClientRect().height,
      mark: (
        button.querySelector('svg[viewBox="0 0 100 100"]') as SVGElement
      ).getBoundingClientRect().height,
    }));
    expect(sizes.mark, "pastille du lockup").toBe(40);
    expect(sizes.button, "bouton du logo, sans place réservée aux jambages").toBe(sizes.mark);
  });
});
