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
- **Hébergement** : Vercel (frontend + serverless) + Railway (PostgreSQL)
- **Repo** : https://github.com/eltarik73/clickboucher
- **Production** : https://www.klikandgo.app

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
│   ├── page.tsx                  # Redirect → /decouvrir
│   ├── (client)/                 # Route group client
│   │   ├── decouvrir/            # Accueil (boutiques + offres)
│   │   ├── boutique/[id]/        # Détail boutique + produits
│   │   ├── panier/               # Panier
│   │   ├── checkout/             # Paiement
│   │   ├── commandes/            # Suivi commandes
│   │   ├── bons-plans/           # Dernière minute
│   │   ├── favoris/              # Boutiques favorites
│   │   ├── pro/                  # Espace PRO (B2B)
│   │   ├── suivi/[id]/           # Suivi commande
│   │   └── validation/[id]/      # Validation poids
│   ├── (boucher)/
│   │   └── dashboard/            # Back-office boucher
│   │       ├── commandes/        # Gestion commandes
│   │       ├── catalogue/        # Produits + packs
│   │       ├── clients/          # Clients (part. + pro)
│   │       └── parametres/       # Réglages boutique
│   └── api/                      # 26 groupes de routes API
│       ├── shops/  orders/  products/  cart/  payments/
│       ├── auth/  users/  webhooks/  admin/  onboarding/
│       ├── favorites/  reviews/  loyalty/  notifications/
│       ├── push/  search/  suggestions/  support/  chat/
│       ├── offers/  uploads/  recurring-orders/
│       └── calendar-events/  cron/  health/
├── components/
│   ├── ui/          # shadcn/ui primitives
│   ├── cart/        # CartDrawer, CartPanel, CartFAB, CartItem
│   ├── shop/        # ShopCard
│   ├── product/     # ProductCard
│   ├── order/       # OrderCard, OrderTimeline
│   ├── checkout/    # Checkout flow
│   ├── boucher/     # Composants dashboard boucher
│   └── providers/   # CartProviderWrapper
├── lib/
│   ├── utils.ts
│   ├── hooks/use-cart.tsx    # Hook panier (React Context + useReducer)
│   ├── api/                  # Fonctions client API
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

Features Uber Eats/Deliveroo : busy mode, pause manuelle, auto-pause, vacation mode, order throttling, snooze produit, auto-cancel commandes, QR code retrait, ajustement prix/poids.

Rôles : CLIENT, CLIENT_PRO, CLIENT_PRO_PENDING, BOUCHER, ADMIN.

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

## Design system

- **Primaire** : Rouge `#DC2626` (boutons, accents)
- **Hero** : Fond noir `#0A0A0A`
- **Background** : `#FAFAFA`
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
NEXT_PUBLIC_APP_URL, ANTHROPIC_API_KEY, BLOB_READ_WRITE_TOKEN
```

Note : les `NEXT_PUBLIC_*` sont baked au build time — tout changement nécessite un redéploiement.

## Conventions

- Prix toujours en **centimes** (`priceCents`, `totalCents`)
- Poids en **grammes** (`weightGrams`)
- Unités : KG, PIECE, BARQUETTE, TRANCHE
- Imports panier : toujours `use-cart` (pas `useCart`)
- Output standalone pour Vercel (`next.config.mjs`)
- CSP configurée pour Clerk + Cloudflare + Anthropic
- `sessionClaims` Clerk supprimé — utiliser DB lookup pour les rôles
- Route `/boutique/[id]` utilise le **slug** pas l'ID (ex: `/boutique/boucherie-tarik`)
- `git add prisma/schema.prisma` obligatoire à chaque modif du schema
