import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

// Service worker public/sw.js (C1-URGENCES, item 11) sur le build de production local, service workers
// autorisés : aucune page visitée ni charge RSC n'est copiée dans Cache Storage, l'ancien cache klikgo-v1
// disparaît à l'activation, une navigation hors ligne affiche /offline.html (jamais une ancienne copie).
// Local seulement : on enregistre un service worker et on coupe le réseau, rien à faire en production.
// PLAYWRIGHT_BASE_URL=http://localhost:3250 npx playwright test tests/e2e/service-worker.spec.ts --project=chromium

function isLocal(baseURL: string | undefined): boolean {
  if (!baseURL) return false;
  return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname);
}

/** Titre de la page hors ligne, lu dans le fichier servi. */
function offlineHeading(): string {
  const html = fs.readFileSync(path.join(process.cwd(), "public/offline.html"), "utf8");
  const match = /<h1>([^<]+)<\/h1>/.exec(html);
  if (!match) throw new Error("public/offline.html n'a plus de <h1>");
  return match[1].trim();
}

interface StoredEntry {
  url: string;
  accept: string | null;
}

/** Noms des caches et requêtes qu'ils contiennent, lus depuis la page. */
function cacheStorage(page: Page): Promise<{ names: string[]; entries: StoredEntry[] }> {
  return page.evaluate(async () => {
    const names = await caches.keys();
    const entries: StoredEntry[] = [];
    for (const name of names) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        entries.push({ url: request.url, accept: request.headers.get("accept") });
      }
    }
    return { names, entries };
  });
}

test.skip(
  ({ baseURL }) => !isLocal(baseURL),
  "service worker et réseau coupé : serveur local seulement"
);

test.use({ serviceWorkers: "allow" });

test("aucune page stockée, klikgo-v1 supprimé, /offline.html hors ligne", async ({
  page,
  context,
}) => {
  // offline.html est un fichier statique sans script : il n'enregistre pas le service worker, ce qui
  // laisse créer l'ancien cache (avec une copie de page privée, comme le faisait klikgo-v1) avant l'installation.
  await page.goto("/offline.html");
  await page.evaluate(async () => {
    const legacy = await caches.open("klikgo-v1");
    await legacy.put(
      "/panier",
      new Response("ancienne copie du panier", { headers: { "Content-Type": "text/html" } })
    );
  });
  expect((await cacheStorage(page)).names).toEqual(["klikgo-v1"]);

  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true })
      );
    }
  });

  await page.goto("/");
  const shopLinks = page.getByRole("link", { name: /Voir la boutique/ });
  await expect(shopLinks.first()).toBeVisible();
  const hrefs = await shopLinks.evaluateAll((anchors) =>
    anchors.map((anchor) => anchor.getAttribute("href") ?? "")
  );
  const shopHref = hrefs.find((href) => /^\/boutique\/[^/]+$/.test(href));
  if (shopHref === undefined) throw new Error("aucun lien /boutique/<slug> sur l'accueil");
  await page.goto("/panier");
  await page.goto(shopHref);
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null)).toMatch(
    /\/sw\.js$/
  );

  const stored = await cacheStorage(page);
  expect(stored.names).toEqual(["klikgo-v2"]);
  expect(stored.entries.map((entry) => new URL(entry.url).pathname)).toContain("/offline.html");
  const visited = ["/", "/panier", shopHref];
  const leaks = stored.entries.filter((entry) => {
    const url = new URL(entry.url);
    return (
      visited.includes(url.pathname) ||
      url.searchParams.has("_rsc") ||
      (entry.accept ?? "").includes("text/html")
    );
  });
  expect(leaks).toEqual([]);

  await context.setOffline(true);
  await page.goto("/panier");
  await expect(page.getByRole("heading", { level: 1, name: offlineHeading() })).toBeVisible();
  await expect(page.getByText("ancienne copie du panier")).toHaveCount(0);
  await context.setOffline(false);
});
