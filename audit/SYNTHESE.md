# 🎯 SYNTHÈSE — Audit complet Klik&Go

**Date** : 2026-04-26
**Auditeur** : Ghost CTO
**Méthodologie** : 6 phases parallèles (recon + auth/tenant + Stripe + backend security + frontend perf + architecture/tests + UX)
**Scope** : 181 routes API · 90 pages · 49 modèles Prisma · ~85 000 lignes TS/TSX · 112 tests

---

## 📊 Score global par catégorie

| # | Catégorie | Score | Justification |
|---|-----------|------:|---------------|
| 0 | Reconnaissance / Stack | — | Mono-repo Next.js 14 + Prisma 5 + Clerk + Upstash + Sentry. Solide. |
| 1 | **Auth & Multi-tenant** | **7.0** /10 | Scoping Prisma propre dans 90% des routes boucher, mais 6 trous critiques (test-mode, cache rôle non invalidé) |
| 2 | **Paiements Stripe** | **1.0** /10 | Stack annoncée comme "prête" mais 0 ligne de code. Bug UX mortifère. |
| 3 | **Sécurité Backend** | **7.8** /10 | Auth 83%, Zod 74 routes, mais rate-limit seulement 8.8% + secret de test exposé |
| 4 | **Performance Frontend** | **7.5** /10 | Singleton Prisma, lazy-load OK, ISR OK, mais 0/119 `findMany` paginé + 190 `"use client"` |
| 5 | **Architecture / Tests / Ops** | **5.5** /10 | Pas de transactions sur mutations multi-entités, pas de pgbouncer, healthcheck inutile, Sentry inactif |
| 6 | **UX / Design** | **7.5** /10 | Design system solide, dark mode complet, mais touch targets <44px et contraste WCAG fail |

**Score moyen pondéré : 6.0 /10**

> Verdict : **MVP fonctionnel et bien architecturé en surface, mais 4 zones critiques peuvent tuer le produit en prod scale**. Les 3 dettes techniques bloquantes (test-mode bypass, transactions manquantes, Stripe trompeur) doivent être réglées avant tout traffic significatif.

---

## 🔥 TOP 10 critiques consolidés (toutes phases)

### #1 🚨 Test-mode bypass = compromission complète
**Phases 1 + 3** convergent.

**Fichier** : `src/lib/auth/test-auth.ts:44`, `src/middleware.ts`, `src/lib/admin-auth.ts`, `src/lib/boucher-auth.ts`
**Problème** : `NEXT_PUBLIC_TEST_SECRET` est exposé dans le bundle client (variable préfixée `NEXT_PUBLIC_*`). Combiné à `NEXT_PUBLIC_TEST_MODE=true` qui est probablement actif sur Vercel prod, n'importe quel visiteur peut :
1. Lire le secret dans le JS
2. Set le cookie `klikgo-test-activated=true` + `klikgo-test-role=ADMIN|BOUCHER|WEBMASTER`
3. Bypasser totalement Clerk
4. Devenir admin/boucher principal et lire/écrire toutes les données

**Impact** : faille critique de niveau "prend tout le contrôle".
**Effort fix** : 30 min (passer le secret en server-only, retirer `NEXT_PUBLIC_*`, gater test-mode par IP allowlist ou désactiver en prod)

---

### #2 🚨 Stripe annoncé "prêt" → bug UX mortifère
**Phase 2**.

**Fichier** : `src/app/(client)/panier/page.tsx:753-788`
**Problème** : si un boucher coche `acceptOnline=true` (option DB), le client voit le bouton "Payer X €", clique, le code appelle un stub `SERVICE_DISABLED` mais la commande passe quand même côté boucher comme si elle était payée. Le client se présente au retrait, le boucher demande paiement, litige garanti.

**Documentation trompeuse** :
- `CLAUDE.md:5` annonce Stripe dans la stack
- `README.md:14` : "Paiement | Mock (structure prête)" — faux
- `DEPLOY.md` détaille "Activer Stripe" avec env vars jamais lues

**Impact** : litiges clients, perte de réputation, potentiellement légal (RGPD/DDPP).
**Effort fix** : 15 min pour patcher l'UI (forcer paiement sur place tant que Stripe pas implémenté), 2-3 semaines pour vraie intégration Stripe Connect.

---

### #3 🚨 createOrder hors transaction
**Phase 5**.

**Fichier** : `src/lib/services/orders/create.ts:250-459`
**Problème** : `prisma.offer.update()` (decrement coupon usage), `prisma.loyaltyReward.update()` (mark used), puis `prisma.order.create()` sont **séquentiels**. Si crash après update offer mais avant create order, le coupon est consommé pour rien et le client paie plein tarif.

**Impact** : incohérence DB, perte de promo, plaintes clients.
**Effort fix** : 1h (wrap dans `prisma.$transaction(async tx => { ... })`).

---

### #4 🚨 ACCEPT boucher hors transaction → survente
**Phase 5**.

**Fichier** : `src/app/api/boucher/orders/[orderId]/action/route.ts:137-178`
**Problème** : 2 transactions séparées (status update puis stock decrement). Sur anti-gaspi/flash sale, 2 commandes simultanées peuvent toutes deux passer la 1ère transaction et survendre le stock.

**Impact** : survente, no-show forcé pour le 2e client, perte confiance.
**Effort fix** : 1h (transaction atomique + lock).

---

### #5 🚨 Cache Redis rôle 5 min jamais invalidé
**Phase 1**.

**Fichier** : `src/middleware.ts`, `src/lib/admin-auth.ts`, `src/lib/boucher-auth.ts`
**Problème** : 3 caches concernés, aucun n'invalide la clé sur changement de rôle. Un boucher banni / un admin rétrogradé garde tous ses droits pendant 5 minutes.

**Impact** : compte abuser une fois banni continue, faille à exploiter pour exfiltration.
**Effort fix** : 30 min (invalidation Redis sur webhook Clerk role change OR purge à la mutation côté admin).

---

### #6 🚨 Pas de pgbouncer Vercel serverless
**Phase 5**.

**Fichier** : `.env.example:8` (DATABASE_URL Vercel)
**Problème** : sans `?pgbouncer=true&connection_limit=1`, chaque cold start serverless ouvre une nouvelle connection PostgreSQL. À 100 req/s, le pool Railway sature immédiatement, les requêtes timeout, l'app casse.

**Impact** : panne complète sous charge.
**Effort fix** : 5 min (modifier env var Vercel + ajouter direct URL pour migrations).

---

### #7 🚨 0/119 `findMany` paginé
**Phase 4**.

**Fichier** : `src/app/api/shops/[id]/route.ts:25` (cas critique : tous les produits d'une boutique)
**Problème** : aucune route avec `take: N`. Une boutique avec 500 produits = payload massif. En cas d'attaque (curl en boucle), DB tremble.

**Impact** : DoS facile + perf dégradée.
**Effort fix** : 2h (cursor pagination sur les 5 routes les plus chargées).

---

### #8 🚨 0 `captureException` Sentry → errors invisibles
**Phase 5**.

**Fichier** : `src/lib/api/errors.ts` + Sentry config
**Problème** : Sentry installé (`@sentry/nextjs`) mais `handleApiError` ne capture rien manuellement. Les erreurs catchées dans les routes ne remontent jamais à Sentry. Tu es aveugle en prod.

**Impact** : bugs silencieux, MTTR allongé, satisfaction client érodée.
**Effort fix** : 30 min (`Sentry.captureException(err)` dans `handleApiError`).

---

### #9 🚨 Rate-limit 8.8% seulement
**Phase 3**.

**Fichier** : 165/181 routes sans `checkRateLimit`
**Problème** : routes coûteuses sans protection :
- `/api/dashboard/marketing/generate-visual` (Replicate, payant)
- `/api/cart/add` (anti-spam panier)
- `/api/auth/me`, `/api/notifications`
- `/api/admin/banners`, `/api/admin/calendar`, `/api/admin/flags`
- `/api/orders/[id]/status` (mutation possible en boucle)

**Impact** : vol crédits AI, DoS, brute-force.
**Effort fix** : 2h (audit + appliquer `rateLimits.api` ou `rateLimits.ai`).

---

### #10 🚨 Tests coverage critique = 0%
**Phase 5**.

**Fichiers** : action boucher (651L), checkout, loyalty, admin (32 pages), webhooks Clerk, adjust-price.
**Problème** : 112 tests existants couvrent orders/create+list, tickets, search, prompts, hours. Mais les routes les plus business-critical n'ont AUCUN test. Régression silencieuse possible à chaque push.

**Impact** : confiance dans les déploiements zéro, prod brittle.
**Effort fix** : 16h pour atteindre 60% coverage sur les paths critiques.

---

## 🗺️ Roadmap fix (3 horizons)

### 🔥 Cette semaine (critique business — fix avant tout traffic)
1. **Test-mode** : retirer `NEXT_PUBLIC_TEST_*` du bundle, désactiver en prod, gater par IP allowlist (#1) — **30 min**
2. **Stripe UX** : forcer "paiement sur place" tant que Stripe pas implémenté ; nettoyer la doc trompeuse (#2) — **15 min**
3. **createOrder transaction** : wrap dans `$transaction` (#3) — **1 h**
4. **ACCEPT transaction** : atomique + stock check (#4) — **1 h**
5. **Cache rôle invalidation** : webhook Clerk + purge admin (#5) — **30 min**
6. **pgbouncer** : modifier `DATABASE_URL` Vercel + direct URL pour migrate (#6) — **5 min**
7. **Sentry capture** : ajouter `Sentry.captureException` dans `handleApiError` (#8) — **30 min**

**Total : ~3h45 pour fermer les 7 plus gros trous.**

---

### 📅 Ce mois-ci (important — fix avant scale)
8. **Pagination** : cursor sur 5 routes critiques (#7) — **2 h**
9. **Rate-limit** : couvrir 50+ routes manquantes (#9) — **2 h**
10. **Tests critiques** : action boucher + checkout + loyalty (#10) — **16 h**
11. **`proxy.ts` mort** : supprimer (Phase 1) — **5 min**
12. **CSP `unsafe-eval`** : retirer (Phase 1) — **15 min**
13. **CSRF tokens** : Clerk gère, mais documenter pour audit externe (Phase 3) — **1 h**
14. **`text-gray-400` global → `gray-500`** : 67 occurrences (Phase 6) — **30 min**
15. **Touch targets ≥44px** : audit composants UI (Phase 6) — **1 h**
16. **Healthcheck DB+Redis** : ping réel (Phase 5) — **30 min**
17. **Cache Redis stats** : agrégations admin (Phase 5) — **2 h**
18. **Webhook Clerk idempotence** : table `WebhookEvent` + svix-id check (Phase 5) — **2 h**
19. **`ProductForm.tsx` (1708L) vs `ProductFormPage.tsx` (1703L)** : audit duplication (Phase 4) — **1 h**
20. **Sticky CTA panier** : pattern Uber Eats (Phase 6) — **30 min**

**Total : ~30h.**

---

### 📚 Backlog (amélioration continue)
21. Prisma v6 migration (`prisma-client` generator) — Phase 4
22. Réduire `"use client"` (190 fichiers, beaucoup en trop) — Phase 4
23. Refactor fichiers >700L (14 fichiers identifiés) — Phase 4
24. `helper cached(key, ttl, fn)` Redis — Phase 5
25. Stripe Connect intégration complète (2-3 semaines) — Phase 2
26. Tests e2e Playwright — Phase 5
27. Logger structuré + correlation ID — Phase 5
28. Runbook rollback DB documenté — Phase 5
29. `optimizePackageImports` next.config — Phase 4
30. Inscription boucher en steps (`Stepper` existant inutilisé) — Phase 6

---

## 🎯 Recommandations stratégiques

### Process / qualité
- **Pre-commit hook** : `npx tsc --noEmit && npx vitest run --bail` — bloque les régressions
- **PR template** : checklist sécu (auth, scoping, rate-limit, Zod, tests)
- **Code review obligatoire** sur main (déjà CI en place, ajouter approval)
- **Feature flags** (`growthbook`, `posthog`) pour rollout progressif des features risquées

### Monitoring
- **Sentry** : compléter avec `captureException` puis activer alertes Slack
- **Plausible / Google Analytics** : suivre conversion par persona (audit Phase 6 a noté que `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` n'est pas détecté en prod)
- **Vercel Analytics + Speed Insights** : déjà installés, vérifier dashboards CWV

### Sécurité
- **WAF Cloudflare** ou **Vercel Firewall** sur les routes API publiques
- **Bug bounty** discret (HackerOne / YesWeHack) avant trafic réel
- **Pen test externe** annuel (~3-5k€)

### Tests
- Cible 60% coverage routes critiques en 3 mois
- Tests e2e Playwright sur 10 parcours clés (login, commande, livraison, refund, etc.)
- Smoke tests post-déploiement automatiques

### Stripe
- Décision **business** à prendre en priorité : on intègre ou on assume "paiement sur place" comme positionnement ?
- Si on intègre : **Stripe Connect Express** est la voie correcte (Phase 2 a détaillé la roadmap 10 étapes)

---

## ⚡ Quick wins (<30 min — gros impact)

| # | Action | Effort | Impact |
|---|--------|-------:|--------|
| 1 | Retirer `NEXT_PUBLIC_TEST_*` du bundle | 30 min | 🔴 Sécurité |
| 2 | Désactiver `NEXT_PUBLIC_TEST_MODE=true` en prod Vercel | 5 min | 🔴 Sécurité |
| 3 | Ajouter `?pgbouncer=true` à `DATABASE_URL` | 5 min | 🔴 Stabilité |
| 4 | `Sentry.captureException` dans `handleApiError` | 30 min | 🔴 Observabilité |
| 5 | Patch UX paiement online → "sur place" forcé | 15 min | 🔴 UX/litiges |
| 6 | Cache rôle : invalidation sur webhook Clerk | 30 min | 🔴 Sécurité |
| 7 | Supprimer `proxy.ts` mort | 5 min | 🟡 Code quality |
| 8 | `text-gray-400` → `gray-500` global | 30 min | 🟡 a11y |
| 9 | Healthcheck ping DB | 15 min | 🟡 Ops |
| 10 | Touch targets +/- ProductCard 36px → 44px | 15 min | 🟡 UX mobile |

**Total : ~3h pour boucler 10 quick wins à fort ROI.**

---

## 📁 Rapports détaillés

| Phase | Fichier | Lignes |
|-------|---------|-------:|
| 0 | `audit/phase-0-recon.md` | 205 |
| 1 | `audit/phase-1-auth-tenant.md` | 368 |
| 2 | `audit/phase-2-stripe.md` | 257 |
| 3 | `audit/phase-3-backend-security.md` | 207 |
| 4 | `audit/phase-4-frontend-perf.md` | 151 |
| 5 | `audit/phase-5-backend-perf.md` | 205 |
| 6 | `audit/phase-6-ux-design.md` | 191 |
| 7 | `audit/SYNTHESE.md` | (ce fichier) |
| **Total** | | **~1600 lignes** |

---

## 🏁 Verdict final

**Klik&Go est un projet ambitieux et bien construit pour un MVP solo, mais il a 7 trous bloquants à fermer avant tout trafic significatif.**

3h45 de fix concentrés peuvent passer le score global de **6.0/10 → 7.8/10** et éliminer les risques business immédiats.

Les 30h supplémentaires en M+1 amèneront le projet à **8.5/10** — niveau "production-grade" avec tests/perf/observabilité solides.

Le backlog de 3 mois (60h) cible un score **9+/10** comparable aux meilleures plateformes SaaS B2B.

**Action immédiate recommandée** : implémenter les 7 fixes critiques (#1-#7 du roadmap "cette semaine") en une session de 4h. Ça change tout.
