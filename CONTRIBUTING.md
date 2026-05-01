# Contributing to Klik&Go

Merci de contribuer ! Ce guide t'aide à respecter les standards du projet.

---

## ⚡ TL;DR

```bash
# 1. Branche depuis main
git checkout main && git pull
git checkout -b feat/ma-feature

# 2. Code + tests
npm run test:watch        # tests en watch
npm run dev               # dev server

# 3. Avant push
npm run lint              # 0 warning
npm run typecheck         # 0 erreur TS
npm run test:run          # tous les tests passent
npm run build             # build prod OK

# 4. Commit (Conventional Commits validé par Husky)
git commit -m "feat(boucher): ajout du tri par popularité"

# 5. Push + PR
git push -u origin feat/ma-feature
# Ouvre PR sur GitHub avec template auto-rempli
```

---

## 📝 Format des commits (obligatoire)

Klik&Go utilise [Conventional Commits](https://www.conventionalcommits.org/). Le hook Husky `commit-msg` rejette tout message non conforme.

**Format** :
```
<type>(<scope>): <subject>

[body optionnel]

[footer optionnel]
```

**Types autorisés** :

| Type | Quand l'utiliser |
|---|---|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Bug fix |
| `chore` | Maintenance (deps, configs) |
| `docs` | Documentation |
| `refactor` | Refactor sans changement de comportement |
| `test` | Ajout/modif de tests |
| `perf` | Amélioration de perf |
| `style` | Formatting / lint (pas de code change) |
| `ci` | CI/CD changes |
| `build` | Build system / dependencies |
| `revert` | Revert d'un commit précédent |

**Exemples** :
- ✅ `feat(boucher): aperçu items sur card PENDING`
- ✅ `fix(api): /api/shops?owned=true test mode bypass`
- ✅ `docs: update README with growth pipeline`
- ❌ `update stuff` (pas de type)
- ❌ `Feat: New thing` (type doit être lowercase)

---

## 🎯 Règles de code (extrait CLAUDE.md)

### TypeScript
- **Pas de `any`** sans commentaire de justification
- **Strict mode** activé partout
- Préférer `type` à `interface` (sauf extension de classes)

### Sécurité
- TOUTE requête Prisma sur des données métier DOIT être scopée par `shopId`
- TOUTE route API DOIT vérifier l'auth via `getServerUserId()` ou `getAuthenticatedBoucher()`
- TOUTE mutation DOIT valider les inputs avec Zod côté serveur
- JAMAIS exposer de secrets avec `NEXT_PUBLIC_` (sauf publishable keys)

### Performance
- Pas de `Date.now()` / `Math.random()` dans le rendu initial (hydration mismatch)
- Pagination obligatoire sur listes >50 items
- `next/image` partout (pas de `<img>` sauf cas justifiés)
- `next/font` pour les fonts

### Style
- Mobile-first : styles base 375px, breakpoints `md:`/`lg:` pour tablette/desktop
- Touch targets ≥ 44px
- Dark mode supporté sur tous les composants
- Couleur primaire : `#DC2626`
- Icônes : Lucide React uniquement (pas Heroicons / FontAwesome)
- Pas d'emoji dans le code (sauf si demandé explicitement)

### Fichiers
- < 300 lignes (sauf exceptions justifiées : forms complexes, etc.)
- Composants : PascalCase (`ProductCard.tsx`)
- Utilitaires : camelCase (`getProductImage.ts`)
- API routes : `app/api/[resource]/route.ts`

---

## 🧪 Tests

### Quand écrire un test
- ✅ Helper pur dans `src/lib/**` (formatters, validators, calculs)
- ✅ State machine (transitions, conditions)
- ✅ Logique business critique (commission, prix, créneaux)
- ❌ Composants UI simples (couvert par E2E + visuel)
- ❌ Wrappers Prisma (testé en intégration)

### Format
```typescript
// src/lib/__tests__/format-kitchen.test.ts
import { describe, it, expect } from "vitest";
import { formatClientName } from "@/lib/format-kitchen";

describe("formatClientName", () => {
  it("should format firstname + last initial", () => {
    expect(formatClientName("tarik", "boudefar")).toBe("Tarik.B");
  });

  it("should handle missing lastname", () => {
    expect(formatClientName("tarik", "")).toBe("Tarik");
  });
});
```

Cibler **80%+ coverage sur `src/lib/`**.

---

## 🔄 Workflow PR

1. **Branche** depuis `main` à jour
2. **Code** avec commits Conventional
3. **Self-review** : lis ton diff avant de push
4. **Tests** : tout vert (lint + typecheck + test + build)
5. **PR** : utilise le template, remplis Description + Test plan
6. **CI** : 3 jobs parallèles doivent passer (lint, typecheck, test)
7. **Vercel preview** : teste manuellement la page touchée
8. **Review** : 1 approbation requise (auto si solo)
9. **Merge** : Squash and merge (clean history)

---

## 🐛 Reporter un bug

[Ouvre une issue GitHub](https://github.com/eltarik73/clickboucher/issues/new) avec :
- **Titre** : court et descriptif
- **Steps to reproduce** : numérotées
- **Expected** vs **Actual** behavior
- **Screenshots** si UI
- **Browser/OS** + **rôle utilisateur** (CLIENT / BOUCHER / ADMIN)
- **Logs Sentry** si dispo

---

## 💡 Proposer une feature

Avant de coder, ouvre une **issue** "Feature request" avec :
- **Problème** que ça résout
- **Solution proposée** (optionnel : alternatives)
- **Persona** ciblé (CLIENT / BOUCHER / ADMIN)
- **Mockups** si UI

Évite les PRs surprise sur des grosses features sans discussion préalable.

---

## 📞 Questions

- **GitHub Discussions** : https://github.com/eltarik73/clickboucher/discussions
- **Email** : `contact@klikandgo.app`

Merci !
