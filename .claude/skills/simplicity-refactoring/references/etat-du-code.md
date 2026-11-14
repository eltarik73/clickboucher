# État du code — signaux de simplicité (mesure du 2026-11-14)

Arbre mesuré : `HEAD 4ec714a`, aucun fichier de `src/` ni de `tests/` modifié. Instantané : relancer
la commande avant de citer un chiffre. Toutes les commandes sont en lecture seule (aucune n'écrit
dans le dépôt : pas de `--fix`, pas de `--write`, pas de cache) et se lancent depuis la racine.
La référence globale de l'audit (typage strict, tailles de fichiers, échappatoires) est dans
`quality-gates` ; les tailles et doublons par fichier dans `architecture-conventions`
(`references/etat-du-code.md`).

## 1. Signaux de complexité (SKILL § 5)

Commande (≈ 3 s sur `src/`, 682 fichiers `.ts`/`.tsx`) :

```bash
node_modules/.bin/eslint --no-eslintrc --no-inline-config --parser @typescript-eslint/parser \
  --rule '{"complexity":["warn",15],"max-depth":["warn",3],"max-params":["warn",3],"no-nested-ternary":"warn","max-lines-per-function":["warn",{"max":50,"skipBlankLines":true,"skipComments":true}]}' \
  -f unix "src/**/*.{ts,tsx}" | grep -oE "\[Warning/[a-z-]+\]" | sort | uniq -c
```

Pour la colonne « Fichiers », remplacer la fin par `| cut -d: -f1 | sort -u | wc -l` après un
`grep "/<règle>\]"` ; pour `src/lib/`, filtrer d'abord par `grep "/src/lib/"`.

| Règle                    | Seuil              | Occurrences                         | Fichiers | Dont `src/lib/` |
| ------------------------ | ------------------ | ----------------------------------- | -------- | --------------- |
| `complexity`             | > 15               | 99                                  | 80       | 14              |
| `max-depth`              | > 3                | 36                                  | 20       | 5               |
| `max-params`             | > 3                | 21 (surtout des `it.each` de tests) | 19       | 19              |
| `no-nested-ternary`      | —                  | 200                                 | 87       | 16              |
| `max-lines-per-function` | > 50 lignes utiles | 381                                 | 292      | 64              |

Lecture : `--no-eslintrc` ignore la configuration du dépôt (seules ces règles tournent) ;
`--no-inline-config` neutralise les `eslint-disable` qui citent des règles absentes de cette
commande. `max-lines-per-function` compte chaque composant React comme une fonction : signal faible
dans `src/app` et `src/components`. Les 99 fonctions au-delà de 15 recoupent le relevé de
l'éclaireur « références » du même jour.

Exemples cités par le SKILL : `prepareOrder` (`src/lib/services/orders/quote.ts`) dépasse 50 lignes
utiles (84) ; `insertOrder` (`create.ts`) aussi (92).

## 2. Format Prettier (SKILL § 6)

```bash
node_modules/.bin/prettier --list-different "src/**/*.{ts,tsx}" | wc -l
```

354 fichiers sur 682 ne sont pas au format Prettier. Or le `pre-commit` (`lint-staged` de
`package.json`) lance `prettier --write` sur tout fichier `.ts`/`.tsx` indexé : en toucher une
ligne reformate le fichier entier dans le même commit.

## 3. Copies d'une autorité (SKILL § 1 et Pièges)

```bash
grep -rlE "function (formatPrice|fmtPrice)\b|const (formatPrice|fmtPrice) =" src | grep -v "^src/lib/utils.ts$" | wc -l
```

30 fichiers hors `src/lib/utils.ts` définissent leur propre `formatPrice` ou `fmtPrice` (corps non
comparés un à un ; `architecture-conventions` en compte 32 avec une autre expression). Exemples :
`components/product/ProductCard.tsx`, `components/shop/ShopProductsClient.tsx`,
`components/boucher/PriceAdjustModal.tsx`, `lib/emails/order-confirmation.ts`.

Règle métier recopiée : `computeDisplayTier` (`components/boucher/PriceAdjustModal.tsx`) refait
`computeTier` (`src/lib/price-adjustment.ts`) avec `TIER_1_MAX` / `TIER_2_MAX` ; le serveur
(`services/orders/adjust-price.ts`) passe `config.tier1MaxPct` / `config.tier2MaxPct`.

## 4. Intermédiaires examinés au test de suppression (SKILL § 4)

| Intermédiaire                                                    | Verdict                                                 | Raison                                                                                                                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `isTestMode()` (`lib/auth/test-auth.ts`) → `isTestModeEnabled()` | supprimable en théorie, **à ne pas toucher en passant** | nommé dans `CLAUDE.md` § Test Mode ; zone d'auth ; appelé par 5 fichiers (`server-auth.ts`, `get-or-create-user.ts`, deux routes `api/test-mode/*`, `test-auth.test.ts`) |
| `cartLineTotalCents(item)` (`lib/cart/cart-line.ts`)             | garde sa place                                          | lie `item.priceCents` à `lineTotalCents`                                                                                                                                 |
| `quoteOrder` (`services/orders/quote.ts`)                        | garde sa place                                          | retire boutique et remise internes de `prepareOrder`                                                                                                                     |
| `lib/hooks/useCart.ts` (ré-export)                               | à retirer                                               | déjà listé par `architecture-conventions` § 2                                                                                                                            |

## 5. Code appelé par convention (aucun importeur, pas mort)

- `generateStaticParams` qui renvoie `[]` : `(client)/recettes/[slug]/page.tsx`,
  `(auth)/sign-in/[[...sign-in]]/page.tsx`, `(auth)/sign-up/[[...sign-up]]/page.tsx`.
- 15 crons dans `vercel.json` ; dossier `src/app/api/cron/` : ces 15, plus `recipes` (retiré du
  calendrier, gardé pour son rétablissement, `CLAUDE.md`) et un `route.ts` racine (arbitrage
  ouvert par `background-jobs-notifications`).
- `scripts/check-prerender.mjs` (CI), `scripts/prisma-migrate-prod-only.mjs` (script `build`).
- `sentry.client.config.ts` : cherché et injecté par `node_modules/@sentry/nextjs/build/cjs/config/webpack.js`
  (`@sentry/nextjs` 10.49.0) ; `sentry.server.config.ts` : importé par `src/instrumentation.ts` ;
  `sentry.edge.config.ts` : aucun importeur, gardé exprès (commentaire de `src/instrumentation.ts`).
