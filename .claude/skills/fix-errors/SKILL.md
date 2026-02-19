---
name: fix-errors
description: Diagnostique et corrige les erreurs de build, TypeScript, runtime et hydration dans Next.js App Router. Utiliser quand npm run build échoue, quand il y a des erreurs TypeScript, des hydration mismatches, ou des erreurs runtime en console.
---

# Fix Errors — Next.js + TypeScript + Prisma

## Process de correction

### Étape 1 : Lancer le build
```bash
npm run build 2>&1 | head -100
```
Si ça échoue, lire CHAQUE erreur et corriger dans l'ordre.

### Étape 2 : Classifier l'erreur

#### Erreurs TypeScript
- "Property does not exist" → Vérifier le type/interface, ajouter le champ
- "Type X is not assignable to type Y" → Vérifier les types, caster si nécessaire
- "Cannot find module" → Vérifier le chemin d'import, installer le package
- "Argument of type X is not assignable" → Vérifier les args de fonction

#### Erreurs "use client" / "use server"
- "useState is not defined" → Ajouter "use client" en haut du fichier
- "createContext not available" → Le composant doit être "use client"
- "window is not defined" → Ajouter "use client" OU utiliser typeof window !== 'undefined'
- "localStorage is not defined" → Même fix que window
- Import server-only dans client → Séparer en 2 fichiers

#### Erreurs Hydration
- "Text content does not match" → Pas de Date.now(), Math.random() dans le rendu initial
- "Hydration failed" → Vérifier les différences server/client
- Fix : useEffect pour les valeurs dynamiques côté client

#### Erreurs Prisma
- "PrismaClient not found" → npx prisma generate
- "Table does not exist" → npx prisma db push (dev) ou npx prisma migrate deploy (prod)
- "Unique constraint failed" → Gérer l'erreur P2002 avec try/catch
- "Record not found" → Gérer avec if (!result) return 404
- "Connection pool" → Vérifier le singleton PrismaClient dans src/lib/prisma.ts

#### Erreurs API Routes
- 405 Method Not Allowed → Vérifier export function GET/POST/PATCH/DELETE
- 500 Internal Server Error → Ajouter try/catch, loguer l'erreur
- "Dynamic server usage" → Utiliser export const dynamic = 'force-dynamic'

### Étape 3 : Pattern singleton Prisma (OBLIGATOIRE)
```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```
TOUJOURS importer depuis '@/lib/prisma', JAMAIS new PrismaClient() ailleurs.

### Étape 4 : Error boundaries
Chaque route group doit avoir un error.tsx :
```typescript
'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div>
      <h2>Une erreur est survenue</h2>
      <button onClick={reset}>Réessayer</button>
    </div>
  )
}
```

### Étape 5 : Après correction
```bash
npm run build
```
DOIT passer à 0 erreurs. Si des warnings restent, les lister mais ne pas bloquer.

## Checklist anti-erreurs
- [ ] Tous les composants interactifs ont "use client"
- [ ] PrismaClient est un singleton
- [ ] Pas de Date.now()/Math.random() dans le rendu
- [ ] Tous les try/catch en place dans les routes API
- [ ] Recharts et composants lourds en dynamic import { ssr: false }
- [ ] Pas d'import server dans composant client
- [ ] npm run build passe
