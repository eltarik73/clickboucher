// @vitest-environment node
//
// Preparation choices of an order line. Before this check the server stored pieceCount, pieceLabel,
// variant and slices as sent: "12 côtelettes" could be printed on the ticket of a 50 g line.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SLICE_OPTIONS,
  checkPreparation,
  parseSliceOptions,
  sliceWeightGrams,
  type PreparationProduct,
} from "@/lib/pricing/preparation";

const CHOPS: PreparationProduct = {
  unit: "KG",
  variants: ["Bien épaisses"],
  weightPerPiece: 80,
  pieceLabel: "côtelettes",
  sliceOptions: null,
};

const VEAL: PreparationProduct = {
  unit: "TRANCHE",
  variants: [],
  weightPerPiece: null,
  pieceLabel: null,
  sliceOptions: {
    defaultSlices: 6,
    minSlices: 2,
    maxSlices: 12,
    thicknesses: ["fine", "epaisse", "inconnue"],
  },
};

describe("checkPreparation", () => {
  it("accepts a line without choices", () => {
    expect(checkPreparation(CHOPS, { weightGrams: 500 })).toEqual({ ok: true, pieceLabel: null });
  });

  it("takes the piece label from the product when the weight is pieces x weight per piece", () => {
    expect(
      checkPreparation(CHOPS, { weightGrams: 480, pieceCount: 6, pieceLabel: "steaks" })
    ).toEqual({
      ok: true,
      pieceLabel: "côtelettes",
    });
  });

  it.each([
    [{ weightGrams: 50, pieceCount: 12 }, "PIECES_WEIGHT_MISMATCH", "pieceCount"],
    [{ weightGrams: 500, variant: "Fines" }, "VARIANT_UNKNOWN", "variant"],
  ] as const)("refuses %j on a product with pieces (%s)", (choice, issue, field) => {
    expect(checkPreparation(CHOPS, choice)).toEqual({ ok: false, issue, field });
  });

  it("refuses pieces on a product without a weight per piece", () => {
    expect(
      checkPreparation({ ...CHOPS, weightPerPiece: null }, { weightGrams: 480, pieceCount: 6 })
    ).toEqual({
      ok: false,
      issue: "PIECES_NOT_OFFERED",
      field: "pieceCount",
    });
  });

  it("accepts slices within the options whose weight is count x grams of one slice", () => {
    expect(
      checkPreparation(VEAL, { weightGrams: 240, sliceCount: 8, sliceThickness: "fine" })
    ).toEqual({
      ok: true,
      pieceLabel: null,
    });
  });

  it.each([
    [
      { weightGrams: 50, sliceCount: 8, sliceThickness: "fine" },
      "SLICES_WEIGHT_MISMATCH",
      "sliceCount",
    ],
    [
      { weightGrams: 120, sliceCount: 8, sliceThickness: "chiffonnade" },
      "SLICES_OUT_OF_RANGE",
      "sliceThickness",
    ],
    [
      { weightGrams: 30, sliceCount: 1, sliceThickness: "fine" },
      "SLICES_OUT_OF_RANGE",
      "sliceCount",
    ],
    [{ weightGrams: 240, sliceCount: 8 }, "SLICES_INCOMPLETE", "sliceThickness"],
    [{ weightGrams: 240, sliceThickness: "fine" }, "SLICES_INCOMPLETE", "sliceCount"],
  ] as const)("refuses %j on a TRANCHE product (%s)", (choice, issue, field) => {
    expect(checkPreparation(VEAL, choice)).toEqual({ ok: false, issue, field });
  });

  it("refuses slices on a product that is not sold in slices", () => {
    expect(
      checkPreparation(CHOPS, { weightGrams: 240, sliceCount: 8, sliceThickness: "fine" })
    ).toEqual({
      ok: false,
      issue: "SLICES_NOT_OFFERED",
      field: "sliceCount",
    });
  });
});

describe("parseSliceOptions", () => {
  it("uses the defaults for a product without options, and for missing or empty fields", () => {
    expect(parseSliceOptions(null)).toEqual(DEFAULT_SLICE_OPTIONS);
    expect(parseSliceOptions({ maxSlices: 30, thicknesses: [] })).toEqual({
      ...DEFAULT_SLICE_OPTIONS,
      maxSlices: 30,
    });
  });

  it("drops unknown thicknesses and throws on a value that is not slice options", () => {
    expect(parseSliceOptions(VEAL.sliceOptions).thicknesses).toEqual(["fine", "epaisse"]);
    expect(() => parseSliceOptions("fine")).toThrow(TypeError);
    expect(() => parseSliceOptions({ minSlices: 1.5 })).toThrow(TypeError);
    expect(() => parseSliceOptions({ thicknesses: [30] })).toThrow(TypeError);
  });

  it("weighs slices with the table of the slice selector", () => {
    expect(sliceWeightGrams(12, "fine")).toBe(360);
    expect(sliceWeightGrams(4, "epaisse")).toBe(240);
  });
});
