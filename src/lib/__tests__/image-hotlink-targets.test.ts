// @vitest-environment node
// 1. scripts/images/fix-unsplash-hotlinks.sql remplace chaque photo Unsplash par la photo que le site
//    choisit déjà pour ce nom (keywordProductPhoto), et ce fichier existe dans public/ : la table
//    VALUES du script est lue ici, pas recopiée.
// 2. Les scripts du propriétaire ne créent aucune table dans la base visée (seulement des tables
//    temporaires) et ne parlent jamais au stockage Blob directement (src/lib/images/store.ts seul).
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyImageUrl } from "@/lib/images/durable-url";
import { keywordProductPhoto } from "@/lib/product-images";
import { UNSPLASH_PRODUCT_NAMES } from "../../../tests/fixtures/images/unsplash-pattern";

const ROOT = process.cwd();
const SCRIPTS_DIR = path.join(ROOT, "scripts/images");
const HOTLINK_SQL = fs.readFileSync(path.join(SCRIPTS_DIR, "fix-unsplash-hotlinks.sql"), "utf8");

/** Les couples (nom, cible) de l'INSERT INTO unsplash_fix_targets, apostrophes SQL dédoublées. */
function hotlinkTargets(sql: string): Array<[string, string]> {
  const block = sql.match(/INSERT INTO unsplash_fix_targets \(name, new_url\) VALUES([\s\S]*?);/);
  if (block === null) return [];
  return [...block[1].matchAll(/\(\s*'((?:[^']|'')+)'\s*,\s*'([^']+)'\s*\)/g)].map(
    ([, name, target]) => [name.replace(/''/g, "'"), target]
  );
}

function existsInPublic(urlPath: string): boolean {
  const publicDir = path.join(ROOT, "public");
  const file = path.join(publicDir, urlPath);
  return (
    file.startsWith(publicDir + path.sep) &&
    fs.statSync(file, { throwIfNoEntry: false })?.isFile() === true
  );
}

/** Le texte SQL sans ses commentaires « -- ». */
function withoutSqlComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

describe("fix-unsplash-hotlinks.sql — cibles", () => {
  const targets = hotlinkTargets(HOTLINK_SQL);

  it("couvre exactement les 8 noms relevés en production", () => {
    expect(targets.map(([name]) => name).sort()).toEqual([...UNSPLASH_PRODUCT_NAMES].sort());
  });

  it.each(targets)(
    "%s → %s : la photo que le site choisit pour ce nom, présente dans public/",
    (name, target) => {
      expect(target).toBe(keywordProductPhoto(name));
      expect(classifyImageUrl(target)).toBe("LOCAL_STATIC");
      expect(existsInPublic(target)).toBe(true);
    }
  );
});

describe("scripts/images — garde", () => {
  const files = fs
    .readdirSync(SCRIPTS_DIR, { recursive: true, encoding: "utf8" })
    .filter((name) => /\.(sql|ts)$/.test(name))
    .map((name) => ({ name, text: fs.readFileSync(path.join(SCRIPTS_DIR, name), "utf8") }));

  it("le dossier contient les scripts attendus (la garde ne tourne pas à vide)", () => {
    expect(files.map((file) => file.name).sort()).toEqual(
      expect.arrayContaining([
        "backfill-image-url.sql",
        "census.ts",
        "fix-unsplash-hotlinks.sql",
        "lib/census.ts",
        "lib/maintenance.ts",
        "lib/repair-plan.ts",
        "purge.ts",
        "repair.ts",
      ])
    );
  });

  it.each(files.filter((file) => file.name.endsWith(".sql")).map((file) => [file.name, file.text]))(
    "%s : seul CREATE TEMP TABLE, aucun DROP ni ALTER",
    (_name, text) => {
      const code = withoutSqlComments(text);
      const creates = [...code.matchAll(/\bCREATE\s+(\w+)(?:\s+(\w+))?/gi)].map((match) =>
        match[0].toUpperCase()
      );
      expect(creates.length).toBeGreaterThan(0);
      for (const create of creates) expect(create).toBe("CREATE TEMP TABLE");
      expect(code).toMatch(/ON COMMIT DROP/);
      expect(code.replace(/ON COMMIT DROP/g, "")).not.toMatch(/\b(DROP|ALTER|TRUNCATE)\b/i);
    }
  );

  it.each(files.filter((file) => file.name.endsWith(".ts")).map((file) => [file.name, file.text]))(
    "%s : n'importe pas @vercel/blob et n'écrit pas de SQL de structure",
    (_name, text) => {
      expect(text).not.toMatch(/@vercel\/blob/);
      expect(text).not.toMatch(/\b(CREATE|DROP|ALTER)\s+(TABLE|INDEX|SCHEMA)\b/i);
    }
  );
});
