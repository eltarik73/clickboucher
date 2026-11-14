// @vitest-environment node
// GET /local-images/<chemin> : sert le magasin local en développement et en CI, et répond 404
// partout ailleurs (production Vercel, jeton Blob présent) ainsi que pour tout chemin hors magasin.
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/local-images/[...path]/route";
import { getImageStore } from "@/lib/images/store";

const UUID = "3f2b8c1e-7a4d-4e9b-9c2a-1d5e6f708192";
const SEGMENTS = ["shops", "abc", "product", `${UUID}.webp`];
const BYTES = new Uint8Array([82, 73, 70, 70, 9, 8, 7, 6]);
let root: string;

function get(segments: string[]) {
  const req = new NextRequest(`http://localhost/local-images/${segments.join("/")}`);
  return GET(req, { params: { path: segments } });
}

beforeEach(async () => {
  root = mkdtempSync(path.join(os.tmpdir(), "klikgo-local-route-"));
  vi.stubEnv("IMAGE_LOCAL_STORE_DIR", root);
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("KLIKGO_DEPLOY_ENV", "");
  await getImageStore().put(SEGMENTS.join("/"), BYTES, "image/webp");
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

describe("GET /local-images", () => {
  it("sert un fichier du magasin : 200 image/webp, cache immuable d'un an", async () => {
    const res = await get(SEGMENTS);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(BYTES);
  });

  it("404 sur la production Vercel, même si le fichier existe", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect((await get(SEGMENTS)).status).toBe(404);
  });

  it("404 sur un build figé pour la production (KLIKGO_DEPLOY_ENV)", async () => {
    vi.stubEnv("KLIKGO_DEPLOY_ENV", "production");
    expect((await get(SEGMENTS)).status).toBe(404);
  });

  it("404 quand un jeton Blob existe (le magasin est alors Vercel Blob)", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_test_token");
    expect((await get(SEGMENTS)).status).toBe(404);
  });

  it("404 pour un chemin qui remonte (« .. ») ou un fichier inconnu", async () => {
    expect((await get(["shops", "..", "..", `${UUID}.webp`])).status).toBe(404);
    expect((await get(["..", "x.webp"])).status).toBe(404);
    expect((await get(["shops", "abc", "product", "inconnu.webp"])).status).toBe(404);
    expect((await get(["shops", "abc", "product"])).status).toBe(404);
  });
});
