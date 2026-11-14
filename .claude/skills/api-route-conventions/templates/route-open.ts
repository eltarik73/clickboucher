// Destination : src/lib/api/route-open.ts (copie à l'identique).
// Fabriques SANS Clerk : pour les handlers qui ne lisent aucune session.
// Obligatoire pour tout handler exclu du matcher du middleware (crons, webhooks, health, geo,
// shops/nearby) : ce fichier n'a aucun helper Clerk dans sa fermeture d'imports.
import { apiError } from "@/lib/api/errors";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createRoute } from "@/lib/api/route-core";

/**
 * Route ouverte : aucune authentification, réponse identique pour tous les visiteurs.
 * Peut répondre avec `apiCached(...)`. Rate limit par IP.
 * Si la réponse peut varier selon l'utilisateur, utiliser `optionalUserRoute` (route-auth.ts).
 */
export const openRoute = createRoute<null>({
  authenticate: () => ({ ok: true, auth: null }),
  principal: () => null,
  personalized: false,
});

/** Cron Vercel : `Authorization: Bearer ${CRON_SECRET}` vérifié par `verifyCronAuth`. */
export const cronRoute = createRoute<{ cron: true }>({
  authenticate: (req) =>
    verifyCronAuth(req)
      ? { ok: true, auth: { cron: true } }
      : { ok: false, response: apiError("UNAUTHORIZED", "Invalid cron secret") },
  principal: () => "cron",
  personalized: true,
});
