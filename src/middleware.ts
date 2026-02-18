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

/** Fetch role from Clerk publicMetadata (not sessionClaims) */
async function getUserRole(userId: string): Promise<string | undefined> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return (user.publicMetadata as Record<string, string>)?.role;
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
