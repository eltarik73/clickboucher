// src/lib/estimate.ts

import { type ConversionProfile, getConversionRule } from "./conversion-config";
export type { ConversionProfile };

export interface Estimation {
  personnes: { min: number; max: number; exact: number };
  pieces: { count: number; nom: string } | null;
  profil: ConversionProfile;
}

function smartRound(v: number): { min: number; max: number } {
  if (v <= 0) return { min: 0, max: 0 };
  if (v < 1) return { min: 1, max: 1 };
  const f = Math.floor(v), d = v - f;
  if (d < 0.15) return { min: f, max: f };
  if (d > 0.85) return { min: f + 1, max: f + 1 };
  return { min: f, max: f + 1 };
}

export function computeEstimation(
  quantiteG: number, category: string, profil: ConversionProfile = "standard"
): Estimation {
  const rule = getConversionRule(category);
  const exact = quantiteG / rule.portionParPersonne[profil];
  const personnes = { ...smartRound(exact), exact };
  let pieces: Estimation["pieces"] = null;
  if (rule.poidsMoyenPieceG && rule.nomPiece) {
    const c = Math.max(1, Math.round(quantiteG / rule.poidsMoyenPieceG));
    pieces = { count: c, nom: c <= 1 ? rule.nomPiece.singulier : rule.nomPiece.pluriel };
  }
  return { personnes, pieces, profil };
}

export function formatEstimation(e: Estimation): string {
  const parts: string[] = [];
  if (e.pieces) parts.push(`≈ ${e.pieces.count} ${e.pieces.nom}`);
  const { min, max } = e.personnes;
  if (min === max) parts.push(`≈ ${min} pers.`);
  else parts.push(`≈ ${min}–${max} pers.`);
  return parts.join(" · ");
}

export function formatEstimationShort(e: Estimation): string {
  if (e.pieces) return `≈${e.pieces.count} ${e.pieces.nom}`;
  const { min, max } = e.personnes;
  return min === max ? `≈${min} pers.` : `≈${min}–${max} pers.`;
}

export function computePrice(quantiteG: number, prixAuKg: number): number {
  return Math.round((quantiteG / 1000) * prixAuKg * 100) / 100;
}

export function formatPrice(prix: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(prix);
}

export function formatWeight(g: number): string {
  if (g >= 1000) {
    const kg = g / 1000;
    return kg % 1 === 0 ? `${kg}kg` : `${kg.toFixed(1).replace(".", ",")}kg`;
  }
  return `${g}g`;
}
