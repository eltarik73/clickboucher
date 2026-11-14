# Sources

Toutes consultées le 2026-11-14 par le formateur, puis rouvertes une à une le même jour par le
vérificateur (chaque ligne ci-dessous a été relue contre la page citée). Étoiles et dernier push
relevés par `gh api repos/OWNER/REPO` le 2026-11-14. Les dépôts officiels d'outils que nous
utilisons sont acceptés sous la barre des 3 000 étoiles (règle du programme).

## Sources externes

| Id | Source | Ce qu'elle appuie | Crédibilité |
| --- | --- | --- | --- |
| S1 | Sentry — Next.js, manual setup · https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/ ; capturing errors · https://docs.sentry.io/platforms/javascript/guides/nextjs/capturing-errors/ | `global-error.tsx` avec `captureException` ; `onRequestError` exige Next 15 et SDK ≥ 8.28 ; une erreur attrapée sans relance n'est pas vue ; `captureException` dans chaque boundary | Documentation officielle Sentry ; SDK `getsentry/sentry-javascript` 8 774 ★, push 2026-11-14, non archivé |
| S2 | Sentry — Next.js Crons · https://docs.sentry.io/platforms/javascript/guides/nextjs/crons/ | `withMonitor`, `monitorConfig` (schedule, checkinMargin et maxRuntime en minutes, timezone, seuils) ; check-in manqué ⇒ événement d'erreur marqué du moniteur, alerte sur `monitor.slug` ; `automaticVercelMonitors` limité à webpack + Pages Router ; `_experimental.vercelCronsMonitoring` ; 6 check-ins par minute et par environnement de moniteur | Documentation officielle Sentry |
| S3 | Sentry — Uptime Monitoring · https://docs.sentry.io/product/uptime-monitoring/ | intervalles (1 min à 1 h), 2xx attendu, redirections suivies, délai 10 s (la page mentionne aussi un réglage jusqu'à 30 s), régions en alternance, 3 échecs par défaut, 1 succès pour clore, alerte à configurer | Documentation officielle Sentry |
| S4 | Sentry — Sampling · https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/sampling/ | `tracesSampler` prioritaire, `inheritOrSampleWith` (SDK ≥ 9), commencer bas | Documentation officielle Sentry |
| S4b | Sentry — Filtering · https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/filtering/ | `ignoreErrors` (correspondance partielle pour une chaîne, regex pour l'exact), `beforeSend`, `denyUrls`/`allowUrls` | Documentation officielle Sentry |
| S5 | Google SRE Book, ch. 6 « Monitoring Distributed Systems » · https://sre.google/sre-book/monitoring-distributed-systems/ | signaux d'or ; symptômes avant causes ; une alerte doit être urgente et actionnable ; erreurs implicites | Google, livre SRE (O'Reilly 2016), publié en ligne par Google |
| S6 | Sentry — Alerts best practices · https://docs.sentry.io/product/alerts/best-practices/ | ne garder que les déclencheurs qui comptent (exemples : nouvel issue, retour de résolu à non résolu, seuil de fréquence), routage. **Ne recommande pas** de filtre par environnement : choix de ce skill | Documentation officielle Sentry |
| S7 | Google SRE Book, ch. 15 « Postmortem Culture » · https://sre.google/sre-book/postmortem-culture/ | types de déclencheurs, à définir avant l'incident ; sans blâme ; revue ; dépôt partagé. **Ne donne ni seuil chiffré ni délai de rédaction** : ceux du skill sont maison | Google, livre SRE |
| S8 | Vercel — Runtime Logs · https://vercel.com/docs/logs/runtime | rétention 1 h Hobby, 1 jour Pro, 30 jours avec Observability Plus ; 256 lignes et 1 Mo par requête | Documentation officielle Vercel (mise à jour 2026-08-28) |
| S9 | Next.js 14 — Error Handling · https://nextjs.org/docs/14/app/building-your-application/routing/error-handling | `error.js` ne couvre pas le layout du même segment ; `global-error.js` remplace le layout racine, avec ses `<html>`/`<body>` ; `digest` des erreurs serveur | Documentation officielle Next.js, version 14 ; `vercel/next.js` 143 507 ★, push 2026-11-14 |
| S10 | AWS Builders' Library — « Timeouts, retries, and backoff with jitter » (auteur : Marc, ingénieur AWS, 2019) · https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter | délai choisi sur un percentile de latence ; retries « égoïstes » ; une seule couche ; jitter ; idempotence | Article d'ingénierie de premier rang publié par AWS |
| S11 | Google SRE Book, ch. 22 « Addressing Cascading Failures » · https://sre.google/sre-book/addressing-cascading-failures/ | backoff exponentiel aléatoire, budget de retries, retries multipliés par couche, délais, chemins de dégradation à exercer | Google, livre SRE |
| S12 | GitHub Docs — Disabling and enabling a workflow · https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/disabling-and-enabling-a-workflow | dépôt public : workflows planifiés désactivés après 60 jours sans activité du dépôt | Documentation officielle GitHub |
| S13 | Prisma — Connection pool · https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool | v6 : `pool_timeout` 10 s, `connect_timeout` 5 s ; pooler externe en serverless | Documentation officielle Prisma ; `prisma/prisma` 47 672 ★, push 2026-11-13 |
| S14 | Railway — Backups · https://docs.railway.com/reference/backups | planification et rétention, restauration dans le même projet et environnement, vider le volume supprime les sauvegardes, limite 50 %, fonction encore en développement | Documentation officielle Railway |
| S15 | Railway — Point-in-time recovery · https://docs.railway.com/volumes/point-in-time-recovery.md | pgBackRest, 4 complètes gardées (≈ 4 sem.), non rétroactif, nouveau service non archivé, bascule manuelle, tag majeur, WAL abandonnés si le stockage tombe, coût = bucket + trafic, identifiants d'archive en écriture | Documentation officielle Railway |
| S16 | Next.js 14 — Fetching, Caching, and Revalidating · https://nextjs.org/docs/14/app/building-your-application/data-fetching/fetching-caching-and-revalidating | erreur pendant la revalidation ⇒ dernière version générée servie, nouvelle tentative à la requête suivante | Documentation officielle Next.js 14 |
| S17 | Upstash — Redis TS SDK, retries · https://upstash.com/docs/redis/sdks/ts/retries | 5 retries sur erreur réseau, backoff `exp(n)*50` ms | Documentation officielle Upstash ; `upstash/redis-js` 986 ★ (dépôt officiel), push 2026-11-13 |
| S18 | Upstash — Ratelimit features · https://upstash.com/docs/redis/sdks/ratelimit-ts/features | `timeout` 5 s puis passage (`reason`) ; cache éphémère actif par défaut | Documentation officielle Upstash ; `upstash/ratelimit-js` 2 052 ★ (officiel), push 2026-11-12 |
| S19 | Anthropic TypeScript SDK installé · `node_modules/@anthropic-ai/sdk/client.d.ts` et `client.js` (0.74.0) | `timeout` 10 min par défaut, `maxRetries` 2, délais dépassés retentés | Dépôt officiel `anthropics/anthropic-sdk-typescript` 2 176 ★, push 2026-11-10 |
| S20 | `prisma/prisma-engines`, `libs/user-facing-errors/src/{common.rs,query_engine/mod.rs}` | messages de P1001, P1002, P1008, P1017, P2002, P2024, P2025, P2028, P2034 | Dépôt officiel Prisma (1 340 ★, push 2026-11-13), relu par `gh api` |
| S21 | PostgreSQL 16 — pg_dump · https://www.postgresql.org/docs/16/app-pgdump.html | format custom compressé, cohérent sans bloquer, refus d'un serveur plus récent, rechargement dans un serveur plus ancien non garanti | Documentation officielle PostgreSQL |
| S22 | Vercel — Instant Rollback · https://vercel.com/docs/instant-rollback | Pro : tout déploiement de production éligible (Hobby : le précédent seulement) ; auto-assignation coupée ensuite (« Manage » / `vercel promote`) ; variables non mises à jour ; crons restaurés, « Disable Cron Jobs » persistant | Documentation officielle Vercel (2026-07-07) |
| S23 | Vercel — Error codes · https://vercel.com/docs/errors/DEPLOYMENT_DISABLED , https://vercel.com/docs/errors/MIDDLEWARE_INVOCATION_TIMEOUT | `DEPLOYMENT_DISABLED` 402 (quota, pause, retour à Hobby) ; `MIDDLEWARE_INVOCATION_TIMEOUT` 504, réponse exigée en 25 s | Documentation officielle Vercel |
| S24 | CNIL — Recommandation journalisation (délib. 2021-122 du 14 octobre 2021) · https://www.cnil.fr/fr/la-cnil-publie-une-recommandation-relative-aux-mesures-de-journalisation | journaux d'accès et d'actions sur un traitement de données personnelles : conservation de 6 mois à 1 an | Autorité française de protection des données ; détail : skill `conformite-france` |
| S25 | Vercel — Framework environment variables · https://vercel.com/docs/environment-variables/framework-environment-variables | `NEXT_PUBLIC_VERCEL_ENV` (production / preview / development) fourni au build et à l'exécution ; préfixe non ajouté en local | Documentation officielle Vercel (2026-09-16) |
| S26 | Sentry — Pricing & Billing · https://docs.sentry.io/pricing/ ; Manage Cron and Uptime Monitors · https://docs.sentry.io/pricing/quotas/manage-cron-monitors/ | tout plan inclut 1 moniteur Cron et 1 moniteur Uptime ; suivants sur budget à la demande, réservé aux plans payants ; 0,78 $ / 1,00 $ par moniteur ; désactivation d'office sans budget | Documentation officielle Sentry (tarifs : à relire avant de chiffrer) |
| S27 | Vercel — Cron Jobs · https://vercel.com/docs/cron-jobs , https://vercel.com/docs/cron-jobs/manage-cron-jobs , https://vercel.com/docs/cron-jobs/usage-and-pricing | UTC ; pas de nouvelle tentative ; livraison au mieux (manque ou doublon) ; précision à la minute sur Pro, à l'heure sur Hobby ; `CRON_SECRET` figé au build ; redirections non suivies ; règle de pare-feu | Documentation officielle Vercel (2026-09-16, 2026-08-11, 2026-07-15) |
| S28 | Vercel — Configuring Maximum Duration · https://vercel.com/docs/functions/configuring-functions/duration | `maxDuration` dans le fichier de route ou dans `vercel.json` (priorité entre les deux non écrite) ; `vercel inspect --json` | Documentation officielle Vercel (2026-08-24) |

## Preuves locales (code installé et dépôt)

| Id | Constat | Reproduire |
| --- | --- | --- |
| L1 | Défaut d'environnement du SDK : `options.environment ‖ SENTRY_ENVIRONMENT ‖ vercel-${VERCEL_ENV} ‖ NODE_ENV`, puis `...options` (une clé `environment: undefined` l'efface) | `node_modules/@sentry/nextjs/build/cjs/server/index.js`, `client/index.js`, `common/getVercelEnv.js` |
| L2 | `hideSourceMaps`, `dryRun` absents des types et du code de `@sentry/nextjs` 10.49.0 | `grep -rln 'hideSourceMaps\|dryRun' node_modules/@sentry/nextjs/build` (0) |
| L3 | Sans jeton : « No auth token provided. Will not upload source maps » ; release résolue par `release.name`, variables CI (`VERCEL_GIT_COMMIT_SHA`), révision git | `@sentry/bundler-plugin-core/dist/cjs/index.js` ; `@sentry/nextjs/build/cjs/config/withSentryConfig/getFinalConfigObjectUtils.js` |
| L4 | `@upstash/redis` 1.36.2 et `@upstash/ratelimit` 2.0.8 : 4,3 s d'attente par défaut sur connexion refusée ; signal fonction ⇒ `TimeoutError` à 800 ms ; ratelimit ⇒ `success: true, reason: "timeout"` ; signal statique expiré ⇒ réponse fabriquée (`TypeError: res.map is not a function`) | `node .claude/skills/reliability-observability/scripts/upstash-timeout-check.mjs` (code retour 0 le 2026-11-14) ; méthode `request` du chunk `node_modules/@upstash/redis/chunk-*.mjs` |
| L5 | `@upstash/ratelimit` 2.0.8 : `timeout` défaut 5000 | `node_modules/@upstash/ratelimit/dist/index.mjs` (`config.timeout ?? 5e3`) |
| L6 | Resend 6.9.1 : `send()` renvoie `{ data, error }` même sur panne réseau (`statusCode: null`), `idempotencyKey` accepté | `node_modules/resend/dist/index.mjs` (`fetchRequest`, `post`), `index.d.mts` (`Response<T>`, `CreateEmailRequestOptions`) |
| L7 | Prisma 6.19.2 : `maxWait` 2000 / `timeout` 5000 par défaut ; `PrismaClientInitializationError.errorCode`, `PrismaClientKnownRequestError.code` | `node_modules/@prisma/client/runtime/library.js`, `library.d.ts` |
| L8 | `AbortSignal.timeout` disponible dans l'edge runtime de Next 14.2.35 | `node_modules/next/dist/compiled/@edge-runtime/primitives/abort-controller.js.text.js` |
| L9 | Next 14.2.35 n'implémente pas `onRequestError` | `grep -rl onRequestError node_modules/next/dist/server` (0) |
| L10 | `JSON.stringify({ error: new Error("boom") })` ⇒ `{"error":{}}` | `node -e` |
| L11 | Extraits de code de ce skill (logger, `global-error`, `Sentry.init`, Upstash, Resend, Anthropic, `withDeadline`, `/api/health`, `runCron`) compilés : `tsc` 5.9.3 du dépôt, `strict`, code retour 0, le 2026-11-14 (formateur, puis vérificateur après corrections) | tsconfig de vérification hors dépôt pointant sur `node_modules` |
| L12 | Inventaire des `catch` | `python3 -I .claude/skills/reliability-observability/scripts/audit-catches.py .` |
| L13 | `sentry.client.config.ts` injecté par le plugin webpack du SDK, avec avertissement de dépréciation ; `withMonitor` sans client = simple exécution ; `_experimental.vercelCronsMonitoring` prend le chemin du cron pour `slug` | `node_modules/@sentry/nextjs/build/cjs/config/webpack.js`, `server/vercelCronsMonitoring.js` ; `@sentry/core/build/cjs/exports.js` |
| L14 | Drapeaux de `pg_dump -Fc` et `pg_restore --no-owner --no-privileges --exit-on-error` rejoués dans un conteneur jetable (`postgres:15-alpine`, table de test) | vérificateur, 2026-11-14 |
| L15 | Chronologie de la panne : commit `27ea77b` du 2026-04-29, dernier commit avant la panne le 2026-06-12, correctifs du 2026-11-13 | `git log` (lecture seule) ; CLAUDE.md ; commentaires d'`uptime.yml` |

## Écartées, retirées ou non utilisées

| Source ou affirmation | Raison |
| --- | --- |
| Forum Railway « sauvegardes réservées au plan Pro » | Pas une page de documentation : retiré du skill, remplacé par « non vérifié, regarder l'onglet Backups » |
| Modèle Railway de dump vers S3 | Non retrouvé dans les pages lues : retiré |
| « Vercel classe `console.warn` en `error` » | Vrai seulement pour une fonction sans streaming ; les fonctions Node.js de Vercel diffusent par défaut depuis octobre 2024 (changelog Vercel) : sans objet pour nous, retiré |
| Reddit (r/nextjs, r/PostgreSQL…) | Aucune affirmation de ce skill n'en dépend |
| Conférences / YouTube | Aucune transcription consultée |
| Pages « environments » et « releases » de la doc Sentry | Ne décrivent pas le comportement Vercel ; remplacées par la lecture du SDK installé (L1, L3) |
| Brouillon du formateur précédent | Seul un script d'inventaire existait (repris en `scripts/audit-catches.py` après relecture) ; aucun `SKILL.md` |
