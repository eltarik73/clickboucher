#!/usr/bin/env node
// Mesure le JavaScript chargé au premier affichage de chaque page App Router, en octets gzip,
// à partir d'un build Next 14 déjà fait (.next/). Lecture seule, sans dépendance.
//
// Usage (depuis la racine du dépôt, après `npm run build`) :
//   node .claude/skills/web-performance/scripts/first-load-js.mjs
//   node .claude/skills/web-performance/scripts/first-load-js.mjs --filter="(client)" --top=20
//   node .claude/skills/web-performance/scripts/first-load-js.mjs --html --top=15
//   node .claude/skills/web-performance/scripts/first-load-js.mjs --max-shared=215 --max-page=350 --html --max-html=345
//   node .claude/skills/web-performance/scripts/first-load-js.mjs --html --json > after.json
//   node .claude/skills/web-performance/scripts/first-load-js.mjs --html --compare=before.json --max-delta=5
//
// Deux mesures, à ne pas confondre :
//
// 1. Par manifestes (toujours) : rootMainFiles (partagé par toutes les pages) + les fichiers .js
//    des layouts de la chaîne + ceux de la page. C'est une approximation de la colonne
//    « First Load JS » de `next build`. Elle couvre toutes les pages, dynamiques comprises, mais
//    elle SOUS-ESTIME ce que le navigateur charge : elle ignore les chunks des error.tsx et tout
//    chunk attaché à une référence client du rendu serveur (cas réel : `next/dynamic` avec
//    `ssr: false` appelé depuis un Server Component, voir references/budget-js.md).
//
// 2. Par HTML prérendu (--html) : pour chaque .next/server/app/**/*.html, somme des
//    <script src="/_next/static/…"> hors `noModule`. C'est ce qu'un navigateur moderne télécharge
//    réellement au premier affichage. Ne couvre que les pages prérendues (pas les pages ƒ).
//
// Jamais comptés : polyfills (noModule), chunks chargés plus tard par next/dynamic ou import(),
// scripts tiers (clerk.browser.js, Speed Insights, Plausible).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.length ? v.join("=") : "true"];
  }),
);
const dir = args.dir ?? ".next";
const appManifestPath = path.join(dir, "app-build-manifest.json");
if (!fs.existsSync(appManifestPath)) {
  console.error(`Pas de ${appManifestPath} : lancer d'abord un build (npm run build).`);
  process.exit(2);
}
const app = JSON.parse(fs.readFileSync(appManifestPath, "utf8")).pages;
const build = JSON.parse(fs.readFileSync(path.join(dir, "build-manifest.json"), "utf8"));
const root = build.rootMainFiles ?? [];

const cache = new Map();
function gz(file) {
  if (!cache.has(file)) {
    const p = path.join(dir, file);
    cache.set(file, fs.existsSync(p) ? zlib.gzipSync(fs.readFileSync(p), { level: 9 }).length : 0);
  }
  return cache.get(file);
}
function chain(pageKey) {
  const segments = pageKey.split("/").filter(Boolean);
  segments.pop();
  const keys = ["/layout"];
  let acc = "";
  for (const s of segments) {
    acc += `/${s}`;
    keys.push(`${acc}/layout`);
  }
  keys.push(pageKey);
  return keys.filter((k) => app[k]);
}
const kb = (n) => Math.round((n / 1024) * 10) / 10;

const shared = kb(root.reduce((t, f) => t + gz(f), 0));
const rows = Object.keys(app)
  .filter((k) => k.endsWith("/page") && !k.startsWith("/api/"))
  .filter((k) => !args.filter || k.includes(args.filter))
  .map((page) => {
    const files = new Set(root);
    for (const k of chain(page)) for (const f of app[k]) if (f.endsWith(".js")) files.add(f);
    let total = 0;
    for (const f of files) total += gz(f);
    return { page, kb: kb(total) };
  })
  .sort((a, b) => b.kb - a.kb);

// Mesure 2 : scripts réellement référencés par le HTML prérendu.
function htmlRows() {
  const base = path.join(dir, "server", "app");
  const out = [];
  if (!fs.existsSync(base)) return out;
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(p);
        continue;
      }
      if (!entry.name.endsWith(".html")) continue;
      const files = new Set();
      for (const m of fs.readFileSync(p, "utf8").matchAll(/<script\b[^>]*>/g)) {
        if (/\snomodule\b/i.test(m[0])) continue;
        const src = m[0].match(/\ssrc="\/_next\/(static\/[^"?]+\.js)/);
        if (src) files.add(decodeURIComponent(src[1]));
      }
      let total = 0;
      for (const f of files) total += gz(f);
      const rel = path.relative(base, p).replace(/\.html$/, "").split(path.sep).join("/");
      out.push({ page: rel === "index" ? "/" : `/${rel}`, kb: kb(total) });
    }
  };
  walk(base);
  return out
    .filter((r) => !args.filter || r.page.includes(args.filter))
    .sort((a, b) => b.kb - a.kb || a.page.localeCompare(b.page));
}
const html = args.html ? htmlRows() : null;

if (args.json) {
  console.log(JSON.stringify({ sharedKb: shared, pages: rows, ...(html ? { html } : {}) }, null, 2));
  process.exit(0);
}

console.log(`JS partagé (rootMainFiles) : ${shared} KB gzip`);
const top = Number(args.top ?? rows.length);
console.log("\nPar manifestes (≈ « First Load JS » de next build, sous-estime le réel) :");
for (const r of rows.slice(0, top)) console.log(`${String(r.kb).padStart(7)} KB  ${r.page}`);
if (html) {
  console.log(`\nPar HTML prérendu (scripts réellement chargés, ${html.length} pages) :`);
  for (const r of html.slice(0, Number(args.top ?? html.length))) {
    console.log(`${String(r.kb).padStart(7)} KB  ${r.page}`);
  }
}

const failures = [];
if (args["max-shared"] && shared > Number(args["max-shared"])) {
  failures.push(`partagé ${shared} KB > ${args["max-shared"]} KB`);
}
if (args["max-page"]) {
  for (const r of rows) if (r.kb > Number(args["max-page"])) failures.push(`${r.page} ${r.kb} KB > ${args["max-page"]} KB`);
}
if (args["max-html"]) {
  if (!html) {
    console.error("--max-html demande --html.");
    process.exit(2);
  }
  for (const r of html) if (r.kb > Number(args["max-html"])) failures.push(`HTML ${r.page} ${r.kb} KB > ${args["max-html"]} KB`);
}
if (args.compare) {
  const before = JSON.parse(fs.readFileSync(args.compare, "utf8"));
  const maxDelta = Number(args["max-delta"] ?? 5);
  console.log(`\nÉcarts par rapport à ${args.compare} (seuil ${maxDelta} KB) :`);
  const sharedDelta = kb((shared - before.sharedKb) * 1024);
  console.log(`  partagé : ${sharedDelta >= 0 ? "+" : ""}${sharedDelta} KB`);
  if (sharedDelta > maxDelta) failures.push(`partagé +${sharedDelta} KB`);
  const diff = (label, now, then) => {
    const prev = new Map(then.map((p) => [p.page, p.kb]));
    for (const r of now) {
      if (!prev.has(r.page)) continue;
      const d = kb((r.kb - prev.get(r.page)) * 1024);
      if (Math.abs(d) >= 1) console.log(`  ${d >= 0 ? "+" : ""}${d} KB  ${label}${r.page}`);
      if (d > maxDelta) failures.push(`${label}${r.page} +${d} KB`);
    }
  };
  diff("", rows, before.pages);
  if (html && before.html) diff("HTML ", html, before.html);
  else if (html || before.html) console.log("  (comparaison HTML ignorée : --html absent d'un des deux relevés)");
}
if (failures.length) {
  console.error(`\nBudget dépassé :\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
