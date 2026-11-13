// @vitest-environment node
// Verrouille config.matcher (liste blanche) sur les règles de src/middleware.ts.
// Autonome : ne lit que les sources, pas de build .next requis.
//
// Pourquoi ce test existe : chaque exécution du middleware est facturée en CPU
// par Vercel. Un matcher « attrape-tout » a mis le site hors ligne (quota
// dépassé, 2026-11-05). À l'inverse, une route protégée oubliée dans la liste
// blanche ne serait plus gardée. Ce test échoue dans les deux cas.
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { getMiddlewareMatchers } from "next/dist/build/analysis/get-page-static-info";
import { getMiddlewareRouteMatcher } from "next/dist/shared/lib/router/utils/middleware-route-matcher";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const src = fs.readFileSync(path.join(SRC, "middleware.ts"), "utf8");

function literals(block: string): string[] {
  const clean = block.replace(/^\s*\/\/.*$/gm, "");
  return [...clean.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`) as string);
}

function ruleList(name: string): string[] {
  const m = src.match(new RegExp(`const\\s+${name}\\s*=\\s*createRouteMatcher\\(\\[([\\s\\S]*?)\\]\\)`));
  if (!m) throw new Error(`createRouteMatcher list not found: ${name}`);
  return literals(m[1]);
}

const cfg = src.match(/export const config\s*=\s*{\s*matcher:\s*\[([\s\S]*?)\]\s*,?\s*}/);
if (!cfg) throw new Error("config.matcher not found");
const MATCHER = literals(cfg[1]);
const runs = getMiddlewareRouteMatcher(getMiddlewareMatchers([...MATCHER], {}));
const RUN = (p: string) => runs(p, { headers: {} } as never, {});
const sample = (pattern: string) => pattern.replace("(.*)", "x");

const GUARDED = ["isBoucherRoute", "isAdminRoute", "isWebmasterRoute", "isProtectedRoute", "isOnboardingRoute"];

// ── Fermeture d'imports (pour vérifier qu'un handler exclu ne touche pas Clerk) ──
const AUTH_HELPERS = ["lib/auth/server-auth.ts", "lib/boucher-auth.ts", "lib/admin-auth.ts"].map((f) =>
  path.join(SRC, f)
);

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function importClosure(entry: string): { files: Set<string>; clerkAuthImport: string | null } {
  const files = new Set<string>();
  let clerkAuthImport: string | null = null;
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (files.has(file)) continue;
    files.add(file);
    const code = fs.readFileSync(file, "utf8");
    // Import de valeur auth()/currentUser() directement depuis Clerk (interdit par CLAUDE.md, mais on vérifie)
    for (const m of code.matchAll(/import\s+(?!type\b)\{([^}]*)\}\s+from\s+["']@clerk\/nextjs\/server["']/g)) {
      const names = m[1].split(",").map((n) => n.trim()).filter((n) => !n.startsWith("type "));
      if (names.some((n) => /^(auth|currentUser)\b/.test(n))) clerkAuthImport = file;
    }
    const specs = [
      ...[...code.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]),
      ...[...code.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]),
    ];
    for (const spec of specs) {
      const resolved = resolveImport(file, spec);
      if (resolved) queue.push(resolved);
    }
  }
  return { files, clerkAuthImport };
}

function apiRouteFiles(dir = path.join(SRC, "app", "api")): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith("_") ? [] : apiRouteFiles(full);
    return entry.name === "route.ts" ? [full] : [];
  });
}

function urlOf(routeFile: string): string {
  const rel = path.relative(path.join(SRC, "app"), path.dirname(routeFile)).split(path.sep);
  return "/" + rel.map((seg) => (seg.startsWith("[") ? "x" : seg)).join("/");
}

describe("middleware config.matcher", () => {
  it("reprend à l'identique chaque motif des règles protégées", () => {
    for (const name of GUARDED) for (const p of ruleList(name)) expect(MATCHER, `${name}: ${p}`).toContain(p);
  });

  it("s'exécute sur les chemins protégés, les pages auth() et l'API authentifiée", () => {
    const must = [
      ...GUARDED.flatMap(ruleList).flatMap((p) => [sample(p), p.replace("(.*)", "")]),
      "/admin/shops/x.css", "/boucher/support/x.png", "/webmaster/boutiques/x.js",
      "/admin-login", "/suivi/x", "/sign-in", "/sign-in/sso-callback", "/sign-up/verify-email-address",
      "/commande/x", "/shop/offers", "/dashboard/marketing",
      "/api/cart", "/api/orders", "/api/orders/x", "/api/boucher/images/proxy", "/api/admin/stats",
      "/api/seo/indexnow", "/api/products", "/api/search", "/api/reviews", "/api/checkout/guest",
      // voisins des exclusions API : doivent rester couverts
      "/api/cronjob", "/api/healthz", "/api/health/x", "/api/geofence", "/api/shops/nearby/x",
      "/api/payments/x", "/api/webhooks", "/api/test-mode",
      // chemins percent-encodés : toujours soumis aux règles (contournement /%61dmin/…)
      "/%61dmin/dashboard", "/admin%2Fdashboard", "/%62oucher/commandes", "/%70rofil", "/boutique/caf%C3%A9",
    ];
    for (const p of must) expect(RUN(p), p).toBe(true);
  });

  it("ne s'exécute jamais sur les pages publiques, métadonnées, fichiers statiques et scans", () => {
    const never = [
      ...ruleList("isPublicRoute").map(sample),
      "/", "/panier", "/a-propos", "/contact", "/presse", "/click-and-collect-halal", "/commander-viande-halal",
      "/devenir-boucher-partenaire/chambery", "/validation/x", "/inscription-boucher", "/inscription-pro",
      "/boucheries-halal/savoie", "/boucherie-halal/lyon", "/produits", "/pro", "/recettes/x",
      "/robots.txt", "/sitemap.xml", "/manifest.json", "/llms.txt", "/icon", "/opengraph-image", "/sw.js",
      "/_next/static/chunks/main.js", "/_next/static/chunks/app/(client)/boutique/%5Bslug%5D/page-abc.js",
      "/_next/image", "/favicon.ico", "/sounds/notification.mp3", "/.well-known/security.txt",
      "/wp-login.php", "/.env", "/xmlrpc.php", "/administrator", "/admin.php", "/login",
      // handlers API sans Clerk
      "/api/cron", "/api/cron/unsnooze", "/api/cron/seo-audit", "/api/webhooks/clerk", "/api/payments/webhook",
      "/api/health", "/api/test-mode/status", "/api/test-mode/activate", "/api/geo", "/api/shops/nearby",
    ];
    for (const p of never) expect(RUN(p), p).toBe(false);
  });

  it("n'exclut de l'API que des handlers qui n'atteignent jamais l'auth Clerk", () => {
    const excluded = apiRouteFiles().filter((f) => !RUN(urlOf(f)));
    expect(excluded.length).toBeGreaterThan(0);
    for (const file of excluded) {
      const { files, clerkAuthImport } = importClosure(file);
      const rel = path.relative(ROOT, file);
      for (const helper of AUTH_HELPERS) {
        expect(files.has(helper), `${rel} est hors matcher mais importe ${path.relative(ROOT, helper)}`).toBe(false);
      }
      expect(clerkAuthImport, `${rel} est hors matcher mais importe auth()/currentUser() de Clerk`).toBeNull();
    }
  });
});
