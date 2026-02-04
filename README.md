# 🥩 ClickBoucher — Click & Collect Boucherie

MVP premium de Click & Collect pour boucheries artisanales, inspiré d'Uber.

## Stack technique

| Couche        | Technologie                          |
| ------------- | ------------------------------------ |
| Frontend      | Next.js 14 (App Router) + TypeScript |
| UI            | Tailwind CSS + shadcn/ui (custom)    |
| Backend       | Next.js Route Handlers (`/api/*`)    |
| Base de données | PostgreSQL (Railway)               |
| ORM           | Prisma                               |
| Paiement      | Mock (structure prête)               |
| Notifications | Stubs (WhatsApp/SMS/Push)            |
| Hébergement   | Vercel (front+back) + Railway (DB)   |

## Structure du projet

```
clickboucher/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (fonts + theme)
│   │   ├── page.tsx                # Redirect → /decouvrir
│   │   ├── (client)/               # Client route group
│   │   │   ├── layout.tsx          # Client layout + BottomNav
│   │   │   ├── decouvrir/          # 🏠 Accueil (shops + offers)
│   │   │   ├── bons-plans/         # 🔥 Dernière minute global
│   │   │   ├── favoris/            # ❤️ Boutiques favorites
│   │   │   ├── commandes/          # 📋 Suivi commandes
│   │   │   ├── pro/                # 💼 Espace PRO (B2B)
│   │   │   ├── boutique/[id]/      # 🏪 Détail boutique
│   │   │   ├── panier/             # 🛒 Panier
│   │   │   ├── checkout/           # 💳 Checkout (OTP + paiement)
│   │   │   ├── suivi/[id]/         # 📍 Suivi commande
│   │   │   └── validation/[id]/    # ⚖️ Validation poids
│   │   ├── (boucher)/              # Boucher route group
│   │   │   └── dashboard/          # Back-office boucher
│   │   │       ├── layout.tsx      # Sticky header + nav
│   │   │       ├── commandes/      # Gestion commandes
│   │   │       ├── catalogue/      # Produits + packs + DM
│   │   │       ├── clients/        # Clients (part. + pro)
│   │   │       └── parametres/     # Réglages boutique
│   │   └── api/                    # Route Handlers
│   ├── components/
│   │   ├── ui/                     # shadcn/ui primitives
│   │   ├── layout/                 # Layout components
│   │   ├── shop/                   # ShopCard, etc.
│   │   ├── order/                  # OrderCard, OrderTimeline
│   │   ├── product/                # ProductCard, etc.
│   │   ├── offer/                  # OfferCard, etc.
│   │   ├── pro/                    # Pro-specific components
│   │   ├── checkout/               # Checkout flow components
│   │   └── boucher/                # Boucher-specific components
│   ├── lib/
│   │   ├── utils.ts                # Utility functions + constants
│   │   ├── api/                    # API client functions
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── services/               # Business logic services
│   │   └── validators/             # Zod schemas
│   ├── styles/
│   │   └── globals.css             # Theme + utilities
│   └── types/
│       └── index.ts                # TypeScript definitions
├── prisma/
│   ├── schema.prisma               # (Bloc 2)
│   └── seed.ts                     # (Bloc 2)
├── public/
│   └── images/                     # Static assets
├── tailwind.config.ts
├── next.config.mjs
├── tsconfig.json
├── package.json
├── .env.example
└── .gitignore
```

## Thème Design

- **Primaire** : Burgundy `#7A1023` (hsl 350 77% 27%)
- **Accent** : Orange chaleureux
- **Fonts** : DM Sans (body) + Plus Jakarta Sans (display)
- **Radius** : 16px (cartes arrondies 2xl)
- **Ombres** : Soft shadows, effet glass morphism
- **Animations** : fade-in, fade-up, scale-in, shimmer loading

## Blocs de livraison

- [x] **Bloc 1** : Structure + dépendances + thème + layout + navigation
- [x] **Bloc 2** : Prisma schema + migrations + seed
- [x] **Bloc 3** : API routes + Zod + erreurs
- [x] **Bloc 4** : UI Client complète
- [x] **Bloc 5** : UI Boucher complète
- [x] **Bloc 6** : Stubs notifications + paiement + health
- [x] **Bloc 7** : Guide déploiement

## Démarrage rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Copier et remplir les variables d'environnement
cp .env.example .env

# 3. Lancer Prisma (Bloc 2+)
npx prisma generate
npx prisma migrate dev
npx prisma db seed

# 4. Lancer le serveur de développement
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) — redirige vers `/decouvrir`.

## Déploiement Railway + Vercel

```bash
# 1. Railway — créer le projet PostgreSQL
# → Copier la DATABASE_URL fournie par Railway

# 2. Vercel — connecter le repo Git
# → Ajouter la variable DATABASE_URL dans Settings > Environment Variables
# → Le postinstall script lance automatiquement "prisma generate"

# 3. Première migration en production
npx prisma migrate deploy
npx prisma db seed
```
