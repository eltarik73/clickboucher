#!/usr/bin/env node
/**
 * Garde-fou CI — vérifie que `next build` a bien prérendu les pages publiques.
 *
 * Pourquoi : en avril 2026 un changement de layout a fait basculer 298 routes
 * sur 308 en rendu dynamique (une fonction serverless par page vue) sans
 * qu'aucun job CI ne le voie, jusqu'au dépassement du quota CPU Vercel.
 * Ce script lit `.next/prerender-manifest.json` après le build et échoue si
 * une page publique clé n'est plus statique/ISR ou si le nombre total de
 * routes prérendues s'effondre.
 *
 * Usage : node scripts/check-prerender.mjs [chemin/vers/prerender-manifest.json]
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED_ROUTES = ["/", "/cgv", "/a-propos", "/boucherie-halal/chambery", "/sitemap.xml"];
const MIN_PRERENDERED_ROUTES = 250;

const manifestPath = resolve(process.cwd(), process.argv[2] ?? ".next/prerender-manifest.json");

function fail(message) {
  process.stderr.write(`[check-prerender] ÉCHEC : ${message}\n`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (error) {
  fail(
    `impossible de lire ${manifestPath} (${error.message}). Lancer \`npm run build\` avant ce script.`
  );
}

const routes = manifest?.routes;
if (!routes || typeof routes !== "object") {
  fail(`${manifestPath} ne contient pas d'objet "routes" — format de manifest inattendu.`);
}

const prerenderedCount = Object.keys(routes).length;
process.stdout.write(
  `[check-prerender] ${prerenderedCount} routes prérendues (minimum attendu : ${MIN_PRERENDERED_ROUTES})\n`
);

const problems = [];

for (const route of REQUIRED_ROUTES) {
  const entry = routes[route];
  if (!entry) {
    problems.push(`${route} n'est pas prérendue (rendu dynamique à chaque requête)`);
    continue;
  }
  const status = entry.initialStatus;
  if (typeof status === "number" && status !== 200) {
    problems.push(`${route} est prérendue avec le statut HTTP ${status}`);
  }
}

if (prerenderedCount < MIN_PRERENDERED_ROUTES) {
  problems.push(
    `seulement ${prerenderedCount} routes prérendues, minimum attendu ${MIN_PRERENDERED_ROUTES} — des pages sont repassées en rendu dynamique`
  );
}

if (problems.length > 0) {
  fail(
    [
      `${problems.length} problème(s) de prérendu :`,
      ...problems.map((problem) => `  - ${problem}`),
      "Causes habituelles : `dynamic` sur <ClerkProvider>, cookies()/headers()/auth() dans un layout,",
      '`export const dynamic = "force-dynamic"` ou un fetch `no-store` dans une page publique.',
    ].join("\n")
  );
}

process.stdout.write(`[check-prerender] OK — ${REQUIRED_ROUTES.join(", ")} sont prérendues\n`);
