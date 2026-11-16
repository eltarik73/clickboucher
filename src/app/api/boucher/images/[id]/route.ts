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
import { findImageReferences, imageInUse, imageInUseMessage } from "@/lib/images/references";
import { deleteFilesQuietly, getImageStore, storedFilesOf } from "@/lib/images/store";
import prisma from "@/lib/prisma";

const imageIdSchema = z.string().trim().min(1).max(64);

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

    const removed = await prisma.generatedImage.deleteMany({
      where: { id: image.id, shopId: auth.shopId },
    });
    if (removed.count === 0) return apiError("NOT_FOUND", "Image introuvable");

    await deleteFilesQuietly(
      getImageStore(),
      storedFilesOf(image.imageUrl),
      "boucher/images/[id] DELETE"
    );
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, "boucher/images/[id] DELETE");
  }
}
