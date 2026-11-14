// Inventaire React de src/ — lecture seule, sans réseau, n'écrit rien.
// Depuis la racine du dépôt :
//   node .claude/skills/react-patterns/scripts/etat-react.cjs
//       → useState / effets par fichier et motifs candidats (analyse syntaxique TypeScript)
//   node_modules/.bin/eslint ... -f json | node .claude/skills/react-patterns/scripts/etat-react.cjs --lint
//       → résumé d'un rapport ESLint JSON lu sur l'entrée standard, par règle et par zone
// Les motifs sont des CANDIDATS à relire, pas des défauts prouvés.
"use strict";
const fs = require("fs");
const path = require("path");

const root = process.cwd();

function zone(rel) {
  if (rel.startsWith("src/app/api/")) return "src/app/api";
  if (rel.startsWith("src/app/")) return "src/app (pages)";
  if (rel.startsWith("src/components/")) return "src/components";
  if (rel.startsWith("src/hooks/") || rel.startsWith("src/lib/hooks/")) return "hooks";
  return "src/lib";
}

function lintSummary() {
  const report = JSON.parse(fs.readFileSync(0, "utf8"));
  const counts = new Map();
  const bump = (key, file) => {
    const entry = counts.get(key) ?? { n: 0, files: new Set() };
    entry.n += 1;
    entry.files.add(file);
    counts.set(key, entry);
  };
  for (const result of report) {
    const rel = path.relative(root, result.filePath);
    for (const m of result.messages) {
      if (!m.ruleId) continue;
      let rule = m.ruleId.replace("@typescript-eslint/", "");
      if (rule === "no-misused-promises") rule += /attribute/i.test(m.message) ? " (attribut JSX)" : " (autre)";
      bump(`${rule} | total`, rel);
      bump(`${rule} | ${zone(rel)}`, rel);
    }
  }
  console.log(`fichiers analysés : ${report.length}`);
  for (const key of [...counts.keys()].sort()) {
    const { n, files } = counts.get(key);
    console.log(`${String(n).padStart(5)} messages ${String(files.size).padStart(4)} fichiers  ${key}`);
  }
}

function astScan() {
  const ts = require("typescript");
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== "__tests__" && e.name !== "node_modules") walk(p);
      } else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) files.push(p);
    }
  })(path.join(root, "src"));

  const isClient = (src) => /^(\s*(\/\/[^\n]*|\/\*[\s\S]*?\*\/)\s*)*["']use client["']/.test(src);
  const isRenderFn = (name) => /^(use[A-Z]|[A-Z])/.test(name ?? "");
  const callee = (c) =>
    ts.isIdentifier(c.expression) ? c.expression.text
      : ts.isPropertyAccessExpression(c.expression) ? c.expression.name.text : "";
  const rows = [];
  const onlySetters = [];
  const fetchNoCleanup = [];
  const literalDeps = [];
  const refWrites = [];
  let clientFiles = 0;

  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    const rel = path.relative(root, file);
    const client = isClient(src);
    if (client) clientFiles += 1;
    if (!client && !/\buse(State|Effect|Ref)\(/.test(src)) continue;
    const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kind);
    const at = (n) => `${rel}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
    let states = 0;
    let effects = 0;

    const checkRefWrites = (body) => {
      if (!body || !ts.isBlock(body)) return;
      for (const s of body.statements) {
        const e = ts.isExpressionStatement(s) ? s.expression : null;
        if (e && ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.EqualsToken
          && ts.isPropertyAccessExpression(e.left) && e.left.name.text === "current") refWrites.push(at(s));
      }
    };

    (function visit(n) {
      if (ts.isFunctionDeclaration(n) && isRenderFn(n.name?.text)) checkRefWrites(n.body);
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && isRenderFn(n.name.text) && n.initializer
        && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) checkRefWrites(n.initializer.body);
      if (ts.isCallExpression(n)) {
        const name = callee(n);
        if (name === "useState") states += 1;
        if (name === "useEffect" || name === "useLayoutEffect") {
          effects += 1;
          const [cb, deps] = n.arguments;
          if (cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))) {
            if (ts.isBlock(cb.body)) {
              const stmts = cb.body.statements;
              if (stmts.length > 0 && stmts.every((s) => ts.isExpressionStatement(s)
                && ts.isCallExpression(s.expression) && /^set[A-Z]/.test(callee(s.expression)))) onlySetters.push(at(n));
              let hasFetch = false;
              let hasCleanup = false;
              (function scan(m, nested) {
                if (ts.isCallExpression(m) && callee(m) === "fetch") hasFetch = true;
                if (!nested && ts.isReturnStatement(m) && m.expression) hasCleanup = true;
                ts.forEachChild(m, (k) => scan(k, nested || (ts.isFunctionLike(m) && m !== cb)));
              })(cb.body, false);
              if (hasFetch && !hasCleanup) fetchNoCleanup.push(at(n));
            } else if (ts.isCallExpression(cb.body) && /^set[A-Z]/.test(callee(cb.body))) onlySetters.push(at(n));
          }
          if (deps && ts.isArrayLiteralExpression(deps)
            && deps.elements.some((e) => ts.isObjectLiteralExpression(e) || ts.isArrayLiteralExpression(e))) literalDeps.push(at(n));
        }
      }
      ts.forEachChild(n, visit);
    })(sf);
    rows.push({ rel, states, effects });
  }

  rows.sort((a, b) => b.states + b.effects - (a.states + a.effects));
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  console.log(`fichiers "use client" : ${clientFiles}`);
  console.log(`useState : ${sum("states")} ; useEffect + useLayoutEffect : ${sum("effects")}`);
  console.log(`composants à 8 useState ou plus : ${rows.filter((r) => r.states >= 8).length}`);
  console.log("\nLes 10 fichiers les plus chargés (useState + effets) :");
  for (const r of rows.slice(0, 10)) console.log(`  ${String(r.states).padStart(3)} état ${String(r.effects).padStart(2)} effets  ${r.rel}`);
  const list = (title, items) => {
    console.log(`\n${title} : ${items.length}`);
    for (const i of items) console.log(`  ${i}`);
  };
  list("A. effets qui ne font qu'appeler des setters (état dérivé, remise à zéro, ou lecture après montage légitime)", onlySetters);
  list("B. effets qui appellent fetch sans renvoyer de nettoyage (annulation absente ?)", fetchNoCleanup);
  list("C. littéral objet ou tableau dans un tableau de dépendances", literalDeps);
  list("D. ref.current écrit dans le corps d'un composant ou d'un hook (pendant le rendu)", refWrites);
}

if (process.argv.includes("--lint")) lintSummary();
else astScan();
