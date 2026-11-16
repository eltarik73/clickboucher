// @vitest-environment node
// Static guard: who may talk to Stripe.
//
// - The package `stripe` is imported only by src/lib/stripe.ts (client and key guard),
//   src/lib/payments/** (the gateway) and src/lib/services/stripe/** (payment services); a file
//   listed in STRIPE_TYPE_IMPORTERS may import its types, nothing else (none today).
// - Only src/lib/stripe.ts builds a Stripe client and reads a Stripe variable from the environment
//   (at call time, see src/lib/__tests__/stripe-env.test.ts).
// - getStripeClient() is called only by src/lib/payments/gateway.ts: every network call to Stripe
//   goes through the gateway, which integration tests replace with a fake.
// - No file both opens a Prisma transaction and calls the gateway: a Stripe call inside a
//   transaction holds its row locks for up to timeout x (retries + 1).
// The lists are CLOSED: a new entry makes the test fail (go through the gateway instead), and so
// does an entry that became false (remove it).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { importsModule, sourceFiles, withoutComments } from "./source-scan";

const ROOT = path.resolve(__dirname, "../..");
const SCANNED_DIRS = ["src", "scripts"];

/** Where the package may be imported (a path, or a folder ending with "/"). */
const STRIPE_PACKAGE_ZONES = ["src/lib/stripe.ts", "src/lib/payments/", "src/lib/services/stripe/"];

/** Files outside those zones allowed to import the package's types (`import type`) and nothing else. */
const STRIPE_TYPE_IMPORTERS: Record<string, string> = {};

/** Files that name getStripeClient, each with its reason. */
const STRIPE_CLIENT_USERS: Record<string, string> = {
  "src/lib/stripe.ts": "defines it: key guard and client",
  "src/lib/payments/gateway.ts": "its only caller: every network call to Stripe",
};

/** Files that build a Stripe client. */
const STRIPE_CLIENT_BUILDERS: Record<string, string> = {
  "src/lib/stripe.ts": "getStripeClient(), behind the key guard",
};

/** Files that read a STRIPE_* variable from the environment. */
const STRIPE_ENV_READERS: Record<string, string> = {
  "src/lib/stripe.ts": "secret key and webhook secrets, read at call time",
};

const namesStripeClient = (code: string) => /\bgetStripeClient\b/.test(code);
const buildsStripeClient = (code: string) => /\bnew\s+Stripe\s*\(/.test(code);
const readsStripeEnv = (code: string) =>
  /\bprocess\.env\s*(?:\.\s*|\[\s*['"`])STRIPE_/.test(code) ||
  /\{[^}]*\bSTRIPE_[A-Z0-9_]*[^}]*\}\s*=\s*process\.env\b/.test(code);
const callsGatewayInTransactionFile = (code: string) =>
  code.includes("$transaction") && /(?<!\bfunction\s+)\bgetPaymentGateway\s*\(/.test(code);

const files = SCANNED_DIRS.flatMap(sourceFiles).map((file) => ({
  file,
  code: withoutComments(readFileSync(path.join(ROOT, file), "utf8")),
}));

const matching = (predicate: (code: string) => boolean) =>
  files
    .filter(({ code }) => predicate(code))
    .map(({ file }) => file)
    .sort();

const inStripeZone = (file: string) =>
  STRIPE_PACKAGE_ZONES.some((zone) => (zone.endsWith("/") ? file.startsWith(zone) : file === zone));

const HOW_TO =
  "Closed list: call Stripe through getPaymentGateway() (src/lib/payments/gateway.ts), read its " +
  "configuration through src/lib/stripe.ts, never inside a Prisma transaction. If a file stopped " +
  "matching, remove its entry.";

describe("Stripe guard", () => {
  it("only the Stripe zones load the package; the listed files import its types only", () => {
    const outside = files.filter(
      ({ file, code }) => !inStripeZone(file) && importsModule(code, "stripe")
    );
    const loading = outside
      .filter(({ code }) => importsModule(code, "stripe", { typeImports: false }))
      .map(({ file }) => file);
    expect(outside.map(({ file }) => file).sort(), HOW_TO).toEqual(
      Object.keys(STRIPE_TYPE_IMPORTERS).sort()
    );
    expect(loading, HOW_TO).toEqual([]);
  });

  it("only src/lib/stripe.ts builds a client and reads a STRIPE_* variable", () => {
    expect(matching(buildsStripeClient), HOW_TO).toEqual(
      Object.keys(STRIPE_CLIENT_BUILDERS).sort()
    );
    expect(matching(readsStripeEnv), HOW_TO).toEqual(Object.keys(STRIPE_ENV_READERS).sort());
  });

  it("only the listed files name getStripeClient", () => {
    expect(matching(namesStripeClient), HOW_TO).toEqual(Object.keys(STRIPE_CLIENT_USERS).sort());
  });

  it("no file both opens a Prisma transaction and calls the gateway", () => {
    expect(matching(callsGatewayInTransactionFile), HOW_TO).toEqual([]);
  });

  it("the predicates tell a call or a read from a mention", () => {
    const code = (text: string) => withoutComments(text);
    expect(
      callsGatewayInTransactionFile(
        code("await prisma.$transaction(f);\nawait getPaymentGateway().createLoginLink(id);")
      )
    ).toBe(true);
    expect(
      callsGatewayInTransactionFile(
        code("// prisma.$transaction\nawait getPaymentGateway().createLoginLink(id);")
      )
    ).toBe(false);
    expect(
      callsGatewayInTransactionFile(
        code("prisma.$transaction(f);\nexport function getPaymentGateway() {}")
      )
    ).toBe(false);
    expect(readsStripeEnv(code("const key = process.env.STRIPE_SECRET_KEY;"))).toBe(true);
    expect(readsStripeEnv(code('const key = process.env["STRIPE_SECRET_KEY"];'))).toBe(true);
    expect(readsStripeEnv(code("const { STRIPE_SECRET_KEY: key } = process.env;"))).toBe(true);
    expect(
      readsStripeEnv(code("const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;"))
    ).toBe(false);
    expect(buildsStripeClient(code("const s = new Stripe(key, config);"))).toBe(true);
    expect(buildsStripeClient(code("// new Stripe(key, config)"))).toBe(false);
    expect(namesStripeClient(code("const { getStripeClient: client } = stripeModule;"))).toBe(true);
    expect(namesStripeClient(code("/* getStripeClient() */ const x = 1;"))).toBe(false);
  });
});
