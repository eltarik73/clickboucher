#!/usr/bin/env node
// Ratio de contraste WCAG entre deux couleurs hexadécimales.
// Usage : node contrast.mjs <premier-plan> <arrière-plan> [opacité du premier plan, 0 à 1]
// Exemples :
//   node contrast.mjs '#DC2626' '#f8f6f3'
//   node contrast.mjs '#DC2626' '#ffffff' 0.3   (anneau de focus à 30 % d'opacité)
// Formule : luminance relative et ratio de contraste de WCAG 2.2. Le ratio n'est pas arrondi pour le verdict.

const [, , fgArg, bgArg, alphaArg] = process.argv;

if (!fgArg || !bgArg) {
  console.error("Usage : node contrast.mjs <premier-plan> <arrière-plan> [opacité 0-1]");
  process.exit(2);
}

function parseHex(input) {
  let hex = input.trim().replace(/^#/, "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    console.error(`Couleur invalide : ${input} (attendu #RGB ou #RRGGBB)`);
    process.exit(2);
  }
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function channel(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance([r, g, b]) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function toHex(rgb) {
  return "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
}

const bg = parseHex(bgArg);
let fg = parseHex(fgArg);
const alpha = alphaArg === undefined ? 1 : Number(alphaArg);

if (!(alpha > 0 && alpha <= 1)) {
  console.error("Opacité invalide : attendu un nombre entre 0 (exclu) et 1.");
  process.exit(2);
}
if (alpha < 1) {
  fg = fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha)));
}

const lighter = Math.max(luminance(fg), luminance(bg));
const darker = Math.min(luminance(fg), luminance(bg));
const ratio = (lighter + 0.05) / (darker + 0.05);
const verdict = (min) => (ratio >= min ? "OK" : "ÉCHEC");

console.log(`${toHex(fg)} sur ${toHex(bg)} : ${ratio.toFixed(2)}:1`);
console.log(`  texte normal (4,5:1)                         ${verdict(4.5)}`);
console.log(`  grand texte >= 24 px ou >= 18,5 px gras (3:1) ${verdict(3)}`);
console.log(`  composant, icône, anneau de focus (3:1)      ${verdict(3)}`);
process.exit(ratio >= 4.5 ? 0 : 1);
