# Server / Client Components, données, prefetch, hydratation

Identifiants `[S…]`/`[L…]` : voir [sources.md](sources.md).

## 1. Où passe la frontière client

- `"use client"` marque **le module et toutes ses dépendances transitives** comme code client
  [S24][S1b]. Un composant sans directive importé depuis un module client devient client lui aussi.
- Un Client Component peut recevoir des Server Components **en props** (`children`) ; il ne peut pas
  en **importer** [S13].
- Un Client Component est quand même rendu en HTML sur le serveur (prérendu au build pour une route
  statique) [S1b] : « client » veut dire « hydraté et livré en JavaScript », pas « absent du HTML ».

### Ce que cela coûte ici (mesuré)

`src/app/(client)/layout.tsx` est `"use client"`. Il importe `SeoFooter`, qui importe
`SEO_CITIES` (`src/lib/seo/cities.ts`, 68 ko de texte éditorial). Résultat dans le build du
2026-11-13 : le chunk du layout `(client)` pèse **70 ko (16 ko gzip)**, contient `localContext`, et
est chargé sur **chaque** page du groupe `(client)` [L8]. Les `children` restent des Server
Components, d'où l'absence d'effet visible sur le rendu — seulement sur le poids.

Règles :

1. **Un `layout.tsx` est un Server Component.** Les providers vivent dans un petit fichier client
   dédié (modèle : `src/components/providers/CartProviderWrapper.tsx`) qui reçoit `children`.
2. `"use client"` **le plus bas possible** : le bouton, le compteur, le formulaire — pas la page ni
   la section [S23][S26]. Modèles : `HowItWorks` et `OpeningHoursAccordion` sont serveur ;
   `FavoriteButton` est une feuille cliente.
3. Avant d'ajouter `"use client"` à un fichier existant, lister ses imports : chacun part dans le
   bundle. Données statiques volumineuses (`@/lib/seo/*`) ⇒ rester serveur.
4. Une page `"use client"` ne peut pas exporter `metadata` [S12] : poser un `layout.tsx` serveur
   dans le même dossier qui n'exporte que `metadata` (modèle : `src/app/onboarding/layout.tsx`,
   `src/app/(client)/panier/layout.tsx`).

### `import "server-only"` : pas encore en place

La documentation recommande ce paquet pour qu'un module serveur importé par erreur depuis un Client
Component fasse échouer le build [S13]. État réel du dépôt [L17] :

- **aucun** fichier de `src/` ne l'importe (les mentions « server-only » de
  `src/lib/price-adjustment.ts` et `src/lib/auth/test-auth.ts` sont des commentaires) ;
- le paquet n'est pas déclaré dans `package.json` : il n'est présent dans `node_modules` (0.0.1)
  que comme dépendance de `@clerk/nextjs`. Le build Next ne s'en sert pas (il remplace l'import par
  son propre module), mais Vitest résout le vrai paquet ;
- hors du bundler de Next, l'import **lève une erreur** : un test Vitest qui charge un module
  portant `import "server-only"` échoue à l'import. Vérifié avec Vitest 4.1.5 ; un alias vers un
  module vide dans `vitest.config.ts` rétablit le test.

Règle : ne pas ajouter `import "server-only"` à un module de `src/lib` tant que les trois prérequis
ne sont pas livrés dans le même changement — dépendance déclarée, alias Vitest, `npm run test` vert.
C'est le point à arbitrer n° 9 de `SKILL.md` ; le skill `security-multitenant` pose la même
condition. Alias vérifié en bac à sable (fichier cible à créer) :

```ts
// vitest.config.ts — clé à ajouter dans resolve.alias, à côté de "@"
"server-only": path.resolve(__dirname, "./tests/mocks/server-only.ts"), // contenu : export {};
```

En attendant, la protection repose sur la revue : un fichier `"use client"` n'importe jamais
`@/lib/prisma`, `@/lib/redis`, `@/lib/auth/server-auth`, `@/lib/boucher-auth`, `@/lib/admin-auth`,
ni un module qui les importe (aucun import direct de ce type dans les fichiers clients
aujourd'hui, contrôle par `grep`). Les modules purs restent importables des deux côtés —
`@/lib/services/stripe/commission` l'est déjà depuis `panier/page.tsx`.

### Props du serveur vers le client

- Uniquement des valeurs sérialisables ; pas de fonction, pas d'instance de classe [S24][S13].
  Convention du dépôt : dates en chaîne ISO (`promoEnd.toISOString()` dans
  `boutique/[slug]/page.tsx`), prix en centimes entiers.
- **Tout ce qui est passé en prop est public** : c'est écrit dans le HTML et le payload RSC. Passer
  un objet construit champ par champ (`ProductData` dans `boutique/[slug]/page.tsx`), jamais l'objet
  Prisma entier. Le prix pro y est volontairement `null` et résolu côté client après
  authentification (correctif de fuite 0d6fd80).

## 2. Où charger les données

| Donnée | Où | Comment | Pourquoi |
| --- | --- | --- | --- |
| Publique, indexable (boutiques, villes, recettes, offres) | Server Component de la page | Prisma direct, `select` minimal, `Promise.all` pour paralléliser (modèle : `src/app/(client)/page.tsx`) | HTML complet pour les robots, zéro JavaScript de chargement, cacheable en ISR |
| La même requête dans `generateMetadata` et dans la page | module de la page | `cache()` de `react` autour de la fonction (modèle : `getShop`) | Prisma n'est pas dédupliqué automatiquement, seul `fetch` l'est [S2] |
| Par utilisateur sur une page publique (favoris, panier, commande en cours, prix pro) | Client Component, **après montage** | `fetch("/api/…")` conditionné par `(isLoaded && isSignedIn) \|\| hasTestModeCookie()` | lire la session côté serveur rendrait la page dynamique ; l'appel anonyme est une fonction facturée pour rien |
| Espaces connectés (`/boucher`, `/webmaster`, `/admin`, `/commandes`) | coquille cliente statique + API | état actuel : 67 pages `"use client"` ; rafraîchissement par `useVisiblePolling` | cohérent avec le mode test, le polling et le middleware en liste blanche |
| Temps réel (cuisine, suivi) | client | `use-order-polling.ts`, `useVisiblePolling` — voir le skill `order-lifecycle-realtime` | — |
| Mutation | Route Handler `app/api/**/route.ts` | Zod + helper d'auth — voir le skill `api-route-conventions` | convention du dépôt ; aucune Server Action (`"use server"`) n'existe |

Interdits :

- **Un Server Component n'appelle jamais `fetch("/api/…")` de sa propre application** : c'est un
  aller-retour réseau et une fonction de plus ; appeler Prisma ou le service de `src/lib/services`
  directement [S23][S26].
- Pas de `getServerUserId()`, `cookies()`, `headers()` dans une page publique ni dans un layout
  (cf. [rendu-et-cache.md](rendu-et-cache.md)). Un handler ou une page qui en a besoin doit être
  couvert par `config.matcher` du middleware, sinon `auth()` lève.
- Pas de `redirect()` ni de `notFound()` **à l'intérieur d'un `try`** : ils fonctionnent en levant
  une erreur que le `catch` avalerait [S23].

Server Actions : la documentation les recommande pour les mutations depuis un Client Component
[S23]. Ici la convention est le Route Handler (auth, mode test, rate limiting et tests sont bâtis
dessus). En introduire est une décision d'architecture, pas un choix local.

## 3. Prefetch des liens [S9]

- En production, tout `<Link>` visible à l'écran est préchargé. Vers une route **statique** : toute
  la route, depuis le CDN. Vers une route **dynamique** : une requête RSC jusqu'au premier
  `loading.tsx`, donc **une exécution de fonction par lien visible**.
- `prefetch={false}` obligatoire sur : les listes de liens en masse (footer, sidebars — modèle : le
  wrapper `Link` de `SeoFooter.tsx`), tout lien vers une route dynamique répété dans une liste, les
  liens vers `/sign-in`, `/recettes`, `/commandes` depuis des pages publiques.
- Exception assumée : les cartes boutique (`ShopCard`) gardent le prefetch vers `/boutique/[slug]`
  pour afficher le squelette instantanément [L10]. Ne pas généraliser.
- Le prefetch est désactivé en développement : son coût ne se voit qu'en production.

## 4. Hydratation sans mismatch

Le HTML du serveur et le **premier** rendu du navigateur doivent être identiques ; React traite
tout écart comme un bug et ne corrige pas forcément le DOM [S24]. Causes listées par Next :
`typeof window` dans le rendu, API navigateur, `Date()`, HTML mal imbriqué [S14].

Sous ISR le problème change d'échelle : la valeur calculée au rendu serveur n'est pas vieille d'une
requête mais de **toute la fenêtre** (jusqu'à 24 h).

| Source d'écart | Cas rencontré ici | Règle |
| --- | --- | --- |
| Horloge | indice « Ferme bientôt » de `ShopCard`, `daysLeft` de `BonsPlansClient`, comptes à rebours | état initial neutre (`null`), calcul dans `useEffect` — modèle : `closingSoonHint` dans `src/components/shop/ShopCard.tsx` |
| Fuseau | le runtime Vercel est en UTC, le client en heure locale | toute logique métier d'horaire passe par `src/lib/paris-time.ts` (`toParisWallClockDate`, `getParisWallClock`) ; modèle serveur : `OpeningHoursAccordion.tsx` (valable parce que `/boutique/[slug]` est rendue à chaque requête) |
| Session Clerk | sans la prop `dynamic`, `useAuth()` et `useUser()` valent `isLoaded: false` au premier rendu, serveur **et** client ; `<SignedIn>`/`<SignedOut>` ne rendent rien tant que Clerk n'est pas chargé [L10] | brancher sur `isSignedIn` avec un rendu par défaut « déconnecté » (modèles : `src/components/layout/BottomNav.tsx`, `src/app/(client)/decouvrir/ClerkAuthButton.tsx`) ; mettre `isLoaded`/`isSignedIn` dans les dépendances des effets |
| `localStorage`, `sessionStorage`, `document.cookie`, `window.location` | panier, mode test, thème | lecture dans un effet ou un gestionnaire, jamais pour décider du JSX du premier rendu (modèles : `use-cart.tsx`, `src/lib/test-mode-client.ts`) |
| `Math.random()`, identifiants générés | — | `useId()` de React, ou valeur produite côté serveur et passée en prop |
| Composant purement navigateur (PWA, popup, chat, QR) | `ServiceWorkerRegistration`, `InstallPrompt`, `OfferPopup`, `ChatWidget` | `dynamic(() => import(…), { ssr: false })` — **dans un fichier client** pour tout nouveau code (cf. [next15-next16.md](next15-next16.md)) |

- `suppressHydrationWarning` n'agit que sur un niveau et sert d'échappatoire [S24]. Usage légitime :
  `<html>` (classe de thème posée avant l'hydratation). Ne pas s'en servir pour masquer un écart de
  contenu. Deux usages existants l'emploient sur l'année du pied de page (`SeoFooter.tsx`,
  `espace-boucher/page.tsx`) : tolérés, pas à reproduire.
- Le rendu en deux passes (`useEffect` qui pose un état) fait rendre le composant deux fois [S24] :
  le réserver aux feuilles, pas à une page entière.
- `CLAUDE.md` interdit `new Date()` / `Date.now()` dans le rendu initial d'un composant rendu côté
  serveur. Mécanique à connaître : dans un **Server Component** il n'y a pas de mismatch possible
  (il n'est pas hydraté), mais la valeur est **figée dans le cache ISR** pour toute la fenêtre. Le
  code existant s'en sert pour borner des requêtes Prisma et afficher l'année. Tant que le point à
  arbitrer n° 4 de `SKILL.md` n'est pas tranché : aucun nouvel affichage dérivé de l'horloge côté
  serveur (« ouvert », « il y a 5 min », « plus que 2 jours »), et ne pas réécrire l'existant.
