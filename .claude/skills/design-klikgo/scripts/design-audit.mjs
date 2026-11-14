#!/usr/bin/env node
// Audit de dérive du design system Klik&Go. Lecture seule, zéro dépendance, Node >= 18.
//
//   node design-audit.mjs                      rapport complet sur src/
//   node design-audit.mjs --dir="src/app/(client)"   rapport limité à un dossier
//   node design-audit.mjs --json               sortie JSON
//   node design-audit.mjs --check              compare la dette à design-baseline.json, exit 1 si elle augmente
//   node design-audit.mjs --write-baseline     réécrit design-baseline.json (après une réduction de dette validée)
//
// Le script compte des motifs textuels dans les .tsx : c'est un thermomètre, pas un linter.
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : true;
};
const root = resolve(args.find((a) => !a.startsWith("--")) ?? resolve(here, "../../../.."));
const dirArg = opt("dir", "src");
const top = Number(opt("top", 12));
const baselinePath = join(here, "design-baseline.json");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const scanDir = join(root, dirArg);
if (!existsSync(scanDir)) {
  console.error(`Dossier introuvable : ${scanDir}`);
  process.exit(2);
}
const files = walk(scanDir);
const sources = files.map((f) => ({ f: relative(root, f), src: readFileSync(f, "utf8") }));
const all = sources.map((s) => s.src).join("\n");

const count = (re) => (all.match(re) ?? []).length;
const tally = (re, norm = (x) => x) => {
  const m = new Map();
  for (const hit of all.match(re) ?? []) {
    const k = norm(hit);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
const filesWith = (re) => sources.filter((s) => re.test(s.src)).length;

// Frontières d'une classe Tailwind : début, espace, guillemet, backtick ou « : » d'une variante.
const B = "(?<=^|[\\s\"'`:])";
const E = "(?=$|[\\s\"'`/])";
const cls = (body) => new RegExp(`${B}(?:${body})${E}`, "g");
// Même chose mais sans variante devant (ni dark:, ni hover:…) : la classe s'applique au mode clair de base.
const clsBase = (body) => new RegExp(`(?<=^|[\\s"'\`])(?:${body})${E}`, "g");
const COLOR_UTIL = "(?:bg|text|border|ring|from|to|via|fill|stroke|outline|decoration|shadow|divide|accent|caret|placeholder)";

// Analyse par chaîne littérale (une chaîne ≈ une liste de classes d'un même élément).
const strRe = /(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1/g;
let weakSolid = 0;
let brandTextNoDark = 0;
const WEAK_BG = /^bg-(?:(?:emerald|green|teal|amber|orange|yellow|lime|sky|cyan)-(?:400|500|600)|(?:blue|red|purple|indigo|pink|rose)-(?:400|500)|\[#(?:ef4444|f59e0b|16a34a|10b981|22c55e)\])$/i;
for (const { src } of sources) {
  let m;
  strRe.lastIndex = 0;
  while ((m = strRe.exec(src))) {
    const s = m[2];
    if (!s.includes("text-")) continue;
    const toks = s.split(/\s+/);
    if (toks.includes("text-white") && toks.some((t) => WEAK_BG.test(t))) weakSolid++;
    if (toks.some((t) => /^text-\[#dc2626\]$/i.test(t)) && !toks.some((t) => /^dark:text-/.test(t))) brandTextNoDark++;
  }
}

// Petits carrés (w-7 h-7 … w-9 h-9, soit 28 à 36 px). Seuls ceux portés par un élément
// cliquable sont des cibles tactiles trop petites ; les autres sont des pastilles d'icône,
// des avatars ou des spinners. L'élément porteur est la dernière balise ouverte avant la classe.
let smallSquares = 0;
let smallSquaresInteractive = 0;
for (const { src } of sources) {
  const re = /\b[wh]-(7|8|9) [wh]-\1\b/g;
  let m;
  while ((m = re.exec(src))) {
    smallSquares++;
    const lt = src.lastIndexOf("<", m.index);
    const tag = lt >= 0 ? (src.slice(lt, lt + 40).match(/^<([A-Za-z.]+)/) ?? [])[1] : undefined;
    if (tag && /^(?:button|a|Link|Button)$/.test(tag)) smallSquaresInteractive++;
  }
}

const report = {
  scope: dirArg,
  files: files.length,
  lines: all.split("\n").length,

  rougePrimaire: {
    "token (bg|text|border|ring…)-primary": count(cls(`${COLOR_UTIL}-primary(?:-foreground)?(?:/\\d+)?`)),
    "arbitraire [#DC2626]": count(/\[#dc2626\]/gi),
    "palette red-600": count(cls(`${COLOR_UTIL}-red-600(?:/\\d+)?`)),
    "palette red-500": count(cls(`${COLOR_UTIL}-red-500(?:/\\d+)?`)),
    "hover [#b91c1c]": count(/\[#b91c1c\]/gi),
    "text-[#DC2626] sans variante dark:text-*": brandTextNoDark,
  },

  tokensSemantiques: Object.fromEntries(
    ["background", "foreground", "card", "card-foreground", "popover", "muted", "muted-foreground", "secondary", "accent", "destructive", "success", "warning", "border", "input", "ring"].map((t) => [
      t,
      count(cls(`${COLOR_UTIL}-${t}(?:/\\d+)?`)),
    ])
  ),

  famillesDeGris: Object.fromEntries(["gray", "stone", "neutral", "zinc", "slate"].map((fam) => [fam, count(new RegExp(`-${fam}-(?:50|[1-9]00|950)\\b`, "g"))])),

  surfacesBrutes: {
    "bg-white": count(cls("bg-white(?:/\\d+)?")),
    "bg-black": count(cls("bg-black(?:/\\d+)?")),
    "bg-[#f8f6f3]": count(/bg-\[#f8f6f3\]/gi),
    "bg-[#0a0a0a]": count(/bg-\[#0a0a0a\]/gi),
    "bg-[#141414]": count(/bg-\[#141414\]/gi),
    "bg-[#1a1a1a]": count(/bg-\[#1a1a1a\]/gi),
    "border-[#ece8e3]": count(/border-\[#ece8e3\]/gi),
  },

  hexArbitraires: {
    occurrences: count(/\[#[0-9a-f]{3,8}\]/gi),
    distincts: tally(/\[#[0-9a-f]{3,8}\]/gi, (x) => x.toLowerCase()).length,
    top: tally(/\[#[0-9a-f]{3,8}\]/gi, (x) => x.toLowerCase()).slice(0, top),
  },

  contraste: {
    "text-white sur aplat trop clair (emerald/green/amber/orange ≤600, blue/red ≤500)": weakSolid,
    "texte gris trop clair sans variante (text-gray-300/400, text-stone-300/400, text-[#999]…) — à vérifier : légitime sur fond sombre": count(
      clsBase("text-(?:gray-400|gray-300|stone-400|stone-300|\\[#999\\]|\\[#ccc\\]|\\[#b5a99a\\])")
    ),
  },

  modeSombre: {
    "variantes dark:": count(/(?<=[\s"'`:])dark:/g),
    "fichiers avec bg-white et aucune variante dark:": sources.filter((s) => /bg-white/.test(s.src) && !/dark:/.test(s.src)).length,
  },

  rayons: {
    detail: tally(cls("rounded(?:-(?:[trbl]|tl|tr|bl|br|[se]|ss|se|es|ee))?(?:-(?:none|sm|md|lg|xl|2xl|3xl|full|\\[[^\\]]+\\]))?"), (x) =>
      x.replace(/^rounded-(?:tl|tr|bl|br|ss|se|es|ee|[trblse])(?=-|$)/, "rounded")
    ).slice(0, 16),
    "pièges (rounded-lg=20px, rounded-md=16px, rounded-sm=12px)": count(cls("rounded(?:-(?:[trbl]|tl|tr|bl|br|[se]|ss|se|es|ee))?-(?:sm|md|lg)")),
    "arbitraires rounded-[…]": count(cls("rounded(?:-(?:[trbl]|tl|tr|bl|br|[se]|ss|se|es|ee))?-\\[[^\\]]+\\]")),
  },

  tailleDeTexte: {
    "échelle Tailwind": tally(cls("text-(?:xs|sm|base|lg|xl|[2-9]xl)")).slice(0, 12),
    "échelle projet": tally(cls("text-(?:hero|title|subtitle|body-lg|body|caption|micro)")),
    "arbitraires (top)": tally(cls("text-\\[\\d+(?:\\.\\d+)?(?:px|rem)\\]")).slice(0, top),
    "arbitraires (occurrences)": count(cls("text-\\[\\d+(?:\\.\\d+)?(?:px|rem)\\]")),
    "sous 12px (text-[4…11px])": count(cls("text-\\[(?:[4-9]|1[01])(?:\\.\\d+)?px\\]")),
  },

  polices: {
    "font-display": count(cls("font-display")),
    "font-serif": count(cls("font-serif")),
    "font-mono": count(cls("font-mono")),
    "font-medium (500 non chargé pour DM Sans : rendu en 400)": count(cls("font-medium")),
    "font-extrabold / font-black": count(cls("font-(?:extrabold|black)")),
    "fontFamily en style inline": count(/fontFamily\s*:/g),
  },

  ombres: tally(cls("shadow(?:-(?:sm|md|lg|xl|2xl|inner|none|soft|card|elevated|glow|\\[[^\\]]+\\]))?"), (x) => (x.startsWith("shadow-[") ? "shadow-[arbitraire]" : x)).slice(0, 12),

  zIndex: tally(cls("-?z-(?:\\d+|auto|\\[[^\\]]+\\])")).slice(0, 16),

  focus: {
    "focus-visible:": count(/focus-visible:/g),
    "focus: (hors focus:outline-none)": count(/(?<=[\s"'`:])focus:(?!outline-none)/g),
    "anneau translucide (ring-[#DC2626], ring-red-*, ring-primary à /10, /20 ou /30 ; presque tous en focus:)": count(/ring-(?:\[#dc2626\]|red-\d{3}|primary)\/(?:10|20|30)\b/gi),
    "fichiers avec outline-none sans anneau ni bordure de remplacement": sources.filter((s) => /outline-none/.test(s.src) && !/ring-|focus-visible:outline|focus:border|focus-visible:border/.test(s.src)).length,
  },

  mouvement: {
    "transition-all": count(cls("transition-all")),
    "transition-colors": count(cls("transition-colors")),
    "transition-transform": count(cls("transition-transform")),
    "motion-reduce: / motion-safe:": count(/motion-(?:reduce|safe):/g),
    "animate-pulse": count(cls("animate-pulse")),
    "animate-spin": count(cls("animate-spin")),
    "active:scale-* / hover:scale-*": count(/(?:active|hover):scale-/g),
  },

  composants: {
    "<Button (ui/button)": count(/<Button[\s>]/g),
    "<button brut": count(/<button[\s>]/g),
    "<Input (ui/input)": count(/<Input[\s>]/g),
    "<input brut": count(/<input[\s>]/g),
    "<select brut": count(/<select[\s>]/g),
    "<textarea brut": count(/<textarea[\s>]/g),
    "<Card": count(/<Card[\s>]/g),
    "<Badge": count(/<Badge[\s>]/g),
    "<Skeleton": count(/<Skeleton[\s>]/g),
    "<Dialog (enveloppe Radix)": count(/<Dialog[\s>]/g),
    "fichiers avec overlay maison (fixed inset-0)": filesWith(/fixed inset-0/),
    "…dont sans role=dialog / aria-modal / Radix": sources.filter((s) => /fixed inset-0/.test(s.src) && !/role="dialog"|aria-modal|DialogPrimitive|components\/ui\/dialog/.test(s.src)).length,
    "window.confirm() / alert()": count(/(?<![\w.])(?:window\.)?(?:confirm|alert)\(/g),
    "appels toast() (sonner)": count(/\btoast(?:\.\w+)?\(/g),
    "style={{ inline": count(/style=\{\{/g),
    "définitions cva(": count(/\bcva\(/g),
  },

  icones: {
    "fichiers important lucide-react": filesWith(/from\s+["']lucide-react["']/),
    "<svg inline": count(/<svg[\s>]/g),
    "emojis dans le source": (all.match(/\p{Extended_Pictographic}/gu) ?? []).length,
  },

  ciblesTactiles: {
    "min-h-[44px] / min-w-[44px] / h-11 / w-11 / size-11": count(/min-[hw]-\[44px\]/g) + count(cls("(?:h|w|size|min-h|min-w)-11")),
    "petits carrés de 28 à 36 px (w-7 h-7, w-8 h-8, w-9 h-9), tous éléments": smallSquares,
    "…dont portés par <button>, <a>, <Link> ou <Button> (cibles trop petites)": smallSquaresInteractive,
  },

  a11y: {
    "aria-label": count(/aria-label/g),
    "aria-invalid": count(/aria-invalid/g),
    "aria-busy": count(/aria-busy/g),
    "aria-live / role=status / role=alert": count(/aria-live|role="status"|role="alert"/g),
    "sr-only": count(cls("sr-only")),
  },

  classesInexistantes: Object.fromEntries(["tap-scale", "no-scrollbar", "scrollbar-hide"].map((c) => [c, count(cls(c))])),
};

// Fond de page prescrit par CLAUDE.md (#f8f6f3 clair, #0a0a0a sombre). Tant que le token
// --background n'est pas aligné (point à arbitrer A14), SKILL.md demande d'écrire la paire
// bg-[#f8f6f3] dark:bg-[#0a0a0a] : ces deux classes sont donc exclues du cliquet, sinon
// toute page neuve le ferait échouer. Elles restent comptées dans le rapport (hexArbitraires).
const toleratedPageBackground = report.surfacesBrutes["bg-[#f8f6f3]"] + report.surfacesBrutes["bg-[#0a0a0a]"];

// Dette suivie par le cliquet (--check) : ces compteurs ne doivent jamais augmenter.
const debt = {
  "hex arbitraires (hors fond de page)": report.hexArbitraires.occurrences - toleratedPageBackground,
  "tailles de texte arbitraires": report.tailleDeTexte["arbitraires (occurrences)"],
  "texte sous 12px": report.tailleDeTexte["sous 12px (text-[4…11px])"],
  "rayons pièges (sm/md/lg)": report.rayons["pièges (rounded-lg=20px, rounded-md=16px, rounded-sm=12px)"],
  "rayons arbitraires": report.rayons["arbitraires rounded-[…]"],
  "text-white sur aplat trop clair": report.contraste["text-white sur aplat trop clair (emerald/green/amber/orange ≤600, blue/red ≤500)"],
  "anneaux translucides": report.focus["anneau translucide (ring-[#DC2626], ring-red-*, ring-primary à /10, /20 ou /30 ; presque tous en focus:)"],
  "overlays maison sans sémantique dialog": report.composants["…dont sans role=dialog / aria-modal / Radix"],
  "confirm()/alert()": report.composants["window.confirm() / alert()"],
  "fontFamily inline": report.polices["fontFamily en style inline"],
  "classes inexistantes": Object.values(report.classesInexistantes).reduce((a, b) => a + b, 0),
  "petits carrés cliquables (28 à 36 px)": smallSquaresInteractive,
};
// Indicateurs d'adoption : on veut les voir monter (information, jamais bloquant).
const adoption = {
  "tokens sémantiques (total)": Object.values(report.tokensSemantiques).reduce((a, b) => a + b, 0) + report.rougePrimaire["token (bg|text|border|ring…)-primary"],
  "<Button": report.composants["<Button (ui/button)"],
  "<button brut": report.composants["<button brut"],
  "focus-visible:": report.focus["focus-visible:"],
  "motion-reduce:/motion-safe:": report.mouvement["motion-reduce: / motion-safe:"],
};

if (opt("write-baseline", false)) {
  if (dirArg !== "src") {
    console.error("--write-baseline s'utilise sans --dir (référence = tout src/).");
    process.exit(2);
  }
  writeFileSync(baselinePath, JSON.stringify({ scope: "src", debt, adoption }, null, 2) + "\n");
  console.log(`Référence écrite : ${baselinePath}`);
  process.exit(0);
}

if (opt("check", false)) {
  if (dirArg !== "src") {
    console.error("--check s'utilise sans --dir (la référence couvre tout src/).");
    process.exit(2);
  }
  if (!existsSync(baselinePath)) {
    console.error(`Référence absente : ${baselinePath} (lancer --write-baseline).`);
    process.exit(2);
  }
  const base = JSON.parse(readFileSync(baselinePath, "utf8"));
  let regressions = 0;
  console.log("Dette (ne doit pas augmenter)        référence → actuel");
  for (const [k, v] of Object.entries(debt)) {
    const b = base.debt?.[k];
    const worse = typeof b === "number" && v > b;
    if (worse) regressions++;
    const delta = typeof b === "number" ? v - b : 0;
    console.log(`${worse ? "REGRESSION" : delta < 0 ? "mieux     " : "ok        "} ${k.padEnd(42)} ${String(b ?? "?").padStart(5)} → ${String(v).padStart(5)}${delta ? ` (${delta > 0 ? "+" : ""}${delta})` : ""}`);
  }
  console.log("\nAdoption (information)");
  for (const [k, v] of Object.entries(adoption)) {
    const b = base.adoption?.[k];
    const delta = typeof b === "number" ? v - b : 0;
    console.log(`           ${k.padEnd(42)} ${String(b ?? "?").padStart(5)} → ${String(v).padStart(5)}${delta ? ` (${delta > 0 ? "+" : ""}${delta})` : ""}`);
  }
  if (regressions) {
    console.log(`\n${regressions} compteur(s) de dette en hausse : corriger le code ajouté, ne pas relever la référence.`);
    process.exit(1);
  }
  console.log("\nAucune régression de dette.");
  process.exit(0);
}

if (opt("json", false)) {
  console.log(JSON.stringify({ ...report, debt, adoption }, null, 2));
} else {
  const print = (label, value, indent = 0) => {
    const pad = "  ".repeat(indent);
    if (Array.isArray(value)) {
      console.log(`${pad}${label}:`);
      for (const [k, v] of value) console.log(`${pad}  ${String(v).padStart(6)}  ${k}`);
    } else if (value && typeof value === "object") {
      console.log(`${pad}${label}:`);
      for (const [k, v] of Object.entries(value)) print(k, v, indent + 1);
    } else {
      console.log(`${pad}${String(value).padStart(6)}  ${label}`);
    }
  };
  for (const [k, v] of Object.entries(report)) print(k, v);
  print("dette (cliquet --check)", debt);
  print("adoption", adoption);
}
