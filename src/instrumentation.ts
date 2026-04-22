// src/instrumentation.ts — Next.js instrumentation hook (runs once on server start)
// See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
//
// Legacy node-cron jobs were removed. On Vercel, crons are declared in vercel.json.

export async function register() {
  // Initialise Sentry only when DSN is provided
  if (process.env.SENTRY_DSN) {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      await import("../sentry.server.config");
    } else if (process.env.NEXT_RUNTIME === "edge") {
      await import("../sentry.edge.config");
    }
  }
}
