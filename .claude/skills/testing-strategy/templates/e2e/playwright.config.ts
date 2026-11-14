// Destination : playwright.config.ts (racine du dépôt). Remplace la configuration actuelle,
// dont le baseURL par défaut est la production.
// Vérifié avec @playwright/test 1.59.1 : typage et `--list` (2026-11-14), mécanique (session, stockage,
// horloge, émulation) contre un faux serveur (2026-11-13). Pas encore lancé contre l'application.
//
// Le préfixe du fichier choisit le projet :
//   client.<sujet>.spec.ts            → desktop + mobile (375 px)
//   boucher.<sujet>.spec.ts, admin.…  → desktop
//   cuisine.<sujet>.spec.ts           → tablette-cuisine
//   smoke.spec.ts, a11y.spec.ts       → lecture-seule (aucune écriture, aucune session)
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const target = new URL(baseURL);
// Jamais la production : chaque page vue y coûte du CPU Vercel, et le mode test y est impossible.
if (/(^|\.)klikandgo\.app$/.test(target.hostname)) {
  throw new Error("Les parcours ne visent jamais la production (klikandgo.app). Voir le skill testing-strategy, règle 9.");
}
// Seul un serveur local reçoit des parcours qui écrivent. Toute autre adresse (recette en ligne) : lecture seule.
const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseURL);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  globalTimeout: process.env.CI ? 20 * 60_000 : undefined,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Un seul ré-essai en CI : il sert à produire la trace et à classer le test « flaky », pas à le sauver.
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: !!process.env.CI,
  // Une base, une boutique pour le rôle BOUCHER : pas de concurrence en CI.
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "fr-FR",
    timezoneId: "Europe/Paris", // n'agit que sur le navigateur, pas sur le serveur ni sur le processus de test
    serviceWorkers: "block", // la PWA enregistre un service worker : hors sujet, et source d'écarts
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // Lecture seule : le seul projet qui existe quand la cible n'est pas le serveur local (recette en ligne).
    { name: "lecture-seule", testMatch: /(smoke|a11y)\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    ...(isLocal
      ? [
          // Ouvre une session de mode test par rôle (aucun navigateur lancé).
          { name: "setup", testMatch: /.*\.setup\.ts/ },
          {
            name: "desktop",
            testMatch: /(client|boucher|admin)\..*\.spec\.ts/,
            use: { ...devices["Desktop Chrome"] },
            dependencies: ["setup"],
          },
          {
            // Largeur de référence du produit : 375 px (CLAUDE.md). Le viewport se définit après le descripteur.
            name: "mobile",
            testMatch: /client\..*\.spec\.ts/,
            use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } },
            dependencies: ["setup"],
          },
          {
            // Mode cuisine : tablette en paysage (1138 × 712, tactile), au-dessus du seuil `lg` des 3 colonnes.
            name: "tablette-cuisine",
            testMatch: /cuisine\..*\.spec\.ts/,
            use: { ...devices["Galaxy Tab S4 landscape"] },
            dependencies: ["setup"],
          },
        ]
      : []),
  ],
  webServer: isLocal
    ? {
        // Le build doit exister (`npm run build` sur la base déjà remplie par le seed).
        command: "npm run start",
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // S'ajoute à process.env : TEST_SECRET et DATABASE_URL viennent de l'environnement, jamais d'un fichier suivi.
        env: {
          PORT: target.port || "3000", // `next start` écoute là où baseURL pointe
          TEST_MODE: "true",
          ALLOW_TEST_IN_PROD: "true", // `next start` tourne avec NODE_ENV=production
          UPSTASH_REDIS_REST_URL: "", // pas de cache ni de limite de débit partagés pendant les parcours
          UPSTASH_REDIS_REST_TOKEN: "",
        },
      }
    : undefined,
});
