// @vitest-environment node
// Garde statique : qui touche au stockage des images, au fournisseur d'IA et à sharp.
//
// Depuis C1-PHOTOS-A, un fichier d'image n'est écrit ou effacé que par src/lib/images/store.ts
// (via persistImage pour l'écriture), et seul src/lib/images/process.ts décode avec sharp. Les
// listes ci-dessous sont FERMÉES et ne peuvent que rétrécir : un nouvel importeur fait échouer le
// test (passer par src/lib/images à la place), une entrée devenue fausse aussi (la retirer).
// C1-PHOTOS-B les réduit à store.ts et au transport du fournisseur.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { importsModule, sourceFiles, withoutComments } from "./source-scan";

const ROOT = path.resolve(__dirname, "../..");
const SCANNED_DIRS = ["src", "scripts"];

/** Fichiers qui importent @vercel/blob, chacun avec sa raison. */
const BLOB_IMPORTERS: Record<string, string> = {
  "src/lib/images/store.ts": "seul adaptateur de stockage",
  "src/app/api/boucher/images/generate/route.ts": "C1-PHOTOS-B",
  "src/app/api/boucher/images/retouch/route.ts": "sorties de retouche, C1-PHOTOS-B",
  "src/app/api/boucher/images/import/route.ts": "import Pexels, C1-PHOTOS-C",
  "src/app/api/admin/images/generate/route.ts": "C1-PHOTOS-B",
  "src/app/api/dashboard/marketing/generate-visual/route.ts": "supprimée par C1-PHOTOS-B",
};

/** Fichiers qui appellent le fournisseur d'IA (paquet replicate, @/lib/replicate ou api.replicate.com). */
const PROVIDER_CALLERS: Record<string, string> = {
  "src/lib/replicate.ts": "client du fournisseur, remplacé par C1-PHOTOS-B",
  "src/app/api/boucher/images/generate/route.ts": "C1-PHOTOS-B",
  "src/app/api/boucher/images/retouch/route.ts": "C1-PHOTOS-B",
  "src/app/api/admin/images/generate/route.ts": "C1-PHOTOS-B",
  "src/app/api/dashboard/marketing/generate-visual/route.ts": "supprimée par C1-PHOTOS-B",
};

/** Fichiers de src/ qui importent sharp. */
const SHARP_IMPORTERS: Record<string, string> = {
  "src/lib/images/process.ts": "seul décodeur : format reconnu, redressé, métadonnées retirées",
};

const files = SCANNED_DIRS.flatMap(sourceFiles).map((file) => ({
  file,
  code: withoutComments(readFileSync(path.join(ROOT, file), "utf8")),
}));

const matching = (predicate: (code: string) => boolean, scope: string[] = SCANNED_DIRS) =>
  files
    .filter(({ file, code }) => scope.some((dir) => file.startsWith(`${dir}/`)) && predicate(code))
    .map(({ file }) => file)
    .sort();

const HOW_TO =
  "Liste fermée : pour écrire ou effacer un fichier d'image, passer par src/lib/images " +
  "(persistImage, getImageStore). Si un fichier a cessé d'importer le module, retirer son entrée.";

describe("garde des écrivains d'images", () => {
  it("seuls les fichiers listés importent @vercel/blob", () => {
    expect(
      matching((code) => importsModule(code, "@vercel/blob")),
      HOW_TO
    ).toEqual(Object.keys(BLOB_IMPORTERS).sort());
  });

  it("seuls les fichiers listés appellent le fournisseur d'IA", () => {
    const callsProvider = (code: string) =>
      importsModule(code, "replicate") ||
      importsModule(code, "@/lib/replicate") ||
      code.includes("api.replicate.com");
    expect(matching(callsProvider), HOW_TO).toEqual(Object.keys(PROVIDER_CALLERS).sort());
  });

  it("dans src/, seul process.ts importe sharp", () => {
    expect(
      matching((code) => importsModule(code, "sharp"), ["src"]),
      HOW_TO
    ).toEqual(Object.keys(SHARP_IMPORTERS).sort());
  });
});
