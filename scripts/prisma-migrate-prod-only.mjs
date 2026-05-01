#!/usr/bin/env node
/**
 * Prisma migrate deploy — production seulement.
 *
 * Pourquoi : sur Vercel, DIRECT_DATABASE_URL n'est configuré que pour
 * Production. Les preview deployments (branches, PRs Dependabot, etc.)
 * échouaient sur "Environment variable not found: DIRECT_DATABASE_URL"
 * (Prisma P1012).
 *
 * Best practice : ne jamais migrer la DB depuis un preview deployment
 * de toute façon (risque de toucher à la DB prod par erreur).
 *
 * Vercel expose VERCEL_ENV = production | preview | development.
 * - production → run prisma migrate deploy
 * - preview / development / autre → skip silencieusement
 *
 * En local ou CI hors Vercel (sans VERCEL_ENV), on skip aussi car
 * la migration est gérée à part (npm run db:migrate).
 */

import { spawnSync } from "node:child_process";

const env = process.env.VERCEL_ENV || "local";

if (env !== "production") {
  console.log(`[prisma-migrate-prod-only] VERCEL_ENV=${env} → skip prisma migrate deploy`);
  process.exit(0);
}

if (!process.env.DIRECT_DATABASE_URL) {
  console.error("[prisma-migrate-prod-only] ERROR: DIRECT_DATABASE_URL is not defined in production environment");
  process.exit(1);
}

console.log("[prisma-migrate-prod-only] Running prisma migrate deploy (production)…");
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: false,
});

if (result.status !== 0) {
  console.error(`[prisma-migrate-prod-only] prisma migrate deploy exited with code ${result.status}`);
  process.exit(result.status || 1);
}

console.log("[prisma-migrate-prod-only] Migrations OK");
