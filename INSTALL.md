# ClickBoucher v2 — Guide d'installation

## 📦 Fichiers à copier

Copie tout le contenu de ce dossier dans la racine de ton projet `clickboucher/`.
Les fichiers vont se superposer à ton repo existant.

### Fichiers nouveaux / modifiés :

```
src/
├── app/
│   ├── layout.tsx                          ← MODIFIÉ (ajout ClerkProvider)
│   ├── page.tsx                            ← MODIFIÉ (redirect /decouvrir)
│   ├── decouvrir/page.tsx                  ← REFAIT (nouvelle UI)
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx ← NOUVEAU (Clerk)
│   │   └── sign-up/[[...sign-up]]/page.tsx ← NOUVEAU (Clerk)
│   ├── (client)/
│   │   ├── boucherie/[id]/page.tsx         ← REFAIT
│   │   ├── panier/page.tsx                 ← REFAIT
│   │   ├── checkout/page.tsx               ← REFAIT
│   │   └── commandes/page.tsx              ← REFAIT
│   ├── boucher/
│   │   ├── layout.tsx                      ← NOUVEAU
│   │   ├── commandes/page.tsx              ← NOUVEAU
│   │   ├── catalogue/page.tsx              ← NOUVEAU
│   │   └── parametres/page.tsx             ← NOUVEAU
│   └── webmaster/
│       ├── layout.tsx                      ← NOUVEAU
│       ├── boutiques/page.tsx              ← NOUVEAU
│       ├── demandes/page.tsx               ← NOUVEAU
│       └── stats/page.tsx                  ← NOUVEAU
├── components/
│   ├── ui/shared.tsx                       ← NOUVEAU (composants partagés)
│   └── layout/secret-logo.tsx              ← NOUVEAU (5 taps → webmaster)
├── lib/
│   ├── utils.ts                            ← MODIFIÉ (ajout tokens)
│   ├── auth/rbac.ts                        ← NOUVEAU (RBAC Clerk)
│   └── seed/data.ts                        ← NOUVEAU (données Chambéry Halal)
├── styles/globals.css                      ← MODIFIÉ (animations + fonts)
├── types/index.ts                          ← NOUVEAU
└── middleware.ts                            ← NOUVEAU (Clerk middleware)
```

## 🔧 Installation Clerk

### 1. Installer le package

```bash
npm install @clerk/nextjs @clerk/localizations
```

### 2. Créer un compte Clerk

Va sur https://clerk.com, crée un compte et une application.

### 3. Configurer les variables d'environnement

Ajoute dans ton `.env` (ou `.env.local`) :

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/decouvrir
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/decouvrir
```

### 4. Configurer les Organizations (pour RBAC)

Dans le dashboard Clerk :
1. Active "Organizations" dans les settings
2. Crée une org pour ta boucherie
3. Ajoute des rôles :
   - `org:admin` → Webmaster
   - `org:manager` → Boucher

## 🚀 Lancer le projet

```bash
npm install
npm run dev
```

Ouvre http://localhost:3000

## 🔐 Accès aux interfaces

| Interface  | Accès                                              |
|------------|-----------------------------------------------------|
| Client     | Navigation libre, auth au checkout uniquement       |
| Boucher    | Lien "Espace professionnel" dans le footer          |
| Webmaster  | 5 taps rapides sur le logo "🥩 ClickBoucher"       |

## 📝 Notes

- Le panier utilise `localStorage` (pas de DB pour l'instant)
- Le paiement est un mock (structure prête pour Stripe)
- Les données sont statiques (seed) — à brancher sur Prisma/API
- L'accès webmaster est volontairement invisible dans l'UI
