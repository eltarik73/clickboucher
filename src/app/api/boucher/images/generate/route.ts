// POST /api/boucher/images/generate — Boucher AI image generation (scoped to shop)
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { isReplicateConfigured, getReplicateClient } from "@/lib/replicate";
import { put } from "@vercel/blob";

const VALID_USAGES = ["CAMPAIGN", "PROMO", "PRODUCT", "SOCIAL", "BANNER"];

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    if (!isReplicateConfigured()) {
      return apiError("SERVICE_DISABLED", "Service d'images IA non configuré.");
    }

    const body = await req.json();
    const { prompt, width, height, usage } = body;

    if (!prompt || typeof prompt !== "string" || prompt.length < 5) {
      return apiError("VALIDATION_ERROR", "Prompt requis (min 5 caractères)");
    }
    if (!usage || !VALID_USAGES.includes(usage)) {
      return apiError("VALIDATION_ERROR", `Usage requis. Valides : ${VALID_USAGES.join(", ")}`);
    }

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
        shopId: auth.shopId,
        createdBy: auth.userId,
      },
    });

    return apiSuccess(image, 201);
  } catch (err) {
    return handleApiError(err, "boucher/images/generate");
  }
}
