# Sources — skill `nextjs-app-router`

Toutes les sources ont été consultées le **2026-11-13**. Chaque affirmation externe du skill porte
un identifiant `[S…]` (source externe) ou `[L…]` (preuve locale, vérifiée dans ce dépôt).
Rien n'est cité de mémoire : ce qui n'a pas pu être vérifié est marqué « non vérifié » dans le texte.

## Barre de qualité appliquée

- Documentation officielle Next.js (versionnée `/docs/14/…` pour le comportement installé, version
  courante pour 15/16), dépôt `vercel/next.js` : **143 504 étoiles, dernier push 2026-11-13, non
  archivé** (`gh api repos/vercel/next.js`).
- `facebook/react` : 252 571 étoiles, push 2026-11-13, non archivé.
- `getsentry/sentry-javascript` (SDK dont la documentation est citée en S25) : 8 774 étoiles, push
  2026-11-13, non archivé.
- Documentation et blog d'ingénierie de première main : Vercel, Clerk, Sentry, React.
- Sources communautaires : uniquement en corroboration d'une source primaire (S27).

## Vérification indépendante (2026-11-13, commit `2364ef9`)

Un second passage a rouvert chaque URL de S1 à S27 et relu le passage cité, relancé `gh api` sur
les dépôts ci-dessus, sur les quatre avis GHSA, l'issue 62195 et la PR 70378, recompté les preuves
locales L1 à L15 dans `node_modules`, `src/` et `.next/`, et recompilé les motifs. Corrections
issues de ce passage : S1b, L16 à L20 ajoutés ; L8, L9, L11 et L13 mis à jour ; une affirmation
fausse retirée (« `server-only` déjà utilisé dans deux modules » — voir L17).

## Sources externes

| ID | URL | Ce qu'elle étaye | Crédibilité |
| --- | --- | --- | --- |
| S1 | https://nextjs.org/docs/14/app/building-your-application/rendering/server-components | Rendu statique par défaut, rendu dynamique, tableau « Dynamic Functions × Data », liste des fonctions dynamiques (`cookies()`, `headers()`, prop `searchParams`), streaming | Doc officielle Next.js 14 (Vercel) |
| S1b | https://nextjs.org/docs/14/app/building-your-application/rendering/client-components | `"use client"` : tous les modules importés font partie du bundle client ; au chargement complet d'une page, un aperçu HTML est rendu sur le serveur pour les Client Components comme pour les Server Components | Doc officielle Next.js 14 |
| S2 | https://nextjs.org/docs/14/app/building-your-application/caching | Les 4 caches, sorties du Full Route Cache, Router Cache 30 s / 5 min, stale-while-revalidate, `revalidatePath` dans un Route Handler ne vide pas le Router Cache, `React.cache` pour les requêtes hors `fetch` | Doc officielle Next.js 14 |
| S3 | https://nextjs.org/docs/14/app/api-reference/file-conventions/route-segment-config | `dynamic`, `dynamicParams`, `revalidate` (valeur statiquement analysable, « lowest revalidate wins »), `revalidate` indisponible en runtime edge | Doc officielle Next.js 14 |
| S4 | https://nextjs.org/docs/14/app/api-reference/functions/generate-static-params | Rôle de `generateStaticParams`, non rappelée pendant la revalidation, sous-ensemble + `dynamicParams` | Doc officielle Next.js 14 |
| S4b | https://nextjs.org/docs/15/app/api-reference/functions/generate-static-params | « You must return an empty array from `generateStaticParams` or utilize `dynamic = 'force-static'` in order to revalidate (ISR) paths at runtime » ; sans tableau, la route est rendue dynamiquement | Doc officielle Next.js 15 |
| S5 | https://nextjs.org/docs/app/guides/incremental-static-regeneration | Cycle ISR, « Handling uncaught exceptions » (dernière version valide conservée), recommandation de fenêtres longues, limites (Node uniquement, `no-store` ⇒ dynamique, middleware/proxy non exécuté sur l'ISR à la demande), en-tête `x-nextjs-cache`, `NEXT_PRIVATE_DEBUG_CACHE` | Doc officielle Next.js (mise à jour 2026-10-15) |
| S6 | https://nextjs.org/docs/14/app/api-reference/functions/revalidatePath | Signature `revalidatePath(path, type?)`, invalidation à la prochaine visite, forme `'/blog/[slug]', 'page'`, `'layout'` | Doc officielle Next.js 14 |
| S6b | https://nextjs.org/docs/14/app/api-reference/functions/revalidateTag | Signature à un argument en 14 | Doc officielle Next.js 14 |
| S6c | https://nextjs.org/docs/14/app/api-reference/functions/unstable_cache | API « unstable », paramètres `keyParts`, `tags`, `revalidate` | Doc officielle Next.js 14 |
| S7 | https://nextjs.org/docs/14/app/building-your-application/routing/error-handling | `error.js` = Error Boundary client ; ne capte pas le `layout.js` du même segment ; `global-error.js` (ses propres `<html>`/`<body>`) ; message d'erreur serveur masqué en production, `digest` | Doc officielle Next.js 14 |
| S8 | https://nextjs.org/docs/14/app/building-your-application/routing/loading-ui-and-streaming | `loading.js`, `generateMetadata` résolu avant le streaming (v14), statut 200 d'une réponse streamée | Doc officielle Next.js 14 |
| S8b | https://nextjs.org/docs/14/app/api-reference/file-conventions/not-found et https://nextjs.org/docs/14/app/api-reference/functions/not-found | 200 pour une réponse streamée, 404 sinon ; `notFound()` injecte `noindex` | Doc officielle Next.js 14 |
| S9 | https://nextjs.org/docs/14/app/building-your-application/routing/linking-and-navigating et https://nextjs.org/docs/14/app/api-reference/components/link | Prefetch au viewport, route statique entièrement préchargée, route dynamique jusqu'au premier `loading.js` (30 s), prefetch uniquement en production | Doc officielle Next.js 14 |
| S10 | https://nextjs.org/docs/14/app/api-reference/functions/use-search-params et https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout | `useSearchParams` sur route statique ⇒ rendu client jusqu'à la frontière `Suspense` la plus proche | Doc officielle Next.js |
| S11 | https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers | En 14, `GET` mis en cache par défaut avec l'objet `Response` ; façons d'en sortir | Doc officielle Next.js 14 |
| S12 | https://nextjs.org/docs/14/app/building-your-application/optimizing/metadata et https://nextjs.org/docs/14/app/api-reference/functions/generate-metadata | Fusion **superficielle** des métadonnées, `metadata`/`generateMetadata` uniquement en Server Component, `title.template`, `metadataBase`, `notFound()`/`redirect()` utilisables dans `generateMetadata` | Doc officielle Next.js 14 |
| S12b | https://nextjs.org/docs/app/api-reference/functions/generate-metadata (section « Streaming metadata ») et https://nextjs.org/docs/app/api-reference/file-conventions/loading | À partir de v15.2.0 les métadonnées sont streamées sauf pour les « HTML-limited bots » ; option `htmlLimitedBots` (`/.*/` désactive entièrement ce streaming, avec des réponses plus lentes) | Doc officielle Next.js (courante) |
| S13 | https://nextjs.org/docs/14/app/building-your-application/rendering/composition-patterns | Paquet `server-only` (à installer : `npm install server-only`), props sérialisables, interdiction d'importer un Server Component dans un Client Component, motif `children` | Doc officielle Next.js 14 |
| S14 | https://nextjs.org/docs/messages/app-static-to-dynamic-error et https://nextjs.org/docs/messages/react-hydration-error | Erreur « static to dynamic at runtime » ; causes d'erreurs d'hydratation et correctif `useEffect` | Doc officielle Next.js |
| S15 | https://nextjs.org/docs/app/guides/upgrading/version-15 | React 19 minimum, API de requête asynchrones (accès synchrone temporaire), `fetch` et `GET` non mis en cache par défaut, Router Cache, `serverExternalPackages`, `geo`/`ip`, codemod | Guide officiel (mis à jour 2026-10-15) |
| S16 | https://nextjs.org/blog/next-15 | « Other Changes » : interdiction de `ssr: false` dans un Server Component (PR #70378), `instrumentation.js` stable + `onRequestError`, `revalidatePath`/`revalidateTag` interdits pendant le rendu, `staleTimes` | Blog officiel Next.js |
| S16b | https://nextjs.org/docs/app/guides/lazy-loading | « `ssr: false` is not allowed with `next/dynamic` in Server Components. Please move it into a Client Component. » | Doc officielle Next.js |
| S16c | https://nextjs.org/docs/app/api-reference/config/next-config-js/staleTimes, https://nextjs.org/docs/app/api-reference/functions/after, https://nextjs.org/docs/app/api-reference/functions/connection | `staleTimes.dynamic` 30 s → 0 s en v15.0.0 ; `after` stable en v15.1.0 ; `connection` stable en v15.0.0 | Doc officielle Next.js |
| S17 | https://nextjs.org/docs/app/guides/upgrading/version-16 et https://nextjs.org/blog/next-16 | Node 20.9+, TypeScript 5.1+, Turbopack par défaut (le build échoue si une configuration `webpack` est trouvée ; `--webpack` pour en sortir), accès synchrone supprimé, `revalidateTag(tag, profile)` (forme à un argument dépréciée, erreur TypeScript), nom `middleware` déprécié au profit de `proxy` (runtime Node non configurable ; garder `middleware` pour rester en edge), `images.qualities` par défaut `[75]`, `minimumCacheTTL` par défaut 4 h, `next lint` supprimé, Cache Components | Guide (mis à jour 2026-11-06) et blog officiels |
| S17b | https://nextjs.org/docs/messages/empty-generate-static-params | Avec Cache Components, un `generateStaticParams` qui renvoie `[]` est une erreur de build | Doc officielle Next.js |
| S18 | https://nextjs.org/blog/next-15-5 | Dépréciation de `next lint` en 15.5, suppression en 16 | Blog officiel Next.js |
| S19 | https://nextjs.org/support-policy | 16.x Active LTS, 15.x Maintenance LTS (correctifs de sécurité jusqu'au 2027-01-31), **14.x non supportée** | Politique officielle |
| S20 | https://github.com/vercel/next.js/security/advisories (lus via `gh api repos/vercel/next.js/security-advisories`) | Avis publiés de mai à novembre 2026 dont la plage affectée inclut 14.x et dont le correctif n'existe qu'en 15.5.x / 16.x (liste détaillée : registre privé du programme) | Avis de sécurité du mainteneur |
| S21 | https://clerk.com/docs/reference/nextjs/rendering-modes | « It is not recommended and not optimal to wrap your entire application with `<ClerkProvider dynamic>` » ; `auth()` rend la route dynamique ; `useAuth()` est prérendu statiquement | Doc officielle Clerk |
| S22 | https://vercel.com/docs/incremental-static-regeneration | Sur Vercel : réponse servie par le CDN sans exécuter la fonction ; cache ISR **propre à chaque déploiement** ; en cas d'échec le contenu périmé est conservé et réessayé après 30 s ; facturation (invocations à la régénération, lectures/écritures ISR) | Doc officielle Vercel (mise à jour 2026-08-28) |
| S23 | https://vercel.com/blog/common-mistakes-with-the-next-js-app-router-and-how-to-fix-them | Ne pas appeler ses propres Route Handlers depuis un Server Component ; `redirect()` hors `try/catch` ; frontière `Suspense` au-dessus du composant qui charge ; `"use client"` au plus bas | Blog d'ingénierie Vercel, Lee Robinson, 2024-01-08 |
| S24 | https://react.dev/reference/rsc/use-client et https://react.dev/reference/react-dom/client/hydrateRoot | `'use client'` marque le module **et ses dépendances transitives** ; props sérialisables ; « treat mismatches as bugs » ; `suppressHydrationWarning` un seul niveau ; rendu en deux passes | Doc officielle React |
| S25 | https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/ | `app/global-error.tsx` avec `Sentry.captureException` ; `onRequestError = Sentry.captureRequestError` exige Next.js 15 et SDK ≥ 8.28.0 | Doc officielle Sentry |
| S26 | https://nextjs.org/docs/app/guides/production-checklist | Ne pas appeler un Route Handler depuis un Server Component ; ajouter `app/global-error.tsx` ; vérifier l'emplacement des frontières `"use client"` | Doc officielle Next.js |
| S27 | https://github.com/vercel/next.js/issues/62195 et https://github.com/vercel/next.js/pull/70378 | Retour terrain (Next 14.1) : `revalidate` sans `generateStaticParams` régénère à chaque requête sur une route dynamique — corrobore S4b ; PR qui interdit `ssr: false` en Server Component | Dépôt officiel (issue fermée, 11 commentaires) |

## Preuves locales (vérifiées dans ce dépôt)

| ID | Où | Ce qui a été vérifié |
| --- | --- | --- |
| L1 | `node_modules/next/package.json`, `node_modules/next/cache.d.ts`, `node_modules/next/dist/server/web/spec-extension/revalidate.d.ts` | Next 14.2.35 ; `next/cache` exporte `revalidatePath(path, type?)`, `revalidateTag(tag)`, `unstable_cache`, `unstable_noStore` ; pas de `connection`, `after`, `next/form` |
| L2 | `node_modules/next/dist/server/config-shared.js:149-151` | `staleTimes` par défaut : `dynamic: 30`, `static: 300` |
| L3 | `node_modules/next/dist/server/base-server.js:1453` | Message « Page changed from static to dynamic at runtime » (réponse 500) |
| L4 | `node_modules/next/dist/build/utils.js` (≈ l. 1052-1057) | Sans `generateStaticParams` sur tous les segments : `paths: undefined`, la route n'est pas enregistrée comme prérendue |
| L5 | `node_modules/next/dist/build/webpack/plugins/next-types-plugin/index.js` | `PageProps { params?: any; searchParams?: any }` : typer `params` en `Promise<…>` compile en 14.2 |
| L6 | `node_modules/@clerk/nextjs/dist/esm/app-router/server/ClerkProvider.js:17,27,36` (6.39.9) | `headers()` n'est appelé que si la prop `dynamic` est présente |
| L7 | `node_modules/@upstash/redis/nodejs.js:4905` (1.36.2) | Le client Upstash envoie ses `fetch` avec `cache: "no-store"` par défaut |
| L8 | `.next/prerender-manifest.json`, `.next/app-build-manifest.json`, `.next/static/chunks/app/(client)/layout-*.js`, `.next/server/app/**/*.html` (build local du 2026-11-13 à 161f920 ; recontrôlé sur le build de 11 h 41, arbre de 2364ef9) | 370 routes prérendues, 10 entrées dans `dynamicRoutes` ; `/` `initialRevalidateSeconds: 300` ; le chunk du layout `(client)` pèse 70 137 octets (16 232 gzip) — 70 457 / 16 285 au recontrôle — et contient `localContext` (données éditoriales de `src/lib/seo/cities.ts`) ; le HTML prérendu de `checkout/success`, `checkout/cancel` et `boucher/parametres/paiement` ne contient que le squelette `loading.tsx` |
| L9 | Table des routes du build (`next build`, 161f920 ; même décompte dans les journaux de build suivants et dans les manifests à 2364ef9) | Hors API : 88 `○` (dont `/_not-found`), 10 `●`, 13 `ƒ` ; API : 197 `ƒ`, 1 `○` (`/api/calendar-events`) |
| L10 | Audit interne multi-agents de novembre 2026 (résumé dans `CLAUDE.md` § « Coût CPU Vercel ») | Chronologie et mécanisme de la panne du 2026-11-05, constats `clerkdyn-01` à `12` |
| L11 | Compilation des motifs de `references/patterns.md` et du bloc `revalidatePath` de `isr-revalidation.md` avec `node_modules/.bin/tsc` et le `tsconfig.json` du dépôt (hors dépôt, 2026-11-13 ; refaite à 2364ef9 après extraction automatique des blocs) | `tsc` sort en 0 ; contrôle négatif : `revalidateTag("a", "max")` échoue en 14.2.35 (« Expected 1 arguments »), `connection` n'est pas exporté par `next/server`, `await cookies()` compile |
| L12 | `node_modules/@clerk/nextjs/package.json`, `node_modules/@sentry/nextjs/package.json` | `peerDependencies` : Clerk 6.39.9 accepte `next ^13.5.7 \|\| ^14.2.25 \|\| ^15.2.3 \|\| ^16` et React 18 ou 19 ; Sentry 10.49.0 accepte Next 13 à 16 |
| L13 | `grep` sur `src/` (2026-11-13, recompté à 2364ef9) | 104 `page.tsx` (67 `"use client"`), 198 `route.ts` (190 `force-dynamic`), 3 layouts `"use client"`, 0 `"use server"`, 0 `revalidatePath`/`revalidateTag`, 0 `<Suspense>`, 0 `global-error.tsx`, 6 `error.tsx` sans remontée Sentry, 8 `ssr: false` dans 2 Server Components, 3 pages à `useSearchParams()` |
| L14 | `npm view next dist-tags`, `gh api repos/vercel/next.js/releases` | `latest` 16.4.6 (2026-11-09), `backport` 15.5.29 (2026-11-03), `next-14` 14.2.35 (dernière 14.x) |
| L15 | `node -e 'require("react").cache'` et `node_modules/next/dist/compiled/react/cjs/react.react-server.production.min.js` | `cache` est `undefined` dans `react` 18.3.1 (celui qu'utilise Vitest) et exporté par le React embarqué de Next (celui des Server Components) |
| L16 | `node_modules/next/dist/lib/metadata/resolve-metadata.js`, fonction `mergeStaticMetadata` | L'image `opengraph-image` / `twitter-image` d'un niveau n'est appliquée que si l'objet `metadata` de ce niveau ne définit pas `openGraph.images` / `twitter.images` |
| L17 | `grep` sur `src/` et `package.json` ; `node_modules/server-only/package.json` et `index.js` ; `node_modules/next/dist/build/create-compiler-aliases.js` (`createServerOnlyClientOnlyAliases`) ; essai Vitest 4.1.5 hors dépôt (2364ef9) | 0 `import "server-only"` dans `src/` ; paquet absent de `package.json`, présent (0.0.1) comme dépendance de `@clerk/nextjs` ; son export par défaut lève une erreur, seule la condition `react-server` donne un module vide ; Next le remplace par ses propres modules selon la couche ; sous Vitest l'import échoue sans alias et passe avec un alias vers un module vide |
| L18 | `node_modules/@sentry/nextjs/build/cjs/config/withSentryConfig/getFinalConfigObjectBundlerUtils.js` (`getWebpackPatch`, `getTurbopackPatch`), `config/webpack.js`, `config/turbopack/` (10.49.0) ; `next.config.mjs` ; `.next/server/middleware-manifest.json` | La fonction `webpack` de Sentry n'est injectée que si le bundler est webpack ; `autoInstrumentMiddleware` n'est lu que dans la branche webpack ; `next.config.mjs` n'a pas de clé `webpack` de premier niveau ; le middleware est compilé pour le runtime edge |
| L19 | `grep` de `cookies()` / `headers()` et de leurs appelants dans `src/` (2364ef9) | 3 `cookies()` synchrones (`server-auth.ts`, `guest-auth.ts`, `suivi/[id]/page.tsx`), 1 `headers()` synchrone (`vercel-geo.ts`), 1 `await headers()` (`api/webhooks/clerk`) ; `getTestRole()` / `isTestActivated()` : 7 appels hors `server-auth.ts` ; `getVercelGeo()` : 1 appel |
| L20 | `next.config.mjs` (ligne `output`), `node_modules/next/dist/server/next.js:207` | `output` vaut `"standalone"` quand la variable `VERCEL` est absente ; dans ce cas `next start` journalise « "next start" does not work with "output: standalone" configuration » et cite `node .next/standalone/server.js` |

## Sources envisagées et écartées

- **Reddit (r/nextjs, r/reactjs)** : domaine inaccessible à l'outil de recherche de cette session.
  Aucune affirmation du skill ne repose sur Reddit ; la corroboration « terrain » vient de S27.
- **YouTube / conférences** : aucune vidéo utilisée (pas de transcription lue).
- **leerob.com** : non consulté directement ; l'article du même auteur publié sur le blog Vercel (S23) a été retenu.
- **`vercel/commerce`** (14 310 étoiles) : dépôt **archivé** — écarté comme référence d'architecture.
- **`clerk/javascript`** (1 781 étoiles) : sous le seuil de 3 000 étoiles ; seule la documentation officielle
  Clerk (S21) et le code installé (L6) sont cités.
