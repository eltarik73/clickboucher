#!/usr/bin/env node
// Audit statique (lecture seule) des route handlers de src/app/api contre les conventions du
// skill api-route-conventions. Aucune dépendance, aucune écriture.
//
// Usage (depuis la racine du dépôt) :
//   node .claude/skills/api-route-conventions/scripts/audit-routes.mjs            # tout le dépôt
//   node .../audit-routes.mjs src/app/api/orders                                  # un sous-arbre
//   node .../audit-routes.mjs --strict <fichiers modifiés…>                       # code retour 1 si erreur
//   node .../audit-routes.mjs --json                                              # sortie machine
//   node .../audit-routes.mjs --list no-rate-limit                                # fichiers d'une règle
//
// Heuristiques par expressions régulières : un résultat est une piste à vérifier dans le fichier,
// pas un verdict. Les exceptions légitimes sont listées dans EXEMPT ci-dessous.
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const listRule = args.includes("--list") ? args[args.indexOf("--list") + 1] : null;
const targets = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--list");
const ROOT = process.cwd();
const API_DIR = path.join(ROOT, "src", "app", "api");

if (!fs.existsSync(API_DIR)) {
  console.error("src/app/api introuvable : lancer le script depuis la racine du dépôt.");
  process.exit(2);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name === "route.ts" || entry.name === "route.tsx" ? [full] : [];
  });
}

const rel = (file) => path.relative(ROOT, file).split(path.sep).join("/");
const apiPath = (file) => rel(file).replace(/^src\/app\/api\//, "").replace(/\/route\.tsx?$/, "");

let files = walk(API_DIR);
if (targets.length > 0) {
  const wanted = targets.map((t) => path.resolve(ROOT, t));
  files = files.filter((f) => wanted.some((w) => f === w || f.startsWith(w + path.sep)));
}

// Handlers dont la RÉPONSE DE SUCCÈS n'est légitimement pas l'enveloppe { success, data } :
// contrat imposé par un tiers, flux, binaire, export de fichier, sonde.
const EXEMPT_ENVELOPE = [
  /^webhooks\//, /^payments\/webhook$/, /\/stream$/, /^health$/, /\/export$/,
  /^boucher\/images\/proxy$/, /^test-mode\//,
];
// Chemins exclus du matcher Clerk de src/middleware.ts (à garder synchronisé avec config.matcher).
const OUTSIDE_CLERK = [/^cron(\/|$)/, /^webhooks\//, /^payments\/webhook$/, /^health$/, /^test-mode\//, /^geo$/, /^shops\/nearby$/];

const FACTORIES = "(?:open|cron|user|optionalUser|client|boucher|admin)Route";
const RE = {
  wrapped: new RegExp(`export const (GET|POST|PUT|PATCH|DELETE)\\s*=\\s*${FACTORIES}\\(`, "g"),
  legacy: /export (?:async )?function (GET|POST|PUT|PATCH|DELETE)\b/g,
  anyHandler: /export (?:(?:async )?function (GET|POST|PUT|PATCH|DELETE)\b|const (GET|POST|PUT|PATCH|DELETE)\s*=)/g,
  sessionCall: /\b(?:getServerUserId|getAuthenticatedBoucher|requireAdmin|getBoucherOwnerUserId|resolveUserRole)\(/,
  sessionFactory: /=\s*(?:user|optionalUser|client|boucher|admin)Route\(/,
  clerkDirect: /import\s+(?!type\b)\{([^}]*)\}\s+from\s+["']@clerk\/nextjs\/server["']/g,
  tryCatch: /\btry\s*\{/,
  rawResponse: /\bNextResponse\.json\(|(?<![A-Za-z])Response\.json\(|new (?:Next)?Response\(/,
  readsJson: /\b(?:req|request|_req)\.json\(\)/,
  zodParse: /\.(?:safeParse|parse)\(/,
  wrapperBody: /\bbody:\s*[A-Za-z_]/,
  nanNumber: /(?:parseInt|Number)\(\s*(?:[A-Za-z_.]*[sS]earchParams|sp|url\.searchParams|params)\.get\(/,
  console: /\bconsole\.(?:log|error|warn|info)\(/,
  segmentConfig: /export const (?:dynamic|revalidate)\s*=/,
  staticIntent: /export const revalidate\s*=\s*[1-9]|export const dynamic\s*=\s*["']force-static["']/,
  leak: /(?:apiError\([^;]*|message:\s*|error:\s*|details:\s*)(?:String\((?:err|error|e)\)|(?:err|error|e)(?: instanceof Error \? (?:err|error|e))?\.message)/,
  sharedCache: /\bapiCached\(|s-maxage/,
  clerkRouteImport: /from ["']@\/lib\/api\/route-auth["']/,
  rateLimited: /\bcheckRateLimit\(|\brateLimit:\s*["']/,
  capacityCode: /apiError\(\s*["']CAPACITY_EXCEEDED["']/,
  syncParams: /\{\s*params\s*\}\s*:\s*\{\s*params:\s*\{/,
};

const RULES = [
  { id: "clerk-direct", level: "error", label: "auth()/currentUser() importés de Clerk dans un handler (interdit par CLAUDE.md)" },
  { id: "no-catch", level: "error", label: "handler sans fabrique ni try/catch + handleApiError" },
  { id: "raw-response", level: "error", label: "réponse hors enveloppe (NextResponse.json / new Response) sans exception listée" },
  { id: "unvalidated-body", level: "error", label: "req.json() sans schéma Zod" },
  { id: "nan-query", level: "error", label: "parseInt()/Number() sur un paramètre de requête (NaN ⇒ 500 Prisma)" },
  { id: "console", level: "error", label: "console.* au lieu de logger" },
  { id: "no-segment-config", level: "error", label: "ni `dynamic` ni `revalidate` déclaré" },
  { id: "error-leak", level: "error", label: "message d'exception renvoyé au client" },
  { id: "shared-cache-with-auth", level: "error", label: "cache partagé (apiCached / s-maxage) dans un handler qui lit la session" },
  { id: "clerk-route-outside-matcher", level: "error", label: "handler hors matcher Clerk qui importe @/lib/api/route-auth (utiliser route-open)" },
  { id: "static-with-factory", level: "error", label: "`revalidate` ou `force-static` sur un handler passé par une fabrique (elle lit req.headers : le handler devient dynamique)" },
  { id: "no-rate-limit", level: "warn", label: "mutation sans rate limit" },
  { id: "capacity-code-in-route", level: "warn", label: "CAPACITY_EXCEEDED émis par la route (réservé à la capacité boutique ; rate limit ⇒ RATE_LIMITED)" },
  { id: "sync-params", level: "warn", label: "params lu comme objet synchrone (cassé en Next 15 ; la fabrique fait l'await)" },
  { id: "too-long", level: "warn", label: "route.ts > 300 lignes (logique à déplacer dans src/lib/services)" },
  { id: "legacy", level: "info", label: "handler non migré vers une fabrique *Route" },
];

const findings = Object.fromEntries(RULES.map((r) => [r.id, []]));
const stats = { files: files.length, handlers: 0, wrappedHandlers: 0, wrappedFiles: 0, mixedFiles: 0, exemptFiles: 0 };

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const p = apiPath(file);
  const wrapped = [...code.matchAll(RE.wrapped)].length;
  const legacy = [...code.matchAll(RE.legacy)].length;
  const exemptEnvelope = EXEMPT_ENVELOPE.some((re) => re.test(p));
  const outsideClerk = OUTSIDE_CLERK.some((re) => re.test(p));
  stats.handlers += wrapped + legacy;
  stats.wrappedHandlers += wrapped;
  if (wrapped > 0 && legacy === 0) stats.wrappedFiles += 1;
  if (wrapped > 0 && legacy > 0) stats.mixedFiles += 1;
  if (exemptEnvelope) stats.exemptFiles += 1;
  const add = (id) => findings[id].push(rel(file));
  // Un bloc par méthode exportée : du `export` jusqu'au suivant (ou la fin du fichier).
  const starts = [...code.matchAll(RE.anyHandler)].map((m) => ({ method: m[1] || m[2], index: m.index }));
  const blocks = starts.map((s, i) => ({ method: s.method, code: code.slice(s.index, starts[i + 1]?.index ?? code.length) }));

  for (const m of code.matchAll(RE.clerkDirect)) {
    const names = m[1].split(",").map((n) => n.trim()).filter((n) => n && !n.startsWith("type "));
    if (names.some((n) => /^(auth|currentUser)\b/.test(n))) { add("clerk-direct"); break; }
  }
  if (legacy > 0 && !RE.tryCatch.test(code)) add("no-catch");
  if (!exemptEnvelope && RE.rawResponse.test(code)) add("raw-response");
  if (RE.readsJson.test(code) && !RE.zodParse.test(code) && !RE.wrapperBody.test(code)) add("unvalidated-body");
  if (RE.nanNumber.test(code)) add("nan-query");
  if (RE.console.test(code)) add("console");
  if (!RE.segmentConfig.test(code)) add("no-segment-config");
  if (RE.leak.test(code)) add("error-leak");
  if (blocks.some((b) => RE.sharedCache.test(b.code) && (RE.sessionCall.test(b.code) || RE.sessionFactory.test(b.code)))) add("shared-cache-with-auth");
  if (outsideClerk && RE.clerkRouteImport.test(code)) add("clerk-route-outside-matcher");
  if (wrapped > 0 && RE.staticIntent.test(code)) add("static-with-factory");
  if (!exemptEnvelope && !/^cron(\/|$)/.test(p) && blocks.some((b) => b.method !== "GET" && !RE.rateLimited.test(b.code))) add("no-rate-limit");
  if (RE.capacityCode.test(code)) add("capacity-code-in-route");
  if (legacy > 0 && RE.syncParams.test(code)) add("sync-params");
  if (src.split("\n").length > 300) add("too-long");
  if (legacy > 0) add("legacy");
}

const errors = RULES.filter((r) => r.level === "error").reduce((n, r) => n + findings[r.id].length, 0);

if (flag("--json")) {
  console.log(JSON.stringify({ stats, findings, errors }, null, 2));
} else if (listRule) {
  if (!findings[listRule]) {
    console.error(`Règle inconnue : ${listRule}. Règles : ${RULES.map((r) => r.id).join(", ")}`);
    process.exit(2);
  }
  for (const f of findings[listRule]) console.log(f);
} else {
  console.log(`Route handlers audités : ${stats.files} fichiers, ${stats.handlers} méthodes`);
  console.log(`Migration : ${stats.wrappedHandlers}/${stats.handlers} méthodes sur une fabrique *Route ` +
    `(${stats.wrappedFiles} fichiers entièrement migrés, ${stats.mixedFiles} partiellement)\n`);
  const pad = (s, n) => String(s).padEnd(n);
  for (const r of RULES) {
    const hits = findings[r.id];
    console.log(`${pad(r.level.toUpperCase(), 6)} ${pad(r.id, 30)} ${pad(hits.length, 4)} ${r.label}`);
    const show = targets.length > 0 || flag("--verbose") ? hits : r.level === "error" ? hits.slice(0, 8) : [];
    for (const f of show) console.log(`         - ${f}`);
    if (show.length < hits.length && r.level === "error") console.log(`         … ${hits.length - show.length} de plus (--list ${r.id})`);
  }
  console.log(`\n${errors} écart(s) de niveau erreur.`);
}

process.exit(flag("--strict") && errors > 0 ? 1 : 0);
