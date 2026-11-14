// src/lib/pricing/preparation.ts — the preparation choices of an order line (variant, pieces,
// slices) checked against the product and against the weight that is priced.
//
// The kitchen card and the ticket print these choices as facts ("12 côtelettes", "8 tranches
// fines"): they must describe the weight the customer pays for. Pieces weigh pieceCount x
// product.weightPerPiece; slices weigh sliceCount x the weight of one slice of that thickness
// (SLICE_GRAMS, the table the slice selector uses too).
//
// Pure and client-safe: no database, no clock, no I/O.
import type { SaleUnit } from "./line";

/** Grams of one slice, by thickness. */
export const SLICE_GRAMS = {
  chiffonnade: 15,
  fine: 30,
  moyenne: 50,
  normale: 50,
  epaisse: 60,
} as const;

export type SliceThickness = keyof typeof SLICE_GRAMS;

export function isSliceThickness(value: string): value is SliceThickness {
  return Object.prototype.hasOwnProperty.call(SLICE_GRAMS, value);
}

export interface SliceOptions {
  defaultSlices: number;
  minSlices: number;
  maxSlices: number;
  thicknesses: SliceThickness[];
}

/** Options of a TRANCHE product whose butcher set none. */
export const DEFAULT_SLICE_OPTIONS: SliceOptions = {
  defaultSlices: 6,
  minSlices: 1,
  maxSlices: 20,
  thicknesses: ["chiffonnade", "fine", "moyenne"],
};

/** A stored count: absent (undefined or null) or a positive integer; anything else is malformed. */
function storedCount(value: unknown): number | undefined | "malformed" {
  if (value === undefined || value === null) return undefined;
  return Number.isInteger(value) && (value as number) >= 1 ? (value as number) : "malformed";
}

/**
 * Product.sliceOptions as stored (JSON written by the product form). null or undefined => the
 * defaults; a missing or empty field => its default; unknown thicknesses are dropped. Throws
 * TypeError on a value that is not slice options.
 */
export function parseSliceOptions(raw: unknown): SliceOptions {
  if (raw === null || raw === undefined) return DEFAULT_SLICE_OPTIONS;
  const malformed = () => new TypeError(`Invalid slice options: ${JSON.stringify(raw)}`);
  if (typeof raw !== "object" || Array.isArray(raw)) throw malformed();
  const stored = raw as Record<string, unknown>;
  const defaultSlices = storedCount(stored.defaultSlices);
  const minSlices = storedCount(stored.minSlices);
  const maxSlices = storedCount(stored.maxSlices);
  const rawThicknesses = stored.thicknesses ?? [];
  if (
    defaultSlices === "malformed" ||
    minSlices === "malformed" ||
    maxSlices === "malformed" ||
    !Array.isArray(rawThicknesses) ||
    rawThicknesses.some((thickness) => typeof thickness !== "string")
  ) {
    throw malformed();
  }
  const thicknesses = (rawThicknesses as string[]).filter(isSliceThickness);
  return {
    defaultSlices: defaultSlices ?? DEFAULT_SLICE_OPTIONS.defaultSlices,
    minSlices: minSlices ?? DEFAULT_SLICE_OPTIONS.minSlices,
    maxSlices: maxSlices ?? DEFAULT_SLICE_OPTIONS.maxSlices,
    thicknesses: thicknesses.length > 0 ? thicknesses : DEFAULT_SLICE_OPTIONS.thicknesses,
  };
}

/** Grams of `count` slices of `thickness`. */
export function sliceWeightGrams(count: number, thickness: SliceThickness): number {
  return count * SLICE_GRAMS[thickness];
}

export interface PreparationProduct {
  unit: SaleUnit;
  variants: readonly string[];
  weightPerPiece: number | null;
  pieceLabel: string | null;
  sliceOptions: unknown;
}

export interface PreparationChoice {
  /** Grams of one portion, as priced. */
  weightGrams?: number | null;
  variant?: string;
  sliceCount?: number;
  sliceThickness?: string;
  pieceCount?: number;
  pieceLabel?: string;
}

export type PreparationIssue =
  | "VARIANT_UNKNOWN"
  | "PIECES_NOT_OFFERED"
  | "PIECES_WEIGHT_MISMATCH"
  | "SLICES_NOT_OFFERED"
  | "SLICES_INCOMPLETE"
  | "SLICES_OUT_OF_RANGE"
  | "SLICES_WEIGHT_MISMATCH";

/** French reason of each refusal, shown beside the line in the cart. */
export const PREPARATION_ISSUE_MESSAGES: Record<PreparationIssue, string> = {
  VARIANT_UNKNOWN: "variante inconnue",
  PIECES_NOT_OFFERED: "ce produit ne se commande pas à la pièce",
  PIECES_WEIGHT_MISMATCH: "le poids ne correspond pas au nombre de pièces",
  SLICES_NOT_OFFERED: "ce produit ne se commande pas en tranches",
  SLICES_INCOMPLETE: "nombre de tranches et épaisseur vont ensemble",
  SLICES_OUT_OF_RANGE: "nombre de tranches ou épaisseur non proposés",
  SLICES_WEIGHT_MISMATCH: "le poids ne correspond pas aux tranches choisies",
};

export type PreparationCheck =
  | { ok: true; pieceLabel: string | null }
  | {
      ok: false;
      issue: PreparationIssue;
      field: "variant" | "pieceCount" | "sliceCount" | "sliceThickness";
    };

/**
 * Whether the choices of a line can be prepared and match the priced weight. The piece label is
 * the product's own, never the browser's.
 * - variant: one of product.variants;
 * - pieceCount: the product has a weight per piece and weightGrams = pieceCount x weightPerPiece
 *   (a piece label alone, without a piece count, is not a choice);
 * - sliceCount and sliceThickness: both or neither, TRANCHE only, within the product's slice
 *   options, and weightGrams = sliceCount x the grams of one slice of that thickness.
 */
export function checkPreparation(
  product: PreparationProduct,
  choice: PreparationChoice
): PreparationCheck {
  if (choice.variant !== undefined && !product.variants.includes(choice.variant)) {
    return { ok: false, issue: "VARIANT_UNKNOWN", field: "variant" };
  }

  let pieceLabel: string | null = null;
  if (choice.pieceCount !== undefined) {
    if (product.weightPerPiece === null || product.weightPerPiece <= 0) {
      return { ok: false, issue: "PIECES_NOT_OFFERED", field: "pieceCount" };
    }
    if (choice.weightGrams !== choice.pieceCount * product.weightPerPiece) {
      return { ok: false, issue: "PIECES_WEIGHT_MISMATCH", field: "pieceCount" };
    }
    pieceLabel = product.pieceLabel;
  }

  const { sliceCount, sliceThickness } = choice;
  if (sliceCount === undefined && sliceThickness === undefined) return { ok: true, pieceLabel };
  if (product.unit !== "TRANCHE")
    return { ok: false, issue: "SLICES_NOT_OFFERED", field: "sliceCount" };
  if (sliceCount === undefined || sliceThickness === undefined) {
    return {
      ok: false,
      issue: "SLICES_INCOMPLETE",
      field: sliceCount === undefined ? "sliceCount" : "sliceThickness",
    };
  }
  const options = parseSliceOptions(product.sliceOptions);
  if (!isSliceThickness(sliceThickness) || !options.thicknesses.includes(sliceThickness)) {
    return { ok: false, issue: "SLICES_OUT_OF_RANGE", field: "sliceThickness" };
  }
  if (sliceCount < options.minSlices || sliceCount > options.maxSlices) {
    return { ok: false, issue: "SLICES_OUT_OF_RANGE", field: "sliceCount" };
  }
  if (choice.weightGrams !== sliceWeightGrams(sliceCount, sliceThickness)) {
    return { ok: false, issue: "SLICES_WEIGHT_MISMATCH", field: "sliceCount" };
  }
  return { ok: true, pieceLabel };
}
