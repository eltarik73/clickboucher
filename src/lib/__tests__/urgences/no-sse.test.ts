// @vitest-environment node
// Guard: no Server-Sent Events in the application. A stream holds a Vercel function open (memory billed
// the whole time, cut every 30 s by maxDuration, then reconnected by the browser); the butcher
// dashboard polls /api/boucher/orders/pending-count through useVisiblePolling instead.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

// Test files name these words to stub or forbid them: only application code is scanned.
function applicationFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : applicationFiles(full);
    return /\.(ts|tsx|js|mjs)$/.test(name) && !/\.(test|spec)\./.test(name) ? [full] : [];
  });
}

describe("no SSE stream", () => {
  it("no application file under src opens an EventSource or answers text/event-stream", () => {
    const files = applicationFiles(SRC);
    expect(files.length).toBeGreaterThan(0);

    const offenders = files
      .filter((file) => /EventSource|text\/event-stream/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(ROOT, file).split(path.sep).join("/"));

    expect(offenders).toEqual([]);
  });

  it.each([
    "src/hooks/useOrderStream.ts",
    "src/app/api/boucher/orders/stream",
    "src/app/api/orders/[id]/stream",
  ])("%s does not exist", (relativePath) => {
    expect(existsSync(path.join(ROOT, relativePath))).toBe(false);
  });

  it("the butcher dashboard reads the pending count through usePendingOrderCount", () => {
    const page = readFileSync(
      path.join(SRC, "app/(boucher)/boucher/dashboard/page.tsx"),
      "utf8"
    );
    expect(page).toContain('from "@/hooks/use-pending-order-count"');
  });
});
