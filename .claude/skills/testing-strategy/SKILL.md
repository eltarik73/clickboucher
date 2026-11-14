---
name: testing-strategy
description: Stratégie de test de Klik&Go (Vitest 4.1.5, Playwright 1.59.1, PostgreSQL réel) — choisir le bon niveau (fonction pure, intégration d'un handler ou d'un service sur base réelle, parcours de bout en bout), écrire le test au format du dépôt (projets Vitest unit et integration, schéma itest, fabriques, Clerk simulé seul, courses concurrentes), parcours Playwright en mode test à jeton signé (sessions par rôle, fixtures, projets mobile 375 px et tablette cuisine, stabilité, captures et snapshots ARIA), données de test, et ce que la CI doit lancer. Contient les dix premiers parcours E2E du produit. À charger avant d'écrire, modifier ou relire un test, un fichier sous tests/ ou src/**/__tests__, vitest.config.ts, playwright.config.ts, le job de test de la CI, prisma/seed.ts utilisé par les tests, ou pour décider comment prouver qu'un changement marche.
when_to_use: Mots-clés - test, tests, Vitest, Playwright, e2e, bout en bout, intégration, test unitaire, mock, vi.mock, fixture, fabrique, seed, flaky, instable, couverture, CI, mode test, storageState, régression, TDD.
---

# Stratégie de test — Klik&Go

Les identifiants `[PW2]`, `[VT1]`, `[L20]`… renvoient à [references/sources.md](references/sources.md) ; `T…`, `D…`, `E…` et `A…` à l'état des lieux, aux scénarios et aux arbitrages. **CLAUDE.md (sections « Tests », « CI/CD », « Test Mode ») fait foi** : ce skill le précise, il ne le remplace pas. Skills voisins, dont ce skill ne redéfinit pas les règles : `api-route-conventions` (forme d'un handler, `references/tests-handlers.md`), `order-lifecycle-realtime` (transitions à prouver par une course), `security-multitenant` (ce qu'un test d'isolation doit couvrir), `accessibility-wcag` (axe et Playwright : `references/tests-playwright-axe.md`), `clerk-auth` (mode test), `prisma-expert` (migrations).

## 1. Où en est le dépôt (2026-11-14 à 08 h 27, arbre du chantier 0, non commité et encore en mouvement)

| Niveau | Où | Mesure | Statut |
|---|---|---|---|
| Unitaire (pur, hooks, handlers simulés) | projet Vitest `unit` : `src/**/__tests__/`, `tests/{lib,api,services,security}/` | 42 fichiers, 909 tests, ≈ 3,5 s `[L25]` | Solide ; `jsdom` partout (T5), composants exclus (T4) |
| Intégration sur PostgreSQL réel | projet `integration` : `tests/integration/**`, schéma `itest` | 18 fichiers, 233 tests, 40 à 45 s `[L25]` | Cœur commande couvert ; identité simulée trop haut (T1) |
| Bout en bout | `tests/e2e/smoke.spec.ts` | 1 fichier, 10 tests | Lancé par personne, `baseURL` = production (T3) |

Détail, écarts T1–T19 et défauts D1–D4 (corrigés par le chantier 0, re-mesurés deux fois `[L20][L27]`) : [references/etat-des-lieux.md](references/etat-des-lieux.md). Entre 08 h 00 et 08 h 27 le chantier a ajouté 5 tests unitaires et un fichier d'intégration : **ne jamais citer ces chiffres sans les relancer**, depuis la racine du dépôt :

```bash
node ${CLAUDE_SKILL_DIR}/scripts/audit-tests.mjs           # inventaire + anti-patterns (aujourd'hui : 1 erreur, 8 alertes)
node ${CLAUDE_SKILL_DIR}/scripts/audit-tests.mjs --strict  # code 1 s'il reste une erreur
```

(`${CLAUDE_SKILL_DIR}` = `.claude/skills/testing-strategy` quand ce fichier est lu hors de Claude Code.)

## 2. Choisir le niveau

Pousser chaque vérification au niveau le plus bas qui peut l'établir `[MF2]` ; « mostly integration » pour ce qui touche la base `[KCD1]`.

| Ce que tu dois prouver | Niveau | Emplacement |
|---|---|---|
| Un calcul, une règle, une table (prix, remise, créneau, transition permise, rôle, format) | unitaire | `src/lib/__tests__/<module>.test.ts` (CLAUDE.md admet aussi `tests/lib/` ; jamais le même sujet aux deux endroits, T7) |
| Un schéma Zod refuse ce qu'il doit refuser | unitaire | même dossier (l'existant : `tests/lib/schemas.test.ts`) |
| Un hook (minuteurs, sonde, `fetch`) | unitaire, DOM | `src/hooks/__tests__/` |
| Un composant client avec de la logique | composant | `tests/components/` (bloqué tant que A6 n'est pas tranché) |
| Une règle de structure du code (matcher du middleware, seul écrivain de `Order.status`) | unitaire qui lit les sources | modèles : `src/lib/__tests__/middleware-matcher.test.ts`, `tests/lib/order-writers-guard.test.ts` |
| Une écriture, une transaction, une contrainte unique, une course, le périmètre d'une boutique | **intégration, base réelle** | `tests/integration/<domaine>/` |
| Un refus qui arrive **avant tout accès à la base** (401 sans session, 429) | unitaire : session Clerk et `rate-limit` simulés, **pas Prisma** | `tests/api/` — forme vérifiée : [vitest-unitaire-et-composants.md](references/vitest-unitaire-et-composants.md) §5 |
| Ce qui traverse hydratation, middleware, cookies, sonde cuisine, deux rôles | **bout en bout** | `tests/e2e/` |

Dès qu'un refus dépend d'une ligne en base (403 d'un client, 404 d'une autre boutique) : intégration. Une simulation de Prisma ne prouve ni écriture, ni transaction, ni isolation : les défauts D1 à D4 (prix et remise choisis par le client, double décision, double envoi) étaient tous verts avec Prisma simulé.

## 3. Règles

1. **Tester le code du produit, jamais une copie.** Un test qui recopie la fonction teste la copie (T2 : `tests/security/multitenant.test.ts` affirme que `admin` en minuscules n'est pas admin ; le vrai `isAdmin` dit le contraire). Si la logique est enfermée dans un composant ou un handler, l'extraire dans `src/lib/` et tester l'extrait (modèle : `src/lib/cart/cart-line.ts`).
2. **Ne jamais recopier une table métier ni recalculer un montant avec la formule du code.** Valeur en dur tirée d'un exemple calculé à la main (2 × 12,90 € = 2 580), ou total pris dans le devis du serveur (`confirmedBody`, `quoteAmount`). Propriétés sur l'enum plutôt que matrice recopiée.
3. **Ce qui touche la base se teste sur la base ; on ne simule jamais Prisma** (CLAUDE.md). Simulations permises : les frontières réseau — session Clerk, transports (`@/lib/email`, `@/lib/push`, `@/lib/whatsapp`, `@/lib/emails/*`), Stripe, Anthropic, Replicate, Blob, `@/lib/rate-limit` — et nos helpers d'auth quand le sujet est la logique métier d'un handler. Jamais `@/lib/prisma`, `@/lib/notifications` (il écrit en base), ni le module testé `[VT3][GY1]`. Les quatre fichiers hérités qui simulent Prisma (T1) ne sont pas des modèles.
4. **L'isolation se prouve avec les vrais helpers d'identité** : Clerk seul simulé (`templates/integration/setup/clerk-mock.ts`, vérifié sur toute la suite `[L20][L26]`). Toute route qui reçoit un identifiant du client a son cas « boucher d'une autre boutique » : refus (404 sur les routes de commande, CLAUDE.md) **et** état relu inchangé, aucun `OrderEvent`.
5. **Une course se teste en plusieurs tours** (`it.each` × 5, `Promise.all` de vrais handlers), en affirmant l'ensemble des statuts et l'état final cohérent, jamais l'ordre d'arrivée.
6. **Le temps est une entrée.** Instants UTC explicites ; `vi.useFakeTimers()` + `vi.setSystemTime()` en unitaire, remis à zéro dans `afterEach` `[VT3]` ; `now` passé aux services en intégration ; dates loin des seuils. Vérifier un test de temps sous `TZ=UTC` et `TZ=America/Los_Angeles`.
7. **Attendre l'effet, jamais une durée.** Assertions qui réessaient (`await expect(…).toBeVisible()`), `waitForURL`, `waitForResponse` ; jamais `waitForTimeout` ni `expect(await x.isVisible())` `[PW1][MF1]`.
8. **Locators par rôle et nom** ; libellés lus dans le code (« Prete », « VOIR », « Confirmer ma commande ») ; une carte se retrouve par le nom unique de son client. Ni CSS, ni XPath, ni `nth()` ; `first()` seulement dans l'idiome « au moins un visible » (`.first()).toBeVisible()`). Ce qui n'est pas adressable se corrige dans le produit (T12) `[PW12][TL1]`.
9. **Jamais de parcours contre la production.** Ni écriture, ni session de test (impossible en prod), ni trafic inutile (CPU Vercel, panne du 2026-11-05). Pas d'URL absolue dans `goto` : tout passe par `baseURL` ; la configuration du gabarit refuse `klikandgo.app`.
10. **Chaque test crée ses données, uniques.** Fabriques en intégration, API puis Prisma (avec `assertDisposableDatabase`) en E2E ; rien de lu dans le seed qui soit aléatoire (T8) ; aucun identifiant réutilisé entre tests (caches de 60 s, T10).
11. **Un test est vu rouge une fois** : casser la règle, constater l'échec, rétablir `[AN1]`. Un test qui n'a jamais échoué ne prouve rien.
12. **Un test instable n'est ni ré-essayé en boucle ni ignoré en silence** : quarantaine datée, plafonnée par nous à 2 tests et 14 jours, avec ticket et propriétaire `[MF1][SL1]`.

## 4. Commandes

```bash
npm run test                                            # projet unit, sans base (= npm run test:run, lancé par la CI)
npx vitest run --project unit src/lib/__tests__/pricing-totals.test.ts   # un fichier
npx vitest --project unit                               # watch (= npm run test:watch)
# Intégration : PostgreSQL LOCAL obligatoire (le setup refuse tout autre hôte) ; port au choix
docker run -d --name klikgo-itest -e POSTGRES_USER=ci -e POSTGRES_PASSWORD=ci -e POSTGRES_DB=ci \
  -p 127.0.0.1:55433:5432 postgres:16-alpine -c fsync=off
DATABASE_URL="postgresql://ci:ci@127.0.0.1:55433/ci?schema=public" npm run test:integration
npm run test:coverage                                   # couverture v8 du projet unit
npm run test:e2e                                        # = playwright test ; PAS avant d'avoir remplacé playwright.config.ts (ci-dessous)
```

Ne jamais lancer `vitest run` sans `--project` (il démarre aussi l'intégration). `npm run test:ui` ne fonctionne pas (`@vitest/ui` absent : T6, A1). Parcours E2E : avec le `playwright.config.ts` actuel, `npm run test:e2e` sans variable vise la production (T3) — poser d'abord le gabarit ; préparation et commandes dans [references/playwright-e2e.md](references/playwright-e2e.md) §2.

## 5. Unitaire et composants — l'essentiel

- `// @vitest-environment node` en tête de tout fichier sans DOM (CLAUDE.md) : le projet `unit` est en `jsdom` par défaut.
- Formes à réutiliser (table de cas, variable d'environnement par `vi.stubEnv`, propriété sur un enum, validateur vérifié par le **chemin** de l'erreur), exécutées : 20 tests verts `[L28]` → [references/vitest-unitaire-et-composants.md](references/vitest-unitaire-et-composants.md) §3.
- Simulations en Vitest 4 : `vi.hoisted` pour l'état partagé avec une fabrique `vi.mock` ; clé `default` pour un export par défaut ; `vi.clearAllMocks()` vide l'historique, `vi.restoreAllMocks()` ne touche plus que les `vi.spyOn` `[VT1][VT6]`.
- Composants : bloqués par `"jsx": "preserve"` ; une ligne `oxc: { jsx: { runtime: "automatic" } }` les débloque sans installation `[L21][L28]` (A6). Requêtes `getByRole` d'abord, `queryBy` seulement pour une absence, `findBy` pour l'asynchrone `[TL1][KCD3]`. Un Server Component `async` ne se teste pas dans Vitest `[NX1]` : extraire le calcul, couvrir la page par un parcours.
- Modules purs encore sans test (`roles.ts`, `cron-auth.ts`, `weight.service.ts`, `conversion-config.ts`, `product-snooze.ts`) : même référence, §7.

## 6. Intégration sur base réelle — l'essentiel

Outillage en place, anatomie d'un test, les cinq sorties à vérifier (réponse, état relu, `OrderEvent`/`Notification`, appels sortants, ce qui ne doit pas changer), identité, courses, données : [references/integration-postgres.md](references/integration-postgres.md). En bref :

```ts
// @vitest-environment node
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));   // frontières, dans le fichier
import { PATCH } from "@/app/api/boucher/orders/[orderId]/action/route";   // le vrai handler
import { prisma, useCleanDatabase } from "../helpers/db";                  // le vrai client, schéma itest
// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React
useCleanDatabase();
```

Modèles à copier : `orders/create-order.test.ts` (devis = commande), `orders/transition-races.test.ts` (courses), `templates/integration/api/boucher-isolation.test.ts` (isolation, Clerk seul simulé, 6 verts `[L26]`). Limite : la production passe par pgbouncer, la suite non.

## 7. Bout en bout — l'essentiel

- **Cible** : `next build` + `next start` local, base jetable `*_e2e` remplie par le seed, `TEST_MODE` + `ALLOW_TEST_IN_PROD` + `TEST_SECRET` aléatoire (hors fichier suivi) `[NX2][PW3]`. Aucune préversion Vercel utilisable aujourd'hui (environnement Preview sans base, CLAUDE.md) ; contre une recette en ligne, seul le projet `lecture-seule` existe.
- **Sessions** : projet `setup` qui appelle `POST /api/test-mode/activate` par rôle et enregistre `playwright/.auth/<rôle>.json` (à mettre dans `.gitignore`, T17) `[PW2]`. Ce que chaque rôle donne vraiment — CLIENT = l'utilisateur de test `TEST_USERS.CLIENT` (`src/lib/auth/test-auth.ts`) au panier, mais `/commandes` ne le voit pas connecté ; BOUCHER = **toujours la plus ancienne boutique** (« El Fathe ») ; le mode test court-circuite middleware et propriété, donc ne prouve aucune isolation : [etat-des-lieux.md](references/etat-des-lieux.md) §5.
- **Gabarits** typés, listés (9 tests) et sans alerte de l'audit, **pas encore exécutés contre l'application** `[L24][L29]` : `templates/e2e/` → `playwright.config.ts` (refuse la production ; projets `setup`, `desktop`, `mobile` 375 × 812, `tablette-cuisine` Galaxy Tab S4 paysage, `lecture-seule` ; le préfixe du fichier choisit le projet), `auth.setup.ts`, `fixtures/test.ts` (`seedCart` typé sur `CartState`, bandeaux écartés, `pageErrors`), `support/{db,data}.ts` (`assertDisposableDatabase`, `prepareKitchenShop`, `makeProduct`, `quoteAmount`, `placeGuestOrder`), `client.commande.spec.ts`, `cuisine.accepter.spec.ts`. Le premier lancement réel est un travail à part entière : corriger le gabarit ici s'il se révèle faux.
- **Fixtures, pas d'objets de page au départ** ; un objet de page quand trois specs répètent les mêmes locators, fourni comme fixture `[PW9][PW10]`.
- **Stabilité** : en CI `workers: 1`, `retries: 1`, `failOnFlakyTests` ; sonde cuisine 5 s → `timeout: 15_000` ; confirmation 5 s + 2 s (T13) ; `page.clock` ne remplace que les horloges de la page `[PW5]`, pas l'heure du serveur qui calcule créneaux et expirations.
- **Visuel** : snapshots ARIA pour la structure `[PW17]` ; au plus cinq captures, générées sous Linux en CI, heures masquées `[PW4]`.
- **Coût CPU** : un parcours anonyme affirme zéro requête `/api/*` au montage d'une page publique, avant toute interaction (règle CLAUDE.md).

Détail : [references/playwright-e2e.md](references/playwright-e2e.md).

## 8. Les dix premiers parcours

| # | Parcours | Projet | État |
|---|---|---|---|
| E1 | Découvrir, ajouter un produit au poids, panier ; zéro appel API au montage | mobile, desktop | prêt |
| E2 | Confirmer le panier, total serveur, suivi | mobile, desktop | prêt (gabarit) |
| E3 | Prix changé entre devis et confirmation → 409, rien créé | mobile | prêt |
| E4 | Commande programmée, bandeau « PROGRAMMEE » en cuisine | mobile + tablette | T12 |
| E5 | Accepter en cuisine, le client voit « Acceptée » | tablette | T12 (gabarit) |
| E6 | Refuser avec motif | tablette | T12 |
| E7 | Preparer → Prete → Recuperee | tablette | T12 |
| E8 | Le client annule sa commande en attente | mobile | prêt |
| E9 | Sans session : pages et API protégées refusées | desktop | prêt, à confirmer |
| E10 | Pages publiques : 200, titre, h1, axe, zéro appel API | lecture-seule | prêt (axe : A1) |

« Prêt » = faisable avec le code actuel, pas encore écrit ni lancé. Préparation, étapes, vérifications et ce qui reste aux niveaux inférieurs : [references/scenarios-e2e.md](references/scenarios-e2e.md).

## 9. CI

Aujourd'hui : `lint`, `typecheck` (couvre `tests/**`), `test` (`unit` puis `integration` sur PostgreSQL 16), `build` + garde de pré-rendu. Manquent : le job `e2e` (YAML proposé, non bloquant deux semaines puis bloquant), Clerk simulé en intégration, seuils de couverture par motif sur `src/lib/pricing/**` et `src/lib/cart/**`, lint de `tests/**`. Le workflow se modifie dans une PR dédiée : [references/ci.md](references/ci.md).

## 10. Erreurs déjà commises ici

- Tests « sécurité » sur des fonctions recopiées (T2) ; total du panier testé sur une copie (fichier supprimé par le chantier 0).
- Handlers « testés » avec Prisma simulé pendant que le prix et la remise venaient du client (D1, D2) et que deux décisions concurrentes passaient (D3).
- Matrice de transitions recopiée dans un brouillon de ce skill : fausse quelques heures plus tard.
- Spec E2E visant un slug absent du seed (`boucherie-tarik`) et la production par défaut (T3).
- Cookies du mode test posés à la main : ne fonctionne plus depuis `2364ef9` ; passer par `POST /api/test-mode/activate`.
- `isCancellable(…, new Date())` en unitaire : l'horloge réelle interdit de tester la borne des 5 minutes ; seuls « 1 min » et « 10 min » le sont (T19).
- Un brouillon de ce skill jugeait CLAUDE.md « en retard » d'après la copie chargée en début de session, déjà périmée : relire le fichier du dépôt avant de le citer.

## 11. Points à arbitrer

A1 dépendances (`user-event`, `@axe-core/playwright`, `@vitest/ui`) · A2 vraie session Clerk pour l'invité et `/commandes` · A3 choix de la boutique dans le jeton de test · A4 seed sûr et déterministe · A5 migrations rejouables sur base vide · A6 projets `unit`/`dom` + JSX · A7 job `e2e` · A8 écarts résiduels avec CLAUDE.md (`test:ui` documenté mais inopérant ; « ne jamais mocker Prisma » face aux 4 fichiers hérités et à `api-route-conventions` ; session Clerk absente de la liste des simulations permises ; deux emplacements pour les tests purs) · A9 seuils de couverture · A10 lint de `tests/**`. Recommandation et conduite en attendant : [references/points-a-arbitrer.md](references/points-a-arbitrer.md).

## 12. Définition de terminé

Un changement est testé quand :

1. Chaque règle nouvelle ou modifiée a un test au **niveau le plus bas** qui l'établit (§2), qui importe le code du produit et qu'on a vu échouer une fois.
2. Toute écriture en base, transaction ou contrainte est couverte en **intégration** (cinq sorties vérifiées) ; toute route qui reçoit un identifiant du client a son cas « autre boutique » ; toute action concurrente possible a son test de course.
3. Tout parcours d'écran touché (panier, confirmation, suivi, mode cuisine) a son scénario E2E à jour, ou l'écart est écrit dans la PR avec le scénario concerné.
4. Aucun `.only`, `waitForTimeout`, montant recalculé, donnée lue dans le seed aléatoire, URL de production, nouveau `vi.mock("@/lib/prisma")` ; `audit-tests.mjs` n'ajoute aucune erreur, et toute alerte nouvelle est corrigée ou justifiée dans la PR (une quarantaine datée en est une).
5. `npm run test`, `npm run test:integration` (base locale), `npm run lint`, `npx tsc --noEmit` et `npm run build` (base joignable) passent ; les commandes lancées et leur résultat figurent dans la PR `[AN1]`.
6. [references/etat-des-lieux.md](references/etat-des-lieux.md) est mis à jour si un écart T… est levé ou découvert.
