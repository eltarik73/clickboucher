# Sources — web-performance

Toutes les sources ont été consultées le **2026-11-13 / 2026-11-14** (texte de la page lu, pas
seulement un extrait de recherche), puis relues une par une par un vérificateur indépendant le
2026-11-14 : pages W1 à W8, N1 à N9, R1, V1 à V3, E1 à E3, G3 rouvertes ; étoiles et dernier
push de G1 à G5, de vercel/next.js et de getsentry/sentry-javascript relevés de nouveau avec
`gh api` (valeurs concordantes, à une étoile près) ; I1 à I14 rejoués sur le build local.

Niveau de preuve : **P** = source primaire (doc officielle, dépôt officiel, éditeur) · **A** =
anecdote de terrain, jamais utilisée seule (aucune n'a été retenue ici) · **I** = mesure ou
lecture interne au dépôt (commande rejouable indiquée).

Les nombres qui changent (prix, quotas, seuils) : **relire la page avant de décider**.

## Métriques et méthode (P)

| ID | URL | Ce que la source étaie | Crédibilité / date |
| --- | --- | --- | --- |
| W1 | https://web.dev/articles/vitals | Les trois Core Web Vitals et leurs seuils « bons » : LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 ; évalués au 75e percentile, mobile et desktop séparés ; INP a remplacé FID ; Lighthouse ne mesure pas l'INP et propose le TBT comme substitut en labo ; outils terrain (CrUX, PageSpeed Insights, Search Console) et labo (DevTools, Lighthouse) | Google Chrome team, màj 2024-10-31 |
| W2 | https://web.dev/articles/inp | Définition de l'INP (pire interaction, une ignorée par tranche de 50), seuils 200 / 500 ms, trois phases : délai d'entrée, traitement, délai de présentation ; les tâches longues causent le délai d'entrée | Google, màj 2025-09-02 |
| W3 | https://web.dev/articles/optimize-long-tasks | Tâche longue = plus de 50 ms ; `scheduler.yield()` (Chrome/Edge 129+, Firefox 142+, pas Safari) avec repli `setTimeout` ; `isInputPending()` n'est plus recommandé ; motif `yieldToMain` | Google, màj 2024-12-19 |
| W4 | https://web.dev/articles/optimize-lcp | Quatre sous-parties du LCP (TTFB ≈ 40 %, délai de chargement < 10 %, durée de chargement ≈ 40 %, délai de rendu < 10 %) ; `fetchpriority="high"` sur une ou deux images au plus ; ne jamais `loading="lazy"` l'image LCP ; le rendu côté client retarde le LCP | Google, màj 2025-03-31 |
| W5 | https://developer.chrome.com/docs/crux/methodology | Éligibilité CrUX : page indexable (200, pas de `noindex`) **et** « suffisamment populaire » (seuil non publié) ; sinon absente du jeu de données → PageSpeed Insights n'affiche pas de données terrain | Chrome team, consultée 2026-11-14 |
| W5b | https://developer.chrome.com/docs/crux/api | Les données CrUX sont une moyenne glissante sur 28 jours | Chrome team, consultée 2026-11-14 |
| W6 | https://developers.google.com/search/docs/appearance/core-web-vitals | Google recommande d'obtenir de bons Core Web Vitals ; ils s'alignent sur ce que les systèmes de classement récompensent | Google Search Central |
| W7 | https://web.dev/articles/service-worker-lifecycle | `skipWaiting()` : le nouveau worker prend la main sur des pages chargées par l'ancien (mélange de versions) ; `clients.claim()` ; mise à jour par comparaison octet à octet à chaque navigation ; le script du worker ignore par défaut le cache HTTP (`updateViaCache`) | Google, consultée 2026-11-14 |
| W8 | https://developer.chrome.com/docs/workbox/caching-strategies-overview | Stratégies cache-first (actifs versionnés), network-first (HTML, API), stale-while-revalidate, network-only, cache-only ; `Cache-Control` n'influe pas sur ce que l'API Cache stocke | Google Chrome team |

## Next.js 14 (P, vercel/next.js : 143 507 étoiles, dernier push 2026-11-14, non archivé)

| ID | URL | Ce que la source étaie | Date |
| --- | --- | --- | --- |
| N1 | https://nextjs.org/docs/14/app/api-reference/components/image | `priority` = préchargement + pas de lazy ; `sizes` absent avec `fill` → `100vw` ; `quality` par défaut 75 ; `formats` (« the first match in the array is used ») ; `minimumCacheTTL` et absence d'invalidation ; animations non optimisées ; `getImageProps` | màj 2025-01-03 |
| N2 | https://nextjs.org/docs/14/app/api-reference/components/link | `prefetch` actif seulement en production ; tout lien visible est préchargé ; `prefetch={false}` le désactive | màj 2024-03-11 |
| N3 | https://nextjs.org/docs/14/app/building-your-application/routing/linking-and-navigating | Route statique : préchargement complet ; route dynamique : jusqu'au premier `loading.js`, gardé 30 s ; code splitting par segment | màj 2024-04-04 |
| N4 | https://nextjs.org/docs/14/app/building-your-application/optimizing/fonts | `next/font/google` auto-héberge : « No requests are sent to Google by the browser » ; préchargement selon le fichier qui appelle la police ; « Use multiple fonts conservatively » ; polices variables recommandées | màj 2024-02-09 |
| N5 | https://nextjs.org/docs/14/app/building-your-application/optimizing/scripts | Stratégies `beforeInteractive`, `afterInteractive` (défaut), `lazyOnload`, `worker` (expérimental, ne marche pas avec `app/`) ; recommandation de limiter les scripts tiers aux pages qui en ont besoin | màj 2024-01-19 |
| N6 | https://nextjs.org/docs/14/app/building-your-application/optimizing/lazy-loading | `next/dynamic` = `React.lazy` + Suspense ; ne diffère que les Client Components ; `ssr: false` ; import d'export nommé ; `import()` à la demande | màj 2024-01-05 |
| N7 | https://nextjs.org/docs/app/guides/package-bundling (l'URL `/docs/14/…` redirige ici) | `@next/bundle-analyzer` + `ANALYZE=true` pour webpack ; `optimizePackageImports` ; `next analyze` réservé à Next 16.1+ (Turbopack) ; déplacer le travail de rendu lourd en Server Component | màj 2026-10-15 (doc courante) |
| N8 | https://nextjs.org/docs/app/guides/lazy-loading | Doc courante : « `ssr: false` is not allowed with `next/dynamic` in Server Components. Please move it into a Client Component. » ; pas de découpage automatique quand un Server Component importe dynamiquement un Client Component | màj 2026-03-10 (doc Next 16) |
| N9 | https://nextjs.org/blog/next-15 | Changement cassant de Next 15 : `ssr: false` avec `next/dynamic` interdit dans les Server Components (PR 70378) | billet de sortie officiel, 2024-10-21 |
| R1 | https://react.dev/reference/rsc/use-client | `'use client'` marque le module **et ses dépendances transitives** comme code client ; seuls les modules client sont envoyés au navigateur ; un Server Component peut être passé en `children` d'un Client Component | React team |

## Vercel (P, éditeur)

| ID | URL | Ce que la source étaie | Màj |
| --- | --- | --- | --- |
| V1 | https://vercel.com/docs/speed-insights | Données terrain, P75 par défaut (P90/P95/P99 possibles), filtres appareil/environnement ; collecte aussi sur les préversions | 2026-09-01 |
| V2 | https://vercel.com/docs/speed-insights/limits-and-pricing | Gratuit : **Real Experience Score seul**, 10 000 événements sur 30 jours glissants partagés par l'équipe, collecte suspendue ≥ 14 jours au dépassement, plages 24 h et 7 jours, lignes « Great » et « Needs Improvement » seulement ; Plus (Pro) : 10 $ par projet et par mois + 0,65 $ / 10 000 événements, tous les Core Web Vitals ; `sampleRate` | 2026-09-23 |
| V3 | https://vercel.com/kb/guide/reduce-image-optimization-costs-on-vercel | `formats` vaut `['image/webp']` par défaut ; avec AVIF et WebP déclarés, les navigateurs qui acceptent AVIF reçoivent de l'AVIF et chaque image coûte deux transformations et deux entrées de cache ; garder WebP seul quand le coût prime | 2026-09-30 |

## Outils (P, dépôts officiels ou fortement adoptés)

| ID | URL | Ce que la source étaie | Crédibilité (relevé `gh api`, 2026-11-14) |
| --- | --- | --- | --- |
| G1 | https://github.com/GoogleChrome/lighthouse | Outil de labo de référence | 31 077 ★, push 2026-11-13, non archivé |
| G2 | https://github.com/GoogleChrome/web-vitals | Bibliothèque de mesure terrain (embarquée par Next dans `next/dist/compiled/web-vitals`) | 8 680 ★, push 2026-11-12 |
| G3 | https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md | Format `lighthouserc` : `assert.assertions`, niveaux `off`/`warn`/`error`, `maxNumericValue`, presets `lighthouse:recommended` / `no-pwa`, `numberOfRuns` (3 par défaut en ligne de commande), `aggregationMethod` (`optimistic` par défaut), `collect.url`, `collect.startServerCommand`. Les identifiants d'audit `largest-contentful-paint`, `total-blocking-time`, `cumulative-layout-shift` ne sont pas sur cette page : vérifiés dans `core/audits/metrics/` du dépôt G1 | 7 144 ★, push 2026-11-12 |
| G4 | https://github.com/GoogleChrome/workbox | Bibliothèque de service worker de référence (non installée chez nous) | 13 049 ★, push 2026-10-29 |
| G5 | https://github.com/ai/size-limit | Alternative de budget JS en CI (non installée ; non retenue : notre script lit les manifestes sans dépendance) | 7 049 ★, push 2026-11-10 |

## Sentry (P, getsentry/sentry-javascript : 8 775 ★, push 2026-11-14)

| ID | URL | Ce que la source étaie |
| --- | --- | --- |
| E1 | https://docs.sentry.io/platforms/javascript/guides/nextjs/session-replay/ | Section « Lazy-Loading Replay » : `init` sans `replayIntegration`, puis `import("@sentry/nextjs").then(m => Sentry.addIntegration(m.replayIntegration()))` ; pas de chiffre de poids |
| E2 | https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/tree-shaking/ | `webpack.treeshake` : `removeDebugLogging`, `removeTracing`, `excludeReplayIframe`, `excludeReplayShadowDOM`, `excludeReplayCompressionWorker` (webpack seulement) |
| E3 | https://docs.sentry.io/platforms/javascript/guides/nextjs/tracing/instrumentation/automatic-instrumentation/ | `browserTracingIntegration` actif dès que le tracing est configuré (`tracesSampleRate`) ; capture LCP, CLS, TTFB et INP |

## Mesures et lectures internes (I)

| ID | Constat | Comment le rejouer |
| --- | --- | --- |
| I1 | Relevé par manifestes : JS partagé ≈ 208 KB gzip ; pages client 312–344 KB (`/boutique/[slug]` 344, `/` 337, `/panier` 335) ; `/boucherie-halal/[ville]` 280 ; build local du 2026-11-14 (09 h 56) sur le worktree à `32c581f` avec modifications non commitées | `node .claude/skills/web-performance/scripts/first-load-js.mjs` |
| I2 | Composition du JS partagé (`rootMainFiles`) : `fd9d1056-*` = React DOM (54 KB gz) ; `52774a7f-*` = un seul module, Session Replay / rrweb (37 KB gz) ; `1922-*` (118 KB gz, 405 KB bruts, 250 modules) mêle le runtime client de Next et le SDK Sentry : 26 modules marqués Sentry ≈ 129 KB bruts (≈ 43 KB gz compressés seuls), plus `next/router` du Pages Router (≈ 38 KB bruts) importé par `@sentry/nextjs/build/esm/client/routing/pagesRouterRoutingInstrumentation.js`. Le build n'avait pas de DSN : le code Sentry est embarqué quand même | découpage du chunk par module avec `acorn` + recherche de chaînes (heuristique : chiffre exact avec `@next/bundle-analyzer`) ; les numéros de chunk changent à chaque build |
| I3 | `src/app/(client)/layout.tsx` est `"use client"` → `SeoFooter` et tout `SEO_CITIES` (`src/lib/seo/cities.ts`, 68 KB de source) partent dans `app/(client)/layout-*.js` (70 KB, 16 KB gz, 55 occurrences de `localContext`) sur chaque page client | `grep -o localContext .next/static/chunks/app/\(client\)/layout-*.js \| wc -l` |
| I4 | Négociation de format de `/_next/image` en Next 14.2.35 auto-hébergé : avec `formats: ["image/webp","image/avif"]`, `@hapi/accept` renvoie AVIF pour des en-têtes `Accept` qui listent AVIF, malgré la doc N1 (« first match in the array ») ; WebP seulement si AVIF n'est pas accepté. Sur Vercel l'optimiseur est celui de la plateforme : même comportement d'après V3, non constaté sur notre production | `node -e 'const a=require("next/dist/compiled/@hapi/accept");console.log(a.mediaType("image/avif,image/webp,*/*;q=0.8",["image/webp","image/avif"]))'` |
| I5 | `prefetch={false}` en App Router 14.2.35 coupe aussi le préchargement au survol | `node_modules/next/dist/client/link.js` l. 378 et 400 |
| I6 | `priority` sur `next/image` force déjà `fetchPriority="high"` et un `preload` | `node_modules/next/dist/shared/lib/get-img-props.js` l. 243 ; `client/image-component.js` l. 225 |
| I7 | Les navigations et préchargements App Router sont des GET avec `?_rsc=<hash>`, le hachage portant sur l'indicateur de préchargement, l'état du routeur et `Next-Url` (donc une variante par page de départ) → interceptés et stockés par la branche HTML de `public/sw.js` | `node_modules/next/dist/client/components/router-reducer/fetch-server-response.js` l. 52-70 |
| I8 | Clerk charge `clerk.browser.js` depuis son Frontend API sur toute page sous `<ClerkProvider>` (racine) | `node_modules/@clerk/shared/dist/runtime/loadClerkJsScript-*.js` |
| I9 | La CSP (`next.config.mjs`) n'autorise pas `plausible.io` dans `script-src` ni `connect-src` : le script de `AnalyticsConsent` serait bloqué si `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` était défini | lire `headers()` de `next.config.mjs` |
| I10 | `useReportWebVitals` (`next/web-vitals`) existe en 14.2.35 et rapporte CLS, FID, LCP, INP, FCP, TTFB ; `@vercel/speed-insights` 2.0.0 accepte `sampleRate` et `beforeSend` | `node_modules/next/dist/client/web-vitals.js` ; `node_modules/@vercel/speed-insights/dist/next/index.d.mts` |
| I11 | Les cinq `dynamic(…, { ssr: false })` de `src/app/layout.tsx` (Server Component) ne créent aucun chunk séparé : pas d'entrée `app/layout.tsx -> …` dans `.next/react-loadable-manifest.json` (alors que `app/(client)/layout.tsx -> @/components/chat/ChatWidget`, déclaré dans un fichier client, y est), et leur code est dans `app/layout-*.js` | lire `.next/react-loadable-manifest.json` ; `grep -c beforeinstallprompt .next/static/chunks/app/layout-*.js` |
| I12 | Le HTML prérendu charge plus que les manifestes ne le disent : `/cgv` 340,8 KB contre 311,6 ; `/boucherie-halal/chambery` 320,9 contre 280,2 ; `/` 340,4 contre 337,1 ; plancher 319,1 (`/_not-found`), maximum 358,3 (`/panier`), 365 pages. Cause : le rendu serveur émet cinq références client `BailoutToCSR` (`"reason":"next/dynamic"`, une par `dynamic` du layout racine) dont la liste de chunks est celle du groupe de la page d'accueil (`app/(client)/page-*.js` et ses chunks) ; s'y ajoutent les chunks des `error.tsx` (≈ 3 KB) | `first-load-js.mjs --html` ; `grep -o 'I\[[0-9]*,\[[^]]*\],"BailoutToCSR"\]' .next/server/app/cgv.rsc` |
| I13 | Code Clerk dans notre bundle, chargé par le layout racine sur toute page : un chunk de 30 KB gz (338 occurrences « clerk ») et un de 9 KB gz qui en contient aussi | `grep -o clerk` sur les chunks listés pour `/layout` dans `.next/app-build-manifest.json` (heuristique) |
| I14 | Types vérifiés : `ChatWidgetLazy`, `RootLazy`, le layout `(client)` serveur, la carte `SafeImage` et `yieldToMain` compilent sans erreur avec `tsc` (TypeScript du dépôt, next 14.2.35, react 18.3.1). Clés `webpack.treeshake.*` et dépréciation de `disableLogger` lues dans `node_modules/@sentry/nextjs/build/types/config/types.d.ts` (10.49.0) | `tsc --noEmit` sur un fichier qui reprend les extraits |

## Écartées ou non vérifiées

- Billets d'ingénierie DoorDash sur le SSR Next.js (2022) : pages en 403, contenu non lu → non cités.
- Poids exact de `clerk.browser.js` : non mesuré (à relever dans l'onglet Réseau).
- Format réellement renvoyé par `klikandgo.app/_next/image` : non constaté sur notre production ; I4 (Next auto-hébergé) et V3 (guide Vercel) concordent, un `curl` le confirme.
- Gain réel du « lazy-loading Replay » (E1) avec webpack et un import statique de `@sentry/nextjs` déjà présent : non mesuré ; à valider avec `first-load-js.mjs` avant d'en faire une règle.
- Gain des options `treeshake` de Sentry (E2) : non mesuré.
- Effet du patron 2 de `budget-js.md` (les cinq `dynamic` du layout racine déplacés dans un fichier client) : le diagnostic est mesuré (I11, I12), le gain ne l'est pas — aucun build n'a pu être lancé pendant la rédaction.
- Part exacte de Sentry dans le chunk principal : estimée par marqueurs (I2), pas par un analyseur de bundle. Le chiffre de « ≈ 155 KB pour Sentry » d'une première version additionnait deux chunks entiers, runtime de Next compris : retiré.
- Extrait de service worker cible (`service-worker.md`) : syntaxe vérifiée, jamais exécuté dans un navigateur.
- Disponibilité réelle des Web Vitals dans Sentry : dépend de la présence de `NEXT_PUBLIC_SENTRY_DSN` en production, non vérifiée ici (les fichiers `.env` et la console Vercel n'ont pas été lus).
