import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
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

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();
  const role = sessionClaims?.metadata?.role as string | undefined;

  // Admin routes (except admin-login): webmaster only
  if (isAdminRoute(req) && !isAdminLoginRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL("/admin-login", req.url));
    }
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/decouvrir", req.url));
    }
    return;
  }

  // Boucher routes: boucher or admin (webmaster)
  if (isBoucherRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL("/espace-boucher", req.url));
    }
    if (role !== "boucher" && role !== "admin") {
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
