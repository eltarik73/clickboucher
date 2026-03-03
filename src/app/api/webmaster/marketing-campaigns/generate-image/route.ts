// POST /api/webmaster/marketing-campaigns/generate-image — AI image for campaigns
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { generateImage } from "@/lib/image-generation";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  prompt: z.string().min(5).max(500),
  usage: z.enum(["CAMPAIGN", "PROMO", "PRODUCT", "SOCIAL", "BANNER"]).default("BANNER"),
  width: z.number().int().min(256).max(2048).optional(),
  height: z.number().int().min(256).max(2048).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth && auth.error) return auth.error;

    const body = await req.json();
    const data = schema.parse(body);

    const image = await generateImage({
      prompt: data.prompt,
      usage: data.usage,
      width: data.width,
      height: data.height,
      createdBy: auth.userId,
    });

    return apiSuccess({
      id: image.id,
      imageUrl: image.imageUrl,
      width: image.width,
      height: image.height,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("REPLICATE_API_TOKEN")) {
      return apiError("INTERNAL_ERROR", "Replicate non configuré");
    }
    return handleApiError(error, "marketing-campaigns/generate-image/POST");
  }
}
