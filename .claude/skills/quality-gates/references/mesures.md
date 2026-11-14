# Mesurer une porte candidate sans écrire dans le dépôt

## Sommaire

1. Règles de mesure
2. Une règle ESLint
3. Une règle typée
4. Une option tsconfig
5. Simuler un cliquet ESLint
6. Base tsc qui ne peut que baisser
7. Garde par liste fermée
8. Dérive migrations / schéma
9. knip (proposition, jamais exécutée ici)

Le script `scripts/mesurer-portes.mjs` fait les mesures 2 à 4 sur tout le jeu de règles candidates ;
ces gabarits servent pour une règle isolée, une zone ou la préparation d'une configuration.

## 1. Règles de mesure

- Tout fichier produit (configuration d'essai, rapport, journal) va dans un dossier de travail hors
  dépôt : `WORK=[dossier de travail du chantier]`.
- `npx eslint` plutôt que `npm run lint` : `next lint` active le cache dans `.next/cache/eslint`.
- Jamais `--fix`, `--cache`, `--write` ; `tsc` toujours avec `incremental: false` (sinon il écrit un
  `tsbuildinfo`).
- Code de sortie ESLint : 0 rien, 1 signalements (attendu), 2 configuration ou plantage (la mesure
  ne vaut rien). tsc : 0 ou 2 avec erreurs ; une sortie non nulle sans ligne `error TS` est une panne.
- Lire le chemin d'une erreur tsc jusqu'à `(ligne,colonne): error` : les groupes de routes
  `(boucher)`, `(client)` contiennent des parenthèses.
- Noter dans `etat-du-code.md` : date, `git rev-parse --short HEAD`, `git status --short -- src
tests scripts prisma` (vide ou non), commande, comptes.

## 2. Une règle ESLint

```bash
WORK=[dossier de travail hors dépôt]; mkdir -p "$WORK"
cat > "$WORK/essai.eslintrc.json" <<EOF
{
  "root": true,
  "extends": ["$PWD/.eslintrc.json"],
  "rules": { "@typescript-eslint/no-explicit-any": "error" }
}
EOF
```

Puis, dans un second appel :

```bash
npx eslint --no-eslintrc -c "$WORK/essai.eslintrc.json" --resolve-plugins-relative-to "$PWD" \
  --ext .ts,.tsx -f json -o "$WORK/essai.json" src; echo EXIT=$?
node -e 'const d=require(process.argv[1]);const c={};for(const r of d)for(const m of r.messages){const k=m.ruleId??"directive";c[k]=(c[k]??0)+1}console.log(c)' "$WORK/essai.json"
```

`extends` par chemin absolu garde exactement la configuration que voient `next lint`, `next build` et
lint-staged ; la règle d'essai s'ajoute par-dessus. Pour les directives inutiles, ajouter
`"reportUnusedDisableDirectives": true` au même niveau que `rules`.

## 3. Une règle typée

Même gabarit, avec les options du parseur (chemin absolu obligatoire hors du dépôt) :

```json
{
  "root": true,
  "extends": ["[racine absolue]/.eslintrc.json"],
  "parserOptions": { "projectService": true, "tsconfigRootDir": "[racine absolue]" },
  "rules": {
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": [
      "error",
      { "checksVoidReturn": { "attributes": false } }
    ]
  }
}
```

Le rapport JSON garde le `messageId` : `voidReturnAttribute` isole les cas `onClick={async …}`, ce
qui chiffre l'option `attributes` sans relancer.

## 4. Une option tsconfig

```bash
cat > "$WORK/tsconfig-essai.json" <<EOF
{ "extends": "$PWD/tsconfig.json", "compilerOptions": { "incremental": false, "noImplicitReturns": true } }
EOF
```

Puis : `npx tsc -p "$WORK/tsconfig-essai.json" --noEmit > "$WORK/tsc-essai.txt" 2>&1; echo EXIT=$?`
et compter les lignes ` error TS` du fichier. `include` et `paths` du tsconfig étendu restent
résolus depuis le dépôt.

## 5. Simuler un cliquet ESLint

Avant de proposer un diff de `.eslintrc.json`, l'essayer dans une configuration d'essai qui étend le
dépôt et ajoute des `overrides` par zone. Placer les options du parseur typé dans l'override : seuls
les fichiers de la zone paient alors la construction des types.

```json
{
  "root": true,
  "extends": ["[racine absolue]/.eslintrc.json"],
  "overrides": [
    {
      "files": [
        "src/lib/services/orders/**/*.ts",
        "src/lib/auth/**/*.ts",
        "src/lib/pricing/**/*.ts"
      ],
      "parserOptions": { "projectService": true, "tsconfigRootDir": "[racine absolue]" },
      "rules": {
        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/no-misused-promises": "error",
        "@typescript-eslint/switch-exhaustiveness-check": "error",
        "@typescript-eslint/await-thenable": "error",
        "@typescript-eslint/only-throw-error": "error"
      }
    }
  ]
}
```

Vérifier ensuite : zones visées à 0 ; temps du lint de `src` ; un fichier par zone passé à
`npx eslint --max-warnings=0` (ce que fera lint-staged). Dans la configuration réelle, un
commentaire au-dessus de chaque override donne la date de la mesure et renvoie à `etat-du-code.md`.

## 6. Base tsc qui ne peut que baisser

Un tsconfig restreint à une zone vérifie aussi les fichiers importés (etat-du-code § 6) : le cliquet
compare donc des erreurs par fichier sur tout le projet. Schéma à écrire dans le chantier (script
dans `scripts/`, base commitée, étape CI après `typecheck`) :

```js
// Lit la sortie de tsc et rend { fichier: nombre d'erreurs }.
const perFile = (text) =>
  text.split("\n").reduce((acc, line) => {
    const file = /^(.+?)\(\d+,\d+\): error TS\d+:/.exec(line)?.[1];
    if (file) acc[file] = (acc[file] ?? 0) + 1;
    return acc;
  }, {});
// Échec si un fichier dépasse sa base ou apparaît sans y figurer ; rappel d'abaisser la base quand
// un fichier descend (sinon le gain peut être reperdu sans bruit).
const regressions = (now, base) => Object.entries(now).filter(([file, n]) => n > (base[file] ?? 0));
```

## 7. Garde par liste fermée

Pour une règle qui ne se découpe pas en répertoires (`process.env` hors module, barrels), sur le
modèle de `tests/lib/order-writers-guard.test.ts` : liste des fichiers tolérés, chacun avec sa
raison, comparée par `toEqual` au relevé du code.

```ts
// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");

/** Fichiers qui lisent encore process.env directement, avec la raison. La liste ne fait que rétrécir. */
const ENV_READERS: Record<string, string> = {
  "src/lib/env.ts": "module d'environnement validé",
  "src/middleware.ts": "[raison]",
};

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return files(full);
    return /\.tsx?$/.test(e.name) ? [path.relative(ROOT, full).split(path.sep).join("/")] : [];
  });
}

describe("lectures de process.env", () => {
  it("seuls les fichiers listés lisent process.env", () => {
    const readers = files(path.join(ROOT, "src")).filter((f) =>
      /\bprocess\.env\b/.test(readFileSync(path.join(ROOT, f), "utf8"))
    );
    expect(readers.sort()).toEqual(Object.keys(ENV_READERS).sort());
  });
});
```

Limite : la recherche textuelle voit aussi les commentaires et les chaînes ; la garde des écrivains
de commandes les masque avant de chercher (`codeOnly`), à reprendre si un faux positif apparaît.

## 8. Dérive migrations / schéma

Base PostgreSQL jetable seulement : Prisma vide la base fantôme. Image déjà présente sur le poste,
sinon c'est un téléchargement (procédure de base locale : `klikgo-programme/references/recette-locale.md`).

```bash
U="postgresql://[u]:[mdp]@127.0.0.1:[port]/[base jetable]?schema=public"
DATABASE_URL="$U" DIRECT_DATABASE_URL="$U" npx prisma migrate diff \
  --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "$U" --exit-code; echo EXIT=$?
```

0 : historique et schéma alignés ; 2 : écart (la sortie le décrit) ; 1 : erreur (aujourd'hui
`P3006`, etat-du-code § 8). Les deux variables pointent sur la base jetable dans la même commande :
la CLI lit le `datasource` du schéma.

## 9. knip (proposition, jamais exécutée ici)

knip n'est pas installé : l'ajouter est une décision du propriétaire. Tant qu'il n'est pas dans
`devDependencies` à une version exacte, ne pas lancer `npx knip` (npx téléchargerait la dernière
version publiée). Configuration de départ à éprouver dans le chantier qui l'installe, en mode
rapport (`npx knip --no-exit-code`) :

```json
{
  "entry": ["scripts/**/*.{ts,mjs}", "prisma/seed*.ts", "prisma/migrate-product-images.ts"],
  "project": ["src/**/*.{ts,tsx}", "scripts/**/*.{ts,mjs}", "prisma/**/*.ts", "tests/**/*.ts"],
  "ignore": [".claude/**", "skills/**"]
}
```

Le greffon Next de knip ajoute de lui-même les fichiers de convention (`page`, `layout`, `route`,
`error`, `loading`, `not-found`, `middleware`, `instrumentation`, `sitemap`, `robots`,
`opengraph-image`) quand `next` est une dépendance. Chaque faux positif se règle dans cette
configuration, jamais par désactivation de la vérification ; `--include files,exports,dependencies`
limite le rapport par type.
