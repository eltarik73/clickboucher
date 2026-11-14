# Passation entre phases et rapports attendus

Chaque rôle écrit son rapport (JSON ou Markdown structuré, mêmes champs) dans le dossier de
travail du chantier (`<work>`, donné par le brief § 9) **avant** de répondre, puis le renvoie
comme réponse finale. Le dossier de travail est hors dépôt (dépôt public : les rapports peuvent
décrire des failles non corrigées). La phase suivante lit le fichier ; elle ne s'appuie jamais
sur un résumé oral.

Les rôles en lecture seule (relecteur, auditeur sécurité) n'ont pas d'outil d'écriture : leur
réponse finale **est** le rapport, et le directeur l'enregistre dans `<work>`. Si aucun dossier
de travail n'a été donné à un rôle, il le dit dans `nonVerifie` et renvoie quand même le rapport
complet en réponse.

## 1. Champs communs à tous les rapports

| Champ                       | Contenu                                                                          |
| --------------------------- | -------------------------------------------------------------------------------- |
| `role`, `chantier`, `tache` | qui, quel chantier, quelle tâche (`<ID>-T3`)                                     |
| `commit`                    | `git rev-parse --short HEAD` au moment du rapport, + `git status --short` résumé |
| `verifie`                   | liste de `{ commande, resultat }` réellement lancés (pas « devrait passer »)     |
| `nonVerifie`                | ce qui n'a pas pu l'être, et pourquoi                                            |
| `ecarts`                    | toute différence avec la spécification, avec la raison                           |
| `besoinsDuChef`             | changement nécessaire hors des fichiers possédés                                 |
| `pointsAArbitrer`           | décision qui revient au propriétaire (§ 8 du manuel)                             |
| `notesPourLaSuite`          | coutures laissées, noms changés, à transmettre aux chantiers suivants            |

## 2. Champs propres à chaque rôle

**Chef de chantier — plan**

- `constatsRevérifiés` : pour chaque constat du brief, un verdict parmi `confirmé`,
  `corrigé entre-temps`, `déplacé` (avec le nouveau fichier:ligne) ou `faux`, avec la preuve.
- `taches` : `id`, `titre`, `profil` (backend, front, plateforme, designer, référenceur), `couche`,
  `fichiersPossedes`, `nouveauxFichiers`, `skillsALire`, `specification`, `criteresAcceptation`
  (dont les tests à écrire), et `tientLeBuild` (oui / non : un seul build à la fois par worktree).
- `fichiersPartages` : chaque modification d'un fichier partagé, sa raison, la tâche qui la fait.
- `risques` et `horsPerimetre`.

**Chef de chantier — revue**

- `verdict` : `accord | corrections`.
- `corrections` : `{ fichier, ligne, probleme, exigence, testAttendu }` ; chaque item est
  reproductible.

**Ingénieur (backend, front, plateforme), designer, référenceur**

- `fichiersModifies`, `fichiersCrees` (rien hors de la liste possédée, sinon c'est une faute).
- `cause` : la cause corrigée, en une ou deux phrases.
- `tests` : fichier, nom du test, **vu rouge** (commande et sortie avant correctif) puis vert.
- `portes` : `tsc`, `eslint` sur ses fichiers, tests concernés, avec résultat ; le build seulement
  si la tâche le lui attribue, sinon noté dans `nonVerifie`.

**Greffier**

- `commit` (sha court), `fichiersCommites` (nombre et liste), `fichiersLaissesDeCote` (inattendus,
  avec la raison), `sortieDuHook` si le commit a échoué. Consigne : `git-et-commits.md` § 5.

**Testeur de recette**

- `environnement` : base, port, commit construit, rôle(s) de test utilisés.
- `criteres` : pour chaque critère du brief, `constaté | écart | non testable`, avec la preuve
  (commande + sortie tronquée, requête SQL de relecture, capture et sa largeur/thème).
- `testsAjoutes` : chemins (la recette n'écrit que des tests et des fichiers de données de test).
- `portes` : `tsc`, `lint`, `test`, `test:integration`, `build`, `check-prerender`.

**Relecteur indépendant**

- `constats`, triés du plus grave au moins grave : `gravite` (`bloquant`, `majeur` ou `mineur`),
  `fichier`, `ligne`, `probleme`, `scenario` (entrées → mauvais résultat), `preuve`,
  `correctionAttendue`.
- `reglesVerifiees` : règles du manuel § 6 et de la DoD § 7 passées en revue, avec la méthode
  (commande `rg`, test rejoué, requête sur le serveur local).
- `verdict` : `feu vert | feu vert sous réserve (mineurs listés) | refus`.
- Le relecteur ne corrige rien ; il ne recopie pas la recette : il rejoue lui-même.

**Auditeur sécurité**

- `perimetre` : commit, fichiers ou routes audités.
- `constats`, triés par gravité : `gravite` (`critique`, `haute`, `moyenne` ou `basse`),
  `categorie`, `fichier`, `ligne`, `scenario` (qui, quelle requête, quel effet), `niveauDePreuve`
  (`reproduit`, `déduit` ou `non vérifié`), `correctionAttendue`, `testAttendu`.
- `controlesSansConstat` : ce qui a été vérifié et tient.
- `verdict` : `feu vert | feu vert sous réserve | refus`.

**Ce qui bloque la fusion** (une seule règle, appliquée par le directeur) :

| Rapport   | Bloque tant que c'est ouvert                                                            | Ne bloque pas                                                           |
| --------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Relecteur | tout constat `bloquant` ou `majeur`                                                     | `mineur` : feu vert sous réserve, listé pour un chantier suivant        |
| Auditeur  | tout constat `critique` ou `haute` dont le niveau de preuve est `reproduit` ou `déduit` | `moyenne`, `basse`, et tout constat `non vérifié` : listés, à instruire |
| Tous      | une décision du § 8 du manuel prise dans le code ; une règle de `CLAUDE.md` enfreinte   | —                                                                       |

Un constat qui bloque se lève par une correction suivie d'un nouveau contrôle. Si le chef conteste
un classement, le directeur tranche par écrit (manuel § 1) ; il ne peut pas lever un constat qui
touche une règle de `CLAUDE.md` ou le § 8 du manuel : celui-là attend une décision écrite du
propriétaire.

## 3. Règles de passation

1. **Plan → réalisation** : chaque ingénieur reçoit sa tâche seule, plus les contrats (types,
   signatures) des tâches de la couche précédente. Il commence par `git status --short` et
   `git diff` sur ses fichiers (une tentative interrompue a pu laisser du travail partiel).
2. **Réalisation → recette** : le greffier commite la couche sur la branche du chantier (commit
   de travail `chore(<id>): travail en cours, couche N (…)`). La recette reconstruit le serveur
   sur ce commit, jamais sur un arbre sale.
3. **Recette → revue du chef** : le chef lit le diff complet (`git diff <base>...HEAD`) **et** la
   recette. Après des corrections, la recette rejoue les critères en échec et ceux touchés par
   les corrections.
4. **Revue → contrôle indépendant** : tout ce que la recette a ajouté est commité avant ; le
   relecteur travaille sur la branche, pas sur l'arbre de travail d'un autre.
5. **Contrôle final → fusion** : le directeur rejoue `tsc`, `lint`, `test`, `test:integration`,
   `build` et `check-prerender` sur la branche à jour de `main`, puis fusionne en squash.
6. **Après fusion** : le directeur vérifie le déploiement Vercel en lecture seule (pages clés en
   200, `x-vercel-error` absent, `check-prerender` respecté), met à jour la note de reprise du
   programme et transmet les `notesPourLaSuite`.
7. **Reprise après coupure** : on relit les rapports présents sur disque ; une tâche dont le
   rapport existe et dont les fichiers sont commités n'est pas refaite ; une tâche sans rapport
   est relancée à partir de son état git.
