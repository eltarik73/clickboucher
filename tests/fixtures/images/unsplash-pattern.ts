// Le motif relevé en production le 2026-11-14 (scratchpad photos/prod) : dans 8 boutiques, les 8
// mêmes produits portent encore une photo images.unsplash.com du premier seed (5 photos, dont une
// morte : « Escalope de dinde »). Repris par les tests du recensement et de la réparation ; le
// même motif, en SQL, est dans repair-kit-pattern.sql pour la répétition des scripts.

const unsplash = (photo: string) =>
  `https://images.unsplash.com/${photo}?w=400&h=300&fit=crop&q=75`;

export const UNSPLASH_DEAD_PHOTO = unsplash("photo-1574672280600-4accfa404c11");

/** Nom du produit → URL Unsplash enregistrée en production. */
export const UNSPLASH_PRODUCTS: Readonly<Record<string, string>> = {
  "Côtelettes d'agneau": unsplash("photo-1603048297172-c92544798d5a"),
  "Émincé de poulet": unsplash("photo-1604503468506-a8da13d82791"),
  "Escalope de dinde": UNSPLASH_DEAD_PHOTO,
  "Escalope de poulet": unsplash("photo-1604503468506-a8da13d82791"),
  "Foie de bœuf": unsplash("photo-1551028150-64b9f398f678"),
  "Souris d'agneau": unsplash("photo-1603048297172-c92544798d5a"),
  "Steak de bœuf": unsplash("photo-1607623814075-e51df1bdc82f"),
  "Tripes de bœuf": unsplash("photo-1551028150-64b9f398f678"),
};

export const UNSPLASH_PRODUCT_NAMES: readonly string[] = Object.keys(UNSPLASH_PRODUCTS);
