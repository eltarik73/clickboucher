# Refactorer sans réécrire

## 1. Pourquoi pas de réécriture

Fowler (2024) : les remplacements d'un bloc échouent souvent — longs, comportement existant mal
spécifié, une partie de ce comportement n'est même plus voulue ; le remplacement progressif livre
de la valeur plus tôt et réduit le risque, au prix d'une architecture transitoire jetable qu'il
faut accepter de construire [S11]. Shopify a réorganisé un monolithe de plus de 2,8 millions de lignes
par composants, sans le découper en services, et note qu'un grand refactor reste longtemps
inachevé : il faut choisir l'état intermédiaire le plus utile et séquencer [S9][S19]. Le chantier 0
de Klik&Go (en cours, non commité au 2026-11-14) suit ce schéma pour le statut des commandes : une
seule fonction l'écrit, un test de garde verrouille.

## 2. La séquence

1. **Choisir la couture** : l'endroit où l'on peut changer le comportement sans éditer l'appelant —
   une fonction, un hook, une route [S16]. Dans ce dépôt : une fonction de `src/lib`, un handler,
   un hook.
2. **Caractériser** ce qui passe par la couture (§ 3). Le test fige le comportement *actuel*, bugs
   compris ; une correction de bug est une PR à part, qui modifie le test en connaissance de cause
   [S17].
3. **Préparer** : refactor à comportement constant pour que le changement devienne simple (« make
   the change easy, then make the easy change », K. Beck, cité par Fowler [S20]).
4. **Brancher par abstraction** : la nouvelle fonction existe à côté de l'ancienne ; les appelants
   passent un par un ; l'application compile et se déploie à chaque étape [S14].
5. **Verrouiller** : test de garde ou zone ESLint qui interdit le retour à l'ancien chemin (§ 4).
6. **Supprimer** l'ancien chemin quand il n'a plus d'importeur (`grep`, `tsc`, build CI).

Taille : une PR = un objet. Cal.com vise < 500 lignes et < 10 fichiers de code, et sépare
refactor préparatoire et fonctionnalité [S5]. Une PR « déplacement » ne change aucune ligne de
logique (relecture par diff de renommage).

## 3. Gabarit de test de caractérisation (exécuté)

Exemple réel : avant de fusionner les formateurs de prix (`utils.formatPrice`,
`format-kitchen.formatPriceCents`, copies locales). Lancé le 2026-11-14 avec Vitest 4.1.5 :
8 tests verts, instantané écrit par Vitest au premier passage [L8].

```ts
// @vitest-environment node
// src/lib/__tests__/format-price-characterization.test.ts
import { describe, expect, it } from "vitest";
import { formatPrice } from "@/lib/utils";
import { formatPriceCents } from "@/lib/format-kitchen";

const SAMPLES = [0, 1, 99, 100, 1050, 123456, -250];

describe("formatage des prix — caractérisation avant fusion", () => {
  it.each(SAMPLES)("formatPriceCents(%i) === formatPrice(%i)", (cents) => {
    expect(formatPriceCents(cents)).toBe(formatPrice(cents));
  });

  it("fige la sortie actuelle", () => {
    expect(SAMPLES.map(formatPrice)).toMatchInlineSnapshot(`
      [
        "0,00 €",
        "0,01 €",
        "0,99 €",
        "1,00 €",
        "10,50 €",
        "1234,56 €",
        "-2,50 €",
      ]
    `);
  });
});
```

Ce que le test a révélé : « 1234,56 € » (pas de séparateur de milliers), alors que les 7 écrans qui
utilisent `Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })` affichent
« 1 234,56 € » (Node 22, vérifié). Attention, `Intl` y met une espace fine insécable (U+202F) entre
les milliers et une espace insécable (U+00A0) avant « € » : une comparaison avec une espace
ordinaire échoue. Choisir le format canonique est une décision (SKILL § 10 n° 5) ; le test rend
l'écart visible au lieu de le changer en silence.

Règles :
- Première exécution : écrire `toMatchInlineSnapshot()` sans argument, lancer
  `npm run test -- <fichier>` en local, **relire** l'instantané écrit, committer. En CI (variable
  `CI`), Vitest n'écrit aucun instantané : un instantané absent y fait échouer le test [L8].
- Neutraliser seulement ce qui varie à chaque exécution (date, identifiant) et rien de plus [S17] :
  passer `now` en paramètre, `vi.useFakeTimers()` / `vi.setSystemTime()` pour un composant.
- Fonction privée d'une page : l'extraire *telle quelle* (copier-coller, export) dans `src/lib/…`,
  caractériser, puis seulement la modifier ou la remplacer.
- Code qui touche la base : caractériser en intégration (PostgreSQL réel, schéma `itest`, fabriques
  `tests/integration/helpers/factories.ts`) — jamais en simulant Prisma (`CLAUDE.md`). Modèle :
  `tests/integration/checkout-contract.test.ts` (sous-totaux calculés à la main, vrais handlers).
- Composant : figer le payload envoyé (`fetch` simulé) plutôt que le DOM complet ; un instantané
  de DOM entier casse à chaque retouche de style et n'apprend rien.

## 4. Verrouiller après migration

- **Liste fermée par test** : `tests/lib/order-writers-guard.test.ts` parcourt `src/`, retire
  commentaires et chaînes, relève chaque `order.update(` / `order.updateMany(` et échoue si un
  fichier hors liste en contient ; chaque entrée de la liste porte sa raison. À copier pour
  « seul X écrit Y » (ex. seul `lib/pricing` formate un montant).
- **Zone ESLint** : ajouter une zone à `scripts/boundaries.eslintrc.cjs` (`import/no-restricted-paths`
  [S3]) ou un motif `no-restricted-imports` [S4] ; relancer `check-boundaries.mjs`.
- **Test de configuration** : `src/lib/__tests__/middleware-matcher.test.ts` lit la source et
  vérifie la liste blanche du middleware sans build.

## 5. Déplacer un fichier sans casser

1. `git mv` dans une PR qui ne fait que ça ; mettre à jour les imports `@/…` (rechercher l'ancien
   chemin dans `src/` **et** `tests/`, `vi.mock("@/…")` compris).
2. Pas de ré-export de transition, sauf si le nombre d'importeurs rend la PR illisible (repère
   d'équipe : plus d'une dizaine) ; dans ce cas, le marquer `@deprecated` et le supprimer dans la PR
   suivante (ne pas laisser un baril durable).
3. `npx tsc --noEmit`, `npm run lint`, `npm run test`, `check-boundaries.mjs`.
4. Un déplacement massif en une seule PR a coûté à Shopify une partie de son historique git (des
   déplacements vus comme suppression + création) [S19] : par domaine, au fil des PR, et un
   déplacement sans modification dans le même commit pour que git suive le renommage.
