# Architecture — Klik&Go

> Document de référence technique pour développeurs et auditeurs.
> Dernière mise à jour : mai 2026.

---

## Vue d'ensemble

Klik&Go est un **marketplace 3-sided** (clients × boucheries × admin) construit sur Next.js 14 avec App Router. Architecture **multi-tenant** où chaque boucherie est une entité isolée logiquement (scope par `shopId` côté Prisma sur 100 % des requêtes métier).

```
┌─────────────────────────────────────────────────────────────┐
│                       VERCEL (Edge + Lambda)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐   │
│  │  CLIENT  │  │ BOUCHER  │  │ WEBMASTER│  │  PUBLIC SEO│   │
│  │ /(client)│  │/(boucher)│  │/webmaster│  │  /boutique │   │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘   │
│        │            │             │              │          │
│        └────────────┴─────────────┴──────────────┘          │
│                          │                                  │
│              ┌───────────▼──────────┐                       │
│              │     27+ groupes      │                       │
│              │   /api/* (Next.js)   │                       │
│              └───────────┬──────────┘                       │
└──────────────────────────┼──────────────────────────────────┘
                           │
       ┌───────────────────┼───────────────────────┐
       │                   │                       │
   ┌───▼────┐         ┌────▼────┐            ┌─────▼────┐
   │ CLERK  │         │ STRIPE  │            │ POSTGRES │
   │ (Auth) │         │CONNECT  │            │ (Railway)│
   └────────┘         └─────────┘            └──────────┘

   ┌────────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐
   │UPSTASH │  │  RESEND │  │ANTHROPIC │  │REPLICATE │
   │ (Redis)│  │ (Email) │  │ (Claude) │  │ (Images) │
   └────────┘  └─────────┘  └──────────┘  └──────────┘
```

---

## Stack technique

| Couche | Tech | Pourquoi |
|---|---|---|
| **Framework** | Next.js 14 (App Router) + TypeScript strict | SSR/SSG/ISR natif, perf, RSC pour SEO |
| **UI** | Tailwind CSS + shadcn/ui + Lucide React | Design system cohérent, dark mode natif |
| **Auth** | Clerk | Multi-rôle natif, Sign-in social, MFA, support FR |
| **DB** | PostgreSQL (Railway) + Prisma ORM | Type-safe, migrations versionnées, RLS-ready |
| **State client** | Zustand + React Context (panier) | Léger, pas de prop-drilling |
| **Cache/RL** | Upstash Redis | Edge-compatible, KV global low-latency |
| **Payments** | Stripe Connect (markup pricing) | Marketplace standard, conforme PCI-DSS |
| **Emails** | Resend | API moderne, taux de delivery élevé |
| **AI** | Anthropic Claude | Support tickets auto-réponse + escalation |
| **Images IA** | Replicate (FLUX) → Vercel Blob | Génération images produits/bannières |
| **Notifications** | Web Push + Resend + Svix | Multi-canal (push, email, webhooks) |
| **Charts** | Recharts | Stats boucher dashboard |
| **QR codes** | qrcode.react + html5-qrcode | Retrait commande + scan |
| **Analytics** | Plausible (RGPD-compliant, sans cookies) | Conformité RGPD France |
| **Monitoring** | Sentry | Errors + perf + replay sessions |
| **Tests** | Vitest + Testing Library + Playwright | Unit + integration + E2E |
| **CI/CD** | GitHub Actions + Vercel auto-deploy | Pipeline standard, preview sur PR |

---

## Personas et leurs domaines

### 1. CLIENT (`src/app/(client)/`)
Visiteur public ou utilisateur connecté qui commande de la viande halal.

**Pages clés** :
- `/` — Homepage (boutiques + offres, ISR 60 s)
- `/boutique/[slug]` — Détail boutique + produits + commande
- `/panier`, `/checkout` — Tunnel commande
- `/commandes`, `/suivi/[id]` — Historique + suivi temps réel
- `/recettes`, `/bons-plans`, `/favoris` — Engagement
- `/click-and-collect-halal`, `/commander-viande-halal` — Pages SEO money-keywords
- `/boucherie-halal/[ville]` — 12 pages SSG par ville
- `/devenir-boucher-partenaire/[ville]` — 12 landings B2B inbound

### 2. BOUCHER (`src/app/(boucher)/`)
Commerçant qui gère sa boutique, son catalogue, ses commandes.

**Pages clés** :
- `/boucher/commandes` — **Mode Cuisine** (3 colonnes, polling 5 s, sons, alertes thermal printer 80mm)
- `/boucher/dashboard` — KPIs + raccourcis
- `/boucher/dashboard/{statistiques,finances,parrainage,...}` — back-office
- `/boucher/produits` — Catalogue + packs + reorder DnD
- `/boucher/clients` — Clients fidélité + PRO
- `/boucher/parametres` — Réglages boutique + Stripe Connect

### 3. WEBMASTER / ADMIN (`src/app/webmaster/`)
Équipe Klik&Go qui modère, supervise, acquiert.

**Pages clés** :
- `/webmaster` — Dashboard global (KPIs plateforme)
- `/webmaster/boutiques`, `/webmaster/boutiques/[shopId]` — Validation + commission + suspend
- `/webmaster/prospects` — **CRM acquisition** boucheries (NEW → SIGNED)
- `/webmaster/marketing` — Banners + offers + campaigns
- `/webmaster/finances`, `/webmaster/facturation` — Markup + commissions
- `/webmaster/audit`, `/webmaster/flags`, `/webmaster/api-keys` — Système

---

## Modèles Prisma — vue résumée

```
User ──┬── Clerk (clerkId)
       └── role: CLIENT | CLIENT_PRO | CLIENT_PRO_PENDING | BOUCHER | ADMIN

Shop ──┬── owner: User
       ├── tier: BRONZE | SILVER | GOOLD (commission %)
       ├── products[], categories[], orders[], reviews[]
       └── members[] (multi-utilisateur boucher)

Order ──┬── user, shop, items[]
        ├── status: PENDING → ACCEPTED → PREPARING → READY → PICKED_UP / CANCELLED
        ├── payment: ONLINE (Stripe) | ON_PICKUP
        ├── priceAdjustment? (3 paliers: auto / 5min / 10min escalation)
        └── pickupSlotStart/End

Marketing : Promotion + LoyaltyReward + Offer + Banner + Campaign + Audience
Acquisition : Prospect (NEW → CONTACTED → … → SIGNED)
Support : SupportTicket + SupportMessage (AI handled / escalated)
```

Voir [prisma/schema.prisma](./prisma/schema.prisma) pour le détail complet (1700+ lignes).

---

## Patterns critiques

### 🔐 Multi-tenant scoping
**Toute requête métier doit être scopée par `shopId`.**
Helper réutilisable : `getAuthenticatedBoucher()` dans `src/lib/boucher-auth.ts` retourne `{ userId, shopId }` ou `{ error }`.

```typescript
const authResult = await getAuthenticatedBoucher();
if (authResult.error) return authResult.error;
const { shopId } = authResult;

const products = await prisma.product.findMany({ where: { shopId } });
```

### 🧪 Test mode boucher
Les routes boucher doivent utiliser `getBoucherOwnerUserId()` pour résoudre le clerkId test → vrai ownerId du shop.

```typescript
const ownerId = await getBoucherOwnerUserId();
const dbUser = await prisma.user.findUnique({ where: { clerkId: ownerId } });
const shop = await prisma.shop.findFirst({
  where: { OR: [{ ownerId }, { ownerId: dbUser?.id }] },
});
```

### 💰 Stripe Connect markup pricing
Prix toujours **recalculé serveur** avant Checkout Session. Markup commission appliqué via `application_fee_amount`. Webhook signature toujours vérifiée avec `constructEvent()`.

### 🚀 ISR par défaut
Pages publiques utilisent `export const revalidate = N` (60 s pour homepage, 30 s pour fiche boutique, 3600 s pour pages SEO villes).

### 🔍 SEO structuré
- `generateMetadata()` sur chaque page publique (title 50-60 chars, OG, canonical)
- JSON-LD : Organization, WebSite, Store, LocalBusiness, Product, BreadcrumbList, FAQPage, Recipe
- Sitemap dynamique (`src/app/sitemap.ts`) inclut shops + villes + recettes + landings B2B
- `llms.txt` à la racine pour IA crawlers (ChatGPT, Claude, Perplexity, Gemini)
- IndexNow ping auto à chaque shop validé (Bing/Copilot temps réel)

### 🎯 Pas de N+1
- Toujours `include`/`select` Prisma explicites
- Pagination obligatoire sur listes >50 items
- Index DB sur colonnes filtrées/triées

---

## Sécurité

### Authentification
- **Clerk** côté client (composants `<SignedIn>`, `<UserButton>`, etc.)
- **Server-side** : `getServerUserId()` (jamais `auth()` direct → casse le test mode)
- **Test mode** validé via `TEST_SECRET` server-only + cookie `klikgo-test-activated`
- **Admin/Webmaster** : `requireAdmin()` avec cache Redis 60s

### Validation
- **Zod côté serveur** sur 100 % des mutations
- Erreurs typées via `apiError(code, message)` → JSON shape stable

### Rate limiting
- Upstash Ratelimit par route (orders, auth, support)
- Fallback in-memory si Redis indisponible

### CSP
- Stricte côté `next.config.mjs` (Clerk + Cloudflare + Anthropic + Stripe whitelistés uniquement)

### Audit log
- Toutes les actions admin sensibles écrites dans `AuditLog` via `writeAuditLog()`

---

## Performance

### Core Web Vitals (cibles)
- LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms (mobile)

### Optimisations
- **Images** : `next/image` partout, WebP first (pas AVIF), quality 60 pour cards
- **Fonts** : `next/font` (DM Sans + Outfit + Cormorant)
- **JS** : code splitting Next auto + dynamic imports pour PWA/popups (`{ ssr: false }`)
- **Cache** : Redis pour rôles + lookups boucher (60 s TTL)
- **DB** : pgbouncer en prod (`?pgbouncer=true&connection_limit=1`)
- **CDN** : Vercel edge global

---

## Tests

| Type | Outil | Localisation |
|---|---|---|
| **Unit** | Vitest 4 | `src/lib/__tests__/*.test.ts` |
| **Component** | Vitest + Testing Library | `src/components/__tests__/*.test.tsx` |
| **E2E** | Playwright | `tests/e2e/` |
| **Coverage** | v8 | `npm run test:coverage` |

**Couvert actuellement** : formatters Kitchen, state machine commande, commission, créneaux, RBAC Clerk, segments marketing, `api/errors`, `auth/test-auth`, `seo/cities`, `estimate`, `utils`.

**Règle** : tout helper pur dans `src/lib/**` mérite un test. Les fonctions DB/HTTP restent en intégration.

---

## Déploiement

### Production
- **Push main** → Vercel auto-build → `prisma migrate deploy` → next build → live
- **Migrations** : créées en local via `npx prisma migrate dev --create-only --name=...`, jamais `migrate dev` en prod
- **Env vars** : configurées via Vercel dashboard (jamais en clair dans le repo)

### Preview
- **PR ouverte** → Vercel preview URL automatique
- CI parallèle (lint + typecheck + test) doit passer avant merge

### Rollback
- Vercel dashboard → Deployments → "Promote to Production" sur un build précédent
- Pour DB : voir `audit/db-runbook.md`

---

## Domaines & SEO

- **Canonical** : `https://klikandgo.app` (sans www)
- **Redirections** : `www → apex` (Vercel-level), `/decouvrir → /` (301), `/boucheries → /` (301)
- **Sitemap** : `https://klikandgo.app/sitemap.xml`
- **robots.txt** : `https://klikandgo.app/robots.txt`
- **llms.txt** : `https://klikandgo.app/llms.txt` (pour IA)
- **Bing site verification** : `https://klikandgo.app/BingSiteAuth.xml`
- **IndexNow key** : `https://klikandgo.app/{key}.txt`

---

## Contact technique

- **Founder & Tech Lead** : Tarik B. (`contact@klikandgo.app`)
- **Issues** : [GitHub Issues](https://github.com/eltarik73/clickboucher/issues)
- **Repo** : https://github.com/eltarik73/clickboucher
