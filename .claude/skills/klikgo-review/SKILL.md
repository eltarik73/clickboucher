---
name: klikgo-review
description: >-
  Standard de relecture du code de Klik&Go et protocole de l'audit qualité : ce qui bloque une
  fusion et ce qui reste mineur, deux axes tenus séparés (règles du projet, conformité au brief),
  passes obligatoires (exactitude, périmètre boutique, échecs silencieux, performance, types,
  React, tests probants, complexité et odeurs de code, commentaires), constat avec fichier:ligne,
  règle citée, scénario et preuve, validation contradictoire de chaque constat par un second agent,
  défauts préexistants séparés des régressions, liste de ce qui n'a pas été jugé. À charger pour
  relire un diff, une branche ou une PR, lancer /klikgo-review, mener ou contre-vérifier l'audit
  de pureté du code, ou trier des constats avant correction. Pas pour corriger (relecture en
  lecture seule ; corriger relève de fix-errors ou simplicity-refactoring) ni pour un audit de
  sécurité approfondi (security-multitenant).
when_to_use: >-
  review, relecture, relire, code review, revue de code, revue de PR, audit qualité, audit de
  pureté, pureté du code, avant fusion, avant merge, feu vert, est-ce que c'est bon, tu vois un
  problème, vérifie ce code, constats, gravité, bloquant, majeur, mineur, nit, faux positif,
  préexistant, régression, odeur de code, code smell, catch vide, échec silencieux,
  klikgo-relecteur, /klikgo-review.
---

# Relecture du code Klik&Go — standard et protocole d'audit

Standard unique de relecture : ce qui bloque une fusion, comment un constat se prouve, comment on
écarte les faux positifs. Il sert au relecteur indépendant (`.claude/agents/klikgo-relecteur.md`),
aux relecteurs de l'audit de pureté du code et à `/klikgo-review`, et remplace l'ancien prompt à
six agents. Une relecture est en lecture seule : elle exige, elle ne corrige pas.

**Précédence** : propriétaire, puis `CLAUDE.md` relu sur disque, puis `seo-anti-penalty`, puis les
skills vérifiés du programme, puis ce skill. Un désaccord ne se tranche pas dans un constat : il va
dans « Points à arbitrer » et se signale pour `klikgo-programme/references/contradictions-connues.md`.

**Une seule échelle** : `bloquant`, `majeur`, `mineur` (fiche du relecteur,
`klikgo-programme/references/passation-et-rapports.md`). Ni Critical/High, ni « WILL BREAK », ni
score sur 100 : deux échelles côte à côte brouillent la règle de fusion. L'échelle
`critique`…`basse` reste celle du seul auditeur sécurité.

## 1. Règle d'approbation

- Un changement qui améliore clairement la santé du code s'accepte, même imparfait ; un changement
  qui la dégrade se refuse, même s'il « marche » (Google eng-practices, adapté). Pourquoi : exiger
  la perfection bloque le programme, laisser passer une dégradation recrée la dette que l'audit
  retire.
- Faits et mesures avant préférences. Autorité de style : `CLAUDE.md`, puis les skills vérifiés,
  puis le code voisin. Ce qui n'est écrit nulle part est une préférence : au plus `mineur`.
- « Aucun constat » est un résultat valide, dit avec ce qui a été lu et ce qui ne l'a pas été ; il
  ne prouve pas l'absence de défaut.
- Verdict et règle de fusion : `passation-et-rapports.md` § 2 (`refus` dès qu'un `bloquant` ou un
  `majeur` est ouvert).

## 2. Gravité

| Gravité    | Quand                                                                                                                                                                                                                                                                                                                                                                         | Preuve                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `bloquant` | atteinte à l'argent, la sécurité, les données, la disponibilité ou le coût Vercel ; règle de `CLAUDE.md` qui protège l'un d'eux (Sécurité multi-tenant, Authentification API, Coût CPU Vercel, Test Mode, Stripe, Commandes) ; décision du propriétaire (`klikgo-programme` § 8) prise dans le code                                                                           | entrée atteignable → mauvais résultat, reproduit ou montré pas à pas |
| `majeur`   | `klikgo-programme` § 6 enfreint ; autre règle de `CLAUDE.md` (Code quality, UX & Design, Conventions) ; test qui ne prouve rien, supprimé, sauté ou affaibli ; critère du brief non tenu ; trou de type dangereux (promesse flottante sur une écriture, `any` qui se propage, `as unknown as`) ; règle métier dupliquée qui dérivera ; invariant tenu par la seule convention | ligne et règle citée, ou scénario                                    |
| `mineur`   | le reste, dont au plus deux remarques de style par relecture                                                                                                                                                                                                                                                                                                                  | ligne et raison                                                      |

- Sans entrée atteignable ni conséquence, jamais `bloquant` ; un constat `plausible` (§ 8) non plus.
- Une course n'est retenue que si l'entrelacement est écrit pas à pas, fichier:ligne par
  fichier:ligne (A lit, B lit, A écrit, B écrit). Sinon : rejetée, c'est le faux positif le plus
  fréquent des relectures automatiques.
- Une odeur (§ 6) est `mineur`, sauf si elle copie une règle métier ou éparpille une autorité
  unique : `majeur`.

## 3. Deux axes, deux agents à contexte neuf

- **Règles** : `CLAUDE.md` et les skills, règle citée mot pour mot avec sa section, par exemple
  « TOUTE requête Prisma sur des données métier DOIT être scopée par `shopId` » (`CLAUDE.md`,
  Sécurité multi-tenant). Une règle qu'on ne peut pas citer devient une odeur ou disparaît.
- **Brief** : critères d'acceptation du brief et spécification ; pour chacun, tenu, partiel ou
  absent, ligne du brief citée ; plus ce que le diff fait sans qu'on l'ait demandé
  (`klikgo-programme` § 6 règle 10). Sans brief : intention des messages de commit, et « brief
  absent » dans `nonVerifie`. En audit : le contrat documenté du module (section de `CLAUDE.md`,
  skill de domaine).
- Les deux listes restent séparées, jamais fusionnées ni reclassées l'une contre l'autre : un code
  conforme qui fait la mauvaise chose, ou l'inverse, ne se cache pas derrière l'autre axe
  (mattpocock `code-review`).

## 4. Passes obligatoires (dans cet ordre)

Chaque passe renvoie à son skill. Une passe non faite va dans `nonJuge` avec sa raison.

1. **Conception et placement** : `architecture-conventions` § 1–4 (`check-boundaries.mjs`, § 3).
2. **Exactitude** : 0 centime, liste vide, `null`, heure de Paris (`src/lib/paris-time.ts`), clés
   de jour françaises (`getDayHours`), rejeu d'`idempotencyKey`, double clic, bornes (99 portions,
   50 000 g), commande d'avant le chantier 0 (`serviceFeeCents` jamais encaissés).
3. **Périmètre boutique et auth** : tout identifiant fourni par l'appelant se résout avec
   `where: { id, shopId }` (`security-multitenant` § 2, règles 1–2) ; le garde d'une écriture
   tourne dans la même transaction ou dans son `where` (modèle : `transitionOrderInTx`,
   `src/lib/services/orders/transition.ts`) ; aucune colonne possédée par le serveur lue dans
   l'entrée. Liste complète : `security-multitenant` § 7.
4. **Échecs silencieux** : § 5.
5. **Performance** : requête Prisma dans un `map`, un `for` ou un `Promise.all`, `findMany` sans
   `take`, `await` indépendants en série, nouveau `where`/`orderBy` sans index, appel API au
   montage pour un anonyme, `setInterval` nu, `new Date()` dans le rendu d'une page ISR
   (`vercel-cost-performance` § 3, `prisma-expert`). Coût écrit en volume : « une requête par
   ligne : 30 lignes, 31 requêtes ».
6. **Types** : `typescript-patterns`.
7. **React** : `react-patterns`.
8. **Tests** : `test-discipline` ; ce test échouerait-il si le code était cassé ? Lire les tests à
   part ; un test supprimé, sauté ou affaibli est `majeur`.
9. **Complexité et odeurs** : § 6, `simplicity-refactoring`.
10. **Commentaires** : narration du changement, numéro de ticket ou de chantier, code commenté,
    `TODO` (`typescript-patterns` § 10, `klikgo-programme` § 6 règle 5).
11. **Un correctif nomme ses copies** : chercher le même prédicat ou littéral dans tout `src`,
    sortie jamais tronquée. Défaut corrigé dans une copie sur N : `majeur`.

## 5. Passe « échecs silencieux »

Politique : `reliability-observability` § 2 et `klikgo-programme` § 6 règles 2–4. Chercher
`catch {}`, `.catch(() => {})`, un `catch` qui journalise et continue sans raison écrite, une
valeur par défaut sur erreur (`return []`, `?? []`, `?? 0`), un chaînage optionnel qui saute une
étape obligatoire, un repli vers des données factices, un transport qui renvoie `true` sans avoir
envoyé, une promesse sans `await` dans une fonction Vercel (l'instance peut être gelée après la
réponse : `order-lifecycle-realtime/references/etat-du-code.md`, E4). Pour chaque `catch` large,
lister ce qu'il peut avaler (base injoignable, `P2002`, `ZodError`, bogue).

| Ce qui est avalé                                                                                                    | Gravité    |
| ------------------------------------------------------------------------------------------------------------------- | ---------- |
| écriture métier (commande, statut, prix, stock, remise)                                                             | `bloquant` |
| erreur changée en valeur par défaut dans une page prérendue ou ISR (liste vide, `noindex` figés dans le cache)      | `bloquant` |
| notification après mutation réussie, sans `logger.error` portant `orderId` ou `shopId` ; faux succès d'un transport | `majeur`   |
| cache Redis sans `logger.warn`                                                                                      | `mineur`   |
| repli permis par la politique, raison écrite (les `catch {}` commentés de `src/lib/logger.ts` et `handleApiError`)  | aucun      |

Ne jamais demander de retirer le `try/catch` d'un route handler (`CLAUDE.md`, avec `handleApiError`
de `src/lib/api/errors.ts`) : demander qu'il ne masque rien. Un `?? []` sur un champ facultatif
n'est un constat que si la valeur par défaut a l'air d'une donnée (`TRANSITIONS[status] ?? []`,
`src/lib/order-state-machine.ts`, refuse toute transition : voulu). Départ :
`reliability-observability/scripts/audit-catches.py`. Passe adaptée de `silent-failure-hunter`
(Anthropic), références internes remplacées par `logger.ts`, Sentry et `handleApiError`.

## 6. Odeurs de code : un jugement, jamais une règle

Base (Fowler, _Refactoring_, ch. 3) : code dupliqué, généralité spéculative, intermédiaire inutile,
obsession des primitifs, chirurgie au fusil, changement divergent, envie de fonctionnalité, groupes
de données, switch répétés, nom mystérieux, fonction longue. Une règle du dépôt l'emporte ; ce
qu'un outil impose est sauté. Exemples réels : [references/odeurs-de-code.md](references/odeurs-de-code.md).

- Écrire « odeur possible : … », jamais « violation ».
- Un constat de complexité montre l'alternative plus simple et dit si le remaniement retire des
  concepts à tenir en tête ou les déplace ; s'il les déplace, pas de constat (addyosmani).
- La mauvaise abstraction coûte plus cher que la duplication (Sandi Metz), sauf pour une règle
  métier (prix, statut, heure, horaires, auth) : une seule autorité (`architecture-conventions` § 1).

## 7. Ne pas signaler

- Ce qu'ESLint, `tsc`, Prettier, lint-staged ou la CI imposent (liste : `quality-gates` § 6).
  `.eslintrc.json` désactive `@typescript-eslint/no-explicit-any` et `no-unused-vars` : un `any`
  sans justification reste un constat (`CLAUDE.md`, Code quality).
- « Ajouter des tests » ou « gérer les erreurs » sans scénario ; les préférences (`type` contre
  `interface`, ordre des imports).
- Une règle réduite au silence avec sa raison écrite (`eslint-disable` suivi du pourquoi).
- Les conventions du framework et du dépôt : `export default` des `page`, `layout`, `error`,
  `loading`, `not-found` ; composants en PascalCase, modules de `src/lib` en kebab-case (écart
  connu, contradictions-connues § 2) ; `<img>` natif d'`OfferPopup`.
- **Préexistant** : en relecture de diff, un défaut hors des lignes touchées va dans une section
  `préexistant` et ne bloque pas, sauf si le diff l'aggrave ou le rend atteignable. En audit de
  tout le code, il est la cible, marqué `préexistant`.

## Pièges

- Règles importées qui signalent du code correct ici : « pas d'export par défaut » (Google),
  kebab-case partout (bulletproof-react), « éviter les try/catch » (code-simplifier), mocks de
  Prisma (Formbricks), « préexistant = faux positif » (`/code-review` d'Anthropic, faux en audit),
  « tout catch vide est critique » (silent-failure-hunter), « valider à chaque couche » (ici : Zod
  à la frontière, l'invariant dans le seul service qui le possède).
- Résultats de recherche textuelle pris pour des faits : `findUnique({ where: { id } })` après une
  écriture scopée (§ 8), `?? []` sur un champ facultatif, `|| 0` (inoffensif : le défaut réel est
  un repli non nul, `quantity || 1`, quand 0 est légitime).
- Nombres recopiés d'un skill comme s'ils étaient du jour : l'arbre bouge, re-mesurer.
- `vitest run` nu lance aussi l'intégration et exige une base : `npm run test` puis
  `npm run test:integration` (`CLAUDE.md`, Tests).
- Deux `npm run build` en même temps dans un worktree (`.next` partagé, `klikgo-programme` § 5).
- Valeur attendue d'un test remplacée par la valeur obtenue, sans explication : lire le diff des
  tests en premier.

## 8. Validation contradictoire de chaque constat

1. Reformuler le constat en une phrase : fichier:ligne, entrée, mauvais résultat, règle. Beaucoup
   tombent ici.
2. Un second agent à contexte neuf essaie de le **réfuter** : appelants, gardes en amont, tests ;
   commande qui n'écrit rien ; rejeu sur la recette locale (`klikgo-programme/references/recette-locale.md`).
3. Il rend `confirmé`, `plausible` ou `rejeté`. `rejeté` sort du rapport (compté seulement) ;
   `plausible` n'est jamais `bloquant` et dit ce qui le confirmerait.

Pourquoi : les modèles sur-détectent et surestiment la gravité (Trail of Bits `fp-check`, idée
reprise) ; un relecteur sommé de trouver des problèmes en trouve toujours, et tout corriger ajoute
des couches inutiles (documentation Claude Code). Faux positif réel : `transitionOrderInTx` relit
la commande par `findUniqueOrThrow({ where: { id: input.orderId } })` sans `shopId`, mais juste
avant, dans la même transaction, un `updateMany` portant la portée de l'appelant a vérifié
`count === 1` : `rejeté`.

## 9. Rapport

Champs du relecteur (`passation-et-rapports.md` § 2) ; chaque constat porte en plus `axe`,
`regle` (citation et section) ou `odeur`, `validation` et `origine` (régression ou préexistant).
Deux champs s'ajoutent : `nonJuge` (zones laissées de côté, avec la raison) et
`auditAvantConclusion` (fichiers lus en entier, passes faites sans constat, zones non vérifiées ;
getsentry `find-bugs`). Constats d'une même cause regroupés ; ni félicitations ni résumé du diff.
Schéma : [references/protocole-audit.md](references/protocole-audit.md) § 5.

## 10. `/klikgo-review` et mode audit

1. Base : l'argument, sinon `git merge-base HEAD main`. Base introuvable ou diff vide : s'arrêter
   et le dire. Relire `CLAUDE.md` sur disque et le brief s'il existe.
2. Quatre relecteurs en parallèle, contexte neuf, outils en lecture seule (Read, Grep, Glob ; Bash
   pour des commandes qui n'écrivent rien) : R1 passes 1, 3, 4, 5 et R2 passes 6 à 10 (axe
   règles) ; R3 passes 2 et 11, R4 axe brief. Leur coller le texte des passes : un sous-agent ne
   charge pas un skill de façon fiable. Gabarits : `protocole-audit.md` § 2.
3. Un validateur par constat (§ 8), puis le filtre de gravité (§ 2, § 7).
4. Sortie dans le terminal seulement, jamais en commentaire GitHub : dépôt public, et un constat
   peut décrire une faille ouverte (`klikgo-programme` § 8). Le greffon
   `.claude/plugins/klikgo-code-review/` (`--comment`, `--inline`) est remplacé : ne pas l'utiliser.

Mode audit : découper par répertoire (`protocole-audit.md` § 3) ; partir des comptes datés de
`quality-gates` (`references/etat-du-code.md`) et des scripts en lecture seule des skills vérifiés,
re-mesurés avant d'être cités ; classer par rayon d'impact (nombre d'appelants) ; un constat
mécanique répété devient **une** proposition d'outil (règle ESLint, test de garde comme
`tests/lib/order-writers-guard.test.ts`), pas N constats ; jamais de réécriture d'ensemble ;
rapports hors dépôt, dans le dossier de travail.

## Points à arbitrer (propriétaire)

1. Supprimer `.claude/plugins/klikgo-code-review/` : remplacé, il publie sur GitHub et déclare une
   seconde commande `/klikgo-review`.
2. Règles de `CLAUDE.md` classées `bloquant` (argent, sécurité, données, disponibilité, coût) ou
   `majeur` (qualité) ; les deux bloquent la fusion. À reporter dans la fiche `klikgo-relecteur`
   si le propriétaire l'accepte.
3. Constats mécaniques les plus répétés de l'audit à transformer en portes : une décision par
   porte, préparée selon `quality-gates`.

## Définition de terminé (d'une relecture)

- [ ] Base fixée ; diff lu en entier ; code autour de chaque changement lu.
- [ ] Deux axes rendus séparément ; onze passes faites ou listées dans `nonJuge`.
- [ ] Chaque constat : fichier:ligne, règle citée ou odeur, scénario, preuve, validation par un
      second agent ; `rejeté` retirés ; `préexistant` et `régression` distingués.
- [ ] Portes rejouées soi-même (commande et résultat) ou listées dans `nonVerifie`.
- [ ] `nonJuge`, `nonVerifie`, `auditAvantConclusion` remplis ; rien écrit dans le dépôt, rien
      publié.

## Fichiers de référence

- [references/protocole-audit.md](references/protocole-audit.md) — avant de lancer
  `/klikgo-review` ou l'audit : gabarits des relecteurs et du validateur, découpage par
  répertoire, recherches et outils en lecture seule, schéma du rapport.
- [references/odeurs-de-code.md](references/odeurs-de-code.md) — pendant la passe 9 ou avant de
  classer une odeur : exemples réels de Klik&Go et mouvement correctif.
- [references/sources.md](references/sources.md) — avant de citer ou d'adapter une source.
