// POST /api/boucher/images/generate — Mode 1 (pure AI generation, up to 4 variations)
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { isReplicateConfigured, getReplicateClient } from "@/lib/replicate";
import { put } from "@vercel/blob";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { z } from "zod";
import {
  GEN_PRESETS,
  BACKGROUNDS,
  ANGLES,
  buildGenPrompt,
} from "@/lib/image-prompts";

const VALID_USAGES = ["CAMPAIGN", "PROMO", "PRODUCT", "SOCIAL", "BANNER"] as const;

const generateSchema = z.object({
  prompt: z.string().min(3).max(500),
  preset: z.enum(GEN_PRESETS).default("NONE"),
  background: z.enum(BACKGROUNDS).default("WHITE"),
  angle: z.enum(ANGLES).default("45"),
  variations: z.number().int().min(1).max(4).default(4),
  usage: z.enum(VALID_USAGES).default("PRODUCT"),
  width: z.number().int().min(256).max(2048).optional(),
  height: z.number().int().min(256).max(2048).optional(),
  finalPromptOverride: z.string().min(3).max(2000).optional(),
});

function parseRetryAfter(msg: string): number | null {
  const m = msg.match(/retry_after["\s:]*([0-9]+)/i);
  if (m) return Math.min(30, Number(m[1])) * 1000;
  const m2 = msg.match(/resets in ~(\d+)s/i);
  if (m2) return Math.min(30, Number(m2[1])) * 1000;
  return null;
}

async function runOneGeneration(
  client: ReturnType<typeof getReplicateClient>,
  args: { prompt: string; width: number; height: number; shopId: string; variationIndex: number }
): Promise<string> {
  // Retry up to 3 times on 429 (Replicate throttling — especially strict when account has low credit)
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const output = await client.run("black-forest-labs/flux-schnell", {
        input: {
          prompt: args.prompt,
          width: args.width,
          height: args.height,
          num_outputs: 1,
        },
      });
      const replicateUrl = Array.isArray(output) ? String(output[0]) : String(output);
      const resp = await fetch(replicateUrl);
      if (!resp.ok) throw new Error(`Replicate fetch failed: ${resp.status}`);
      const buffer = Buffer.from(await resp.arrayBuffer());
      const blob = await put(
        `shops/${args.shopId}/generated/${Date.now()}-v${args.variationIndex}.png`,
        buffer,
        { access: "public", contentType: "image/png" }
      );
      return blob.url;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("429") && !msg.includes("Too Many Requests")) throw err;
      const waitMs = parseRetryAfter(msg) ?? 10000;
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const rl = await checkRateLimit(rateLimits.ai, `img-gen:${auth.userId}`);
    if (!rl.success) {
      return apiError("RATE_LIMITED", "Trop de générations, réessayez dans une minute");
    }

    if (!isReplicateConfigured()) {
      return apiError("SERVICE_DISABLED", "Service d'images IA non configuré.");
    }

    const body = await req.json();
    const parsed = generateSchema.parse(body);
    const { prompt, preset, background, angle, variations, usage, finalPromptOverride } = parsed;
    const width = parsed.width ?? 1024;
    const height = parsed.height ?? 1024;

    const finalPrompt =
      finalPromptOverride && finalPromptOverride.trim().length > 0
        ? finalPromptOverride.trim()
        : buildGenPrompt({ userPrompt: prompt, preset, background, angle });

    const client = getReplicateClient();

    // Sequential to stay within Replicate's free-tier concurrency (1 prediction at a time).
    // Total time: ~3-5s per variation × N, stays under maxDuration=60.
    const results: (string | null)[] = [];
    const failures: { i: number; msg: string }[] = [];
    for (let i = 0; i < variations; i++) {
      try {
        const url = await runOneGeneration(client, {
          prompt: finalPrompt,
          width,
          height,
          shopId: auth.shopId,
          variationIndex: i,
        });
        results.push(url);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("[images/generate] variation failed", { i, msg });
        failures.push({ i, msg });
        results.push(null);
      }
    }

    const successful = results
      .map((url, i) => (url ? { url, i } : null))
      .filter((v): v is { url: string; i: number } => v !== null);

    if (successful.length === 0) {
      return apiError("INTERNAL_ERROR", "Toutes les générations ont échoué");
    }

    const images = await Promise.all(
      successful.map(({ url, i }) =>
        prisma.generatedImage.create({
          data: {
            prompt,
            model: "FLUX_SCHNELL",
            imageUrl: url,
            width,
            height,
            usage,
            shopId: auth.shopId,
            createdBy: auth.userId,
            metadata: {
              preset,
              background,
              angle,
              variationIndex: i,
              totalVariations: variations,
              userPrompt: prompt,
              finalPrompt,
            },
          },
          select: { id: true, imageUrl: true, metadata: true },
        })
      )
    );

    return apiSuccess(
      {
        finalPrompt,
        failures, // debug: list of { i, msg } for variations that failed
        images: images.map((img) => ({
          id: img.id,
          url: img.imageUrl,
          finalPrompt,
          metadata: img.metadata,
        })),
      },
      201
    );
  } catch (err) {
    return handleApiError(err, "boucher/images/generate");
  }
}
