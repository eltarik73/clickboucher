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
 * - production → pré-vols, puis prisma migrate deploy
 * - preview / development / autre → skip silencieusement
 *
 * En local ou CI hors Vercel (sans VERCEL_ENV), on skip aussi car
 * la migration est gérée à part (npm run db:migrate).
 *
 * Pré-vols : chaque prisma/migrations/<nom>/preflight.sql (ordre des dossiers) est exécuté en
 * lecture seule AVANT migrate deploy. Il vérifie que la base a bien la forme que la migration
 * suppose et ne fait rien si la migration est déjà appliquée. Un échec arrête le build sans rien
 * inscrire dans _prisma_migrations (une migration en échec, elle, bloquerait les déploiements
 * suivants par P3009). `db execute --schema` se connecte à `directUrl` (DIRECT_DATABASE_URL)
 * quand le datasource en déclare un — vérifié avec Prisma 6.19 — : l'URL n'apparaît donc ni dans
 * les arguments ni dans les logs.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TAG = "[prisma-migrate-prod-only]";
const SCHEMA = "prisma/schema.prisma";
const MIGRATIONS = "prisma/migrations";

const env = process.env.VERCEL_ENV || "local";

if (env !== "production") {
  console.log(`${TAG} VERCEL_ENV=${env} → skip prisma migrate deploy`);
  process.exit(0);
}

if (!process.env.DIRECT_DATABASE_URL) {
  console.error(`${TAG} ERROR: DIRECT_DATABASE_URL is not defined in production environment`);
  process.exit(1);
}

// Sans directUrl, `db execute --schema` passerait par l'URL poolée (pgbouncer).
if (!/^\s*directUrl\s*=\s*env\("DIRECT_DATABASE_URL"\)/m.test(readFileSync(SCHEMA, "utf8"))) {
  console.error(`${TAG} ERROR: ${SCHEMA} ne déclare plus directUrl = env("DIRECT_DATABASE_URL")`);
  process.exit(1);
}

const preflights = readdirSync(MIGRATIONS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(MIGRATIONS, d.name, "preflight.sql")))
  .map((d) => d.name)
  .sort();

for (const name of preflights) {
  console.log(`${TAG} Pré-vol ${name}…`);
  const check = spawnSync(
    "npx",
    [
      "prisma",
      "db",
      "execute",
      "--schema",
      SCHEMA,
      "--file",
      join(MIGRATIONS, name, "preflight.sql"),
    ],
    { stdio: "inherit", shell: false }
  );
  if (check.status !== 0) {
    console.error(
      `${TAG} ÉCHEC du pré-vol de la migration ${name} (code ${check.status}).\n` +
        `${TAG} Rien n'a été appliqué et rien n'est inscrit dans _prisma_migrations : ` +
        `prisma migrate deploy n'a pas été lancé. Corriger la base (voir le message ci-dessus), ` +
        `puis relancer le déploiement.`
    );
    process.exit(check.status || 1);
  }
}

console.log(`${TAG} Running prisma migrate deploy (production)…`);
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: false,
});

if (result.status !== 0) {
  console.error(`${TAG} prisma migrate deploy exited with code ${result.status}`);
  process.exit(result.status || 1);
}

console.log(`${TAG} Migrations OK`);
