---
name: api-route-conventions
description: Conventions des route handlers Klik&Go (src/app/api, ~190 fichiers route.ts, Next 14.2.35). Une seule façon d'écrire un handler — fabrique typée par type d'accès (openRoute, cronRoute, userRoute, optionalUserRoute, clientRoute, boucherRoute, adminRoute), validation Zod du corps, de la query et des params, enveloppe { success, data | error }, codes et statuts HTTP, pagination, rate limit Upstash avec Retry-After, en-têtes de cache, idempotence des mutations, logs corrélés, tests Vitest des handlers — et la recette pour migrer les handlers existants un par un. À charger avant de créer, modifier ou relire un fichier route.ts, un schéma de src/lib/validators ou src/lib/api/*.
when_to_use: Nouvelle route API ; handler qui répond 500 sur une entrée invalide ; req.json(), searchParams, parseInt sur une query, params d'URL ; apiSuccess, apiError, apiPaginated, apiCached, handleApiError ; choisir entre 400, 403, 404, 409, 422, 429 ; checkRateLimit, RATE_LIMITED, Retry-After ; Cache-Control ou s-maxage sur une réponse d'API ; Idempotency-Key, double clic, rejeu ; getServerUserId, getAuthenticatedBoucher, requireAdmin, clerkId ou userId dans un handler ; test d'un handler, vi.mock d'une route ; migration vers une fabrique, wrapper, try/catch répété.
---

# Conventions des route handlers — Klik&Go

Versions vérifiées dans `node_modules` : Next 14.2.35, Zod 3.25.76 (API v3), Prisma 6.19.2,
`@upstash/ratelimit` 2.0.8, Clerk 6.39.9, `@sentry/nextjs` 10.49.0, Vitest 4.1.5, TypeScript 5.9.3.
Ce skill précise `CLAUDE.md` sans le contredire ; un désaccord va dans « Points à arbitrer ». Chaque
affirmation renvoie à [references/sources.md](references/sources.md) (`[S…]` externe, `[L…]` preuve locale).

Skills voisins, à ne pas dupliquer : `clerk-auth`, `security-multitenant` (isolation, prix),
`prisma-expert`, `order-lifecycle-realtime` (transitions, SSE), `vercel-cost-performance` (cache CDN,
middleware), `nextjs-app-router`, `testing-strategy`, `stripe-payment` (webhook),
`reliability-observability`, `background-jobs-notifications`.

## 1. D'où l'on part

188 `route.ts` et 249 méthodes dans l'arbre de travail du 2026-11-14 (198 à `HEAD 32c581f` ; le
chantier « prix des commandes », non commité et encore en mouvement, en supprime treize et en ajoute
trois) ; aucun sur une fabrique. Avant de citer un nombre, relancer
`node ${CLAUDE_SKILL_DIR}/scripts/audit-routes.mjs` [L1]. Tous recopient le même squelette (`try` →
auth → rate limit → `req.json()` → `parse` → `catch`), et chaque copie diverge : JSON mal formé ⇒ 500,
y compris sur `POST /api/orders` [L3] ; `?page=abc` ⇒ `skip: NaN` dans Prisma (4 fichiers) ; quatre
formes de réponse d'erreur ; 76 fichiers qui mutent sans rate limit ; `userId` tantôt identifiant
Clerk, tantôt identifiant Prisma [L13]. Détail : [references/etat-du-code.md](references/etat-du-code.md).

Ce que le chantier prix a posé et qui sert de modèle :
- **Route mince** : `boucher/orders/[orderId]/action/route.ts` (66 lignes, 690 avant) — auth, schéma,
  commande de `src/lib/services/orders/commands/`, traduction HTTP par `transitionResponse`.
- **Schémas `.strict()` sans aucun montant** (`src/lib/validators/order.ts`) ; le total vu par le
  client sert seulement de contrôle (`expectedTotalCents` ⇒ `PRICE_CHANGED` 409).
- **Idempotence bornée au client**, `P2002` lu par `uniqueViolationFields` (`src/lib/prisma-errors.ts`).
- **Projections publiques en liste blanche** (`src/lib/public-projections.ts`) [L10].

Cal.com (conversion centrale des erreurs), Dub (contexte authentifié avec son tenant) et Formbricks
(auth, rate limit, audit) entourent chaque handler d'une fonction d'ordre supérieur maison
[S21][S22][S23]. C'est la cible, validation Zod en plus.

## 2. La règle : un handler = une fabrique

| Le handler… | Fabrique | Import | `ctx.auth` |
| --- | --- | --- | --- |
| ne lit aucune session, réponse identique pour tous | `openRoute` | `@/lib/api/route-open` | `null` |
| est appelé par un cron Vercel | `cronRoute` | `@/lib/api/route-open` | `{ cron: true }` |
| lit la session si elle existe (prix pro, panier anonyme) | `optionalUserRoute` | `@/lib/api/route-auth` | `{ clerkId \| null }` |
| exige une session, sans lire la base | `userRoute` | `@/lib/api/route-auth` | `{ clerkId }` |
| agit pour un client (commandes, favoris, fidélité) | `clientRoute` | `@/lib/api/route-auth` | `{ clerkId, userId, role }` |
| agit pour une boutique | `boucherRoute` | `@/lib/api/route-auth` | `{ userId, shopId }` |
| est réservé aux admins / webmasters | `adminRoute` | `@/lib/api/route-auth` | `{ clerkId }` |

- `clerkId` = identifiant Clerk ; `userId` = `User.id` Prisma, le seul à comparer à `Order.userId`,
  `LoyaltyReward.userId`… (`CLAUDE.md` § Résolution userId). Ne jamais comparer l'un à l'autre.
- Les fabriques appellent les helpers existants (`getServerUserId`, `getAuthenticatedBoucher`,
  `requireAdmin`, `verifyCronAuth`) : le test mode (jeton de session signé, jamais en production
  Vercel) fonctionne sans rien ajouter. Jamais `auth()` de Clerk dans un handler.
- **Handler exclu du matcher Clerk** (`cron/`, `webhooks/`, `payments/webhook`, `health`,
  `test-mode/`, `geo`, `shops/nearby`) : `route-open` uniquement. Importer `route-auth` y fait
  échouer `middleware-matcher.test.ts`, et `auth()` lèverait sans middleware [L5][S18].
- **Un handler sur fabrique est toujours dynamique** : elle lit `req.headers` dès sa première ligne,
  ce qui sort le handler de la génération statique de Next 14 [L19]. `revalidate` et `force-static`
  n'y ont aucun effet. `GET` public à cacher : `openRoute` + `apiCached` (cache CDN) ; s'il doit
  rester prérendu, il reste écrit à la main avec `revalidate` — seul cas : `calendar-events`.
- Exceptions à l'enveloppe (webhooks signés, flux SSE, exports, sondes) : etat-du-code § 4.
- Importer depuis `@/lib/api/errors`. Le baril `src/lib/api/index.ts` a été supprimé par le chantier
  prix [L18] : ne pas le recréer (un cron qui l'importerait tirerait tout ce qu'il ré-exporte).
- `GET` personnalisé écrit à la main qui a porté un cache : `privateNoStore(…)` sur **toutes** ses
  branches (`errors.ts`, modèle `products/[id]`). Ailleurs c'est inutile : sans `s-maxage` le CDN ne
  cache rien [S12], et une fabrique personnalisée pose l'en-tête seule.

Les fichiers `src/lib/api/route-*.ts` n'existent pas encore : la première équipe qui migre les crée
depuis `templates/` (migration § 1). Spécification et approches écartées (tRPC, Hono,
next-safe-action) : [references/wrapper.md](references/wrapper.md).

## 3. Anatomie

```ts
import prisma from "@/lib/prisma";
import { z } from "zod";
import { toggleStockSchema } from "@/lib/validators";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { boucherRoute } from "@/lib/api/route-auth";

export const dynamic = "force-dynamic";             // reste ici : Next le lit statiquement [S2]

const paramsSchema = z.object({ id: z.string().min(1).max(64) });   // non exporté [L6]

export const PATCH = boucherRoute(
  { name: "products/stock", rateLimit: "api", params: paramsSchema, body: toggleStockSchema },
  async ({ auth, params, body }) => {
    const inStock = body.inStock ?? (body.stockQty !== undefined ? body.stockQty > 0 : undefined);
    const [product] = await prisma.product.updateManyAndReturn({
      where: { id: params.id, shopId: auth.shopId },                 // borné à la boutique
      data: { inStock, stockQty: body.stockQty },                    // champ par champ
      select: { id: true, name: true, inStock: true, stockQty: true },
    });
    if (!product) return apiError("NOT_FOUND", "Produit introuvable");
    return apiSuccess(product);
  }
);
```

(Forme cible, compilée contre l'arbre du 2026-11-14 [L7]. La migration mécanique du même fichier,
logique inchangée, est dans `templates/examples/`.)

Ordre garanti par la fabrique : identifiant de requête → **authentification** → **rate limit**
(`${name}:${shopId|userId|clerkId|ip}`) → `params` → `query` → `body` → handler → toute exception
vers `handleApiError(error, name)`. Elle ajoute `x-request-id`, `Retry-After` (secondes) sur un 429,
et `Cache-Control: private, no-store` sur toute réponse personnalisée.

Ce qui reste au handler : l'autorisation **sur l'objet** (requête bornée par `auth.shopId` /
`auth.userId`), l'appel au service, la réponse. Au-delà d'environ 40 lignes, la logique va dans
`src/lib/services/<domaine>/` avec un résultat `{ ok: true, … } | { ok: false, code, message, details? }`
traduit par `apiError(result.code, …)` — modèles : `services/orders/create.ts`, `commands/http.ts`.
Un service qui valide lui-même un `unknown` (`createOrder`, `adjustOrderPrice`) se branche avec
`body: z.unknown()` : la fabrique garantit le 400 sur JSON mal formé, le service garde sa validation.

## 4. Valider (détail : [contrat-http.md](references/contrat-http.md) § 3)

| Faire | Ne pas faire | Pourquoi |
| --- | --- | --- |
| `body` / `query` / `params` déclarés dans la config | `await req.json()`, `searchParams.get()` dans le handler | 400 uniforme avec `details` ; plus de 500 ni de `NaN` [L3] |
| `z.coerce.number().int().min(1).max(50).default(20)` | `parseInt(sp.get("page") \|\| "1")` | `Math.max(1, NaN)` vaut `NaN` [L4] |
| `z.enum(["true", "false"])` pour un booléen de query | `z.coerce.boolean()` | il rend `true` pour `"false"` [L4] |
| `.max(n)` sur chaque chaîne et tableau, `.trim()` sur le texte | chaînes non bornées | consommation non bornée [S20] |
| `data: { champ: body.champ }` champ par champ | `data: body` | affectation de masse [S20] |
| prix, remise, total recalculés ; `shopId` / `userId` lus dans `ctx.auth` | les accepter dans le schéma | Zod valide une forme, pas une valeur métier : `discountCents` était lu dans le corps avant le chantier prix [L9] ; `toggleFavoriteSchema` de `validators/index.ts` porte encore un `userId` |
| `.strict()` sur une entrée qui touche à l'argent | `z.object` qui ignore en silence un champ d'un vieux client | modèle : `validators/order.ts` [L4] |
| schéma partagé dans `src/lib/validators/<domaine>.ts`, schéma local **non exporté** | `export const schema` dans un `route.ts` | Next refuse tout autre export [L6] |

## 5. Répondre (détail : contrat-http § 1–2)

Une seule enveloppe, lue par 54 fichiers d'interface [L12] : `{ success: true, data }` ou
`{ success: false, error: { code, message, details? } }`. Toujours par `apiSuccess` (201 pour une
création), `apiPaginated`, `apiCached` ou `apiError` — jamais `NextResponse.json` à la main.
`code` est le contrat, `message` (français, affichable, sans détail technique) ne l'est pas [S10][S11].

| Situation | Code → statut |
| --- | --- |
| Entrée invalide, JSON mal formé | `VALIDATION_ERROR` → 400 |
| Pas de session / rôle insuffisant | `UNAUTHORIZED` → 401 / `FORBIDDEN` → 403 |
| Absent **ou appartenant à un autre tenant** | `NOT_FOUND` → 404 (RFC 9110 permet de masquer l'existence [S5] ; convention de `transitionResponse`) |
| Action impossible dans l'état courant, doublon | `CONFLICT` → 409 (pas `VALIDATION_ERROR`) |
| Prix recalculé ≠ total confirmé par le client | `PRICE_CHANGED` → 409 |
| Règle métier violée par une demande bien formée | `STOCK_INSUFFICIENT`, `PRODUCTS_MISSING`… → 422 |
| Trop de requêtes du demandeur / boutique saturée | `RATE_LIMITED` → 429 / `CAPACITY_EXCEEDED` → 429 |
| Imprévu | lever ; `handleApiError` → `INTERNAL_ERROR` 500, Sentry |

RFC 9457 (`application/problem+json`) n'impose pas de remplacer un format d'erreur existant [S4] :
on garde l'enveloppe. Nouveau code : `ApiErrorCode` **et** `STATUS_MAP` + test dans `api-errors.test.ts`.

## 6. Paginer, limiter, cacher, rejouer (détail : contrat-http § 4–8)

- **Pagination dès la création** de toute liste pouvant dépasser 50 éléments : l'ajouter après coup
  est une rupture [S9]. Back-office : `paginationSchema.extend({…})` + `apiPaginated`. Flux sans
  borne (notifications, historique) : `cursor` + `limit`, `take: limit + 1`, `nextCursor` [S16]. Tri
  toujours départagé par `id`. Vocabulaire unique : `page`/`perPage` ou `cursor`/`limit`.
- **Rate limit sur toute mutation** et sur tout `GET` public coûteux : `rateLimit: "<nom>"`.
  Clé métier (e-mail invité, code promo) : `checkRateLimit` manuel puis `tooManyRequests(rl)`.
  Route boucher : le compteur est celui de la boutique, toutes tablettes confondues — budget choisi
  sur le pic réel de cuisine, limiteur dédié si `api` (30/min) est trop court.
  Sans Redis, ou 5 s sans réponse, la limite laisse passer [L8][S14].
- **Cache** : une réponse qui dépend du demandeur n'est jamais en cache partagé — les cookies ne
  sont pas dans la clé de cache du CDN [S12b], et avec `Vary: Cookie` Vercel ne cache rien [S12].
  `apiCached` uniquement dans un `openRoute`, sur toutes les branches de succès. Une URL = une variante.
- **Idempotence** : création à effet réel ⇒ clé client + colonne `@unique`, bornée au demandeur,
  `P2002` lu par `uniqueViolationFields` ; transition ⇒ écriture conditionnelle, rejeu = 200, course
  perdue = 409 (`order-lifecycle-realtime`) ; webhook ⇒ identifiant d'événement inséré avant
  traitement ; « mettre à la valeur X » plutôt que « basculer ».
- **Logs** : `logger`, jamais `console.*` ; pas de donnée personnelle ; une erreur imprévue se lève
  (un seul événement Sentry) ; action d'admin sensible ⇒ `writeAuditLog` (`src/lib/audit-log.ts`).

## 7. Tester (détail : [tests-handlers.md](references/tests-handlers.md))

Importer la méthode, l'appeler avec `new NextRequest(...)`, mocker les frontières (Prisma, helper
d'auth, rate limit, envois) par `vi.hoisted` + `vi.mock` [S19], jamais la fabrique. Minimum par
handler : 401 sans session ; **ressource d'un autre tenant ⇒ aucune écriture** ; entrée invalide ⇒
400 + `details` ; succès ⇒ enveloppe et arguments de l'écriture. Unitaire : `tests/api/**`,
`npm run test` (projet `unit`) ; vraies contraintes (champs exposés, unicité) : `tests/integration/api/**`,
`npm run test:integration`. Modèle vert : `templates/examples/product-stock.route.test.ts`.

## 8. Migrer un handler existant (détail : [migration.md](references/migration.md))

1. Choisir la fabrique d'après le helper d'auth appelé (§ 2).
2. Remplacer la signature ; `try/catch`, bloc d'auth, bloc de rate limit, `req.json()`, lecture de
   `params` et de la query deviennent la config (`name`, `rateLimit`, `params`, `query`, `body`).
3. Garder `export const dynamic` et toute la logique métier **inchangée**.
4. Faire tourner le test existant ; en écrire un s'il n'y en a pas.
5. `node ${CLAUDE_SKILL_DIR}/scripts/audit-routes.mjs --strict <fichiers>` doit sortir 0.

Une PR de migration ne corrige pas la logique : chaque correction (requête bornée, 409, pagination)
est un commit séparé avec son test. Ordre des lots : crons → admin → boucher → client → publiques →
commandes et paiement (après fusion du chantier prix). `calendar-events` ne se migre pas (§ 2).

## 9. Erreurs déjà commises ici

| Erreur | Conséquence | Garde-fou |
| --- | --- | --- |
| `req.json()` sans protection | 500 + alerte Sentry sur une simple faute de l'appelant (encore vrai sur `POST /api/orders`) | `body:` dans la config |
| `parseInt` / `Number` sur la query | `NaN` jusqu'à Prisma ⇒ 500 | `query:` + `z.coerce` |
| `NextResponse.json({ error: "texte" })` | l'écran lit `error.message` ⇒ `undefined` | `apiError` |
| `findUnique({ where: { id } })` puis comparaison de `shopId` | deux requêtes, 403 qui confirme l'existence, écriture non bornée | `where: { id, shopId }` ⇒ 404 |
| Identifiant Clerk comparé à une colonne `userId` | coupon refusé à son propriétaire (`e3b1629`) | `clientRoute` ⇒ `auth.userId` |
| Variante par utilisateur dans un cache partagé (Redis, CDN) | tarif pro servi à tous pendant 60 s par le cache Redis de `products` (`0d6fd80`) ; `products/[id]` cachait au CDN sa variante publique sur l'URL qui sert aussi le gérant — corrigé par `privateNoStore` dans le chantier prix [L10] | fabrique personnalisée ⇒ `no-store` ; clé de cache = tout ce qui fait varier la réponse |
| Montant fourni par le client (`discountCents`) | remise choisie par l'acheteur — retiré par le chantier prix [L9] | valeur absente du schéma, `.strict()`, recalcul serveur |
| `P2025` reconnu par le texte du message | le texte n'existe plus dans le moteur 6.19 ⇒ 500 au lieu de 404 [L2] | correctif wrapper.md § 4b |
| `auth()` sur un chemin hors middleware ; cron sans secret | 500 ; cron ouvert (`f2cac19`, `0d6fd80`) | `route-open` + `cronRoute` |
| `force-dynamic` oublié | build Vercel cassé (`ff0752e`) | audit `no-segment-config` |
| Message d'exception dans la réponse (`admin/scrape-butchers`) | fuite de détail interne | lever ⇒ `handleApiError` |

## 10. Définition de terminé

- [ ] Chaque méthode créée ou modifiée est sur une fabrique (exceptions : etat-du-code § 4) ; aucun
      `try/catch` de squelette, aucun `auth()` Clerk, aucun `NextResponse.json`, aucun `console.*`.
- [ ] `export const dynamic = "force-dynamic"` dans le fichier ; jamais `revalidate` ni
      `force-static` avec une fabrique (audit `static-with-factory`).
- [ ] `name` unique ; `body`, `query`, `params` déclarés pour tout ce qui est lu ; chaînes et
      tableaux bornés ; aucune valeur calculable par le serveur dans le schéma.
- [ ] Toute requête Prisma sur une donnée métier est bornée par `auth.shopId` ou `auth.userId` ;
      `select` explicite ; liste paginée ou `take` de sécurité.
- [ ] Mutation ⇒ `rateLimit` ; création à effet réel ou transition ⇒ rejeu sans double effet.
- [ ] Codes d'erreur pris dans `ApiErrorCode` selon la table du § 5 ; aucun message technique.
- [ ] Aucune réponse personnalisée en cache partagé ; `apiCached` seulement en `openRoute`.
- [ ] Test du handler : 401, autre tenant sans écriture, 400 avec `details`, succès.
- [ ] `audit-routes.mjs --strict` à 0 sur les fichiers touchés ; `npx tsc --noEmit`, `npm run lint`,
      `npm run test` verts ; `npm run build` passe (base joignable, cf. `CLAUDE.md`).
- [ ] Chemin hors matcher Clerk ⇒ import `route-open` seul, `middleware-matcher.test.ts` vert.
- [ ] Appel réel en local (base locale, test mode par `POST /api/test-mode/activate`, `CLAUDE.md`
      § Test Mode) : 200 par rôle concerné, puis 401 sans session. Jamais sur la production ; pas de
      preview Vercel pour les branches `claude/**` (`CLAUDE.md` § CI/CD).

## 11. Points à arbitrer

1. **`CLAUDE.md` : « try/catch dans chaque route handler ».** Un handler sur fabrique s'exécute dans
   le `try/catch` + `handleApiError` + log de `route-core.ts` : la règle est tenue, écrite une fois ;
   tout handler hors fabrique garde le sien, à la lettre. Reformulation proposée : « tout handler
   passe par une fabrique `*Route` ; `try/catch` à la main seulement pour les exceptions listées ».
2. **Rate limit qui laisse passer en panne** (Redis absent, ou 5 s sans réponse [S14]) : acceptable
   partout, ou faut-il refuser pour `otpVerify` et `promoValidate` (anti-énumération) ?
3. **404 ou 403 pour la ressource d'un autre tenant.** Ce skill retient 404 (RFC 9110 [S5],
   `transitionResponse`, `security-multitenant`) ; Google AIP-193 recommande 403 dès que la
   permission manque [S10]. Et l'existant répond surtout 403 / 400 là où ce skill dit 404 / 409 :
   passer par lots, ou seulement sur les nouvelles routes ? Deux écrans lisent un code [L12].
4. **`SERVICE_DISABLED` (503)** sert à « boutique fermée » comme à « fonction non implémentée » ; une
   panne de base répond 500. Un code `SERVICE_UNAVAILABLE` distinct, avec `Retry-After` ?
5. **`@vercel/functions` absent** [L15] : `waitUntil` sortirait les 8 `await sendNotification` du
   chemin de réponse. À décider avec `background-jobs-notifications`.
6. **Bouchons routés** (`cart/reserve`, `payments/[orderId]`, `auth/otp/*`) : supprimer ou terminer ?
7. **Zod 4** (`zod/v4`, déjà dans le paquet [L16]) : migration globale, jamais fichier par fichier.
8. **Classe d'exception métier** (comme `DubApiError` [S22]) : inutile tant que `return apiError` et
   `{ ok: false }` suffisent.

## Références

- [references/etat-du-code.md](references/etat-du-code.md) — inventaire chiffré, écarts E1–E11, exceptions légitimes, leçons de l'historique
- [references/wrapper.md](references/wrapper.md) — approches évaluées, spécification des fabriques, décisions, correctifs du socle
- [references/contrat-http.md](references/contrat-http.md) — enveloppe, codes, validation, pagination, rate limit, cache, idempotence, logs
- [references/migration.md](references/migration.md) — socle, choix de la fabrique, sept gestes, changements de comportement, ordre des lots
- [references/tests-handlers.md](references/tests-handlers.md) — mocks, cas obligatoires, test d'isolation, tests d'intégration
- [references/sources.md](references/sources.md) — sources, crédibilité, preuves locales, non vérifié
- `templates/` — `route-core.ts`, `route-open.ts`, `route-auth.ts`, leur test, un handler migré et son test (compilés et testés [L7]) ; `scripts/audit-routes.mjs` — audit statique en lecture seule
