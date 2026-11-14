// @vitest-environment node
// Chaque photo locale que le code ou le seed peut écrire en base ou afficher existe dans public/
// et passe la règle stricte LOCAL_STATIC. La règle « URL durable » accepte tout chemin
// /img/(products|shops|recipes)/<nom>.(jpg|jpeg|png|webp) sans lire le disque : ce test, lancé en CI,
// garantit qu'aucun chemin écrit par le code n'est un fichier absent. Le disque n'est lu qu'ici.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyImageUrl } from "@/lib/images/durable-url";
import { DEFAULT_PRODUCT_PHOTO, SHOP_IMAGES } from "@/lib/product-images";

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, "public");

function imgLiterals(relativeFile: string): string[] {
  const source = fs.readFileSync(path.join(ROOT, relativeFile), "utf8");
  return [...source.matchAll(/["'`](\/img\/[^"'`\s]+)["'`]/g)].map((match) => match[1]);
}

/** Grille « photo par défaut » de la fiche boutique du webmaster (src/app/webmaster/boutiques/[shopId]/page.tsx). */
const WEBMASTER_SHOP_GRID = [1, 3, 4, 5, 6, 8, 10].map((n) => `/img/shops/shop-${n}.jpg`);

const PRISMA_SCRIPTS = fs
  .readdirSync(path.join(ROOT, "prisma"))
  .filter((name) => name.endsWith(".ts"))
  .map((name) => `prisma/${name}`);

function existsInPublic(urlPath: string): boolean {
  const file = path.join(PUBLIC, urlPath);
  return file.startsWith(PUBLIC + path.sep) && fs.statSync(file, { throwIfNoEntry: false })?.isFile() === true;
}

describe("photos locales référencées par le code", () => {
  const fromProductImages = imgLiterals("src/lib/product-images.ts");
  const fromSeed = imgLiterals("prisma/seed.ts");

  it("les sources contiennent bien des chemins /img (le relevé ne tourne pas à vide)", () => {
    expect(fromProductImages.length).toBeGreaterThan(50);
    expect(fromSeed.length).toBeGreaterThan(20);
    expect(PRISMA_SCRIPTS).toContain("prisma/seed.ts");
  });

  const all = new Set<string>([
    ...fromProductImages,
    ...PRISMA_SCRIPTS.flatMap(imgLiterals),
    ...WEBMASTER_SHOP_GRID,
    ...SHOP_IMAGES,
    DEFAULT_PRODUCT_PHOTO,
  ]);

  it.each([...all].sort())("%s est LOCAL_STATIC et existe dans public/", (urlPath) => {
    expect(classifyImageUrl(urlPath)).toBe("LOCAL_STATIC");
    expect(existsInPublic(urlPath)).toBe(true);
  });
});
