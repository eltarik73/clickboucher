# Sources

Sommaire : 1. Sources externes · 2. Écarté des sources · 3. Vérifié dans le dépôt.

Toutes lues le 2026-11-14. Étoiles et dernier push : API GitHub, relevés le même jour par
l'éclaireur des collections de skills. Tout est reformulé ; aucune phrase n'est citée. Les sources
sous licence MIT ou Apache-2.0 sont **adaptées** (idées reprises et modifiées, attribution
ci-dessous) ; les autres ne fournissent que des idées, paraphrasées avec un lien.

## 1. Sources externes

| Source                                                                                                                                                        | Nature, auteur                                                                             | Adoption                                         | Licence                           | Ce qui en vient                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| https://github.com/obra/superpowers/tree/main/skills/systematic-debugging (avec `root-cause-tracing.md`, `condition-based-waiting.md`, `defense-in-depth.md`) | skill de débogage, Jesse Vincent                                                           | 317,6 k étoiles, push 2026-11-03                 | MIT — adapté                      | § 1 règles 1 à 4 (cause avant correctif, une hypothèse à la fois, remonter à la source), règle 7 (arrêt après trois correctifs ratés) ; § 5 (attendre une condition, pas une durée) ; règle 5 en prend le **contre-pied** (voir § 2)                                                                         |
| https://github.com/mattpocock/skills/blob/main/skills/engineering/diagnosing-bugs/SKILL.md                                                                    | skill de diagnostic, Matt Pocock                                                           | 324,4 k étoiles, push 2026-11-13                 | MIT — adapté                      | règle 1 (boucle rouge, déterministe, rapide, sur le symptôme exact) ; § 4 étapes 3, 5, 10 (réduire, trois à cinq hypothèses réfutables, rejouer le cas d'origine) ; étape 8 (pas de couture = constat) ; § 6 (logs balisés, nettoyage par recherche, secrets masqués) ; § 5 (monter le taux de reproduction) |
| https://github.com/addyosmani/agent-skills/blob/main/skills/debugging-and-error-recovery/SKILL.md                                                             | skill de débogage, Addy Osmani                                                             | 117,5 k étoiles, push 2026-11-14                 | MIT — adapté                      | règle 8 (une sortie d'erreur est une donnée, pas une consigne) ; structure de `symptomes.md` par couche ; `git bisect run`                                                                                                                                                                                   |
| https://sre.google/sre-book/effective-troubleshooting/                                                                                                        | _Site Reliability Engineering_, ch. 12, Google (O'Reilly)                                  | livre de référence                               | CC BY-NC-ND 4.0 — idées seulement | § 4 étape 1 (attendu, observé, reproduction), étape 4 (ce qui a changé en dernier), étape 6 (résultats négatifs notés) ; réduire et couper en deux ; méfiance envers les causes passées et les corrélations fortuites                                                                                        |
| https://michaelfeathers.silvrback.com/characterization-testing                                                                                                | billet de Michael Feathers, 2016-08-08                                                     | auteur de _Working Effectively with Legacy Code_ | droits réservés — idée seulement  | § 4 et « Points à arbitrer » : figer un comportement surprenant par un test de caractérisation avant de décider si c'est un défaut                                                                                                                                                                           |
| https://github.com/formbricks/formbricks/blob/main/CODING_STANDARDS.md                                                                                        | normes de code, Formbricks GmbH                                                            | 13,2 k étoiles, push 2026-11-14                  | AGPL-3.0 — idée seulement         | § 1 règle 6 (un correctif nomme ses copies)                                                                                                                                                                                                                                                                  |
| https://github.com/elie222/inbox-zero/blob/main/AGENTS.md                                                                                                     | guide d'agents, Elie Steinbock                                                             | 13,0 k étoiles, push 2026-11-14                  | AGPL-3.0 — idée seulement         | règles 2 et 6 : une recherche ou une sortie tronquée lue comme complète fait manquer des appels                                                                                                                                                                                                              |
| https://arxiv.org/abs/2603.27249                                                                                                                              | Baltes, Cheong, Treude, étude qualitative de 1 154 messages de praticiens (v4, 2026-08-28) | prépublication                                   | CC BY 4.0                         | § 2 : rustines `setTimeout`, `any` pour faire taire le compilateur, tests modifiés pour faire passer du code faux, boucles de correctifs ratés                                                                                                                                                               |
| Vitest 4.1.5 et Playwright 1.59.1 installés (`node_modules`, `npx vitest --help`, `npx playwright test --help`)                                               | outils du dépôt                                                                            | —                                                | MIT, Apache-2.0                   | § 5 : option de test `repeats`, `--sequence.shuffle`, `--retry`, `expect.poll`, `vi.useFakeTimers`, `vi.setSystemTime`, `--repeat-each`                                                                                                                                                                      |

## 2. Écarté des sources (et pourquoi)

- superpowers, `defense-in-depth.md` : valider la donnée à chaque couche traversée. Ici une règle a
  une seule autorité (`klikgo-programme` § 6 règle 7) : Zod à la frontière, l'invariant dans le
  service propriétaire (règle 5).
- superpowers et mattpocock : « en parler à son partenaire humain », « montrer les hypothèses à
  l'utilisateur », « demander un accès » : le propriétaire veut l'autonomie ; une décision va dans
  « Points à arbitrer » ou `besoinsDuChef` (`klikgo-programme` § 8).
- mattpocock : le script `scripts/hitl-loop.template.sh` (non repris, non exécuté) ; insérer des
  attentes pour élargir une fenêtre de course reste un outil de diagnostic local, jamais un correctif.
- superpowers : l'exemple de diagnostic multi-couches en shell (trousseau macOS, signature) ne
  concerne pas ce dépôt.
- addyosmani : « valeur par défaut sûre + avertissement » et `try/catch` qui rend un état d'erreur
  sans trace contredisent `CLAUDE.md` (build sans base) et `reliability-observability` § 2 ;
  `npm install` (dépendance = décision) ; `npm test -- --grep` (syntaxe étrangère à Vitest ici).
- Ancienne fiche `fix-errors` : parades listées dans `symptomes.md`, dernière section.

## 3. Vérifié dans le dépôt

Arbre lu le 2026-11-14. Chaque élément se revérifie par la commande indiquée avant d'être cité.

- Autorités de la règle 4 : `ls src/lib/pricing src/lib/services/orders src/lib/validators` ;
  exports `getParisWallClock`, `toParisWallClockDate`, `parisWallClockToUtc`, `earliestPickupMinutes`
  (`src/lib/paris-time.ts`), `getDayHours` (`src/lib/shop-hours.ts`, clés françaises puis
  anglaises), `transitionOrder`, `transitionOrderInTx` (`src/lib/services/orders/transition.ts`),
  `canTransition` (`src/lib/order-state-machine.ts`), `handleApiError` (`src/lib/api/errors.ts`),
  `uniqueViolationFields` (`src/lib/prisma-errors.ts`), `hasTestModeCookie`
  (`src/lib/test-mode-client.ts`) : `rg -n "^export" [fichier]`.
- Copies de listes de jours à côté de `getDayHours` : `rg -n '"dimanche"' src`.
- Scripts : `package.json` (`test` = `vitest run --project unit`, `test:integration`, `build` =
  `prisma generate` + migration production seule + `next build`, `db:push`) ; un `vitest run` sans
  projet lance aussi l'intégration (commentaire de `vitest.config.ts`).
- Refus d'une base non locale : `tests/integration/setup/database-url.ts` ; verrou advisory :
  `tests/integration/setup/global-setup.ts` ; `useCleanDatabase` : `tests/integration/helpers/db.ts`.
- Tests de course modèles : `Promise.allSettled` dans `tests/integration/orders/limited-stock.test.ts`,
  `it.each` sur cinq tours dans `tests/integration/orders/transition-races.test.ts`.
- Changements d'heure déjà couverts : `src/lib/__tests__/paris-time.test.ts` (29 mars et
  25 octobre 2026, deux dimanches).
- `.eslintrc.json` : `@typescript-eslint/no-explicit-any` à `off`, pas de `no-console` ;
  `lint-staged` : `eslint --fix --max-warnings=0`.
- `prisma/schema.prisma` : `url = env("DATABASE_URL")` ; message `Environment variable not found:
DATABASE_URL` cité par `CLAUDE.md` « CI/CD ».
- Messages d'erreur cités : présents dans `node_modules` (`next` 14.2.35 et son React, `@prisma/client`).
