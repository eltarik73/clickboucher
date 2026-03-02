// POST /api/admin/images/generate — Webmaster AI image generation
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { generateImage, type ImageModel, type ImageUsage } from "@/lib/image-generation";

const VALID_MODELS: ImageModel[] = ["FLUX_SCHNELL", "FLUX_PRO", "IDEOGRAM"];
const VALID_USAGES: ImageUsage[] = ["CAMPAIGN", "PROMO", "PRODUCT", "SOCIAL", "BANNER"];

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const body = await req.json();
    const { prompt, model, width, height, usage, shopId } = body;

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
      shopId: shopId || undefined,
      createdBy: admin.userId,
    });

    return apiSuccess(image, 201);
  } catch (err) {
    return handleApiError(err, "admin/images/generate");
  }
}
