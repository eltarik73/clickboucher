// DELETE /api/boucher/images/[id] — Delete one AI-generated image (shop-scoped)
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { del } from "@vercel/blob";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const { id } = await context.params;
    if (!id || typeof id !== "string") {
      return apiError("VALIDATION_ERROR", "ID invalide");
    }

    const image = await prisma.generatedImage.findUnique({
      where: { id },
      select: { id: true, shopId: true, imageUrl: true },
    });

    if (!image) return apiError("NOT_FOUND", "Image introuvable");
    if (image.shopId !== auth.shopId) {
      return apiError("FORBIDDEN", "Image non autorisée");
    }

    await prisma.generatedImage.delete({ where: { id } });

    // Best-effort blob cleanup
    if (image.imageUrl && image.imageUrl.includes(".public.blob.vercel-storage.com")) {
      try {
        await del(image.imageUrl);
      } catch (blobErr) {
        logger.warn("[boucher/images/delete] blob del failed", {
          url: image.imageUrl,
          error: blobErr instanceof Error ? blobErr.message : String(blobErr),
        });
      }
    }

    return apiSuccess({ deleted: true });
  } catch (err) {
    return handleApiError(err, "boucher/images/[id] DELETE");
  }
}
