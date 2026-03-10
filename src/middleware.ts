import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";

// @security: test-only — Bypass Clerk ONLY if secret was validated (cookie present)
function isTestActivatedMiddleware(req: NextRequest): boolean {
  if (process.env.NEXT_PUBLIC_TEST_MODE !== "true") return false;
  return req.cookies.get("klikgo-test-activated")?.value === "true";
}

const isBoucherRoute = createRouteMatcher(["/boucher(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isAdminLoginRoute = createRouteMatcher(["/admin-login"]);
const isWebmasterRoute = createRouteMatcher(["/webmaster(.*)"]);
const isProtectedRoute = createRouteMatcher([
  "/checkout(.*)",
  "/commandes(.*)",
  "/profil(.*)",
  "/chat(.*)",
]);

const ADMIN_ROLES = ["admin", "webmaster"];

// ── In-memory role cache (5 min TTL) ──────────────
const roleCache = new Map<string, { role: string | undefined; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Fetch role from Clerk publicMetadata with in-memory cache */
async function getUserRole(userId: string): Promise<string | undefined> {
  const cached = roleCache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.role;
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const role = (user.publicMetadata as Record<string, string>)?.role;
    roleCache.set(userId, { role, ts: Date.now() });
    // Evict old entries if cache grows too large
    if (roleCache.size > 500) {
      const oldest = [...roleCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
      for (let i = 0; i < 100; i++) roleCache.delete(oldest[i][0]);
    }
    return role;
  } catch {
    return undefined;
  }
}

const isOnboardingRoute = createRouteMatcher(["/onboarding"]);

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
  "/admin-login",
]);

// ── Clerk middleware: only for auth-required routes ──
const handleClerkAuth = clerkMiddleware(async (auth, req) => {
  // sign-in/sign-up: Clerk handles natively, no extra logic needed
  const isSignRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);
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

  // Public routes: zero Clerk overhead (no JWT verification, no redirections)
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Auth-required routes: delegate to Clerk
  return handleClerkAuth(req, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
