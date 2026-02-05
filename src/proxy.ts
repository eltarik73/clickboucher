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
    "/((
cat > src/proxy.ts << 'EOF'
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
    "/((
ls src/proxy.ts
git add . && git commit -m "v2: navigation libre, auth Clerk, boucher + webmaster" && git push origin main
# 1. Va dans ton projet
cd ~/Desktop/clickboucher

# 2. Crée le fichier proxy.ts (middleware Clerk)
cat > src/proxy.ts << 'EOF'
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
