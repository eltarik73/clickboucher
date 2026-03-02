// src/lib/image-generation.ts — AI image generation via Replicate (FLUX + Ideogram)
import { getReplicateClient } from "./replicate";
import { prisma } from "./prisma";

// ── Models ──
export const IMAGE_MODELS = {
  FLUX_SCHNELL: "black-forest-labs/flux-schnell",
  FLUX_PRO: "black-forest-labs/flux-1.1-pro",
  IDEOGRAM: "ideogram-ai/ideogram-v2-turbo",
} as const;

export type ImageModel = keyof typeof IMAGE_MODELS;
export type ImageUsage = "CAMPAIGN" | "PROMO" | "PRODUCT" | "SOCIAL" | "BANNER";

type GenerateOpts = {
  prompt: string;
  model?: ImageModel;
  width?: number;
  height?: number;
  usage: ImageUsage;
  shopId?: string;
  createdBy: string;
};

// ── Prompt builder ──
function buildPrompt(base: string, usage: ImageUsage): string {
  const styleGuide =
    "Professional food photography, warm lighting, appetizing, high-quality, clean composition. French artisan butcher shop aesthetic.";
  const usageHints: Record<ImageUsage, string> = {
    CAMPAIGN: "Email marketing banner, wide format, eye-catching headline area.",
    PROMO: "Promotional poster, bold discount display, vibrant red accents.",
    PRODUCT: "Product showcase, close-up food shot, natural colors, white background.",
    SOCIAL: "Instagram story format, trendy, modern typography space.",
    BANNER: "Website hero banner, wide panoramic, inviting atmosphere.",
  };
  return `${base}. ${styleGuide} ${usageHints[usage]}`;
}

// ── Model selection helper ──
function selectModel(usage: ImageUsage, explicitModel?: ImageModel): ImageModel {
  if (explicitModel) return explicitModel;
  // Text-heavy → Ideogram, fast previews → Schnell, quality → Pro
  if (usage === "PROMO" || usage === "BANNER") return "IDEOGRAM";
  if (usage === "SOCIAL") return "FLUX_SCHNELL";
  return "FLUX_PRO";
}

// ── Default dimensions by usage ──
function defaultDimensions(usage: ImageUsage): { width: number; height: number } {
  switch (usage) {
    case "CAMPAIGN":
      return { width: 1200, height: 600 };
    case "PROMO":
      return { width: 1080, height: 1080 };
    case "PRODUCT":
      return { width: 1024, height: 1024 };
    case "SOCIAL":
      return { width: 1080, height: 1920 };
    case "BANNER":
      return { width: 1440, height: 480 };
    default:
      return { width: 1024, height: 1024 };
  }
}

// ── Generate image ──
export async function generateImage(opts: GenerateOpts) {
  const model = selectModel(opts.usage, opts.model);
  const dims = { ...defaultDimensions(opts.usage) };
  if (opts.width) dims.width = opts.width;
  if (opts.height) dims.height = opts.height;

  const fullPrompt = buildPrompt(opts.prompt, opts.usage);
  const replicate = getReplicateClient();
  const modelId = IMAGE_MODELS[model];

  let imageUrl: string;

  if (model === "IDEOGRAM") {
    const output = await replicate.run(modelId, {
      input: {
        prompt: fullPrompt,
        aspect_ratio: dims.width > dims.height ? "16:9" : dims.width === dims.height ? "1:1" : "9:16",
        magic_prompt_option: "AUTO",
      },
    });
    // Ideogram returns array of URLs or FileOutput
    const urls = Array.isArray(output) ? output : [output];
    const first = urls[0];
    imageUrl = typeof first === "string" ? first : (first as { url?: string })?.url || String(first);
  } else {
    const output = await replicate.run(modelId, {
      input: {
        prompt: fullPrompt,
        width: dims.width,
        height: dims.height,
        num_outputs: 1,
        ...(model === "FLUX_SCHNELL" ? { num_inference_steps: 4 } : {}),
      },
    });
    // FLUX returns array of URLs or FileOutput
    const urls = Array.isArray(output) ? output : [output];
    const first = urls[0];
    imageUrl = typeof first === "string" ? first : (first as { url?: string })?.url || String(first);
  }

  // Save to DB
  const record = await prisma.generatedImage.create({
    data: {
      prompt: opts.prompt,
      model,
      imageUrl,
      width: dims.width,
      height: dims.height,
      usage: opts.usage,
      shopId: opts.shopId || null,
      createdBy: opts.createdBy,
      metadata: { fullPrompt, modelId },
    },
  });

  return record;
}

// ── List images ──
export async function listImages(opts: {
  shopId?: string;
  usage?: ImageUsage;
  createdBy?: string;
  limit?: number;
}) {
  return prisma.generatedImage.findMany({
    where: {
      ...(opts.shopId ? { shopId: opts.shopId } : {}),
      ...(opts.usage ? { usage: opts.usage } : {}),
      ...(opts.createdBy ? { createdBy: opts.createdBy } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit || 50,
  });
}
