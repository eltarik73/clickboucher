# SKILL — Multiagent Orchestration (Anthropic 2026)

> Inspiré de la nouveauté Anthropic "Multiagent Orchestration" (mai 2026).
> Le lead agent décompose le job en pieces et délègue à des spécialistes
> (chacun avec son modèle, prompt, et tools).

---

## 0) Quand utiliser ce skill

Active ce skill quand la tâche :

- Est **multi-étapes** et chaque étape requiert une expertise différente
- Peut être **parallélisée** (plusieurs sous-tâches indépendantes)
- Demande **> 3 tools différents** (sinon un agent unique suffit)
- A des **contraintes de contexte** (workload > 30k tokens → split)

**Ne PAS utiliser pour** :

- Tâches simples (1 fichier à modifier, 1 commande à lancer)
- Tâches strictement séquentielles avec un seul domaine d'expertise

---

## 1) Pattern de référence Klik&Go

### Lead agent (toi, dans la conversation principale)

Tu es le **chef d'orchestre**. Tu ne fais PAS le travail toi-même — tu :

1. Décomposes la tâche en sous-tâches atomiques
2. Identifies l'expertise requise pour chaque sous-tâche
3. Délègues via `Agent` tool en parallèle quand possible
4. Synthétises les résultats des sub-agents
5. Reportes au user

### Sub-agents (spécialistes)

Lancés via `Agent({ subagent_type, description, prompt })`.
Chaque sub-agent :

- A son **propre contexte** (vide au start)
- A des **outils spécifiques** (cf. agent_definitions)
- Ne voit PAS le reste de la conversation
- **Doit recevoir un prompt self-contained**

---

## 2) Agents spécialistes disponibles sur Klik&Go

### Read-only (audit, exploration)

| Agent                               | Quand l'utiliser                                                  |
| ----------------------------------- | ----------------------------------------------------------------- |
| `Explore`                           | Trouver fichiers/symboles spécifiques (recherche par pattern)     |
| `Plan`                              | Designer une stratégie d'implémentation pour une feature complexe |
| `searchfit-seo:seo-auditor`         | Audit SEO complet (autonomous crawl + report)                     |
| `searchfit-seo:competitor-analyzer` | Analyse concurrentielle SEO                                       |
| `searchfit-seo:content-strategist`  | Stratégie contenu (research site + plan)                          |

### Read-write (modification code)

| Agent             | Quand l'utiliser                                     |
| ----------------- | ---------------------------------------------------- |
| `general-purpose` | Tâches multi-step génériques, recherches complexes   |
| `claude`          | Catch-all (défaut quand aucun spécialiste ne matche) |

---

## 3) Patterns de décomposition

### Pattern A — Parallel independent tasks

3 tâches indépendantes → 3 sub-agents en parallèle (1 message, 3 tool calls).

```
Exemple : "Audit complet du site"
├─ Sub-agent 1: SEO audit (searchfit-seo:seo-auditor)
├─ Sub-agent 2: Accessibility audit (general-purpose)
└─ Sub-agent 3: Performance audit (general-purpose)
→ Lead agent synthétise les 3 reports
```

### Pattern B — Pipeline (séquentiel)

Tâches qui dépendent du résultat précédent.

```
Exemple : "Implémenter feature loyalty rewards"
├─ Étape 1: Plan agent (designs architecture)
└─ Étape 2: general-purpose (implémente selon plan)
```

### Pattern C — Hub & spoke (lead orchestrates)

Lead agent fait le travail principal et délègue les sous-tâches difficiles.

```
Exemple : "Audit bugs quotidien Klik&Go" (déjà en place)
├─ Lead: orchestre + commit
├─ Spoke 1: agent images (catch broken)
├─ Spoke 2: agent SEO (catch noindex regressions)
├─ Spoke 3: agent routes (catch 404)
├─ Spoke 4: agent UX (catch a11y issues)
└─ Spoke 5: agent console (catch JS errors)
```

---

## 4) Règles pour écrire le prompt d'un sub-agent

Le sub-agent **NE VOIT PAS** la conversation. Donc le prompt doit contenir :

1. **Goal** : qu'est-ce qu'on veut accomplir (1-2 phrases)
2. **Context** : pourquoi cette tâche compte, contraintes business
3. **Inputs** : tous les fichiers/URLs/données nécessaires
4. **Constraints** : ce qu'il NE DOIT PAS faire (formatting, branches, etc.)
5. **Output format** : structure attendue de la réponse
6. **Length cap** : "Report under 200 words" pour éviter le brouillard

### Exemple de bon prompt

```typescript
Agent({
  description: "Audit régression SEO villes",
  subagent_type: "general-purpose",
  prompt: `
    Audite si les pages /boucherie-halal/[ville] sont en noindex.

    Context business: Klik&Go a eu une régression en mai 2026 où 5/6 villes
    SEO_CITIES sont sorties de l'index Google (commit 018ba6a). On ne veut
    JAMAIS reproduire ça.

    Inputs:
    - SEO_CITIES défini dans src/lib/seo/cities.ts (40 villes)
    - URL pattern: https://klikandgo.app/boucherie-halal/{slug}

    Tâche:
    1. Pour chaque ville, curl la page prod
    2. Vérifier <meta name="robots"> = "index, follow"
    3. Lister les villes avec robots problématique

    Output:
    - Si 0 problème: "✅ Toutes en index, follow"
    - Sinon: liste markdown "❌ /boucherie-halal/X — robots=Y"

    Cap: < 100 mots, juste les findings.
  `,
});
```

---

## 5) Anti-patterns à éviter

### ❌ Sub-agent qui re-fait le travail du lead

Si tu lui donnes un prompt qui dit "based on your findings, implement",
tu pousses la synthèse sur lui. **Toujours faire la synthèse toi-même**.

### ❌ Sub-agent avec prompt vague

"Check the code for bugs" → résultat shallow. Sois précis : quels fichiers,
quels bugs, quel format de report.

### ❌ Multiplier les sub-agents pour des tâches triviales

Pour modifier 1 fichier ou run 1 commande, fais-le toi-même.

### ❌ Lancer en série ce qui peut être parallélisé

Si 3 tâches sont indépendantes, **1 message avec 3 Agent tool calls**.
Pas 3 messages séquentiels.

### ❌ Sub-agent qui édite des fichiers sans diff explicite

Préfère que le sub-agent te retourne un diff ou un plan, et fais le commit
toi-même. Sinon : "trust but verify" — relis ses changements.

---

## 6) Foreground vs Background

- **Foreground (défaut)** : tu attends le résultat avant de continuer.
  Utilise quand le résultat informe ta prochaine action.
- **Background** : `run_in_background: true`. Utilise quand tu as du travail
  indépendant à faire en parallèle. Tu seras notifié à la complétion.

```typescript
// Foreground : tu attends le rapport SEO pour décider de la fix
Agent({ ..., run_in_background: false })

// Background : tu lances un audit pendant que tu fais autre chose
Agent({ ..., run_in_background: true })
```

---

## 7) Checklist avant de lancer un sub-agent

```
[ ] Le prompt est self-contained (pas de "as discussed above")
[ ] Le prompt inclut le goal + context + inputs + format
[ ] J'ai cappé la longueur de la réponse (under N words)
[ ] Le subagent_type est le bon (Explore/Plan/general-purpose/...)
[ ] Si j'en lance plusieurs : ils sont en parallèle dans 1 message
[ ] Si write-mode : j'ai un plan pour verify ses changements
```

---

## 8) Référence : nouveautés Anthropic 2026

- **Dreaming** : self-improvement via review des sessions passées
  → cf skill `dreaming-memory`
- **Outcomes** : self-grading via rubric écrite
  → encode tes règles CLAUDE.md en rubric pour le PR review agent
- **Multiagent Orchestration** : ce skill ↑

---

## 9) Sources

- [Anthropic — Claude Managed Agents update mai 2026 (9to5Mac)](https://9to5mac.com/2026/05/07/anthropic-updates-claude-managed-agents-with-three-new-features/)
- [Anthropic — Dreaming announcement (Let's Data Science)](https://letsdatascience.com/blog/anthropic-dreaming-claude-managed-agents-self-improving-may-6)
- [Mindstudio — Code with Claude 2026 features](https://www.mindstudio.ai/blog/code-with-claude-2026-new-agent-features)
