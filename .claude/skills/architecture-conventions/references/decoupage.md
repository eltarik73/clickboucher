# Découper les fichiers géants — plans

Méthode commune (SKILL § 7) : caractériser → fonctions pures → état (reducer, hooks) →
sous-composants → réduire la zone client. Une PR par étape, sans changement de comportement visible
jusqu'à la dernière. Avant toute étape sur une page publique ou boucher, lire `nextjs-app-router`
(rendu statique, hydratation) et `vercel-cost-performance` (polling, appels au montage). Niveau et
outillage de chaque test : `testing-strategy`. Les comptes ci-dessous datent du 2026-11-14 ; les
pages de commande sont touchées par le chantier prix : relire le fichier avant de planifier.

Repères React utilisés :
- un reducer quand beaucoup de gestionnaires mettent à jour le même état ; une action = une
  interaction de l'utilisateur ; reducer pur, testable seul [S12] ;
- un hook personnalisé par effet, nommé par son intention ; il partage la logique, pas l'état ;
  pas de `useMount` / `useEffectOnce` génériques [S13] ;
- les composants client en bas de l'arbre [S15] — sans jamais rendre dynamique une page statique
  ou ISR (`CLAUDE.md` § Coût CPU Vercel).

Où ranger les morceaux :
- propre à la route → à côté de `page.tsx` (`KitchenColumn.tsx`), colocation sûre [S2] ;
- partagé par ≥ 2 routes → `src/components/<domaine>/` ;
- fonction pure → `src/lib/<domaine>/` + test unitaire (`src/lib/__tests__/`).

## 1. `src/app/(boucher)/boucher/commandes/page.tsx` — mode cuisine (1 274 lignes)

Constat : un seul composant client `KitchenModePage` (~1 000 lignes) + `KitchenColumn` et
`HistoryCard` en fin de fichier ; 12 `useState`, 7 `useEffect`, 3 `setInterval` (deux horloges
d'interface à 1 s, un contrôle de connexion à 5 s ; seul le compte à rebours de pause relance un
`fetch`, une fois par expiration puis au plus toutes les 15 s), 5 appels
`fetch("/api/boucher/shop/status")` dont 4 écrits dans le JSX, `formatTime` / `formatPrice` /
`formatDate` locaux. Polling déjà sorti dans `useOrderPolling` (ne pas le toucher ici :
`order-lifecycle-realtime`).

| Étape | Contenu | Test |
| --- | --- | --- |
| 1 | `formatTime` et `formatPrice` locaux → `formatTime` / `formatPriceCents` de `format-kitchen.ts` (corps équivalents à la lecture ; le prouver par un test d'équivalence d'abord, refactoring-incremental.md § 3). `formatDate` n'existe pas dans `format-kitchen.ts` : l'y déplacer tel quel avec son test | unitaire d'équivalence |
| 2 | `useShopStatus()` : lecture + `setStatus(action)` (pause, reprise, occupé), remplace les 5 `fetch` | unitaire du hook (`fetch` simulé) |
| 3 | `useKitchenClock()` et `usePauseCountdown(endsAt)` : une horloge par besoin, en gardant la borne actuelle des relances (`PAUSE_EXPIRY_RETRY_MS`). Tout rafraîchissement réseau périodique reste dans `useOrderPolling` / `useVisiblePolling` (`CLAUDE.md`) | unitaire avec faux minuteurs Vitest |
| 4 | `useOrderActions(refetch)` : `accept`, `deny`, `markReady`… vers `PATCH /api/boucher/orders/[id]/action` | la route est couverte en intégration (`tests/integration/orders/commands-shop.test.ts`) |
| 5 | Sortir `KitchenColumn.tsx`, `HistoryCard.tsx`, `PauseModal.tsx`, `KitchenHeader.tsx` à côté de la page | aucun test de l'écran aujourd'hui (seul `tests/e2e/smoke.spec.ts` ; `kitchen-board.test.ts` couvre le service) : écrire d'abord un parcours Playwright du mode cuisine (`testing-strategy`) |
| 6 | La page ne fait plus que composer : cible < 300 lignes | `size-report.mjs` |

## 2. `src/app/(client)/panier/page.tsx` (805 lignes)

Constat : composant client unique avec créneaux (date, liste, chargement), mode invité (formulaire +
erreurs), code promo, compte à rebours d'envoi, tentative de checkout en `sessionStorage`
(`readCheckoutAttempt` / `writeCheckoutAttempt`), `CartItemRow` interne, `fmtPrice` et `qtyLabel`
locaux. Le devis et le payload passent déjà par `use-order-quote` et `lib/cart/order-payload.ts`
(ne pas dupliquer ; c'est la frontière verrouillée par `checkout-contract.test.ts`).

| Étape | Contenu |
| --- | --- |
| 1 | `qtyLabel` décrit une ligne de **panier** (portions × grammes d'une portion) : la déplacer telle quelle vers `lib/pricing/format.ts` avec son test. Ne pas la remplacer par `formatStoredLineQuantity`, qui lit une ligne **stockée** (`quantity` en kilogrammes) : les deux sens de `quantity` sont distincts (`CLAUDE.md` § Commandes). `fmtPrice` → formateur partagé (SKILL § 10 n° 5) |
| 2 | `useAvailableSlots(shopId, date)` (fetch des créneaux, état chargement) |
| 3 | `useGuestForm()` (valeurs + validation) ; la validation réutilise le schéma Zod serveur si possible |
| 4 | `useCheckoutAttempt()` (lecture/écriture `sessionStorage` sous `try/catch`) |
| 5 | Sous-composants `CartItemRow`, `PickupSlotPicker`, `GuestForm`, `PromoCodeField`, `CheckoutSummary` dans `panier/` |

Invariant à garder vert à chaque étape : `npm run test:integration -- checkout-contract`
(PostgreSQL local requis, `CLAUDE.md` § Tests).

## 3. `src/app/(client)/commande/[id]/page.tsx` (874 lignes)

Constat : `OrderItem` / `OrderData` déclarés à la main (lignes 22-96), 6 `fetch` (lecture,
alternatives, choix, annulation, note, avis), sous-composants internes `LoadingDots`, `ConfettiBurst`,
`TimeProgress`, `QRSection`, `OrderRecap`. Recouvre en partie `suivi/[id]/SuiviClient.tsx` (531 l.,
qui redéclare aussi `OrderItem` / `OrderData`).

| Étape | Contenu |
| --- | --- |
| 1 | Le chantier prix a introduit la vue client `CustomerOrder` (`services/orders/customer-view.ts`), lue par `GET /api/orders/[id]`. Vérifier ce que la route renvoie réellement, puis remplacer les types écrits à la main des deux pages par `Serialized<…>` de ce type (contrats-types.md § 2) ; `tsc` listera les champs qui n'existent plus |
| 2 | `useOrder(orderId)` (lecture + rafraîchissement), `useOrderAlternatives(order)` |
| 3 | `TimeProgress`, `QRSection`, `OrderRecap` → `src/components/order/` s'ils servent aussi au suivi |
| 4 | Décider avec `click-and-collect` si `/commande/[id]` et `/suivi/[id]` doivent rester deux écrans |

## 4. `ProductForm.tsx` (1 711) + `ProductFormPage.tsx` (1 861) — doublon

Constat : deux copies divergentes du même formulaire (modal 4 étapes pour le webmaster, page unique
pour le boucher), 42 et 49 `useState`. `ProductForm.tsx` vit dans `(boucher)/boucher/produits/` mais
son seul importeur est `webmaster/catalogue/reference/page.tsx` (écart de frontière n° 1) ;
`ProductFormPage.tsx` est importé par `produits/nouveau` et `produits/[id]/modifier`. Stratégie
« étrangleur » [S11], pas de réécriture d'un bloc :

0. **Déplacer** `ProductForm.tsx` à côté de la page webmaster (`git mv`, PR sans autre changement) :
   l'écart de frontière disparaît tout de suite, sans toucher à la logique.
1. **Caractériser** le payload envoyé à l'API produit par chaque variante pour 5 produits types (KG,
   PIECE, TRANCHE avec découpes, BARQUETTE, pack) : test unitaire sur une fonction
   `buildProductPayload(state)` extraite *telle quelle* de chaque fichier (deux fonctions d'abord).
2. **Un état commun** : `productFormReducer` + `ProductFormState` dans
   `src/components/product/form/` ; chaque variante l'adopte à son tour (deux PR), le test de
   caractérisation reste vert.
3. **Sections partagées** (`PricingSection`, `WeightSection`, `CutOptionsSection`, `ImagesSection`,
   `TraceabilitySection`) extraites une à une ; les deux variantes ne gardent que leur mise en page
   (étapes contre page unique).
4. **Bascule** : les deux pages importent depuis `src/components/product/form/` ; l'ancien fichier
   est supprimé quand il n'a plus d'importeur.
5. Une bibliothèque de formulaire (non installée) n'est **pas** un prérequis : à arbitrer à part.

## 5. Autres candidats (même méthode)

`boucher/parametres/page.tsx` (1 245, 26 `useState`), `boucher/produits/page.tsx` (1 130),
`dashboard/marketing/CampaignForm.tsx` (1 038) et `OfferForm.tsx` (921), `webmaster/parametres/page.tsx`
(975), `KitchenOrderCard.tsx` (749, voir aussi `design-klikgo`), `lib/notifications.ts` (688, voir
`background-jobs-notifications`), `lib/validators/index.ts` (456 : éclater en `validators/<domaine>.ts`
en gardant les noms exportés).
