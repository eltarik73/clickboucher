// POST /api/admin/images/generate — Webmaster AI image generation
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { isReplicateConfigured, getReplicateClient } from "@/lib/replicate";
import { put } from "@vercel/blob";
import { z } from "zod";

const VALID_USAGES = ["CAMPAIGN", "PROMO", "PRODUCT", "SOCIAL", "BANNER"] as const;

const generateImageSchema = z.object({
  prompt: z.string().min(5).max(1000),
  width: z.number().int().min(256).max(2048).optional(),
  height: z.number().int().min(256).max(2048).optional(),
  usage: z.enum(VALID_USAGES),
  shopId: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    if (!isReplicateConfigured()) {
      return apiError("SERVICE_DISABLED", "Service d'images IA non configuré.");
    }

    const body = await req.json();
    const { prompt, width, height, usage, shopId } = generateImageSchema.parse(body);

    const replicate = getReplicateClient();
    const output = await replicate.run("black-forest-labs/flux-schnell", {
      input: {
        prompt,
        width: width || 1024,
        height: height || 1024,
        num_outputs: 1,
      },
    });

    const replicateUrl = Array.isArray(output) ? String(output[0]) : String(output);

    // Upload to Vercel Blob for permanent URL (Replicate URLs expire after ~1h)
    const imageResponse = await fetch(replicateUrl);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const blob = await put(`generated/${Date.now()}.png`, buffer, {
      access: 'public',
      contentType: 'image/png',
    });
    const imageUrl = blob.url;

    const image = await prisma.generatedImage.create({
      data: {
        prompt,
        model: "FLUX_SCHNELL",
        imageUrl,
        width: width || 1024,
        height: height || 1024,
        usage,
        shopId: shopId || undefined,
        createdBy: admin.userId,
      },
    });

    return apiSuccess(image, 201);
  } catch (err) {
    return handleApiError(err, "admin/images/generate");
  }
}
