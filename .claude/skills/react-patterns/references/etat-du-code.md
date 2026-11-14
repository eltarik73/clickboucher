# État du code React — mesure du 2026-11-14

Arbre mesuré : commit `4ec714a` (branche principale), puis remesuré le 2026-11-15 sur `50f8886`
(après le chantier C1-INVITES) pour les sections 2, 3, 4, 5, 7 et 8 avec les commandes de la
section 1 ; les écarts entre les deux arbres sont signalés sur place. Les fichiers `ProductForm.tsx`,
`ProductFormPage.tsx` et `KitchenOrderCard.tsx` bougent dans le chantier photos : relancer les
commandes avant de citer une ligne. Les motifs listés sont des **candidats** relus à la main quand
c'est écrit « relu » ; le reste est à relire avant d'en faire un constat (`klikgo-review` § 8).

## Sommaire

1. Commandes de remesure (lecture seule)
2. Volume de l'état et des effets
3. Promesses dans les gestionnaires et les effets
4. Dépendances d'effet
5. Effets qui ne font que poser de l'état
6. Effets qui chargent sans annulation
7. Minuteries
8. Rendu impur, hydratation, refs
9. Clés de liste
10. Outillage installé

## 1. Commandes de remesure (lecture seule)

Depuis la racine du dépôt ; rien n'est écrit, aucun accès réseau.

```bash
# Inventaire des hooks et motifs candidats (sections 2, 5, 6, 8)
node .claude/skills/react-patterns/scripts/etat-react.cjs

# Avertissements de la configuration du dépôt (section 4) — eslint seul n'a pas de cache par défaut
node_modules/.bin/eslint --ext .ts,.tsx src -f json \
  | node .claude/skills/react-patterns/scripts/etat-react.cjs --lint

# Règles de promesses typées, sans fichier de configuration (section 3) — environ 25 s
node_modules/.bin/eslint --no-eslintrc --no-inline-config --parser @typescript-eslint/parser \
  --parser-options projectService:true --plugin @typescript-eslint \
  --rule '{"@typescript-eslint/no-misused-promises":"error","@typescript-eslint/no-floating-promises":"error"}' \
  --ext .ts,.tsx src -f json | node .claude/skills/react-patterns/scripts/etat-react.cjs --lint

# Comptes simples (sections 4, 7, 8, 9)
grep -rn "eslint-disable.*react-hooks" src | wc -l
grep -rn "setInterval(" src --include=*.tsx --include=*.ts | grep -v "src/app/api" | grep -v __tests__
grep -rnE "key=\{(i|idx|index|j|k)\}" src --include=*.tsx | wc -l
grep -rn "useSyncExternalStore\|useId()" src --include=*.tsx --include=*.ts
```

Pour vérifier seulement les fichiers qu'on vient de toucher : remplacer `src` par leurs chemins et
retirer `-f json | node …` pour lire les messages ligne à ligne.

`npm run lint` (`next lint`) écrit un cache dans `.next/cache/eslint/` par défaut : pour mesurer,
préférer la commande `eslint` ci-dessus, qui donne les mêmes avertissements.

## 2. Volume de l'état et des effets

- 198 fichiers `"use client"` ; 907 `useState` ; 184 `useEffect` + `useLayoutEffect` (`50f8886` ;
  196 / 906 / 182 sur `4ec714a`).
- 36 composants ont 8 `useState` ou plus (seuil de découpage d'`architecture-conventions` § 6).

| `useState` | effets | Fichier                                                  |
| ---------- | ------ | -------------------------------------------------------- |
| 65         | 3      | `src/app/(boucher)/boucher/produits/ProductFormPage.tsx` |
| 52         | 0      | `src/app/(boucher)/boucher/produits/ProductForm.tsx`     |
| 32         | 1      | `src/app/(boucher)/boucher/parametres/page.tsx`          |
| 28         | 1      | `src/components/dashboard/marketing/OfferForm.tsx`       |
| 23         | 1      | `src/app/webmaster/prospects/page.tsx`                   |
| 16         | 7      | `src/app/(boucher)/boucher/commandes/page.tsx`           |
| 21         | 1      | `src/components/dashboard/marketing/CampaignForm.tsx`    |
| 18         | 3      | `src/app/webmaster/catalogue/page.tsx`                   |
| 20         | 1      | `src/app/webmaster/parametres/page.tsx`                  |
| 14         | 3      | `src/app/(admin)/admin/orders/page.tsx`                  |

`src/app/(client)/panier/page.tsx` : 14 `useState`, 3 effets ; une partie de l'état est déjà dérivée
au rendu (`selection`, `quoteRequest`, `refusedLines`) et le devis passe par `useOrderQuote`.

## 3. Promesses dans les gestionnaires et les effets

Règles typées de typescript-eslint, mesurées sur `src/` (682 fichiers) :

| Règle                                                                                 | Messages | Fichiers | Pages (`src/app`) | `src/components` | Hooks                    |
| ------------------------------------------------------------------------------------- | -------- | -------- | ----------------- | ---------------- | ------------------------ |
| `no-misused-promises`, attribut JSX (`onClick={async …}`, `onSubmit={handler async}`) | 194      | 67       | 149 / 44 fichiers | 45 / 23          | 0                        |
| `no-misused-promises`, autres cas                                                     | 14       | 12       | 5                 | 2                | 2 (+ 2 API, 3 `src/lib`) |
| `no-floating-promises`                                                                | 150      | 74       | 113 / 51 fichiers | 22 / 17          | 15 / 6                   |

Sur `50f8886` (695 fichiers analysés) : attributs JSX inchangés (194 / 67) ; autres cas 13 / 11 ;
`no-floating-promises` 146 / 72 (pages 112 / 50, composants 22 / 17, hooks 12 / 5).

- Les règles ne sont pas activées dans `.eslintrc.json` ; elles le seraient par `quality-gates`.
- 7 gestionnaires `onClick={async () => …}` écrits en ligne, dont 4 dans
  `src/app/(boucher)/boucher/commandes/page.tsx`.
- Aucun appel ne suit encore la forme `onClick={() => void handler()}` (0 occurrence).

## 4. Dépendances d'effet

Avertissements `react-hooks/exhaustive-deps` avec la configuration du dépôt : **5** (5 fichiers).
Chacun bloque le commit de son fichier (`lint-staged`, `--max-warnings=0`).

| Fichier                                                 | Ligne | Cause (relu)                                                                     |
| ------------------------------------------------------- | ----- | -------------------------------------------------------------------------------- |
| `src/app/(admin)/admin/shops/[shopId]/page.tsx`         | 85    | `load` déclarée dans le composant                                                |
| `src/app/(admin)/admin/support/[ticketId]/page.tsx`     | 43    | `load` déclarée dans le composant                                                |
| `src/app/(boucher)/boucher/support/[ticketId]/page.tsx` | 50    | `load` déclarée dans le composant                                                |
| `src/components/SplashScreen.tsx`                       | 37    | `pathname` omis                                                                  |
| `src/components/location/LocationPicker.tsx`            | 34    | parent prévenu par effet ; `eslint-disable` mal placé (composant sans importeur) |

`eslint-disable` visant `react-hooks` : 2 (`LocationPicker.tsx:31`, `src/hooks/use-kitchen-notifications.ts:77`).

## 5. Effets qui ne font que poser de l'état

13 effets dont le corps n'appelle que des setters (section A du script), tous relus ; 14 sur
`50f8886` (le quatorzième, `suivi/[id]/SuiviClient.tsx:110`, lit l'horloge après montage) :

- **Légitimes, lecture après montage** (hydratation) : `ProductCard.tsx:96` (`useMountedNow`),
  `suivi/[id]/SuiviClient.tsx:110` (`setReadySinceMs`),
  `src/hooks/use-stored-flag.ts:29`, `BonsPlansClient.tsx:215` (`timeLeft`),
  `boucher/dashboard/calendrier/page.tsx:177` (`mounted`), `AnalyticsConsent.tsx:41`,
  `chat/ChatWidget.tsx:231`, `providers/ThemeProvider.tsx:35`, `search/SearchBar.tsx:55`,
  `src/lib/hooks/use-checkout-session.ts:18`. Ne pas « simplifier ».
- **Candidats** :
  - état recopié d'une prop : `src/components/boucher/OrderAlertOverlay.tsx:20` ;
  - remise de la page à 1 dans un effet (double requête) : `src/app/webmaster/commandes/page.tsx:147`,
    `src/app/webmaster/catalogue/page.tsx:191`, `src/app/webmaster/support/page.tsx:123`.

## 6. Effets qui chargent sans annulation

29 effets appellent `fetch` sans renvoyer de nettoyage (section B du script). Non relus un par un ;
priorité aux effets dont les dépendances changent pendant la vie de la page (course possible) :
`webmaster/commandes`, `webmaster/catalogue`, `admin/orders`, `CartSuggestions.tsx`, et le
chargement des créneaux de `panier/page.tsx` (`fetchSlots`, effet sur `[timeMode, fetchSlots]`,
relu : course entre deux dates). Un effet sur `[]` sans dépendance changeante est sans course mais
garde une promesse flottante. Modèles corrects : `NearbyShops.tsx` (drapeau), `use-order-quote.ts`
(`AbortController`), `use-order-polling.ts` (abandon sur délai).

Appels au montage **sans garde d'authentification** vers une route sous `/api/` couverte par le
matcher (relus ; `config.matcher` de `src/middleware.ts` n'exclut que `cron`, `webhooks`,
`payments/webhook`, `health`, `test-mode`, `geo`, `shops/nearby`) :

- `src/components/shop/ReviewList.tsx` → `/api/reviews` (`apiCached(…, 60)`), sur `/boutique/[slug]` :
  le middleware tourne à chaque vue, même quand le CDN a la réponse ;
- `src/components/cart/CartSuggestions.tsx` → `/api/suggestions`, sur `/panier` (invités compris),
  seulement quand le panier contient une boutique.

À instruire avec `vercel-cost-performance` : donnée passée en props par défaut ; sortir une route du
matcher relève du point à arbitrer n° 4 du `SKILL.md`. Cas de l'accueil, déjà connu de ce skill
voisin : `decouvrir/NearbyShops.tsx` appelle `/api/geo` puis `/api/shops/nearby` (routes exclues du
matcher) au montage, pour tout visiteur.

## 7. Minuteries

`setInterval` hors `src/app/api` et hors tests (relus) :

| Usage                             | Fichiers                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Réseau, sans `useVisiblePolling`  | `boucher/support/[ticketId]/page.tsx:82` (plafonné à 30 essais, signalé par `cost-audit.mjs`). Sur `4ec714a` s'y ajoutaient `SuiviClient.tsx` (pause onglet caché maison) et `useOrderTracker.ts` (sans importeur) ; depuis C1-INVITES, `useOrderTracker.ts` passe par `startVisiblePolling` et sert le suivi                                    |
| Horloge ou animation, sans réseau | `boucher/commandes/page.tsx:168`, `:258`, `:313` (ce dernier relance `fetchShopInfo` à l'expiration d'une pause, borné) ; `commande/[id]/page.tsx:191` ; `suivi/[id]/EstimatedCountdown.tsx:21` ; `PrepTimer.tsx` ; `FlashCountdown.tsx` ; `PriceAdjustmentBanner.tsx` ; `use-kitchen-notifications.ts` (titre clignotant) ; `src/lib/sounds.ts` |
| Minuterie qui survit au démontage | `espace-boucher/page.tsx:35` (`AnimatedStat`, lancée dans un rappel d'`IntersectionObserver`)                                                                                                                                                                                                                                                    |

Appelants de `useVisiblePolling` / `startVisiblePolling` : `ActiveOrderBanner`, `OrderTracker`,
`BoucherNav`, `WebmasterNav`, `use-notifications.ts`, `webmaster/capacite/page.tsx`,
`commande/[id]/page.tsx`, `src/hooks/useOrderTracker.ts` (suivi `/suivi/[id]`, depuis `50f8886`).
Tests : `src/lib/__tests__/visible-polling.test.ts`.

## 8. Rendu impur, hydratation, refs

- **Horloge au premier rendu d'une page rendue côté serveur** : sur `4ec714a`, `EstimatedCountdown`
  de `SuiviClient.tsx` (`useState(Date.now())`) et `fmtTime` sans `timeZone`. Corrigé sur
  `50f8886` : `suivi/[id]/EstimatedCountdown.tsx` lit l'horloge après montage et
  `formatParisTime` (`TrackingTimeline.tsx`) fixe `timeZone: PARIS_TIME_ZONE`.
- **Hasard au rendu** : `ConfettiBurst` (`commande/[id]/page.tsx:132`) ; identifiant DOM de
  `src/components/boucher/QRScanner.tsx:36`.
- **Lecture du navigateur au rendu** : `prefersReducedMotion` de `OrderCountdown.tsx:81` (composant
  monté après un clic, donc sans écart d'hydratation, mais ne suit pas un changement de réglage).
- **`useSyncExternalStore`** : 0 usage. Candidats : `OfflineBanner.tsx`, `OrderCountdown.tsx`.
- **`useId()`** : 3 usages (`ui/form-field.tsx`, `ui/switch.tsx`, `brand/BrandLogo.tsx`).
- **`ref.current` écrit pendant le rendu** (section D du script) : 7 sur `50f8886` —
  `boucher/commandes/page.tsx:152`, `:246` ; `use-order-polling.ts:191` ; `useOrderStream.ts:22` ;
  `useVisiblePolling.ts:135` ; `use-cart.tsx:87`, `:89` (8 sur `4ec714a`, avec l'ancien
  `useOrderTracker.ts:56`).

## 9. Clés de liste

95 `key={i|idx|index|j|k}` dans `src/**/*.tsx`. La grande majorité porte sur des listes statiques
(squelettes de `loading.tsx`, FAQ des pages SEO) : correct. Listes éditables avec suppression
(relues) : options de découpe de `ProductForm.tsx` (≈ l. 790) et `ProductFormPage.tsx` (≈ l. 1403) ;
photos de produit des mêmes fichiers (≈ l. 1324 et 1590), à relire.

## 10. Outillage installé

- `eslint-plugin-react-hooks` installé : préversion 5.0.0 apportée par `eslint-config-next`, avec
  deux règles seulement (`rules-of-hooks`, `exhaustive-deps`). Les règles `purity`, `refs`,
  `set-state-in-effect`, `immutability` existent dans les versions récentes (7.1.1, dernière version
  relevée sur le registre npm le 2026-11-14) : non installées, non essayées.
- `.eslintrc.json` : `react-hooks/exhaustive-deps` en `warn` ; aucune règle typée.
- `package.json` → `lint-staged` : `eslint --fix --max-warnings=0` puis `prettier --write` sur
  `*.{ts,tsx}` indexés ; `.husky/pre-commit` lance `npx lint-staged`.
- Strict Mode : `next.config.mjs` ne fixe pas `reactStrictMode`, donc actif sous l'App Router
  (`node_modules/next/dist/build/webpack/plugins/define-env-plugin.js`).
