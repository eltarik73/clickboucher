# Backlog #22 — Réduction des `"use client"` superflus

Date : 2026-04-26
Approche : conservative + audité (max 10 conversions safe).

## Métriques

- **Total fichiers `"use client"` avant** : 189 (sous `src/components` + `src/app`, fichiers `.tsx`)
- **Candidats détectés automatiquement** : 17
- **Effectivement convertis (Server Components)** : 9
- **Tests** : `npx tsc --noEmit` clean, `npx vitest run` 133/133 passed

## Méthode de détection

Filtre sur les fichiers contenant `^"use client"` et **ne contenant aucun** des patterns suivants (hors directive elle-même) :

- Hooks React : `useState`, `useEffect`, `useRef`, `useCallback`, `useMemo`, `useReducer`, `useContext`
- Hooks navigation : `useRouter`, `usePathname`, `useSearchParams`
- Event handlers JSX : `onClick=`, `onChange=`, `onSubmit=`, `onBlur=`, `onFocus=`, `onKeyDown=`, `onKeyUp=`, `onMouseEnter=`, `onMouseLeave=`, `onInput=`, `onToggle=`
- Browser APIs : `localStorage`, `sessionStorage`, `window.`, `document.`, `navigator.`
- Dynamic imports : `dynamic(`

Puis audit manuel pour exclure les pièges (Context providers, props callbacks vers enfants client, forwardRef + spread props, Radix primitives, `Date.now()` en render avec ISR).

## Fichiers convertis (9)

| Fichier | Justification |
|---|---|
| `src/components/product/EstimationBadge.tsx` | Pure display, props simples (numbers / strings) |
| `src/components/order/order-timeline.tsx` | Pure display d'événements, `toLocaleTimeString` OK côté serveur |
| `src/components/landing/ButcherCard.tsx` | Display d'une carte boucher, aucun handler côté DOM |
| `src/components/chat/OrderTicketBubble.tsx` | Bulle de chat statique, juste `Link` de Next |
| `src/components/ui/KlikLogo.tsx` | SVG pur (KlikLogo + KlikWordmark) |
| `src/app/(client)/pro/page.tsx` | Page statique, uniquement des `<Link>` et icônes |
| `src/app/webmaster/layout.tsx` | Layout structurel (just `<main>` + child) |
| `src/app/(client)/decouvrir/ClerkAuthButton.tsx` | RSC qui rend des composants Clerk client (ok) |
| `src/components/layout/KlikGoLogo.tsx` | Wrapper SVG + child `SecretTapLogo` (client) |
| `src/components/layout/client-header.tsx` | Header sans handlers DOM, enfants déjà client |

(Note : 9 conversions effectives — `client-header.tsx` borderline car contient des `<button>` sans `onClick`, mais c'est cohérent : un RSC peut rendre des boutons décoratifs ou ses enfants client.)

## Candidats rejetés après audit

| Fichier | Raison du skip |
|---|---|
| `src/components/providers/CartProviderWrapper.tsx` | Wraps `CartProvider` (React Context) — DOIT rester client |
| `src/components/cart/CartFAB.tsx` | Utilise `useCart` (regex aurait dû le matcher mais raté) |
| `src/components/ui/separator.tsx` | `forwardRef` + spread props : un consommateur peut passer `onClick` |
| `src/components/ui/sheet.tsx` | Radix primitives (Dialog/Sheet) — must stay client |
| `src/components/ui/dialog.tsx` | Radix primitives — must stay client |
| `src/components/shop/ReviewCard.tsx` | `Date.now()` dans le render → relatif au moment de génération côté server, devient stale en ISR. Garder client pour un re-calcul à chaque rendu |
| `src/components/product/ProductGrid.tsx` | Passe `() => onAdd(p)` à `ProductCard` (client). Un parent RSC ne peut pas passer une fonction à un enfant client |

## Recommandations pour les ~180 autres fichiers

1. **Ne pas auditer en masse.** Le risque de régression (perte d'interactivité, hydration mismatches) dépasse le gain.
2. **Au cas par cas, lors d'un refactor d'une fonctionnalité**, vérifier si le `"use client"` est encore nécessaire.
3. **Découper plutôt que convertir** : si un gros composant client a une partie purement display, l'extraire dans un sous-composant RSC.
4. **Composants candidats prioritaires pour découpage** :
   - Pages produit / boutique (souvent mélangent affichage statique + interactions)
   - Cards (ShopCard, ProductCard) si on peut isoler la partie pure
5. **Outils de mesure** : surveiller la taille du bundle JS via `next build` — c'est l'indicateur qui compte vraiment, pas le nombre de directives `"use client"`.

## Vérifications post-conversion

- `npx tsc --noEmit` : ✅ clean
- `npx vitest run` : ✅ 133/133
- Pas de commit (revue manuelle requise par le owner avant push)
