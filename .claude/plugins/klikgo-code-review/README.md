# Klik&Go Code Review — Plugin Claude Code

Code review multi-agent spécialisé pour le projet Klik&Go, inspiré du système Code Review d'Anthropic.

## Architecture

```
klikgo-code-review/
├── .claude-plugin/
│   └── plugin.json          # Métadonnées du plugin
├── commands/
│   └── klikgo-review.md     # Commande /klikgo-review (orchestrateur)
├── agents/
│   ├── security-multitenant.md   # Agent 1 : sécurité multi-tenant + shopId
│   ├── prisma-perf.md            # Agent 2 : performance Prisma/PostgreSQL
│   ├── nextjs-patterns.md        # Agent 3 : patterns Next.js App Router
│   ├── stripe-payment.md         # Agent 4 : intégration Stripe
│   ├── ux-mobile-first.md        # Agent 5 : UX mobile-first + accessibilité
│   └── claude-md-compliance.md   # Agent 6 : conformité CLAUDE.md
└── README.md
```

## Comment ça marche

1. **6 agents spécialisés** tournent en parallèle sur la PR
2. Chaque agent cherche des problèmes dans son domaine
3. Chaque problème trouvé est **re-vérifié** par un agent séparé
4. Scoring de confiance 0-100 sur chaque problème
5. Seuls les problèmes avec score **≥ 80** sont remontés (filtre les faux positifs)
6. Résultat classé par sévérité : Critical → High → Medium → Low

## Usage

```bash
# Sur une branche avec une PR ouverte

# Review locale (affichage dans le terminal)
/klikgo-review

# Poster en commentaire sur la PR
/klikgo-review --comment

# Commentaires inline sur les fichiers
/klikgo-review --inline
```

## Prérequis

- `gh` CLI installé et authentifié (`gh auth login`)
- Claude Code avec accès au repo
- Être sur une branche avec une PR ouverte

## Installation

```bash
# Dans Claude Code, depuis la racine du projet
/plugin install ./klikgo-code-review
```

Ou copier le dossier dans `.claude/plugins/klikgo-code-review/`.

## Personnalisation

### Seuil de confiance
Dans `commands/klikgo-review.md`, modifier la ligne :
```
Filtre : Ne garder que les problèmes avec score ≥ 80
```
Baisser à 60 pour plus de sensibilité, monter à 90 pour moins de bruit.

### Ajouter un agent
Créer un fichier `.md` dans `agents/` avec le frontmatter YAML, puis le référencer dans la commande `klikgo-review.md` étape 2.

### CLAUDE.md
Ajouter un fichier `CLAUDE.md` à la racine du repo pour que l'agent de conformité ait des règles à vérifier.

## Agents détaillés

| Agent | Focus | Sévérité max |
|---|---|---|
| `security-multitenant` | shopId, Clerk auth, Zod, secrets | Critical |
| `prisma-perf` | N+1, pagination, index, singleton | Critical |
| `nextjs-patterns` | use client, hydration, route handlers | High |
| `stripe-payment` | Montant serveur, webhook sig, secrets | Critical |
| `ux-mobile-first` | Touch targets, dark mode, a11y | High |
| `claude-md-compliance` | Règles CLAUDE.md du projet | High |
