# SKILL — Dreaming Memory (Anthropic 2026)

> Inspiré de la nouveauté Anthropic "Dreaming" (mai 2026).
> Process planifié qui review les sessions passées, extrait les patterns
> et curate les memories automatiquement pour que l'agent s'améliore tout seul.

---

## 0) Quand utiliser ce skill

Active ce skill :

- **Fin de session importante** (après un gros chantier, un fix critique, une nouvelle feature)
- **Hebdomadaire** (review des memories accumulées, dedup, consolidation)
- **Quand le user dit `memorise et compact`** (déclencheur manuel)
- **Quand MEMORY.md dépasse 200 lignes** (signal de bloat)

---

## 1) Dossier mémoire Klik&Go

```
/Users/macbook/.claude/projects/-Users-macbook-Desktop-clickboucher/memory/
├── MEMORY.md                      # Index (≤ 200 lignes, ≤ 25KB)
├── user_profile.md                # Tarik
├── feedback_*.md                  # Feedback récurrent du user
├── project_*.md                   # Projets / topics persistants
└── reference_*.md                 # Refs externes (services, API keys, etc.)
```

---

## 2) Process Dreaming (3 phases)

### Phase 1 — Take Stock (inventaire)

1. `ls` du dossier memory
2. Read `MEMORY.md` (l'index)
3. Skim chaque fichier topic — identifier :
   - Overlaps (2 fichiers parlent du même sujet)
   - Stale (info dépassée — date > 30j sans update + sujet pas reconfirmé)
   - Thin (fichier de 5 lignes qui devrait être inline dans MEMORY.md)
   - Bloat (fichier > 500 lignes qui devrait être splitté)

### Phase 2 — Consolidate (consolidation)

**Sépare durable vs daté** :

- DURABLE (garde + affine) : préférences user, working style, key relationships, recurring workflows
- DATÉ (retire ou fold dans durable) : deadlines passées, projets one-shot terminés

**Merge overlaps** : si 2 fichiers décrivent même sujet → combine dans le plus riche.

**Fix time references** : convertir "next week", "this quarter" en dates absolues.

**Drop what's easy to re-find** : si la mémoire restate quelque chose qu'on peut puller du codebase/calendar/docs sur demande → cut.

**Garde** : préférences déclarées, contexte derrière une décision, qui-fait-quoi.

### Phase 3 — Tidy the Index

Update `MEMORY.md` :

- 1 ligne par entrée, < 150 chars : `- [Title](file.md) — one-line hook`
- Retire pointeurs vers memories retirées
- Raccourcis lignes qui contiennent du détail qui devrait être dans le topic file
- Ajoute ce qui est devenu important récemment

**Cibles** : MEMORY.md ≤ 200 lignes, ≤ 25KB.

---

## 3) Rubric Klik&Go pour évaluer "stale"

| Type de mémoire                        | TTL avant review                                              |
| -------------------------------------- | ------------------------------------------------------------- |
| `user_profile.md`                      | Jamais stale (durable)                                        |
| `feedback_*.md`                        | Jamais stale (durable)                                        |
| `project_business_model.md`            | Review mensuel (pivot business)                               |
| `project_*_log.md` (logs cron, audits) | Garde 30 derniers jours seulement                             |
| `project_*_strategy.md`                | Review trimestriel                                            |
| `project_*_fix.md` (bugs corrigés)     | Fold dans `project_lessons.md` puis delete original après 60j |
| `reference_*.md`                       | Review semestriel (services peuvent changer)                  |

---

## 4) Patterns à extraire (Dreaming-style)

Pendant la phase 2, cherche ces patterns à promouvoir vers une mémoire dédiée :

### Erreurs récurrentes → `project_lessons.md`

Si tu as commis la même erreur 2x (même type) → c'est un pattern, documenter.
Exemple : noindex auto erreur 2026-05-09 = règle d'or dans skill seo-anti-penalty.

### Working style du user → `feedback_workflow.md`

Si user a corrigé ton approche plusieurs fois (ex: "pas de voulez-vous continuer") → c'est une préférence stable.

### Décisions architecturales → `project_architecture_decisions.md`

Si on a discuté pourquoi on choisit X vs Y (ex: Clerk vs auth maison) → c'est un ADR léger.

---

## 5) Anti-patterns

### ❌ Tout garder "au cas où"

La mémoire qui ne sert plus = bruit. Si tu n'as rien re-référencé depuis 60j, drop.

### ❌ Memories qui contredisent le code actuel

Système-reminder "memory X days old" = vérifier vs code avant d'asserter. Si obsolète → corriger ou drop.

### ❌ Memories qui restate le CLAUDE.md

CLAUDE.md est déjà la source de vérité projet. Memory = ce qui est PERSONNEL au workflow user.

### ❌ Bloat dans MEMORY.md

Si l'index dépasse 200 lignes, split en sections OU promote en `MEMORY-archive.md`.

---

## 6) Workflow type "memorise et compact"

```
User dit : "memorise et compact"

1. ls memory/ → bilan
2. Read MEMORY.md → identifier l'entrée la + ancienne
3. Pour chaque fichier project_*_log.md :
   → si > 30 jours sans update → archiver ou résumer
4. Pour chaque feedback_*.md :
   → vérifier que c'est toujours vrai (sinon update)
5. Ajouter les patterns extraits de la session courante
6. Update MEMORY.md index (1 ligne par fichier, format unifié)
7. Reporter au user :
   - "Mémorisé X / consolidé Y / retiré Z"
   - 1 phrase sur le nouvel apprentissage
```

---

## 7) Différence vs CLAUDE.md

| `/path/CLAUDE.md` (projet)    | `~/.claude/projects/.../MEMORY.md` (user) |
| ----------------------------- | ----------------------------------------- |
| Règles techniques projet      | Préférences personnelles user             |
| Conventions code              | Working style                             |
| Architecture / stack          | Relations / décisions business            |
| Versionné (git)               | Personnel (pas git)                       |
| Read en début de session auto | Read si pertinent au turn                 |
| ≤ 1 par projet                | Index + fichiers topic                    |

**Quand quoi update** :

- Nouvelle règle technique projet → CLAUDE.md
- Nouveau pattern user / nouvelle préférence → memory

---

## 8) Limites du Dreaming local vs Anthropic-managed

Le vrai "Dreaming" d'Anthropic (annoncé mai 2026) est :

- **Automatique** (process planifié sans déclencheur user)
- **Cross-session** (review l'historique complet, pas juste la session courante)
- **Auto-curated** (l'agent décide quoi garder/jeter sans user intervention)

Ce skill simule manuellement le process. **Quand Dreaming devient dispo
sur le plan Max**, remplacer ce skill par l'activation native.

---

## 9) Sources

- [Anthropic — Dreaming feature (Let's Data Science)](https://letsdatascience.com/blog/anthropic-dreaming-claude-managed-agents-self-improving-may-6)
- [Anthropic — Claude Managed Agents update (9to5Mac)](https://9to5mac.com/2026/05/07/anthropic-updates-claude-managed-agents-with-three-new-features/)
- Plugin officiel `anthropic-skills:consolidate-memory` (utilisé en référence pour ce skill)
