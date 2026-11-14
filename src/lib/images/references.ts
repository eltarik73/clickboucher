// src/lib/images/references.ts — Une image est-elle encore utilisée quelque part ?
//
// Avant d'effacer un fichier, on cherche son URL (et celle de sa vignette) dans toutes les colonnes
// d'image de la base (IMAGE_COLUMNS), sauf le registre generated_images lui-même. Seuls les noms
// des produits de la boutique qui demande sont renvoyés ; un usage ailleurs (autre boutique,
// bannière, offre, catalogue) n'est compté que par un nombre, sans rien en dire.
import prisma from "@/lib/prisma";
import { IMAGE_COLUMNS } from "./columns";
import { thumbnailOf } from "./thumbnail";

export interface ImageReferences {
  /** Produits de la boutique qui utilisent l'image (20 au plus, par nom). */
  shopProducts: { id: string; name: string }[];
  /** Nombre total de produits de la boutique qui l'utilisent (peut dépasser 20). */
  shopProductCount: number;
  /** Lignes qui l'utilisent hors des produits de la boutique. */
  otherUses: number;
}

const NAMES_SHOWN_IN_LIST = 20;
const NAMES_IN_MESSAGE = 5;
const REGISTRY_TABLE = "generated_images";

/** Une seule requête : la somme, sur chaque colonne d'image, des lignes qui portent l'une des URL. */
function totalUsesQuery(): string {
  const parts = IMAGE_COLUMNS.filter((column) => column.table !== REGISTRY_TABLE).map(
    (column) => `(SELECT count(*)::int FROM "${column.table}" WHERE "${column.column}" = ANY($1::text[]))`
  );
  return `SELECT (${parts.join(" + ")})::int AS n`;
}

export async function findImageReferences(url: string, shopId: string | null): Promise<ImageReferences> {
  const thumb = thumbnailOf(url);
  const candidates = thumb === null ? [url] : [url, thumb];

  const totalRows = prisma.$queryRawUnsafe<Array<{ n: number }>>(totalUsesQuery(), candidates);
  if (shopId === null) {
    const [{ n }] = await totalRows;
    return { shopProducts: [], shopProductCount: 0, otherUses: n };
  }

  const usedBy = {
    shopId,
    OR: [{ imageUrl: { in: candidates } }, { images: { some: { url: { in: candidates } } } }],
  };
  const [[{ n }], shopProducts, shopProductCount, productRows, productImageRows] = await Promise.all([
    totalRows,
    prisma.product.findMany({
      where: usedBy,
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: NAMES_SHOWN_IN_LIST,
    }),
    prisma.product.count({ where: usedBy }),
    prisma.product.count({ where: { shopId, imageUrl: { in: candidates } } }),
    prisma.productImage.count({ where: { url: { in: candidates }, product: { shopId } } }),
  ]);
  return { shopProducts, shopProductCount, otherUses: n - productRows - productImageRows };
}

export function imageInUse(refs: ImageReferences): boolean {
  return refs.shopProductCount > 0 || refs.otherUses > 0;
}

/** Message du refus (409) quand l'image est encore utilisée. */
export function imageInUseMessage(refs: ImageReferences): string {
  if (refs.shopProductCount === 0) {
    return "Cette photo est encore utilisée sur Klik&Go : elle ne peut pas être supprimée.";
  }
  const shown = refs.shopProducts.slice(0, NAMES_IN_MESSAGE).map((product) => product.name);
  const others = refs.shopProductCount - shown.length;
  const list = others > 0 ? `${shown.join(", ")} et ${others} autre${others > 1 ? "s" : ""}` : shown.join(", ");
  const target = refs.shopProductCount > 1 ? "de ces produits" : "de ce produit";
  return `Cette photo est utilisée par : ${list}. Changez la photo ${target} avant de la supprimer.`;
}
