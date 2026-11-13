// POST /api/boucher/images/import — Import web-searched image into Vercel Blob
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { put } from "@vercel/blob";
import { logger } from "@/lib/logger";
import {
  extensionForImageContentType,
  parseSafeImageContentType,
} from "@/lib/image-content-type";
import { z } from "zod";

const VALID_USAGES = ["CAMPAIGN", "PROMO", "PRODUCT", "SOCIAL", "BANNER"] as const;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT_MS = 10_000;

// Seul appelant : ImageSearchModal, qui renvoie l'URL d'un résultat de
// /api/boucher/images/search (Pexels `src.*`, Unsplash `urls.regular`).
// Tout autre hôte = requête serveur vers une cible choisie par le client (SSRF).
const ALLOWED_IMPORT_HOSTS = new Set([
  "images.pexels.com",
  "images.unsplash.com",
  "plus.unsplash.com",
]);

function isAllowedImportUrl(raw: string): boolean {
  try {
    const target = new URL(raw);
    return (
      target.protocol === "https:" &&
      target.port === "" &&
      ALLOWED_IMPORT_HOSTS.has(target.hostname)
    );
  } catch {
    return false;
  }
}

const importSchema = z.object({
  url: z.string().url(),
  source: z.enum(["pexels", "unsplash"]),
  query: z.string().trim().min(1).max(200),
  usage: z.enum(VALID_USAGES).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const rl = await checkRateLimit(rateLimits.search, `import-img:${auth.userId}`);
    if (!rl.success) {
      return apiError("RATE_LIMITED", "Trop d'imports, réessayez dans une minute");
    }

    const body = await req.json();
    const { url, source, query, usage } = importSchema.parse(body);

    if (!isAllowedImportUrl(url)) {
      return apiError(
        "VALIDATION_ERROR",
        "Source d'image non autorisée (Pexels ou Unsplash uniquement)"
      );
    }

    // Fetch image with timeout
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let imgRes: Response;
    try {
      imgRes = await fetch(url, { signal: ctrl.signal });
    } catch (e) {
      logger.warn("[images/import] fetch failed", (e as Error).message);
      return apiError("INTERNAL_ERROR", "Impossible de télécharger l'image");
    } finally {
      clearTimeout(timer);
    }

    if (!imgRes.ok) {
      return apiError("NOT_FOUND", "Image source introuvable");
    }

    // Le Content-Type amont n'est jamais stocké tel quel dans le Blob public.
    const contentType = parseSafeImageContentType(imgRes.headers.get("content-type"));
    if (!contentType) {
      return apiError(
        "VALIDATION_ERROR",
        "Format d'image non supporté (JPG, PNG, WebP, GIF ou AVIF uniquement)"
      );
    }

    const contentLength = Number(imgRes.headers.get("content-length") || 0);
    if (contentLength && contentLength > MAX_BYTES) {
      return apiError("VALIDATION_ERROR", "Image trop volumineuse (>10 Mo)");
    }

    const arrayBuffer = await imgRes.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) {
      return apiError("VALIDATION_ERROR", "Image trop volumineuse (>10 Mo)");
    }
    const buffer = Buffer.from(arrayBuffer);

    const ext = extensionForImageContentType(contentType);

    const blob = await put(
      `shops/${auth.shopId}/imports/${Date.now()}-${source}.${ext}`,
      buffer,
      { access: "public", contentType }
    );

    const generated = await prisma.generatedImage.create({
      data: {
        prompt: query,
        model: `${source.toUpperCase()}_SEARCH`,
        imageUrl: blob.url,
        width: 1024,
        height: 1024,
        usage: usage || "PRODUCT",
        shopId: auth.shopId,
        createdBy: auth.userId,
        metadata: { query, sourceUrl: url },
      },
    });

    return apiSuccess({ url: blob.url, id: generated.id }, 201);
  } catch (err) {
    return handleApiError(err, "boucher/images/import");
  }
}
