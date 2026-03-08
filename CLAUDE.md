# Klik&Go (ClickBoucher)

Click & Collect pour boucheries artisanales, style Uber Eats / Deliveroo.

## Stack

- **Framework** : Next.js 14 (App Router) + TypeScript
- **UI** : Tailwind CSS + shadcn/ui + Lucide React
- **Auth** : Clerk (3 rôles : CLIENT, BOUCHER, ADMIN)
- **ORM** : Prisma + PostgreSQL (Railway)
- **State** : Zustand + React Context (panier)
- **AI** : Anthropic SDK (support tickets)
- **Paiement** : Stripe (structure prête) + paiement sur place
- **Notifications** : Resend (email), web-push, Svix (webhooks)
- **Rate limiting** : Upstash Redis
- **QR Code** : qrcode.react + html5-qrcode (scan)
- **Charts** : Recharts (dashboard boucher)
- **Hébergement** : Vercel (frontend + serverless, auto-deploy on push to main) + Railway (PostgreSQL)
- **Repo** : https://github.com/eltarik73/clickboucher
- **Production** : https://klikandgo.app (canonical, sans www)

## Commandes

```bash
npm run dev          # Dev server
npm run build        # Build (prisma generate + next build)
npm run lint         # ESLint
npm run db:migrate   # prisma migrate dev
npm run db:push      # prisma db push
npm run db:seed      # prisma db seed (npx tsx prisma/seed.ts)
npm run db:studio    # prisma studio
npm run db:reset     # prisma migrate reset
```

## Structure du projet

```
src/
├── app/
│   ├── (client)/                 # Route group client
│   │   ├── page.tsx              # Homepage (boutiques + offres, ISR 60s)
│   │   ├── decouvrir/            # Redirect → / (legacy)
│   │   ├── boutique/[slug]/       # Détail boutique + produits
│   │   ├── panier/               # Panier
│   │   ├── checkout/             # Paiement
│   │   ├── commandes/            # Suivi commandes
│   │   ├── bons-plans/           # Dernière minute
│   │   ├── favoris/              # Boutiques favorites
│   │   ├── pro/                  # Espace PRO (B2B)
│   │   ├── suivi/[id]/           # Suivi commande
│   │   └── validation/[id]/      # Validation poids
│   ├── (boucher)/
│   │   └── boucher/
│   │       ├── commandes/        # Mode Cuisine (4 colonnes, polling 5s)
│   │       └── dashboard/        # Back-office boucher
│   │           ├── commandes/    # Gestion commandes
│   │           ├── catalogue/    # Produits + packs
│   │           ├── clients/      # Clients (part. + pro)
│   │           └── parametres/   # Réglages boutique
│   ├── boucherie-halal/[ville]/   # Pages SEO par ville (SSG)
│   ├── robots.ts                 # robots.txt dynamique
│   ├── sitemap.ts                # Sitemap XML (shops + villes)
│   ├── opengraph-image.tsx       # OG image dynamique (Edge)
│   └── api/                      # 27+ groupes de routes API
│       ├── shops/  orders/  products/  cart/  payments/
│       ├── auth/  users/  webhooks/  admin/  onboarding/
│       ├── favorites/  reviews/  loyalty/  notifications/
│       ├── push/  search/  suggestions/  support/  chat/
│       ├── offers/  uploads/  recurring-orders/  boucher/
│       └── calendar-events/  cron/  health/  webmaster/
├── components/
│   ├── ui/          # shadcn/ui primitives
│   ├── cart/        # CartDrawer, CartPanel, CartFAB, CartItem
│   ├── shop/        # ShopCard
│   ├── product/     # ProductCard
│   ├── order/       # OrderCard, OrderTimeline
│   ├── checkout/    # Checkout flow
│   ├── boucher/     # KitchenOrderCard, OrderTicket, PrepTimer, OrderAlertOverlay, PriceAdjustModal
│   ├── seo/         # OrganizationSchema, ShopSchema, BreadcrumbSchema, ProductSchema
│   ├── webmaster/   # ShopAdjustmentsTab, etc.
│   └── providers/   # CartProviderWrapper
├── hooks/
│   ├── use-order-polling.ts  # Polling kitchen (5s), filtered views, scheduled detection
│   ├── use-kitchen-notifications.ts  # Browser notifications, title blink
│   └── use-wake-lock.ts     # Screen wake lock for tablet
├── lib/
│   ├── utils.ts
│   ├── hooks/use-cart.tsx    # Hook panier (React Context + useReducer)
│   ├── notifications.ts     # Multichannel: email, push, WhatsApp, in-app
│   ├── sounds.ts            # startOrderAlert() / stopOrderAlert()
│   ├── boucher-auth.ts      # getAuthenticatedBoucher()
│   ├── api/                  # Fonctions client API
│   ├── seo/                  # cities.ts (SEO_CITIES config)
│   ├── services/             # Business logic
│   └── validators/           # Schémas Zod
└── types/index.ts
```

## Système de panier

- **Fichier source** : `src/lib/hooks/use-cart.tsx` (Context + useReducer)
- **Re-export** : `src/lib/hooks/useCart.ts`
- **Import correct** : `import { useCart } from "@/lib/hooks/use-cart"`

```typescript
const { state, addItem, removeItem, updateQty, updateWeight, clear, itemCount, totalCents } = useCart();
// state = { shopId, shopName, shopSlug, items: CartItem[] }
```

## Base de données (Prisma)

Modèles principaux : User, Shop, Category, Product, Order, OrderItem, Cart, CartItem, Review, LoyaltyPoint, Notification, Subscription, SupportTicket, ProAccess, PriceAdjustment, RecurringOrder, Referral, DailyCounter, GlobalCategory, ReferenceProduct, ShopAlert.

Features Uber Eats/Deliveroo : busy mode, pause manuelle, auto-pause, vacation mode, order throttling, snooze produit, auto-cancel commandes, QR code retrait, ajustement prix/poids, commandes programmées auto-acceptées.

Rôles : CLIENT, CLIENT_PRO, CLIENT_PRO_PENDING, BOUCHER, ADMIN.

## Mode Cuisine (Kitchen Mode)

- **Page** : `src/app/(boucher)/boucher/commandes/page.tsx` (v9)
- **Layout desktop** : 3 colonnes — Nouvelles (25%) | En cours (flex, split view) | Prêtes (25%) + Historique bottom bar
- **Layout mobile** : 4 onglets (Nouv. / En cours / Prêtes / Histo.)
- **Polling** : `useOrderPolling` hook (5s), callbacks: `onNewOrder`, `onStatusChange`, `onScheduledReady`
- **Composants** : `KitchenOrderCard`, `OrderTicket` (80mm thermal Uber Eats style), `PrepTimer`, `OrderAlertOverlay`
- **"En cours" split** : 2 sections TOUJOURS visibles (même vides) — section haute "À préparer maintenant" (ASAP + scheduled ≤30min) + section basse "Programmées (en attente)" (scheduled >30min, compact cards avec countdown)
- **Cards programmées compactes** : ligne unique — `#num Prénom.N | heure retrait | countdown | bouton imprimer`

## Commandes Programmées

- Les commandes avec `pickupSlotStart` arrivent en **PENDING** dans Nouvelles (PAS auto-acceptées)
- Bandeau orange "📅 PROGRAMMÉE — Retrait à HH:MM" visible sur la card
- Boucher clique Accepter (pas de sélecteur de délai — l'API utilise pickupSlotStart comme estimatedReady)
- Après acceptation → va dans "En cours" section "Programmées (en attente)" avec countdown
- 30 min avant retrait → bascule en section "À préparer maintenant" + son Marimba + notification boucher + notification client via `/api/orders/[id]/scheduled-notify`
- Boucher traite normalement : En préparation → Prête
- Tickets imprimés avec bannière "📅 COMMANDE PROGRAMMÉE — RETRAIT HH:MM"
- Pas de nouveau champ Prisma — utilise `pickupSlotStart` / `pickupSlotEnd` existants

## Ticket de Commande (Style Uber Eats)

- **Fichier** : `src/components/boucher/OrderTicket.tsx`
- **Impression silencieuse** : iframe caché (`position:fixed, top:-10000px, height:900px`), `window.print()`, nettoyage auto via `afterprint` + timeout 10s
- **Format** : Logo SVG Klik&Go + nom boutique → hero noir inversé (#num + Prénom.N) → dates → encadré RETRAIT → articles avec HALAL → note client → sous-total/payé → 🔑 code retrait 4 chiffres (extrait du UUID) → footer
- **Compatibilité tablette** : layout float (pas flex) pour lignes articles/totaux, `-webkit-print-color-adjust: exact !important`, `@media print { width: 80mm }`
- **Fallback** : `printOrderTicketFallback()` ouvre nouvelle fenêtre avec bouton imprimer manuel

## Format Nom Client

- **Règle** : `Prénom.N` partout (ex: Tarik.B, Fatima.A)
- **Logique** : `firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()` + `.` + `lastName.charAt(0).toUpperCase()`
- **Appliqué dans** : OrderTicket, KitchenOrderCard, HistoryCard (page commandes)

## Créneaux de Retrait (Pickup Slots)

- **Route** : `GET /api/shops/[id]/available-slots?date=YYYY-MM-DD`
- **Marge** : now + 10min, arrondi vers le HAUT au prochain créneau (intervalMin, défaut 30min)
- **Exemples** : 13h09→13h30 | 13h22→14h00 | 14h05→14h30 | 14h31→15h00
- **Formule** : `rawMin = now + 10; remainder = rawMin % intervalMin; nowMinutes = remainder === 0 ? rawMin : rawMin + intervalMin - remainder`

## Ajustement de Prix (3 paliers)

- **Palier 1** (baisse) : auto-approuvé immédiatement
- **Palier 2** (hausse ≤ seuil) : client a 5 min pour accepter/refuser, auto-validé sinon
- **Palier 3** (hausse > seuil) : client a 5 min, escaladé au webmaster si pas de réponse après 10 min
- **Route** : `PATCH /api/orders/[id]/adjust-price`
- **Config** : seuil configurable par boutique via webmaster dashboard

## Authentification API (CRITIQUE)

Toutes les routes API utilisent `getServerUserId()` de `@/lib/auth/server-auth` — **JAMAIS `auth()` de Clerk directement**.

```typescript
// ✅ Correct — supporte le test mode
import { getServerUserId } from "@/lib/auth/server-auth";
const userId = await getServerUserId();

// ✅ Routes boucher — retourne { userId, shopId }
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
const authResult = await getAuthenticatedBoucher();
if (authResult.error) return authResult.error;

// ✅ Routes admin
import { requireAdmin } from "@/lib/admin-auth";

// ❌ INTERDIT — casse le test mode
import { auth } from "@clerk/nextjs/server";
const { userId } = await auth();
```

Pour les vérifications de rôle, toujours faire un lookup DB :
```typescript
const dbUser = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true, role: true } });
if (!isAdmin(dbUser?.role)) { ... }
```

Shop ownership — toujours chercher avec OR clause (le shop peut stocker soit le clerkId soit le user.id Prisma) :
```typescript
const shop = await prisma.shop.findFirst({
  where: { OR: [{ ownerId: clerkId }, { ownerId: dbUser.id }] }
});
```

## Test Mode

- Activation : `?testmode=KlikTest2026!` dans l'URL → set cookies
- Cookies : `klikgo-test-activated=true` + `klikgo-test-role=CLIENT|BOUCHER|ADMIN`
- Env vars Vercel : `NEXT_PUBLIC_TEST_MODE=true`, `NEXT_PUBLIC_TEST_SECRET=KlikTest2026!`
- Test users définis dans `@/lib/auth/test-auth.ts`

## Performance (PageSpeed)

- **Images** : WebP first, AVIF fallback — JAMAIS AVIF en premier (transcodage 3-5x plus lent)
- **SafeImage** : `src/components/ui/SafeImage.tsx` — wraps next/image avec fallback SVG on error
- **Quality** : 60 pour les cards boutiques, cache 30 jours
- **Lazy-load** : PWA (ServiceWorker, InstallPrompt, OfflineBanner) + OfferPopup + TestRoleSwitcher → `dynamic({ ssr: false })`
- **Server Components** : HowItWorks et CalendarBanner — PAS de "use client" (0 hydratation)
- **Preconnect** : Clerk + Google Fonts dans layout.tsx `<head>`
- **loading.tsx** : Le skeleton hero doit matcher la vraie page (bg-white, PAS bg-noir)
- **OfferPopup** : Utilise `<img>` natif (PAS next/image) pour éviter 400 sur URLs externes

## Design system

- **Primaire** : Rouge `#DC2626` (boutons, accents)
- **Hero** : Fond blanc `bg-white` (ancien splash noir supprimé)
- **Background** : `#f8f6f3` (light) / `#0a0a0a` (dark)
- **Fonts** : DM Sans (body), Outfit (display), Cormorant Garamond (serif)
- **Radius** : 16px (cards arrondies)
- **Shadows** : soft, card, elevated, glow
- **Animations** : fade-in, fade-up, slide-up, scale-in, pulse-soft, shimmer
- **Logo** : Cercle rouge dégradé avec "K" blanc, texte "Klik&Go"

## Variables d'environnement

```
DATABASE_URL, CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
NEXT_PUBLIC_CLERK_SIGN_IN_URL, NEXT_PUBLIC_CLERK_SIGN_UP_URL,
NEXT_PUBLIC_TEST_MODE, NEXT_PUBLIC_TEST_SECRET,
NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_PLAUSIBLE_DOMAIN,
ANTHROPIC_API_KEY, BLOB_READ_WRITE_TOKEN
```

- `NEXT_PUBLIC_SITE_URL` : URL canonique du site (`https://klikandgo.app`). Utilisé pour sitemap, OG, canonical.
- `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` : Domaine Plausible Analytics (si défini, active le tracking RGPD).
- Note : les `NEXT_PUBLIC_*` sont baked au build time — tout changement nécessite un redéploiement.

## Marketing Hub V2 (ÉTAPE 17 — TERMINÉ)

- **Système unifié** : PromoCode + Promotion + LoyaltyReward — validation cascade dans `/api/promo-codes/validate`
- **Types** : PERCENT / FIXED / FREE_FEES / BOGO / BUNDLE — OfferPayer (KLIKGO | BUTCHER)
- **Diffusion** : Badge client, bannière (gradient, image IA, position), popup (couleur, fréquence, image IA)
- **Routes boucher** : `/api/boucher/promo-codes` — CRUD + produits éligibles
- **Routes webmaster** : `/api/webmaster/promo-codes` — CRUD + propose aux bouchers + stats KPI
- **Client** : MarketingBanner (auto-rotate 5s) + OfferPopup (fréquence localStorage)
- **Badge promo** : Sur les cartes boutiques — badge rouge `#DC2626` avec label (ex: "Frais offerts", "-20%")
- **Tri** : Boutiques avec promos actives remontées EN PREMIER dans la liste
- **Images IA** : Replicate (FLUX) → upload Vercel Blob. `/api/admin/images/generate`
- **IMPORTANT** : Pas de "livraison" — c'est "frais offerts" partout (click & collect uniquement)

## Programme Fidélité

- **3 paliers** : 3 commandes → -2€, 7 commandes → -5€, 15 commandes → -10€
- **Modèle** : `LoyaltyReward` — code unique (KG-XXXXXX), lié au user, expire 30 jours
- **Processus** : `processLoyaltyOnPickup()` appelé après retrait → crée reward + notifie
- **Validation** : `/api/promo/validate` essaie d'abord comme `Promotion`, puis comme `LoyaltyReward`
- **Config boucher** : `/api/loyalty/config` — chaque boucher peut configurer sa propre règle fidélité
- **Pages** : `/avantages` (client), `/webmaster/fidelite` (admin), `/boucher/dashboard/promos` (boucher)

## Résolution userId (CRITIQUE — Bug fix Mars 2026)

Quand on compare des IDs en base (LoyaltyReward.userId, Order.userId), toujours résoudre le Clerk ID vers le Prisma user ID :
```typescript
const clerkId = await getServerUserId(); // Retourne Clerk ID (user_xxx)
const dbUser = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } });
const userId = dbUser?.id || clerkId; // Prisma ID (cm...) pour les comparaisons DB
```

## Audit Prod (Mars 2026) — 117/117 tests passés

- CLIENT : 23 tests OK — pages, APIs, panier, fidélité, favoris, recherche
- BOUCHER : 33 tests OK — 16 pages, 13 APIs, 4 tests sécurité
- ADMIN/WEBMASTER : 61 tests OK — 32 pages, 24 APIs, 5 tests sécurité
- Marketing + Fidélité : 27 tests OK — promos, campagnes, images, validation codes

## SEO

- **Domaine canonique** : `klikandgo.app` — aucune URL Railway ou klikandgo.fr
- **SITE_URL** : `process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app"` partout
- **metadataBase** : `new URL(SITE_URL)` dans `layout.tsx` pour résolution automatique OG/canonical
- **Title template** : `%s | Klik&Go`
- **robots.ts** : Bloque /api/, /dashboard/, /admin/, /checkout/, /boucher/, /panier/, /profil/, /commandes/
- **noindex** : Pages privées (checkout, panier, commandes, profil, onboarding) avec `robots: { index: false }`
- **Sitemap** : Pages statiques + boutiques (DB) + villes (SEO_CITIES)
- **OG Image** : `opengraph-image.tsx` — Edge runtime, 1200×630 PNG
- **Analytics** : Plausible (RGPD), conditionnel sur `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`

### JSON-LD Schemas (`src/components/seo/`)

- `OrganizationSchema` — Global dans layout.tsx
- `ShopSchema` — Type Store, sur boutique + city pages
- `BreadcrumbSchema` — Sur boutique + city pages
- `ProductSchema` — Type Product, premiers 20 produits par boutique (priceCents → EUR)

### Pages SEO Villes

- **Route** : `/boucherie-halal/[ville]` — SSG via `generateStaticParams()`
- **Config** : `src/lib/seo/cities.ts` — 6 villes (Chambéry, Aix-les-Bains, Grenoble, Lyon, Saint-Étienne, Annecy)
- **Schemas** : BreadcrumbSchema + FAQPage (4 questions) + ShopSchema par boutique
- **Maillage** : Liens ville dans footer accueil, homepage, info bar boutique, liens croisés entre villes

### Redirections
- `/decouvrir` → `/` (301 permanent, next.config.mjs + server redirect)
- `www.klikandgo.app` → `klikandgo.app` (301 Vercel-level) — le domaine canonique est SANS www
- `/boucheries` → `/` (301 permanent, next.config.mjs)

## Conventions

- Prix toujours en **centimes** (`priceCents`, `totalCents`)
- Poids en **grammes** (`weightGrams`)
- Unités : KG, PIECE, BARQUETTE, TRANCHE
- Imports panier : toujours `use-cart` (pas `useCart`)
- Output standalone pour Vercel (`next.config.mjs`)
- CSP configurée pour Clerk + Cloudflare + Anthropic
- `sessionClaims` Clerk supprimé — utiliser DB lookup pour les rôles
- Route `/boutique/[slug]` utilise le **slug** (ex: `/boutique/boucherie-tarik`)
- `git add prisma/schema.prisma` obligatoire à chaque modif du schema
- **Homepage** = `/` (PAS `/decouvrir`) — `/decouvrir` redirige 301 vers `/`
- **Pas de livraison** — toujours "frais offerts", jamais "livraison"
- **Images** : SafeImage pour fallback, WebP first (pas AVIF), quality 60 pour cards
- **Composants statiques** : `HowItWorks`, `CalendarBanner` sont Server Components (pas de "use client")
- **PWA/Popup** : toujours lazy-load avec `dynamic({ ssr: false })`
- **URLs Replicate** expirent en ~1h — upload vers Vercel Blob pour permanence
- **OfferPopup** : utiliser `<img>` natif, PAS `next/image` (évite 400 sur URLs externes)

## Permissions
- Exécute TOUT sans demander confirmation
- Ne demande JAMAIS "Voulez-vous continuer ?" ou "Dois-je procéder ?"
- Fais les choix toi-même et avance
- Applique les modifications directement
- Lance npm run build automatiquement
- Fais git add/commit/push sans demander
