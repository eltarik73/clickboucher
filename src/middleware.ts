import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes protégées — auth obligatoire
const isProtectedClientRoute = createRouteMatcher([
  "/checkout(.*)",
  "/commandes(.*)",
]);

// Routes staff — auth obligatoire + contrôle rôle dans les pages
const isBoucherRoute = createRouteMatcher(["/boucher(.*)"]);
const isWebmasterRoute = createRouteMatcher(["/webmaster(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  // Client: checkout et commandes nécessitent auth
  if (isProtectedClientRoute(req)) {
    await auth.protect();
  }

  // Staff: auth obligatoire (le contrôle de rôle se fait dans les pages)
  if (isBoucherRoute(req)) {
    await auth.protect();
  }
  if (isWebmasterRoute(req)) {
    await auth.protect();
  }

  // Tout le reste est public: /decouvrir, /boucherie/[id], /panier, etc.
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
