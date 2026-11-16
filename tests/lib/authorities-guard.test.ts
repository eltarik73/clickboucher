// @vitest-environment node
// Guard: each rule gathered by C1-ARTISANAT-1 keeps a single home. A second copy is a defect even
// while both copies agree, because the next fix lands in one of them only. The logo and badge rules
// are guarded by tests/components/ui-guards.test.ts. Exception lists are closed: a new copy fails,
// and so does an entry whose file no longer needs it (remove the entry).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sourceFiles } from "./source-files";

const ROOT = path.resolve(__dirname, "../..");

function read(file: string): string {
  return readFileSync(path.join(ROOT, file), "utf8");
}

function filesMatching(dirs: readonly string[], pattern: RegExp): string[] {
  return dirs
    .flatMap((dir) => sourceFiles(dir))
    .filter((file) => pattern.test(read(file)))
    .sort();
}

/** Private copies of the client error reader, each with the reason it is still there. */
const ERROR_HELPER_COPIES: Record<string, string> = {
  "src/app/(client)/suivi/[id]/CancelOrderButton.tsx":
    "path of C1-PAIEMENT-A, moves to src/lib/api/client-refusal.ts in part 2",
};

/** Order routes that still read their body with req.json(), each with its reason. */
const RAW_BODY_READERS: Record<string, string> = {
  "src/app/api/orders/[id]/adjust-price/route.ts": "path of C1-PAIEMENT-A",
};

const OWNER_SHOP_ROUTES = [
  "src/app/api/boucher/shop/status/route.ts",
  "src/app/api/boucher/service/route.ts",
  "src/app/api/boucher/onboarding/route.ts",
  "src/app/api/shops/[id]/status/route.ts",
];

describe("one authority per rule (C1-ARTISANAT-1)", () => {
  it("only src/lib/local-postgres-url.ts reads the host parameters of a database URL, so the seed, the integration setup, the repair scripts and the e2e helpers refuse the same remote databases", () => {
    const hostReaders = filesMatching(
      ["src", "scripts", "prisma", "tests/integration/setup", "tests/e2e"],
      /searchParams\.getAll\(\s*["']host["']\s*\)/
    );

    expect(hostReaders).toEqual(["src/lib/local-postgres-url.ts"]);
  });

  it("only src/lib/images/rank.ts sorts product photos, so the write plan, the storefront and the butcher's tiles show the same order and the same primary photo", () => {
    const photoSorts = filesMatching(
      ["src", "scripts"],
      /\border\s*\?\?\s*(?:index|position)\b|\ba\.rank\s*-\s*b\.rank\b/
    );

    expect(photoSorts).toEqual(["src/lib/images/rank.ts"]);
  });

  it("screens read an API refusal through src/lib/api/client-refusal.ts only, so every message is parsed by the same schema", () => {
    const copies = filesMatching(
      ["src"],
      /\b(?:function\s+|(?:const|let|var)\s+)(?:apiErrorMessage|extractError)\b/
    );

    expect(existsSync(path.join(ROOT, "src/lib/api/error-message.ts"))).toBe(false);
    expect(copies).toEqual(Object.keys(ERROR_HELPER_COPIES).sort());
  });

  it("the owner routes change their shop through writeOwnerShop only, whose UPDATE refuses a suspended shop", () => {
    const directWriters = OWNER_SHOP_ROUTES.filter((file) =>
      /\.shop\.update\(|updateMany\(|\bshopSuspension\b/.test(read(file))
    );

    expect(directWriters).toEqual([]);
  });

  it("order routes read their body through readJsonBody, so a missing or malformed body answers 400 VALIDATION_ERROR instead of 500", () => {
    const rawReaders = filesMatching(
      ["src/app/api/boucher/orders", "src/app/api/orders"],
      /\breq(?:uest)?\.json\(/
    );

    expect(rawReaders).toEqual(Object.keys(RAW_BODY_READERS).sort());
  });

  it("the kitchen service owns the board types: src/lib/services/orders/kitchen.ts imports nothing from src/hooks", () => {
    expect(read("src/lib/services/orders/kitchen.ts")).not.toMatch(
      /["'](?:@\/hooks\/|(?:\.\.\/)+hooks\/)/
    );
  });
});
