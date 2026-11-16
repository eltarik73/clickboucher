// @vitest-environment node
// Choix du stockage des images selon l'environnement, chemins du magasin local, et aller-retour
// écriture / effacement sur le disque (dossier temporaire). Aucun appel à Vercel Blob.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StoreUnavailableError } from "@/lib/images/errors";
import {
  deleteFilesQuietly,
  getImageStore,
  localStoreAllowed,
  localStoreFile,
  localStoreRoot,
  storedFilesOf,
} from "@/lib/images/store";
import { MemoryImageStore } from "../../../tests/fixtures/images/memory-store";

const UUID = "3f2b8c1e-7a4d-4e9b-9c2a-1d5e6f708192";
let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "klikgo-image-store-"));
  vi.stubEnv("IMAGE_LOCAL_STORE_DIR", root);
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("KLIKGO_DEPLOY_ENV", "");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe("getImageStore — un seul choix, selon l'environnement", () => {
  it("jeton Blob présent → Vercel Blob (même en local)", () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_test_token");
    expect(getImageStore().kind).toBe("blob");
    expect(localStoreAllowed()).toBe(false);
  });

  it("sans jeton, hors Vercel et hors production → disque local", () => {
    expect(getImageStore().kind).toBe("local");
    expect(localStoreAllowed()).toBe(true);
  });

  it.each([
    ["VERCEL_ENV", "production"],
    ["KLIKGO_DEPLOY_ENV", "production"],
    ["VERCEL", "1"],
  ])("%s=%s sans jeton → StoreUnavailableError (503), jamais le disque", (name, value) => {
    vi.stubEnv(name, value);
    expect(localStoreAllowed()).toBe(false);
    expect(() => getImageStore()).toThrow(StoreUnavailableError);
  });
});

describe("localStoreFile — rien ne sort du magasin", () => {
  it.each([
    [["..", "x.webp"]],
    [["a", "..", "b.webp"]],
    [["A.webp"]],
    [["shops", "A.webp"]],
    [["a.b", "c.webp"]],
    [["x.webp", "y"]],
    [["x.webp"]],
    [["shops", "x.png"]],
    [["shops", ""]],
    [[]],
  ])("refuse %j", (segments) => {
    expect(localStoreFile(segments)).toBeNull();
  });

  it("accepte shops/<id>/product/<uuid>.webp, dans la racine", () => {
    const file = localStoreFile(["shops", "abc", "product", `${UUID}.webp`]);
    expect(file).toBe(path.join(path.resolve(root), "shops", "abc", "product", `${UUID}.webp`));
  });

  it("racine par défaut : .image-store du dossier courant", () => {
    vi.stubEnv("IMAGE_LOCAL_STORE_DIR", "");
    expect(localStoreRoot()).toBe(path.join(process.cwd(), ".image-store"));
  });
});

describe("LocalDiskStore — écrire, servir, effacer", () => {
  it("aller-retour put puis del dans le dossier temporaire", async () => {
    const store = getImageStore();
    const pathname = `shops/abc/product/${UUID}.webp`;
    const bytes = new Uint8Array([82, 73, 70, 70, 1, 2, 3]);

    const { url } = await store.put(pathname, bytes, "image/webp");
    expect(url).toBe(`/local-images/${pathname}`);
    const file = path.join(root, pathname);
    expect(new Uint8Array(readFileSync(file))).toEqual(bytes);

    await store.del(url);
    expect(existsSync(file)).toBe(false);
    await expect(store.del(url)).resolves.toBeUndefined();
  });

  it("refuse d'écrire hors d'un chemin valide et d'effacer une URL qui n'est pas locale", async () => {
    const store = getImageStore();
    await expect(store.put("../evil.webp", new Uint8Array([1]), "image/webp")).rejects.toThrow();
    await expect(store.put("shops/abc/x.png", new Uint8Array([1]), "image/webp")).rejects.toThrow();
    await expect(store.del("https://example.com/shops/abc/x.webp")).rejects.toThrow();
    await expect(store.del("/local-images/../../etc/x.webp")).rejects.toThrow();
  });
});

describe("BlobStore — n'efface que notre magasin", () => {
  it("refuse d'effacer une URL d'un autre hôte, sans appeler Vercel Blob", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_test_token");
    const store = getImageStore();
    await expect(store.del("https://other.public.blob.vercel-storage.com/x.webp")).rejects.toThrow(
      "Suppression refusée"
    );
    await expect(store.del("/local-images/shops/abc/x.webp")).rejects.toThrow(
      "Suppression refusée"
    );
  });
});

describe("storedFilesOf — les fichiers de notre magasin derrière une URL", () => {
  const blob = `https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com/shops/abc/product/${UUID}`;

  it("une photo envoyée : la photo, puis sa vignette", () => {
    expect(storedFilesOf(`${blob}.webp`)).toEqual([`${blob}.webp`, `${blob}-t.webp`]);
    const local = `/local-images/shops/abc/product/${UUID}.webp`;
    expect(storedFilesOf(local)).toEqual([local, `/local-images/shops/abc/product/${UUID}-t.webp`]);
  });

  it("un fichier du magasin sans nom de vignette : le fichier seul", () => {
    const legacy =
      "https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com/products/product-1.webp";
    expect(storedFilesOf(legacy)).toEqual([legacy]);
  });

  it.each([
    "https://other.public.blob.vercel-storage.com/shops/abc/product/x.webp",
    "https://images.unsplash.com/photo-1",
    "https://replicate.delivery/x/out-0.webp",
    "/img/products/merguez.jpg",
  ])("%s n'est pas à nous : rien à effacer", (url) => {
    expect(storedFilesOf(url)).toEqual([]);
  });
});

describe("deleteFilesQuietly — un effacement en échec est journalisé, jamais levé", () => {
  it("essaie chaque fichier, journalise chaque échec avec son contexte et se termine", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = new MemoryImageStore({ failDel: true });

    await expect(
      deleteFilesQuietly(store, ["/a.webp", "/b.webp"], "test")
    ).resolves.toBeUndefined();

    expect(store.dels).toEqual(["/a.webp", "/b.webp"]);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(warn.mock.calls[0])).toContain("test");
  });

  it("efface chaque fichier quand le stockage répond", async () => {
    const store = new MemoryImageStore();
    store.seed("/a.webp");
    store.seed("/b.webp");

    await deleteFilesQuietly(store, ["/a.webp", "/b.webp"], "test");

    expect(store.files.size).toBe(0);
  });
});
