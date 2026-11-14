#!/usr/bin/env node
/**
 * migration-lint.mjs — relecture automatique (lecture seule) d'un fichier migration.sql PostgreSQL.
 *
 * Usage (depuis la racine du dépôt) :
 *   node .claude/skills/prisma-expert/scripts/migration-lint.mjs prisma/migrations/<dossier>/migration.sql [autres.sql…]
 *   node .claude/skills/prisma-expert/scripts/migration-lint.mjs --all        # tous les dossiers de prisma/migrations
 *
 * Contexte Klik&Go : `npm run build` applique `prisma migrate deploy` AVANT `next build`
 * (scripts/prisma-migrate-prod-only.mjs). La base change donc plusieurs minutes avant le code,
 * et reste changée si le build échoue : toute migration doit laisser fonctionner le code
 * actuellement en production. Chaque fichier est exécuté comme un seul bloc transactionnel
 * (vérifié avec Prisma 6.19.2 : `CREATE INDEX CONCURRENTLY` accompagné d'une autre instruction
 * échoue en 25001, la migration reste marquée en échec et bloque les déploiements suivants).
 *
 * Niveaux : ERREUR = ne pas livrer tel quel ; AVERT = justifier dans la PR ; INFO = à savoir.
 * Code de sortie : 1 s'il y a au moins une ERREUR, 0 sinon. Les règles et leurs sources :
 * references/migrations.md. Ne remplace pas la relecture : le linter ne connaît ni la taille
 * des tables ni le code déployé.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
let files = args.filter((a) => !a.startsWith("--")).map((f) => resolve(f));
if (args.includes("--all")) {
  const dir = resolve("prisma/migrations");
  if (!existsSync(dir)) {
    console.error(`dossier introuvable : ${dir} (lancer depuis la racine du dépôt)`);
    process.exit(2);
  }
  files = readdirSync(dir)
    .map((d) => join(dir, d, "migration.sql"))
    .filter((f) => existsSync(f) && statSync(f).isFile());
}
if (files.length === 0) {
  console.error("usage : migration-lint.mjs <migration.sql…> | --all");
  process.exit(2);
}

/** Découpe en instructions en respectant commentaires, chaînes et blocs $$ … $$. */
function splitStatements(sql) {
  const out = [];
  let cur = "";
  let i = 0;
  while (i < sql.length) {
    const two = sql.slice(i, i + 2);
    if (two === "--") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end;
      continue;
    }
    if (two === "/*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }
    const ch = sql[i];
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === ch && sql[j + 1] === ch) j += 2;
        else if (sql[j] === ch) break;
        else j++;
      }
      cur += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === "$") {
      const tag = sql.slice(i).match(/^\$[A-Za-z_]*\$/);
      if (tag) {
        const end = sql.indexOf(tag[0], i + tag[0].length);
        const stop = end === -1 ? sql.length : end + tag[0].length;
        cur += sql.slice(i, stop);
        i = stop;
        continue;
      }
    }
    if (ch === ";") {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const norm = (s) => s.replace(/\s+/g, " ").trim();
const short = (s) => (norm(s).length > 110 ? `${norm(s).slice(0, 107)}…` : norm(s));
const tableOf = (stmt) => {
  const onIndex = /^CREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(stmt) ? stmt.match(/\bON\s+(?:ONLY\s+)?"?([\w.]+)"?/i) : null;
  const onTable = stmt.match(/\bTABLE\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?(?:ONLY\s+)?"?([\w.]+)"?/i);
  return (onIndex ?? onTable ?? [])[1];
};

function lint(file) {
  const sql = readFileSync(file, "utf8");
  const statements = splitStatements(sql);
  const issues = [];
  const add = (level, rule, stmt, advice) => issues.push({ level, rule, stmt: stmt ? short(stmt) : "", advice });
  const created = new Set(
    statements.map((s) => s.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([\w.]+)"?/i)?.[1]).filter(Boolean)
  );
  const hasConcurrently = statements.some((s) => /\bCONCURRENTLY\b/i.test(s));
  if (hasConcurrently && statements.length > 1) {
    add("ERREUR", "concurrently-seul", null, `le fichier contient ${statements.length} instructions dont une CONCURRENTLY : elle échouera (25001, bloc transactionnel). Une migration = cette seule instruction.`);
  }
  const ddl = statements.filter((s) => /^(ALTER|CREATE|DROP)\b/i.test(s));
  const dml = statements.filter((s) => /^(UPDATE|DELETE|INSERT)\b/i.test(s) || (/^DO\b/i.test(s) && /\b(UPDATE|DELETE\s+FROM|INSERT\s+INTO)\b/i.test(s)));
  if (ddl.length > 0 && dml.length > 0) {
    add("AVERT", "ddl-et-donnees", dml[0], "changement de structure et écriture de données dans la même transaction : les verrous du DDL sont tenus pendant toute la reprise. Séparer en deux migrations ; reprise par lots si la table est grande.");
  }

  for (const s of statements) {
    const t = norm(s);
    const table = tableOf(t);
    const onNewTable = table && created.has(table);

    if (/^CREATE\s+(UNIQUE\s+)?INDEX\b/i.test(t) && !/\bCONCURRENTLY\b/i.test(t) && !onNewTable) {
      add("AVERT", "index-bloquant", s, "CREATE INDEX sans CONCURRENTLY bloque les écritures sur la table pendant la construction. Table existante et non vide : CONCURRENTLY, seul dans son fichier, avec IF NOT EXISTS.");
    }
    if (/^DROP\s+INDEX\b/i.test(t) && !/\bCONCURRENTLY\b/i.test(t)) {
      add("AVERT", "drop-index", s, "vérifier que l'index n'est pas simplement absent de schema.prisma (Prisma supprime ce qu'il ne voit pas). Sinon DROP INDEX CONCURRENTLY, seul dans son fichier.");
    }
    if (/^DROP\s+TABLE\b/i.test(t) || /\bDROP\s+COLUMN\b/i.test(t)) {
      add("ERREUR", "suppression", s, "phase de contraction uniquement : le code en production (version N-1) ne doit plus lire ni écrire cet objet, et la version qui a cessé de l'utiliser doit déjà être déployée. Une colonne renommée dans schema.prisma produit DROP + ADD : perte de données.");
    }
    if (/\bRENAME\s+(COLUMN|TO|CONSTRAINT)\b/i.test(t) && !/^ALTER\s+TYPE\b.*\bRENAME\s+VALUE\b/i.test(t)) {
      add("ERREUR", "renommage", s, "un renommage casse le code N-1 qui tourne pendant et après le build. Ajouter le nouveau nom, écrire dans les deux, reprendre, basculer les lectures, puis supprimer l'ancien (expand / contract). Pour garder le nom SQL : @map.");
    }
    if (/^ALTER\s+TYPE\b.*\bRENAME\s+VALUE\b/i.test(t)) {
      add("ERREUR", "enum-renommage", s, "renommer une valeur d'enum casse le client Prisma N-1 (valeur inconnue à la lecture). Ajouter la nouvelle valeur, migrer les lignes, retirer l'ancienne plus tard.");
    }
    if (/\bALTER\s+COLUMN\b.*\b(SET\s+DATA\s+)?TYPE\b/i.test(t)) {
      add("ERREUR", "changement-de-type", s, "changer le type réécrit en général la table et ses index sous verrou ACCESS EXCLUSIVE (lectures bloquées). Nouvelle colonne + double écriture + reprise + bascule. Aussi : motif généré par Prisma quand on retire une valeur d'enum.");
    }
    if (/\bADD\s+COLUMN\b/i.test(t)) {
      for (const col of t.split(/\bADD\s+COLUMN\b/i).slice(1)) {
        if (/\bNOT\s+NULL\b/i.test(col) && !/\bDEFAULT\b/i.test(col) && !onNewTable) {
          add("ERREUR", "not-null-sans-defaut", `ADD COLUMN ${col}`, "échoue si la table contient des lignes, et le code N-1 n'envoie pas cette colonne. Ajouter nullable ou avec DEFAULT constant ; resserrer plus tard.");
        }
        if (/\bDEFAULT\s+(gen_random_uuid|uuid_generate|random|clock_timestamp|nextval)\b/i.test(col)) {
          add("AVERT", "defaut-volatile", `ADD COLUMN ${col}`, "un DEFAULT volatile réécrit toute la table. Ajouter la colonne sans défaut, poser le défaut ensuite, reprendre par lots.");
        }
      }
    }
    if (/\bSET\s+NOT\s+NULL\b/i.test(t)) {
      add("AVERT", "set-not-null", s, "SET NOT NULL parcourt toute la table sous ACCESS EXCLUSIVE, sauf si une contrainte CHECK (col IS NOT NULL) validée existe déjà. Grande table : CHECK … NOT VALID, VALIDATE CONSTRAINT, SET NOT NULL, puis DROP de la CHECK.");
    }
    if (/\bADD\s+CONSTRAINT\b/i.test(t) && /\b(FOREIGN\s+KEY|CHECK)\b/i.test(t) && !/\bNOT\s+VALID\b/i.test(t) && !onNewTable) {
      add("AVERT", "contrainte-validee", s, "ajouter une FK ou une CHECK valide toutes les lignes sous verrou. Table existante : ADD CONSTRAINT … NOT VALID dans une migration, VALIDATE CONSTRAINT dans la suivante.");
    }
    if (/\bADD\s+CONSTRAINT\b.*\b(UNIQUE|PRIMARY\s+KEY)\b/i.test(t) && !/\bUSING\s+INDEX\b/i.test(t) && !onNewTable) {
      add("AVERT", "unique-bloquant", s, "construit un index unique en bloquant les écritures. CREATE UNIQUE INDEX CONCURRENTLY d'abord, puis ADD CONSTRAINT … USING INDEX.");
    }
    if (/^CREATE\s+TYPE\s+"?\w+_new"?\s+AS\s+ENUM/i.test(t)) {
      add("ERREUR", "enum-retrait", s, "Prisma recrée le type pour retirer une valeur d'enum : ALTER COLUMN … TYPE sur chaque table qui l'utilise. Ne pas retirer de valeur ; cesser de l'écrire suffit.");
    }
    if (/^ALTER\s+TYPE\b.*\bADD\s+VALUE\b/i.test(t) && statements.length > 1) {
      add("INFO", "enum-ajout", s, "une valeur d'enum ajoutée ne peut pas être utilisée dans la même transaction : ne pas l'écrire dans ce fichier. Déployer la migration avant le code qui l'écrit.");
    }
    if (/^(UPDATE|DELETE)\b/i.test(t) && !/\bWHERE\b/i.test(t)) {
      add("ERREUR", "sans-where", s, "UPDATE ou DELETE sans WHERE : toutes les lignes, sous verrou, dans la transaction de migration.");
    }
    if (/^TRUNCATE\b/i.test(t) || /\bCASCADE\b/i.test(t.replace(/ON\s+(DELETE|UPDATE)\s+CASCADE/gi, ""))) {
      add("ERREUR", "destructif", s, "TRUNCATE ou … CASCADE dans une migration de production : à proscrire.");
    }
    if (/^CREATE\s+EXTENSION\b/i.test(t) && !/\bIF\s+NOT\s+EXISTS\b/i.test(t)) {
      add("AVERT", "extension", s, "ajouter IF NOT EXISTS ; vérifier que l'extension est disponible sur l'image Postgres de Railway et sur celle de la CI.");
    }
  }
  return { file, count: statements.length, issues };
}

let errors = 0;
for (const file of files) {
  if (!existsSync(file)) {
    console.error(`fichier introuvable : ${file}`);
    errors++;
    continue;
  }
  const { count, issues } = lint(file);
  const name = file.split("/").slice(-2).join("/");
  if (issues.length === 0) {
    console.log(`OK      ${name}  (${count} instruction${count > 1 ? "s" : ""})`);
    continue;
  }
  console.log(`\n${name}  (${count} instruction${count > 1 ? "s" : ""})`);
  for (const issue of issues) {
    if (issue.level === "ERREUR") errors++;
    console.log(`  ${issue.level.padEnd(6)} [${issue.rule}] ${issue.stmt}`);
    console.log(`         → ${issue.advice}`);
  }
}
console.log(errors > 0 ? `\n${errors} erreur(s).` : "\nAucune erreur bloquante.");
process.exit(errors > 0 ? 1 : 0);
