import { defineConfig } from "vitest/config";
import path from "node:path";

// Vitest config for Klik&Go.
// - environment defaults to `jsdom` (so component tests work out-of-the-box).
// - pure-function lib tests run fine in jsdom too. Heavier files (tests/**)
//   from prior Playwright/integration work continue to work.
// - per-file environment overrides via `// @vitest-environment node` comment.
// - alias `@/` -> `./src` mirrors tsconfig.json paths so test imports match prod.
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx",
    ],
    exclude: [
      "node_modules",
      ".next",
      ".claude",
      "prisma/migrations",
      "dist",
      ".vitest-cache",
      // Pre-existing test broken by JSX/TSX loader — TODO: migrate to vitejs/plugin-react
      "tests/components/FormWizard.test.tsx",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/lib/**/*.ts", "src/components/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/**/__tests__/**",
        "src/lib/prisma.ts",
        "src/lib/redis.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
