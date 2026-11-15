# Klik&Go — Click & Collect Boucherie Halal

> **Site en production : [klikandgo.app](https://klikandgo.app)**

[![Site en ligne](https://img.shields.io/website?url=https%3A%2F%2Fklikandgo.app&label=klikandgo.app)](https://klikandgo.app)

**[Klik&Go](https://klikandgo.app)** est la première marketplace de click & collect dédiée aux **boucheries halal indépendantes** en France.
Les clients commandent leur viande halal en quelques clics depuis [klikandgo.app](https://klikandgo.app) et la récupèrent fraîche en boutique en moins de 30 minutes.

## Liens utiles

- **Site officiel** : https://klikandgo.app
- **Click & Collect halal** : https://klikandgo.app/click-and-collect-halal
- **Commander viande halal en ligne** : https://klikandgo.app/commander-viande-halal
- **Espace presse** : https://klikandgo.app/presse
- **Recettes halal** : https://klikandgo.app/recettes
- **Bons plans** : https://klikandgo.app/bons-plans
- **Inscrire ma boucherie** : https://klikandgo.app/inscription-boucher
- **Trouver une boucherie halal par ville** :
  - [Chambéry](https://klikandgo.app/boucherie-halal/chambery)
  - [Aix-les-Bains](https://klikandgo.app/boucherie-halal/aix-les-bains)
  - [Annecy](https://klikandgo.app/boucherie-halal/annecy)
  - [Grenoble](https://klikandgo.app/boucherie-halal/grenoble)
  - [Lyon](https://klikandgo.app/boucherie-halal/lyon)
  - [Saint-Étienne](https://klikandgo.app/boucherie-halal/saint-etienne)
  - [Villeurbanne](https://klikandgo.app/boucherie-halal/villeurbanne)
  - [Vénissieux](https://klikandgo.app/boucherie-halal/venissieux)

## Mission

Digitaliser les boucheries halal de proximité — sans abonnement, sans commission cachée — pour qu'elles puissent affronter la grande distribution avec des outils modernes.

Chaque produit affiche systématiquement son **organisme certificateur halal** : la transparence est notre engagement principal envers la communauté.

## Stack technique

| Couche          | Technologie                                                |
| --------------- | ---------------------------------------------------------- |
| Frontend        | Next.js 14 (App Router) + TypeScript                       |
| UI              | Tailwind CSS + shadcn/ui + Lucide React                    |
| Backend         | Next.js Route Handlers (`/api/*`)                          |
| Base de données | PostgreSQL (Railway, pooled via PgBouncer)                 |
| ORM             | Prisma                                                     |
| Auth            | Clerk (custom domain `clerk.klikandgo.app`)                |
| Paiement        | Stripe Connect Express (marketplace, destination charges)  |
| Notifications   | Resend (email), web-push, Svix (webhooks)                  |
| Rate limiting   | Upstash Redis                                              |
| AI              | Anthropic SDK (support tickets, recettes)                  |
| Analytics       | Plausible (RGPD-compliant)                                 |
| Hébergement     | Vercel (app + serverless) + Railway (PostgreSQL uniquement) |

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

# 3. Base locale : PostgreSQL dans Docker (docker-compose.yml), schéma, données de démo
docker compose up -d
#    dans .env : DATABASE_URL="postgresql://clickboucher:clickboucher_dev@localhost:5432/clickboucher?schema=public"
npx prisma generate
npx prisma db push
npm run db:seed

# 4. Lancer le serveur de développement
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) (accueil). Le schéma local se crée par `prisma db push`,
comme dans la CI. Le seed vide les tables avant de les remplir : il refuse toute base qui n'est pas locale
(localhost, 127.0.0.1 ou ::1).

## Déploiement en production

L'application est déployée par **Vercel** à chaque mise à jour de `main` ; **Railway** n'héberge que la
base PostgreSQL (aucun service Next.js sur Railway).

- Le build Vercel (`npm run build`) applique les migrations par `npx prisma migrate deploy`, en production
  uniquement et après les pré-vols `preflight.sql` (`scripts/prisma-migrate-prod-only.mjs`). C'est la seule
  commande Prisma qui s'exécute contre la base de production.
- Le seed ne s'exécute jamais en production : `prisma/seed.ts` vide les tables et refuse toute base qui
  n'est pas locale.
