import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isBoucherRoute = createRouteMatcher(["/boucher(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isAdminLoginRoute = createRouteMatcher(["/admin-login"]);
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

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Admin routes (except admin-login): admin/webmaster only
  if (isAdminRoute(req) && !isAdminLoginRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL("/admin-login", req.url));
    }
    const role = await getUserRole(userId);
    if (!role || !ADMIN_ROLES.includes(role)) {
      return NextResponse.redirect(new URL("/decouvrir", req.url));
    }
    return;
  }

  // Boucher routes: boucher or admin (webmaster)
  if (isBoucherRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL("/espace-boucher", req.url));
    }
    const role = await getUserRole(userId);
    if (role !== "boucher" && (!role || !ADMIN_ROLES.includes(role))) {
      return NextResponse.redirect(new URL("/decouvrir", req.url));
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

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
