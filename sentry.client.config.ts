// Sentry browser SDK — no-op if SENTRY_DSN missing or in test mode
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
const isTestMode = process.env.TEST_MODE === "true";
const isProd = process.env.NODE_ENV === "production";

if (dsn && !isTestMode) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // Performance traces — sample less in prod for cost control
    tracesSampleRate: isProd ? 0.1 : 1.0,
    // Session replay
    replaysSessionSampleRate: isProd ? 0.05 : 0,
    replaysOnErrorSampleRate: isProd ? 1.0 : 0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Filter common Next.js noise — these are framework signals, not errors
    ignoreErrors: [
      "NEXT_REDIRECT",
      "NEXT_NOT_FOUND",
      "RouteError",
      // Browser noise
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
    ],
    beforeSend(event, hint) {
      // Drop test-mode events even if DSN sneaks through
      if (isTestMode) return null;
      // Drop NEXT_REDIRECT digests on the original error
      const err = hint?.originalException as { digest?: string } | undefined;
      if (err?.digest && typeof err.digest === "string" && err.digest.startsWith("NEXT_")) {
        return null;
      }
      return event;
    },
  });
}
