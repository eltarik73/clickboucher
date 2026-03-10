# CLAUDE.md — Klik&Go

## Projet

Klik&Go est une plateforme SaaS click-and-collect pour boucheries halal. Stack : Next.js 14, TypeScript, Tailwind CSS, Prisma, PostgreSQL, Clerk, Stripe. Déployé sur Vercel (klikandgo.app).

## Règles non négociables

### Sécurité multi-tenant
- TOUTE requête Prisma sur des données métier DOIT être scopée par `shopId`
- TOUTE route API (sauf publiques) DOIT vérifier l'authentification Clerk
- TOUTE mutation DOIT valider les inputs avec Zod côté serveur
- JAMAIS exposer de secrets avec `NEXT_PUBLIC_` (sauf publishable keys)

### Performance
- JAMAIS de requête N+1 : utiliser `include`/`select` Prisma
- Pagination obligatoire sur les listes pouvant dépasser 50 items
- Singleton Prisma depuis `src/lib/prisma.ts` uniquement
- Index sur colonnes filtrées et triées

### Next.js App Router
- `"use client"` obligatoire sur composants avec hooks/browser APIs
- Route handlers dans `app/api/**/route.ts` avec try/catch
- Pas de `Date.now()`/`Math.random()` dans le rendu initial
- Error boundaries `error.tsx` dans chaque layout

### Stripe
- Prix TOUJOURS recalculé côté serveur avant Checkout Session
- Signature webhook TOUJOURS vérifiée avec `constructEvent()`
- `STRIPE_SECRET_KEY` JAMAIS côté client
- Idempotency key sur chaque Payment Intent

### UX & Design
- Mobile-first : styles de base pour 375px, breakpoints `md:`/`lg:` pour tablette/desktop
- Touch targets ≥ 44px
- Dark mode supporté sur tous les composants
- Font : Outfit. Couleur primaire : `#DC2626`
- Icônes : Lucide React uniquement
- Images produits : `aspect-[4/3] object-cover object-center`

### Code quality
- Pas de `any` TypeScript sans justification en commentaire
- Pas de `console.log` en production
- Pas de code commenté
- Fichiers < 300 lignes (sauf exceptions justifiées)
- Try/catch dans chaque route handler avec logging structuré

## Conventions de nommage

- Routes API : `app/api/[resource]/route.ts`
- Composants : PascalCase (`ProductCard.tsx`)
- Utilitaires : camelCase (`getProductImage.ts`)
- Variables d'environnement : SCREAMING_SNAKE_CASE

## Build & Deploy

- `npm run build` doit passer sans erreur avant tout push
- Déploiement automatique via Vercel sur `git push main`
- Migrations prod : `npx prisma migrate deploy` (JAMAIS `migrate dev`)
