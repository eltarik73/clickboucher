// POST /api/boucher/images/enhance-prompt — Enrich user FR prompt via Claude Haiku
export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const schema = z.object({
  prompt: z.string().min(3).max(500),
  preset: z.string().max(40).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const rl = await checkRateLimit(rateLimits.ai, `prompt-enh:${auth.userId}`);
    if (!rl.success) {
      return apiError("RATE_LIMITED", "Trop de requêtes, réessayez dans une minute");
    }

    const body = await req.json();
    const { prompt, preset } = schema.parse(body);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Fail-silent: return original prompt
      return apiSuccess({ enhancedPrompt: prompt });
    }

    const client = new Anthropic({ apiKey });

    const system =
      "You are an expert food photography prompt engineer specialized in halal butcher product photography. Enrich the user's French product description into a concise English prompt (max 120 words) describing a professional studio photo: meat quality, texture, lighting, composition, background, camera angle. Always include 'halal certified'. Return ONLY the enriched English prompt, no preamble, no quotes.";

    const userText = preset
      ? `Product (FR): ${prompt}\nPreset: ${preset}`
      : `Product (FR): ${prompt}`;

    try {
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system,
        messages: [{ role: "user", content: userText }],
      });

      const textBlock = msg.content.find((c) => c.type === "text");
      const enhanced =
        textBlock && textBlock.type === "text" ? textBlock.text.trim() : prompt;

      return apiSuccess({ enhancedPrompt: enhanced || prompt });
    } catch (err) {
      logger.warn("[enhance-prompt] Claude call failed, returning original", err);
      return apiSuccess({ enhancedPrompt: prompt });
    }
  } catch (err) {
    return handleApiError(err, "boucher/images/enhance-prompt");
  }
}
