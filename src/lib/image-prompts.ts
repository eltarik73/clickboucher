// src/lib/image-prompts.ts — Prompt builder for Klik&Go Image Studio
// Used by Mode 1 (pure generation) and Mode 2 (retouch).

export const GEN_PRESETS = [
  "STEAK",
  "COTE",
  "ESCALOPE",
  "MERGUEZ",
  "BROCHETTE",
  "PLATEAU",
  "MARINE",
  "SOUS_VIDE",
  "NONE",
] as const;
export type GenPreset = (typeof GEN_PRESETS)[number];

export const BACKGROUNDS = ["WHITE", "WOOD", "MARBLE", "DARK"] as const;
export type Background = (typeof BACKGROUNDS)[number];

export const ANGLES = ["FRONT", "TOP", "45", "MACRO"] as const;
export type Angle = (typeof ANGLES)[number];

export const RETOUCH_PRESETS = [
  "CLEAN_BACKGROUND",
  "STUDIO_LIGHT",
  "CATALOG_45",
  "APPETIZING",
] as const;
export type RetouchPreset = (typeof RETOUCH_PRESETS)[number];

const PRESET_KEYWORDS: Record<GenPreset, string> = {
  STEAK: "premium raw steak, well-trimmed, juicy, fine marbling",
  COTE: "côte de bœuf prime rib, well-marbled, bone-in, dry-aged",
  ESCALOPE: "thin chicken escalope, tender, pale pink, neatly sliced",
  MERGUEZ: "spicy merguez sausages, lamb and beef, paprika red",
  BROCHETTE: "grilled meat brochettes skewers, colorful vegetables",
  PLATEAU: "mixed butcher meat platter, assorted cuts, elegant arrangement",
  MARINE: "marinated meat cuts, glossy herb marinade, rosemary, garlic",
  SOUS_VIDE: "sous-vide cooked meat, tender, vacuum-sealed style presentation",
  NONE: "",
};

const BACKGROUND_KEYWORDS: Record<Background, string> = {
  WHITE: "clean white studio background, seamless backdrop, bright soft light",
  WOOD: "rustic wooden butcher board background, warm tones",
  MARBLE: "polished marble surface background, elegant premium feel",
  DARK: "moody dark premium background, low-key dramatic lighting",
};

const ANGLE_KEYWORDS: Record<Angle, string> = {
  FRONT: "front view shot, eye-level composition",
  TOP: "overhead top-down flat lay shot",
  "45": "45-degree angle shot, three-quarter perspective",
  MACRO: "macro close-up shot, razor-sharp details of the meat fibers",
};

const BASE_SUFFIX =
  "professional butcher product photography, commercial food photography, studio lighting, sharp focus, 8k, photorealistic, appetizing presentation, halal certified";

// Quick FR → EN keyword mapping (best-effort, no LLM needed)
const FR_EN_MAP: Record<string, string> = {
  "bœuf": "beef",
  "boeuf": "beef",
  "poulet": "chicken",
  "agneau": "lamb",
  "veau": "veal",
  "mouton": "mutton",
  "viande": "meat",
  "côte": "rib",
  "cote": "rib",
  "escalope": "escalope",
  "merguez": "merguez",
  "brochette": "skewer",
  "brochettes": "skewers",
  "steak": "steak",
  "haché": "minced",
  "hache": "minced",
  "tranche": "slice",
  "tranches": "slices",
  "fumé": "smoked",
  "fume": "smoked",
  "mariné": "marinated",
  "marine": "marinated",
  "planche": "wooden board",
  "bois": "wood",
  "marbré": "marbled",
  "marbre": "marbled",
  "halal": "halal",
  "grillé": "grilled",
  "grille": "grilled",
  "frais": "fresh",
  "cru": "raw",
  "cuit": "cooked",
};

function translateFrToEn(input: string): string {
  const tokens = input.toLowerCase().split(/\s+/);
  return tokens
    .map((t) => {
      const stripped = t.replace(/[.,;:!?()"]/g, "");
      return FR_EN_MAP[stripped] ?? stripped;
    })
    .join(" ")
    .trim();
}

export function buildGenPrompt(input: {
  userPrompt: string;
  preset: GenPreset;
  background: Background;
  angle: Angle;
}): string {
  const parts: string[] = [];
  const translated = translateFrToEn(input.userPrompt);
  if (translated) parts.push(translated);
  const presetKw = PRESET_KEYWORDS[input.preset];
  if (presetKw) parts.push(presetKw);
  parts.push(BACKGROUND_KEYWORDS[input.background]);
  parts.push(ANGLE_KEYWORDS[input.angle]);
  parts.push(BASE_SUFFIX);
  return parts.filter(Boolean).join(", ");
}

const RETOUCH_KEYWORDS: Record<RetouchPreset, string> = {
  CLEAN_BACKGROUND:
    "remove background, replace with clean seamless white studio backdrop, preserve the meat exactly",
  STUDIO_LIGHT:
    "enhance lighting with professional studio softbox, warm cinematic tones, preserve meat details",
  CATALOG_45:
    "professional product shot from 45-degree angle, minimal shadow, commercial catalog style, preserve meat",
  APPETIZING:
    "boost saturation and freshness, golden hour lighting, glossy appetizing finish, preserve meat shape",
};

const RETOUCH_SUFFIX =
  "butcher product photography, halal, photorealistic, do not change the meat itself";

export function buildRetouchPrompt(input: {
  preset: RetouchPreset;
  customPrompt?: string;
}): string {
  const parts: string[] = [RETOUCH_KEYWORDS[input.preset]];
  if (input.customPrompt && input.customPrompt.trim().length > 0) {
    parts.push(input.customPrompt.trim());
  }
  parts.push(RETOUCH_SUFFIX);
  return parts.join(", ");
}
