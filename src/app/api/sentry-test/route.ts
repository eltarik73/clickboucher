// src/app/api/sentry-test/route.ts
//
// Test endpoint pour vérifier que Sentry capture bien les erreurs en prod.
//
// Usage :
//   curl https://klikandgo.app/api/sentry-test?secret=$CRON_SECRET
//
// Doit faire apparaître une erreur dans le dashboard Sentry dans ~30s.
//
// IMPORTANT : Protégé par CRON_SECRET pour éviter qu'un attaquant spamme
// l'endpoint et explose ton quota Sentry.

import { NextRequest } from "next/server";
import { apiError } from "@/lib/api/errors";
import { verifyCronAuth } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Permettre auth via ?secret=X en plus du Bearer (plus simple pour test manuel)
  const secretParam = req.nextUrl.searchParams.get("secret");
  const validSecret = secretParam && secretParam === process.env.CRON_SECRET;

  if (!validSecret && !verifyCronAuth(req)) {
    return apiError("UNAUTHORIZED", "Add ?secret=CRON_SECRET or Bearer auth");
  }

  // Log structuré + capture Sentry (via logger.error en prod)
  const testError = new Error(
    `[sentry-test] Test capture déclenché à ${new Date().toISOString()} — si tu vois cette erreur dans Sentry, ça marche !`
  );

  logger.error("[sentry-test] Triggered test exception", testError);

  // Throw aussi pour que le route handler retourne 500 et que Sentry catch
  // depuis le wrapper Next.js
  throw testError;
}
