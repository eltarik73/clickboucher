# État des tests au regard de ce skill — mesure du 2026-11-14

Arbre mesuré : branche de documentation des skills, dernier commit `4ec714a`. Chiffres à relancer
avant de les citer : le dépôt bouge à chaque chantier. Commandes en lecture seule, depuis la racine
du dépôt, sans réseau ni base :

```bash
node .claude/skills/testing-strategy/scripts/audit-tests.mjs        # inventaire + anti-motifs
T='--include=*.test.ts --include=*.test.tsx'
grep -rlE "vi\.mock\([\"']@/lib/prisma[\"']" src tests | sort         # Prisma simulé
grep -rnE "\b(it|test|describe)\.(only|skip|todo|skipIf|runIf)\b" src tests $T | wc -l
grep -rnE "test\.(skip|fixme|only)" tests/e2e | wc -l                # gardes d'environnement E2E
grep -rln "toMatchSnapshot\|toMatchInlineSnapshot" src tests | wc -l
grep -rn "expect(true)\|expect(false)" src tests $T | wc -l
grep -rn "toHaveBeenCalled" src tests $T | wc -l
grep -rln "^\s*try {" src tests $T | sort
grep -rn "getByTestId" src tests $T | wc -l
ls node_modules/@testing-library node_modules/@stryker-mutator 2>&1
```

## Relevé

Colonne « `50f8886` » : mêmes commandes relancées le 2026-11-15 sur `origin/main` après le
chantier C1-INVITES (le contrôleur) ; les autres lignes n'ont pas bougé ou n'ont pas été relancées.

| Mesure                                               | Valeur (`4ec714a`)           | `50f8886`        | Lecture                                                                                                                                                                                                                         |
| ---------------------------------------------------- | ---------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fichiers Vitest / tests déclarés (`audit-tests.mjs`) | 99 / 947                     | 110 / 1 075      | dont 22 (puis 28) fichiers sous `tests/integration/`                                                                                                                                                                            |
| Erreur de l'audit                                    | 1                            | 1                | `tests/security/multitenant.test.ts` : 22 tests sur une copie de la logique (`testing-strategy` T2)                                                                                                                             |
| Fichiers qui simulent Prisma                         | 4                            | 3                | `tests/api/loyalty/loyalty.test.ts`, `tests/api/support/tickets.test.ts`, `tests/services/orders/list.test.ts` (plus `tests/api/checkout/guest.test.ts` sur `4ec714a`, supprimé par C1-INVITES) ; assertions sur `prismaMock.*` |
| Horloge réelle dans un test                          | 2 fichiers                   | 1 fichier        | `tests/lib/stripe-commission.test.ts` (3) ; `src/lib/__tests__/order-state-machine.test.ts` (6) sur `4ec714a` seulement                                                                                                         |
| `.only` / `.skip` / `.todo` en Vitest                | 0                            | 0                | à garder à 0                                                                                                                                                                                                                    |
| `test.skip` en E2E                                   | 7                            | 8                | gardes « serveur local et `TEST_SECRET` seulement » : légitimes (`guest-tracking.spec.ts` ajouté)                                                                                                                               |
| Snapshots                                            | 0                            | —                | à garder à 0                                                                                                                                                                                                                    |
| `expect(true)` / `expect(false)`                     | 0                            | —                |                                                                                                                                                                                                                                 |
| `toHaveBeenCalled…`                                  | 109 occurrences, 17 fichiers | 171, 22 fichiers | à lire au cas par cas : seul, sur un transport, c'est insuffisant                                                                                                                                                               |
| `try {` dans un test                                 | 5 fichiers                   | 5 (les mêmes)    | `api-errors.test.ts`, `theme.test.tsx`, `checkout-contract.test.ts`, `infra.test.ts` : `try/finally` de nettoyage ; `tests/lib/integration-database-url.test.ts` : capture du message                                           |
| `getByTestId`                                        | 4                            | 4                | dernier recours (élément sans rôle)                                                                                                                                                                                             |
| `@testing-library/user-event`, `@stryker-mutator/*`  | absents                      | —                | `testing-strategy` A1 ; mutation : « Points à arbitrer »                                                                                                                                                                        |

## Exemples situés (à citer avec la ligne, après relecture)

- Attendu recalculé avec le code : `tests/integration/orders/commands-customer.test.ts:205`
  (`lineTotalCents(lineQuantityFromStored(…), price.unitPriceCents)`, prix de `resolveUnitPrice`).
- Formule recopiée : `src/lib/__tests__/pricing-adjustment.test.ts:35` et `:74`
  (`Math.floor((… + 500) / 1000)`) ; `:21` vérifie `Math.round` de JavaScript, aucun code du produit.
- Accord avec l'autorité, littéral à côté (forme admise) : `src/lib/__tests__/cart-line.test.ts:59`,
  `:66`, `:82`.
- Test d'une constante : `src/lib/__tests__/pricing-line.test.ts:42-45` (bloc « bounds ») ; les
  bornes sont aussi prouvées par comportement plus bas dans le même fichier (99 accepté, 100 refusé).
- Transport vérifié par un compte seul : `tests/integration/orders/create-order.test.ts:422`.
- Modèles à copier : `tests/integration/notifications/order-notifications.test.ts` (bloc
  « événements ajoutés »), `tests/integration/orders/commands-shop.test.ts` (« an order of another
  shop is not found and stays unchanged »), `tests/integration/orders/quote.test.ts` (titre qui
  porte les valeurs 956, 478, 3 822, 1 912), `tests/integration/orders/create-order-concurrency.test.ts`.
- Gardes qui lisent les sources : `tests/lib/order-writers-guard.test.ts`,
  `src/lib/__tests__/middleware-matcher.test.ts`, bloc « src/lib/pricing stays pure » de
  `src/lib/__tests__/pricing-line.test.ts`. `tests/lib/image-writers-guard.test.ts` existe sur la
  branche du chantier photos, ni sur cet arbre ni sur `main` à cette date.

## Outils déjà en place (mesuré dans le code)

- Vitest 4.1.5 : `allowOnly` vaut `!isCI` par défaut (`node_modules/vitest/dist/chunks/defaults.*.js`) :
  un `.only` fait échouer la CI, pas un lancement local.
- `playwright.config.ts` : `forbidOnly: !!process.env.CI`.
- `tests/setup.ts` charge `@testing-library/jest-dom` pour le projet `unit`.
- `useCleanDatabase()` (`tests/integration/helpers/db.ts`) : `beforeEach(resetDatabase)`, qui vide
  toutes les tables du schéma `itest` et refuse tout autre schéma.
