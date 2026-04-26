# Phase 0 — Reconnaissance

**Date** : 2026-04-26
**Auditeur** : Ghost CTO
**Branche** : `claude/quirky-kirch`

---

## 1. Type de projet

**Mono-repo Next.js full-stack uniquement.** Pas de Spring Boot ni de backend séparé. Tout vit dans le même repo Next.js avec :
- Frontend (pages + components) dans `src/app/(client|boucher|admin)`, `src/components`
- Backend (API Routes) dans `src/app/api/**/route.ts`
- Logique métier dans `src/lib/services/**`

**Conséquence** : on auditera une seule codebase, pas de séparation front/back. Phases 3 et 5 se concentreront sur API Routes Next.js (pas Spring).

---

## 2. Structure du projet

```
clickboucher/
├── src/
│   ├── app/
│   │   ├── (admin)        # Routes admin (login, dashboard)
│   │   ├── (auth)         # Sign-in / sign-up Clerk
│   │   ├── (boucher)      # Espace boucher (dashboard, produits, commandes, support)
│   │   ├── (client)       # Boutiques publiques + parcours achat
│   │   ├── api/           # 181 route.ts répartis en 28 groupes
│   │   ├── boucherie-halal/[ville]  # Pages SEO ville (SSG)
│   │   ├── dashboard/     # Auth dashboard
│   │   ├── webmaster/     # Back-office plateforme
│   │   ├── icon.tsx       # Favicon généré
│   │   └── opengraph-image.tsx  # OG image dynamique
│   ├── components/        # 123 composants
│   ├── hooks/             # Custom hooks (cart, polling, kitchen)
│   ├── lib/               # Services métier, helpers, validators
│   ├── middleware.ts      # ⚠️ ACTIF (Next.js 14)
│   ├── proxy.ts           # ⚠️ INACTIF (préparation Next.js 16+ — dead code actuellement)
│   ├── instrumentation.ts # Sentry
│   └── styles/
├── prisma/
│   ├── schema.prisma      # 49 models, 1707 lignes
│   ├── migrations/        # 3 migrations (init + trigram + indexes)
│   └── seed.ts
├── tests/                 # 9 fichiers test, 112 tests
│   ├── lib/               # Unit tests (cart, schemas, prompts, hours, search)
│   ├── services/orders/   # create + list (14 tests)
│   ├── api/support/       # tickets (3 tests)
│   └── security/          # multitenant
├── public/                # PWA icons + manifest
├── scripts/               # Utilitaires
├── audit/                 # Rapports d'audit
├── sentry.{client,server,edge}.config.ts
├── vercel.json            # 13 crons + rewrites
├── next.config.mjs        # CSP, images, redirects
└── docker-compose.yml     # Postgres local dev
```

---

## 3. Stack réel

| Couche | Tech | Version |
|--------|------|---------|
| Framework | **Next.js** | `14.2.0` (App Router, **pas 16+**) |
| Runtime | Node.js | 20 (CI) |
| Langage | TypeScript | 5+ |
| UI | React | `18.3` |
| ORM | Prisma | `5.14.0` (legacy generator, **pas v6 prisma-client**) |
| DB | PostgreSQL | Railway |
| Auth | Clerk | `@clerk/nextjs ^6.37.3` |
| Cache/Queue | Upstash Redis | `^1.36.2` + Ratelimit `^2.0.8` |
| Storage | Vercel Blob | `^2.3.0` |
| Email | Resend | `^6.9.1` |
| AI | Anthropic SDK + Replicate | `^0.74.0` / `^1.4.0` |
| Webhooks | Svix | `^1.84.1` |
| Monitoring | Sentry | `@sentry/nextjs ^10.49.0` |
| Validation | Zod | `^3.23.0` |
| Styling | Tailwind | `^3.4.0` |
| Charts | Recharts | `^3.7.0` |
| Tests | Vitest | `^4.0.18` |
| Hébergement | Vercel (front+API) + Railway (DB) | — |

**Constats stack** :
- ✅ Next.js 14 stable (LTS), bien maintenu
- ⚠️ **Prisma 5.x** — la v6 introduit le nouveau generator `prisma-client` plus performant. Migration recommandée à terme.
- ⚠️ `node-cron` installé (`^4.2.1`) mais Vercel cron est utilisé (vercel.json) — `node-cron` est ineffectif sur serverless.

---

## 4. Dépendances critiques (analyse rapide)

**Sécurité-impact** :
- 🔒 `@clerk/nextjs` ^6.37.3 — auth ✅
- 🔒 `dompurify` ^3.3.1 — XSS sanitization (à auditer son usage)
- 🔒 `svix` ^1.84.1 — webhook signature verification
- 🔒 `@upstash/ratelimit` — rate limiting (à valider sa couverture)

**Paiements** : 🔴 **AUCUN package Stripe installé**. Pas de `stripe` ni `@stripe/stripe-js`.

**AI / coûts variables** :
- `@anthropic-ai/sdk` — Claude API (chat support, prompt enhance)
- `replicate` — image generation
- `ai` — Vercel AI SDK

**Manquant** :
- ❌ Pas de testing React Testing Library / Playwright e2e installés en deps (que vitest)
- ❌ Pas de package `helmet` ou équivalent (mais Next gère via headers config)

---

## 5. Fichiers de config sensibles

| Fichier | Rôle | Contient secrets ? |
|---------|------|---|
| `.env.example` | Template env vars | Non (placeholders OK) |
| `.env` (local) | Dev secrets | ✅ (gitignored OK) |
| `.env.production` (Vercel) | Prod secrets | Cloud-side OK |
| `prisma/schema.prisma` | Schema DB (49 models) | Non |
| `next.config.mjs` | Config Next + CSP | Non |
| `vercel.json` | 13 cron jobs + rewrites | Non |
| `middleware.ts` | Auth Clerk + Redis role cache | Non |
| `proxy.ts` | ⚠️ **INACTIF** (Next.js 14) — dead code | Non |
| `sentry.*.config.ts` | Sentry init | DSN attendu via env |
| `src/lib/auth/**` | Auth helpers | Non |

---

## 6. Zones critiques business

### 🔴 Niveau 1 (perte d'argent direct)
- `src/app/api/orders/route.ts` (controller, 55L)
- `src/lib/services/orders/{create,list}.ts` (logique pricing, idempotency)
- `src/app/api/payments/{webhook,[orderId]}/route.ts` ⚠️ **STUBS — Stripe non implémenté**
- `src/lib/services/support-ai.ts` (coûts Anthropic)
- `src/app/api/boucher/images/{generate,retouch}/route.ts` (coûts Replicate)

### 🔴 Niveau 2 (multi-tenant — fuite cross-shop)
- `src/lib/boucher-auth.ts` (résolution shopId par boucher)
- `src/lib/admin-auth.ts` (vérif admin/webmaster)
- `src/app/api/boucher/**/route.ts` (~25 routes)
- `src/app/api/shops/[id]/**/route.ts`
- Pattern `OR clause` ownerId clerkId / dbUser.id (cf. CLAUDE.md)

### 🟡 Niveau 3 (auth/session)
- `src/middleware.ts` (active) — Clerk + cache Redis rôle
- `src/lib/auth/server-auth.ts` (`getServerUserId`)
- `src/lib/auth/test-auth.ts` (mode test cookies)
- `src/lib/auth/rbac.ts` (role-based access)

### 🟡 Niveau 4 (données utilisateur)
- `src/app/api/cart/**` (panier)
- `src/app/api/users/**` (CRUD profil)
- `src/app/api/uploads/**` (Blob upload)

---

## 7. Constats préliminaires (à approfondir)

| Constat | Sévérité | Phase |
|---------|----------|-------|
| Stripe annoncé "structure prête" mais c'est un stub `SERVICE_DISABLED` | 🔴 | Phase 2 |
| `middleware.ts` ET `proxy.ts` coexistent — confusion versionnage | 🟡 | Phase 1 |
| Prisma 5.x — generator legacy (pas v6 `prisma-client`) | 🟢 | Phase 4 |
| `node-cron` installé mais Vercel cron actif → dépendance morte | 🟢 | Phase 4 |
| 49 models Prisma — surface d'attaque large pour le multi-tenant | 🟡 | Phase 1 |
| 181 routes API — couverture audit conséquente | — | Phases 1-3 |
| Tests : 112 actuels (8 fichiers) — couverture orders+tickets+search OK, autres routes 0% | 🟡 | Phase 5 |

---

## 8. Métriques projet

- **~85 000 lignes de code** (TS + TSX)
- **181 routes API**
- **90 pages**
- **123 composants React**
- **49 models Prisma** (1707 lignes schema)
- **112 tests unitaires** (vitest)
- **3 migrations Prisma** (1 init + 1 trigram + 1 indexes)
- **~38 commits** sur la branche en cours

---

## 9. Ce que je vais auditer

| Phase | Zone | Fichiers cibles principaux |
|-------|------|---------------------------|
| 1 | Auth + Multi-tenant | `middleware.ts`, `proxy.ts`, `lib/auth/*`, `boucher-auth.ts`, `admin-auth.ts`, échantillon de 30 routes API |
| 2 | Paiements Stripe | `app/api/payments/*`, `app/api/checkout/*`, recherche occurrences "stripe" / "checkout" |
| 3 | Sécu Backend (API Next.js) | Validation Zod sur 181 routes, rate-limits, CSRF, headers, CORS, secrets |
| 4 | Perf Frontend | `lib/prisma.ts`, `"use client"` audit, hydration, N+1, bundle size |
| 5 | Architecture/Tests | Couches services, transactions, healthchecks, index DB, tests |
| 6 | UX/Design | Mobile-first, a11y, design tokens, formulaires, empty states |
| 7 | Synthèse + Roadmap | Score /10 par catégorie, top 10, roadmap 3 horizons |

---

## ⏸️ Pause

Phase 0 terminée. Rapport généré dans `audit/phase-0-recon.md`.

**OK pour passer à la Phase 1 — Authentification & Multi-tenant ?**
