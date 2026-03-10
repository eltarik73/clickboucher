---
name: klikgo-audit
user_invocable: true
description: Audit complet du projet Klik&Go. Lance un diagnostic global de toutes les routes, erreurs de build, problèmes de design, sécurité, et performance. Utiliser avant un déploiement ou quand le projet a beaucoup de bugs.
---

# Audit Global — Klik&Go

## Processus en 6 étapes (exécuter dans l'ordre)

### ÉTAPE 1 — Build check
```bash
npm run build 2>&1 | tail -50
```
Si erreurs → corriger TOUTES les erreurs avant de continuer.
Si ça passe → noter ✅ et continuer.

### ÉTAPE 2 — Routes check
```bash
find src/app -name "page.tsx" | sort
```
Vérifier que CHAQUE route attendue a son fichier :
- / (landing)
- /decouvrir (catalogue)
- /sign-in, /sign-up (auth)
- /espace-boucher (landing boucher)
- /admin-login (accès admin)
- /boucher/commandes (mode cuisine)
- /boucher/dashboard (+ sous-pages)
- /admin (dashboard admin)

Route manquante → la créer.

### ÉTAPE 3 — API routes check
```bash
find src/app/api -name "route.ts" | sort
```
Vérifier pour chaque route :
- [ ] Try/catch présent
- [ ] Auth vérifié (auth() ou currentUser())
- [ ] ShopId scopé (multi-tenant)
- [ ] Validation Zod sur les inputs
- [ ] Bons status codes (200, 201, 400, 401, 404, 409, 500)

### ÉTAPE 4 — Sécurité check
```bash
grep -r "NEXT_PUBLIC_" src/ --include="*.ts" --include="*.tsx" | grep -i "secret\|key\|password\|token" | grep -v "PUBLISHABLE"
```
Si résultats → SECRET EXPOSÉ côté client, corriger immédiatement.

```bash
grep -rn "new PrismaClient" src/ --include="*.ts" --include="*.tsx"
```
Doit retourner UNE seule occurrence dans src/lib/prisma.ts.

### ÉTAPE 5 — Design check
Ouvrir chaque page principale et vérifier :
- [ ] Mobile-first (375px)
- [ ] Touch targets ≥ 44px
- [ ] Feedback sur chaque action (toast)
- [ ] Pas de texte illisible (contraste WCAG AA)
- [ ] Images optimisées (next/image, pas de <img>)
- [ ] Font = Plus Jakarta Sans ou DM Sans

### ÉTAPE 6 — Rapport
Générer un rapport avec :
- ✅ Ce qui fonctionne
- ❌ Ce qui est cassé (avec le fichier et la ligne)
- ⚠️ Ce qui pourrait poser problème
- 🔧 Les corrections à appliquer (par ordre de priorité)

Format du rapport :
```
## AUDIT KLIK&GO — [date]

### Build : ✅ / ❌
### Routes : X/Y fonctionnelles
### API : X routes, Y avec erreurs
### Sécurité : ✅ / ❌ (détails)
### Design : ✅ / ⚠️ (détails)

### Corrections prioritaires :
1. [CRITIQUE] ...
2. [HAUTE] ...
3. [MOYENNE] ...
```
