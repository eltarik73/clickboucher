// @vitest-environment node
// 1. IMAGE_COLUMNS (src/lib/images/columns.ts) correspond exactement aux colonnes d'image du schéma Prisma :
//    une colonne ajoutée au schéma sans être inventoriée échappe au contrôle des références et au recensement.
// 2. Les modules purs de src/lib/images restent utilisables dans le navigateur : aucun accès disque,
//    base, magasin ou réseau, et aucune lecture d'environnement hors des deux fonctions prévues.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IMAGE_COLUMNS } from "@/lib/images/columns";

const ROOT = process.cwd();
const schema = fs.readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8");

const IMAGE_FIELDS = new Set([
  "imageUrl",
  "bannerUrl",
  "ownerPhotoUrl",
  "halalCertUrl",
  "bannerImageUrl",
  "popupImageUrl",
  "visualImageUrl",
]);
const URL_FIELD_MODELS = new Set(["ProductImage", "ReferenceProductImage"]);

interface SchemaField {
  name: string;
  type: string;
  column: string;
}
interface SchemaModel {
  name: string;
  table: string;
  fields: SchemaField[];
}

function parseModels(source: string): SchemaModel[] {
  return [...source.matchAll(/^model (\w+) \{\n([\s\S]*?)^\}/gm)].map(([, name, body]) => {
    const table = body.match(/@@map\("(\w+)"\)/)?.[1] ?? name;
    const fields = body
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^\w+\s+\w/.test(line))
      .map((line) => {
        const [fieldName, type] = line.split(/\s+/);
        const column = line.match(/@map\("(\w+)"\)/)?.[1] ?? fieldName;
        return { name: fieldName, type, column };
      });
    return { name, table, fields };
  });
}

const models = parseModels(schema);

const expected = models.flatMap((model) =>
  model.fields
    .filter(
      (field) =>
        IMAGE_FIELDS.has(field.name) || (URL_FIELD_MODELS.has(model.name) && field.name === "url")
    )
    .map((field) => ({ model, field }))
);

describe("IMAGE_COLUMNS ↔ prisma/schema.prisma", () => {
  it("le relevé du schéma trouve les 15 colonnes", () => {
    expect(models.length).toBeGreaterThan(40);
    expect(expected).toHaveLength(15);
  });

  it("même ensemble de colonnes, sans doublon", () => {
    const fromSchema = expected.map(({ model, field }) => `${model.table}.${field.column}`).sort();
    const inventoried = IMAGE_COLUMNS.map((entry) => `${entry.table}.${entry.column}`);
    expect(new Set(inventoried).size).toBe(inventoried.length);
    expect([...inventoried].sort()).toEqual(fromSchema);
  });

  it.each(IMAGE_COLUMNS.map((entry) => [`${entry.table}.${entry.column}`, entry] as const))(
    "%s : type, nullabilité et colonne boutique conformes au schéma",
    (_label, entry) => {
      const match = expected.find(
        ({ model, field }) => model.table === entry.table && field.column === entry.column
      );
      expect(match).toBeDefined();
      if (!match) return;
      expect(match.field.type.replace("?", "")).toBe("String");
      expect(match.field.type.endsWith("?")).toBe(entry.nullable);

      const shopField = match.model.fields.find((field) => field.name === "shopId");
      if (entry.shopIdColumn === null) {
        expect(shopField).toBeUndefined();
      } else if (entry.table === "shops") {
        expect(entry.shopIdColumn).toBe("id");
      } else {
        expect(shopField?.column).toBe(entry.shopIdColumn);
      }
    }
  );

  it("identifiants SQL sûrs (seuls identifiants jamais interpolés en SQL brut)", () => {
    for (const entry of IMAGE_COLUMNS) {
      expect(entry.table).toMatch(/^[a-z_]+$/);
      expect(entry.column).toMatch(/^[a-z_]+$/);
      if (entry.shopIdColumn !== null) expect(entry.shopIdColumn).toMatch(/^[a-z_]+$/);
    }
  });
});

describe("modules purs de src/lib/images", () => {
  const PURE_MODULES = [
    "durable-url.ts",
    "upload-contract.ts",
    "thumbnail.ts",
    "columns.ts",
    "product-photo.ts",
    "product-image-write.ts",
    "rank.ts",
  ];
  const ALLOWED_IMPORTS = new Set([
    "zod",
    "@/lib/auth/test-mode-env",
    "@/lib/product-images",
    ...PURE_MODULES.map((file) => `./${file.replace(/\.ts$/, "")}`),
  ]);
  const FORBIDDEN = [
    "fs",
    "node:fs",
    "path",
    "node:path",
    "sharp",
    "@prisma/client",
    "@/lib/prisma",
    "@vercel/blob",
  ];

  it.each(PURE_MODULES)("%s n'importe que des modules purs", (file) => {
    const source = fs.readFileSync(path.join(ROOT, "src/lib/images", file), "utf8");
    const specifiers = [
      ...source.matchAll(/\bfrom\s+["']([^"']+)["']/g),
      ...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
      ...source.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g),
      ...source.matchAll(/^\s*import\s+["']([^"']+)["']/gm),
    ].map((match) => match[1]);
    for (const specifier of specifiers) {
      expect(FORBIDDEN).not.toContain(specifier);
      expect(ALLOWED_IMPORTS.has(specifier), `${file} importe ${specifier}`).toBe(true);
    }
  });

  it.each(PURE_MODULES)("%s ne lit ni l'horloge, ni le hasard, ni le réseau", (file) => {
    const source = fs.readFileSync(path.join(ROOT, "src/lib/images", file), "utf8");
    expect(source).not.toMatch(/\bDate\.now\s*\(|\bnew Date\s*\(|\bMath\.random\s*\(|\bfetch\s*\(/);
    const envReads = [...source.matchAll(/process\.env\.(\w+)/g)].map((match) => match[1]);
    expect(envReads).toEqual(file === "durable-url.ts" ? ["NEXT_PUBLIC_IMAGE_BLOB_HOST"] : []);
  });

  it("product-images.ts et test-mode-env.ts, importés par ces modules, n'importent rien", () => {
    for (const file of ["src/lib/product-images.ts", "src/lib/auth/test-mode-env.ts"]) {
      const source = fs.readFileSync(path.join(ROOT, file), "utf8");
      expect(source).not.toMatch(/^\s*import\s/m);
      expect(source).not.toMatch(/\brequire\s*\(/);
    }
  });
});
