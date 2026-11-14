---
name: reliability-observability
description: >-
  Fiabilité et observabilité de Klik&Go (Next 14.2.35 sur Vercel, @sentry/nextjs 10.49.0,
  Prisma 6.19 sur Railway, Upstash). Politique d'erreurs (ce qu'un catch peut avaler ou non),
  logs structurés (src/lib/logger.ts), Sentry serveur et navigateur (environnement, release,
  échantillonnage, bruit, boundaries error.tsx et global-error.tsx, moniteurs de crons, Uptime,
  alertes), délai et nouvelle tentative sur chaque appel externe (fetch, Upstash, Resend, web-push,
  Anthropic, Prisma), dégradation quand Redis ou la base ralentit, /api/health, surveillance
  externe à Vercel, sauvegardes et exercice de restauration PostgreSQL, runbooks d'incident et
  post-mortem, avec la panne de novembre 2026 comme cas d'école. À charger avant de toucher
  sentry.*.config.ts, src/instrumentation.ts, src/lib/logger.ts, src/lib/redis.ts,
  src/lib/rate-limit.ts, src/lib/email.ts, src/lib/push.ts, src/app/api/health, un error.tsx,
  un cron, .github/workflows/uptime.yml, ou un catch qui ne relance pas.
when_to_use: >-
  Mots-clés - Sentry, logger, console.error, catch vide, try/catch, erreur avalée, timeout,
  AbortSignal, retry, backoff, Redis lent, Upstash, Resend, push, health check, uptime, sonde,
  alerte, cron raté, panne, incident, post-mortem, runbook, sauvegarde, backup, restauration, PITR,
  pg_dump, 402, 503, site down, « personne n'a rien reçu ».
---

# Fiabilité et observabilité — Klik&Go

Objectif : **une panne se voit en minutes, depuis l'extérieur, et chaque erreur utile arrive une
fois, avec son contexte, chez quelqu'un qui peut agir.** Une équipe d'une personne ne lit pas des
tableaux de bord : elle reçoit peu d'alertes, toutes actionnables [S5].

État décrit : arbre de travail du 2026-11-14 (HEAD `32c581f` + chantier « prix des commandes » non
commité, **fichiers encore en mouvement**). Un chemin ou un compte cité ici se revérifie avant
usage (outils ci-dessous). Variables présentes en production : registre privé du programme.

Skills voisins (ne pas dupliquer) : `api-route-conventions` (fabrique de handler, `x-request-id`,
`handleApiError` et `mapPrismaError` par code Prisma), `vercel-cost-performance` (CPU, matcher,
pare-feu), `background-jobs-notifications` (crons, transports, outbox), `prisma-expert`
(`withTxRetry`, pool), `nextjs-app-router` (`error.tsx`, ISR), `security-multitenant` (secrets,
PII), `testing-strategy`, `conformite-france`. Si l'un manque dans `.claude/skills/`, appliquer
CLAUDE.md et ce skill.

## Outils du skill (lecture seule, depuis la racine du dépôt)

```bash
python3 -I ${CLAUDE_SKILL_DIR}/scripts/audit-catches.py .    # catch vides ou muets, par zone (heuristique regex)
node ${CLAUDE_SKILL_DIR}/scripts/upstash-timeout-check.mjs   # délais Upstash prouvés en local (~7 s, 127.0.0.1 seulement)
```

## 1. Leçon de novembre 2026 (à relire avant toute décision de surveillance)

Du 2026-11-05 17:13 UTC au 2026-11-13, klikandgo.app a répondu `402 DEPLOYMENT_DISABLED` (quota
CPU Vercel dépassé). **Aucune alerte automatique n'est partie pendant toute la panne** : Sentry et
les crons d'audit tournaient dans le projet suspendu ; il n'existait aucune sonde hors plateforme,
et celle ajoutée depuis (`uptime.yml`, GitHub Actions planifié) peut être coupée par GitHub après
60 jours sans activité sur ce dépôt public [S12]. Post-mortem : [references/incidents-runbooks.md](references/incidents-runbooks.md) § 4.

Règles qui en découlent :
1. **Une sonde ne tourne jamais sur la plateforme qu'elle surveille.** Sentry Uptime (chez Sentry,
   hors Vercel) [S3] sur `/api/health` d'abord ; `uptime.yml` reste un second filet.
2. **Un cron critique déclare son absence** : moniteur Sentry Crons (`withMonitor`) ; un check-in
   manquant produit un événement d'erreur [S2] — il détecte aussi une plateforme en pause.
3. **Un mail de plateforme est une alerte** : quota, paiement, sécurité vont dans une boîte lue
   (action du propriétaire, § 9).
4. **Compter les moniteurs avant d'en promettre** : chaque plan Sentry inclut 1 moniteur Uptime
   et 1 moniteur Cron ; au-delà, budget à la demande réservé aux plans payants [S26] (§ 7, point H).

## 2. Politique d'erreurs : qui peut avaler quoi

Un `catch` qui ne relance pas rend l'erreur invisible à Sentry sauf appel explicite [S1].

| Situation | Décision | Trace exigée |
| --- | --- | --- |
| Erreur imprévue dans un handler | la laisser remonter au `catch` du handler → `handleApiError` (500 + Sentry) ; ne pas l'attraper plus bas pour continuer | rien de plus (pas de `logger.error` en double : deux événements) |
| 4xx attendu (Zod, 401, 404, 409) | réponse typée | aucune (ni Sentry ni `error`) |
| Base injoignable dans un handler | `handleApiError` ; code HTTP = contrat d'`api-route-conventions` (500 aujourd'hui, point I) | **Sentry obligatoire** (absent aujourd'hui : E8) |
| Cache Redis absent ou en erreur | avaler, calculer sans cache | `logger.warn` une ligne, sans Sentry |
| Rate limit en erreur | fail-open (choix actuel de `checkRateLimit`) | `logger.warn` ; point à arbitrer C |
| Notification après une mutation réussie (e-mail, push, in-app) | ne pas faire échouer la mutation | `logger.error` **avec** `orderId`/`shopId` et l'`Error` |
| Itération d'un cron (une boutique, une commande) | continuer la boucle | compter `failed`, `logger.error` par item, résumé en fin de run |
| Écriture métier (commande, statut, prix, stock, remise) | **jamais avalée** | relancer ; transaction annulée |
| SDK qui renvoie `{ error }` au lieu de lever (Resend) | tester `error` | traiter comme une exception |
| Configuration absente **en production** (clé Resend, VAPID, Upstash) | pas de faux succès | `logger.error` une fois par instance + `health` le montre (détail servi au seul appel authentifié : § 7) |

Interdits, présents dans l'arbre au 2026-11-14 (inventaire : [references/etat-du-code.md](references/etat-du-code.md)) :
- `catch {}` autour d'un envoi ou d'une itération de cron (`cron/weekly-report`,
  `cron/calendar-alerts`, parrainage dans `admin/shops/[shopId]/validate`) : l'envoi est perdu et
  personne ne le sait ; le cron répond `sentCount` sans dire combien ont échoué.
- Renvoyer `true` quand rien n'est parti (`sendEmail` sans clé ou sur `{ error }`,
  `sendPushNotification` sans VAPID).
- `catch { // silent }` qui remet un état sans trace (`dashboard/campaigns/[campaignId]/send`).
- `console.*` dans `src/app/api` et `src/lib` : passer par `logger` (JSON en prod, Sentry pour `error`).

## 3. Logs structurés (`src/lib/logger.ts`)

- Forme : `logger.<niveau>("[zone/action] fait", { orderId, shopId, error })` — message fixe
  (regroupable), variables dans l'objet. Pas d'e-mail, téléphone, nom, adresse, token : des ids.
- Niveaux : `error` = quelqu'un doit agir (part chez Sentry en prod) ; `warn` = dégradé attendu ;
  `info` = fin de run de cron, transition notable ; `debug` = jamais en prod.
- **Défaut actuel (E7)** : une `Error` rangée dans l'objet (`{ error }`, `{ err }`) devient `{}`
  dans la ligne JSON et Sentry reçoit un `captureMessage` sans pile — c'est le cas d'`announce.ts`
  et même de `cron/auto-cancel`. Correctif : [references/logs-et-sentry.md](references/logs-et-sentry.md) § 1,
  **à livrer avant d'ajouter des appels de cette forme** ; d'ici là, quand la pile compte :
  `logger.error("…", err)` (l'`Error` seule en 2e argument).
- Vercel garde au plus **1 jour** de logs runtime (Pro ; 1 h sur Hobby), 256 lignes et 1 Mo par
  requête [S8] : ce qui doit
  servir après 24 h va dans Sentry (erreurs) ou en base (journal métier, `OrderEvent`).
- Durée de conservation : nos logs techniques ne doivent pas contenir de donnée personnelle ; un
  journal d'accès à des données personnelles relève du repère CNIL de 6 mois à 1 an [S24]
  (`conformite-france`).

## 4. Sentry : état et cible

Installé : `@sentry/nextjs` 10.49.0, Next 14.2.35 (`experimental.instrumentationHook: true`).
Serveur chargé par `src/instrumentation.ts` (Node seulement ; middleware volontairement non
instrumenté — ne pas revenir dessus, CLAUDE.md). Navigateur : `sentry.client.config.ts`, injecté
par le plugin webpack du SDK (son avertissement de dépréciation au build est attendu ; le
renommage en `instrumentation-client.ts` appartient à la migration Next 15+, `nextjs-app-router`).
Écarts à corriger, détail et code compilé dans [references/logs-et-sentry.md](references/logs-et-sentry.md) :

1. **Aucune boundary ne prévient Sentry** : les 6 `error.tsx` font `console.error`, et il n'y a pas
   de `src/app/global-error.tsx` [S1][S9]. Une erreur de rendu est invisible.
2. `environment: process.env.NODE_ENV` écrase le défaut du SDK (`vercel-production` /
   `vercel-preview`, lu dans `VERCEL_ENV` et `NEXT_PUBLIC_VERCEL_ENV` [S25]) : retirer l'option.
3. `hideSourceMaps` et `dryRun` (`next.config.mjs`) n'existent pas en v10 : options mortes. Sans
   `SENTRY_AUTH_TOKEN` aucune source map n'est envoyée : piles non résolues vers nos sources.
4. `onRequestError` / `captureRequestError` exigent Next 15 [S1] : ne pas l'ajouter en 14.
5. Échantillonnage : `tracesSampler` avec `inheritOrSampleWith` [S4] — 0 pour `/api/health`,
   1 pour `/api/cron/*`, 0,1 sinon.
6. Bruit : garder la liste `ignoreErrors` de CLAUDE.md ; pour une règle précise, regex ou
   `beforeSend` (une chaîne filtre par correspondance partielle) [S4b].

Alertes à créer (et rien d'autre au début) [S6] : nouvel issue en `vercel-production` ; issue
régressé ; moniteur Uptime en échec ; check-in de cron manqué ou en erreur. Destination : e-mail +
téléphone du propriétaire. Un moniteur Uptime ne notifie que si une règle d'alerte le prévoit
[S3] : chaque alerte se prouve par un test avant d'être comptée.

## 5. Délais et nouvelles tentatives : chaque appel externe a une borne

Règle : **délai explicite partout, nouvelle tentative à une seule couche, seulement si l'opération
est idempotente, avec backoff et jitter** [S10][S11]. Budget : 30 s par fonction (`vercel.json`),
25 s pour le middleware [S23] ; `(retries + 1) × délai` de tous les appels d'un handler doit tenir
dedans avec marge.

| Dépendance | Défaut réel (vérifié dans `node_modules`) | Cible |
| --- | --- | --- |
| `fetch` (Bing, IndexNow, WhatsApp, images Replicate…) | aucun délai | `signal: AbortSignal.timeout(5_000)` |
| `@upstash/redis` 1.36.2 | 5 retries réseau, backoff `exp(i)×50` ms (4,3 s d'attente mesurés), aucun délai par requête | `retry: { retries: 1, backoff: () => 50 }`, `signal: () => AbortSignal.timeout(800)` |
| `@upstash/ratelimit` 2.0.8 | `timeout` 5 000 ms puis laisse passer | `timeout: 1_000` |
| Middleware (`edgeRedis`, cache de rôle) | idem Redis | mêmes options |
| Resend 6.9.1 | pas de délai, **ne lève jamais** : renvoie `{ error }` | tester `error`, `idempotencyKey`, après la transaction |
| `web-push` 3.6.7 | pas de délai | `{ timeout: 5_000 }` (délai de socket) |
| Anthropic SDK 0.74 | 10 min, 2 retries (un délai dépassé est retenté) | `timeout: 12_000, maxRetries: 1` (≈ 25 s au pire) |
| Prisma 6.19 | `connect_timeout` 5 s, `pool_timeout` 10 s [S13] ; transaction `maxWait` 2 s, `timeout` 5 s | garder ; seul `P2034` se rejoue (`withTxRetry`, `prisma-expert`) |

Piège Upstash : un `signal` **statique** (`signal: AbortSignal.timeout(800)`) expire 800 ms après
le chargement du module, puis **toutes** les commandes de l'instance échouent (réponse fabriquée
par le SDK, `TypeError` ou résultat vide). Toujours la forme fonction `() => AbortSignal.timeout(ms)`.
Patrons complets : [references/appels-externes.md](references/appels-externes.md).

## 6. Dégradation : ce qui continue quand une dépendance flanche

| Panne | Comportement attendu | Signal |
| --- | --- | --- |
| Upstash lent ou absent | pages et commandes servies sans cache ; rate limit fail-open ; rôle middleware relu chez Clerk | `logger.warn`, `health.redis` |
| Base injoignable (P1001, P1017, P2024, init) | réponse d'erreur neutre de `handleApiError` ; pages ISR déjà générées servies depuis le cache [S16] | Sentry (aujourd'hui **aucun** événement sur cette branche : E8) ; `health` 503 |
| Resend / VAPID absents | la commande aboutit ; l'échec est journalisé, pas maquillé | `logger.error` une fois + `health` |
| Anthropic / Replicate lents | la fonctionnalité IA répond « indisponible » avant la limite de la fonction | `logger.warn` |

Ne jamais « réparer » une base injoignable au build par un `try/catch` à valeur vide (CLAUDE.md).

## 7. Santé et surveillance externe

`/api/health` (hors matcher Clerk, `force-dynamic`) : cible dans
[references/sante-et-surveillance.md](references/sante-et-surveillance.md) — base et Redis sondés
en parallèle, base bornée à 3 s, **503 seulement si la base tombe** (Redis en panne = `degraded`
en 200, sinon l'alerte sonne pour un cache), `not_configured` distinct de `ok`, `release` =
`VERCEL_GIT_COMMIT_SHA` au lieu de `"2.0.0"`, `Cache-Control: no-store`. La route est publique :
un appel anonyme ne reçoit que `status` (et le code HTTP) ; le détail par dépendance, qui dit ce qui
est configuré en production, n'est servi qu'à l'appel porteur du secret des crons.

| Quota de moniteurs Sentry [S26] | Uptime | Crons |
| --- | --- | --- |
| Inclus dans tout plan : 1 + 1 | `https://klikandgo.app/api/health`, 5 min (il voit aussi le 402 de plateforme) | `auto-cancel` (prouve aussi que Vercel lance encore les crons) |
| Plan payant + budget à la demande (point H) | ajouter `https://klikandgo.app/` | `ready-reminder`, `recurring-orders`, puis le reste |

Sentry Uptime ouvre un issue après 3 échecs de suite (≈ 15 min à 5 min d'intervalle), depuis des
régions en alternance [S3]. `uptime.yml` (6 h) reste le second filet.

## 8. Sauvegardes et restauration PostgreSQL (Railway)

- Les sauvegardes Railway restent **dans le même projet** ; vider un volume supprime ses
  sauvegardes [S14]. Il faut donc aussi une copie **hors Railway** (`pg_dump -Fc` chiffré).
- PITR Railway (pgBackRest, ~4 semaines, non rétroactif) restaure dans un **nouveau service** qui
  n'archive plus ; la bascule (`DATABASE_URL` et `DIRECT_DATABASE_URL` sur Vercel, redéploiement)
  est manuelle [S15].
- Une sauvegarde jamais restaurée n'est pas une sauvegarde : exercice trimestriel chronométré sur
  une base jetable locale, jamais sur la prod, avec `DATABASE_URL` **et** `DIRECT_DATABASE_URL`
  pointées sur cette base. Procédure : [references/sauvegardes-restauration.md](references/sauvegardes-restauration.md).
- `audit/db-runbook.md` § 3 (« PITR Pro+, granularité ~5 min ») ne correspond pas à la doc
  Railway lue : suivre la référence ci-dessus.

## 9. Incidents

Runbooks (site 402/5xx, base injoignable, Redis lent, e-mails non reçus, cron muet, fuite de
secret) et gabarit de post-mortem sans blâme [S7] : [references/incidents-runbooks.md](references/incidents-runbooks.md).
Déclencheurs de post-mortem (types tirés de [S7], seuils fixés par ce skill) : indisponibilité
visible > 15 min, perte de données, rollback, incident découvert à la main.

Actions réservées au propriétaire (l'agent ne crée pas de compte, ne saisit pas de secret) :
alertes Sentry et Uptime, plan Sentry, `SENTRY_AUTH_TOKEN`, clés Resend / Upstash / VAPID, PITR
Railway, stockage hors plateforme, filtre de boîte mail pour les mails Vercel et Railway.

## 10. Points à arbitrer

Détail et options : [references/points-a-arbitrer.md](references/points-a-arbitrer.md).
- **A.** CLAUDE.md « Monitoring » décrit `hideSourceMaps` et `dryRun`, sans effet en v10 ; et
  « SDK initialisé si `SENTRY_DSN` (ou `NEXT_PUBLIC_SENTRY_DSN`) » alors que
  `instrumentation.ts` ne teste que `SENTRY_DSN`. Mettre la doc à jour ?
- **B.** CLAUDE.md « Sentry désactivé quand le mode test est actif » : vrai côté serveur, faux côté
  navigateur (`sentry.client.config.ts` lit `TEST_MODE`, inexistant dans le bundle client).
- **C.** Rate limit fail-open quand Redis tombe : acceptable pour la lecture, discutable pour
  OTP et commande invité.
- **D.** Configuration manquante en production : échouer au démarrage, ou démarrer en `degraded` ?
- **E.** Région `sfo1` alors que la clientèle est en France : à trancher avec
  `vercel-cost-performance` § 8 E.
- **F.** Moniteurs de crons : `withMonitor` manuel ou `_experimental.vercelCronsMonitoring`.
- **G.** Hébergeur du dump hors plateforme (ni Vercel, ni seulement Railway).
- **H.** Plan Sentry et budget de moniteurs : rester à 1 Uptime + 1 Cron, ou payer les suivants.
- **I.** Base injoignable : garder 500 `INTERNAL_ERROR` ou passer à 503 (contrat d'`api-route-conventions`).

## Définition de terminé (travail touchant ce domaine)

- [ ] Aucun `catch` nouveau sans ligne correspondante du tableau § 2 ; aucun `console.*` dans
      `src/app/api` ni `src/lib` ; pas de faux `true`.
- [ ] Chaque appel externe ajouté a un délai explicite, au plus une couche de retry, et
      `(retries + 1) × délai` tient dans le budget de la fonction.
- [ ] Une erreur provoquée (base coupée en local, clé absente) apparaît une seule fois dans Sentry
      avec `route` et un id métier, et la ligne JSON contient `message` et `stack`.
- [ ] Une nouvelle `error.tsx` appelle `Sentry.captureException` ; un nouveau cron critique a son
      moniteur, dans la limite du quota (§ 7).
- [ ] `/api/health` reste hors matcher, sans session, et répond en moins de 3,5 s même base coupée ;
      un appel anonyme ne reçoit que `status`.
- [ ] Aucun secret, e-mail ou téléphone dans un log, un tag ou un `extra` Sentry.
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run test` passent ; le test du matcher passe.
- [ ] Si un incident a déclenché le travail : post-mortem écrit et actions datées.

Sources : [references/sources.md](references/sources.md) (identifiants [S…] ci-dessus).
