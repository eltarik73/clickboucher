# Sources de test-discipline

## Sommaire

1. Règles du projet (font foi)
2. Sources externes : origine, licence, règles dérivées
3. Écarts volontaires avec les sources amont
4. Vérifications faites dans le dépôt

Tout le texte du skill est écrit pour Klik&Go. Aucune phrase n'est recopiée ; les exemples de code
sont neufs, aux formes du dépôt. Étoiles et dates de dernier envoi : relevé de l'API GitHub par
les éclaireurs du programme le 2026-11-14 (non re-mesuré par l'auteur du skill). « Adapté » :
idée reprise et transformée, licence permissive, attribution ici. « Idées seulement » : licence qui
interdit l'adaptation du texte ou licence inconnue ; paraphrase et lien.

## 1. Règles du projet (font foi)

| Source                                                                                    | Règles de ce skill qui en découlent                                                                     |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`, sections « Tests » et « Commandes : quantités, prix, totaux »                | Prisma jamais simulé ; simulations permises ; formule du prix d'une portion ; bornes 1..99 et 1..50 000 |
| `testing-strategy` (§ 2 niveaux, § 3 règles 3, 6, 7, 11, § 7 Playwright, A1, A8, A9, A10) | renvois : niveau d'un test, liste élargie des frontières, temps, rouge une fois, arbitrages             |
| `verification-before-done` § 2 à § 4                                                      | preuve rouge puis vert, lecture de sortie, filtre `-t` sans correspondance                              |
| `architecture-conventions` § 8 et `references/refactoring-incremental.md`                 | caractérisation avant de toucher du code non testé                                                      |
| `security-multitenant` § 7 et § 10                                                        | contenu d'un test d'isolation                                                                           |
| `klikgo-programme` § 5, § 8, § 9 ; `references/passation-et-rapports.md`                  | fichiers possédés, décisions du propriétaire, `besoinsDuChef`, `nonVerifie` ; aucune consigne git ici   |
| `klikgo-review` § 4 passe 8                                                               | gravité `majeur` d'un test supprimé, sauté ou affaibli                                                  |
| `fix-errors` § 5                                                                          | tests instables                                                                                         |

## 2. Sources externes

| Source                                                                                                                                                           | Nature, auteur                                                           | Adoption                                          | Licence                                       | Lu le                                           | Règles dérivées                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------- | --------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| https://github.com/obra/superpowers/tree/main/skills/test-driven-development (`SKILL.md`, `writing-good-tests.md`)                                               | skill TDD, Jesse Vincent                                                 | 317,6 k étoiles, dernier envoi 2026-11-03         | MIT — **adapté**                              | 2026-11-14 (copie brute de l'éclaireur)         | § 1 rouge pour la bonne raison, suite entière ; § 2 nommer la rupture, attendus à la main, pas de détecteur de changement ; § 3 pas d'assertion sur un mock, forme complète, rien de réservé aux tests dans le produit ; § 5 liste des mutations |
| https://github.com/mattpocock/skills/tree/main/skills/engineering (`tdd/tests.md`, `tdd/mocking.md`)                                                             | skills d'ingénierie, Matt Pocock                                         | 324,4 k, 2026-11-13                               | MIT — **adapté**                              | 2026-11-14                                      | § 2 tests tautologiques ; § 3 simuler aux frontières du système seulement                                                                                                                                                                        |
| https://abseil.io/resources/swe-book/html/ch12.html et https://abseil.io/resources/swe-book/html/ch13.html                                                       | _Software Engineering at Google_, chapitres tests unitaires et doublures | livre O'Reilly, en ligne                          | CC BY-NC-ND 4.0 — idées seulement             | 2026-11-14 (notes de l'éclaireur)               | § 2 pas de logique dans un test, lisibilité avant factorisation ; § 3 ordre réel > faux > bouchon > mock, vérifier l'état plutôt que les interactions                                                                                            |
| https://testing-library.com/docs/guiding-principles et https://testing-library.com/docs/queries/about/#priority                                                  | documentation officielle Testing Library                                 | dépôt de docs actif                               | MIT — **adapté**                              | 2026-11-14, ordre des requêtes relu à la source | § 8 `screen`, ordre des requêtes, `getByTestId` en dernier                                                                                                                                                                                       |
| https://kentcdodds.com/blog/common-mistakes-with-react-testing-library (2020-05-04) et https://kentcdodds.com/blog/testing-implementation-details (2020-08-17)   | billets de l'auteur de Testing Library                                   | auteur reconnu                                    | inconnue — idées seulement                    | 2026-11-14 (notes de l'éclaireur)               | § 8 `findBy` plutôt que `waitFor`, aucun effet de bord dans `waitFor`, `queryBy` pour une absence, matchers jest-dom ; sa préférence pour `user-event` reste un arbitrage (A1)                                                                   |
| https://github.com/goldbergyoni/javascript-testing-best-practices                                                                                                | guide de tests JavaScript, Yoni Goldberg                                 | 24,6 k, 2024-06-27                                | MIT (API GitHub) — **adapté**                 | 2026-11-14 (notes)                              | § 6 attendre l'erreur au lieu de la capturer ; données propres à chaque test. Son nettoyage « après tous les tests » n'est pas repris                                                                                                            |
| https://newsletter.kentbeck.com/p/augmented-coding-beyond-the-vibes (2025-06-25)                                                                                 | billet de Kent Beck                                                      | auteur reconnu (TDD)                              | inconnue — idées seulement                    | 2026-11-14 (notes)                              | § 6 désactiver ou supprimer un test est le signe d'un agent qui triche                                                                                                                                                                           |
| https://github.com/documenso/documenso/blob/main/AGENTS.md                                                                                                       | guide d'agent de Documenso                                               | 15,8 k, 2026-11-14                                | AGPL-3.0 — idées seulement                    | 2026-11-14 (notes)                              | § 2 et § 7 toute assertion doit pouvoir échouer, pas de test « ne lève pas » seul ; § 4 cas adverses (autre utilisateur, autre équipe, entrée malformée)                                                                                         |
| https://github.com/triggerdotdev/trigger.dev/blob/main/AGENTS.md                                                                                                 | guide d'agent de Trigger.dev                                             | 16,8 k, 2026-11-13                                | Apache-2.0 — **adapté**                       | 2026-11-14 (notes)                              | § 2 nommer la régression qu'un test attrape avant de l'écrire (ici dans le titre ou le rapport, pas en commentaire `Catches:`) ; pas de mock d'infrastructure                                                                                    |
| https://github.com/langfuse/langfuse/blob/main/REVIEW.md                                                                                                         | grille de relecture de Langfuse                                          | 37,4 k, 2026-11-14                                | MIT pour le cœur — **adapté**                 | 2026-11-14 (notes)                              | § 2 importer les limites plutôt que les recopier ; § 4 entrée invalide → 400 et non 500, statut vérifié ; un test n'a sa place que s'il échoue sans le changement                                                                                |
| https://github.com/anthropics/claude-plugins-official/tree/main/plugins/pr-review-toolkit (`pr-test-analyzer`) et `plugins/code-modernization` (`test-engineer`) | agents officiels d'Anthropic                                             | 47,3 k, 2026-11-14                                | Apache-2.0 — **adapté**                       | 2026-11-14 (copie brute)                        | § 5 prouver qu'un test peut échouer en cassant la cible ; couverture comportementale plutôt que lignes ; zéro cas exécuté = rien de prouvé                                                                                                       |
| https://github.com/anthropics/claude-code/issues/319                                                                                                             | ticket « A tendency to re-write tests so they pass » (2025-03-04)        | 11 réactions, fermé « not planned »               | contenu de ticket, inconnue — idées seulement | 2026-11-14, lu à la source                      | § 6 pourquoi : `Makefile` réduit aux tests déjà verts, règles des commentateurs contre `.skip`, assertions retirées, sauts conditionnels                                                                                                         |
| https://arxiv.org/abs/2603.27249                                                                                                                                 | Baltes, Cheong, Treude, « An Endless Stream of AI Slop », v4 2026-08-28  | prépublication, 1 154 messages Reddit et HN codés | CC BY 4.0 — **adapté**                        | 2026-11-14, résumé lu à la source               | § 6 pourquoi : tests modifiés pour laisser passer du code cassé, service imaginaire simulé                                                                                                                                                       |
| https://michaelfeathers.silvrback.com/characterization-testing (2016-08-08)                                                                                      | billet de Michael Feathers                                               | auteur de référence (code hérité)                 | inconnue — idées seulement                    | 2026-11-14 (notes)                              | § 1 caractériser l'existant avant de le toucher ; un comportement surprenant reste figé jusqu'à décision                                                                                                                                         |

## 3. Écarts volontaires avec les sources amont

- superpowers : « du code écrit avant le test ? le supprimer et recommencer » → remplacé par la
  caractérisation de l'existant (§ 1) ; « demander à son partenaire humain » → « Points à arbitrer »
  et `besoinsDuChef` (autonomie du propriétaire) ; « ne pas tester le texte des sources » → les
  gardes du dépôt restent (§ 7).
- mattpocock : « vérifier par la base est un anti-motif » → relire la base est voulu quand la ligne
  est l'effet (§ 2) ; « confirmer les coutures avec l'utilisateur » → retiré.
- goldbergyoni : nettoyage après tous les tests → le dépôt vide la base avant chaque test (§ Pièges).
- Kent C. Dodds : `user-event` plutôt que `fireEvent` → `fireEvent` tant que A1 n'est pas tranché.
- Formbricks (cité par les éclaireurs) simule Prisma : non repris, contraire à `CLAUDE.md`.
- Seuils de couverture des agents génériques (80 à 90 %) : non repris (§ Points à arbitrer).

## 4. Vérifications faites dans le dépôt

Lecture ou recherche, en lecture seule, le 2026-11-14 :

- `src/lib/pricing/line.ts` : `MAX_LINE_QUANTITY = 99`, `MAX_PORTION_GRAMS = 50_000`,
  `portionPriceCents` = `Math.floor((pricePerKgCents * grams + 500) / 1000)` ; `lineTotalCents`
  lève une `RangeError` dont le message contient le code (`QUANTITY_INVALID`). Les valeurs 872,
  829, 2 616 et 2 615 du skill, calculées à la main, ont été contrôlées une fois contre ce module
  transpilé, hors dépôt.
- `vitest.config.ts` (projets `unit` et `integration`, `include` / `exclude`) ; `package.json`
  (scripts ; ni `@testing-library/user-event` ni Stryker) ; `tests/setup.ts` (jest-dom).
- `tests/integration/helpers/db.ts` (`useCleanDatabase` = `beforeEach(resetDatabase)`),
  `tests/integration/helpers/factories.ts` (`createTestProduct` : 1 911 c/kg par défaut),
  `tests/integration/setup/global-setup.ts` (schéma `itest`, verrou advisory).
- Modèles et contre-exemples cités : relus aux lignes données dans
  [etat-du-code.md](etat-du-code.md).
- `node_modules/vitest` 4.1.5 : `allowOnly: !isCI` ; `playwright.config.ts` : `forbidOnly`.
- `.eslintrc.json` : aucun greffon de lint pour Vitest ou Testing Library.
