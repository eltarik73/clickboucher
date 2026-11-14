// GET /local-images/<chemin> — Sert les photos du magasin local (développement et CI seulement).
//
// Hors de /api, donc hors du matcher du middleware : aucun helper d'authentification ici, les
// fichiers sont publics comme ceux du magasin Blob. Répond 404 partout où le disque local n'est
// pas le stockage (Vercel, production, jeton Blob présent), et pour tout chemin hors du magasin.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { localStoreAllowed, localStoreFile } from "@/lib/images/store";

const MISSING_FILE_CODES = new Set(["ENOENT", "ENOTDIR", "EISDIR"]);

function notFound(): Response {
  return new Response("Introuvable", { status: 404, headers: { "Cache-Control": "no-store" } });
}

export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    if (!localStoreAllowed()) return notFound();
    const file = localStoreFile(params.path);
    if (file === null) return notFound();

    let bytes: Buffer;
    try {
      bytes = await readFile(file);
    } catch (error) {
      if (MISSING_FILE_CODES.has((error as NodeJS.ErrnoException).code ?? "")) return notFound();
      throw error;
    }

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    logger.error("[local-images] lecture impossible", {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response("Erreur interne", { status: 500 });
  }
}
