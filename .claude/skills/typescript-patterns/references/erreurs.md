# Erreurs et asynchrone : lever, attraper, convertir

## Sommaire

1. Trois sortes d'échec, trois traitements
2. Les classes d'erreur du dépôt
3. Ce qu'un `catch` peut faire
4. Écrire une nouvelle classe
5. Promesses : flottantes, mal placées, parallèles
6. Journaliser

Politique d'ensemble (qui peut avaler quoi, Sentry, délais) : `reliability-observability` § 2, 3
et 5. Forme HTTP (codes, statuts, enveloppe) : `api-route-conventions` § 5. Ce fichier ne dit que
la mécanique TypeScript qui va avec.

## 1. Trois sortes d'échec, trois traitements

| Sorte                                  | Exemple                                                 | Forme                                                                                               | Où il devient une réponse                                                                                    |
| -------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Refus métier attendu                   | stock épuisé, code promo refusé, commande déjà acceptée | **valeur** : `{ ok: false, code, message }` ou `CommandResult` `refused` / `conflict` / `not_found` | une seule traduction : `apiError(result.code, …)`, `transitionResponse` (`services/orders/commands/http.ts`) |
| Annulation d'une transaction           | réserve de stock refusée sous verrou                    | **exception** d'une classe du service, attrapée à la frontière de ce service et convertie en valeur | idem, après conversion                                                                                       |
| Bug, état impossible, donnée corrompue | transition absente de la table, montant non entier      | **exception** (`RangeError`, `TypeError`, `IllegalTransitionError`), jamais attrapée                | `handleApiError` : 500 + Sentry                                                                              |

Pourquoi : un refus est un cas que l'appelant doit traiter, une union le force à le faire ; une
exception de transaction est le seul moyen de faire annuler `prisma.$transaction` ; un bug doit
remonter, être vu, et ne jamais ressembler à un refus (pas de 409 pour une erreur de programmation,
`architecture-conventions` § 4).

## 2. Les classes d'erreur du dépôt

| Classe (champs)                          | Fichier                                                                  | Levée quand                                                             | Attrapée par                                                                 | Devient                                  |
| ---------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------- |
| `InvalidJsonBodyError`                   | `src/lib/api/request-body.ts`                                            | `readJsonBody` sur un corps qui n'est pas du JSON                       | `handleApiError`                                                             | 400 `VALIDATION_ERROR`, ni log ni Sentry |
| `IllegalTransitionError`                 | `src/lib/services/orders/transition.ts`                                  | un appelant demande une transition absente de la table                  | personne                                                                     | 500 + Sentry                             |
| `LimitedStockError` (`productId`)        | `src/lib/services/orders/limited-stock.ts`                               | la réserve dépasse le stock limité, dans la transaction                 | `creationFailure` (`create-replay.ts`), `acceptOrder` (`commands/accept.ts`) | `STOCK_INSUFFICIENT`                     |
| `DiscountUnavailableError` (`reason`)    | `src/lib/services/orders/discount-ledger.ts`                             | l'offre ou la récompense ne peut plus être consommée                    | `creationFailure`                                                            | `PRICE_CHANGED`                          |
| `GuestAdmissionRefusedError` (`refusal`) | `src/lib/services/orders/create-replay.ts`                               | plafond de commandes invitées non traitées atteint, dans la transaction | `creationFailure`                                                            | `RATE_LIMITED`                           |
| `StaleOrderError`                        | `src/lib/services/orders/commands/outcome.ts`                            | les lignes ont changé entre la lecture et la transition                 | `commands/unavailable.ts`                                                    | `STALE_ORDER_REFUSAL` (`CONFLICT`)       |
| `RangeError`, `TypeError`                | `src/lib/pricing/*` (`assertCents`, `lineTotalCents`, `parseCutOptions`) | entrée hors contrat d'une autorité de calcul                            | personne                                                                     | 500 + Sentry                             |

`handleApiError` ne reconnaît que `InvalidJsonBodyError` et `ZodError` ; il reconnaît les erreurs
Prisma par leur texte, ce que `prisma-expert` et `api-route-conventions` § 9 corrigent (par code).
Ne pas ajouter de nouvelle reconnaissance par texte.

## 3. Ce qu'un `catch` peut faire

| Permis                                                                            | Modèle                                                                                                                             |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Convertir une classe connue en valeur, relancer le reste                          | `creationFailure` : `instanceof DiscountUnavailableError` → valeur ; `instanceof LimitedStockError` → valeur ; sinon `throw error` |
| Ajouter du contexte et relancer                                                   | `readJsonBody` : `SyntaxError` → `new InvalidJsonBodyError({ cause: error })`, tout le reste relancé tel quel                      |
| Journaliser et continuer, dans les cas listés par `reliability-observability` § 2 | notification après commit, itération de cron, cache Redis                                                                          |
| Rendre l'état vide d'un confort propre à l'appareil                               | lecture du panier en `sessionStorage` (`use-cart.tsx`) : voir frontieres-zod § 4                                                   |

| Interdit                                                      | Pourquoi                                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `catch {}` ou `catch { /* silent */ }`                        | l'erreur disparaît, Sentry ne la voit pas                                                                          |
| `return []`, `return null`, `return false`, valeur par défaut | un échec ressemble à une donnée ; en prérendu, il se fige dans le cache ISR (`CLAUDE.md` « Build exige une base ») |
| `catch (e: any)` puis `e.message`                             | `strict` type la variable en `unknown` ; `any` réouvre tout                                                        |
| tester `error.message.includes("…")`                          | le texte change d'une version à l'autre (P2025 de Prisma 6)                                                        |
| attraper large pour un seul cas                               | lister la classe attendue, relancer le reste                                                                       |

Les route handlers gardent leur `try/catch` qui finit par `handleApiError` (`CLAUDE.md`, ou la
fabrique de `api-route-conventions`). Des outils externes conseillent d'« éviter try/catch » :
ce conseil ne s'applique pas ici.

## 4. Écrire une nouvelle classe

Seulement pour annuler une transaction ou signaler un bug. Un refus attendu reste une valeur.

```ts
export type HoldRefusalReason = "SLOT_FULL" | "SHOP_CLOSED";

/** Thrown inside the order transaction to roll it back; createOrder turns it into a refusal. */
export class PickupHoldError extends Error {
  readonly reason: HoldRefusalReason;

  constructor(reason: HoldRefusalReason, options?: { cause?: unknown }) {
    super(`Pickup hold refused: ${reason}`, options);
    this.name = "PickupHoldError";
    this.reason = reason;
  }
}
```

- Dans le fichier du service qui la lève ; champs `readonly`, motif en union de littéraux.
- Le message de l'exception sert aux journaux ; le texte affiché, en français, naît de la
  conversion en valeur (`discountUnavailableMessage` de `services/orders/discount.ts`).
- Un test d'intégration prouve la conversion (`testing-strategy`).

## 5. Promesses : flottantes, mal placées, parallèles

**Gérée** = `await`, `return`, `.catch(gestionnaire)`, `.then(ok, ko)`, ou `void` (typescript-eslint).
`void` dit seulement « je n'attends pas » : il ne gère pas la rejection. Le réserver à une fonction
qui traite elle-même ses erreurs ; sinon, `void p.catch(…)`.

| Vu dans le dépôt                                                               | Problème                                                                                            | Forme attendue                                                                                                                                                               |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Notification.requestPermission();` (`src/hooks/use-kitchen-notifications.ts`) | promesse flottante                                                                                  | `.catch` qui rapporte, ou `void` suivi d'une ligne qui dit pourquoi une rejection serait sans conséquence (un refus de l'utilisateur résout `"denied"`, il ne rejette pas)   |
| `setTimeout(() => ctx.close().catch(() => {}), 4000)` (`src/lib/sounds.ts`)    | promesse rendue à `setTimeout` ; `.catch` muet                                                      | accolades, pour ne rien rendre : `setTimeout(() => { … }, 4000)` ; le sort de la rejection suit `reliability-observability` § 2, où un `.catch(() => {})` muet ne figure pas |
| `setTimeout(run, delay)` avec `run` async (`src/hooks/useVisiblePolling.ts`)   | promesse rendue à `setTimeout` ; la sûreté repose sur un commentaire (« `tick` ne doit pas lever ») | `setTimeout(() => void run(), delay)`, et le contrat de `tick` garde son JSDoc                                                                                               |
| `items.forEach(async (item) => { await … })`                                   | les rejections et l'ordre sont perdus                                                               | `for (const item of items) await …` ou `await Promise.all(items.map(…))`                                                                                                     |

Fire-and-forget après une mutation réussie (`reliability-observability` § 2) :

```ts
void notifyCustomer(order.id).catch((error: unknown) => {
  logger.error("[orders/accept] notification client échouée", { orderId: order.id, shopId, error });
});
```

`return await` dans un `try` : sans `await`, la promesse rejetée sort du bloc avant que le `catch`
la voie (modèle : `return await req.json()` de `readJsonBody`). Hors `try`, `return` simple.

Parallèle : `const [shop, products] = await Promise.all([…, …])` pour deux lectures
indépendantes. `Promise.allSettled` seulement si un échec partiel est un résultat voulu (envoi à
plusieurs destinataires), en journalisant chaque `rejected`. Dans une transaction interactive
Prisma, `Promise.all` n'accélère rien : une connexion, une requête à la fois (`prisma-expert`,
`references/transactions-concurrence.md`).

## 6. Journaliser

- `logger` de `src/lib/logger.ts`, jamais `console.*` dans `src/app/api` et `src/lib`
  (`reliability-observability` § 3).
- Message fixe, identifiants métier dans l'objet (`orderId`, `shopId`), aucune donnée personnelle.
- Une `Error` rangée dans l'objet perd sa pile dans la ligne JSON tant que le correctif de
  `reliability-observability` (`references/logs-et-sentry.md` § 1) n'est pas livré : suivre la
  consigne de ce skill-là, pas une forme recopiée d'ici.
- Pas de second `logger.error` avant de relancer vers `handleApiError` : deux événements Sentry
  pour une erreur.
