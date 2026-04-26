# Phase 5 — Audit Architecture & Performance Backend (Klik&Go)

Date : 2026-04-26 — Branche `claude/quirky-kirch`
Stack : Next.js 14 App Router + Prisma + PostgreSQL + Upstash Redis + Vercel Cron + Sentry.

---

## 1. Score global — **5.5 / 10**

| Axe                  | Note   | Justification                                                                |
|----------------------|--------|------------------------------------------------------------------------------|
| Architecture couches | 5 / 10 | 2 services orders extraits, mais 178 autres routes contiennent la logique inline. Routes >300 lignes (action: 651, chat: 412, stats: 373). |
| Transactions         | 4 / 10 | 10 `$transaction` dans le projet — mais les endroits CRITIQUES (createOrder, reorder, webhook clerk, action accept) en manquent. |
| Cache                | 7 / 10 | Wrapper `redis` avec fallback gracieux + TTL 60s sur shops/products. Pas appliqué à stats/admin. |
| Logs                 | 4 / 10 | `logger` minimaliste (silent in prod), pas de correlation ID, Sentry init OK mais 0 `captureException` manuel. |
| Migrations           | 7 / 10 | `migrate deploy` côté prod (bon), 3 migrations propres, mais aucun runbook rollback. |
| Tests                | 3 / 10 | 9 fichiers, ~25 tests, ZERO test sur les routes les plus critiques (cancel, action boucher, checkout, loyalty, admin, webhooks). Pas d'e2e. |
| Healthcheck          | 3 / 10 | Renvoie `status:ok` sans pinguer la DB ni Redis. Inutile pour détecter incident Railway. |
| Connection pool DB   | 2 / 10 | `.env.example` ne mentionne ni `pgbouncer=true` ni `connection_limit`. Sur Vercel serverless = risque de saturer Railway. |
| Crons                | 8 / 10 | 13 crons dans `vercel.json`, 12/13 routes vérifient `verifyCronAuth`. À auditer celle qui ne le fait pas. |
| Observabilité        | 5 / 10 | Sentry installé + sample rate 10% + env tag, mais aucun appel `captureException`. Tout passe par `console.error` sans contexte. |

**Verdict** : architecture acceptable pour un MVP, mais 3 dettes techniques bloquantes pour scaler : (1) absence de transactions sur les flux argent/stock, (2) coverage tests dérisoire sur les routes monétaires, (3) connection pool DB non configuré.

---

## 2. Findings critiques 🔴

### 🔴 createOrder n'est PAS dans une transaction
📁 Fichier : `src/lib/services/orders/create.ts:250-266` + `:459`
🐛 Le service exécute séquentiellement (hors transaction) :
- `prisma.offer.findUnique` puis `prisma.offer.update({ usedCount: { increment: 1 } })` (ligne 250-258)
- `prisma.loyaltyReward.findUnique` puis `prisma.loyaltyReward.update` (ligne 261-273)
- `prisma.order.create({ data: { items: { create: ... } } })` (ligne 459)
💥 Si `order.create` échoue après l'incrément `offer.usedCount`, le code promo est consommé pour rien → client floué + bouchon de capacité erroné. Aucun rollback. Race condition possible : 2 commandes simultanées peuvent dépasser `offer.maxRedemptions`.
✅ Devrait être : `prisma.$transaction(async (tx) => { tx.offer.update(...); tx.loyaltyReward.update(...); tx.order.create(...) })`. Bonus : verrou pessimiste (`SELECT FOR UPDATE`) pour le compteur quotidien (`getNextDailyNumber` ligne 11) sinon collision de `dailyNumber` sous charge.

### 🔴 Action boucher ACCEPT décrémente stock après l'update — pas atomique
📁 Fichier : `src/app/api/boucher/orders/[orderId]/action/route.ts:137-178`
🐛 `prisma.order.update({ status: "ACCEPTED" })` puis bloc séparé `prisma.$transaction(stockUpdates)` 30 lignes plus bas. Si la 2ᵉ étape échoue (timeout DB), la commande reste ACCEPTED avec stock anti-gaspi/flash sale jamais décrémenté → survente garantie.
💥 Survente sur produits anti-gaspi/flash sale (stock limité par définition).
✅ Tout doit être dans le même `prisma.$transaction([orderUpdate, ...stockUpdates])`. Idem pour les blocs DENY (`:202-227`) et CANCEL (`:540-575`) qui restorent le stock après un update non transactionnel.

### 🔴 Reorder : génération de numéro non sérialisée + mutation non transactionnelle
📁 Fichier : `src/app/api/orders/reorder/route.ts:90-122`
🐛 `findFirst({ orderBy: orderNumber desc })` + `parseInt + 1` + `order.create` séquentiellement. Sous concurrence (2 reorder en // ), 2 commandes peuvent recevoir le même `orderNumber` (contrainte unique → 500). Pas idempotence-key non plus.
💥 Crash sporadique en production sous charge, doublons potentiels, perte de commandes.
✅ Utiliser `getNextDailyNumber` (déjà là pour create) + transaction.

### 🔴 Healthcheck ne valide rien
📁 Fichier : `src/app/api/health/route.ts:1-9`
🐛 Renvoie `status: "ok"` sans pinguer Postgres ni Redis. Vercel/UptimeRobot ne détecte pas une panne Railway tant que Next.js boote.
💥 Faux sentiment de sécurité — incidents DB invisibles pendant 5+ minutes.
✅ `await prisma.$queryRaw\`SELECT 1\`` + check `redis.isAvailable` + retour 503 si l'un des deux fail.

### 🔴 Connection pool Postgres non configuré
📁 Fichier : `.env.example:8` (et probablement Vercel env)
🐛 `DATABASE_URL` simple `postgresql://...` sans `?pgbouncer=true&connection_limit=N&pool_timeout=10`. Vercel serverless = chaque invocation cold → nouvelle connection Prisma → Railway PG va exploser sa limite (~100 connections sur plan Hobby) sous le premier pic.
💥 Erreur `too many clients` en prod, dégradation cascade.
✅ Activer Prisma Accelerate ou le pgbouncer Railway, et ajouter `?pgbouncer=true&connection_limit=1` (1 par lambda cold start). Documenter dans `.env.example`.

### 🔴 Coverage tests quasi nulle sur routes monétaires/critiques
📁 Fichier : `tests/` (9 fichiers, ~25 tests)
🐛 Aucun test pour :
- `src/app/api/orders/[id]/cancel/route.ts`
- `src/app/api/boucher/orders/[orderId]/action/route.ts` (651 lignes, accept/deny/preparing/ready/cancel)
- `src/app/api/checkout/validate-code/route.ts`
- `src/app/api/cart/add` (logique busy/throttling)
- `src/app/api/loyalty/**`
- `src/app/api/admin/**` (32 pages — 0 test)
- `src/app/api/webhooks/clerk/route.ts` (création user)
- `src/app/api/orders/[id]/adjust-price/route.ts` (273 lignes)
💥 Régressions silencieuses possibles à chaque refactor sur les flux argent.
✅ Prioriser tests sur action boucher accept/deny (pile sur la transaction stock manquante) + checkout/validate-code + webhook clerk.

---

## 3. Findings importants 🟡

### 🟡 Routes API trop volumineuses (logique inline non extraite)
📁 Fichier : 
- `src/app/api/boucher/orders/[orderId]/action/route.ts` (651 lignes)
- `src/app/api/chat/route.ts` (412 lignes)
- `src/app/api/boucher/stats/route.ts` (373 lignes)
- `src/app/api/orders/[id]/adjust-price/route.ts` (273 lignes)
- `src/app/api/products/route.ts` (262 lignes)
🐛 Phase 0 a noté l'extraction `orders/{create,list}.ts`, mais le pattern n'a pas été propagé. Logique métier mélangée à parsing/auth → impossible à tester unitairement.
✅ Extraire : `src/lib/services/orders/action.ts` (action boucher), `src/lib/services/stats/boucher.ts`, `src/lib/services/orders/adjust-price.ts`.

### 🟡 Pas de cache sur routes lourdes (stats, admin)
📁 Fichier :
- `src/app/api/boucher/stats/route.ts` (agrégations sur 365 jours)
- `src/app/api/admin/stats/route.ts:1-230`
- `src/app/api/admin/analytics/route.ts:1-211`
🐛 Recalculé à chaque requête, alors que ces dashboards sont consultés en boucle. Redis dispo + wrapper en place — non utilisé.
✅ Cache 60s sur stats period=year, 30s sur period=week. Clé : `stats:boucher:${shopId}:${period}`.

### 🟡 Pas de wrapper `cached(key, ttl, fn)`
📁 Fichier : `src/lib/redis.ts`
🐛 Le pattern get → si null → compute → set est dupliqué dans 4 endroits (`shops/nearby:30+169`, `products/route.ts:108+143`, `boutique/[slug]/page.tsx:54+71`, `shop-status.ts:10+60`).
✅ Helper :
```ts
export async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = await redis.get<T>(key); if (hit) return hit;
  const fresh = await fn(); await redis.set(key, fresh, { ex: ttl }); return fresh;
}
```

### 🟡 Sentry installé mais 0 `captureException` manuel
📁 Fichier : `sentry.server.config.ts` + `src/instrumentation.ts`
🐛 Le SDK ne capture automatiquement que les erreurs non-catchées. Or, toutes les routes ont un `try/catch` qui swallow vers `console.error` ou `handleApiError`. Résultat : les exceptions métier n'arrivent JAMAIS dans Sentry.
💥 Aucune visibilité sur les vraies erreurs prod.
✅ Dans `handleApiError` (`src/lib/api/errors.ts`) ajouter `Sentry.captureException(err, { tags: { route, userId } })`. Idem pour `logger.error`.

### 🟡 Logger sans contexte ni correlation ID
📁 Fichier : `src/lib/logger.ts:1-23`
🐛 18 lignes total. Pas de niveau structuré, pas de JSON, pas de request_id, pas de userId. Logs Vercel = soupe textuelle ininterrogeable.
✅ Adopter `pino` ou minimum logger structuré : `logger.info({ route, userId, orderId, durationMs }, "order.created")`.

### 🟡 Pas de runbook rollback DB
📁 Fichier : `prisma/migrations/` (3 migrations)
🐛 `prisma migrate deploy` est unidirectionnel. Si une migration prod casse (ex: drop column), procédure de rollback non documentée. Pas de migration `down`.
✅ `docs/RUNBOOK_DB.md` : étapes recovery via snapshot Railway + commande `migrate resolve --rolled-back`.

### 🟡 Webhook Clerk : aucune transaction sur création user
📁 Fichier : `src/app/api/webhooks/clerk/route.ts:82` (user.create), `:118` (user.update), `:139`
🐛 Si Clerk envoie 2 webhooks user.created en // (réessai), 2 `prisma.user.create({ clerkId })` peuvent passer simultanément avant la contrainte unique → un crash, l'autre OK, mais l'idempotence n'est pas explicite.
✅ `upsert` au lieu de `create` + idempotency-key sur Svix headers (`svix-id`).

### 🟡 Pas de tests e2e
📁 Fichier : `package.json` (pas de Playwright/Cypress)
🐛 Le parcours commande complet (panier → checkout → kitchen accept → ready → pickup) n'est testé nulle part. Le test `tests/services/orders/create.test.ts` mocke Prisma → ne vérifie pas l'intégration.
✅ Au minimum 1 test Playwright happy path "client commande, boucher accepte, retire avec QR".

### 🟡 Cron sans verifyCronAuth (1 sur 13)
📁 Fichier : `src/app/api/cron/` (12/13 protégées d'après le grep `verifyCronAuth|CRON_SECRET`)
🐛 1 route cron a échappé. Risque qu'elle soit déclenchable publiquement (DoS DB).
✅ Identifier la route manquante et ajouter `if (!verifyCronAuth(req)) return 401`.

---

## 4. Findings améliorations 🟢

### 🟢 Wrapper redis avec fallback gracieux — bon pattern
📁 Fichier : `src/lib/redis.ts:14-65`
✅ Le client renvoie `null` si non configuré → l'app reste fonctionnelle en dev sans Upstash. À garder.

### 🟢 Singleton Prisma propre
📁 Fichier : `src/lib/prisma.ts`
✅ Pattern globalThis correct, log level différencié dev/prod.

### 🟢 Idempotency-key sur createOrder
📁 Fichier : `src/lib/services/orders/create.ts:39-49`
✅ Bonne pratique pour anti-double-commande, déjà implémentée.

### 🟢 Sentry sample rate 10% raisonnable
📁 Fichier : `sentry.{server,client,edge}.config.ts`
✅ `tracesSampleRate: 0.1` — coût maîtrisé, données représentatives.

### 🟢 Test multi-tenant sécurité
📁 Fichier : `tests/security/multitenant.test.ts`
✅ Existe — bon réflexe sécurité. À étendre.

### 🟢 Migrations propres + `migrate deploy` en build
📁 Fichier : `package.json` + `prisma/migrations/`
✅ Pas de `db push` en prod (qui est une faute classique).

### 🟢 13 crons Vercel bien organisés
📁 Fichier : `vercel.json:8-22`
✅ Plages horaires distinctes (pas de stampede), endpoints clairs.

---

## 5. Tableau récap

| #  | Sev | Catégorie       | Fichier                                                            | Résumé                                                              |
|----|-----|-----------------|--------------------------------------------------------------------|---------------------------------------------------------------------|
| 1  | 🔴  | Transaction     | `src/lib/services/orders/create.ts:250-459`                        | createOrder : offer/loyalty/order non atomique                      |
| 2  | 🔴  | Transaction     | `src/app/api/boucher/orders/[orderId]/action/route.ts:137-178`     | Accept boucher : update + stock séparés → survente possible         |
| 3  | 🔴  | Concurrence     | `src/app/api/orders/reorder/route.ts:90-122`                       | Génération orderNumber non sérialisée                               |
| 4  | 🔴  | Healthcheck     | `src/app/api/health/route.ts:3-9`                                  | Aucun ping DB/Redis                                                 |
| 5  | 🔴  | DB pool         | `.env.example:8`                                                   | Pas de pgbouncer / connection_limit                                 |
| 6  | 🔴  | Tests           | `tests/`                                                           | 0 test sur action boucher, checkout, loyalty, admin, webhooks       |
| 7  | 🟡  | Architecture    | `src/app/api/boucher/orders/[orderId]/action/route.ts` (651L)      | Logique inline, pas extraite en service                             |
| 8  | 🟡  | Architecture    | `src/app/api/chat/route.ts` (412L), `boucher/stats` (373L)         | Routes obèses                                                       |
| 9  | 🟡  | Cache           | `src/app/api/boucher/stats/route.ts`                               | Agrégations lourdes non cachées                                     |
| 10 | 🟡  | Cache           | `src/lib/redis.ts`                                                 | Pas de helper `cached(key, ttl, fn)`                                |
| 11 | 🟡  | Observabilité   | `sentry.*.config.ts` + `src/lib/api/errors.ts`                     | 0 captureException manuel                                           |
| 12 | 🟡  | Logs            | `src/lib/logger.ts:1-23`                                           | Pas de correlation ID, pas structuré                                |
| 13 | 🟡  | DB              | `prisma/migrations/`                                               | Pas de runbook rollback                                             |
| 14 | 🟡  | Idempotence     | `src/app/api/webhooks/clerk/route.ts:82`                           | user.created sans upsert/svix-id                                    |
| 15 | 🟡  | Tests           | `package.json`                                                     | Pas d'e2e Playwright                                                |
| 16 | 🟡  | Sécurité cron   | `src/app/api/cron/`                                                | 1/13 sans verifyCronAuth                                            |
| 17 | 🟢  | Cache           | `src/lib/redis.ts:14-65`                                           | Wrapper avec fallback gracieux — OK                                 |
| 18 | 🟢  | Prisma          | `src/lib/prisma.ts`                                                | Singleton propre                                                    |
| 19 | 🟢  | Idempotence     | `src/lib/services/orders/create.ts:39-49`                          | createOrder idempotency-key OK                                      |
| 20 | 🟢  | Sécurité        | `tests/security/multitenant.test.ts`                               | Test multi-tenant en place                                          |

---

## Top 3 actions immédiates

1. **Wrapper `prisma.$transaction(async tx => …)` autour de createOrder + action boucher accept/deny/cancel** (#1, #2). Risque survente/désync stock = perte d'argent direct.
2. **Configurer pgbouncer / connection_limit sur DATABASE_URL Vercel** (#5). Bombe à retardement au premier pic trafic.
3. **Healthcheck qui pingue Postgres + Redis + tests sur action boucher route** (#4, #6). Sans ça, on vole à l'aveugle.
