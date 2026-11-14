# Ce que les meilleurs projets de notre pile imposent par l'outil

## Sommaire

1. Tableau des projets
2. Idées reprises
3. Ce qu'on ne reprend pas
4. Popularité n'est pas rigueur

Relevé du 2026-11-14 (étoiles, dernier push et licence par l'API GitHub ; fichiers lus sur `main`).
Les fichiers des dépôts AGPL et propriétaires sont lus comme données : idées seulement, aucun texte
ni code repris. Les dépôts MIT, Apache-2.0 et ISC peuvent être adaptés avec attribution
(`sources.md`).

## 1. Tableau des projets

| Projet                                                   | Licence       | Ce que l'outil impose (fichier)                                                                                                                                                                                                                                                                                                                                                                           | Idée reprise ici                                                                                            |
| -------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| cal.diy (ex cal.com), 50 042 ★                           | MIT           | `.github/workflows/check-prisma-migrations.yml` : `prisma migrate diff --exit-code --from-migrations --to-schema-datamodel --shadow-database-url` ; un seul contrôle requis qui agrège les autres (`all-checks.yml`, relevé de l'éclaireur, non relu)                                                                                                                                                     | § 5 n° 5 (dérive des migrations)                                                                            |
| Langfuse, 37 431 ★                                       | MIT (cœur)    | `REVIEW.md` : relire le code « nouveau ou aggravé », ne pas exiger le nettoyage de l'existant ; knip en CI (`pipeline.yml`, job `knip`) ; job `all-ci-passed`                                                                                                                                                                                                                                             | § 4 (règle de relecture du cliquet), § 5 n° 6                                                               |
| Trigger.dev, 16 764 ★                                    | Apache-2.0    | `.github/workflows/code-quality.yml` : formatage, lint, knip bloquants ; garde de migrations qui ne vise que les migrations postérieures à une date pivot fixée dans le script (`migrationSafetyGuard.ts`) ; `.claude/REVIEW.md` : ne pas signaler ce que le linter attrape ; tsconfig de base avec `noUncheckedIndexedAccess`, `noImplicitReturns`, `noFallthroughCasesInSwitch`                         | § 4 (date pivot), § 6, § 5 n° 2                                                                             |
| Formbricks, 13 247 ★                                     | AGPL-3.0 + ee | `apps/web/eslint.config.mjs` : `no-restricted-syntax` en erreur sur `process.env` hors module d'environnement (exemptions : module env, `next.config.mjs`, `instrumentation`, `sentry.*.config.ts`, scripts, tests) ; règles gardées en `warn` avec leur compte écrit en commentaire et promues à zéro (par exemple 1 795 cas dans 386 fichiers) ; `CODING_STANDARDS.md` : l'outil tient la mise en forme | § 4 (compte écrit), § 5 n° 7 — idées seulement                                                              |
| Rallly, 5 358 ★ (fondateur seul)                         | AGPL-3.0      | `CLAUDE.md` et `biome.json` : frontières d'import imposées par le lint, écarts historiques sur une liste d'exceptions qui ne fait que rétrécir ; scripts de structure en CI (`check:structure`, `check:cascades`)                                                                                                                                                                                         | § 4 (liste qui rétrécit), § 5 n° 8 — idées seulement                                                        |
| Inbox Zero, 13 026 ★                                     | AGPL-3.0      | `apps/web/env.ts` (t3-env) ; scripts de garde en CI (imports d'enum, exports d'actions serveur, structure via konsistent)                                                                                                                                                                                                                                                                                 | § 5 n° 7 et 8 — idées seulement                                                                             |
| create-t3-app, 29 237 ★                                  | MIT           | gabarit : `strict` + `noUncheckedIndexedAccess` ; ESLint typé (`projectService`), `no-misused-promises` avec `checksVoidReturn.attributes: false`, `no-unused-vars` avec `^_` (en `warn`), `reportUnusedDisableDirectives` ; `src/env.js` avec `createEnv`                                                                                                                                                | § 5 n° 1 et 3 (réglages ; ici `no-unused-vars` en `error` : un `warn` ne fait échouer ni la CI ni le build) |
| t3-env, 4 025 ★                                          | MIT           | variables validées au démarrage, séparation serveur / client                                                                                                                                                                                                                                                                                                                                              | § 5 n° 7 (option avec dépendance)                                                                           |
| ixartz/Next-js-Boilerplate, 13 094 ★ (Clerk, comme nous) | MIT           | `tsconfig.json` avec `noUncheckedIndexedAccess`, `noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noImplicitOverride` ; `knip.config.ts` ; `src/libs/Env.ts`                                                                                                                                                                                                   | § 5 n° 2 et 6                                                                                               |
| Epic Stack, 5 545 ★                                      | MIT           | `app/utils/env.server.ts` : schéma Zod des variables, vérifié au démarrage, liste explicite des variables publiques ; jobs ESLint, TypeScript, Vitest, Playwright séparés                                                                                                                                                                                                                                 | § 5 n° 7 (Zod sans dépendance)                                                                              |

## 2. Idées reprises

- **L'outil tient la règle, la relecture tient le jugement** : Formbricks, Trigger.dev (liste de ce
  qu'on ne signale pas), Langfuse. Chez nous : § 6 du skill, lu par `klikgo-review` § 7.
- **Cliquet plutôt que bascule** : compte écrit et promotion à zéro (Formbricks), liste qui
  rétrécit (Rallly), date pivot (Trigger.dev), code nouveau ou aggravé (Langfuse). Chez nous : § 4.
- **Gardes écrites en scripts ou tests** (Rallly, Inbox Zero, Trigger.dev) : Klik&Go le fait déjà
  (`order-writers-guard`, `middleware-matcher`, `ui-guards`, `check-prerender.mjs`) ; § 5 n° 8.
- **Dérive des migrations en CI** (cal.diy), une fois l'historique réparé.
- **Module d'environnement unique** et interdiction de `process.env` ailleurs (Formbricks, Inbox
  Zero, t3, Epic Stack, ixartz).
- **knip bloquant** chez Trigger.dev et Langfuse ; ici en rapport d'abord.

## 3. Ce qu'on ne reprend pas

- Mocks de Prisma (Formbricks, tests unitaires) : contraire à `CLAUDE.md` (Tests).
- Interdiction des transactions interactives (Inbox Zero) : Klik&Go en a besoin
  (`transitionOrderInTx`).
- Oxlint, Biome, Lefthook : changer d'outil est une décision du propriétaire et sort du périmètre ;
  les idées passent dans ESLint 8 et husky.
- Le texte et la configuration des dépôts AGPL : le dépôt Klik&Go est public.

## 4. Popularité n'est pas rigueur

Dub (25 168 ★, AGPL) compile avec `strict: false` (seul `strictNullChecks`) et sa CI GitHub n'a pas
de job bloquant de lint ni de typage (Prettier et tests d'API sur la préversion). Inbox Zero et
Langfuse n'ajoutent que `strictNullChecks` à un préréglage ; Rallly coupe `noExplicitAny`. Copier
les mécanismes (cliquets, gardes, contrôles de CI), pas les réglages d'un dépôt parce qu'il est
populaire.
