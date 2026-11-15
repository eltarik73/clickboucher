// @vitest-environment node
// Static guard: who may talk to Stripe.
//
// - The package `stripe` is imported only by src/lib/stripe.ts (client and key guard),
//   src/lib/payments/** (the gateway) and src/lib/services/stripe/** (payment services); the
//   webhook route may import its types, nothing else.
// - Only src/lib/stripe.ts builds a Stripe client and reads a Stripe variable from the environment
//   (at call time, see src/lib/__tests__/stripe-env.test.ts).
// - getStripeClient() is called only by src/lib/payments/gateway.ts: every network call to Stripe
//   goes through the gateway, which integration tests replace with a fake.
// - No file both opens a Prisma transaction and calls the gateway: a Stripe call inside a
//   transaction holds its row locks for up to timeout x (retries + 1).
// The lists are CLOSED: a new entry makes the test fail (go through the gateway instead), and so
// does an entry that became false (remove it).
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const SCANNED_DIRS = ["src", "scripts"];

/** Where the package may be imported (a path, or a folder ending with "/"). */
const STRIPE_PACKAGE_ZONES = ["src/lib/stripe.ts", "src/lib/payments/", "src/lib/services/stripe/"];

/** Files outside those zones allowed to import the package's types (`import type`) and nothing else. */
const STRIPE_TYPE_IMPORTERS: Record<string, string> = {
  "src/app/api/payments/webhook/route.ts": "types of the events it receives",
};

/** Files that name getStripeClient, each with its reason. */
const STRIPE_CLIENT_USERS: Record<string, string> = {
  "src/lib/stripe.ts": "defines it: key guard and client",
  "src/lib/payments/gateway.ts": "its only caller: every network call to Stripe",
  "src/app/api/payments/webhook/route.ts":
    "transitional: signature check on the client, replaced by the static check of C1-PAIEMENT-A-T6",
};

/** Files that build a Stripe client. */
const STRIPE_CLIENT_BUILDERS: Record<string, string> = {
  "src/lib/stripe.ts": "getStripeClient(), behind the key guard",
};

/** Files that read a STRIPE_* variable from the environment. */
const STRIPE_ENV_READERS: Record<string, string> = {
  "src/lib/stripe.ts": "secret key and webhook secrets, read at call time",
};

/** Files that both open a Prisma transaction and call the gateway: none, ever. */
const GATEWAY_CALLS_IN_TRANSACTION_FILES: Record<string, string> = {};

/** Shipped code only: tests (which sign webhook payloads locally) are not read. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "node_modules" || entry.name === "__tests__" ? [] : sourceFiles(full);
    }
    const isSource = /\.(?:ts|tsx|js|mjs)$/.test(entry.name);
    return isSource && !/\.(?:test|spec)\.[a-z]+$/.test(entry.name) ? [full] : [];
  });
}

/** The text without its comments; strings stay (module names are strings). */
function withoutComments(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (c === "/" && next === "/") {
      const end = text.indexOf("\n", i);
      i = end === -1 ? text.length : end;
    } else if (c === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 2;
    } else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < text.length && text[j] !== c && (c === "`" || text[j] !== "\n")) {
        j += text[j] === "\\" ? 2 : 1;
      }
      out += text.slice(i, j + 1);
      i = j + 1;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

function specifierOf(moduleName: string): string {
  const escaped = moduleName.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return `(['"\`])${escaped}(?:\\/[^'"\`]*)?\\1`;
}

/** Every form that loads the module (or a subpath) at run time; `import type` is not one of them. */
function importsModuleAsValue(code: string, moduleName: string): boolean {
  const specifier = specifierOf(moduleName);
  const forms = [
    `\\bimport\\s+(?!type\\b)[^'"\`;]*?\\bfrom\\s*${specifier}`,
    `\\bexport\\s+[^'"\`;]*?\\bfrom\\s*${specifier}`,
    `\\bimport\\s*${specifier}`,
    `\\bimport\\s*\\(\\s*${specifier}\\s*\\)`,
    `\\brequire\\s*\\(\\s*${specifier}\\s*\\)`,
  ];
  return forms.some((form) => new RegExp(form).test(code));
}

function importsModule(code: string, moduleName: string): boolean {
  const typeImport = new RegExp(`\\bimport\\s+type\\b[^'"\`;]*?\\bfrom\\s*${specifierOf(moduleName)}`);
  return importsModuleAsValue(code, moduleName) || typeImport.test(code);
}

const namesStripeClient = (code: string) => /\bgetStripeClient\b/.test(code);
const buildsStripeClient = (code: string) => /\bnew\s+Stripe\s*\(/.test(code);
const readsStripeEnv = (code: string) =>
  /\bprocess\.env\s*(?:\.\s*|\[\s*['"`])STRIPE_/.test(code) ||
  /\{[^}]*\bSTRIPE_[A-Z0-9_]*[^}]*\}\s*=\s*process\.env\b/.test(code);
const callsGatewayInTransactionFile = (code: string) =>
  code.includes("$transaction") && /(?<!\bfunction\s+)\bgetPaymentGateway\s*\(/.test(code);

const files = SCANNED_DIRS.flatMap((dir) => sourceFiles(path.join(ROOT, dir))).map((full) => ({
  file: path.relative(ROOT, full).split(path.sep).join("/"),
  code: withoutComments(readFileSync(full, "utf8")),
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
    const outside = files.filter(({ file, code }) => !inStripeZone(file) && importsModule(code, "stripe"));
    const unlisted = outside.filter(({ file }) => !(file in STRIPE_TYPE_IMPORTERS)).map(({ file }) => file);
    const loading = outside.filter(({ code }) => importsModuleAsValue(code, "stripe")).map(({ file }) => file);
    expect(unlisted, HOW_TO).toEqual([]);
    expect(loading, HOW_TO).toEqual([]);
  });

  it("only src/lib/stripe.ts builds a client and reads a STRIPE_* variable", () => {
    expect(matching(buildsStripeClient), HOW_TO).toEqual(Object.keys(STRIPE_CLIENT_BUILDERS).sort());
    expect(matching(readsStripeEnv), HOW_TO).toEqual(Object.keys(STRIPE_ENV_READERS).sort());
  });

  it("only the listed files name getStripeClient", () => {
    expect(matching(namesStripeClient), HOW_TO).toEqual(Object.keys(STRIPE_CLIENT_USERS).sort());
  });

  it("no file both opens a Prisma transaction and calls the gateway", () => {
    expect(matching(callsGatewayInTransactionFile), HOW_TO).toEqual(
      Object.keys(GATEWAY_CALLS_IN_TRANSACTION_FILES).sort()
    );
  });

  it("the code reader tells a type import from a load, and a call from a mention", () => {
    const loads = (text: string) => importsModuleAsValue(withoutComments(text), "stripe");
    const imports = (text: string) => importsModule(withoutComments(text), "stripe");
    expect(loads('import Stripe from "stripe";')).toBe(true);
    expect(loads("import { type Event } from 'stripe';")).toBe(true);
    expect(loads('import {\n  Stripe,\n} from "stripe";')).toBe(true);
    expect(loads('export { default } from "stripe";')).toBe(true);
    expect(loads('const { default: S } = await import("stripe");')).toBe(true);
    expect(loads('const s = require("stripe/esm/stripe.esm.node.js");')).toBe(true);
    expect(loads('import type Stripe from "stripe";')).toBe(false);
    expect(imports('import type Stripe from "stripe";')).toBe(true);
    expect(imports('import type { Event } from "stripe";')).toBe(true);
    expect(imports('// import Stripe from "stripe";')).toBe(false);
    expect(imports('import { x } from "stripe-mock";')).toBe(false);
    expect(imports('const LIBS = ["stripe"];')).toBe(false);

    const code = (text: string) => withoutComments(text);
    expect(callsGatewayInTransactionFile(code("await prisma.$transaction(f);\nawait getPaymentGateway().createLoginLink(id);"))).toBe(true);
    expect(callsGatewayInTransactionFile(code("// prisma.$transaction\nawait getPaymentGateway().createLoginLink(id);"))).toBe(false);
    expect(callsGatewayInTransactionFile(code("prisma.$transaction(f);\nexport function getPaymentGateway() {}"))).toBe(false);
    expect(readsStripeEnv(code("const key = process.env.STRIPE_SECRET_KEY;"))).toBe(true);
    expect(readsStripeEnv(code('const key = process.env["STRIPE_SECRET_KEY"];'))).toBe(true);
    expect(readsStripeEnv(code("const { STRIPE_SECRET_KEY: key } = process.env;"))).toBe(true);
    expect(readsStripeEnv(code("const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;"))).toBe(false);
    expect(buildsStripeClient(code("const s = new Stripe(key, config);"))).toBe(true);
    expect(buildsStripeClient(code("// new Stripe(key, config)"))).toBe(false);
    expect(namesStripeClient(code("const { getStripeClient: client } = stripeModule;"))).toBe(true);
    expect(namesStripeClient(code("/* getStripeClient() */ const x = 1;"))).toBe(false);
  });
});
