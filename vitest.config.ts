import { defineConfig } from "vitest/config";
import path from "node:path";

// Vitest config for Klik&Go — two projects sharing the `@/` -> `./src` alias (mirrors tsconfig.json).
//
// - `unit` (npm run test): pure functions, hooks, handlers with mocked I/O. No database, no network.
//   environment defaults to `jsdom`; per-file override via a `// @vitest-environment node` comment.
// - `integration` (npm run test:integration): application code against a real local PostgreSQL,
//   in the schema `itest` of the database DATABASE_URL points to. See tests/integration/setup/.
//
// A bare `vitest run` starts both projects, so it needs the database: the npm scripts always name
// their project. In Vitest 4 an inline project only inherits the root options with `extends: true`.
//
// tsconfig.json keeps JSX as is (`"jsx": "preserve"`, Next compiles it); tests compile it with the
// automatic React runtime, so .tsx components and pages load in both projects.
export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
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
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./tests/setup.ts"],
          include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.test.ts", "tests/**/*.test.tsx"],
          exclude: [
            "node_modules",
            ".next",
            ".claude",
            "prisma/migrations",
            "dist",
            ".vitest-cache",
            // Real-database tests: `integration` project only.
            "tests/integration/**",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          // Creates or updates the schema `itest` once per run, before any worker starts.
          globalSetup: ["./tests/integration/setup/global-setup.ts"],
          // Points DATABASE_URL at the schema `itest` in every worker, before any application import.
          setupFiles: ["./tests/integration/setup/env.ts"],
          // One database for the whole suite: one test file at a time, in a single worker
          // (`fileParallelism: false` forces `maxWorkers` to 1).
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
