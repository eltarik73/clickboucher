// src/lib/conversion-config.ts
// Table de conversion produits → portions / pièces
// Facilement éditable : ajouter une entrée = ajouter une catégorie

export type UnitType = "g" | "kg" | "piece";
export type ConversionProfile = "standard" | "gourmand" | "enfant";

export interface ConversionRule {
  category: string;
  label: string;
  portionParPersonne: Record<ConversionProfile, number>;
  poidsMoyenPieceG: number | null;
  nomPiece: { singulier: string; pluriel: string } | null;
  uniteDefaut: UnitType;
  pasG: number;
  minG: number;
  maxG: number;
  presetsG: number[];
}

export const CONVERSION_RULES: Record<string, ConversionRule> = {
  viande_hachee: {
    category: "viande_hachee", label: "Viande hachée",
    portionParPersonne: { standard: 150, gourmand: 200, enfant: 100 },
    poidsMoyenPieceG: null, nomPiece: null,
    uniteDefaut: "g", pasG: 50, minG: 100, maxG: 5000,
    presetsG: [250, 500, 1000],
  },
  merguez: {
    category: "merguez", label: "Merguez",
    portionParPersonne: { standard: 150, gourmand: 200, enfant: 100 },
    poidsMoyenPieceG: 60,
    nomPiece: { singulier: "merguez", pluriel: "merguez" },
    uniteDefaut: "g", pasG: 50, minG: 100, maxG: 5000,
    presetsG: [250, 500, 1000],
  },
  saucisse: {
    category: "saucisse", label: "Saucisse",
    portionParPersonne: { standard: 150, gourmand: 200, enfant: 100 },
    poidsMoyenPieceG: 100,
    nomPiece: { singulier: "saucisse", pluriel: "saucisses" },
    uniteDefaut: "g", pasG: 50, minG: 100, maxG: 5000,
    presetsG: [250, 500, 1000],
  },
  chipolata: {
    category: "chipolata", label: "Chipolata",
    portionParPersonne: { standard: 150, gourmand: 200, enfant: 100 },
    poidsMoyenPieceG: 50,
    nomPiece: { singulier: "chipolata", pluriel: "chipolatas" },
    uniteDefaut: "g", pasG: 50, minG: 100, maxG: 5000,
    presetsG: [250, 500, 1000],
  },
  entrecote: {
    category: "entrecote", label: "Entrecôte",
    portionParPersonne: { standard: 250, gourmand: 350, enfant: 150 },
    poidsMoyenPieceG: 300,
    nomPiece: { singulier: "entrecôte", pluriel: "entrecôtes" },
    uniteDefaut: "piece", pasG: 300, minG: 300, maxG: 6000,
    presetsG: [300, 600, 900],
  },
  cote_agneau: {
    category: "cote_agneau", label: "Côtes d'agneau",
    portionParPersonne: { standard: 200, gourmand: 300, enfant: 150 },
    poidsMoyenPieceG: 80,
    nomPiece: { singulier: "côte", pluriel: "côtes" },
    uniteDefaut: "piece", pasG: 80, minG: 80, maxG: 4000,
    presetsG: [240, 480, 800],
  },
  steak: {
    category: "steak", label: "Steak",
    portionParPersonne: { standard: 200, gourmand: 300, enfant: 120 },
    poidsMoyenPieceG: 200,
    nomPiece: { singulier: "steak", pluriel: "steaks" },
    uniteDefaut: "piece", pasG: 200, minG: 200, maxG: 4000,
    presetsG: [200, 400, 600],
  },
  brochette: {
    category: "brochette", label: "Brochette",
    portionParPersonne: { standard: 200, gourmand: 300, enfant: 120 },
    poidsMoyenPieceG: 120,
    nomPiece: { singulier: "brochette", pluriel: "brochettes" },
    uniteDefaut: "piece", pasG: 120, minG: 120, maxG: 3600,
    presetsG: [360, 600, 1200],
  },
  poulet_entier: {
    category: "poulet_entier", label: "Poulet entier",
    portionParPersonne: { standard: 350, gourmand: 450, enfant: 200 },
    poidsMoyenPieceG: 1500,
    nomPiece: { singulier: "poulet", pluriel: "poulets" },
    uniteDefaut: "piece", pasG: 1500, minG: 1500, maxG: 6000,
    presetsG: [1500, 3000],
  },
  cuisse_poulet: {
    category: "cuisse_poulet", label: "Cuisses de poulet",
    portionParPersonne: { standard: 250, gourmand: 350, enfant: 150 },
    poidsMoyenPieceG: 250,
    nomPiece: { singulier: "cuisse", pluriel: "cuisses" },
    uniteDefaut: "piece", pasG: 250, minG: 250, maxG: 5000,
    presetsG: [500, 1000, 1500],
  },
  escalope: {
    category: "escalope", label: "Escalope",
    portionParPersonne: { standard: 150, gourmand: 200, enfant: 100 },
    poidsMoyenPieceG: 150,
    nomPiece: { singulier: "escalope", pluriel: "escalopes" },
    uniteDefaut: "piece", pasG: 150, minG: 150, maxG: 3000,
    presetsG: [150, 300, 450],
  },
  _default: {
    category: "_default", label: "Viande",
    portionParPersonne: { standard: 150, gourmand: 200, enfant: 100 },
    poidsMoyenPieceG: null, nomPiece: null,
    uniteDefaut: "g", pasG: 50, minG: 100, maxG: 5000,
    presetsG: [250, 500, 1000],
  },
};

export function getConversionRule(category: string): ConversionRule {
  return CONVERSION_RULES[category] ?? CONVERSION_RULES._default;
}
