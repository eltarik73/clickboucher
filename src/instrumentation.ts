// src/instrumentation.ts — Next.js instrumentation hook (runs once on server start)
// See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
//
// Legacy node-cron jobs were removed. On Vercel, crons are declared in vercel.json.

export async function register() {
  // Initialise Sentry only when DSN is provided
  if (process.env.SENTRY_DSN) {
    // Runtime Node uniquement. Le SDK edge (≈ 175 kB) n'est volontairement plus
    // chargé : le seul code edge restant est le middleware, et l'y démarrer
    // alourdissait chaque cold start (facturé en CPU). Les erreurs du middleware
    // restent visibles dans les logs Vercel. Si une route edge est ajoutée un
    // jour, réimporter "../sentry.edge.config" ici pour NEXT_RUNTIME === "edge".
    if (process.env.NEXT_RUNTIME === "nodejs") {
      await import("../sentry.server.config");
    }
  }
}
