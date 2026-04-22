# AUDIT EXTERNE KLIK&GO — 2026-04-22

Auditeur : externe senior, impitoyable.
Périmètre : worktree `quirky-kirch` (branche `claude/quirky-kirch`).
Stack : Next.js 14 App Router, TS, Prisma/PostgreSQL, Clerk, Tailwind, Vercel.

Chiffres clés : **173 routes API**, **50 modèles Prisma**, 1705 lignes de schema, 101 composants client, 15 fichiers de migrations SQL (une seule migration réelle `20260204224837_init` + 1 index trigram), 3 fichiers de tests (!!) , pas de workflow CI GitHub.

---

## 1. SÉCURITÉ

### 🔴 CRITIQUE — Stripe n'est PAS implémenté mais annoncé "prêt"
- `src/app/api/payments/webhook/route.ts` ligne 4-6 : retourne `SERVICE_DISABLED` — Not implemented - schema migration pending.
- `src/app/api/payments/[orderId]/route.ts` ligne 4-9 : idem.
- CSP autorise `api.stripe.com`, `js.stripe.com`, `hooks.stripe.com` (`next.config.mjs:57-58`) alors que rien n'est branché.
- Le CLAUDE.md et le README annoncent "Stripe (structure prête)" → **faux**, c'est un stub. Aucun `constructEvent()`, aucune clé `STRIPE_SECRET_KEY` en usage.
- **Impact** : aucune facturation possible en ligne. Le produit n'encaisse pas en ligne malgré la communication. Roadmap trompeuse.
- **Fix** : soit implémenter (SDK `stripe`, webhook Svix-style), soit retirer toute mention Stripe du marketing et des docs.

### 🔴 CRITIQUE — Upload d'images sans vérification de rôle boucher
- `src/app/api/uploads/product-image/route.ts:21-45` : POST vérifie `getServerUserId()` puis accepte TOUT utilisateur authentifié. Le check d'ownership ligne 47 est **conditionnel à `productId`** : si le client n'envoie pas `productId`, n'importe quel CLIENT authentifié peut uploader jusqu'à 2 Mo sur le Vercel Blob du projet (coût + abus).
- **Impact** : abus de stockage, pollution Blob, coût Vercel.
- **Fix** : vérifier `role === BOUCHER || ADMIN` en amont, inconditionnellement. `productId` doit être obligatoire (Zod).

### 🔴 CRITIQUE — `/api/uploads/product-image` DELETE : zero ownership check
- `src/app/api/uploads/product-image/route.ts:108-139` : n'importe quel user authentifié peut supprimer n'importe quel blob tant que l'URL matche le pattern `*.public.blob.vercel-storage.com` ou `/api/uploads/products/`.
- **Impact** : un user malveillant peut énumérer/supprimer les images produits de toutes les boucheries.
- **Fix** : résoudre l'URL → retrouver le `Product` correspondant (via `ProductImage` Prisma) → vérifier `shop.ownerId`.

### 🟠 MAJEUR — Rate limiting quasi-absent
- Recherche globale : seuls 9 fichiers utilisent `checkRateLimit` (`src/app/api/orders/route.ts`, `src/app/api/auth/otp/*`, api-keys webmaster).
- Routes à risque sans rate-limit : `/api/chat` (appel Anthropic payant), `/api/search`, `/api/reviews` POST, `/api/support/ai-respond`, `/api/boucher/images/generate` (Replicate payant), `/api/admin/images/generate`, `/api/offers/validate` (brute-force codes promo possible), `/api/checkout/validate-code`.
- **Impact** : DoS, vol de crédits Anthropic/Replicate (factures surprises), brute-force de codes promo et LoyaltyReward (format `KG-XXXXXX` → 36^6 = 2Md combinaisons, bruteforcable sur bon compte).
- **Fix** : ajouter `checkRateLimit(rateLimits.ai, userId)` sur toute route coûteuse ; ajouter bucket dédié `rateLimits.promoValidate` (10/min).

### 🟠 MAJEUR — Serveur de fichiers filesystem en prod (Vercel serverless)
- `src/app/api/uploads/[...path]/route.ts` sert des fichiers depuis `process.cwd() + /uploads` : sur Vercel serverless, le FS est éphémère → cette route ne fonctionne pas réellement et constitue un vestige.
- **Impact** : URLs "legacy" cassées, traverse path check théorique inutile en prod.
- **Fix** : supprimer la route ; migrer les URLs `/api/uploads/...` historiques vers Blob et les rediriger. Retirer `uploads/` du repo.

### 🟠 MAJEUR — `any` dans routes critiques
- `src/app/api/webmaster/reviews/route.ts:22,27` : `const where: any`, `let orderBy: any` (contournement intentionnel via `eslint-disable`). Pas de type-safety sur filtres admin.
- `src/app/api/webmaster/products/route.ts` (2 occurrences), `src/app/api/boucher/orders/[orderId]/action/route.ts` (2 occ.), `src/app/api/orders/[id]/scheduled-notify/route.ts` (1 occ.).
- **Fix** : utiliser `Prisma.ReviewWhereInput` / `Prisma.ProductWhereInput` typés.

### 🟠 MAJEUR — Cache de rôles in-memory dans le middleware (Vercel incohérent)
- `src/middleware.ts:24-48` : `Map` en mémoire, TTL 5 min. Sur Vercel Edge, chaque instance isolée → cache hit rate faible + changements de rôle répercutés après jusqu'à 5 min sur certaines instances.
- **Impact** : un user rétrogradé peut garder accès 5 min sur une instance ; un boucher suspendu peut accéder pendant 5 min.
- **Fix** : Upstash Redis (déjà au projet) avec même TTL, partagé entre instances.

### 🟡 MINEUR — CSP trop permissive
- `next.config.mjs:53` : `script-src 'unsafe-inline' 'unsafe-eval'` → désactive les protections XSS. Clerk impose `unsafe-inline`, mais `unsafe-eval` n'est plus requis depuis Clerk v5+.
- **Fix** : retirer `unsafe-eval`, tester, réintroduire seulement si Clerk casse.

### 🟡 MINEUR — Secret de test en NEXT_PUBLIC
- CLAUDE.md documente `NEXT_PUBLIC_TEST_SECRET=KlikTest2026!` → exposé au bundle client. Documenté comme tel, mais le "secret" perd tout sens.
- **Fix** : côté serveur only, comparaison dans une route `/api/test-mode/activate`.

### 🟡 MINEUR — Webhook Clerk OK mais log d'erreur perdu
- `src/app/api/webhooks/clerk/route.ts:56` : catch silencieux sans log → debug impossible si signature pète.

---

## 2. PERFORMANCE

### 🔴 CRITIQUE — SSE polling DB toutes les 5s par boucher connecté
- `src/app/api/boucher/orders/stream/route.ts:39-119` : chaque boucher ouvre une connexion SSE qui exécute 2 requêtes Prisma/5s. À 100 bouchers simultanés : 40 req/s constantes sur Postgres Railway.
- Pas de timeout/TTL côté serveur → connexions zombie possibles.
- **Fix** : push event-driven via Redis pub/sub + `ReadableStream` qui écoute un canal, pas un polling.

### 🟠 MAJEUR — `GET /api/shops/[id]` renvoie TOUS les produits sans pagination
- `src/app/api/shops/[id]/route.ts:25-29` : `products: { where: { inStock: true }, include: { categories: true } }` — pas de `take`. Une boutique avec 500 produits = payload énorme, cache public 60s OK mais TTFB initial douloureux.
- **Fix** : paginer ou séparer en route `/api/shops/[id]/products?page=...`.

### 🟠 MAJEUR — `GET /api/orders` limite à 50 MAIS sans offset/cursor
- `src/app/api/orders/route.ts:93` : `take: 50`. Un boucher avec 51+ commandes actives perd l'historique.
- **Fix** : pagination curseur `createdAt DESC + id`.

### 🟠 MAJEUR — N+1 potentiel dans `nearby`
- `src/app/api/shops/nearby/route.ts:127-137` : fait une 2e query `offer.findMany` pour toutes les boutiques (acceptable batch). OK ici.
- Mais : `nearbyNormalized.map` + `withoutCoordsNormalized` + encore un `allShops.map` → acceptable. Pas de vrai N+1, mais SQL brut `$queryRaw` non paginé → si 1000 boutiques en France, payload massif.
- **Fix** : `LIMIT 50` dans le SQL raw ligne 82.

### 🟠 MAJEUR — Bundle : dépendances lourdes jamais lazy-chargées
- `package.json` : `recharts` (graphs), `html5-qrcode`, `qrcode.react`, `html-to-image`, `@dnd-kit/*`, `sonner`, `replicate`, `ai` (vercel ai SDK), `@anthropic-ai/sdk`.
- `html-to-image` est listé mais CLAUDE.md (memory seo_fixes) dit "supprimé" → dépendance orpheline.
- `recharts` : uniquement utilisé dans dashboard boucher → doit être dynamic import.
- `html5-qrcode` : uniquement scan commande → lazy.
- **Fix** : `grep -r "from ['\"]recharts['\"]"` pour garantir imports dynamiques ; désinstaller `html-to-image`.

### 🟠 MAJEUR — 101 composants `"use client"` — ratio élevé
- Sur ~150 composants, 101 sont client. `ShopCard.tsx`, `ProductCard.tsx` (289 lignes, client) — un ProductCard devrait être server avec un sous-fragment client pour l'ajout au panier.
- **Fix** : extraire `AddToCartButton.tsx` client, rendre ProductCard server.

### 🟡 MINEUR — `images.formats = ["image/webp", "image/avif"]`
- Bonne ordre selon CLAUDE.md. OK.

### 🟡 MINEUR — `boucher/stats` : beaucoup de calculs périodiques non mémoïsés
- `src/app/api/boucher/stats/route.ts` (373 lignes) : agrégations lourdes à chaque appel dashboard, pas de cache Redis. Appelé à chaque chargement de page boucher.
- **Fix** : cacher 5 min par `shopId:period`.

---

## 3. ARCHITECTURE & CODE QUALITY

### 🔴 CRITIQUE — Couverture de tests ridicule
- 3 fichiers seulement : `tests/lib/cart-utils.test.ts`, `tests/lib/schemas.test.ts`, `tests/security/multitenant.test.ts`.
- 173 routes API testées à 0%. Aucun test e2e. `vitest.config.ts` présent mais jamais exécuté en CI (aucun workflow GitHub).
- **Fix** : minimum Playwright sur les 10 parcours clés + vitest sur logique `src/lib/services/*`.

### 🔴 CRITIQUE — Aucune CI/CD
- `.github/workflows` : inexistant. `npm run lint`, `npm run test:run`, `npm run build` jamais exécutés automatiquement.
- **Impact** : n'importe quel push sur `main` déploie en prod sans garde-fou. Confirmé par `git log` : commits "fix" directs sur main.
- **Fix** : workflow `.github/workflows/ci.yml` avec lint + typecheck + build + tests sur PR.

### 🟠 MAJEUR — Fichiers > 300 lignes
- `src/app/api/orders/route.ts` (497 lignes) — viole la règle CLAUDE.md.
- `src/app/api/chat/route.ts` (397), `src/app/api/boucher/stats/route.ts` (373).
- Composants : `KitchenOrderCard.tsx` (750), `ChatWidget.tsx` (597), `ShopProductsClient.tsx` (487), `page.tsx` homepage (452), `ProductSheet.tsx` (443), `PriceAdjustModal.tsx` (435).
- **Fix** : extraire helpers (`orders/create.ts`, `orders/list.ts`), casser `KitchenOrderCard` en sous-composants.

### 🟠 MAJEUR — `console.log` en prod
- 45 occurrences dans 14 fichiers : `src/lib/cron-jobs.ts` (22), `src/lib/services/notification.service.ts` (5), `src/lib/services/payment.service.ts` (3), etc. CLAUDE.md interdit explicitement.
- `src/app/(auth)/admin-login/page.tsx:3` occurrences côté client → visible dans console navigateur prod.
- **Fix** : remplacer par un logger structuré (`src/lib/logger.ts` avec niveaux + silence en prod sauf errors).

### 🟠 MAJEUR — Services `payments.service.ts`, `notifications.service.ts` coexistent avec `notifications.ts`
- Duplication `src/lib/notifications.ts` + `src/lib/services/notification.service.ts` : deux entrées pour la même logique, historique de refactor incomplet.
- **Fix** : consolider dans `services/`.

### 🟡 MINEUR — `any` TypeScript (13 occurrences)
- Voir section Sécurité. Globalement faible, bon point.

### 🟡 MINEUR — Imports panier inconsistants
- CLAUDE.md dit "toujours `use-cart`". Vérifié OK sur re-export `useCart.ts`. Bon.

---

## 4. NEXT.JS APP ROUTER

### 🟠 MAJEUR — Error boundaries complets, bon point
- `src/app/error.tsx`, `(client)/error.tsx`, `(boucher)/error.tsx`, `(admin)/error.tsx`, `webmaster/error.tsx`, `(auth)/error.tsx` : 6 error boundaries présents.  OK.

### 🟠 MAJEUR — `Date.now()` / `Math.random()` dans le rendu
- 35 occurrences dans 20 fichiers `src/app/**` dont certaines en SSR potentiel : `src/app/(client)/avantages/page.tsx`, `src/app/(client)/boutique/[slug]/page.tsx`, `src/app/(client)/commande/[id]/page.tsx` (4 occ.).
- Sur les composants client (`"use client"`), c'est OK pour effects. Mais certains sont dans des server pages (boutique/[slug] n'a pas `"use client"`).
- **Fix** : grep manuel ciblé, déplacer dans `useEffect` ou server-only code (hors render path).

### 🟡 MINEUR — Try/catch présents partout
- Toutes les routes lues ont `try { ... } catch (error) { return handleApiError(error) }`. Bon.

### 🟡 MINEUR — `export const dynamic = "force-dynamic"` abusif
- Présent sur la majorité des routes API, y compris celles qui pourraient être cachées. Force Vercel à exécuter chaque fois. Ex : `/api/calendar-events` est cacheable (3600s) mais a `force-dynamic`.
- **Fix** : retirer `force-dynamic` des GET purement publics + ajouter `revalidate`.

---

## 5. BASE DE DONNÉES

### 🔴 CRITIQUE — Une seule migration historique + `prisma db push` en build
- `prisma/migrations/` : `20260204224837_init` + `20260225000000_add_trigram_search_index` seulement. Tout le schema V4 a été squash-réinit.
- `package.json:7` : `"build": "prisma generate && prisma db push --skip-generate && next build"` → **`db push` en prod sur chaque build Vercel**. CLAUDE.md dit pourtant "Migrations prod : `migrate deploy` (JAMAIS `migrate dev`)".
- **Impact** : drift schema vs migrations, pas d'historique, rollback impossible, risque de perte de colonnes si le schema local diverge.
- **Fix** : passer à `prisma migrate deploy` ; toute modif schema → `migrate dev` local → commit migration → CI `migrate deploy` prod.

### 🟠 MAJEUR — Index manquants potentiels
- Schema a 89 index (bien). Mais `Order.expiresAt` utilisé dans le cron auto-cancel (`src/app/api/cron/auto-cancel/route.ts:18-21` scan PENDING + expiresAt) — vérifier qu'il y a `@@index([status, expiresAt])` (rapide check : les index listés incluent `@@index([status, createdAt])` mais pas explicitement `[status, expiresAt]`).
- **Fix** : ajouter `@@index([status, expiresAt])` sur Order.

### 🟠 MAJEUR — Pas d'index sur `Cart.abandonedAt`
- Cron `abandoned-carts` scanne `cart.findMany` par `abandonedAt`. À vérifier.
- **Fix** : `@@index([abandonedAt])` sur Cart.

### 🟡 MINEUR — Relations Offer.shopId nullable
- Offer peut être plateforme-wide (`shopId: null`) ou boutique-spécifique. Bon design. OK.

---

## 6. UX / ACCESSIBILITÉ

### 🟠 MAJEUR — Pas d'audit formel a11y dans les tests
- Aucun `@axe-core` / `jest-axe` au projet. Contrastes WCAG jamais testés en CI.
- **Fix** : ajouter `jest-axe` + test sur pages clés.

### 🟠 MAJEUR — Dark mode : vérification nécessaire
- `ThemeProvider` présent. CLAUDE.md exige dark sur tous composants. 101 composants client → impossible à vérifier sans test visuel. Probable régressions sur les ~30 composants récents (marketing, promo).

### 🟡 MINEUR — Touch targets
- Pas de tooling pour valider. Inspection manuelle nécessaire. Suspicion de < 44px sur `FilterChips.tsx` et `BottomNav.tsx`.

---

## 7. SEO

### ✅ BON — Fichiers SEO présents
- `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/opengraph-image.tsx` : OK.
- Schemas JSON-LD : `OrganizationSchema`, `ShopSchema`, `BreadcrumbSchema`, `ProductSchema` présents.
- Pages villes SSG `/boucherie-halal/[ville]` avec 6 villes config.

### 🟡 MINEUR — Sitemap : vérifier qu'il n'expose pas de shops non-`visible`
- À vérifier dans `src/app/sitemap.ts`.

### 🟡 MINEUR — `metadataBase` et `NEXT_PUBLIC_SITE_URL`
- `.env.example` ne liste pas `NEXT_PUBLIC_SITE_URL` ni `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` → env vars sous-documentées.
- **Fix** : compléter `.env.example`.

---

## 8. DEVOPS

### 🔴 CRITIQUE — Aucun monitoring d'erreurs
- Pas de Sentry, pas de Logtail, pas de Datadog. 0 occurrence "sentry" dans le code.
- `next.config.mjs:57` autorise `*.sentry.io` dans CSP → l'intégration a été abandonnée sans retrait de la CSP.
- **Impact** : les erreurs prod sont invisibles. Les `console.error` vont dans Vercel logs (7 jours de rétention), aucune alerte.
- **Fix** : installer `@sentry/nextjs` (30 min).

### 🔴 CRITIQUE — Pas de CI (re-souligné)
- Déjà couvert plus haut.

### 🟠 MAJEUR — `.env.example` incomplet
- Manque : `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `CLERK_WEBHOOK_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `REPLICATE_API_TOKEN`, `RESEND_API_KEY`, `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN`.
- `NEXT_PUBLIC_APP_NAME="ClickBoucher"` — **ancien nom**, obsolète. Le projet s'appelle Klik&Go.

### 🟠 MAJEUR — Cron node-cron ET cron Vercel coexistent
- `vercel.json` déclare 13 crons Vercel + `src/lib/cron-jobs.ts` tourne aussi via node-cron (startCronJobs) — potentiel double-exécution, inutile sur Vercel serverless.
- **Fix** : supprimer `src/lib/cron-jobs.ts` (c'est legacy Railway).

### 🟡 MINEUR — `docker-compose.yml` + `setup.sh` + `load-test.js` + `test-clients-realistes.js` à la racine
- Encombrent le repo. Déplacer dans `scripts/` ou supprimer.

---

## SCORES /100

| Dimension | Score | Commentaire |
|-----------|-------|-------------|
| Sécurité | **55** | Clerk+Svix OK, mais uploads béants, Stripe stub, rate-limit lacunaire |
| Performance | **60** | Index Prisma OK, SSE polling coûteux, bundle non-splitté |
| Architecture & qualité | **45** | 497-line orders/route.ts, tests ~0%, duplications services |
| Next.js App Router | **75** | Error boundaries OK, try/catch OK, abus force-dynamic |
| Base de données | **50** | 89 index OK, mais `db push` en prod = rouge vif |
| UX / Accessibilité | **60** | Design system propre, a11y non-testée |
| SEO | **80** | Sitemap/robots/JSON-LD/villes : solide |
| DevOps | **25** | Aucune CI, aucun monitoring, env.example obsolète |

**Score global : 56/100** — projet fonctionnel mais fragile. Comportement de startup solo : feature first, infra last.

---

## TOP 10 FIXES PRIORITAIRES

1. **[Sécurité]** Verrouiller `POST /api/uploads/product-image` : role BOUCHER/ADMIN obligatoire + `productId` requis. Verrouiller DELETE : résoudre ownership. (`src/app/api/uploads/product-image/route.ts:21,108`) — 30 min.
2. **[DB]** Remplacer `prisma db push` par `prisma migrate deploy` dans le build script. (`package.json:7`) — 1 h + tests.
3. **[DevOps]** Installer Sentry (`@sentry/nextjs`) + wiring `handleApiError`. — 1 h.
4. **[DevOps]** Créer `.github/workflows/ci.yml` : lint + typecheck + test:run + build sur PR. — 30 min.
5. **[Sécurité]** Rate-limit sur `/api/chat`, `/api/search`, `/api/offers/validate`, `/api/checkout/validate-code`, `/api/*/images/generate`. — 1 h.
6. **[Sécurité]** Retirer Stripe de la doc/CSP OU l'implémenter réellement. Décision business. — variable.
7. **[Code quality]** Remplacer 45 `console.log` par un logger silencieux en prod (`src/lib/logger.ts`). — 1 h.
8. **[Perf]** Lazy-load `recharts`, `html5-qrcode`, `qrcode.react` via `dynamic()`. Désinstaller `html-to-image`. — 30 min.
9. **[Perf]** Remplacer SSE polling par Redis pub/sub dans `boucher/orders/stream` (ou fallback à 15s si trop gros). — 3 h.
10. **[Sécurité]** Cache de rôles middleware → Upstash Redis. (`src/middleware.ts:24-48`) — 45 min.

---

## VERDICT GLOBAL

**Klik&Go est un MVP ambitieux, fonctionnel en démo, pas encore production-grade.**

Points forts :
- Schema Prisma riche (50 modèles, 89 index, logique Uber Eats bien modélisée).
- SEO soigné (schemas JSON-LD, pages villes SSG).
- Clerk + Svix webhook correctement implémentés.
- Design system cohérent (Tailwind + shadcn + Outfit + #DC2626).
- Logique métier dense : mode cuisine, busy mode, price adjustment, fidélité.

Points faibles rédhibitoires :
- **Aucun monitoring** (Sentry absent) → tu es aveugle en prod.
- **Aucune CI** → chaque push = roulette russe.
- **3 fichiers de tests** pour 173 routes.
- **`db push` en prod** → drift quasi garanti.
- **Stripe vendu comme prêt mais c'est un stub** → risque de communication mensongère.
- **Uploads produits ouverts à tout user authentifié** → exploit facile.

À ce stade, un incident de sécurité ou un rollback raté peut tuer le produit. **Stabiliser les points 1-4 du top 10 avant toute nouvelle feature.**
