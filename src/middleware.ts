import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Routes protégées — auth obligatoire (tout rôle connecté)
const isProtectedRoute = createRouteMatcher([
  "/checkout(.*)",
  "/commandes(.*)",
  "/profil(.*)",
  "/chat(.*)",
]);

// Routes boucher — auth + rôle boucher ou admin
const isBoucherRoute = createRouteMatcher(["/boucher(.*)"]);

// Routes admin — auth + rôle admin uniquement
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { sessionClaims } = await auth();
  const role = sessionClaims?.metadata?.role;

  // Admin routes: auth + role === "admin"
  if (isAdminRoute(req)) {
    if (!sessionClaims) {
      await auth.protect();
      return;
    }
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/decouvrir", req.url));
    }
    return;
  }

  // Boucher routes: auth + role === "boucher" ou "admin"
  if (isBoucherRoute(req)) {
    if (!sessionClaims) {
      await auth.protect();
      return;
    }
    if (role !== "boucher" && role !== "admin") {
      return NextResponse.redirect(new URL("/decouvrir", req.url));
    }
    return;
  }

  // Protected client routes: auth obligatoire (tout rôle)
  if (isProtectedRoute(req)) {
    await auth.protect();
    return;
  }

  // Tout le reste est public: /decouvrir, /boutique/[id], /panier, /sign-in, /sign-up
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
