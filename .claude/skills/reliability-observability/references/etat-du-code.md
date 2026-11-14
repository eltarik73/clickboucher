# État du code — fiabilité et observabilité (relevé du 2026-11-14, recompté vers 09 h 30)

Relevé fait sur l'arbre de travail (HEAD `32c581f` + chantier « prix des commandes » **non commité
et encore en mouvement** dans `src/lib/services/orders`, `src/lib` et `src/app/api/orders`). Entre
le relevé du formateur et la vérification, le même matin, sept `catch` vides avaient déjà disparu
(`adjust-price.ts`, `price-adjustment.ts`, routes `adjustment/accept` et `reject`) : **relancer le
script avant de citer un chiffre**, et chercher le motif plutôt que le numéro de ligne. Chaque
constat a un identifiant `E…` repris dans les autres références.

## 1. Inventaire des `catch`

Script (lecture seule, heuristique par regex : il ne voit pas les accolades imbriquées sur plus
d'un niveau) : `python3 -I .claude/skills/reliability-observability/scripts/audit-catches.py .` —
compte, hors `__tests__`, les blocs `catch` vides et ceux qui ne journalisent, ne relancent ni ne
signalent rien.

| Zone | Total | Vides | Sans trace (non vides) | Via `handleApiError` |
| --- | --- | --- | --- | --- |
| `src/app/api` | 280 | 15 | 13 | 227 |
| `src/lib` | 56 | 12 | 10 | — |
| UI (`src/app` hors api, `src/components`, hooks) | 240 | 65 | 51 | — |

Lecture : la majorité des handlers passent par `handleApiError` (bon). Les vides se répartissent en
trois familles, à traiter différemment (politique : SKILL.md § 2).

| Famille | Exemples (présents au relevé) | Verdict |
| --- | --- | --- |
| Cache Redis optionnel, contexte facultatif | `api/products/route.ts` (2), `api/products/[id]/active`, `api/shops/nearby/route.ts` (2), `lib/ai-search.ts` (2), `lib/redis-cache.ts`, `api/chat/route.ts` (3, contexte du chat) | Avaler OK ; ajouter `logger.warn` (une ligne) |
| Fermeture de flux SSE, blob déjà supprimé, son indisponible, `sessionStorage` | `orders/[id]/stream`, `uploads/product-image`, `lib/notification-sound.ts`, `lib/hooks/use-cart.tsx` | Avaler OK, sans trace |
| **Notification ou effet métier perdu** | `cron/weekly-report` (« Continue with next shop »), `cron/calendar-alerts` (« Continue »), `admin/shops/[shopId]/validate` (parrainage), `dashboard/campaigns/[campaignId]/send` (« silent » sur le retour à `DRAFT`) | **Non conforme** : `logger.error` avec ids + compteur `failed` dans la réponse du cron |

`sendNotification` (`src/lib/notifications.ts`) attrape et journalise déjà chaque canal : un
service de commande peut l'attendre sans `try/catch` propre. Ce qui manque est en amont (résultat
des transports ignoré, E9 et E10) : voir `background-jobs-notifications`.

## 2. Constats

**E1 — Les boundaries ne remontent rien.** `src/app/error.tsx`, `(client)`, `(boucher)`,
`webmaster`, `(auth)`, `(admin)` : `useEffect(() => console.error(...))`, aucun
`Sentry.captureException`. Pas de `src/app/global-error.tsx`. Sentry dit qu'une erreur attrapée
par `error.tsx` n'atteint pas le gestionnaire global [S1]. Note : le composant de
`src/app/error.tsx` s'appelle `GlobalError` mais c'est une boundary de segment, pas
`global-error.tsx`.

**E2 — `environment` forcé à `NODE_ENV`.** `sentry.server.config.ts` et
`sentry.client.config.ts` passent `environment: process.env.NODE_ENV` ; le SDK 10.49.0 aurait pris
`SENTRY_ENVIRONMENT`, puis `vercel-${VERCEL_ENV}` (serveur) / `vercel-${NEXT_PUBLIC_VERCEL_ENV}`
(client) (`node_modules/@sentry/nextjs/build/cjs/server/index.js`, `client/index.js`,
`common/getVercelEnv.js`). Conséquence : un événement de preview et un événement de production
portent le même environnement « production ».

**E3 — Options mortes dans `next.config.mjs`.** `hideSourceMaps: true`, `dryRun: …` : absentes des
types `node_modules/@sentry/nextjs/build/types/config/types.d.ts` et du code compilé (grep : 0).
`disableLogger` est déprécié au profit de `webpack.treeshake.removeDebugLogging`. Sans
`SENTRY_AUTH_TOKEN`, le plugin journalise « No auth token provided. Will not upload source maps »
(`@sentry/bundler-plugin-core/dist/cjs/index.js`). Le sort des fichiers `.map` du navigateur sans
jeton (`deleteSourcemapsAfterUpload` forcé à `true` dans `config/webpack.js`) n'a pas été vérifié
par un build.

**E4 — Release.** Résolue au build : `release.name`, sinon variables CI (dont
`VERCEL_GIT_COMMIT_SHA`, `@sentry/node-core` `sdk/api.js`), sinon révision git
(`getFinalConfigObjectUtils.js`). Rien à faire.

**E5 — Init serveur conditionnée à `SENTRY_DSN` seul** (`src/instrumentation.ts`), alors que
`sentry.server.config.ts` accepte aussi `NEXT_PUBLIC_SENTRY_DSN`. Effet en prod selon les variables
définies (registre privé du programme) ; écart avec CLAUDE.md.

**E6 — Mode test côté navigateur.** `sentry.client.config.ts` lit `process.env.TEST_MODE`, que Next
n'injecte pas dans le bundle client (pas de préfixe `NEXT_PUBLIC_`) : toujours `false`. Côté serveur,
`isTestModeEnabled()` (`src/lib/auth/test-mode-env.ts`) fait foi.

**E7 — `logger` perd les erreurs imbriquées.** `src/lib/logger.ts` : `JSON.stringify(entry)` ;
`node -e 'console.log(JSON.stringify({error:new Error("boom")}))'` → `{"error":{}}`. Et si le 2e
argument est un objet, Sentry reçoit `captureMessage` (pas de pile, regroupement par message).
Appels touchés au relevé : `src/lib/services/orders/announce.ts`
(`{ orderId, err: result.reason }`), `cron/auto-cancel` (`{ shopId, error: pause.reason }`),
`src/lib/notifications.ts` (`{ orderId, error: e }`). `withRequestId` existe mais n'est appelé
nulle part.

**E8 — `handleApiError` ne prévient pas Sentry quand la base tombe.** `src/lib/api/errors.ts` :
la branche « Can't reach database / ETIMEDOUT / Connection pool timeout… » fait `console.error`
puis `return apiError("INTERNAL_ERROR", …)` (500) **avant** `Sentry.captureException`. Une panne de
base n'ouvre donc aucun issue. Reconnaissance par texte du message : le passage aux codes Prisma
(`mapPrismaError`) est décrit dans `api-route-conventions`, references/wrapper.md § 4b — ce skill
y ajoute une seule exigence, l'appel à Sentry sur cette branche.

**E9 — `sendEmail` maquille les échecs.** `src/lib/email.ts` : sans `RESEND_API_KEY` → `logger.info`
avec l'adresse du destinataire (donnée personnelle) puis `return true` ; avec clé,
`client.emails.send` (Resend 6.9.1) **ne lève jamais**, même sur une panne réseau : il renvoie
`{ data: null, error }` (`node_modules/resend/dist/index.mjs`, `fetchRequest`) ; le `try/catch` ne
voit rien, la fonction renvoie `true`.

**E10 — Push sans délai et faux succès.** `src/lib/push.ts` : sans VAPID → `return true` ;
`webpush.sendNotification` sans `{ timeout }` ; `console.error` / `console.warn` au lieu de `logger`.

**E11 — Redis sans borne.** `src/lib/redis.ts` et `edgeRedis` de `src/middleware.ts` créent
`new Redis({ url, token })` : 5 nouvelles tentatives réseau, backoff `Math.exp(i) * 50` ms
(4,3 s d'attente cumulée, mesurés par `scripts/upstash-timeout-check.mjs`), aucun délai par requête.
`checkRateLimit` (`src/lib/rate-limit.ts`) : `timeout` par défaut 5 000 ms puis passage
(`@upstash/ratelimit` 2.0.8). `console.warn` au lieu de `logger.warn`. À corriger en priorité :
le middleware a 25 s pour répondre [S23].

**E12 — `/api/health`.** `src/app/api/health/route.ts` : ping base sans délai (la sonde attend
jusqu'à la limite de la fonction) ; Redis en échec ⇒ 503 global ; `version: "2.0.0"` figé ; Redis
non configuré ⇒ `"skip"` (ne distingue pas « non configuré » de « sain ») ; pas de `Cache-Control`.

**E13 — `fetch` sortants.** 13 fichiers serveur font `await fetch(` (plus
`lib/notification-sound.ts`, exécuté dans le navigateur) ; 5 seulement posent un délai
(`cron/seo-audit`, `cron/bing-daily`, `boucher/images/proxy`, `boucher/images/import`,
`lib/image-search.ts`). Sans délai : `lib/whatsapp.ts`, `lib/indexnow.ts`, `lib/seo/indexnow.ts`,
`lib/recipe-generator.ts`, et le téléchargement des images Replicate dans quatre routes
(`admin/images/generate`, `boucher/images/generate`, `boucher/images/retouch`,
`dashboard/marketing/generate-visual`). Google Places (`admin/scrape-butchers`) passe par
`@googlemaps/google-maps-services-js` avec `timeout: 10_000` : conforme. Anthropic : 3
`new Anthropic({ apiKey })` sans `timeout` (défaut 10 min, 2 retries —
`node_modules/@anthropic-ai/sdk/client.js`), dans des fonctions limitées à 30 s.

**E14 — Crons sans moniteur.** 15 crons dans `vercel.json`, aucun `withMonitor` /
`captureCheckIn`. Un cron qui ne tourne plus (projet en pause, `CRON_SECRET` changé, route
supprimée — cas de `/api/cron/recipes` qui échouait chaque jour depuis le 2026-06-15) ne se voit
pas. Vercel ne relance pas un cron en échec et peut en manquer ou en doubler un [S27].

**E15 — Sonde externe unique et fragile.** `.github/workflows/uptime.yml` (toutes les 6 h) : bon
contrôle (`x-vercel-error`, 3 tentatives) mais désactivable après 60 jours sans activité [S12].

## 3. Ce qui est déjà bien (à garder)

- Middleware non instrumenté par Sentry (`webpack.autoInstrumentMiddleware: false`).
- Replay : `maskAllText`, `blockAllMedia`, 5 % des sessions, 100 % sur erreur, prod seulement.
- `beforeSend` qui jette les digests `NEXT_*` ; `ignoreErrors` court (signaux Next, `RouteError`,
  bruit `ResizeObserver`, et côté navigateur « Non-Error promise rejection captured »).
- `cron/auto-cancel` : budget de temps (`EXPIRY_BUDGET_MS`), `Promise.allSettled`, compte des
  restes, `logger.info` de fin de run — modèle pour les autres crons (à la forme `{ error }` près, E7).
- `sendNotification` : un `try/catch` + `logger.error(…, e)` par canal, l'`Error` passée seule.
- `uptime.yml` sans permission ni secret.
