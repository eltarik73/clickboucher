---
name: superpowers-workflow
description: "Workflow structuré en 5 phases pour implémenter des features dans un SaaS. Utiliser ce skill dès que l'utilisateur demande d'implémenter une feature, de développer une fonctionnalité, de planifier une tâche de dev, ou mentionne : brainstorming, planification, implémentation, review de code, workflow de développement, ou 'implémente', 'développe', 'ajoute cette feature'. Toujours répondre en français."
---

# Superpowers Workflow — Implémentation de Features en 5 Phases

Tu suis ce workflow structuré pour toute implémentation de feature. Ne saute jamais de phase.

## Phase 1 — Brainstorming

Avant d'écrire une seule ligne de code, clarifie :

1. **Objectif exact** : Qu'est-ce qu'on construit ? Quel problème ça résout ?
2. **Utilisateur cible** : Qui utilise cette feature ? (client, boucher, admin, webmaster ?)
3. **Contraintes techniques** : Stack existante, dépendances, limites ?
4. **Cas limites** : Que se passe-t-il si... ? (données manquantes, erreurs réseau, état vide)

Explore les alternatives et propose un **design document** résumant :
- L'approche choisie et pourquoi
- Les fichiers qui seront créés/modifiés
- Les risques identifiés

## Phase 2 — Planification

Découpe le travail en **tâches de 2-5 minutes maximum**. Chaque tâche a :
- Les **fichiers exacts** à créer/modifier (chemin complet)
- Le **code complet** à écrire (pas de pseudocode)
- Les **étapes de vérification** (comment savoir que c'est bon)
- Les **dépendances** (quelle tâche doit être faite avant)

Numérote les tâches et indique l'ordre d'exécution.

## Phase 3 — Exécution

Exécute chaque tâche une par une. Après **chaque tâche** :
1. Vérifie que le build passe : `npm run build`
2. Vérifie que rien n'est cassé (pas de régression)
3. Vérifie la cohérence avec les tâches précédentes
4. Passe à la tâche suivante seulement si tout est vert

**Règle absolue** : si le build casse, on corrige AVANT de continuer.

## Phase 4 — Review

Relis **tout** le code produit et vérifie :

### Sécurité
- Inputs validés avec Zod côté serveur
- Auth vérifiée (Clerk) dans chaque route handler
- Toute requête scopée par `shopId` (multi-tenant)
- Pas de secret exposé côté client

### Performance
- Pas de requête N+1 (utiliser `include`/`select` Prisma)
- Pagination sur les listes
- Index sur les colonnes filtrées/triées

### UX
- Mobile-first (375px → 768px → 1440px)
- Feedback immédiat sur chaque action (toast, loading state)
- Accessibilité : contrastes WCAG AA, touch targets ≥ 44px

### Code propre
- Pas de code mort ou commenté
- Nommage clair et cohérent
- Try/catch dans chaque route handler

## Phase 5 — Finalisation

1. `npm run build` — **doit passer sans erreur ni warning**
2. Test manuel des scénarios principaux
3. `git add . && git commit -m "feat: description claire" && git push`
4. Vérifier le déploiement automatique

## Checklist avant chaque fichier

- [ ] Scopé par shopId ? (sécurité multi-tenant)
- [ ] Inputs validés avec Zod ? (sécurité)
- [ ] Singleton Prisma utilisé ? (performance)
- [ ] Erreurs gérées avec bons status codes ? (robustesse)
- [ ] Mobile-first ? (design)
- [ ] CTA clairs et accessibles ? (UX)
- [ ] Rien de cassé ? (stabilité)
- [ ] Pas de secret exposé côté client ? (sécurité)
- [ ] Build passe ? (qualité)
