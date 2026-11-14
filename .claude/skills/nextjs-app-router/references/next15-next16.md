# Next 15 et Next 16 : ce qui change pour cette base

Section factuelle. Identifiants `[S…]`/`[L…]` : voir [sources.md](sources.md). État au 2026-11-13.
Objectif : que **tout nouveau code écrit aujourd'hui en 14.2.35 passe tel quel en 15 et en 16**.
Ce document ne décide pas de la migration (voir « Points à arbitrer » dans `SKILL.md`).

## 0. Où en est la version installée

| Fait | Source |
| --- | --- |
| Installée : `next` 14.2.35, `react` 18.3.1 ; 14.2.35 est la **dernière** 14.x publiée | [L1][L14] |
| 14.x figure dans les **versions non supportées** de la politique de support | [S19] |
| 15.x : « Maintenance LTS », correctifs de sécurité annoncés jusqu'au **2027-01-31** ; dernière : 15.5.29 | [S19][L14] |
| 16.x : « Active LTS » ; dernière : 16.4.6 (2026-11-09) | [S19][L14] |
| Des avis de sécurité publiés depuis mai 2026 incluent 14.x dans leur plage affectée, avec correctif en 15.5.x / 16.x seulement | [S20] |

Liste des avis lus et état de leur évaluation pour ce déploiement : voir le registre privé du
programme. **Leur applicabilité n'a pas été évaluée ici** ; l'évaluation relève du skill
`security-multitenant`.

## 1. Next 15 : changements et impact mesuré dans `src/`

| # | Changement | Source | Impact ici [L13] | À écrire dès maintenant |
| --- | --- | --- | --- | --- |
| 1 | React 19 minimum pour l'App Router | [S15] | `react`/`react-dom` 18.3.1 et leurs types à monter ; Clerk 6.39.9 et Sentry 10.49.0 acceptent déjà React 19 / Next 15-16 [L12] ; les autres dépendances UI restent à vérifier | ne pas ajouter de dépendance plafonnée à React 18 |
| 2 | `cookies()`, `headers()`, `draftMode()` deviennent **asynchrones** (accès synchrone temporairement possible en 15, supprimé en 16) | [S15][S17] | 3 `cookies()` synchrones depuis `2364ef9` : `getTestRole()` dans `src/lib/auth/server-auth.ts`, `getGuestUser()` dans `src/lib/auth/guest-auth.ts`, `suivi/[id]/page.tsx` ; 1 `headers()` : `getVercelGeo()` dans `src/lib/vercel-geo.ts`. `api/webhooks/clerk/route.ts` fait déjà `await headers()`. **Point dur** : `getTestRole()`, `isTestActivated()` et `getVercelGeo()` sont des fonctions **synchrones** ; elles devront devenir `async`, avec leurs 8 appels (`boucher-auth.ts` 2, `admin-auth.ts` 2, `admin-login/page.tsx` 2, `api/auth/check-admin` 1, `api/geo` 1) [L19] | nouveau code : `const cookieStore = await cookies();` — `await` sur la valeur synchrone de 14 est sans effet et compile [L11]. Ne pas réécrire les helpers d'authentification hors de la PR de migration (skills `clerk-auth`, `security-multitenant`) |
| 3 | `params` et `searchParams` deviennent des **Promise** (pages, layouts, handlers, `generateMetadata`, images OG) | [S15] | ≈ 78 fichiers typent `params` en objet, 5 en `Promise` (`recettes/[slug]/page.tsx`, `boutique/[slug]/opengraph-image.tsx`, 3 handlers) ; `recettes/page.tsx` type déjà `searchParams` en `Promise` ; plusieurs pages clientes reçoivent `params` en prop (`commande/[id]`, `admin/shops/[shopId]`, `boucher/support/[ticketId]`) | type `Promise<{ … }>` + `await params` (serveur) ; `useParams()` de `next/navigation` (pages clientes) [L5][L11] |
| 4 | `next/dynamic` avec `ssr: false` **interdit dans un Server Component** | [S16][S16b][S27] | 8 appels dans 2 Server Components : `src/app/layout.tsx` (5) et `src/app/(client)/page.tsx` (3) — erreur de build en 15 | tout nouveau `ssr: false` dans un fichier `"use client"` (motif `ClientOnlyWidgets`) |
| 5 | `GET` des Route Handlers **non mis en cache** par défaut | [S15] | sans effet sur les 190 handlers `force-dynamic` ; `api/calendar-events` (cache voulu, `revalidate = 60`) est le seul à dépendre du défaut | déclarer l'intention : `force-dynamic` partout ; pour un `GET` public mis en cache, `revalidate` aujourd'hui et `dynamic = "force-static"` à la migration (opt-in documenté [S15] ; comportement à valider au build) |
| 6 | `fetch` côté serveur non mis en cache par défaut ; `force-dynamic` impose `no-store` aux `fetch` | [S15][S16] | aucun `fetch` serveur ne s'appuie sur `next: { revalidate }` | passer `cache`/`next.revalidate` explicitement à tout `fetch` serveur dont le résultat doit être mis en cache |
| 7 | Router Cache : les pages ne sont plus réutilisées 30 s en navigation (`staleTimes.dynamic` 30 → 0) | [S15][S16c][L2] | chaque navigation cliente vers une route `ƒ` (`/boutique/[slug]`, coquilles `[id]`) redevient une requête serveur, donc une fonction | rien à coder ; à la migration, décider de `experimental.staleTimes.dynamic: 30` pour garder le comportement actuel |
| 8 | Métadonnées **streamées** à partir de 15.2 (sauf robots « HTML-limited ») | [S12b] | le correctif anti-soft-404 de `/boutique/[slug]` repose sur `generateMetadata` bloquant : un robot qui exécute JavaScript pourrait de nouveau recevoir 200 + `noindex` au lieu de 404 (**non vérifié**, à tester sur preview). Repli documenté : `htmlLimitedBots: /.*/` dans la configuration désactive ce streaming pour tous les agents, au prix d'un TTFB plus long | ne pas multiplier ce motif ; préférer une page prérendue quand un vrai 404 compte |
| 9 | `instrumentation.js` stable, hook `onRequestError` | [S16][S25] | retirer `experimental.instrumentationHook` de `next.config.mjs` ; `onRequestError = Sentry.captureRequestError` devient possible | — |
| 10 | `revalidatePath`/`revalidateTag` appelés **pendant un rendu** lèvent une erreur | [S16] | aucun appel aujourd'hui | les appeler uniquement dans un handler, après l'écriture |
| 11 | `next lint` déprécié en 15.5 | [S18] | `npm run lint` = `next lint`, configuration `.eslintrc.json` (ESLint 8) | — |
| 12 | Supprimés : `runtime = "experimental-edge"`, `NextRequest.geo`/`.ip`, `@next/font`, auto-instrumentation Speed Insights | [S15] | aucun usage (la géolocalisation passe par les en-têtes dans `src/lib/vercel-geo.ts`, `<SpeedInsights />` est déjà explicite) | ne pas les introduire |
| 13 | Node.js ≥ 18.18 | [S16] | CI en Node 20 | — |

Disponibles **après** migration seulement (absents de 14.2.35 [L1]) : `after()` (stable en 15.1,
travail après l'envoi de la réponse), `connection()` (opt-in dynamique explicite) [S16c],
`<Form>` de `next/form` [S16]. Ne pas les importer aujourd'hui : le build échouerait.

## 2. Next 16 : ce qui s'ajoute [S17]

| Changement | Impact ici |
| --- | --- |
| Accès synchrone aux API de requête **supprimé** | les lignes 2 et 3 du tableau ci-dessus deviennent bloquantes |
| Node.js ≥ 20.9, TypeScript ≥ 5.1 | CI en Node 20, TypeScript 5.9.3 installé |
| Turbopack par défaut pour `dev` et `build` ; `next build` **échoue** si une configuration `webpack` est détectée, y compris ajoutée par un plugin (sorties : `--webpack` ou `--turbopack`) | `next.config.mjs` n'a pas de clé `webpack` propre, et `withSentryConfig` (10.49.0) n'injecte sa fonction `webpack` que si le bundler est webpack [L18] : l'échec du build est donc peu probable, à constater. En revanche l'option `webpack: { autoInstrumentMiddleware: false }` que nous lui passons (elle évite d'envelopper le middleware, enjeu CPU) est propre à webpack : son effet sous Turbopack est **non vérifié** ; repli `next build --webpack` |
| Nom de fichier `middleware` **déprécié** au profit de `proxy.ts` (export `proxy`) ; `proxy` tourne en **runtime Node**, non configurable ; pour rester en edge, garder `middleware` | décision à prendre, pas un simple renommage : notre middleware tourne en edge aujourd'hui. S'il devient `proxy.ts`, adapter `src/lib/__tests__/middleware-matcher.test.ts` et vérifier sur preview Clerk, le client REST Upstash et `test-session.ts` en runtime Node, ainsi que le coût CPU (skill `vercel-cost-performance`) |
| `revalidateTag(tag, profile)` : deuxième argument requis, la forme à un argument est dépréciée et signalée par TypeScript ; nouveau `updateTag` (Server Actions) | l'appel à deux arguments ne compile pas en 14 [L11] : préférer `revalidatePath`, absent de la liste des changements du guide |
| `next/image` : `images.qualities` par défaut `[75]` ; `minimumCacheTTL` par défaut 4 h | le dépôt utilise `quality` 60, 70, 75 et 80 : déclarer `images.qualities` ; `minimumCacheTTL` est déjà fixé à 30 jours |
| `next lint` supprimé, `next build` ne lance plus le lint | script `lint` à réécrire (ESLint en direct, configuration plate) |
| Cache Components (`cacheComponents: true`, optionnel) : modèle `use cache`, PPR | **ne pas activer pendant la migration**. Avec ce mode, `generateStaticParams` qui renvoie `[]` est une erreur de build [S17b] (3 routes concernées), et `<ClerkProvider dynamic>` exige une frontière `Suspense` [S21] |
| `params` des fonctions d'image (`opengraph-image`, `icon`) en `Promise` | `boutique/[slug]/opengraph-image.tsx` fait déjà `await params` |

## 3. Règles d'écriture « compatibles 14 → 16 »

1. **Serveur** : `params: Promise<{ slug: string }>` puis `await params` ; `searchParams` idem.
2. **Page cliente** : `useParams<{ id: string }>()` au lieu de la prop `params`.
3. `await cookies()` / `await headers()` dans tout nouveau helper, qui est donc `async` dès sa
   création. Les helpers synchrones existants de `src/lib/auth` et `src/lib/vercel-geo.ts` attendent
   la PR de migration (ligne 2 du tableau).
4. `ssr: false` uniquement dans un fichier `"use client"`.
5. Chaque `route.ts` déclare son mode de cache explicitement (`force-dynamic` par défaut).
6. Revalidation à la demande par `revalidatePath`, encapsulée dans un helper unique de `src/lib/`.
7. Aucune dépendance à un cache implicite : `fetch` serveur avec options explicites, pas de
   supposition sur la réutilisation du Router Cache.
8. Pas de nouveau `runtime = "edge"`.
9. Pas de lecture de la session ni d'affichage dépendant de l'horloge dans le rendu serveur d'une
   page publique (déjà exigé pour l'ISR ; Cache Components impose en plus d'isoler tout accès aux
   données de requête derrière une frontière `Suspense` [S21]).

Tous les motifs correspondants compilent contre les versions installées [L11] :
voir [patterns.md](patterns.md).

## 4. Garde-fous d'une migration (quand elle sera décidée)

- Le guide officiel fournit un codemod (`@next/codemod`, commande `upgrade`) qui migre notamment
  les API asynchrones ; les annotations et casts `UnsafeUnwrapped…` qu'il laisse sont à résoudre,
  pas à conserver [S15].
- Critère de non-régression propre à cette base : après `npm run build`, **la carte de rendu est
  inchangée** — 88 `○`, 10 `●`, 13 `ƒ` hors API, 370 entrées au manifest [L8][L9] — et
  `node scripts/check-prerender.mjs` passe.
- Sur la preview : `/sign-in`, `/sign-in/factor-one`, `/sign-up` et une recette répondent 200
  (routes à `generateStaticParams` vide, jamais rendues au build) ; une boutique inexistante répond
  **404** à un `curl -I` avec un agent utilisateur de robot ; parcours connecté boucher et client.
- Un changement de version majeure de Next, React, Clerk ou Prisma est exclu de Dependabot
  (`CLAUDE.md`) : il se fait à la main, dans une PR dédiée, sans autre changement.
