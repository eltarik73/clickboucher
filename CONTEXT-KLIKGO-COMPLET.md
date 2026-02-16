# 🥩 CONTEXTE PROJET KLIK&GO - Click & Collect Boucheries

## 📋 RÉSUMÉ
Application Next.js 14 de Click & Collect pour boucheries artisanales. Design premium style Uber avec hero dark, logo animé, et cards modernes.

---

## 🔗 LIENS IMPORTANTS

| Élément | URL |
|---------|-----|
| **GitHub Repo** | https://github.com/eltarik73/clickboucher |
| **Production** | Railway (full stack) |
| **Railway Dashboard** | https://railway.app |

---

## 🏗 ARCHITECTURE HÉBERGEMENT

### Railway (Full-Stack)
```
Railway
├── Frontend (Next.js)
├── Backend (API Routes)
└── PostgreSQL Database
```

---

## 🛠 STACK TECHNIQUE

| Couche | Technologie | Version |
|--------|-------------|---------|
| Framework | Next.js (App Router) | 14.2.35 |
| Langage | TypeScript | - |
| UI | Tailwind CSS | - |
| Auth | Clerk | - |
| ORM | Prisma | - |
| Base de données | PostgreSQL | Railway |
| Icônes | Lucide React | - |

---

## 📁 STRUCTURE DU PROJET

```
clickboucher/
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout (Clerk + CartProvider)
│   │   ├── page.tsx                   # Redirect → /decouvrir
│   │   ├── decouvrir/page.tsx         # ⭐ PAGE ACCUEIL PREMIUM
│   │   ├── boutique/[id]/page.tsx     # Détail boucherie + produits
│   │   ├── panier/page.tsx            # Panier client
│   │   ├── sign-in/page.tsx           # Connexion
│   │   ├── checkout/page.tsx          # Paiement
│   │   ├── (client)/
│   │   │   └── layout.tsx             # Layout client avec CartProvider
│   │   └── api/                       # Routes API
│   │       ├── shops/
│   │       ├── orders/
│   │       ├── payments/
│   │       └── ...
│   ├── components/
│   │   ├── cart/
│   │   │   ├── CartDrawer.tsx
│   │   │   ├── CartPanel.tsx
│   │   │   ├── CartFAB.tsx
│   │   │   └── CartItem.tsx
│   │   ├── product/
│   │   │   └── ProductCard.tsx
│   │   ├── landing/
│   │   │   └── HowItWorks.tsx
│   │   ├── providers/
│   │   │   └── CartProviderWrapper.tsx
│   │   └── ui/
│   │       └── Toast.tsx
│   └── lib/
│       ├── hooks/
│       │   ├── use-cart.tsx           # ⭐ VRAI FICHIER CART (Context)
│       │   └── useCart.ts             # Re-export de use-cart.tsx
│       ├── utils.ts
│       ├── conversion-config.ts
│       └── estimate.ts
├── prisma/
│   └── schema.prisma
├── .env.local                         # Variables d'environnement
└── package.json
```

---

## 🛒 SYSTÈME DE PANIER

### Fichiers Clés
- **Source principale** : `src/lib/hooks/use-cart.tsx`
- **Re-export** : `src/lib/hooks/useCart.ts`
- **Pattern** : React Context + useReducer

### Interface CartItem
```typescript
interface CartItem {
  id: string;
  productId?: string;
  packId?: string;
  offerId?: string;
  name: string;
  imageUrl: string;
  unit: "KG" | "PIECE" | "BARQUETTE";
  priceCents: number;
  quantity: number;
  weightGrams?: number;
  // Compatibilité anciens composants
  category?: string;
  quantiteG?: number;
  prixAuKg?: number;
}
```

### API du Hook
```typescript
const { 
  state,           // { shopId, shopName, shopSlug, items: CartItem[] }
  addItem,         // (item: CartItem, shop: {id, name, slug}) => void
  removeItem,      // (id: string) => void
  updateQty,       // (id: string, quantity: number) => void
  updateWeight,    // (id: string, weightGrams: number) => void
  clear,           // () => void
  itemCount,       // number (total items)
  totalCents       // number (total en centimes)
} = useCart();
```

### ⚠️ ATTENTION - Imports
```typescript
// ✅ CORRECT
import { useCart } from "@/lib/hooks/use-cart";

// ❌ ANCIEN (peut marcher via re-export mais éviter)
import { useCart } from "@/lib/hooks/useCart";
```

---

## 🎨 DESIGN PREMIUM (Style Uber)

### Palette de Couleurs
| Élément | Couleur | Hex |
|---------|---------|-----|
| Primaire (boutons, accents) | Rouge | `#DC2626` |
| Primaire hover | Rouge foncé | `#B91C1C` |
| Hero background | Noir | `#0A0A0A` |
| Page background | Gris clair | `#FAFAFA` |
| Texte principal | Gris foncé | `gray-900` |
| Texte secondaire | Gris | `gray-500` |

### Logo Klik&Go
- Cercle rouge avec dégradé (`#EF4444` → `#DC2626` → `#B91C1C`)
- Lettre "K" blanche au centre
- Lignes de vitesse animées (pulse)
- Texte "Klik&Go" avec "&" blanc
- Sous-titre "by TkS26"

### Page Découvrir (Accueil)
```
┌─────────────────────────────────────────┐
│ [HEADER DARK]                           │
│  Logo Klik&Go        [Panier] [Connexion]│
├─────────────────────────────────────────┤
│ [HERO SECTION - Fond #0A0A0A]           │
│                                         │
│         🔴 Logo animé (glow)            │
│            Klik&Go                      │
│            by TkS26                     │
│                                         │
│    Marre d'attendre ?                   │
│    Commandez, récupérez.                │
│                                         │
│  [Voir les boucheries] [Comment ça marche]│
│                                         │
├─────────────────────────────────────────┤
│ [SECTION BOUCHERIES - Fond #FAFAFA]     │
│                                         │
│  Boucheries disponibles                 │
│  Retrait sous 20 min    [Tous][Express] │
│                                         │
│  ┌─────────┐  ┌─────────┐               │
│  │ Photo   │  │ Photo   │               │
│  │ h-52    │  │ h-52    │               │
│  │[Badge]  │  │[Badge]  │               │
│  ├─────────┤  ├─────────┤               │
│  │ Nom 4.8★│  │ Nom 4.6★│               │
│  │ 800m    │  │ 1.2km   │               │
│  └─────────┘  └─────────┘               │
│                                         │
│  Offres du moment          [Voir tout]  │
│  ┌───────┐ ┌───────┐ ┌───────┐          │
│  │-20%   │ │-15%   │ │-10%   │          │
│  └───────┘ └───────┘ └───────┘          │
│                                         │
├─────────────────────────────────────────┤
│ [FOOTER]                                │
│  Logo Klik&Go    © 2026 - Propulsé TkS26│
└─────────────────────────────────────────┘
```

### Composants Cards
- **Image** : h-52 (208px), rounded-2xl, hover scale-105
- **Badge temps** : bg-black/80, point vert animé (pulse)
- **Badge spécialité** : bg-white/95, backdrop-blur
- **Bouton "J'y vais"** : apparaît au hover, translate-y animation
- **Rating** : style Uber "4.8 (127)"

---

## 🐛 PROBLÈMES RÉSOLUS

### 1. "useCart must be used within CartProvider"
**Cause** : `useCart.ts` avait sa propre implémentation
**Solution** : `useCart.ts` = simple re-export de `use-cart.tsx`

### 2. CartProviderWrapper importait useCartState
**Cause** : Fonction inexistante
**Solution** : Import direct de CartProvider

### 3. Composants avec ancienne API (getTotal, clearCart)
**Fichiers corrigés** :
- CartDrawer.tsx → `totalCents`, `clear`
- CartPanel.tsx → `totalCents`, `clear`
- CartFAB.tsx → `itemCount`, `totalCents`
- CartItem.tsx → simplifié
- ProductCard.tsx → `state.items.some()` au lieu de `hasItem()`
- Toast.tsx → séparé du cart

### 4. Type CartItem incomplet
**Ajouté** : `category?`, `quantiteG?`, `prixAuKg?`

### 5. CartContextType non exporté
**Solution** : `export interface CartContextType`

### 6. Design écrasé par commits
**Solution** : `git checkout <commit> -- src/app/decouvrir/page.tsx`

---

## 📝 COMMANDES UTILES

### Build & Deploy
```bash
cd ~/Desktop/clickboucher
npm run build                    # Build local
git add . && git commit -m "msg" && git push origin main  # Deploy
```

### Debug
```bash
npm run build 2>&1 | grep -i error    # Voir erreurs
cat src/app/decouvrir/page.tsx | head -30  # Vérifier fichier
```

### Git - Revenir en arrière
```bash
git log --oneline -10                           # Voir commits
git checkout <commit> -- path/to/file           # Restaurer fichier
git revert <commit>                             # Annuler commit
```

### Corriger imports cart
```bash
sed -i '' 's|from "@/lib/hooks/useCart"|from "@/lib/hooks/use-cart"|g' src/app/decouvrir/page.tsx
```

---

## 🔑 VARIABLES D'ENVIRONNEMENT

### .env.local (Local)
```env
DATABASE_URL="postgresql://..."
CLERK_SECRET_KEY="sk_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
```

### Railway (Production)
Mêmes variables à configurer dans le dashboard Railway.

---

## 🚀 PROCHAINES ÉTAPES

1. [ ] Tester le site en production
2. [ ] Vérifier que les clics sur boucheries fonctionnent
3. [ ] Tester ajout au panier
4. [ ] Configurer DATABASE_URL en production
5. [ ] Ajouter persistance localStorage au panier
7. [ ] Connecter vraies données Prisma

---

## 📅 HISTORIQUE DES SESSIONS

### Session 7 Février 2026
- ✅ Fix système de panier complet
- ✅ Correction tous les composants cart
- ✅ Restauration design premium
- ✅ Build réussi
- ✅ Deploy sur Railway

### Commits Importants
```
2d6ed4b - feat: centered logo back + Uber premium design  ← DESIGN OK
2473901 - fix: cart system fully working                   ← CART OK
```

---

## 💡 TIPS

1. **Toujours vérifier l'import du cart** : `use-cart` pas `useCart`
2. **Avant de modifier decouvrir/page.tsx** : faire un backup
3. **Si build échoue** : chercher l'erreur exacte avec `grep -i error`
4. **Si design disparaît** : `git checkout 2d6ed4b -- src/app/decouvrir/page.tsx`
5. **Les warnings Prisma sont normaux** en local (pas de DATABASE_URL)
