// @vitest-environment node
// The source reader shared by the static guards of tests/lib (source-scan.ts): which files are
// shipped code, what is code rather than a comment, and which import forms load a module.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { importsModule, sourceFiles, withoutComments } from "./source-scan";

const ROOT = path.resolve(__dirname, "../..");

describe("sourceFiles", () => {
  it("lists the shipped code of a folder and leaves its tests out", () => {
    const files = sourceFiles(path.join(ROOT, "src/lib")).map((full) =>
      path.relative(ROOT, full).split(path.sep).join("/")
    );

    expect(files).toContain("src/lib/stripe.ts");
    expect(files).toContain("src/lib/services/stripe/webhook/dispatch.ts");
    expect(files.filter((file) => /__tests__|\.(?:test|spec)\./.test(file))).toEqual([]);
  });
});

describe("withoutComments", () => {
  it("removes line and block comments and keeps strings, comment markers inside them included", () => {
    expect(withoutComments('const a = "// kept"; // gone\nconst b = 1;')).toBe(
      'const a = "// kept"; \nconst b = 1;'
    );
    expect(withoutComments("/* gone\n */ const c = `/* kept\n */`;")).toBe(
      " const c = `/* kept\n */`;"
    );
    expect(withoutComments("const d = 'it\\'s'; /* gone */")).toBe("const d = 'it\\'s'; ");
  });
});

describe("importsModule", () => {
  it.each([
    ['import Stripe from "stripe";', true, true],
    ["import { type Event } from 'stripe';", true, true],
    ['import {\n  Stripe,\n} from "stripe";', true, true],
    ['import "stripe";', true, true],
    ['export { default } from "stripe";', true, true],
    ['const { default: S } = await import("stripe");', true, true],
    ['const s = require("stripe/esm/stripe.esm.node.js");', true, true],
    ['import type Stripe from "stripe";', true, false],
    ['import type { Event } from "stripe";', true, false],
    ['// import Stripe from "stripe";', false, false],
    ['/* import Stripe from "stripe"; */ const x = 1;', false, false],
    ['import { x } from "stripe-mock";', false, false],
    ['const LIBS = ["stripe"];', false, false],
  ])("%j: imported %s, loaded at run time %s", (text, imported, loaded) => {
    const code = withoutComments(text);

    expect(importsModule(code, "stripe")).toBe(imported);
    expect(importsModule(code, "stripe", { typeImports: false })).toBe(loaded);
  });

  it("matches a scoped package and its subpaths, not a package that only starts like it", () => {
    expect(importsModule('const blob = require("@vercel/blob/client");', "@vercel/blob")).toBe(true);
    expect(importsModule('import { put } from "@vercel/blobby";', "@vercel/blob")).toBe(false);
  });
});
