---
name: fix-routes
user_invocable: true
description: Diagnostique et corrige les erreurs de routes, 404, redirections cassées, et problèmes de navigation dans Next.js App Router. Utiliser quand une page affiche 404, une redirection ne fonctionne pas, ou le routing est cassé.
---

# Fix Routes — Next.js App Router

## Diagnostic systématique

Quand une route retourne 404, exécuter dans cet ordre :

### 1. Vérifier que le fichier existe
```bash
find src/app -name "page.tsx" | sort
```
Chaque route dans Next.js App Router DOIT avoir un fichier page.tsx dans le bon dossier.
Exemple : /boucher/dashboard → src/app/(boucher)/boucher/dashboard/page.tsx

### 2. Vérifier les route groups
Les dossiers entre parenthèses (boucher), (auth), (client) sont des route groups.
Ils NE créent PAS de segment d'URL.
- src/app/(boucher)/boucher/dashboard/page.tsx → URL: /boucher/dashboard ✅
- src/app/(auth)/sign-in/page.tsx → URL: /sign-in ✅

### 3. Vérifier les layouts
Chaque route group DOIT avoir un layout.tsx qui exporte :
```typescript
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```
Un layout manquant ou mal exporté = 404.

### 4. Vérifier le middleware
Lire src/middleware.ts :
- Est-ce qu'il intercepte la route ?
- Est-ce qu'il redirige vers une autre page ?
- Est-ce que le matcher inclut ou exclut la route ?

```typescript
export const config = {
  matcher: ['/((?!_next|api|favicon).*)'], // vérifie ce pattern
}
```

### 5. Vérifier les redirections dans next.config.js
```javascript
async redirects() { return [...] }
async rewrites() { return [...] }
```

### 6. Erreurs courantes
- Fichier nommé Page.tsx au lieu de page.tsx (case sensitive !)
- Export nommé au lieu de default export
- Route dynamique sans brackets : [id] nécessaire
- Conflit entre page.tsx et route.ts dans le même dossier (interdit)
- Layout qui ne render pas {children}

### 7. Après fix
```bash
rm -rf .next && npm run build
```
Le build DOIT passer. Tester la route dans le navigateur.

## Routes Klik&Go attendues

| URL | Fichier | Interface |
|-----|---------|-----------|
| / | src/app/page.tsx | Landing |
| /decouvrir | src/app/(client)/decouvrir/page.tsx | Catalogue client |
| /sign-in | src/app/(auth)/sign-in/page.tsx | Login Clerk |
| /sign-up | src/app/(auth)/sign-up/page.tsx | Register Clerk |
| /espace-boucher | src/app/(auth)/espace-boucher/page.tsx | Landing boucher |
| /admin-login | src/app/(auth)/admin-login/page.tsx | Login admin |
| /boucher/commandes | src/app/(boucher)/boucher/commandes/page.tsx | Mode cuisine |
| /boucher/dashboard | src/app/(boucher)/boucher/dashboard/page.tsx | Dashboard |
| /boucher/dashboard/catalogue | src/app/(boucher)/boucher/dashboard/catalogue/page.tsx | Produits |
| /boucher/dashboard/clients | src/app/(boucher)/boucher/dashboard/clients/page.tsx | Clients |
| /boucher/dashboard/parametres | src/app/(boucher)/boucher/dashboard/parametres/page.tsx | Settings |
| /admin | src/app/(admin)/admin/page.tsx | Dashboard admin |

Toute route manquante = la créer. Toute route qui 404 = la diagnostiquer avec les étapes ci-dessus.
