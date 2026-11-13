import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { Redis } from "@upstash/redis";

// ── Upstash Redis client (Edge-compatible) ──
// Used to share the role cache across middleware instances so that role
// changes propagate quickly (the old in-memory Map was per-instance).
const edgeRedis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// @security: test-only — Bypass Clerk ONLY if secret was validated (cookie present)
function isTestActivatedMiddleware(req: NextRequest): boolean {
  if (process.env.TEST_MODE !== "true") return false;
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_TEST_IN_PROD !== "true") {
    return false;
  }
  return req.cookies.get("klikgo-test-activated")?.value === "true";
}

// IMPORTANT: matchers strict — utiliser /boucher$|/boucher/(.*) car
// "/boucher(.*)" matche aussi /boucheries-halal-rhone-alpes,
// /boucheries-halal/rhone, /boucheries-halal-ouvertes-dimanche/lyon
// (toutes nos pages SEO annuaire — Sprints 1-7) → redirect 307 cassé.
const isBoucherRoute = createRouteMatcher(["/boucher", "/boucher/(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin", "/admin/(.*)"]);
const isAdminLoginRoute = createRouteMatcher(["/admin-login"]);
const isWebmasterRoute = createRouteMatcher(["/webmaster", "/webmaster/(.*)"]);
const isProtectedRoute = createRouteMatcher([
  "/checkout(.*)",
  "/commandes(.*)",
  "/profil(.*)",
  "/chat(.*)",
]);

const ADMIN_ROLES = ["admin", "webmaster"];

// ── Role cache (Redis-backed, Edge-safe) ──────────
// Shared across middleware instances. Fallback to short-TTL in-memory
// Map (60s) when Redis is not configured — keeps role changes quick to
// propagate in dev / test environments.
const roleCache = new Map<string, { role: string | undefined; ts: number }>();
const MEM_CACHE_TTL = 60 * 1000; // 60s fallback when Redis missing
const REDIS_CACHE_TTL = 60; // 60s in Redis — tightened from 5 min to limit role-stale window
const ROLE_KEY = (userId: string) => `role:${userId}`;

/** Fetch role from Clerk publicMetadata with Redis-backed cache */
async function getUserRole(userId: string): Promise<string | undefined> {
  // 1. Redis lookup (shared across instances)
  if (edgeRedis) {
    try {
      const cached = await edgeRedis.get<string>(ROLE_KEY(userId));
      if (cached !== null && cached !== undefined) {
        // Empty string sentinel for "no role"
        return cached === "" ? undefined : cached;
      }
    } catch {
      // ignore and fall through to Clerk
    }
  } else {
    // Fallback in-memory cache (60s TTL, per-instance)
    const mem = roleCache.get(userId);
    if (mem && Date.now() - mem.ts < MEM_CACHE_TTL) {
      return mem.role;
    }
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const role = (user.publicMetadata as Record<string, string>)?.role;

    if (edgeRedis) {
      try {
        await edgeRedis.set(ROLE_KEY(userId), role ?? "", { ex: REDIS_CACHE_TTL });
      } catch {
        // ignore
      }
    } else {
      roleCache.set(userId, { role, ts: Date.now() });
      if (roleCache.size > 500) {
        const oldest = [...roleCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
        for (let i = 0; i < 100; i++) roleCache.delete(oldest[i][0]);
      }
    }
    return role;
  } catch {
    return undefined;
  }
}

const isOnboardingRoute = createRouteMatcher(["/onboarding"]);
const isSignRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

// Séparateurs de chemin encodés (%2F, %5C) : jamais légitimes dans nos routes,
// et decodeURI (utilisé par createRouteMatcher) ne les décode pas — on les refuse
// pour qu'un chemin du type /admin%2Fdashboard ne puisse pas esquiver les règles.
const ENCODED_SEPARATOR_RE = /%(?:2f|5c)/i;

// ── Public routes: bypass Clerk ENTIRELY (no JWT verification, no cookie processing) ──
const isPublicRoute = createRouteMatcher([
  "/",
  "/boutique/(.*)",
  "/espace-boucher",
  "/bons-plans(.*)",
  "/inscription-boucher",
  "/inscription-pro",
  "/boucherie-halal/(.*)",
  "/recettes(.*)",
  "/avantages",
  "/pro",
  "/mentions-legales",
  "/cgv",
  "/politique-de-confidentialite",
  "/favoris",
  "/recherche",
  // SEO annuaire local (Sprints 1-7 mai 2026) — pages publiques
  "/boucheries-halal-rhone-alpes",
  "/boucheries-halal/(.*)",
  "/boucheries-halal-ouvertes-dimanche/(.*)",
  "/produits/(.*)",
  "/occasions/(.*)",
  "/trouver-boucherie-halal",
]);

// ── Clerk middleware: only for auth-required routes ──
const handleClerkAuth = clerkMiddleware(async (auth, req) => {
  // sign-in/sign-up: Clerk handles natively, no extra logic needed
  if (isSignRoute(req)) return;

  const { userId } = await auth();

  // Onboarding route: require auth but allow access (no role check)
  if (isOnboardingRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
    const role = await getUserRole(userId);
    const roleLower = role?.toLowerCase();
    if (roleLower === "boucher") {
      return NextResponse.redirect(new URL("/boucher/dashboard", req.url));
    }
    if (roleLower && ADMIN_ROLES.includes(roleLower)) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    return;
  }

  // Admin routes: admin/webmaster only
  if (isAdminRoute(req) && !isAdminLoginRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL("/admin-login", req.url));
    }
    const role = await getUserRole(userId);
    const roleLower = role?.toLowerCase();
    if (!roleLower || !ADMIN_ROLES.includes(roleLower)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return;
  }

  // Webmaster routes: admin/webmaster only
  if (isWebmasterRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL("/admin-login", req.url));
    }
    const role = await getUserRole(userId);
    const roleLower = role?.toLowerCase();
    if (!roleLower || !ADMIN_ROLES.includes(roleLower)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return;
  }

  // Boucher routes: boucher or admin (webmaster)
  if (isBoucherRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL("/espace-boucher", req.url));
    }
    const role = await getUserRole(userId);
    const roleLower = role?.toLowerCase();
    if (roleLower !== "boucher" && (!roleLower || !ADMIN_ROLES.includes(roleLower))) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return;
  }

  // Protected client routes: any authenticated user
  if (isProtectedRoute(req)) {
    if (!userId) {
      await auth.protect();
    }
    return;
  }

  // Everything else is public
});

// ── Main middleware: skip Clerk entirely for public routes ──
export default function middleware(req: NextRequest, event: NextFetchEvent) {
  // Test mode bypass
  if (isTestActivatedMiddleware(req)) {
    return NextResponse.next();
  }

  if (ENCODED_SEPARATOR_RE.test(req.nextUrl.pathname)) {
    return new NextResponse(null, { status: 400 });
  }

  // Public routes: zero Clerk overhead (no JWT verification, no redirections).
  // Filet de sécurité : avec le matcher ci-dessous, seuls les chemins
  // percent-encodés d'une page publique arrivent encore ici.
  let isPublic: boolean;
  try {
    isPublic = isPublicRoute(req);
  } catch {
    // createRouteMatcher lève MalformedURLError sur un encodage invalide (/boutique/%)
    return new NextResponse(null, { status: 400 });
  }
  if (isPublic) {
    return NextResponse.next();
  }

  // Auth-required routes: delegate to Clerk
  return handleClerkAuth(req, event);
}

// ── Matcher : liste blanche ──────────────────────────────────────────────────
// Le middleware ne s'exécute QUE là où il sert à quelque chose. Chaque exécution
// est facturée en CPU par Vercel : l'ancien matcher « tout sauf les assets »
// représentait 55 % du quota (panne du 2026-11-05). Pages publiques, fichiers
// statiques, robots/sitemap et scans de bots ne passent plus ici.
//
// ⚠️ Toute nouvelle famille protégée ajoutée dans les createRouteMatcher
// ci-dessus DOIT aussi être ajoutée ici (verrouillé par
// src/lib/__tests__/middleware-matcher.test.ts). Next exige des littéraux.
export const config = {
  matcher: [
    // Pages gardées par une règle de ce fichier — mêmes chaînes que isAdminRoute,
    // isWebmasterRoute, isBoucherRoute, isOnboardingRoute, isProtectedRoute
    "/admin",
    "/admin/(.*)",
    "/webmaster",
    "/webmaster/(.*)",
    "/boucher",
    "/boucher/(.*)",
    "/onboarding",
    "/checkout(.*)",
    "/commandes(.*)",
    "/profil(.*)",
    "/chat(.*)",
    // Pages dont le Server Component appelle auth() (qui lève sans clerkMiddleware)
    "/admin-login",
    "/suivi/(.*)",
    // Clerk sign-in / sign-up (comportement inchangé)
    "/sign-in(.*)",
    "/sign-up(.*)",
    // Pages connectées qui lancent un fetch authentifié dès le montage : on garde
    // le rafraîchissement de session côté serveur sur la requête document
    "/commande/(.*)",
    "/shop/offers",
    "/dashboard/marketing",
    // Tout chemin percent-encodé (hors /_next : les chunks de routes dynamiques
    // contiennent %5B…%5D) : createRouteMatcher le normalise puis applique les
    // règles (ferme le contournement /%61dmin/… — GHSA-vqx2-fgx2-5wq9)
    "/((?!_next/).*%[0-9A-Fa-f]{2}.*)",
    // API : tout sauf les handlers qui n'appellent jamais Clerk (crons, webhooks
    // signés, health, test-mode, geo, shops/nearby). Un handler exclu ne doit
    // JAMAIS importer server-auth / boucher-auth / admin-auth (test dédié).
    "/api/((?!cron(?:/|$)|webhooks/|payments/webhook$|health$|test-mode/|geo$|shops/nearby$).*)",
  ],
};
