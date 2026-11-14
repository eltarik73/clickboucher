// DELETE /api/boucher/images/[id] — Supprimer une image de « Mes images » (boutique de la session).
//
// 404 si l'image n'existe pas ou appartient à une autre boutique. 409 tant qu'elle est utilisée
// (produits de la boutique nommés, tout autre usage seulement compté) : effacer le fichier
// casserait la photo affichée. Sinon la ligne est supprimée, puis le fichier et sa vignette ; un
// effacement de fichier qui échoue laisse un orphelin inoffensif (journalisé, réponse 200).
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { classifyImageUrl } from "@/lib/images/durable-url";
import { findImageReferences, imageInUse, imageInUseMessage } from "@/lib/images/references";
import { getImageStore } from "@/lib/images/store";
import { thumbnailOf } from "@/lib/images/thumbnail";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";

const imageIdSchema = z.string().trim().min(1).max(64);

/** Fichiers de notre stockage à effacer : la photo et sa vignette, jamais une URL étrangère. */
function storedFiles(url: string): string[] {
  const thumb = thumbnailOf(url);
  return [url, ...(thumb === null ? [] : [thumb])].filter((candidate) => {
    const kind = classifyImageUrl(candidate);
    return kind === "BLOB" || kind === "LOCAL_STORE";
  });
}

async function deleteFiles(urls: readonly string[]): Promise<void> {
  for (const url of urls) {
    try {
      await getImageStore().del(url);
    } catch (error) {
      logger.warn("[boucher/images/delete] fichier non effacé", {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const id = imageIdSchema.safeParse(params.id);
    if (!id.success) return apiError("VALIDATION_ERROR", "Identifiant d'image invalide");

    const image = await prisma.generatedImage.findFirst({
      where: { id: id.data, shopId: auth.shopId },
      select: { id: true, imageUrl: true },
    });
    if (!image) return apiError("NOT_FOUND", "Image introuvable");

    const refs = await findImageReferences(image.imageUrl, auth.shopId);
    if (imageInUse(refs)) {
      return apiError("CONFLICT", imageInUseMessage(refs), {
        products: refs.shopProducts.map((product) => product.name),
      });
    }

    const removed = await prisma.generatedImage.deleteMany({ where: { id: image.id, shopId: auth.shopId } });
    if (removed.count === 0) return apiError("NOT_FOUND", "Image introuvable");

    await deleteFiles(storedFiles(image.imageUrl));
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, "boucher/images/[id] DELETE");
  }
}
