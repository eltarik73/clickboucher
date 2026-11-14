# Git et commits — détail

État vérifié le 2026-11-14 dans `.husky/commit-msg`, `.husky/pre-commit`, `package.json`
(`lint-staged`), `vercel.json` et `.github/workflows/ci.yml` [R2][R3][R4].

## 1. Qui a le droit de faire quoi

| Action                                                             | Qui                                                                               | Quand                                                                                           |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Créer la branche `programme/<id>-<nom>` et le worktree du chantier | directeur                                                                         | avant le brief                                                                                  |
| Commit de travail sur la branche du chantier                       | greffier : agent lancé par le directeur, ou le chef si le directeur le lui confie | après chaque couche, après chaque série de corrections, avant chaque recette et chaque contrôle |
| Worktree jetable détaché, pour voir un test rouge                  | testeur de recette                                                                | fiche `klikgo-testeur-recette`, étape 6                                                         |
| Squash dans `main`, puis push                                      | directeur                                                                         | après le feu vert Fable et ses propres portes                                                   |
| Toute autre commande git qui change l'état                         | personne dans un chantier                                                         | —                                                                                               |

Lecture permise à tous : `git status`, `git diff`, `git log`, `git show`, `git rev-parse`,
`git blame`. Interdit à tous sauf le greffier et le directeur : `add`, `commit`, `stash`,
`checkout`, `switch`, `restore`, `reset`, `merge`, `rebase`, `cherry-pick`, `push`, `tag`.

## 2. Branches, Vercel et CI

- `vercel.json` (`git.deploymentEnabled`) désactive le déploiement des branches `claude/**` et
  `dependabot/**`, et d'elles seules. Une branche `programme/**` poussée sur GitHub déclencherait
  un déploiement de preview Vercel, qui échoue : l'environnement Preview n'a pas de
  `DATABASE_URL` et le build prérend environ 290 pages sur la base (`CLAUDE.md` « Vercel
  preview »). **Les branches de chantier restent donc locales.** Si le directeur doit en pousser
  une (pull request pour faire tourner la CI), il la pousse sous un nom `claude/<id>-<nom>`, motif
  déjà exclu.
- La CI (`.github/workflows/ci.yml`) ne tourne que sur les push vers `main` et sur les pull
  requests : jobs `lint`, `typecheck`, `test` (unitaires puis intégration) et `build` suivi de
  `scripts/check-prerender.mjs`.
- Seul `main` déploie, en production, à chaque push. Si le push contient une migration, le build
  de production l'applique (`scripts/prisma-migrate-prod-only.mjs` : pré-vols `preflight.sql`,
  puis `prisma migrate deploy`) pendant que l'ancienne version du code sert encore.

## 3. Message de commit

- Ce que `.husky/commit-msg` **vérifie** : la première ligne commence par
  `type(portée): sujet`, la portée étant facultative, avec un type parmi `feat`, `fix`, `chore`,
  `docs`, `refactor`, `test`, `perf`, `style`, `ci`, `build`, `revert`. Rien d'autre.
- Ce que le dépôt **attend** en plus (écrit en commentaire du hook ou visible dans l'historique,
  non vérifié par lui) : sujet de 100 caractères au plus, en français, minuscule initiale, sans
  point final ; un corps qui dit **pourquoi** le changement existe, pas ce que le diff montre.
- Exemples tirés de l'historique :
  - `fix(security): mode test impossible en production, session de test signée`
  - `chore(ci): build en CI avec garde de prérendu, sonde uptime, crons et doc`
- Commit de travail d'un chantier : `chore(<id>): travail en cours, couche N (<résumé>)`.
- Dépôt public : aucun constat de faille non corrigée dans un message de commit.
- Attribution : la ligne `Co-Authored-By` fournie par la session, en dernière ligne du message.
- Passer le message par fichier ou par l'entrée standard (`git commit -F <fichier>` ou
  `git commit -F -`) : le bash 3.2 de macOS casse les heredocs placés dans `$(…)`.

## 4. Ce que fait `pre-commit`

`.husky/pre-commit` lance `npx lint-staged`, configuré dans `package.json` :

- `*.{ts,tsx}` : `eslint --fix --max-warnings=0`, puis `prettier --write` ;
- `*.{css,md,json,yml}` : `prettier --write` (un fichier Markdown ou JSON peut donc être
  reformaté au moment du commit : c'est attendu).

Un avertissement ESLint fait échouer le commit. On ne contourne jamais (`--no-verify` interdit) :
l'erreur se corrige dans le code, par l'ingénieur qui possède le fichier.

## 5. Consigne du greffier

1. `git status --short`, puis comparer à la liste attendue : fichiers possédés des tâches de la
   couche, nouveaux fichiers prévus au plan, fichiers partagés autorisés. Un fichier inattendu est
   **signalé et laissé de côté**, jamais commité « au passage ».
2. `git add -- <chemins>` avec des chemins explicites ; jamais `git add -A`, `git add .` ni
   `git add -u`. `prisma/schema.prisma` et le dossier de sa migration partent dans le **même**
   commit.
3. `git commit -F <fichier du message>`. Si le hook réécrit des fichiers, c'est normal. S'il
   échoue, ne rien forcer : rendre la sortie du hook au chef.
4. Rendre le sha court (`git rev-parse --short HEAD`), le nombre de fichiers commités et la liste
   des fichiers laissés de côté. Le greffier ne modifie aucun fichier et ne pousse pas.

## 6. Fusion par le directeur

1. Feu vert du contrôle final (rôle Fable) sur la branche propre, corrections commitées.
2. Branche mise à jour sur `main` ; portes rejouées par le directeur lui-même : `npx tsc --noEmit`,
   `npm run lint`, `npm run test`, `npm run test:integration`, `npm run build`,
   `node scripts/check-prerender.mjs`.
3. Squash dans `main`, message au format du § 3.
4. Push, puis vérification du déploiement en lecture seule (passation, règle 6).
