// POST /api/boucher/images/generate — Boucher AI image generation (scoped to shop)
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { generateImage, type ImageModel, type ImageUsage } from "@/lib/image-generation";

const VALID_MODELS: ImageModel[] = ["FLUX_SCHNELL", "FLUX_PRO", "IDEOGRAM"];
const VALID_USAGES: ImageUsage[] = ["CAMPAIGN", "PROMO", "PRODUCT", "SOCIAL", "BANNER"];

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const body = await req.json();
    const { prompt, model, width, height, usage } = body;

    if (!prompt || typeof prompt !== "string" || prompt.length < 5) {
      return apiError("VALIDATION_ERROR", "Prompt requis (min 5 caractères)");
    }
    if (prompt.length > 500) {
      return apiError("VALIDATION_ERROR", "Prompt trop long (max 500 caractères)");
    }
    if (model && !VALID_MODELS.includes(model)) {
      return apiError("VALIDATION_ERROR", `Modèle invalide. Valides : ${VALID_MODELS.join(", ")}`);
    }
    if (!usage || !VALID_USAGES.includes(usage)) {
      return apiError("VALIDATION_ERROR", `Usage requis. Valides : ${VALID_USAGES.join(", ")}`);
    }

    const image = await generateImage({
      prompt,
      model: model || undefined,
      width: width ? Number(width) : undefined,
      height: height ? Number(height) : undefined,
      usage,
      shopId: auth.shopId,
      createdBy: auth.userId,
    });

    return apiSuccess(image, 201);
  } catch (err) {
    return handleApiError(err, "boucher/images/generate");
  }
}
