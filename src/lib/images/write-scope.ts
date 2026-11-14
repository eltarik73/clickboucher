// src/lib/images/write-scope.ts — À qui appartient un fichier de notre magasin, au moment de l'écrire.
//
// Serveur. La règle d'écriture (imageWriteRefusal, durable-url.ts) n'accepte une NOUVELLE URL de
// notre magasin (Blob épinglé, ou /local-images hors production) que si le fichier appartient au
// périmètre de la ligne écrite :
// - enregistré dans le registre generated_images pour la boutique de la ligne ;
// - ou enregistré pour la plateforme (shop_id NULL : envois et visuels de l'équipe Klik&Go) ;
// - ou publié dans le catalogue de référence (photo partagée avec toutes les boutiques).
// Un fichier d'une autre boutique, ou un chemin qui ne correspond à aucun fichier enregistré, est
// donc refusé : une boutique ne peut ni montrer la photo d'une autre, ni l'empêcher de la supprimer.
// Ce module ne fait que lire ; la décision reste dans imageWriteRefusal et planProductImageWrite.
import prisma from "@/lib/prisma";
import { imageWriteRefusal, isStoreImageUrl } from "./durable-url";
import {
  planProductImageWrite,
  requestedImageValues,
  storedImageValues,
  type ProductImageWriteInput,
  type ProductImageWritePlan,
} from "./product-image-write";

/**
 * Parmi `values`, les fichiers de notre magasin qui appartiennent au périmètre `shopId` (null : la
 * plateforme seule). Aucune requête quand aucune valeur n'est un fichier de notre magasin.
 */
export async function storeUrlsInScope(
  values: readonly string[],
  shopId: string | null
): Promise<Set<string>> {
  const candidates = Array.from(new Set(values.filter(isStoreImageUrl)));
  if (candidates.length === 0) return new Set();
  const owners = shopId === null ? [{ shopId: null }] : [{ shopId }, { shopId: null }];
  const [registered, references, referenceImages] = await Promise.all([
    prisma.generatedImage.findMany({
      where: { imageUrl: { in: candidates }, OR: owners },
      select: { imageUrl: true },
    }),
    prisma.referenceProduct.findMany({
      where: { imageUrl: { in: candidates } },
      select: { imageUrl: true },
    }),
    prisma.referenceProductImage.findMany({
      where: { url: { in: candidates } },
      select: { url: true },
    }),
  ]);
  const inScope = new Set<string>(registered.map((row) => row.imageUrl));
  for (const row of references) if (row.imageUrl !== null) inScope.add(row.imageUrl);
  for (const row of referenceImages) inScope.add(row.url);
  return inScope;
}

/** planProductImageWrite pour un produit de la boutique `shopId`, périmètre lu en base. */
export async function planProductImageWriteInShop(
  input: Omit<ProductImageWriteInput, "inScope">,
  shopId: string
): Promise<ProductImageWritePlan> {
  const stored = storedImageValues(input.stored);
  const fresh = requestedImageValues(input).filter((value) => !stored.has(value));
  const inScope = await storeUrlsInScope(fresh, shopId);
  return planProductImageWrite({ ...input, inScope });
}

export const SHOP_IMAGE_FIELDS = ["imageUrl", "bannerUrl"] as const;
export type ShopImageField = (typeof SHOP_IMAGE_FIELDS)[number];
export type ShopImageValues = Partial<Record<ShopImageField, string | null>>;

/**
 * Règle d'écriture des photos d'une boutique (imageUrl, bannerUrl). `shopId` : la boutique modifiée
 * (ses valeurs actuelles ont le droit acquis), null à la création (périmètre : la plateforme seule).
 * Rend le premier champ refusé avec son message, ou null. Aucune requête sans URL demandée.
 */
export async function shopImageRefusal(
  requested: ShopImageValues,
  shopId: string | null
): Promise<{ field: ShopImageField; messageFr: string } | null> {
  const values = SHOP_IMAGE_FIELDS.map((field) => requested[field]).filter(
    (value): value is string => typeof value === "string"
  );
  if (values.length === 0) return null;
  const stored =
    shopId === null
      ? null
      : await prisma.shop.findUnique({
          where: { id: shopId },
          select: { imageUrl: true, bannerUrl: true },
        });
  const storedValues = new Set<string>();
  for (const field of SHOP_IMAGE_FIELDS) {
    const value = stored?.[field];
    if (typeof value === "string") storedValues.add(value);
  }
  const fresh = values.filter((value) => !storedValues.has(value));
  const context = { stored: storedValues, inScope: await storeUrlsInScope(fresh, shopId) };
  for (const field of SHOP_IMAGE_FIELDS) {
    const value = requested[field];
    if (typeof value !== "string") continue;
    const messageFr = imageWriteRefusal(value, context);
    if (messageFr !== null) return { field, messageFr };
  }
  return null;
}
