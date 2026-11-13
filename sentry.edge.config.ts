// Sentry Edge runtime SDK — no-op if SENTRY_DSN missing or in test mode
import * as Sentry from "@sentry/nextjs";
import { isTestModeEnabled } from "./src/lib/auth/test-mode-env";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const isTestMode = isTestModeEnabled();
const isProd = process.env.NODE_ENV === "production";

if (dsn && !isTestMode) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: isProd ? 0.1 : 1.0,
    ignoreErrors: ["NEXT_REDIRECT", "NEXT_NOT_FOUND", "RouteError"],
  });
}
