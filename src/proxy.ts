import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedClientRoute = createRouteMatcher([
  "/checkout(.*)",
  "/commandes(.*)",
]);

const isBoucherRoute = createRouteMatcher(["/boucher(.*)"]);
const isWebmasterRoute = createRouteMatcher(["/webmaster(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedClientRoute(req)) {
    await auth.protect();
  }
  if (isBoucherRoute(req)) {
    await auth.protect();
  }
  if (isWebmasterRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
