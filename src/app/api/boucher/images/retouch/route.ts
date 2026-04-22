// POST /api/boucher/images/retouch — Mode 2 (image-to-image retouch via FLUX Kontext)
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { z } from "zod";
import { put } from "@vercel/blob";

import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { isReplicateConfigured, getReplicateClient } from "@/lib/replicate";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { buildRetouchPrompt, RETOUCH_PRESETS } from "@/lib/image-prompts";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
const PRIMARY_MODEL = "black-forest-labs/flux-kontext-pro";
const FALLBACK_MODEL = "black-forest-labs/flux-schnell";

const jsonSchema = z.object({
  imageUrl: z.string().url(),
  preset: z.enum(RETOUCH_PRESETS),
  variations: z.number().int().min(1).max(4).default(4),
  customPrompt: z.string().max(300).optional(),
  usage: z.enum(["PRODUCT", "CAMPAIGN", "BANNER"]).default("PRODUCT"),
});

type RetouchInput = z.infer<typeof jsonSchema>;

async function uploadOriginal(
  file: File,
  shopId: string
): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }
  const ext = (file.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "");
  const buf = Buffer.from(await file.arrayBuffer());
  const blob = await put(
    `shops/${shopId}/originals/${Date.now()}.${ext}`,
    buf,
    { access: "public", contentType: file.type || "image/jpeg" }
  );
  return blob.url;
}

function parseRetryAfterRetouch(msg: string): number | null {
  const m = msg.match(/retry_after["\s:]*([0-9]+)/i);
  if (m) return Math.min(30, Number(m[1])) * 1000;
  const m2 = msg.match(/resets in ~(\d+)s/i);
  if (m2) return Math.min(30, Number(m2[1])) * 1000;
  return null;
}

async function runModelWithRetry(
  client: ReturnType<typeof getReplicateClient>,
  model: `${string}/${string}`,
  input: Record<string, unknown>
): Promise<unknown> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await client.run(model, { input });
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("429") && !msg.includes("Too Many Requests")) throw err;
      const waitMs = parseRetryAfterRetouch(msg) ?? 10000;
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function runOneRetouch(
  client: ReturnType<typeof getReplicateClient>,
  args: { prompt: string; sourceUrl: string; shopId: string; variationIndex: number }
): Promise<string> {
  let output: unknown;
  try {
    output = await runModelWithRetry(client, PRIMARY_MODEL, {
      prompt: args.prompt,
      input_image: args.sourceUrl,
    });
  } catch (err) {
    logger.warn("[images/retouch] primary model failed, falling back", err);
    output = await runModelWithRetry(client, FALLBACK_MODEL, {
      prompt: args.prompt,
      image: args.sourceUrl,
      num_outputs: 1,
    });
  }

  const resultUrl = Array.isArray(output) ? String(output[0]) : String(output);
  const resp = await fetch(resultUrl);
  if (!resp.ok) throw new Error(`Replicate fetch failed: ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  const blob = await put(
    `shops/${args.shopId}/retouched/${Date.now()}-v${args.variationIndex}.png`,
    buffer,
    { access: "public", contentType: "image/png" }
  );
  return blob.url;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const rl = await checkRateLimit(rateLimits.ai, `img-retouch:${auth.userId}`);
    if (!rl.success) {
      return apiError("RATE_LIMITED", "Trop de retouches, réessayez dans une minute");
    }

    if (!isReplicateConfigured()) {
      return apiError("SERVICE_DISABLED", "Service d'images IA non configuré.");
    }

    const contentType = req.headers.get("content-type") || "";
    let params: RetouchInput;
    let sourceUrl: string;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return apiError("VALIDATION_ERROR", "Fichier manquant");
      }
      try {
        sourceUrl = await uploadOriginal(file, auth.shopId);
      } catch (err) {
        if ((err as Error).message === "FILE_TOO_LARGE") {
          return apiError("VALIDATION_ERROR", "Image trop lourde (max 5MB)");
        }
        throw err;
      }
      const variationsRaw = form.get("variations");
      params = jsonSchema.parse({
        imageUrl: sourceUrl,
        preset: form.get("preset"),
        variations: variationsRaw ? Number(variationsRaw) : undefined,
        customPrompt: form.get("customPrompt") || undefined,
        usage: form.get("usage") || undefined,
      });
    } else {
      const body = await req.json();
      params = jsonSchema.parse(body);
      sourceUrl = params.imageUrl;
    }

    const finalPrompt = buildRetouchPrompt({
      preset: params.preset,
      customPrompt: params.customPrompt,
    });

    const client = getReplicateClient();

    // Sequential to stay within Replicate's concurrency limits.
    const results: (string | null)[] = [];
    for (let i = 0; i < params.variations; i++) {
      try {
        const url = await runOneRetouch(client, {
          prompt: finalPrompt,
          sourceUrl,
          shopId: auth.shopId,
          variationIndex: i,
        });
        results.push(url);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("[images/retouch] variation failed", { i, msg });
        results.push(null);
      }
    }

    const successful = results
      .map((url, i) => (url ? { url, i } : null))
      .filter((v): v is { url: string; i: number } => v !== null);

    if (successful.length === 0) {
      return apiError("INTERNAL_ERROR", "Toutes les retouches ont échoué");
    }

    const images = await Promise.all(
      successful.map(({ url, i }) =>
        prisma.generatedImage.create({
          data: {
            prompt: finalPrompt,
            model: "FLUX_KONTEXT",
            imageUrl: url,
            width: 1024,
            height: 1024,
            usage: params.usage,
            shopId: auth.shopId,
            createdBy: auth.userId,
            metadata: {
              preset: params.preset,
              originalUrl: sourceUrl,
              variationIndex: i,
              customPrompt: params.customPrompt ?? null,
            },
          },
          select: { id: true, imageUrl: true, metadata: true },
        })
      )
    );

    return apiSuccess(
      {
        originalUrl: sourceUrl,
        images: images.map((img) => ({
          id: img.id,
          url: img.imageUrl,
          metadata: img.metadata,
        })),
      },
      201
    );
  } catch (err) {
    return handleApiError(err, "boucher/images/retouch");
  }
}
