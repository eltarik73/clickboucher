---
name: quality-gates
description: Portes qualité automatiques de Klik&Go et leur resserrement progressif - ce que ESLint, tsc, lint-staged, les tests de garde et la CI vérifient déjà, ce qui manque (any et variables inutilisées tolérés malgré CLAUDE.md, règles ESLint typées, options tsconfig au-delà de strict, code mort, dérive entre migrations et schéma, lectures directes de process.env), comment mesurer sans rien écrire dans le dépôt, comment resserrer par cliquet répertoire par répertoire sans réécriture massive, et quelles décisions reviennent au propriétaire. À charger avant de modifier .eslintrc.json, tsconfig.json, lint-staged, .husky, les hooks Claude ou le workflow CI, d'ajouter un test de garde, ou de mesurer la dette pour l'audit qualité. Pas pour écrire du code typé au quotidien (typescript-patterns), ni pour les tests métier (testing-strategy), ni pour prouver qu'une tâche est terminée (verification-before-done).
when_to_use: Mots-clés - .eslintrc.json, règle ESLint, no-explicit-any, no-unused-vars, lint typé, no-floating-promises, tsconfig, noUncheckedIndexedAccess, noImplicitReturns, knip, code mort, prisma migrate diff, dérive de migration, process.env, t3-env, lint-staged, husky, max-warnings, hook Claude, ci.yml, porte qualité, cliquet, ratchet, dette mesurée.
---

# Portes qualité automatiques — Klik&Go

Ce skill fait passer la pureté du code de la prose à l'outillage : quelles portes existent, ce
qu'elles coûtent quand on les resserre, comment préparer la décision du propriétaire. Une règle
qu'un outil peut vérifier vit dans l'outil ; la prose garde le jugement ; la relecture ne refait
pas ce qu'un outil impose (`klikgo-review` § 7, liste au § 6).

Précédence : propriétaire > `CLAUDE.md` relu sur disque > `seo-anti-penalty` > skills vérifiés du
programme > ce skill. Un désaccord va dans « Points à arbitrer » et se signale pour
`klikgo-programme/references/contradictions-connues.md` ; il ne se tranche pas dans le code.

## Règles

1. **Mesurer et proposer, pas basculer.** Une porte qui peut bloquer la CI, le build Vercel ou un
   commit, ou qui ajoute une dépendance, est une décision du propriétaire (`klikgo-programme` § 8).
   Sans accord daté dans le brief, le chantier livre mesure, diff proposé et « Points à arbitrer ».
   Pourquoi : `next build` lance ESLint et tsc (§ 2) et `main` déploie ; une règle en erreur sur du
   code sale bloque la production.
2. **Un outil plutôt qu'une phrase** : règle ESLint, option tsconfig ou test de garde ; la prose la
   nomme sans la répéter. Pourquoi : écrite seulement dans `CLAUDE.md`, elle dérive (« Pas de `any`
   sans justification » face à `no-explicit-any: off`), et des agents ignorent des règles écrites
   en prose dans `CLAUDE.md` (ticket public anthropics/claude-code #2544). HumanLayer : « Never send an LLM to do a linter's job. »
3. **Mesurer sans écrire dans le dépôt** (§ 3) : jamais `--fix`, `--write`, cache ni `tsbuildinfo`.
4. **Cliquet, jamais de bascule sur tout `src`** (§ 4). Pourquoi : des milliers d'avertissements
   s'ignorent, et un nettoyage massif mélange structure et comportement.
5. **Chiffres datés seulement dans [references/etat-du-code.md](references/etat-du-code.md)**, avec
   leur commande ; ici, des classes de coût (quasi nul, petit chantier, chantier dédié).
6. **Exception justifiée sur sa ligne** : `// eslint-disable-next-line [règle] -- [raison]`. Sans
   raison : `mineur`. Pour faire passer une porte : interdit (`verification-before-done` § 9).

## 1. Portes en place (relire chaque fichier avant de le citer)

| Porte                        | Où                                                                                                                                    | Angle mort                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `npm run lint` (`next lint`) | `.eslintrc.json` : `next/core-web-vitals`, parseur `@typescript-eslint`, `exhaustive-deps` en `warn`                                  | `no-explicit-any`, `no-unused-vars` coupés ; rien de typé ; `tests/`, `scripts/` non lus ; avertissement = sortie 0   |
| `npx tsc --noEmit`           | `tsconfig.json` : `strict` seul ; `include` couvre `src`, `tests`, `prisma`, `scripts`, `.next/types`                                 | options au-delà de `strict`                                                                                           |
| `pre-commit`                 | `.husky/pre-commit` → `lint-staged` : `eslint --fix --max-warnings=0`, `prettier --write` sur les fichiers indexés                    | pas de `tsc`                                                                                                          |
| `commit-msg`                 | `.husky/commit-msg` (`type(portée): sujet`)                                                                                           | —                                                                                                                     |
| Gardes (`npm run test`)      | `tests/lib/order-writers-guard.test.ts`, `src/lib/__tests__/middleware-matcher.test.ts`, `tests/components/ui-guards.test.ts`         | ce qu'aucune garde ne nomme                                                                                           |
| CI                           | `.github/workflows/ci.yml` : `lint`, `typecheck`, `test` (`db push`, unitaires, intégration), `build` + `scripts/check-prerender.mjs` | dérive migrations / schéma, code mort                                                                                 |
| Hooks Claude                 | `.claude/hooks/*.sh`                                                                                                                  | `.claude/settings.json`, seul fichier de réglages suivi (il active le plugin `mattpocock-skills`), n'en branche aucun |

Modèles de garde : `order-writers-guard` (liste fermée, une raison par fichier, `toEqual`) et
`ui-guards` (`UNLABELLED_SWITCH_BASELINE`, plafond qui ne peut que baisser).

## 2. Effets de bord à connaître avant tout changement

- **Le build Vercel lint.** `next build` lance ESLint sur `ESLINT_DEFAULT_DIRS`
  (`node_modules/next/dist/lib/constants.js`), puis tsc ; `next.config.mjs` n'a ni
  `eslint.ignoreDuringBuilds` ni `typescript.ignoreBuildErrors`. Erreur → « Failed to compile ».
- **Un `warn` bloque le commit** : `--max-warnings=0` sur chaque fichier indexé, `tests/` et
  `scripts/` compris, même pour une ligne sans rapport. Mais il ne bloque ni la CI ni le build.
- **`--fix` au commit** : une règle corrigible ajoutée réécrit les fichiers indexés dans un commit
  de fonctionnalité. Corriger d'abord dans une couche mécanique à part (`simplicity-refactoring` § 6).
- **Règles typées partout** : `next build`, `npm run lint` et chaque commit construisent les types
  (coût : etat-du-code § 2).
- **Option tsconfig = toute la base** : tests, seeds Prisma, scripts, et le build Vercel.
- **Préréglages `strict*` hors semver** (typescript-eslint) : avec `^8.59.1`, une mineure ajoute des
  erreurs. Défaut : règles une par une ; un préréglage impose une version exacte.

## 3. Mesurer sans écrire dans le dépôt

Lancer depuis la racine `node ${CLAUDE_SKILL_DIR}/scripts/mesurer-portes.mjs [dossier de travail hors
dépôt]` (plusieurs minutes ; `--only=eslint`, `type` ou `tsc`). Il écrit configurations d'essai,
rapports et `resume.txt` dans ce dossier, compte par règle et par zone, note `HEAD` et l'état de
l'arbre, refuse un dossier dans le dépôt, sort en 2 s'il n'a pas pu mesurer. Une règle isolée :
gabarits de [references/mesures.md](references/mesures.md) (configuration qui étend `.eslintrc.json`
par chemin absolu, `--no-eslintrc -c` ; tsconfig qui étend le dépôt, `incremental: false`). Reporter
date, `HEAD`, commande et comptes dans `etat-du-code.md` avant de citer un chiffre.

## 4. Cliquet

ESLint 8.57 n'a pas de suppressions en masse (ESLint 9.24 ; § 5 n° 10). En attendant :

- **Par répertoire** (défaut) : `overrides` dans `.eslintrc.json`, règle en `error` dans les zones
  propres, commentaire daté (ESLint accepte les commentaires dans ce fichier). Options du parseur
  typé dans l'override : seule la zone paie les types (mesures.md § 5). Hors zone, pas de `warn` sur
  de gros fichiers fautifs (chaque commit qui les touche bloquerait) : la règle reste dans une
  configuration de rapport, comptée en CI, jusqu'au nettoyage de la zone suivante.
- **Par liste** (`process.env`, barrels) : test de garde dans `tests/lib/`, fichiers tolérés avec
  leur raison, comparés par `toEqual`. Un simple compte laisserait une violation nouvelle remplacer
  une violation corrigée.
- **tsc** : un tsconfig de zone fuit, tsc vérifie les fichiers importés (etat-du-code § 6). Cliquet :
  `tsconfig.check.json` sur tout le projet en CI, erreurs comparées fichier par fichier à une base
  commitée qui ne peut que baisser (mesures.md § 6).
- **En relecture** : aucun fichier touché ne gagne de violation d'une règle candidate.

Modèles (Formbricks, Rallly, Trigger.dev, Langfuse) : [references/projets-de-reference.md](references/projets-de-reference.md).

## 5. Ordre proposé (comptes : etat-du-code.md)

1. **Quasi nul** : `no-explicit-any` en `error` (cas corrigé ou justifié) ; `no-unused-vars` en
   `error`, motifs `^_` pour arguments, variables et `catch` ; `reportUnusedDisableDirectives` ;
   `no-console` avec `allow: ["warn", "error"]` sur `src` (tient « Pas de console.log en
   production » ; `scripts/` en a légitimement).
2. **tsconfig** : `noFallthroughCasesInSwitch`, `noImplicitReturns`, `noImplicitOverride`,
   `noUnusedParameters` tout de suite ; `noUnusedLocals` en petit chantier ;
   `exactOptionalPropertyTypes` et `noUncheckedIndexedAccess` en chantiers dédiés (cliquet tsc).
3. **Lint typé** (`projectService`), règles à fort signal d'abord : `no-floating-promises`,
   `no-misused-promises` (`checksVoidReturn.attributes` : décision partagée avec `react-patterns`),
   `switch-exhaustiveness-check` (options par défaut), `await-thenable`, `only-throw-error`.
   `no-unsafe-*` en rapport ; style en dernier ou jamais. Zones : `src/lib/services/orders`,
   `src/lib/auth`, `src/lib/pricing` (un seul cas : le `switch` de `discount.ts`), puis `src/lib`,
   `src/app/api`, `src/components`, les pages en dernier.
4. **`complexity`, `max-depth`, `max-lines`** : rapport, pas porte (`simplicity-refactoring` § 5).
5. **Dérive migrations / schéma** : `prisma migrate diff --from-migrations prisma/migrations
--to-schema-datamodel prisma/schema.prisma --shadow-database-url [base jetable] --exit-code`
   (0 aligné, 2 écart, 1 erreur ; modèle cal.diy). L'historique ne se rejoue pas aujourd'hui : la
   porte attend la réparation `prisma-expert` A1 (`prisma-expert/references/migrations.md` § 7).
6. **knip** (fichiers, exports, dépendances morts) : nouvelle dépendance ; rapport
   (`--no-exit-code`) ; faux positifs réglés dans sa configuration, jamais par désactivation.
7. **Module d'environnement** (Zod, déjà là ; t3-env = dépendance), puis `process.env` interdit
   ailleurs (`no-restricted-syntax`, cliquet par liste). Aucun défaut ne masque une variable de
   production absente, sauf le repli `SITE_URL` imposé par `CLAUDE.md` (SEO), centralisé ;
   `NEXT_PUBLIC_*` figées au build ; mode test côté serveur seulement (`clerk-auth` § 6).
8. **Gardes en plus**, modèle `order-writers-guard` : `process.env` hors module (après 7), barrels
   `index.ts`, frontières d'import (définies par `architecture-conventions` § 3), fabriques de route
   (`api-route-conventions`, `audit-routes.mjs --strict`).
9. **Hook Claude** (Stop ou PreToolUse) : tsc et ESLint sur les fichiers touchés, ou branchement de
   `pre-git-typecheck.sh` (exige `jq`). Pas `stop.sh` : il appelle l'API GitHub, c'est un affichage.
10. **ESLint 9, configuration plate, suppressions en masse** : `eslint-config-next` 14.2 n'accepte
    qu'ESLint 7 ou 8 ; il faut Next 15 (version majeure) ou sortir de `next lint`. Chantier à part.

## 6. Ce que la relecture ne refait pas (lu par `klikgo-review` § 7)

Tenu par un outil : mise en forme des fichiers indexés (Prettier) ; message de commit ; règles de
`next/core-web-vitals` (hooks React, `@next/next/*`) ; types sous `strict` ; écrivains de `orders`,
matcher du middleware, primitives UI (gardes) ; pages publiques prérendues (`check-prerender.mjs`).

Pas encore outillé, donc relu : `any` sans justification, variables inutilisées, promesses
flottantes, `switch` non exhaustif, `console.*`, `process.env` hors module, code mort, dérive des
migrations, fichiers non indexés mal formatés. Chaque porte ajoutée déplace sa ligne.

## Pièges

- Règle passée en `error` après un seul commit d'essai : lint-staged ne lit que les fichiers
  indexés ; les autres font échouer la CI et le build après fusion. Mesurer tout `src`, puis
  `npm run build` sur base joignable.
- `reportUnusedDisableDirectives` signale les directives d'une règle coupée : les
  `@next/next/no-img-element` (modales d'images, `OfferPopup`) deviennent « inutiles ».
- `prefer-nullish-coalescing` ne se corrige pas seul : `||` → `??` change le résultat pour 0 et "".
  `revenue || 1` sert de diviseur dans `boucher/dashboard/statistiques/page.tsx`.
- Sortie tsc découpée par `cut -d'('` : les groupes de routes `(boucher)` faussent le compte.
- Comptes d'un autre worktree : un arbre en chantier diffère de `HEAD` (déjà constaté entre deux
  mesures de ce skill, etat-du-code § 9) ; noter `HEAD` et `git status` avec chaque compte.
- `tsconfigRootDir` est littéral dans `.eslintrc.json` : passer en `.eslintrc.cjs` (`__dirname`) ou
  se fier au dossier courant (la racine pour `next lint`, `next build`, lint-staged), à vérifier.
- Règles importées à ne jamais outiller : « pas d'export par défaut » (Google ; `page`, `layout`,
  `route` en exigent), kebab-case partout (bulletproof-react).
- `eslint-plugin-sonarjs` : LGPL, une quinzaine de dépendances dont son `typescript` ; `complexity`
  d'ESLint suffit. Configurations AGPL (Formbricks, Rallly, Inbox Zero, Dub) : l'idée, pas le texte.

## Procédure (chantier de porte, à recopier et cocher)

```
Porte — [nom]
- [ ] Décision du propriétaire datée dans le brief ; sinon : mesure et proposition seulement
- [ ] Mesure avant dans etat-du-code.md : date, HEAD, commande, comptes par zone
- [ ] Nettoyage zone par zone, une couche par règle, mécanique séparée du comportement ;
      caractérisation avant de toucher un code non testé
- [ ] Exceptions : directive sur la ligne, avec sa raison
- [ ] Configuration : overrides de cliquet datés ; version exacte si préréglage
- [ ] Mesure après : zéro dans les zones en erreur, aucun compte en hausse ailleurs
- [ ] npx tsc --noEmit ; npm run lint ; npm run test ; test:integration si la base est touchée ;
      npm run build && node scripts/check-prerender.mjs (base joignable)
- [ ] Commit simulé : npx eslint --max-warnings=0 -- [un fichier touché par zone]
- [ ] § 6 et « Points à arbitrer » à jour
```

Boucle : porte rouge → cause corrigée dans le code (`fix-errors`) → mesure et portes relancées.
Le chantier relève de l'ingénieur plateforme (`.claude/agents/klikgo-ingenieur-plateforme.md`).

## Points à arbitrer (propriétaire)

1. Règles du § 5 n° 1 : quasi nul, sans dépendance ; build rouge tant qu'un cas reste. Et
   réactiver `@next/next/no-img-element` (directives gardées) ou supprimer ces directives.
2. Quatre options tsconfig bon marché : une ligne de `src/middleware.ts` (relire
   `vercel-cost-performance`, garde `middleware-matcher`).
3. `noUnusedLocals` (petit chantier) ; `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`
   (chantiers dédiés, base commitée, script de comparaison à écrire).
4. Lint typé : build Vercel et commits plus lents ; aucune dépendance ; `checksVoidReturn.attributes`.
5. Dérive des migrations : après la réparation de l'historique (`prisma-expert` A1).
6. knip : dépendance de développement (ISC), rapport au début.
7. Module d'environnement : Zod ou t3-env (dépendance) ; build rouge si une variable manque, CI
   comprise (valeurs factices à fournir).
8. Hook Claude suivi (`.claude/settings.json`) : vaut pour toutes les sessions et tous les agents ;
   un tsc complet à chaque déclenchement.
9. ESLint 9 : lié à Next 15 (version majeure, `klikgo-programme` § 8).
10. Pour `contradictions-connues.md` : `CLAUDE.md` (Code quality) interdit `any` sans justification
    et `console.log` en production ; aucun outil ne le vérifie.

## Définition de terminé (chantier de porte)

- [ ] Mesure avant / après dans `etat-du-code.md` (date, `HEAD`, commande).
- [ ] `npm run build` vert sur base joignable ; CI verte.
- [ ] Chaque exception porte sa raison ; aucune porte affaiblie pour passer.
- [ ] Commit simulé passé, un fichier par zone ; § 6 et « Points à arbitrer » à jour.

## Fichiers de référence

- [references/etat-du-code.md](references/etat-du-code.md) — avant de citer un compte ou de
  choisir une zone : comptes par règle et par zone, options tsconfig, échappatoires, temps.
- [references/mesures.md](references/mesures.md) — avant une mesure à la main, une configuration
  de cliquet, une garde par liste, le contrôle de dérive ou un essai de knip.
- [references/projets-de-reference.md](references/projets-de-reference.md) — avant de proposer une
  porte : ce que cal.diy, Langfuse, Trigger.dev, Formbricks, Rallly, Inbox Zero, t3, ixartz et
  Epic Stack imposent, et ce qu'on en reprend.
- [references/sources.md](references/sources.md) — avant de citer ou d'adapter une source.
- Lancer `scripts/mesurer-portes.mjs` (le lire n'est pas nécessaire).
- Voisins : `typescript-patterns`, `react-patterns` (règles imposées), `architecture-conventions`
  § 3, `testing-strategy` § 9, `vercel-cost-performance`, `prisma-expert`,
  `verification-before-done`, `klikgo-review` § 7.
