// src/app/api/dashboard/marketing/generate-visual/route.ts — Generate visual (admin)
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { isReplicateConfigured, getReplicateClient } from "@/lib/replicate";
import { put } from "@vercel/blob";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { z } from "zod";

const generateVisualSchema = z.object({
  type: z.enum(["template", "ai"]),
  title: z.string().max(200).optional(),
  subtitle: z.string().max(300).optional(),
  color: z.string().max(50).optional(),
  context: z.string().max(500).optional(),
});

export const dynamic = "force-dynamic";

// ── POST — Generate marketing visual ─────────────────────────
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const rl = await checkRateLimit(rateLimits.ai, `gen-visual:${auth.userId}`);
    if (!rl.success) return apiError("RATE_LIMITED", "Trop de requêtes IA, réessayez dans une minute");

    const body = await req.json();
    const { type, title, subtitle, color, context } = generateVisualSchema.parse(body);

    // ── Template mode: pass-through for client-side rendering ──
    if (type === "template") {
      return apiSuccess({ type: "template", title, subtitle, color });
    }

    // ── AI mode: generate with Replicate ──────────────────────
    if (!isReplicateConfigured()) {
      return apiError("SERVICE_DISABLED", "Replicate n'est pas configuré (REPLICATE_API_TOKEN manquant)");
    }

    const prompt = `Professional marketing banner for a halal butcher shop app called Klik&Go. ${
      context || ""
    } ${title ? `Title: "${title}".` : ""} ${
      subtitle ? `Subtitle: "${subtitle}".` : ""
    } Modern, clean design with ${
      color || "red"
    } accent color. Food photography style, appetizing meat display, premium quality feel. No text in image.`;

    const replicate = getReplicateClient();
    const output = await replicate.run("black-forest-labs/flux-schnell", {
      input: {
        prompt,
        num_outputs: 1,
        aspect_ratio: "16:9",
      },
    });

    // Replicate returns an array of URLs
    const replicateUrl = Array.isArray(output) ? String(output[0]) : String(output);

    // Upload to Vercel Blob for permanent URL (Replicate URLs expire after ~1h)
    const imageResponse = await fetch(replicateUrl);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const blob = await put(`generated/${Date.now()}.png`, buffer, {
      access: 'public',
      contentType: 'image/png',
    });
    const imageUrl = blob.url;

    // Save to GeneratedImage
    const image = await prisma.generatedImage.create({
      data: {
        prompt,
        model: "FLUX_SCHNELL",
        imageUrl,
        width: 1024,
        height: 576,
        usage: "CAMPAIGN",
        createdBy: auth.userId,
      },
    });

    return apiSuccess({ type: "ai", imageUrl, id: image.id });
  } catch (error) {
    return handleApiError(error, "dashboard/marketing/generate-visual POST");
  }
}
