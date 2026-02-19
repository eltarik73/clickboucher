---
name: prisma-expert
description: Expert Prisma ORM pour Klik&Go. Utiliser pour les schémas, migrations, requêtes, relations, et problèmes de performance avec PostgreSQL. Gère le multi-tenant (shopId scoping), les relations complexes, et l'optimisation des requêtes.
---

# Prisma Expert — Klik&Go

## Règles absolues
1. SINGLETON PrismaClient (src/lib/prisma.ts) — JAMAIS new PrismaClient() ailleurs
2. TOUTE requête scopée par shopId (multi-tenant sécurité)
3. JAMAIS de requête N+1 → utiliser include/select
4. Pagination obligatoire : take + skip sur les listes
5. Index sur colonnes filtrées/triées

## Commandes

### Dev (local)
```bash
npx prisma migrate dev --name description
npx prisma generate
npx prisma studio
npx prisma db push  # rapide, pas de migration file
```

### Prod (Railway)
```bash
npx prisma migrate deploy  # JAMAIS migrate dev en prod
npx prisma generate
```

## Gestion d'erreurs Prisma
```typescript
import { Prisma } from '@prisma/client'

try {
  // requête
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': return NextResponse.json({ error: 'Existe déjà' }, { status: 409 })
      case 'P2025': return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
      case 'P2003': return NextResponse.json({ error: 'Référence invalide' }, { status: 400 })
      default: return NextResponse.json({ error: 'Erreur DB' }, { status: 500 })
    }
  }
  throw error
}
```

## Patterns requêtes optimisées

### Liste avec pagination
```typescript
const [items, total] = await Promise.all([
  prisma.product.findMany({
    where: { shopId },
    take: 20,
    skip: (page - 1) * 20,
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, priceCents: true, imageUrl: true, inStock: true }
  }),
  prisma.product.count({ where: { shopId } })
])
```

### Commande avec relations (PAS de N+1)
```typescript
const order = await prisma.order.findUnique({
  where: { id },
  include: {
    items: { include: { product: true } },
    user: { select: { firstName: true, lastName: true, phone: true } },
    shop: { select: { name: true, address: true, city: true } }
  }
})
```

### Stats agrégées
```typescript
const stats = await prisma.order.aggregate({
  where: { shopId, createdAt: { gte: startOfDay } },
  _count: true,
  _sum: { totalCents: true }
})
```

## Schema Klik&Go — Relations principales
```
Shop (boucherie)
  ├── products[] (catalogue)
  ├── orders[] (commandes)
  ├── owner (User boucher)
  └── proAccesses[] (accès pro)

Order (commande)
  ├── items[] (OrderItem → Product)
  ├── user (client)
  ├── shop (boucherie)
  └── notifications[]

User (utilisateur)
  ├── orders[] (ses commandes)
  ├── proAccesses[] (statuts pro par shop)
  └── role (CLIENT | BOUCHER | WEBMASTER)
```

## Ne JAMAIS
- Inventer une table qui n'existe pas dans schema.prisma
- Faire un findMany sans where shopId
- Oublier le select/include (over-fetching)
- Utiliser raw SQL sauf cas extrême
