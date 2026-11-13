// src/lib/auth/test-mode-env.ts — Le mode test est-il autorisé dans cet environnement ?
//
// Module pur, sans import : utilisable dans le middleware (edge), les route
// handlers (node) et les fichiers sentry.*.config.ts.
//
// RÈGLE DE SÉCURITÉ : le mode test contourne Clerk et donne des identités
// factices, y compris ADMIN. Il est donc IMPOSSIBLE sur le déploiement de
// production Vercel, quelles que soient les variables d'environnement. Jusqu'au
// 2026-11-13, TEST_MODE + ALLOW_TEST_IN_PROD suffisaient à l'activer en prod et
// deux cookies en clair donnaient l'accès admin à n'importe quel visiteur.

/**
 * `true` sur le déploiement de production Vercel.
 * Deux sources indépendantes : VERCEL_ENV (variable système au runtime) et
 * KLIKGO_DEPLOY_ENV, figée dans le bundle au build par next.config.mjs.
 */
export function isProductionDeployment(): boolean {
  return (
    process.env.VERCEL_ENV === "production" || process.env.KLIKGO_DEPLOY_ENV === "production"
  );
}

/**
 * Le mode test peut-il être utilisé ici ?
 * - jamais en production Vercel ;
 * - sinon il faut TEST_MODE="true" ;
 * - et sur un build de production hors prod Vercel (preview, `next start` local),
 *   il faut en plus ALLOW_TEST_IN_PROD="true".
 */
export function isTestModeEnabled(): boolean {
  if (isProductionDeployment()) return false;
  if (process.env.TEST_MODE !== "true") return false;
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_TEST_IN_PROD !== "true") {
    return false;
  }
  return true;
}
