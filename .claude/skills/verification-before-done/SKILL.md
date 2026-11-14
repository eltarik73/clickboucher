---
name: verification-before-done
description: Porte de preuve de Klik&Go avant toute annonce « terminé », « corrigé », « les tests passent » ou « le build est bon » - quelle commande prouve quelle affirmation (typecheck, lint, tests unitaires, intégration sur PostgreSQL local, build puis contrôle du prérendu, tests de garde, captures d'écran), lecture du code de sortie et du nombre d'échecs, correctif prouvé par un test vu rouge puis vert, rapport d'un sous-agent recoupé avec le diff, liste explicite de ce qui n'a pas été vérifié. À charger avant d'écrire un rapport de fin de tâche, de cocher une définition de terminé ou de committer, et dès qu'on s'apprête à écrire « ça marche », « c'est bon », « devrait fonctionner » ou « fini ». Pas pour choisir le niveau d'un test (testing-strategy), diagnostiquer une porte rouge (fix-errors) ni monter la recette locale (klikgo-programme).
when_to_use: Mots-clés - terminé, fini, c'est bon, ça marche, tests verts, build OK, tsc, npm run lint, npm run test, test:integration, check-prerender, preuve, vérifier avant de dire, rapport de fin, définition de terminé, DoD, verifie, nonVerifie, le sous-agent dit succès, rouge puis vert, non vérifié.
---

# Vérifier avant de dire « terminé » — Klik&Go

Ce skill est la méthode de preuve derrière la Définition de terminé (`klikgo-programme` § 7) et
les rapports (§ 12, champs `verifie` et `nonVerifie` de
`klikgo-programme/references/passation-et-rapports.md`) ; il ne recopie pas leurs listes. Il
change un réflexe : chaque affirmation de réussite renvoie à une commande lancée dans ce tour,
dont la sortie a été lue et citée.

Précédence : messages du propriétaire > `CLAUDE.md` relu sur disque > `seo-anti-penalty` > skills
vérifiés du programme (`klikgo-programme`, `testing-strategy`…) > ce skill. Un désaccord s'écrit
dans « Points à arbitrer » et se signale pour `klikgo-programme/references/contradictions-connues.md` ;
il ne se tranche jamais dans le code.

## 1. Règle de fer

Aucune annonce de réussite (« terminé », « corrigé », « tests verts », « build OK », « l'écran est
bon ») sans les trois éléments suivants :

1. la commande qui la prouve, lancée **dans ce tour**, sur l'arbre actuel, après la dernière
   modification ;
2. sa sortie lue : code de sortie, nombre de fichiers et de tests lancés, échoués, ignorés,
   première erreur, ligne de synthèse ;
3. cette ligne citée dans le rapport (`verifie: { commande, resultat }`).

Un résultat de mémoire, d'une session précédente, d'un autre agent ou d'avant la dernière
modification ne compte pas. Pourquoi : l'équipe Claude Code d'Anthropic rapporte que les skills de
vérification sont ceux dont l'effet mesuré sur la qualité est le plus fort, et les tickets publics
anthropics/claude-code #63861 et #48059 décrivent des agents qui annoncent « vérifié » sans avoir
lancé la suite canonique (douze tests rouges découverts ensuite par l'utilisateur). Ici, un faux
vert finit dans `main`, qui déploie en production.

## 2. Quelle commande prouve quelle affirmation

Depuis la racine du worktree du chantier ; variables posées dans la même commande, jamais lues
dans `.env*`. Chaque commande est suivie de `; echo EXIT=$?` (§ 4).

| Affirmation                                            | Preuve                                                                                                                                             | À lire                                                            |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Types                                                  | `npx tsc --noEmit`                                                                                                                                 | EXIT=0, aucune ligne `error TS`                                   |
| Lint                                                   | `npm run lint`                                                                                                                                     | 0 erreur ; avertissements situés dans les fichiers touchés nommés |
| Lint de ce que le commit verra                         | `npx eslint --max-warnings=0 -- [fichiers .ts/.tsx touchés]` (sans `--fix`)                                                                        | EXIT=0                                                            |
| Tests unitaires (dont les gardes)                      | `npm run test`                                                                                                                                     | `Test Files … passed`, `Tests … passed`, aucun `failed`           |
| Tout code qui lit ou écrit la base                     | `DATABASE_URL="postgresql://[u]:[mdp]@127.0.0.1:[port]/[base]?schema=public" npm run test:integration`                                             | idem, sur une base locale jetable                                 |
| Rendu, layout, ISR, route publique, middleware, config | `npm run build && node scripts/check-prerender.mjs` (base joignable ; par le rôle qui tient le build, `klikgo-programme` § 5)                      | EXIT=0 pour les deux                                              |
| Écran                                                  | captures 375 px clair et sombre, puis bureau, sur le serveur local seedé en mode test (`klikgo-programme/references/recette-locale.md` § 3 et § 5) | chemins des fichiers cités                                        |
| Critère du brief                                       | le comportement constaté (requête et réponse, base relue, capture)                                                                                 | le critère, pas « les tests passent »                             |

- Gardes d'architecture : `tests/lib/order-writers-guard.test.ts` (seul écrivain de
  `Order.status`), `src/lib/__tests__/middleware-matcher.test.ts`, et toute garde présente
  (`ls tests/lib/*guard*.test.ts`). Elles tournent dans `npm run test` ; les nommer dans le
  rapport quand le changement touche leur domaine.
- En cours d'itération, `npx vitest run --project unit [fichier]` suffit ; l'annonce finale exige
  le projet entier.
- E2E : lire `testing-strategy` § 4 avant tout `npm run test:e2e` (sans `PLAYWRIGHT_BASE_URL`,
  `playwright.config.ts` vise la production, interdite).

## 3. Un correctif se prouve rouge puis vert

Le test de régression échoue sans le correctif **pour la bonne raison** — un message
d'assertion (attendu / reçu), pas une erreur d'import, de syntaxe, de délai ou de base
injoignable — puis passe avec. Écrire le test d'abord le prouve directement (`test-discipline`).
Si le correctif existe déjà, l'ingénieur qui possède ses fichiers le prouve ainsi :

```bash
git diff -- [fichiers du correctif, sans le test] > [work]/fix.patch
git apply -R [work]/fix.patch && npx vitest run --project unit [test]; echo EXIT=$?   # rouge attendu
git apply [work]/fix.patch && npx vitest run --project unit [test]; echo EXIT=$?      # vert attendu
git diff -- [fichiers du correctif] | diff -q - [work]/fix.patch && echo RESTAURE
```

- Jamais `git stash` : la pile est partagée entre worktrees et sessions. Jamais
  `git checkout -- [fichier]` : il efface le correctif. Ne renverser que ses propres fichiers,
  d'autres ingénieurs travaillent dans le même worktree (`klikgo-programme` § 5). Un `git apply`
  refusé n'a rien lancé : son code non nul n'est pas un rouge.
- Correctif dans un fichier nouveau (non suivi, invisible pour `git diff`) : renverser l'appel qui
  l'utilise, pas le fichier, sinon le rouge vient d'un import manquant.
- Même méthode pour un test d'intégration, avec `npm run test:integration -- [fichier]`.
- Le testeur de recette, qui ne touche pas au produit, prouve le rouge dans le worktree jetable de
  sa fiche (`klikgo-testeur-recette`, étape 6).
- Rapport : `vuRouge` = commande + première ligne de l'assertion en échec ; puis la ligne verte.

## 4. Lire la sortie

- **Code de sortie** : `; echo EXIT=$?`. Jamais `| tail`, `| head` ni `| grep` sur une porte : le
  pipe rend le code de la dernière commande (`tail` vaut 0) et coupe la sortie. Rediriger vers un
  fichier hors dépôt (`npm run test > [work]/unit.log 2>&1; echo EXIT=$?`) puis lire le fichier.
- **Nombre de tests** : zéro test lancé n'est pas un succès. Mesuré ici : un filtre `-t` qui ne
  correspond à aucun nom marque tous les tests `skipped` et sort avec 0 ; un chemin qui ne
  correspond à aucun fichier sort avec 1. Tout `skipped` ou `todo` nouveau est nommé.
- **Première erreur** : tsc et le build produisent des cascades ; la première est la cause.
- **Sortie tronquée** par l'outil (sauvegardée dans un fichier) : lire ce fichier avant de
  conclure.
- **Une porte par appel, en séquence** : dans un lot parallèle, un échec annule les autres appels
  et noie les erreurs (#63861). Une modification refusée par l'outil n'est pas sur le disque :
  `git diff` le montre.

## 5. Mots d'alerte

« devrait », « normalement », « probablement », « a l'air bon », « ça marche », « Terminé ! »
écrits sans preuve signifient : lancer d'abord la commande. Chaque affirmation a sa propre preuve.
Le lint ne vérifie pas les types, les types ne vérifient pas le comportement, et un build prouve
peu sur la justesse (Trigger.dev : « building proves almost nothing about correctness ») ; ici il
prouve en revanche le prérendu. « Le test passe » ne prouve pas le critère si le test n'exerce
pas le code modifié : vérifier qu'il importe le module changé (`testing-strategy` § 3 règle 1).

## 6. Rapport d'un sous-agent ou d'un ingénieur

Un succès rapporté n'est pas une preuve. Avant de le relayer ou de le cocher :

1. `git status --short` : fichiers annoncés = fichiers modifiés ? Un fichier en plus est hors
   périmètre ; un fichier annoncé mais inchangé n'est pas fait.
2. `git diff --stat`, puis `git diff -- [fichiers annoncés]` lu en entier ; les tests relus à
   part (assertion affaiblie, valeur attendue recopiée, `.skip` : `test-discipline`).
3. Les portes du § 2 relancées soi-même sur l'arbre actuel. Ne jamais recopier le `verifie` d'un
   autre : c'est la règle du relecteur (`.claude/agents/klikgo-relecteur.md`, étape 6).
4. Rapporter l'état constaté, écarts avec le rapport reçu compris.

## 7. Ce qui n'a pas été vérifié

`nonVerifie` est obligatoire, une raison par ligne : pas de base (Docker indisponible), build tenu
par la recette, E2E non lancés, rôle non exercé, isolation entre boutiques que le mode test ne
prouve pas (`recette-locale.md` § 4), PostgreSQL 15 en local contre 16 en CI. Ne jamais laisser
croire à une couverture complète : « tout est vert » sans l'intégration est faux.

Base absente : le dire, puis en fournir une (`recette-locale.md` § 2, ou `testing-strategy` § 4).
Docker indisponible : intégration et build passent dans `nonVerifie`. On ne « répare » jamais un
build sans base avec des `try/catch` à valeur par défaut : `CLAUDE.md` (« Coût CPU Vercel ») dit
que cela figerait des listes vides et des `noindex` dans le cache ISR.

## 8. Échecs croisés en chemin

Toute porte rouge est nommée avec sa première erreur, même sans en être la cause, et classée :
**régression** (verte sur la base de comparaison, rouge maintenant), **préexistant** (rouge sur la
base aussi : CI du commit de base, ou worktree jetable de la recette), sinon **origine non
établie**, dans `nonVerifie`. « Sans rapport avec mon changement » ne s'écrit qu'avec cette
preuve. Hors périmètre : `besoinsDuChef`, aucune correction opportuniste (`klikgo-programme` § 6
règle 10).

## 9. Ne jamais affaiblir pour obtenir le vert

Détail dans `test-discipline` : supprimer un test, `.skip`, `.only`, `.todo`, assertion relâchée,
valeur reçue collée comme attendue, script ou configuration modifiés pour exclure des fichiers,
`--passWithNoTests`, `eslint-disable`, `@ts-expect-error`, `@ts-ignore`, `as any`, délai allongé
qui cache une course, `try/catch` à valeur par défaut. Une porte qui bloque pour une raison hors
du brief va dans `besoinsDuChef`.

## Pièges (vérifiés dans le dépôt)

- `npm run lint` est `next lint`, qui ne lit que `app`, `pages`, `components`, `lib` et `src`
  (`ESLINT_DEFAULT_DIRS`, `node_modules/next/dist/lib/constants.js`) : `tests/` et `scripts/` ne
  sont pas lintés. Le dire, et passer leurs fichiers touchés à `npx eslint`.
- `npm run lint` sort avec 0 malgré des avertissements (`react-hooks/exhaustive-deps` est en
  `warn` dans `.eslintrc.json`), mais `.husky/pre-commit` lance `lint-staged`, soit
  `eslint --fix --max-warnings=0` sur les fichiers indexés : un avertissement bloque le commit. Sur
  un fichier de `tests/e2e/` (ignoré par `.eslintrc.json`), cette commande sort en échec avec
  l'avertissement « File ignored » (mesuré) : le signaler s'il est touché.
- `next build` lance ESLint et le contrôle de types (`next.config.mjs` n'a ni
  `eslint.ignoreDuringBuilds` ni `typescript.ignoreBuildErrors`) : une erreur de lint casse le
  build Vercel.
- `npx tsc --noEmit` lit aussi `.next/types/**` (`tsconfig.json`, `include`), produit par le
  dernier build, qui importe chaque page : après déplacement ou suppression d'une page, une erreur
  dans `.next/types/…` vient d'un ancien build, pas du code ; la CI `typecheck` n'a pas de `.next`.
  La noter ; ne pas supprimer `.next` pendant qu'un serveur de recette tourne sur ce worktree.
- `scripts/check-prerender.mjs` lit `.next/prerender-manifest.json` : le manifeste d'un ancien
  build passe. Toujours `npm run build && node scripts/check-prerender.mjs` dans une seule
  commande.
- Un `vitest run` sans `--project` démarre aussi l'intégration et réclame une base
  (`vitest.config.ts`).
- L'intégration refuse tout hôte autre que `localhost`, `127.0.0.1`, `::1`
  (`tests/integration/setup/database-url.ts`) ; deux lancements sur la même base s'attendent
  jusqu'à 10 min (verrou advisory, `global-setup.ts`) : un lancement « figé » attend peut-être.
- `.claude/hooks/pre-git-typecheck.sh` existe mais aucun fichier de réglages suivi ne le branche :
  rien ne vérifie les types avant un commit (lint-staged ne lance pas `tsc`) ; seule la CI le fait,
  après le push.

## Procédure (à recopier et cocher dans le rapport)

```
Vérification avant « terminé » — [tâche]
- [ ] Affirmations listées, une par ligne (types, lint, unitaires, intégration, build, écran, critères)
- [ ] Une commande par affirmation (§ 2), lancée dans ce tour, après la dernière modification
- [ ] Sortie lue : EXIT, tests lancés / échoués / ignorés, première erreur ; ligne citée
- [ ] Chaque correctif : rouge par assertion, puis vert (§ 3)
- [ ] Diff relu : git status --short, git diff --stat, fichiers annoncés = fichiers modifiés (§ 6)
- [ ] Échecs croisés nommés et classés (§ 8)
- [ ] nonVerifie rempli, une raison par ligne (§ 7)
- [ ] Alors seulement : « terminé »
```

Boucle : porte rouge → cause corrigée (`fix-errors`) → cette porte relancée, puis toutes celles
que la correction peut toucher → suite seulement au vert. Toute modification faite après une porte
verte annule sa preuve : la relancer.

## Points à arbitrer (propriétaire)

- **Porte automatique** : un hook Claude (Stop ou PreToolUse) qui lance `tsc` et ESLint sur les
  fichiers touchés, ou le branchement du `pre-git-typecheck.sh` existant. À peser : latence d'un
  `tsc` complet à chaque arrêt ou commit, réglages suivis (`.claude/settings.json`, valables pour
  toutes les sessions et tous les agents) ou locaux. Mesures et proposition : `quality-gates`. En
  attendant, la règle manuelle de ce skill s'applique.

## Définition de terminé

- [ ] La procédure ci-dessus figure cochée dans le rapport, chaque case adossée à une ligne de
      `verifie` ou de `nonVerifie`.
- [ ] Chaque case de `klikgo-programme` § 7 renvoie à une commande citée ou à une raison écrite.
- [ ] Aucune affirmation de réussite dans le rapport sans sa ligne de preuve.

## Fichiers de référence

- [references/sources.md](references/sources.md) : à lire pour retrouver l'origine d'une règle,
  sa licence, ou les vérifications faites dans le dépôt.
- Commandes détaillées : `testing-strategy` § 4 (unitaires, intégration, E2E) ;
  `klikgo-programme/references/recette-locale.md` (base, build, serveur, session de test) ;
  `klikgo-programme/references/passation-et-rapports.md` (champs du rapport).
- Voisins : `test-discipline` (test qui prouve, interdits pour obtenir le vert), `fix-errors`
  (diagnostiquer une porte rouge), `quality-gates` (portes automatiques), `klikgo-review` (revue),
  agent `klikgo-relecteur`.
