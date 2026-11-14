# État du code — inventaire mesuré (2026-11-14)

Arbre de travail de `HEAD 32c581f` + chantier « prix des commandes » non commité. **Ce chantier
bougeait pendant la mesure** : entre 09 h 10 et 09 h 35, `src/` est passé de 619 à 624 fichiers,
`services/orders/customer-view.ts` et `adjustment-settlement.ts` sont apparus, `order-read.ts` a
perdu un export. Les chiffres ci-dessous sont un instantané : relancer la commande avant d'en citer
un. Toutes les commandes sont en lecture seule, depuis la racine du dépôt.

## 1. Volumes

| Mesure | Valeur | Commande |
| --- | --- | --- |
| Fichiers `.ts/.tsx` dans `src/` hors tests | ≈ 620 | `scripts/size-report.mjs` |
| … de plus de 300 lignes / 500 lignes | 86 puis 87 / 36 | idem |
| `route.ts` | 188 | `find src/app/api -name route.ts \| wc -l` |
| `route.ts` qui importent `@/lib/prisma` / `@/lib/services` | 155 / 28 | `grep -rl "@/lib/prisma" src/app/api --include=route.ts \| wc -l` |
| `page.tsx` / dont `"use client"` | 104 / 67 | `grep -rlE "^['\"]use client" src/app --include=page.tsx` |
| Pages et layouts serveur qui importent `@/lib/prisma` | 25 | `grep -rlE "from ['\"]@/lib/prisma['\"]" src/app --include=page.tsx --include=layout.tsx \| wc -l` |
| Fichiers `"use client"` | 194 | idem sur `src` |
| Fichiers à la racine de `src/lib/` | 52 | `ls src/lib/*.ts \| wc -l` |
| Cycles d'import | 0 | `scripts/check-boundaries.mjs` |
| Imports hors frontière | 3 | idem |

Les plus gros fichiers (`wc -l`) : `ProductFormPage.tsx` 1 861, `ProductForm.tsx` 1 711,
`boucher/commandes/page.tsx` 1 274, `boucher/parametres/page.tsx` 1 245, `boucher/produits/page.tsx`
1 130, `CampaignForm.tsx` 1 038, `webmaster/parametres/page.tsx` 975, `OfferForm.tsx` 921,
`seo/cities.ts` 914 (données), `commande/[id]/page.tsx` 874, `panier/page.tsx` 805,
`KitchenOrderCard.tsx` 749, `lib/notifications.ts` 688.

`useState(` par fichier : `ProductFormPage` 49, `ProductForm` 42, `boucher/parametres/page` 26,
`OfferForm` 22, `CampaignForm` 17, `webmaster/prospects/page` 17 ; 12 fichiers en ont ≥ 10, 18 en
ont ≥ 8. Aucune bibliothèque de formulaire installée (`react-hook-form` absent de `package.json`).

## 2. Ce qui est déjà bien (à imiter)

- **Domaine commandes** `src/lib/services/orders/` : `quote.ts`, `create.ts`, `numbering.ts`,
  `transition.ts` (seul écrivain du statut), `commands/*` (une commande = un fichier, résultat
  `CommandResult<T>`), `commands/http.ts` (traduction HTTP des commandes), `kitchen.ts` (modèle de
  lecture), `customer-view.ts` (ce qu'un client lit d'une commande, liste blanche).
- **Calculs purs** : `src/lib/pricing/*` (ligne, prix unitaire, remise, totaux, affichage) et
  `src/lib/cart/*` (reducer de panier, constructeur de payload) — testés en unitaire.
- **Projections** : `orderInclude` (`order-read.ts`), `customerOrderSelect` (`customer-view.ts`) et
  `public-projections.ts` (`as const satisfies Prisma.ProductSelect`).
- **Gardes statiques** : `tests/lib/order-writers-guard.test.ts` (qui écrit dans `orders`),
  `src/lib/__tests__/middleware-matcher.test.ts` (liste blanche du middleware).
- **Contrat bout en bout** : `tests/integration/checkout-contract.test.ts` (12 paniers types).
- `lib`, `components`, `hooks` n'importent jamais `src/app` ; aucun fichier client n'importe une
  valeur serveur (Prisma, service, auth) ; aucun fichier de `src/components` n'importe Prisma ni un
  service : les données arrivent en props.

## 3. Écarts de frontière (sortie de `check-boundaries.mjs`)

| Fichier | Écart | Correction attendue |
| --- | --- | --- |
| `src/app/webmaster/catalogue/reference/page.tsx:18` | importe `ProductForm` de `(boucher)/boucher/produits/` | `ProductForm.tsx` n'a que cet importeur : le déplacer (`git mv`, PR sans autre changement) à côté de la page webmaster ; l'unification avec `ProductFormPage` vient ensuite (decoupage.md § 4) |
| `src/lib/services/orders/list.ts:1` | `import type { NextRequest }` | la route parse la query (`orderListQuerySchema`) et passe l'objet |
| `src/lib/services/orders/list.ts:7` | `getAuthenticatedBoucher` dans le service | la route résout `OrderListViewer` (contrats-types.md § 4) |

Ce que le script ne voit pas :
- `src/lib/hooks/` et `src/lib/__tests__/` sont exclus de la zone `src/lib` (hooks client et tests y
  vivent) : `use-cart.tsx` importe `components/ui/ConfirmDialog`, `use-notifications.ts` importe
  `hooks/useVisiblePolling`.
- Un import entre routes sœurs du même espace (§ 6, accueil → `decouvrir/`).
- Les dossiers SEO de premier niveau de `src/app` (`boucherie-halal/`, …) ne sont pas déclarés
  comme espaces ; aucun n'importe un autre espace aujourd'hui.
- Les services qui lisent encore l'horloge (`new Date()` dans `create.ts`, `getKitchenBoard`,
  `list.ts`) au lieu de recevoir `now` ; `adjust-price.ts` a un paramètre `now: Date = new Date()`.

## 4. Doublons

| Concept | Implémentations | Note |
| --- | --- | --- |
| Montant en euros | `utils.formatPrice` (10 importeurs), `format-kitchen.formatPriceCents` (2), **32** fonctions locales `formatPrice` / `fmtPrice` (pages, composants, 2 e-mails), 94 `(x / 100).toFixed(2)` dans 55 fichiers, 7 écrans en `Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })` | les deux familles diffèrent dès 1 000 € : « 1234,56 € » contre « 1 234,56 € » (refactoring-incremental.md § 3) |
| Nom `Prénom.N` | `format-kitchen.formatClientName` (4 importeurs) + réécritures dans ≈ 9 fichiers (pages boucher, `SuiviClient`, 3 routes finances) | `CLAUDE.md` « Format Nom Client » |
| Types `Order` / `OrderItem` / `OrderData` | 21 déclarations locales dans `app/` et `components/` ; `KitchenOrder` (hook) recopie `KitchenRow` (service) ; `src/types/index.ts` importé par 2 fichiers | contrats-types.md § 2 |
| Formulaire produit | `ProductFormPage.tsx` (boucher, une page) et `ProductForm.tsx` (webmaster, 4 étapes), en-têtes « TODO(refactor) » | decoupage.md § 4 |
| Schémas Zod | `src/lib/validators/` (`index.ts` 456 l. + `order.ts`) et `src/lib/validations/` (`offer.ts`, `campaign.ts`) | nouveaux schémas partagés : `validators/<domaine>.ts` |
| Forme `cutOptions` | `cutOptionSchema` (Zod, `validators/index.ts`) et `parseCutOptions` (manuel, `pricing/unit-price.ts`) | à unifier quand on touche l'un des deux |
| IndexNow | `lib/indexnow.ts` (3 importeurs) et `lib/seo/indexnow.ts` (0) | SEO : `seo-anti-penalty` d'abord |
| Hooks | `src/hooks/` (9 fichiers : 3 `use-x`, 6 `useX`) et `src/lib/hooks/` (5 : 4 `use-x`, 1 `useX`) | SKILL § 10 n° 2 et n° 7 |
| Ré-export | `lib/hooks/useCart.ts` (3 importeurs : `cart/CartDrawer`, `CartPanel`, `CartFAB`, eux-mêmes sans importeur) ; `components/layout/index.ts` (0 importeur) | `CLAUDE.md` impose `use-cart` ; supprimer avec les composants morts |

Commande type pour repérer un doublon avant d'écrire :
`grep -rnE "function (formatPrice|fmtPrice)|const (formatPrice|fmtPrice) ?=" src`.

## 5. Fichiers sans importeur (candidats à la suppression)

Vérifié par `grep` du nom de fichier dans `src/` et `tests/` (aucune occurrence hors le fichier) :
`src/lib/services/payment.service.ts` (40 l.), `weight.service.ts` (58), `notification.service.ts`
(46), `src/components/boucher/order-detail.tsx` (200), `order-row.tsx` (142),
`stock-issue-wizard.tsx` (130), `src/components/layout/bottom-nav.tsx` (doublon de `BottomNav.tsx`),
`section-header.tsx`, `index.ts`, `src/lib/seo/indexnow.ts`, `src/components/cart/CartDrawer.tsx`,
`CartPanel.tsx`, `CartFAB.tsx` (déjà relevés par `accessibility-wcag`). Fichier de sauvegarde suivi
par git : `src/app/(client)/layout.tsx.bak`. Un `grep` ne voit pas un import dynamique construit par
chaîne : relancer `npx tsc --noEmit` et `npm run build` (CI) après suppression.

## 6. Placement à corriger quand on y passe

- `src/app/(client)/page.tsx` (accueil) importe `HeroButtons`, `AuthButton`, `CartBadge`,
  `NearbyShops` depuis `(client)/decouvrir/`, route réduite à une redirection 301 : les remonter
  dans `src/components/landing/` ou à côté de l'accueil.
- `src/lib/hooks/use-cart.tsx` est un provider avec JSX rangé dans `lib` ; sa place naturelle
  serait `src/components/providers/` (à côté de `CartProviderWrapper.tsx`). Ne pas le déplacer sans
  arbitrage : `CLAUDE.md` fixe le chemin d'import `@/lib/hooks/use-cart`.
- `src/lib/services/` mélange l'ancien style (`*.service.ts`, morts) et le style domaine
  (`orders/`, `stripe/`, `stats/`). Nouveau code : `services/<domaine>/<verbe>.ts`.
- Racine de `src/lib/` : regrouper par domaine au fil de l'eau (ex. `notifications.ts`,
  `notification-policy.ts`, `notification-recipients.ts`, `push.ts` → un dossier `notifications/`,
  à arbitrer avec `background-jobs-notifications`). Jamais en un seul déplacement massif.

## 7. ESLint du dépôt

`.eslintrc.json` : `next/core-web-vitals` + parseur `@typescript-eslint`, `no-explicit-any` et
`no-unused-vars` désactivés, `exhaustive-deps` en avertissement ; `npm run lint` = `next lint` ;
lint-staged lance `eslint --fix --max-warnings=0`. Aucune règle de frontière n'est chargée par
`npm run lint`. `eslint-config-next` 14.2.35 déclare déjà le plugin `import` et le résolveur
TypeScript : la zone `import/no-restricted-paths` s'ajoute sans nouvelle dépendance.
`tsconfig.json` : `strict: true`, alias `@/*` → `src/*`, pas de `noImplicitReturns` (d'où la règle
d'exhaustivité de contrats-types.md § 4).
