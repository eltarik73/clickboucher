// Sentry Node server SDK — no-op if SENTRY_DSN missing or in test mode
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const isTestMode = process.env.TEST_MODE === "true";
const isProd = process.env.NODE_ENV === "production";

if (dsn && !isTestMode) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: isProd ? 0.1 : 1.0,
    ignoreErrors: ["NEXT_REDIRECT", "NEXT_NOT_FOUND", "RouteError"],
    beforeSend(event, hint) {
      if (isTestMode) return null;
      const err = hint?.originalException as { digest?: string } | undefined;
      if (err?.digest && typeof err.digest === "string" && err.digest.startsWith("NEXT_")) {
        return null;
      }
      return event;
    },
  });
}
