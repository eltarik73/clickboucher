---
name: clerk-auth
user_invocable: true
description: Expert authentification Clerk pour Klik&Go. Utiliser pour les problèmes de login, rôles, redirections, middleware, et metadata. Gère 3 rôles (client, boucher, webmaster) avec routing séparé.
---

# Clerk Auth — Klik&Go

## Architecture 3 rôles

| Rôle | Entrée | Redirect après login |
|------|--------|---------------------|
| client | /sign-in (normal) | /decouvrir |
| boucher | /espace-boucher → /sign-in | /boucher/dashboard |
| webmaster | /admin-login → /sign-in | /admin |

## Lire le rôle CORRECTEMENT

### Côté serveur (pages, route handlers)
```typescript
import { currentUser } from '@clerk/nextjs/server'

const user = await currentUser()
const role = (user?.publicMetadata?.role as string) || 'client'
```

### Côté middleware
```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// OU lire depuis JWT si configuré :
const role = sessionClaims?.metadata?.role || 'client'
```

### Important : JWT custom claims
Pour que sessionClaims contienne le rôle, configurer dans Clerk Dashboard :
Sessions → Customize session token → ajouter :
```json
{
  "metadata": "{{user.public_metadata}}"
}
```
Sans ça, sessionClaims ne contient PAS publicMetadata.

## Définir un rôle
Dashboard Clerk → Users → [user] → Public Metadata :
```json
{"role": "webmaster"}
```
ou
```json
{"role": "boucher"}
```
Si pas de rôle → client par défaut.

## Protection des routes

### Middleware
```typescript
const boucherRoutes = createRouteMatcher(['/boucher(.*)'])
const adminRoutes = createRouteMatcher(['/admin(.*)'])

export default clerkMiddleware(async (auth, request) => {
  if (boucherRoutes(request)) {
    await auth.protect() // doit être connecté
    // vérification rôle dans la page, pas le middleware
  }
  if (adminRoutes(request)) {
    await auth.protect()
  }
})
```

### Dans les pages
```typescript
const user = await currentUser()
if (!user) redirect('/sign-in')
const role = (user.publicMetadata?.role as string) || 'client'
if (role !== 'webmaster') redirect('/decouvrir')
```

### Dans les routes API
```typescript
import { auth } from '@clerk/nextjs/server'

const { userId } = await auth()
if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
```

## Erreurs courantes
- "Accès refusé" alors que le rôle est bon → JWT pas configuré, utiliser currentUser() au lieu de sessionClaims
- Boucle de redirection → Vérifier le middleware matcher, exclure /sign-in et /sign-up
- 401 sur API → Vérifier que auth() est importé de '@clerk/nextjs/server'
- Clerk webhook ne fonctionne pas → Vérifier CLERK_WEBHOOK_SECRET et la route /api/webhooks/clerk
