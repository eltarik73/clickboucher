// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const layout = readFileSync(path.resolve(__dirname, "../../src/app/layout.tsx"), "utf8");

describe("layout racine", () => {
  // The dynamic prop renders every route per request (CLAUDE.md, « Coût CPU Vercel »).
  test("ClerkProvider n'a pas la prop dynamic", () => {
    const openingTag = layout.match(/<ClerkProvider\b[^>]*>/);
    expect(openingTag).not.toBeNull();
    expect(openingTag?.[0]).not.toMatch(/\bdynamic\b/);
  });
});
