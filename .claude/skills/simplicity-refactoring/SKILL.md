---
name: simplicity-refactoring
description: Discipline de simplicité et de refactoring sûr pour Klik&Go. Écrire le plus petit changement complet (chaque ligne liée au brief, réutiliser l'autorité existante avant d'écrire, aucune abstraction à un seul appelant, aucune option ni compatibilité non demandée, liste de ce qu'on ne coupe jamais), puis simplifier l'existant sans changer son comportement (structure et comportement dans des couches séparées, un mouvement de refactoring nommé à la fois, tests inchangés et verts entre chaque pas, mauvaise abstraction réintégrée puis réextraite, test de suppression des intermédiaires, seuils de complexité pris comme signaux). À charger avant d'implémenter une demande, et avant de nettoyer, simplifier, dédupliquer ou refactorer du code. Pas pour savoir où placer un fichier ni découper une page géante (architecture-conventions), ni pour corriger un bug (fix-errors).
when_to_use: simplifier, simplification, refactor, refactoring, nettoyer, nettoyage, dette technique, sur-ingénierie, over-engineering, YAGNI, trop compliqué, dupliqué, doublon, helper, wrapper, abstraction, fonction trop longue, complexité, imbrication, ternaire imbriqué, paramètre booléen, code mort, extraire une fonction, renommer, fmtPrice recopié, pendant que j'y suis.
---

# Simplicité et refactoring sûr — Klik&Go

Deux moments créent ou retirent de la complexité. **Écrire** (§ 1-2) : le plus petit changement
complet. **Nettoyer** (§ 3-6) : changer la structure sans changer le comportement. Restent dans
`architecture-conventions`, à lire et non à recopier : où placer le code, le plan des pages
géantes (§ 7), le gabarit de caractérisation, l'étrangleur et la branche par abstraction (§ 8 et
son `references/refactoring-incremental.md`). Les règles contre le rafistolage
(`klikgo-programme` § 6) s'appliquent toutes.

Précédence : `CLAUDE.md` > `seo-anti-penalty` > skills vérifiés du programme > ce skill. Un
désaccord va dans « Points à arbitrer (propriétaire) » et est signalé pour
`klikgo-programme/references/contradictions-connues.md`, jamais tranché dans le code.

## 1. Écrire : le plus petit changement complet

- **Avant d'écrire, lister tout ce que le changement doit atteindre** : appelants, tests, fabriques
  (`tests/integration/helpers/factories.ts`), exports, schémas Zod (`src/lib/validators/`), types,
  `references/etat-du-code.md` des skills touchés. Recherche complète (`grep -rn … src tests`),
  jamais tronquée par `| head` : un appelant manqué rend le changement incomplet.
- **Échelle de décision, le premier « oui » gagne** :
  1. Le brief n'en a pas besoin → ne pas l'écrire (un manque réel va dans `besoinsDuChef`).
  2. Le dépôt l'a déjà → l'importer depuis l'autorité unique :

     | Besoin                                       | Autorité                                                                                                                                                                                                                   |
     | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
     | prix de ligne, prix unitaire, remise, totaux | `src/lib/pricing/` (`line.ts`, `resolveUnitPrice` de `unit-price.ts`, `discount.ts`, `totals.ts`)                                                                                                                          |
     | poids et quantités affichés                  | `formatGrams`, `formatStoredLineQuantity` (`pricing/format.ts`)                                                                                                                                                            |
     | montant en euros                             | `formatPrice` (`src/lib/utils.ts`) ; format canonique en arbitrage (`architecture-conventions` § 10 n° 5). Jamais de copie locale ; une variante exigée par le brief va à côté, nommée et testée, sans paramètre d'options |
     | nom `Prénom.N`                               | `formatClientName` (`src/lib/format-kitchen.ts`)                                                                                                                                                                           |
     | numéro de commande ou de client              | `src/lib/order-number-format.ts`                                                                                                                                                                                           |
     | heure de Paris, horaires                     | `src/lib/paris-time.ts`, `getDayHours` (`src/lib/shop-hours.ts`)                                                                                                                                                           |
     | réponse et erreur d'API                      | `apiSuccess`, `apiError`, `handleApiError` (`src/lib/api/errors.ts`)                                                                                                                                                       |

  3. Next.js 14, React 18 ou la plateforme le font → s'en servir.
  4. Une dépendance déjà dans `package.json` le fait → l'utiliser. Une dépendance nouvelle sort du
     plan (`klikgo-programme` § 6 règle 11).
  5. Une ligne lisible suffit → une ligne, pas un helper.
  6. Sinon, le minimum de code nouveau, avec son test (`CLAUDE.md` § Tests).

- **Aucune abstraction, option, configuration, paramètre générique ni interface pour un seul
  appelant.** Visé : le paramètre `options` que personne ne passe, le `<T>` instancié une fois,
  l'adaptateur sans second adaptateur. Pas visé : une fonction nommée extraite pour respecter la
  frontière route → service (`architecture-conventions` § 4) ou pour être testée ; c'est un nom.
- **Aucun chemin de compatibilité ni repli que le brief ne demande pas.** S'il semble nécessaire
  (données déjà en base, ancien format), l'écrire en Points à arbitrer avec le cas qui l'exige. Les
  compatibilités déjà documentées restent (anciens numéros `KG-2026-NNNNN`, `serviceFeeCents = 99`
  des commandes d'avant le chantier 0, `CLAUDE.md`).
- **Chaque ligne modifiée se rattache au brief** : ni reformatage, ni renommage, ni « amélioration »
  du code voisin. Code mort aperçu : le signaler (`besoinsDuChef`) ; supprimer seulement ce que son
  propre changement a rendu orphelin, sauf si le brief est un nettoyage.

Pourquoi : la fonctionnalité non demandée est un signal de dérive d'agent (Kent Beck) et une
plainte récurrente des praticiens sur le code d'agent ; ici, des dizaines de copies locales de
`formatPrice` / `fmtPrice` (etat-du-code.md) viennent d'écrans qui ont réécrit au lieu d'importer.

## 2. Ce qu'on ne coupe jamais au nom de la simplicité

Validation Zod aux frontières ; périmètre `shopId` ; helpers d'auth (`getServerUserId`,
`getAuthenticatedBoucher`, `requireAdmin`) ; `try/catch` + `handleApiError` dans chaque route
handler ; gestion d'erreur qui évite une perte de données ou un échec silencieux
(`reliability-observability` § 2) ; idempotence (`idempotencyKey`, `updateMany` conditionnel de
`transition.ts`) ; accessibilité (cibles de 44 px, libellés : `accessibility-wcag`) ; mode sombre ;
tests. Le code déplacé garde sa validation et sa gestion d'erreurs à l'identique. Une limite
connue va dans le rapport, jamais en commentaire `TODO` ou « shortcut » (`klikgo-programme` § 6
règle 5). Pourquoi : des praticiens ont vu une consigne « écris moins de code » faire disparaître
la validation ; « simple » veut dire moins de concepts, pas moins de garde-fous.

## 3. Refactorer : comportement constant

- **Structure ou comportement, jamais les deux dans un commit** (Kent Beck ; les « deux
  casquettes » de Fowler). Seul le greffier commite, par couche (`klikgo-programme` § 9) : refactor
  et changement de comportement sont donc deux tâches dans deux couches, structure d'abord, et
  jamais un refactor glissé dans un correctif (§ 6 règle 10). Le rapport nomme les mouvements pour
  le corps du commit `refactor(portée): …`.
- **Comprendre pourquoi le code existe avant de l'enlever** : `git log -p -S '<symbole>'`,
  appelants (recherche complète, `vi.mock("@/…")` compris), tests, `CLAUDE.md`. Supprimer au lieu
  de comprendre est un symptôme relevé chez les agents (arXiv 2603.27249).
- **Code non testé : caractérisation d'abord** (gabarit `architecture-conventions`
  `references/refactoring-incremental.md` § 3 ; intégration sur base réelle dès que Prisma est
  touché ; règles du test : `test-discipline` § 1). Un comportement surprenant reste figé tel quel
  et va en Points à arbitrer ; le corriger est un autre brief (`fix-errors`).
- **Un mouvement nommé à la fois** (catalogue : [references/mouvements.md](references/mouvements.md)),
  puis tests ciblés et `npx tsc --noEmit`. Rouge : annuler le pas, pas le rafistoler.
- **Les tests existants passent sans être modifiés.** Seules exceptions, dues au mouvement
  lui-même : un chemin d'import ou de `vi.mock`, une entrée de chemin dans une liste fermée de test
  de garde (`tests/lib/order-writers-guard.test.ts`). Toute autre retouche de test (assertion,
  valeur attendue, données) prouve un changement de comportement : arrêter, séparer, justifier.

## 4. Mauvaise abstraction et test de suppression

- **Code incident** (balisage, classes Tailwind, petite mise en forme d'écran) : une duplication
  vaut mieux qu'une mauvaise abstraction (Sandi Metz, Kent C. Dodds).
- **Helper qui accumule drapeaux et conditions** : le réintégrer chez chaque appelant, retirer
  chez chacun les branches qu'il n'emprunte pas, puis réextraire seulement ce qui reste commun
  (mouvements.md § 10). Signal : un booléen qui choisit une branche, un paramètre qu'un seul
  appelant passe.
- **Test de suppression** : imaginer l'intermédiaire supprimé et son corps recopié chez ses
  appelants. Si le code devient plus simple, le supprimer (fonction qui renomme et transmet,
  adaptateur unique d'une couture hypothétique). Si la complexité réapparaît chez chaque appelant,
  il gagne sa place : `quoteOrder` retire les données internes de `prepareOrder`,
  `cartLineTotalCents` lie le prix de la ligne à `lineTotalCents`.
- **Modules profonds** : petite interface, vraie logique derrière. Modèle : `resolveUnitPrice(product,
{ isPro, cutOption, now })` cache prix pro, découpe et promotion.
- **Exception ferme** : une règle métier (prix, statut, heure, horaires, auth) n'est jamais
  dupliquée, même « pour l'affichage » : une seule autorité (`architecture-conventions` § 1,
  `klikgo-programme` § 6 règle 7). En relecture, une odeur reste un jugement (`klikgo-review` § 6).

## 5. Signaux de complexité, pas des portes

| Signal                          | Seuil              | Détecté par                                             | Mouvement probable            |
| ------------------------------- | ------------------ | ------------------------------------------------------- | ----------------------------- |
| complexité cyclomatique         | > 15               | ESLint `complexity`                                     | Split Phase, Extract Function |
| imbrication                     | > 3 niveaux        | `max-depth`                                             | clauses de garde              |
| paramètres positionnels         | > 3                | `max-params`                                            | Introduce Parameter Object    |
| longueur de fonction            | ≈ 50 lignes utiles | `max-lines-per-function` (faible pour un composant JSX) | Extract Function              |
| booléen qui choisit une branche | 1                  | relecture                                               | Remove Flag Argument          |
| ternaire imbriqué               | 1                  | `no-nested-ternary`                                     | clauses de garde, table       |
| `useState` dans un composant    | ≥ 8                | `architecture-conventions` § 6                          | reducer, hook nommé           |

La taille de fichier n'est pas un signal mais une règle : moins de 300 lignes (`CLAUDE.md`), un
fichier déjà au-dessus ne grossit pas (`architecture-conventions` § 6). Viser moins de concepts,
pas moins de lignes : pas de `reduce` dense sur une ligne, pas de ternaire qui demande une pause.

Lancer depuis la racine du dépôt, en lecture seule, sur les fichiers touchés avant et après le
changement ; le nombre de signaux ne monte pas :

```bash
node_modules/.bin/eslint --no-eslintrc --no-inline-config --parser @typescript-eslint/parser \
  --rule '{"complexity":["warn",15],"max-depth":["warn",3],"max-params":["warn",3],"no-nested-ternary":"warn","max-lines-per-function":["warn",{"max":50,"skipBlankLines":true,"skipComments":true}]}' \
  -f unix <fichiers>
```

Comptes du jour : [references/etat-du-code.md](references/etat-du-code.md) ; référence globale de
l'audit et décision d'en faire des règles ESLint : `quality-gates`.

## 6. Changements mécaniques sur beaucoup de fichiers

- Découper par dossier en petites couches : environ 100 lignes significatives et un seul objet
  chacune (Google, « small CLs »).
- Pas de `--fix` en masse d'une règle qui change le comportement. `||` → `??` change le résultat
  quand la valeur peut valoir `""` ou `0` : `parseFloat(priceCents || "0")`
  (`boucher/produits/ProductForm.tsx`) donne `0` pour un champ vide, `NaN` avec `??`. Le code
  neuf écrit `??` (`typescript-patterns` § 4) ; convertir l'existant est un correctif, pas un
  refactor.
- Avant d'éditer un fichier, `node_modules/.bin/prettier --check <fichier>`. Le `pre-commit` lance
  `prettier --write` et `eslint --fix --max-warnings=0` sur tout fichier indexé : sur un fichier
  non formaté, une ligne changée devient un diff de fichier entier. Si le contrôle échoue, le
  signaler au chef (`besoinsDuChef`) pour une couche de reformatage seule, avant la sienne.

## Pièges

- **« Pendant que j'y suis »** : un renommage ou une extraction dans un correctif. Refusé par le
  relecteur (`klikgo-programme` § 6 règle 10) ; le noter en `besoinsDuChef`.
- **Copie locale d'une autorité** : `fmtPrice` recopié dans `ProductCard.tsx`,
  `ShopProductsClient.tsx`, `PriceAdjustModal.tsx`… Toujours chercher l'existant avant d'écrire ;
  remplacer une copie existante demande d'abord une preuve d'équivalence (mouvements.md § 11).
- **Règle métier recopiée pour l'écran** : `computeDisplayTier` (`components/boucher/PriceAdjustModal.tsx`)
  refait `computeTier` (`src/lib/price-adjustment.ts`) avec les seuils par défaut, alors que le
  serveur décide avec ceux de `getPriceAdjConfig` : un seuil modifié, et l'écran annonce un autre
  palier que celui appliqué. À traiter par un brief dédié, pas en passant.
- **Supprimer du code appelé par convention** (aucun importeur ne veut pas dire mort) : exports de
  `page`, `layout`, `route`, `error`, `loading` ; `revalidate`, `dynamic`, `generateMetadata`,
  `generateStaticParams` (le `return []` de `(client)/recettes/[slug]/page.tsx` active l'ISR,
  `CLAUDE.md` § Coût CPU Vercel) ; `config` de `src/middleware.ts` ; `src/instrumentation.ts` ;
  `sentry.client.config.ts` (injecté par le webpack de `@sentry/nextjs`) ; `sentry.edge.config.ts`,
  sans importeur mais gardé exprès (commentaire de `src/instrumentation.ts`) ; `robots.ts`,
  `sitemap.ts`, `opengraph-image.tsx` ; routes listées dans `vercel.json` (et `api/cron/recipes`,
  retirée du calendrier mais gardée pour son rétablissement, `CLAUDE.md`) ; `scripts/` appelés par
  `package.json` et la CI ; code utilisé par les seuls tests.
- **Retirer un garde-fou « inutile »** : `(isLoaded && isSignedIn) || hasTestModeCookie()` avant un
  appel, `prefetch={false}`, le `<img>` natif d'`OfferPopup` : chacun évite un problème décrit
  dans `CLAUDE.md` (coût CPU Vercel, 400 sur les images externes).
- **Intermédiaire en zone d'auth** : `isTestMode()` (`src/lib/auth/test-auth.ts`) ne fait que
  transmettre à `isTestModeEnabled()`, mais `CLAUDE.md` § Test Mode le nomme : jamais supprimé en
  passant ; un brief à part, avec audit de sécurité.
- **Renommer, déplacer et modifier dans le même commit** : git perd le renommage et la relecture
  devient impossible (`architecture-conventions` `references/refactoring-incremental.md` § 5).
- **Règles importées qui contredisent le dépôt** : « éviter `try/catch` » (`CLAUDE.md` l'exige
  dans chaque handler), « préférer `function` », « corriger tout de suite hors brief », « valider
  à chaque couche », « supprimer le code écrit avant son test » : écartées, raisons dans
  [references/sources.md](references/sources.md) § 2.

## Procédure : refactoring (copier et cocher)

- [ ] Objet unique écrit en une phrase ; aucun changement de comportement prévu.
- [ ] Raison d'être du code comprise (historique, appelants complets, tests, `CLAUDE.md`).
- [ ] Caractérisation présente ou ajoutée, verte avant le premier mouvement.
- [ ] `prettier --check` et signaux du § 5 relevés sur les fichiers touchés.
- [ ] Mouvements listés dans l'ordre (mouvements.md).
- [ ] Après **chaque** mouvement : tests ciblés (forme de `testing-strategy` § 4, intégration si
      Prisma) et `npx tsc --noEmit` verts ; sinon annuler le pas.
- [ ] `git diff -- '*.test.ts' '*.test.tsx'` relu : hors nouveaux tests de caractérisation, seules
      des lignes d'import, de `vi.mock` ou de liste de garde ont changé.
- [ ] Signaux après ≤ signaux avant.
- [ ] Portes complètes de `klikgo-programme` § 7 (preuves : `verification-before-done` § 2).
- [ ] Diff relu en entier, chaque bloc : même sortie, mêmes erreurs, mêmes effets, même ordre ?

## Points à arbitrer (propriétaire)

1. **Reformatage Prettier du dépôt** : une large part de `src/` échoue à `prettier --check`
   (etat-du-code.md). Un seul commit `style` (avec `.git-blame-ignore-revs`) ou fichier par
   fichier ? En attendant : fichier par fichier, dans une couche à part.
2. **Signaux du § 5 en règles ESLint** (avertissement sur le code neuf) : décision portée par
   `quality-gates`. En attendant : la commande du § 5, sans porte.
3. Rappels déjà ouverts ailleurs : format monétaire canonique et détection du code mort par `knip`
   (`architecture-conventions` § 10 n° 5 et 6).

## Définition de terminé

- [ ] Chaque ligne modifiée se rattache au brief ; aucune copie d'une autorité (recherche citée).
- [ ] Aucune abstraction, option ni compatibilité non demandée ; liste du § 2 intacte, code déplacé compris.
- [ ] Signaux du § 5 pas pires sur les fichiers touchés (sorties avant et après au rapport).
- [ ] Refactor : couche à part, procédure ci-dessus cochée, mouvements nommés dans le rapport.
- [ ] Orphelins de son propre changement supprimés ; autre code mort signalé, pas supprimé.
- [ ] Portes de `klikgo-programme` § 7 vertes ; ce qui n'a pas pu être vérifié est dans `nonVerifie`.

## Fichiers de référence

- [references/mouvements.md](references/mouvements.md) — lire avant d'appliquer un mouvement :
  quand, étapes, avant/après en TypeScript Klik&Go, vérification.
- [references/etat-du-code.md](references/etat-du-code.md) — lire avant de citer un compte ;
  commandes pour le remesurer.
- [references/sources.md](references/sources.md) — lire pour l'origine d'une règle ou sa licence.
- `architecture-conventions` : `references/refactoring-incremental.md` (caractérisation,
  étrangleur, déplacement) et `references/decoupage.md` (pages géantes) — lire avant tout découpage.
