// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const root = path.resolve(__dirname, "../..");
const layout = readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
const islands = readFileSync(path.join(root, "src/components/system/RootIslands.tsx"), "utf8");

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("layout racine", () => {
  test("aucun import dynamique client (ssr: false) dans le Server Component", () => {
    expect(layout).not.toContain("ssr: false");
    expect(layout).not.toMatch(/from\s+["']next\/dynamic["']/);
  });

  test("ThemeScript est le premier enfant du <head>", () => {
    const head = layout.indexOf("<head>");
    const script = layout.indexOf("<ThemeScript />");
    const firstMeta = layout.indexOf("<meta", head);
    const firstLink = layout.indexOf("<link", head);
    expect(head).toBeGreaterThan(-1);
    expect(script).toBeGreaterThan(head);
    expect(script).toBeLessThan(firstMeta);
    expect(script).toBeLessThan(firstLink);
  });

  test("RootIslands est rendu une seule fois", () => {
    expect(count(layout, "<RootIslands />")).toBe(1);
  });

  test("ClerkProvider n'a pas la prop dynamic", () => {
    const openingTag = layout.match(/<ClerkProvider\b[^>]*>/);
    expect(openingTag).not.toBeNull();
    expect(openingTag?.[0]).not.toMatch(/\bdynamic\b/);
  });

  test("le toaster passe par le composant du thème, pas par sonner", () => {
    expect(layout).not.toMatch(/from\s+["']sonner["']/);
  });
});

describe("RootIslands", () => {
  test("est un composant client qui porte les cinq imports ssr: false", () => {
    expect(islands.startsWith('"use client";')).toBe(true);
    expect(count(islands, "ssr: false")).toBe(5);
  });
});
