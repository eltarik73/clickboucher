---
description: "Lance une code review multi-agent complète sur la PR courante. 6 agents parallèles spécialisés Klik&Go + vérification + scoring confiance ≥80."
allowed-tools: Bash(gh:*), Bash(git:*), Read, Glob, Grep, Write
---

# Code Review Klik&Go — Multi-Agent

Tu es l'orchestrateur de code review pour le projet Klik&Go (Next.js 14, Prisma, Clerk, Stripe, PostgreSQL, Vercel).

## Pré-requis

Vérifie que tu es sur une branche avec une PR ouverte. Utilise `gh pr view --json number,title,state,headRefName,baseRefName,additions,deletions,changedFiles` pour récupérer les infos de la PR.

Si aucune PR n'est trouvée ou si la PR est fermée/draft, arrête-toi et informe l'utilisateur.

## Étape 1 — Collecter le contexte

1. Récupère le diff de la PR : `gh pr diff`
2. Récupère la liste des fichiers modifiés : `gh pr diff --name-only`
3. Lis tous les fichiers CLAUDE.md du repo (racine + sous-dossiers) : `find . -name "CLAUDE.md" -o -name "REVIEW.md" | head -20`
4. Note le nombre de lignes modifiées pour calibrer la profondeur de review

## Étape 2 — Lancer les 6 agents en parallèle

Lance ces 6 agents en parallèle, chacun reçoit le diff complet et la liste des fichiers modifiés :

1. **Agent `security-multitenant`** : Vérifie la sécurité multi-tenant et les fuites de données
2. **Agent `prisma-perf`** : Vérifie les patterns Prisma et la performance DB
3. **Agent `nextjs-patterns`** : Vérifie les patterns Next.js App Router
4. **Agent `stripe-payment`** : Vérifie l'intégration paiement (si fichiers Stripe touchés)
5. **Agent `ux-mobile-first`** : Vérifie l'UX mobile-first et l'accessibilité (si fichiers composants touchés)
6. **Agent `claude-md-compliance`** : Vérifie la conformité avec les règles CLAUDE.md du projet

Chaque agent retourne une liste de problèmes potentiels au format :
```
{
  "file": "chemin/du/fichier.ts",
  "line_start": 42,
  "line_end": 48,
  "severity": "critical|high|medium|low",
  "category": "security|performance|pattern|payment|ux|compliance",
  "description": "Description courte du problème",
  "evidence": "Le code fait X alors qu'il devrait faire Y",
  "suggestion": "Correction recommandée"
}
```

## Étape 3 — Vérification et scoring

Pour CHAQUE problème trouvé à l'étape 2, lance un agent Haiku de vérification qui :

1. Relit le code autour du problème signalé (±10 lignes de contexte)
2. Vérifie si le problème est réel ou un faux positif
3. Vérifie si le problème est pré-existant (dans le code avant la PR) vs introduit par la PR
4. Pour les problèmes CLAUDE.md : vérifie que la règle est EXPLICITEMENT mentionnée
5. Score le problème sur une échelle 0-100 :

**Rubrique de scoring (donne cette rubrique à l'agent verbatim) :**

a. **0** : Faux positif évident. Ne résiste pas à un examen rapide, ou problème pré-existant non modifié par la PR.

b. **25** : Possiblement un problème, mais pourrait aussi être un faux positif. L'agent n'a pas pu confirmer. Si c'est stylistique, ce n'est pas explicitement mentionné dans CLAUDE.md.

c. **50** : Problème réel confirmé, mais mineur ou rare en pratique. Par rapport au reste de la PR, pas très important.

d. **75** : Problème réel vérifié, très probable en pratique. L'approche dans la PR est insuffisante. Impact direct sur la fonctionnalité, ou problème explicitement mentionné dans CLAUDE.md.

e. **100** : Absolument certain. Confirmé par vérification directe. Se produira fréquemment en production. Preuve directe.

## Étape 4 — Filtrer et classer

1. **Filtre** : Ne garder que les problèmes avec score ≥ 80
2. Si aucun problème ≥ 80, affiche : "✅ Aucun problème significatif trouvé. Vérifié : sécurité multi-tenant, performance Prisma, patterns Next.js, conformité CLAUDE.md."
3. **Classer** par sévérité : critical → high → medium → low
4. **Dédupliquer** : si 2 agents trouvent le même problème, garder celui avec le meilleur score

## Étape 5 — Formatter le résultat

Affiche le résultat dans ce format exact :

```
## 🔍 Code Review Klik&Go

Found X issues:

### 🔴 Critical

1. **[security-multitenant]** Requête non scopée par shopId — `src/app/api/orders/route.ts` L42-L48
   Score: 95/100
   Le `prisma.order.findMany()` ne filtre pas par `shopId`, permettant une lecture cross-tenant.
   **Fix** : Ajouter `where: { shopId }` dans la requête.

### 🟠 High

2. **[prisma-perf]** Requête N+1 sur les produits — `src/app/api/cart/route.ts` L15-L30
   Score: 85/100
   Boucle `for` avec `prisma.product.findUnique()` à chaque itération.
   **Fix** : Utiliser `prisma.product.findMany({ where: { id: { in: productIds } } })`.

### 🟡 Medium

(aucun dans cet exemple)
```

## Étape 6 — Poster en commentaire (optionnel)

Si l'argument `--comment` est passé, poste le résultat en commentaire sur la PR avec :
```bash
gh pr comment --body "$(cat review_output.md)"
```

Si l'argument `--inline` est passé, poste des commentaires inline sur chaque fichier :
```bash
gh pr review --comment --body "description" --path "file" --line "line_number"
```

## Calibrage selon la taille de la PR

- **PR < 50 lignes** : review légère, agents rapides
- **PR 50-500 lignes** : review standard, tous les agents
- **PR > 500 lignes** : review approfondie, agents avec plus de contexte, vérification renforcée
- **PR > 1000 lignes** : avertir l'utilisateur que la PR est très grosse et suggérer de la découper

## Règles spécifiques Klik&Go

Les agents doivent connaître ces règles NON NÉGOCIABLES :

### Sécurité multi-tenant
- TOUTE requête Prisma DOIT être scopée par `shopId`
- TOUTE route API DOIT vérifier l'auth Clerk
- JAMAIS de `NEXT_PUBLIC_` pour les secrets
- Validation Zod sur toute mutation

### Performance
- Pas de requête N+1 (utiliser `include`/`select`)
- Pagination obligatoire sur les listes
- Index sur colonnes filtrées/triées
- Singleton Prisma (`src/lib/prisma.ts`)

### Patterns Next.js
- `"use client"` sur composants avec hooks/browser APIs
- Route handlers dans `app/api/**/route.ts`
- Pas de `Date.now()`/`Math.random()` dans le rendu initial
- Error boundaries avec `error.tsx`

### Paiement Stripe
- Prix TOUJOURS recalculé côté serveur
- Signature webhook TOUJOURS vérifiée
- `STRIPE_SECRET_KEY` JAMAIS côté client
- Idempotency key sur Payment Intent

### UX
- Mobile-first (375px d'abord)
- Touch targets ≥ 44px
- Feedback sur chaque action
- Dark mode supporté
