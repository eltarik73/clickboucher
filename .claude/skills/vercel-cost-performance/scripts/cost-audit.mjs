#!/usr/bin/env node
/**
 * cost-audit.mjs — audit statique (lecture seule) des régressions de coût Vercel.
 *
 * Usage (depuis la racine du dépôt) :
 *   node .claude/skills/vercel-cost-performance/scripts/cost-audit.mjs [racine]
 *
 * Ne modifie rien, ne lance ni build ni réseau. Code de sortie 1 si au moins une
 * ERREUR (régression qui a déjà causé ou causerait une panne de quota), 0 sinon.
 * Les AVERTISSEMENTS et INFOS demandent une lecture humaine : ce sont des
 * heuristiques, pas des preuves. Complète (ne remplace pas)
 * src/lib/__tests__/middleware-matcher.test.ts et scripts/check-prerender.mjs.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const ROOT = resolve(process.argv[2] ?? process.cwd());
const SRC = join(ROOT, "src");
const findings = [];
const add = (level, id, message, files = []) => findings.push({ level, id, message, files });
const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const rel = (p) => relative(ROOT, p).split(sep).join("/");

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "__tests__" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs)$/.test(name)) out.push(full);
  }
  return out;
}
const files = walk(SRC).map((path) => ({ path, rel: rel(path), text: read(path) }));
const appFiles = files.filter((f) => f.rel.startsWith("src/app/"));
const isApi = (f) => f.rel.startsWith("src/app/api/");
// Commentaires retirés pour ne pas matcher du code désactivé ou de la doc.
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// 1. Prop `dynamic` sur <ClerkProvider> : bascule toute l'app en rendu par requête.
const layout = code(read(join(SRC, "app/layout.tsx")));
if (/<ClerkProvider\b[^>]*\bdynamic\b/.test(layout)) {
  add("ERREUR", "clerk-dynamic", "<ClerkProvider dynamic> dans src/app/layout.tsx : toutes les pages redeviennent des fonctions (panne 2026-11-05).", ["src/app/layout.tsx"]);
}

// 2. Matcher du middleware : doit rester une liste blanche.
const mw = read(join(SRC, "middleware.ts"));
const matcherBlock = code(mw).match(/export const config\s*=\s*{\s*matcher:\s*\[([\s\S]*?)\]\s*,?\s*}/);
const matchers = matcherBlock ? [...matcherBlock[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]) : [];
if (matchers.length === 0) {
  add("ERREUR", "matcher-absent", "config.matcher introuvable dans src/middleware.ts : sans matcher le middleware tourne sur CHAQUE requête.", ["src/middleware.ts"]);
}
for (const m of matchers) {
  const catchAll = m === "/(.*)" || m === "/:path*" || (/^\/\(\(\?!/.test(m) && !/%\[0-9A-Fa-f\]/.test(m));
  if (catchAll) add("ERREUR", "matcher-attrape-tout", `Entrée de matcher attrape-tout : "${m}". Revenir à la liste blanche.`, ["src/middleware.ts"]);
}
const apiMatcher = matchers.find((m) => m.startsWith("/api/("));
let apiRuns = () => true;
if (apiMatcher) {
  try {
    const re = new RegExp(`^${apiMatcher}$`);
    apiRuns = (path) => re.test(path);
  } catch {
    add("AVERTISSEMENT", "matcher-api-illisible", "Impossible de compiler l'entrée /api du matcher en RegExp : contrôles 9 et 10 dégradés.", ["src/middleware.ts"]);
  }
}

// 3. Sentry ne doit pas ré-instrumenter le middleware.
if (!/autoInstrumentMiddleware:\s*false/.test(read(join(ROOT, "next.config.mjs")))) {
  add("ERREUR", "sentry-middleware", "next.config.mjs : webpack.autoInstrumentMiddleware n'est plus à false (SDK edge ≈ 175 kB chargé à chaque cold start du middleware).", ["next.config.mjs"]);
}
if (/sentry\.edge\.config/.test(code(read(join(SRC, "instrumentation.ts"))))) {
  add("AVERTISSEMENT", "sentry-edge", "src/instrumentation.ts importe de nouveau sentry.edge.config : justifié seulement si une vraie route edge existe.", ["src/instrumentation.ts"]);
}

// 4. Runtime edge : désactive la génération statique de la route.
const edge = appFiles.filter((f) => /export const runtime\s*=\s*["']edge["']/.test(code(f.text)));
if (edge.length) add("AVERTISSEMENT", "runtime-edge", "runtime = \"edge\" : la route n'est plus prérendue et devient une fonction par requête.", edge.map((f) => f.rel));

// 5. force-dynamic hors API.
const FORCE_DYNAMIC_OK = ["src/app/(client)/suivi/[id]/page.tsx"];
const forced = appFiles.filter((f) => !isApi(f) && /export const dynamic\s*=\s*["']force-dynamic["']/.test(code(f.text)) && !FORCE_DYNAMIC_OK.includes(f.rel));
if (forced.length) add("AVERTISSEMENT", "force-dynamic", "force-dynamic sur une page/metadata route : une fonction par vue, bots compris.", forced.map((f) => f.rel));

// 6. Segment dynamique avec revalidate mais sans generateStaticParams : revalidate inopérant.
const REVALIDATE_ONLY_OK = ["src/app/(client)/boutique/[slug]/page.tsx"];
const pages = appFiles.filter((f) => /\/page\.tsx$/.test(f.rel) && !isApi(f));
const fakeIsr = pages.filter((f) => /\[[^\]]+\]/.test(f.rel) && /export const revalidate\b/.test(code(f.text)) && !/generateStaticParams/.test(code(f.text)) && !REVALIDATE_ONLY_OK.includes(f.rel));
if (fakeIsr.length) add("AVERTISSEMENT", "isr-sans-params", "revalidate sans generateStaticParams sur un segment dynamique : la page reste rendue à chaque requête (au besoin `return []`).", fakeIsr.map((f) => f.rel));

// 7. Fenêtres ISR courtes.
const shortIsr = pages
  .map((f) => ({ f, m: code(f.text).match(/export const revalidate\s*=\s*(\d+)/) }))
  .filter(({ m }) => m && Number(m[1]) > 0 && Number(m[1]) < 300)
  .map(({ f, m }) => `${f.rel} (revalidate=${m[1]})`);
if (shortIsr.length) add("INFO", "isr-court", "Fenêtre ISR < 300 s : à faible trafic, chaque visite isolée déclenche une régénération (fonction + écriture ISR).", shortIsr);

// 8. Polling nu : setInterval qui pilote un appel réseau, sans gestion de visibilité.
const POLL_OK = ["src/hooks/use-order-polling.ts", "src/hooks/useVisiblePolling.ts"];
const rawPolling = files.filter((f) => {
  const c = code(f.text);
  if (isApi(f) || POLL_OK.includes(f.rel)) return false;
  if (/useVisiblePolling|startVisiblePolling|visibilityState|visibilitychange/.test(c)) return false;
  return /setInterval\(\s*(async\b|fetch\w*\s*[,)])/.test(c) && /fetch\w*\(/.test(c);
});
if (rawPolling.length) add("AVERTISSEMENT", "polling-nu", "setInterval qui lance un appel réseau sans useVisiblePolling ni test de visibilité : onglet caché = invocations facturées pour personne.", rawPolling.map((f) => f.rel));

// 9. Cache public sur une route qui lit l'authentification.
const AUTH_IMPORT = /from ["']@\/lib\/(auth\/server-auth|boucher-auth|admin-auth)["']/;
const apiRoutes = appFiles.filter((f) => isApi(f) && /\/route\.ts$/.test(f.rel));
const routePath = (f) => "/" + f.rel.replace(/^src\/app\//, "").replace(/\/route\.ts$/, "");
const cachedAuthed = apiRoutes.filter((f) => /apiCached\(|s-maxage/.test(code(f.text)) && AUTH_IMPORT.test(f.text));
if (cachedAuthed.length) add("AVERTISSEMENT", "cache-public-avec-auth", "Cache CDN public (apiCached / s-maxage) dans un fichier qui importe un helper d'auth : vérifier méthode par méthode qu'aucune réponse dépendant de l'utilisateur n'est partagée (fuite prix pro, audit 2026-11).", cachedAuthed.map((f) => f.rel));

// 10. GET public cacheable encore couvert par le matcher : un HIT CDN paie quand même le middleware.
const cachedMatched = apiRoutes.filter((f) => /apiCached\(|s-maxage/.test(code(f.text)) && !AUTH_IMPORT.test(f.text) && !/\[/.test(routePath(f)) && apiRuns(routePath(f)));
if (cachedMatched.length) add("INFO", "cache-derriere-middleware", "Route publique cacheable encore dans le matcher : chaque HIT CDN exécute le middleware. Candidates à l'exclusion (handler sans aucun import d'auth, test matcher à jour).", cachedMatched.map((f) => `${f.rel} → ${routePath(f)}`));

// 11. Crons : fréquence, route présente, hors middleware.
const vercelJson = JSON.parse(read(join(ROOT, "vercel.json")) || "{}");
const crons = vercelJson.crons ?? [];
for (const { path, schedule } of crons) {
  const [minute, hour] = String(schedule).trim().split(/\s+/);
  if (/[*/,-]/.test(minute) || /[*/,-]/.test(hour)) add("AVERTISSEMENT", "cron-sous-quotidien", `Cron ${path} "${schedule}" tourne plus d'une fois par jour : refusé au déploiement sur Hobby, et chaque exécution est une invocation.`, ["vercel.json"]);
  if (!existsSync(join(SRC, "app", path, "route.ts"))) add("ERREUR", "cron-sans-route", `Cron ${path} déclaré dans vercel.json sans src/app${path}/route.ts.`, ["vercel.json"]);
  else if (!/verifyCronAuth\(/.test(read(join(SRC, "app", path, "route.ts")))) add("ERREUR", "cron-sans-auth", `src/app${path}/route.ts n'appelle pas verifyCronAuth().`, [`src/app${path}/route.ts`]);
  if (apiRuns(path)) add("AVERTISSEMENT", "cron-dans-matcher", `Cron ${path} passe par le middleware (matcher) : invocation inutile.`, ["src/middleware.ts"]);
}

// 12. Liens en masse sans prefetch={false}.
for (const name of ["SeoFooter.tsx"]) {
  for (const f of files.filter((x) => x.rel.endsWith(`/${name}`))) {
    // Un wrapper local `<NextLink prefetch={false} {...props} />` couvre tous les liens du fichier.
    if (/prefetch=\{false\}\s*\{\.\.\.props\}/.test(code(f.text))) continue;
    const links = (code(f.text).match(/<Link\b/g) ?? []).length;
    const off = (code(f.text).match(/prefetch=\{false\}/g) ?? []).length;
    if (links > off) add("AVERTISSEMENT", "prefetch-masse", `${links - off} <Link> sans prefetch={false} dans un composant de liens en masse.`, [f.rel]);
  }
}

// 13. Appels API au montage dans des composants publics (heuristique).
const PUBLIC_API = /\/api\/(shops(\/|$)|geo|reviews|search|suggestions|offers|calendar-events|products|categories|support\/faq|checkout\/guest|cart\/(add|reserve)|auth\/otp|push\/subscribe)/;
const mountFetch = files.filter((f) => {
  if (!/^src\/(components|app\/\(client\))\//.test(f.rel)) return false;
  if (/\/(boucher|webmaster|admin|dashboard|checkout|profil|commandes|commande|suivi|chat|panier)\//.test(f.rel)) return false;
  const c = code(f.text);
  if (!/["']use client["']/.test(f.text) || !/useEffect\(/.test(c)) return false;
  const calls = [...c.matchAll(/fetch\(\s*[`"'](\/api\/[^`"'?$]*)/g)].map((m) => m[1]).filter((p) => !PUBLIC_API.test(p));
  return calls.length > 0 && !/isSignedIn|hasTestModeCookie|useCurrentUser|useAuth\(|useUser\(/.test(c);
});
if (mountFetch.length) add("INFO", "appel-api-anonyme", "Composant client public avec fetch(/api/…) et useEffect sans garde d'authentification visible : vérifier qu'un visiteur anonyme ne déclenche aucun appel au montage.", mountFetch.map((f) => f.rel));

// 14. Formats d'image.
if (/formats:\s*\[[^\]]*avif/.test(read(join(ROOT, "next.config.mjs")))) {
  add("INFO", "images-avif", "images.formats contient image/avif : voir « Points à arbitrer » (deux formats = jusqu'à 2× d'entrées de cache et de transformations).", ["next.config.mjs"]);
}

// ── Rapport ──
const order = { ERREUR: 0, AVERTISSEMENT: 1, INFO: 2 };
findings.sort((a, b) => order[a.level] - order[b.level]);
const count = (level) => findings.filter((f) => f.level === level).length;
process.stdout.write(`[cost-audit] ${files.length} fichiers, ${apiRoutes.length} routes API, ${crons.length} crons, ${matchers.length} entrées de matcher\n`);
for (const f of findings) {
  process.stdout.write(`\n${f.level} [${f.id}] ${f.message}\n`);
  for (const file of f.files.slice(0, 15)) process.stdout.write(`  - ${file}\n`);
  if (f.files.length > 15) process.stdout.write(`  … et ${f.files.length - 15} autres\n`);
}
process.stdout.write(`\n[cost-audit] ${count("ERREUR")} erreur(s), ${count("AVERTISSEMENT")} avertissement(s), ${count("INFO")} info(s)\n`);
process.exit(count("ERREUR") > 0 ? 1 : 0);
