// scripts/images/lib/census.ts — Recensement de toutes les URL d'image enregistrées en base.
//
// Lecture seule. Pour chaque colonne de IMAGE_COLUMNS : les valeurs non nulles, lues par lots sur la
// clé (id), chacune classée par classifyImageUrl, et le nombre de NULL. Les produits et leurs photos
// portent le nom du produit et le slug de la boutique, pour que le propriétaire s'y retrouve.
// Seuls les identifiants de IMAGE_COLUMNS et les fragments constants de PROJECTIONS sont écrits dans
// le SQL ; toute valeur passe en paramètre.
import { Prisma, type PrismaClient } from "@prisma/client";
import { IMAGE_COLUMNS, type ImageColumn } from "@/lib/images/columns";
import { classifyImageUrl, type ImageUrlKind } from "@/lib/images/durable-url";

export interface CensusRow {
  table: string;
  column: string;
  id: string;
  value: string;
  kind: ImageUrlKind;
  /** Boutique propriétaire de la ligne (via le produit pour product_images), ou null. */
  shopId: string | null;
  /** Slug de cette boutique, ou null. */
  shopSlug: string | null;
  /** Nom du produit (produits, photos de produit, catalogue de référence), slug pour shops, sinon null. */
  label: string | null;
}

export interface CensusCount {
  table: string;
  column: string;
  kind: ImageUrlKind | "NULL";
  count: number;
}

export interface CensusReport {
  counts: CensusCount[];
  rows: CensusRow[];
}

/** Ordre d'affichage des catégories : durables d'abord, puis tolérées, puis à réparer, puis NULL. */
export const CENSUS_KIND_ORDER: readonly (ImageUrlKind | "NULL")[] = [
  "BLOB",
  "LOCAL_STATIC",
  "LOCAL_STORE",
  "LEGACY_DISPLAY",
  "FOREIGN_BLOB",
  "EXPIRING",
  "LEGACY_UPLOAD_PATH",
  "DATA",
  "OTHER",
  "NULL",
];

const BATCH_SIZE = 1000;

/** Comment lire la boutique, son slug et le libellé d'une ligne : fragments SQL constants, par table. */
interface Projection {
  shopId: string;
  shopSlug: string;
  label: string;
  joins: string;
}

const NO_SHOP: Omit<Projection, "label"> = { shopId: "NULL", shopSlug: "NULL", joins: "" };
const SHOP_OF_ROW: Omit<Projection, "label"> = {
  shopId: "t.shop_id",
  shopSlug: "s.slug",
  joins: "LEFT JOIN shops s ON s.id = t.shop_id",
};

const PROJECTIONS: Readonly<Record<string, Projection>> = {
  products: { ...SHOP_OF_ROW, label: "t.name" },
  product_images: {
    shopId: "p.shop_id",
    shopSlug: "s.slug",
    label: "p.name",
    joins: "JOIN products p ON p.id = t.product_id LEFT JOIN shops s ON s.id = p.shop_id",
  },
  shops: { shopId: "t.id", shopSlug: "t.slug", label: "t.slug", joins: "" },
  categories: { ...SHOP_OF_ROW, label: "NULL" },
  generated_images: { ...SHOP_OF_ROW, label: "NULL" },
  offers: { ...SHOP_OF_ROW, label: "NULL" },
  campaigns: { ...NO_SHOP, label: "NULL" },
  site_banners: { ...NO_SHOP, label: "NULL" },
  recipes: { ...NO_SHOP, label: "NULL" },
  reference_products: { ...NO_SHOP, label: "t.name" },
  reference_product_images: {
    ...NO_SHOP,
    label: "r.name",
    joins: "JOIN reference_products r ON r.id = t.product_id",
  },
};

/** Identifiant SQL entre guillemets ; refuse tout nom hors [a-z_] (seuls ceux de IMAGE_COLUMNS y passent). */
export function sqlIdentifier(name: string): string {
  if (!/^[a-z_]+$/.test(name))
    throw new Error(`Identifiant SQL inattendu : ${JSON.stringify(name)}`);
  return `"${name}"`;
}

function projectionOf(entry: ImageColumn): Projection {
  const projection = PROJECTIONS[entry.table];
  if (projection === undefined) throw new Error(`Table d'image sans projection : ${entry.table}`);
  return projection;
}

interface RawRow {
  id: string;
  value: string;
  shopId: string | null;
  shopSlug: string | null;
  label: string | null;
}

async function readValues(db: PrismaClient, entry: ImageColumn): Promise<RawRow[]> {
  const p = projectionOf(entry);
  const select = Prisma.raw(
    `SELECT t.id AS "id", t.${sqlIdentifier(entry.column)} AS "value", ${p.shopId} AS "shopId", ` +
      `${p.shopSlug} AS "shopSlug", ${p.label} AS "label" FROM ${sqlIdentifier(entry.table)} t ${p.joins} ` +
      `WHERE t.${sqlIdentifier(entry.column)} IS NOT NULL AND t.id > `
  );
  const rows: RawRow[] = [];
  let after = "";
  for (;;) {
    const batch = await db.$queryRaw<RawRow[]>(
      Prisma.sql`${select}${after} ORDER BY t.id LIMIT ${BATCH_SIZE}`
    );
    rows.push(...batch);
    if (batch.length < BATCH_SIZE) return rows;
    after = batch[batch.length - 1].id;
  }
}

async function countNulls(db: PrismaClient, entry: ImageColumn): Promise<number> {
  const [{ n }] = await db.$queryRaw<Array<{ n: number }>>(
    Prisma.sql`SELECT count(*)::int AS n FROM ${Prisma.raw(sqlIdentifier(entry.table))} WHERE ${Prisma.raw(
      sqlIdentifier(entry.column)
    )} IS NULL`
  );
  return n;
}

export async function runImageCensus(db: PrismaClient): Promise<CensusReport> {
  const counts: CensusCount[] = [];
  const rows: CensusRow[] = [];
  for (const entry of IMAGE_COLUMNS) {
    const [values, nulls] = await Promise.all([readValues(db, entry), countNulls(db, entry)]);
    const byKind = new Map<ImageUrlKind | "NULL", number>();
    for (const raw of values) {
      const kind = classifyImageUrl(raw.value);
      byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
      rows.push({ table: entry.table, column: entry.column, ...raw, kind });
    }
    if (nulls > 0) byKind.set("NULL", nulls);
    for (const kind of CENSUS_KIND_ORDER) {
      const count = byKind.get(kind);
      if (count !== undefined)
        counts.push({ table: entry.table, column: entry.column, kind, count });
    }
  }
  return { counts, rows };
}
