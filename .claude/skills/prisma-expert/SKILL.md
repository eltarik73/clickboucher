---
name: prisma-expert
user_invocable: true
description: Expert Prisma ORM pour Klik&Go. Schemas, migrations, requetes, relations, transactions, performance, et patterns avances avec PostgreSQL. Sources — prisma/prisma (39k stars), planetscale/docs best practices, prisma-examples.
---

# Prisma Expert — Klik&Go

> Sources : prisma/prisma, planetscale best practices, prisma-examples, prisma discussions

## Regles absolues

1. SINGLETON PrismaClient (src/lib/prisma.ts) — JAMAIS new PrismaClient() ailleurs
2. TOUTE requete scopee par shopId (multi-tenant securite)
3. JAMAIS de requete N+1 → utiliser include/select
4. Pagination obligatoire : take + skip sur les listes
5. Index sur colonnes filtrees/triees (@@index)
6. select > include quand on n'a pas besoin de TOUTES les relations

## Commandes

### Dev (local)
```bash
npx prisma migrate dev --name description  # Migration avec fichier
npx prisma generate                        # Regenerer le client
npx prisma studio                          # GUI web
npx prisma db push                         # Push direct (pas de migration file)
npx prisma db pull                         # Introspect DB existante
npx prisma format                          # Formater schema.prisma
```

### Prod (Railway)
```bash
npx prisma migrate deploy  # JAMAIS migrate dev en prod
npx prisma generate
# Klik&Go utilise db push car migrate dev echoue en non-interactif
```

## Schema Patterns

### Types de champs
```prisma
model Product {
  id          String   @id @default(uuid())          // UUID auto
  name        String                                  // Requis
  description String?                                 // Optionnel (nullable)
  priceCents  Int                                     // Entier
  weight      Float?                                  // Decimal optionnel
  inStock     Boolean  @default(true)                 // Boolean avec default
  unit        Unit     @default(PIECE)                // Enum avec default
  tags        String[]                                // Array PostgreSQL
  metadata    Json?                                   // JSON libre
  createdAt   DateTime @default(now())                // Auto timestamp
  updatedAt   DateTime @updatedAt                     // Auto update timestamp
  shopId      String   @map("shop_id")                // Mapping colonne DB

  shop        Shop     @relation(fields: [shopId], references: [id])

  @@index([shopId])                                   // Index simple
  @@index([shopId, inStock])                          // Index compose
  @@unique([shopId, name])                            // Unique compose
  @@map("products")                                   // Mapping table DB
}
```

### Relations
```prisma
// One-to-Many : Shop → Products
model Shop {
  id       String    @id @default(uuid())
  products Product[]    // Cote "many" — pas de @relation
}
model Product {
  shopId String
  shop   Shop @relation(fields: [shopId], references: [id])
  @@index([shopId])  // TOUJOURS indexer les foreign keys
}

// One-to-One : Shop → Settings (optionnel)
model Shop {
  settings ShopSettings?
}
model ShopSettings {
  shopId String @unique  // @unique pour one-to-one
  shop   Shop   @relation(fields: [shopId], references: [id])
}

// Many-to-Many : implicite (Prisma cree la table de jointure)
model User {
  favorites Shop[] // @relation("UserFavorites")
}
model Shop {
  favoritedBy User[] // @relation("UserFavorites")
}
```

## CRUD Operations

### Create
```typescript
// Simple
const product = await prisma.product.create({
  data: { name: "Entrecote", priceCents: 2500, shopId },
});

// Avec relation nested (cree le produit ET les tags en une requete)
const order = await prisma.order.create({
  data: {
    userId: user.id,
    shopId: shop.id,
    totalCents,
    items: { create: orderItems }, // Nested create
  },
  include: { items: true, shop: true }, // Retourner les relations
});

// Bulk create
const count = await prisma.product.createMany({
  data: products,
  skipDuplicates: true, // Ignore les doublons (unique constraints)
});
```

### Read
```typescript
// FindUnique — par champ @unique ou @id
const order = await prisma.order.findUnique({
  where: { id: orderId },
  include: { items: { include: { product: true } } },
});

// FindFirst — premier match
const latestOrder = await prisma.order.findFirst({
  where: { shopId, status: "PENDING" },
  orderBy: { createdAt: "desc" },
});

// FindMany — liste avec filtres
const orders = await prisma.order.findMany({
  where: {
    shopId,
    status: { in: ["PENDING", "ACCEPTED"] },      // IN
    createdAt: { gte: startOfDay },                // Greater than or equal
    totalCents: { gt: 1000 },                      // Greater than
    customerNote: { not: null },                   // NOT null
    user: { firstName: { contains: "Ali", mode: "insensitive" } }, // ILIKE
  },
  select: { id: true, orderNumber: true, status: true, totalCents: true },
  orderBy: { createdAt: "desc" },
  take: 20,                                        // LIMIT
  skip: 0,                                         // OFFSET
  distinct: ["userId"],                            // DISTINCT
});

// Count
const count = await prisma.order.count({ where: { shopId, status: "PENDING" } });
```

### Update
```typescript
// Simple
const updated = await prisma.order.update({
  where: { id: orderId },
  data: { status: "ACCEPTED", estimatedReady: new Date() },
});

// Incrementer un champ
await prisma.dailyCounter.update({
  where: { id: counterId },
  data: { lastNumber: { increment: 1 } },  // Atomique !
});

// UpdateMany (pas de retour des records)
await prisma.product.updateMany({
  where: { shopId, categoryId },
  data: { inStock: false },
});

// Upsert — create si n'existe pas, update sinon
const counter = await prisma.dailyCounter.upsert({
  where: { shopId_date: { shopId, date: today } }, // Compound unique
  update: { lastNumber: { increment: 1 } },
  create: { shopId, date: today, lastNumber: 1 },
});
```

### Delete
```typescript
// Simple
await prisma.product.delete({ where: { id: productId } });

// Bulk delete
await prisma.notification.deleteMany({
  where: { createdAt: { lt: thirtyDaysAgo } },
});
```

### Relations (connect/disconnect)
```typescript
// Connecter un record existant
await prisma.order.update({
  where: { id: orderId },
  data: { user: { connect: { id: userId } } },
});

// Deconnecter
await prisma.user.update({
  where: { id: userId },
  data: { favorites: { disconnect: { id: shopId } } },
});
```

## Transactions

```typescript
// Transaction interactive (recommande)
const result = await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ data: orderData });
  await tx.product.updateMany({
    where: { id: { in: productIds } },
    data: { stockCount: { decrement: 1 } },
  });
  return order;
});
// Si une requete echoue → TOUT est rollback automatiquement

// Transaction batch (plus simple, moins flexible)
const [order, notification] = await prisma.$transaction([
  prisma.order.create({ data: orderData }),
  prisma.notification.create({ data: notifData }),
]);
```

## Aggregations

```typescript
// Aggregate — sum, count, avg, min, max
const stats = await prisma.order.aggregate({
  where: { shopId, createdAt: { gte: startOfDay } },
  _count: true,
  _sum: { totalCents: true, commissionCents: true },
  _avg: { totalCents: true },
  _max: { totalCents: true },
});

// GroupBy — stats par categorie
const byStatus = await prisma.order.groupBy({
  by: ["status"],
  where: { shopId },
  _count: true,
  _sum: { totalCents: true },
});
```

## Performance & Optimisation

### select vs include
```typescript
// select — UNIQUEMENT les champs demandes (plus performant)
const orders = await prisma.order.findMany({
  select: { id: true, status: true, totalCents: true },
});

// include — TOUS les champs du model + les relations
const orders = await prisma.order.findMany({
  include: { items: true }, // Tous les champs order + items
});

// REGLE : utiliser select quand on n'a pas besoin de tous les champs
```

### Index Strategy
```prisma
// Index sur les colonnes filtrees frequemment
@@index([shopId])                    // Foreign key — OBLIGATOIRE
@@index([shopId, status])            // Filtre combine frequent
@@index([shopId, createdAt])         // Tri par date dans un shop
@@index([status, createdAt])         // Filtre global par status + date

// Unique compound (aussi utilise comme index)
@@unique([shopId, date])             // DailyCounter
@@unique([userId, shopId])           // Une pref par user par shop
```

### Eviter N+1
```typescript
// MAUVAIS — N+1 queries
const orders = await prisma.order.findMany({ where: { shopId } });
for (const order of orders) {
  const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
}

// BON — 1 seule query avec include
const orders = await prisma.order.findMany({
  where: { shopId },
  include: { items: true },
});
```

### Connection Pool (Railway)
```
DATABASE_URL="postgresql://...?connection_limit=10&pool_timeout=30&connect_timeout=30"
```
- `connection_limit` : nombre max de connections par instance (defaut: cpu * 2 + 1)
- `pool_timeout` : attente max pour obtenir une connection (defaut: 10s)
- `connect_timeout` : timeout pour ouvrir une nouvelle connection (defaut: 5s)

### Parallel Queries
```typescript
// Paralleliser les requetes independantes
const [orders, stats, products] = await Promise.all([
  prisma.order.findMany({ where: { shopId }, take: 50 }),
  prisma.order.aggregate({ where: { shopId }, _count: true, _sum: { totalCents: true } }),
  prisma.product.findMany({ where: { shopId, inStock: true } }),
]);
```

## Gestion d'erreurs Prisma

```typescript
import { Prisma } from '@prisma/client';

try {
  // requete
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': return apiError("CONFLICT", "Existe deja");          // Unique violation
      case 'P2025': return apiError("NOT_FOUND", "Non trouve");          // Record not found
      case 'P2003': return apiError("VALIDATION_ERROR", "Reference invalide"); // FK violation
      case 'P2024': return apiError("SERVER_ERROR", "DB surchargee");    // Pool exhausted
      default: return handleApiError(error);
    }
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return apiError("VALIDATION_ERROR", "Donnees invalides");
  }
  throw error;
}
```

### Codes d'erreur Prisma frequents
| Code | Signification | Solution |
|------|---------------|----------|
| P1001 | Can't reach database | Verifier DATABASE_URL, augmenter connect_timeout |
| P2002 | Unique constraint failed | Verifier les doublons, utiliser upsert |
| P2003 | Foreign key constraint failed | Verifier que le record reference existe |
| P2024 | Pool timeout | Augmenter connection_limit, optimiser les queries |
| P2025 | Record not found (update/delete) | Verifier l'ID, utiliser findFirst avant |

## Schema Klik&Go — Relations principales
```
Shop (boucherie)
  ├── products[] (catalogue)
  ├── orders[] (commandes)
  ├── owner (User boucher)
  ├── dailyCounters[] (numerotation tickets)
  ├── customerCounter? (numerotation clients)
  └── proAccesses[] (acces pro)

Order (commande)
  ├── items[] (OrderItem → Product)
  ├── user (client)
  ├── shop (boucherie)
  ├── dailyNumber / displayNumber (ticket #047)
  └── notifications[]

User (utilisateur)
  ├── orders[] (ses commandes)
  ├── proAccesses[] (statuts pro par shop)
  ├── customerNumber (C-001)
  └── role (CLIENT | CLIENT_PRO | BOUCHER | ADMIN | WEBMASTER)
```

## Middleware Prisma (logging, soft delete)

```typescript
// Middleware pour logger les queries lentes
prisma.$use(async (params, next) => {
  const start = Date.now();
  const result = await next(params);
  const duration = Date.now() - start;
  if (duration > 500) {
    console.warn(`Slow query: ${params.model}.${params.action} took ${duration}ms`);
  }
  return result;
});
```

## Ne JAMAIS

- Inventer une table qui n'existe pas dans schema.prisma
- Faire un findMany sans where shopId (multi-tenant leak)
- Oublier le select/include (over-fetching)
- Utiliser raw SQL sauf cas extreme (aggregation complexe)
- Oublier @@index sur les foreign keys
- Mettre datasources dans le PrismaClient constructor (build failure sans DATABASE_URL)
