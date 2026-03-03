---
name: git-expert
user_invocable: false
description: Patterns Git avances pour Klik&Go. Branching, merge, rebase, stash, bisect, hooks, et recovery. Utiliser pour les operations Git complexes et la resolution de problemes.
---

# Git Expert — Branching, Recovery & Workflows

## Concepts fondamentaux

- Git = Distributed VCS (chaque clone est un repo complet)
- Git stocke des **snapshots**, pas des diffs
- Ecrit en **C** pour la performance
- HEAD = pointeur vers le dernier commit de la branche courante
- Staging area (index) = zone intermediaire entre working dir et commit

## Commandes essentielles

```bash
# Status et diff
git status              # Etat du working tree
git diff                # Changes non-staged
git diff --cached       # Changes staged (pretes a commit)
git log --oneline -10   # 10 derniers commits, format compact

# Staging
git add file.tsx        # Ajouter un fichier specifique
git add -A              # Ajouter TOUT (new + modified + deleted)
git reset HEAD file.tsx # Unstage un fichier (garde les changes)

# Commit
git commit -m "message"         # Commit standard
git commit -a -m "message"      # Stage all modified + commit (pas les new files)
git commit --amend              # Modifier le dernier commit
git commit --amend --no-edit    # Amend sans changer le message

# Branches
git branch                      # Lister les branches locales
git branch -a                   # Inclure les remote branches
git checkout -b feature-x       # Creer et switcher
git branch -d feature-x         # Delete (safe — refuse si pas merged)
git branch -D feature-x         # Delete (force — meme si pas merged)
git branch --merged             # Branches deja merged dans la courante

# Remote
git remote -v                   # Lister les remotes + URLs
git remote add origin <url>     # Connecter a un remote
git remote set-url origin <url> # Changer l'URL du remote
git fetch --all                 # Telecharger tous les refs sans merger
git pull origin main            # Fetch + merge de main
git push -u origin main         # Push + set upstream
git push                        # Push (apres -u, raccourci)
git push --delete origin branch # Supprimer une branche remote
```

## Merge vs Rebase

```bash
# MERGE — cree un commit de merge (historique complet)
git checkout main
git merge feature-branch
# Resultat : commit de merge avec 2 parents

# REBASE — rejoue les commits sur la nouvelle base (historique lineaire)
git checkout feature-branch
git rebase main
# Resultat : commits de feature replays apres main, pas de commit merge

# REBASE INTERACTIF — reordonner, squash, edit
git rebase -i HEAD~5   # Les 5 derniers commits
# pick   = garder
# squash = fusionner avec le precedent
# fixup  = squash sans garder le message
# drop   = supprimer le commit
```

**Regle** : Ne JAMAIS rebase des commits deja pushes sur une branche partagee.

## Stash (sauvegarder temporairement)

```bash
git stash                    # Sauvegarder le travail en cours
git stash list               # Lister les stash
git stash pop                # Appliquer le dernier stash ET le supprimer
git stash apply              # Appliquer SANS supprimer (reste dans la liste)
git stash drop               # Supprimer le dernier stash
git stash show -p            # Voir le contenu detaille du stash
git stash branch new-branch  # Creer une branche depuis le stash
```

## Reset (attention — destructif)

```bash
# SOFT — deplace HEAD, garde staging + working tree
git reset --soft HEAD^    # "Undo" le dernier commit, changes restent staged

# MIXED (defaut) — deplace HEAD + reset staging, garde working tree
git reset HEAD^           # Undo commit + unstage, changes dans working tree

# HARD — deplace HEAD + reset staging + reset working tree
git reset --hard HEAD^    # DETRUIT les changes ! Undo total
git reset --hard origin/main  # Forcer la synchro avec remote
```

## Cherry-pick (copier un commit specifique)

```bash
git cherry-pick <commit-hash>  # Copier un commit dans la branche courante
# Utile quand un fix d'une branche doit aller sur une autre
```

## Bisect (trouver le commit qui a introduit un bug)

```bash
git bisect start
git bisect bad              # Le commit courant est bugge
git bisect good v1.0        # Ce commit etait OK
# Git fait une recherche binaire — teste chaque commit
git bisect good             # Ce commit est OK
git bisect bad              # Ce commit est bugge
# ... jusqu'a trouver le premier mauvais commit
git bisect reset            # Revenir a l'etat normal
```

## Recovery (sauvetage)

```bash
# Recuperer une branche supprimee
git reflog                           # Voir l'historique des mouvements HEAD
git checkout -b recovered <hash>     # Recreer la branche

# Annuler un merge
git merge --abort                    # Pendant un merge conflict

# Annuler un commit publie (sans rewrite l'historique)
git revert <commit-hash>             # Cree un nouveau commit qui annule

# Fichier supprime par erreur
git checkout HEAD -- path/to/file    # Restaurer depuis le dernier commit

# Nettoyer les fichiers non-tracked
git clean -d -f                      # Supprimer fichiers et dossiers untracked
git clean -n                         # Dry run (voir ce qui serait supprime)
```

## Git Hooks

```bash
# .git/hooks/ — scripts executes a certains moments
pre-commit      # Avant le commit (linting, tests)
commit-msg      # Valider le format du message (ex: ticket number)
pre-push        # Avant le push (tests complets)
pre-receive     # Cote serveur, avant d'accepter un push

# Klik&Go n'utilise pas de hooks custom pour l'instant
# Mais c'est utile pour : lint-staged, commitlint, husky
```

## Tags

```bash
# Lightweight tag (simple pointeur)
git tag v3.8.1

# Annotated tag (avec message, auteur, date)
git tag -a v1.4 -m "Release 1.4"

# Lister les tags
git tag -l 'v1.4.*'

# Push tags
git push --tags
```

## Git Log avance

```bash
git log --oneline --graph --all     # Visualiser l'arbre
git log --since="2 weeks ago"       # Depuis 2 semaines
git log -S "MaxConnections"         # Chercher un string dans les diffs
git log --stat                      # Stats inserts/deletions par fichier
git log -p                          # Diff complet de chaque commit
git blame file.tsx                  # Qui a modifie chaque ligne
git show <commit>                   # Details d'un commit
```

## .gitignore

```gitignore
# Klik&Go patterns
node_modules/
.next/
.env
.env.local
*.log
.DS_Store
dist/
coverage/
```

## Workflow Klik&Go

```
main (production)
  └── feature/ticket-system   (dev branch)
  └── fix/display-number      (bug fix)
  └── hotfix/critical-issue   (urgent fix → merge direct dans main)
```

### Process standard
1. `git checkout -b feature/nom` depuis main
2. Commits atomiques avec messages clairs
3. `git push -u origin feature/nom`
4. Pull Request → review → merge
5. `git branch -d feature/nom` apres merge

### Commit message format
```
type: description courte

Types: feat, fix, chore, refactor, docs, test, style, perf
Exemples:
  feat: add ticket numbering system
  fix: show displayNumber on order page
  chore: remove unused imports
  perf: optimize order query with select
```
