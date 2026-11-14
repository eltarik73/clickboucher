#!/usr/bin/env node
// WCAG 2.x contrast ratio between a foreground and a background colour. Zero dependency.
//
//   node contrast.mjs <fg> <bg> [--under=<colour behind a translucent bg>] [--ui]
//   node contrast.mjs --tokens [path/to/globals.css]     (checks the Klik&Go token pairs)
//
// Accepted colours: #rgb, #rrggbb, #rrggbbaa, "h s% l%" (shadcn triple), "h s% l% / a",
// hsl(...), rgb(...). Exit code 1 when a pair is under 4.5:1 (or 3:1 with --ui).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export function parse(input) {
  const s = String(input).trim().toLowerCase();
  let m;
  if ((m = s.match(/^#([0-9a-f]{3,8})$/))) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  if ((m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[/,]\s*([\d.]+%?))?\s*\)$/))) {
    return { r: +m[1], g: +m[2], b: +m[3], a: alpha(m[4]) };
  }
  if ((m = s.match(/^(?:hsla?\()?\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:\s*[/,]\s*([\d.]+%?))?\s*\)?$/))) {
    const [h, sat, l] = [+m[1], +m[2] / 100, +m[3] / 100];
    const c = (1 - Math.abs(2 * l - 1)) * sat;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const k = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return { r: (r + k) * 255, g: (g + k) * 255, b: (b + k) * 255, a: alpha(m[4]) };
  }
  throw new Error(`Couleur non reconnue : ${input}`);
}
function alpha(v) {
  if (v == null) return 1;
  return String(v).endsWith("%") ? parseFloat(v) / 100 : parseFloat(v);
}
export const over = (top, under) => ({
  r: top.r * top.a + under.r * (1 - top.a),
  g: top.g * top.a + under.g * (1 - top.a),
  b: top.b * top.a + under.b * (1 - top.a),
  a: 1,
});
const lin = (v) => {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
export const hex = ({ r, g, b }) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

export function check(fgIn, bgIn, underIn = "#ffffff") {
  const bg = over(parse(bgIn), parse(underIn));
  const fg = over(parse(fgIn), bg);
  return { fg: hex(fg), bg: hex(bg), ratio: ratio(fg, bg) };
}
const verdict = (cr) =>
  cr >= 7 ? "AAA" : cr >= 4.5 ? "AA texte" : cr >= 3 ? "AA grand texte / UI seulement" : "ECHEC";

function readTokens(cssPath) {
  const css = readFileSync(cssPath, "utf8");
  const block = (selector) => {
    const out = {};
    const re = new RegExp(`${selector}\\s*\\{([^}]*)\\}`, "g");
    let m;
    while ((m = re.exec(css))) {
      for (const d of m[1].split(";")) {
        const mm = d.match(/--([\w-]+)\s*:\s*(.+)/);
        if (mm) out[mm[1]] = mm[2].trim();
      }
    }
    return out;
  };
  const light = block(":root");
  return { light, dark: { ...light, ...block("\\.dark") } };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
    if (!hit) return undefined;
    return hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : true;
  };
  const positional = args.filter((a) => !a.startsWith("--"));

  if (flag("tokens")) {
    const here = dirname(fileURLToPath(import.meta.url));
    const cssPath = positional[0] ?? resolve(here, "../../../../src/styles/globals.css");
    const { light, dark } = readTokens(cssPath);
    // [label, fg token, bg token, minimum ratio, optional alpha applied to bg]
    // Paires garanties par le design system : le code de sortie en dépend.
    const guaranteed = [
      ["foreground / background", "foreground", "background", 4.5],
      ["card-foreground / card", "card-foreground", "card", 4.5],
      ["muted-foreground / background", "muted-foreground", "background", 4.5],
      ["muted-foreground / card", "muted-foreground", "card", 4.5],
      ["muted-foreground / muted", "muted-foreground", "muted", 4.5],
      ["primary-foreground / primary", "primary-foreground", "primary", 4.5],
      ["secondary-foreground / secondary", "secondary-foreground", "secondary", 4.5],
      ["accent-foreground / accent", "accent-foreground", "accent", 4.5],
      ["destructive-foreground / destructive", "destructive-foreground", "destructive", 4.5],
      ["success-foreground / success", "success-foreground", "success", 4.5],
      ["warning-foreground / warning", "warning-foreground", "warning", 4.5],
      ["ring / background (UI)", "ring", "background", 3],
      ["ring / card (UI)", "ring", "card", 3],
    ];
    // Usages que tokens.md §3 déconseille : affichés pour rappel, sans effet sur le code de sortie.
    const discouraged = [
      ["primary en texte / background", "primary", "background", 4.5],
      ["primary en texte / card", "primary", "card", 4.5],
      ["success en texte / success 10 %", "success", "success", 4.5, 0.1],
      ["warning en texte / warning 10 %", "warning", "warning", 4.5, 0.1],
      ["destructive en texte / destructive 10 %", "destructive", "destructive", 4.5, 0.1],
    ];
    const hasAlpha = (v) => /\//.test(v);
    let failed = 0;
    for (const [mode, t] of [["clair", light], ["sombre", dark]]) {
      console.log(`\n== Mode ${mode} (${cssPath}) ==`);
      for (const [name, v] of Object.entries(t)) {
        if (hasAlpha(v) && /^[\d.]+\s+[\d.]+%\s+[\d.]+%\s*\//.test(v)) {
          failed++;
          console.log(`FAIL  token --${name}: "${v}" contient un alpha : les modificateurs /50 deviennent invalides`);
        }
      }
      const run = (list, counts) => {
        for (const [label, fgT, bgT, min, a] of list) {
          if (!t[fgT] || !t[bgT] || hasAlpha(t[fgT]) || hasAlpha(t[bgT])) continue;
          const bgValue = a ? `${t[bgT]} / ${a}` : t[bgT];
          const under = hex(over(parse(a ? (t.card ?? t.background) : t.background), parse("#ffffff")));
          const r = check(t[fgT], bgValue, under);
          const ok = r.ratio >= min;
          if (!ok && counts) failed++;
          const tag = ok ? "ok  " : counts ? "FAIL" : "info";
          console.log(`${tag} ${r.ratio.toFixed(2).padStart(5)}:1 (min ${min})  ${label.padEnd(40)} ${r.fg} sur ${r.bg}`);
        }
      };
      run(guaranteed, true);
      console.log("  -- usages déconseillés (voir references/tokens.md §3) --");
      run(discouraged, false);
    }
    console.log(failed ? `\n${failed} défaut(s) sur les paires garanties.` : "\nToutes les paires garanties passent.");
    process.exit(failed ? 1 : 0);
  }

  const [fgIn, bgIn] = positional;
  if (!fgIn || !bgIn) {
    console.error(
      'usage: contrast.mjs <fg> <bg> [--under=#fff] [--ui]\n' +
        '       contrast.mjs --tokens [globals.css]\n' +
        '  ex:  contrast.mjs "#DC2626" "#ffffff"\n' +
        '       contrast.mjs "38 92% 50%" "38 92% 50% / 0.1" --under="#ffffff"'
    );
    process.exit(2);
  }
  const r = check(fgIn, bgIn, flag("under") ?? "#ffffff");
  console.log(`${r.fg} sur ${r.bg}  ->  ${r.ratio.toFixed(2)}:1  ${verdict(r.ratio)}`);
  process.exit(r.ratio >= (flag("ui") ? 3 : 4.5) ? 0 : 1);
}
