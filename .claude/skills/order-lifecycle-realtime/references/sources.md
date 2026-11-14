# Sources

Toutes consultées le **13/11/2026**. « Mis à jour » reprend la date affichée par la page quand elle existe. Les chiffres GitHub viennent de `gh api repos/OWNER/REPO` le même jour. Une affirmation du skill sans renvoi vient de la lecture du code de ce dépôt (commit `161f920`) ou de `node_modules` ; une affirmation suivie de `[L…]` a été exécutée (dernière section).

Règle de tri appliquée : documentation officielle et blogs d'ingénierie de première main ; dépôts officiels ou à forte adoption ; aucune règle ne repose sur un forum.

**Vérification indépendante (13/11/2026).** Un second passage a rouvert les pages et comparé chaque affirmation du skill à leur texte : V1 à V9, V11, PG1, PGB1, PR1, PR2, S1, S3, SH1, U1, U2, U3, D1 (dans le navigateur), DL1, W1, W5, W6, N1, UP2, UP4, UP5, RT1, RT2 ; les chiffres GitHub ont été relancés. Toutes concordent, aux corrections près reportées ci-dessous. N'ont pas été rouvertes (contenu repris du premier passage, non contredit par ailleurs) : V10, PG2, PR3, S2, AWS1, D2, W2, W3, W4, W8, X1, X2, UP1, UP3.

## Vercel (hébergeur, documentation officielle)

| Id | URL | Ce que la source étaye | Crédibilité |
|---|---|---|---|
| V1 | https://vercel.com/docs/functions/limitations | Durée maximale avec Fluid : 300 s par défaut, 800 s max en Pro, flux compris ; dépassement = 504 `FUNCTION_INVOCATION_TIMEOUT` ; mémoire par défaut 2 Go | Doc officielle, mise à jour 24/08/2026 |
| V2 | https://vercel.com/docs/functions/usage-and-pricing | CPU actif facturé hors attente d'E/S ; mémoire facturée tant qu'une requête est en cours ; instance mise en pause ensuite ; invocations 0,60 $ le million ; tarifs régionaux (`sfo1` 0,177 $/h et 0,0147 $/Go-h ; `cdg1` 0,177 et 0,0146 ; `iad1` 0,128 et 0,0106) | Doc officielle, mise à jour 16/06/2026 |
| V3 | https://vercel.com/docs/cron-jobs/usage-and-pricing | 100 crons par projet ; Hobby : une fois par jour, précision à l'heure ; Pro : une fois par minute, précision à la minute ; les crons sont « legacy », remplacés à terme par Schedules | Doc officielle, mise à jour 15/07/2026 |
| V4 | https://vercel.com/docs/cron-jobs/manage-cron-jobs | Pas de nouvelle tentative ; livraison « best effort » (passage manqué ou doublé) ; chevauchement possible ; production seulement ; redirections non suivies ; `CRON_SECRET` en `Bearer` ; consigne d'idempotence et de réconciliation | Doc officielle, mise à jour 11/08/2026 |
| V5 | https://vercel.com/docs/schedules et https://vercel.com/docs/schedules/limits | Schedules en bêta, appelés à remplacer les crons ; planifications dynamiques (SDK `@vercel/schedules`) vers un sujet de file uniquement ; exécution unique possible (dynamiques seulement) ; fenêtre de 1 à 15 min (1 min par défaut en Pro) | Doc officielle ; la première page est datée du 26/10/2026, la seconde affiche une date manifestement fausse (2018) |
| V6 | https://vercel.com/kb/guide/background-workers-on-vercel | Comparatif `waitUntil` / crons / Queues (bêta, délai jusqu'à 7 jours, au moins une fois) / Workflows (disponible depuis avril 2026, `sleep`) ; « toute tâche de fond peut s'exécuter plus d'une fois » | Guide officiel, publié 02/11/2026, mis à jour 07/11/2026 |
| V7 | https://vercel.com/kb/guide/publish-and-subscribe-to-realtime-data-on-vercel | Tableau de décision temps réel ; connexion épinglée à une instance ; magasin externe pour diffuser ; mises à jour peu fréquentes = sondage ; fournisseurs gérés cités | Guide officiel, mis à jour 10/09/2026 |
| V8 | https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections et https://vercel.com/changelog/websocket-support-is-now-generally-available | WebSocket natif dans les fonctions (Fluid requis), fermeture au `maxDuration`, facturation ; disponibilité générale annoncée le 20/10/2026 (le guide, daté du 01/10/2026, parle encore de bêta) | Guide et journal des changements officiels |
| V9 | https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package | `waitUntil(promise)` prolonge la vie du traitement, même délai que la fonction ; `after()` à partir de Next.js 15.1 ; `upgradeWebSocket` à partir de `@vercel/functions` 3.10.0 | Doc officielle, mise à jour 03/09/2026 |
| V10 | https://vercel.com/docs/queues | Vercel Queues en bêta, livraison au moins une fois, paquet `@vercel/queue` | Doc officielle, mise à jour 03/09/2026 (page non rouverte ; bêta et livraison au moins une fois confirmées par V6) |
| V11 | https://vercel.com/kb/guide/optimize-active-cpu-on-fluid-compute | Méthode de mesure (CPU par invocation, par route, dans Observability) ; le middleware consomme du CPU actif | Guide officiel, mis à jour 30/09/2026 |

## PostgreSQL, PgBouncer, Prisma

| Id | URL | Ce que la source étaye | Crédibilité |
|---|---|---|---|
| PG1 | https://www.postgresql.org/docs/current/transaction-iso.html | En `READ COMMITTED`, un `UPDATE` concurrent attend puis ré-évalue son `WHERE` sur la nouvelle version de la ligne ; `REPEATABLE READ` / `SERIALIZABLE` : échec de sérialisation à rejouer (`40001`) | Doc officielle PostgreSQL 18 |
| PG2 | https://www.postgresql.org/docs/current/sql-select.html | `FOR UPDATE`, `NOWAIT`, `SKIP LOCKED` (adapté aux tables consommées comme des files, vue incohérente sinon) | Doc officielle PostgreSQL 18 |
| PGB1 | https://www.pgbouncer.org/features.html | En mode transaction : `LISTEN` et verrous consultatifs de session non pris en charge | Doc officielle PgBouncer |
| PR1 | https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions | Transactions interactives (`maxWait` 2 s, `timeout` 5 s, niveau par défaut de la base), consigne « courtes et sans réseau », contrôle optimiste par `updateMany` + `count`, nouvelle tentative sur `P2034`, ordre de la forme tableau | Doc officielle Prisma ORM v6 (notre version : 6.19.2). Dépôt `prisma/orm` (nouveau nom de `prisma/prisma`) : 47 670 étoiles, dernier push 13/11/2026, non archivé |
| PR2 | https://www.prisma.io/docs/orm/v6/reference/prisma-schema-reference | `@updatedAt` est implémenté au niveau de Prisma, pas de la base | Doc officielle Prisma ORM v6 |
| PR3 | https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer | PgBouncer doit être en mode transaction ; Prisma Migrate exige une connexion directe | Doc officielle (page de la version courante de Prisma ; ces deux points valent aussi pour la v6) |

## Idempotence et messages

| Id | URL | Ce que la source étaye | Crédibilité |
|---|---|---|---|
| S1 | https://docs.stripe.com/api/idempotent_requests | Clé d'idempotence : créée par le client, UUID v4 conseillé, 255 caractères, comparaison des paramètres, purge après 24 h au moins | Doc officielle Stripe. Dépôt `stripe/stripe-node` : 4 566 étoiles, push 12/11/2026 |
| S2 | https://stripe.com/blog/idempotency | Trois modes d'échec d'un appel réseau ; nouvelles tentatives avec attente exponentielle et aléa | Blog Stripe, Brandur Leach, 22/02/2017 |
| S3 | https://docs.stripe.com/webhooks | Événements sans ordre garanti, doublons, réponse 2xx rapide, nouvelles tentatives pendant trois jours | Doc officielle Stripe |
| SH1 | https://shopify.engineering/building-resilient-payment-systems | Clés d'idempotence (ULID, uniques 24 h ou moins), réconciliation | Blog d'ingénierie Shopify, Bart de Water, 28/07/2022 |
| AWS1 | https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html | Problème de la double écriture ; table d'envoi dans la même transaction ; consommateurs idempotents | Guide officiel AWS |

## Plateformes de commande

| Id | URL | Ce que la source étaye | Crédibilité |
|---|---|---|---|
| U1 | https://www.uber.com/blog/real-time-push-platform/ | Du sondage au push : 80 % de requêtes de sondage, séparation quand / quoi / acheminement, au moins une fois, durée de vie, battement de cœur 4 s / 7 s, première génération en SSE | Blog d'ingénierie Uber, 18/12/2020 |
| U2 | https://www.uber.com/blog/fulfillment-platform-rearchitecture/ | Entités en machines à états, transactions multi-entités, actions d'après validation et minuteries écrites dans la même transaction puis exécutées au moins une fois | Blog d'ingénierie Uber, 27/07/2021 |
| U3 | https://developer.uber.com/docs/eats/guides/webhooks (et https://developer.uber.com/docs/eats/guides/order_integration pour le déroulé) | Acceptation ou refus sous 11,5 min, sinon annulation automatique ; appel automatique après 90 s pour les restaurants qui l'ont activé ; webhook : 200 à corps vide, HMAC SHA-256, 7 envois au plus. Ces chiffres sont sur la page « webhooks » | Doc développeur officielle Uber Eats |
| D1 | https://careersatdoordash.com/blog/building-a-more-reliable-checkout-service-with-kotlin/ | Étapes rejouables idempotentes, état persisté par étape, « clean failed state », client en « pull model », résultats chiffrés | Blog d'ingénierie DoorDash, 02/02/2021. Lu dans le navigateur (l'outil de récupération reçoit un 403) |
| D2 | https://careersatdoordash.com/blog/building-reliable-workflows-cadence-as-a-fallback-for-event-driven-processing/ | Chemin principal + enregistrement « in-progress » + mécanisme de secours ; trois approches de l'idempotence | Blog d'ingénierie DoorDash, Alan Lin. La page affiche le 21/10/2022 ; l'ancienne adresse `doordash.engineering` porte la date 2020/08/14. Lu dans le navigateur |
| DL1 | https://api-docs.deliveroo.com/docs/order-integration | Refus automatique après 10 min par défaut (variable selon la région) ; commandes programmées : attendre `start_preparing_at` avant d'afficher ou d'imprimer ; ne pas ajouter de délais artificiels aux temps de préparation | Doc développeur officielle Deliveroo |

## Plateforme web

| Id | URL | Ce que la source étaye | Crédibilité |
|---|---|---|---|
| W1 | https://www.rfc-editor.org/rfc/rfc8030.html | Web Push : `TTL`, `Urgency` (quatre niveaux, `high` pour les alertes sensibles au temps), `Topic` (remplacement, 32 caractères), `404` pour un abonnement expiré (§ 7.3). Le `410` que renvoient aussi les services de push pour un abonnement révoqué relève de leur pratique, pas de ce passage de la RFC | RFC 8030, IETF |
| W2 | https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events | 6 connexions SSE par navigateur et domaine en HTTP/1.x ; commentaire `:` comme maintien de connexion ; reconnexion automatique | MDN |
| W3 | https://fetch.spec.whatwg.org/ (§ 4.6 « HTTP-network-or-cache fetch ») | Si la requête porte `If-None-Match` et que le mode de cache est `default`, il passe à `no-store` | Spécification WHATWG (non rouverte ; ne sert qu'à une variante que le skill ne retient pas) |
| W4 | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Conditional_requests | Requêtes conditionnelles, validateurs, `304` | MDN |
| W5 | https://developer.chrome.com/blog/timer-throttling-in-chrome-88 | Minuteurs d'une page cachée : une fois par seconde, puis une fois par minute après 5 min (conditions cumulatives) | Chrome for Developers (changement déployé en janvier 2021) |
| W6 | https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ | Web Push sur iOS / iPadOS 16.4, application ajoutée à l'écran d'accueil, permission sur geste | Blog WebKit, 16/02/2023 |
| W7 | https://github.com/web-push-libs/web-push | Options `TTL`, `urgency`, `topic` de `sendNotification` (vérifiées aussi dans `node_modules/web-push`, 3.6.7) | 3 572 étoiles, push 10/11/2026, non archivé |
| W8 | https://developer.mozilla.org/en-US/docs/Web/API/Request/cache | Modes `default`, `no-store`, `no-cache` de `fetch` | MDN |
| N1 | https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers | Gestionnaires de route Next.js 14 : cache par défaut des `GET`, options de segment, flux | Doc officielle Next.js 14. Dépôt `vercel/next.js` : 143 504 étoiles, push 13/11/2026 |

## Options non installées (citées comme pistes, pas comme règles)

| Id | URL | Ce que la source étaye | Crédibilité |
|---|---|---|---|
| X1, X2 | https://stately.ai/docs/pure-transitions et https://stately.ai/docs/guards | XState 5 : `transition(machine, state, event)` pure, gardes pures et synchrones | Doc officielle Stately. Dépôt `statelyai/xstate` : 30 457 étoiles, push 13/11/2026, MIT |
| UP1 | https://upstash.com/docs/qstash/features/delay | QStash : `Upstash-Delay`, `Upstash-Not-Before` ; délai max 7 jours (gratuit) ou 1 an (confirmé sur UP2) | Doc officielle Upstash. Dépôt `upstash/qstash-js` : 271 étoiles (sous le seuil de 3 000 ; retenu comme SDK officiel d'un fournisseur déjà utilisé) |
| UP2 | https://upstash.com/pricing/qstash | 1 000 messages par jour gratuits ; 1 $ les 100 000 ensuite ; délai maximal 7 jours (gratuit), 1 an (à l'usage) | Page tarifaire officielle |
| UP3 | https://upstash.com/docs/qstash/howto/signature | En-tête `Upstash-Signature` (JWT), vérification sur le corps brut | Doc officielle Upstash |
| UP4 | https://upstash.com/pricing/redis | 500 000 commandes par mois gratuites ; 0,20 $ les 100 000 | Page tarifaire officielle |
| UP5 | https://upstash.com/docs/realtime/features/serverless.md | Upstash Realtime : reconnexion avant le délai de la fonction (300 s par défaut), rejeu par Redis Streams. Son affirmation « seul le CPU actif est facturé » est contredite par V2 pour la mémoire | Doc officielle Upstash. Dépôt `upstash/realtime` : 81 étoiles, récent : non recommandé à ce stade |
| RT1 | https://pusher.com/channels/pricing/ | Offre gratuite : 200 000 messages par jour, 100 connexions ; 49 $ par mois : 1 million par jour, 500 connexions | Page tarifaire officielle |
| RT2 | https://ably.com/pricing | Tarification à l'utilisateur actif mensuel ; gratuit jusqu'à 500 utilisateurs actifs | Page tarifaire officielle |

## Format des skills

| Id | URL | Ce que la source étaye | Crédibilité |
|---|---|---|---|
| CL1 | https://code.claude.com/docs/en/skills.md | `SKILL.md` sous 500 lignes, description tronquée à 1 536 caractères, fichiers d'appui liés en relatif | Doc officielle Claude Code |

## Vérifications locales (exécutées le 13/11/2026 par le vérificateur)

Moyens : dépôt au commit `161f920` (fichiers du domaine identiques à `32c581f`), `node_modules` du dépôt (Prisma 6.19.2, TypeScript 5.9.3), conteneur PostgreSQL 15 jetable en mémoire, schéma créé par `prisma db push` à partir d'une copie de `prisma/schema.prisma` dont l'adresse était écrite en dur vers ce conteneur. Aucun fichier `.env` lu, aucune base distante. Les « instances » concurrentes sont des clients Prisma distincts à `connection_limit=1`. Limites : ni la version de PostgreSQL de production ni pgbouncer n'ont été reproduits ; les scripts sont restés hors dépôt (dossier de travail de la session), d'où la consigne de porter ces cas dans `tests/integration/`.

| Id | Ce qui a été fait | Résultat |
|---|---|---|
| L1 | `tsc --noEmit` strict sur les extraits tels qu'ils figurent dans le skill (transition, réponse HTTP, échéances, `claimOnce`, `appendNotifLog`, création idempotente, route de version, sonde cliente, push, règlement d'ajustement), avec l'alias `@/` du dépôt ; un fichier témoin fautif fait bien échouer la commande | Aucune erreur |
| L2 | Niveau d'isolation de la base de test ; types des colonnes | `read committed` ; `notif_sent` en `jsonb`, `updated_at` et `auto_cancelled_at` en `timestamp(3)` sans fuseau |
| L3 | Journal des requêtes émises par Prisma | `updateMany` gardé : une instruction `UPDATE … WHERE id AND shop_id AND status IN (…)` qui pose `updated_at`, y compris dans une transaction interactive ; avec un filtre de relation : même `UPDATE` avec `EXISTS(…)` ; `updateManyAndReturn` : un seul `UPDATE … RETURNING` ; avec `limit` : `UPDATE … WHERE id IN (SELECT id … LIMIT n)` |
| L4 | Patron A, extrait du skill transpilé tel quel : 70 courses « accepter (boucher) / annuler (client) » sur une commande `PENDING` ; autre boutique ; rejeu ; exception dans `extra` ; périmètre `undefined` ; forme tableau `$transaction([...])` après lecture périmée | Toujours un gagnant, un `CONFLICT`, un `OrderEvent` ; autre boutique : `NOT_FOUND`, rien d'écrit ; rejeu : `CONFLICT` avec `current === to` ; exception : statut et événement annulés ; périmètre vide : exception ; forme tableau : `CANCELLED` écrasé par `ACCEPTED`. Même issue en SQL direct avec verrou tenu 2 s |
| L5 | Patron B, extrait du skill : acceptation tenant le verrou pendant le balayage (15 essais), deux passages simultanés, passage en retard, passage rejoué, acceptation gardée d'une commande expirée. Contre-épreuves : même balayage avec `limit: 100` ; cron actuel (lecture des identifiants puis `updateMany` par identifiants) avec une acceptation entre les deux ; en SQL direct, sous-requête `LIMIT` seule, avec `FOR UPDATE SKIP LOCKED`, avec condition de statut répétée à l'extérieur | Patron B : commande acceptée conservée 15/15, voisine expirée, un `OrderEvent` par commande, aucun doublon, retard rattrapé, rejeu sans effet, garde : `CONFLICT`. Avec `limit` : commande acceptée écrasée 15/15 (et en SQL direct). Cron actuel : écrasée 25/25. `SKIP LOCKED` et condition répétée : commande conservée |
| L6 | `claimOnce` : 40 doubles appels simultanés ; entrée préexistante au format de `sendNotification` ; réécriture « lire puis écrire le tableau » intercalée ; `appendNotifLog` concurrent | Un seul `true` à chaque fois ; entrée reconnue ; la réécriture efface la réclamation et un second `claimOnce` réussit (doublon possible) ; avec `appendNotifLog`, aucune entrée perdue sur 20 essais |
| L7 | Patron C : 40 doubles créations simultanées avec la même clé ; clé présentée par un autre utilisateur ; collision d'`orderNumber` | Une commande et un rejeu à chaque fois ; autre utilisateur : `P2002` relancé, rien de renvoyé ; `meta.target` vaut `["idempotency_key"]` ou `["order_number"]` |
| L8 | `dailyCounter.upsert` : requête émise, puis 24 appels concurrents sur un jour neuf | `INSERT … ON CONFLICT ("shop_id","date") DO UPDATE` ; 24 numéros distincts, aucun rejet |
| L9 | Client à `connection_limit=1` : appel `prisma.` hors `tx` dans le callback d'une transaction interactive | Blocage 5 008 ms puis `P2028` (« Transaction already closed… expired transaction »), écriture annulée |
| L10 | `update({ where: { id, status } })` sans ligne correspondante | Une instruction `UPDATE` gardée ; `P2025` : « An operation failed because it depends on one or more records that were required but not found. No record was found for an update. » |
| L11 | `Order.updatedAt` après : `updateMany` Prisma, SQL brut, écriture d'un `OrderItem` seul ; `updateMany` avec `shopId: undefined` | Modifié ; inchangé ; inchangé ; le filtre est ignoré et la ligne est écrite |
| L12 | Agrégat de la sonde de version | Une requête ; la version change à la création et à la transition ; `0.0` pour une boutique vide |

Mesures faites par un autre skill sur les vrais handlers, reprises ici : `testing-strategy`, `references/etat-des-lieux.md`, défauts D3 (accepter et refuser en même temps : deux 200, 29 fois sur 30) et D4 (double envoi avec la même `idempotencyKey` : `[201, 409]`).

## Sources écartées ou non consultées

- **Reddit** : inaccessible aux outils de cette session (recherche et navigateur refusés). Aucun fil n'a été lu, aucune règle n'en dépend.
- **YouTube et conférences** : aucune source utilisée (pas de transcription lue).
- **Forum communautaire Vercel**, fil « SSE Time Limits? » du 17/02/2025 (https://community.vercel.com/t/sse-time-limits/5954) : un développeur y rapporte un flux SSE coupé en production. Anecdote sans réponse confirmée de Vercel ; le point qu'elle illustre (la durée maximale s'applique aux réponses en flux) est établi par V1.
- **Pages d'entraînement aux entretiens et tutoriels tiers** sur « l'architecture de DoorDash / Deliveroo » : écartés, ce ne sont pas des sources de première main.
- **Just Eat Takeaway, Deliveroo (blogs)** : aucun article d'ingénierie pertinent trouvé.
- Dépôts regardés puis non retenus comme dépendances : `pusher/pusher-js` (2 225 étoiles), `ably/ably-pubsub-js` (369), `upstash/redis-js` (985, déjà installé comme SDK officiel), `temporalio/temporal` (24 372), `inngest/inngest` (6 033), `triggerdotdev/trigger.dev` (16 757), `timgit/pg-boss` (4 135), `vercel/workflow` (2 508). Les orchestrateurs de tâches relèvent de `background-jobs-notifications`.
