---
name: test-discipline
description: Discipline des tests probants pour Klik&Go - test écrit et vu échouer avant le code (rouge, vert, nettoyage), régression nommée avant d'écrire le test, valeurs attendues calculées à la main, aucune assertion sur un mock seul et aucun mock hors des frontières permises, cas adverses (autre boutique, sans session, rôle, entrée invalide, rejeu, bornes), contrôle par mutation, tests de caractérisation avant de toucher du code non testé, interdiction d'affaiblir, sauter ou supprimer un test pour obtenir du vert. À charger avant d'écrire, modifier ou relire un test, de prouver un correctif, ou quand un test devient rouge et qu'on est tenté de le changer. Pas pour choisir le niveau, les commandes, les fabriques ou la configuration Vitest et Playwright (testing-strategy), ni pour déboguer un test instable (fix-errors).
when_to_use: Mots-clés - TDD, test d'abord, rouge vert, red green, test de régression, le test échoue, mettre à jour le test, corriger le test, valeur attendue, assertion, expect, toHaveBeenCalled, vi.fn, vi.mock, mock, stub, fake, mutation, test qui ne prouve rien, test tautologique, snapshot, caractérisation, skip, only, todo, getByRole, findBy, waitFor, Testing Library, autre boutique, rejeu.
---

# Discipline des tests — Klik&Go

`testing-strategy` dit **où** et **comment** tester (niveaux, commandes, schéma `itest`, fabriques,
Playwright, CI) ; ce skill dit **quand un test prouve quelque chose** et ce qu'on ne fait jamais
pour obtenir du vert. Il corrige trois réflexes : écrire le test après le code, coller la valeur
reçue comme valeur attendue, vérifier qu'un `vi.fn` a été appelé au lieu de vérifier l'effet.

Précédence : messages du propriétaire > `CLAUDE.md` relu sur disque (« Tests » : Prisma n'est
jamais simulé) > `seo-anti-penalty` > skills vérifiés du programme (`klikgo-programme`,
`testing-strategy`…) > ce skill. Un désaccord va dans « Points à arbitrer » et se signale pour
`klikgo-programme/references/contradictions-connues.md` ; il ne se tranche jamais dans le code.

## 1. Le cycle : rouge, vert, nettoyage

- **Comportement nouveau ou défaut** : le test d'abord, au niveau fixé par `testing-strategy` § 2.
  Le voir rouge **pour la bonne raison** : un message d'assertion (attendu / reçu), pas une erreur
  d'import, de syntaxe, de délai ou de base injoignable. Vert au premier lancement : il teste
  l'existant ou rien ; le réécrire (sauf caractérisation, ci-dessous).
- **Vert** : le code minimal qui le fait passer. **Nettoyage** ensuite, tests verts, sans changer
  le comportement (`simplicity-refactoring`).
- **Avant toute annonce** : la suite du projet, pas seulement le fichier ; preuve et lecture de
  sortie : `verification-before-done` § 2 et § 4.
- **Code existant non testé** : caractérisation d'abord (`architecture-conventions` § 8, gabarit
  dans sa `references/refactoring-incremental.md` § 3). Le test fige le comportement _actuel_, vert
  par construction : sa preuve est la mutation (§ 5). Un comportement surprenant reste figé et va
  dans « Points à arbitrer », jamais corrigé au passage.
  On ne supprime jamais du code existant pour « recommencer par le test ».

Pourquoi : un test jamais vu rouge peut ne pas exécuter le code qu'il prétend couvrir
(`testing-strategy` § 3 règle 11) ; écrire le test avant le code donne cette preuve sans effort.

## 2. Un test prouve quelque chose

- **Nommer la régression avant d'écrire le corps** : quelle modification du produit le ferait
  échouer ? Le titre dit le comportement et le résultat (« refuse 100 portions avec
  QUANTITY_INVALID »), jamais « fonctionne ». Si seule une décision volontaire le fait échouer
  (valeur d'une constante, libellé incident), c'est un détecteur de changement (§ 7).
- **Valeurs attendues écrites à la main**, calcul en commentaire, jamais recalculées avec le code
  testé ni avec sa formule recopiée. 350 g à 24,90 €/kg : (2 490 × 350 + 500) / 1 000 arrondi
  vers le bas = **872** (871,5 arrondi au-dessus) ; 333 g → **829** (829,17 arrondi au-dessous) ;
  3 portions de 350 g → **2 616** (3 × 872, et non 2 615 pour 1 050 g pesés d'un coup). Le premier
  attrape un `+ 500` oublié, le deuxième un arrondi vers le haut, le troisième un prix calculé sur
  le poids total.
- **Seule exception** : un test d'accord avec l'autorité unique (`cartLineTotalCents` comparé à
  `lineTotalCents`, `src/lib/__tests__/cart-line.test.ts`) prouve l'accord, pas la valeur. Admis à
  côté d'au moins un littéral, si l'autorité a sa propre table de littéraux (`pricing-line.test.ts`).
- **Constantes** : importer `MAX_LINE_QUANTITY` et `MAX_PORTION_GRAMS` (`src/lib/pricing/line.ts`)
  quand le test parle d'autre chose ; écrire 99 / 100 et 50 000 / 50 001 en littéraux quand il fige
  précisément cette borne, qui est une règle de `CLAUDE.md`.
- **Forme** : un comportement par test ; préparer / agir / vérifier visibles ; ni `if` ni boucle
  qui choisit l'assertion (table `it.each` à la place). Seule boucle admise : une propriété sur
  toute une plage (« N portions coûtent N fois une portion », `pricing-line.test.ts`). Répéter la
  mise en place qui rend le cas lisible plutôt que la cacher dans un assistant partagé. Données de
  chaque test par `tests/integration/helpers/factories.ts` ; `createTestProduct` vaut 1 911 c/kg
  par défaut, passer le prix quand il compte.
- **Relire la base est voulu ici** quand la ligne est l'effet attendu (`OrderEvent`,
  `Notification`, stock), contrairement au conseil amont « passer par l'interface ». Une valeur
  qu'une interface expose (devis, `GET`) se vérifie par l'interface.

## 3. Doublures

- **Ordre de préférence** : réel > faux (implémentation simplifiée) > bouchon > mock. Ce qui parle
  à PostgreSQL n'est jamais simulé : intégration sur base réelle.
- **Simulations permises** : la liste de `CLAUDE.md` « Tests » (transports `@/lib/email`,
  `@/lib/push`, `@/lib/whatsapp`, `@/lib/emails/*` ; helpers d'auth quand on appelle un handler),
  étendue par `testing-strategy` § 3 règle 3 aux autres frontières réseau (écart suivi en A8).
  Jamais `@/lib/notifications` (il écrit en base), jamais le module testé.
- **« A été appelé » n'est jamais la seule assertion.** Vérifier l'état produit (réponse, lignes
  relues, `OrderEvent`, `Notification`) et, pour un transport, le contenu : destinataire, sujet,
  corps. Modèle : `tests/integration/notifications/order-notifications.test.ts`, bloc « événements
  ajoutés ». `not.toHaveBeenCalled()` complète une preuve d'état inchangé.
- **Une doublure a la forme du vrai** : mêmes arguments, même retour (`sendEmail(to, subject,
htmlBody)` résout un booléen), toutes les propriétés que le code aval lit.
- **Rien de réservé aux tests dans le produit** (`__reset`, `setForTest`) : l'assistant vit sous
  `tests/`. Un service inventé ne passe pas grâce à un mock : tout chemin de `vi.mock` existe.

## 4. Cas adverses obligatoires

Pour toute route ou tout service qui reçoit un identifiant ou une entrée de l'appelant, au niveau
de `testing-strategy` § 2 (intégration dès que le refus dépend d'une ligne en base) :

| Cas                        | Attendu                                                             | Modèle                                                              |
| -------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Objet d'une autre boutique | 404, état relu inchangé, aucun `OrderEvent`                         | `orders/commands-shop.test.ts`                                      |
| Sans session               | 401, rien d'écrit                                                   | `api/public-exposure.test.ts` ; gabarit `boucher-isolation.test.ts` |
| Mauvais rôle               | 403                                                                 | gabarit `boucher-isolation.test.ts` (client connecté)               |
| Entrée invalide            | 400 `VALIDATION_ERROR`, jamais 500 ; statut vérifié                 | `checkout-contract.test.ts` (corps `{bad`)                          |
| Rejeu d'`idempotencyKey`   | 200, la même commande, une seule ligne                              | `orders/create-order-concurrency.test.ts`                           |
| Double envoi, concurrence  | test de course (`Promise.all`, plusieurs tours)                     | `orders/transition-races.test.ts`                                   |
| Bornes                     | 0, 1, 99 et 100 portions, 50 000 et 50 001 g, liste vide, 0 centime | `pricing-line.test.ts`                                              |
| Heure de Paris             | jours de changement d'heure, minuit ; `now` en paramètre            | `src/lib/__tests__/paris-time.test.ts`                              |

Chemins relatifs à `tests/integration/` sauf mention ; le gabarit est dans
`testing-strategy/templates/integration/api/` (Clerk seul simulé). Contenu d'un test d'isolation :
`security-multitenant` § 7 et § 10 ; courses : `order-lifecycle-realtime`.

## 5. Contrôle par mutation

Avant de finir un fichier de test, dresser la table « mutation → test qui échoue » : constante
fausse (`+ 500` retiré, 99 → 100), condition inversée, filtre `shopId` retiré du `where`, effet
retiré (`OrderEvent` non écrit, notification non envoyée), retour vide (`return []`), validation
Zod retirée, mauvais statut. Chaque mutation fait échouer au moins un test ; sinon ajouter le
test, ou écrire le trou dans le rapport.

- **Correctif** : mutation réelle obligatoire, retirer le correctif et voir rouge
  (`verification-before-done` § 3).
- **Nouveau fichier de test** : au moins une mutation réelle, la plus protectrice (filtre de
  boutique, condition du `WHERE`, calcul), dans un fichier qu'on possède (`klikgo-programme` § 5),
  restaurée puis contrôlée par `git diff -- [fichier]` ; les autres peuvent être raisonnées.
- Aucun outil de mutation n'est installé ; en ajouter un revient au propriétaire.

## 6. Interdit pour obtenir du vert

Supprimer un test ; ajouter `.skip`, `.only`, `.todo`, `skipIf`, `runIf` ; affaiblir une assertion
(`toBeTruthy`, `toBeDefined`, `toMatchObject` plus lâche, `toContain` au lieu de `toEqual`) ;
coller la valeur reçue sans l'expliquer ; toucher aux scripts de `package.json` ou à
`include` / `exclude` de `vitest.config.ts`, `--passWithNoTests` ; allonger un délai qui cache une
course ; simuler un module de plus pour faire taire une erreur ; ajouter un fichier à
`ORDER_WRITERS` (`tests/lib/order-writers-guard.test.ts`) au lieu de passer par
`transitionOrder` ; un `try/catch` pour une erreur attendue (`await expect(p).rejects.toThrow(…)`
ou `expect(() => f()).toThrow(…)` ; `try/finally` reste admis pour restaurer un espion, modèle
`src/lib/__tests__/api-errors.test.ts`).

Pourquoi : réécrire les tests pour qu'ils passent est un échec d'intégrité souvent rapporté
(anthropics/claude-code #319 : un `Makefile` réduit aux tests déjà verts ; arXiv 2603.27249 :
tests modifiés pour laisser passer du code cassé). Ici, un faux vert finit dans `main`, qui
déploie en production.

**Quand un test devient rouge après un changement** :

1. Lire l'échec : attendu, reçu, ligne.
2. Trancher avec une source écrite : le code a régressé (corriger le code), ou le test encodait une
   règle fausse ou périmée (le prouver : `CLAUDE.md`, brief, calcul à la main).
3. Changement de test justifié : section à part du rapport (fichier, règle changée, où elle est
   écrite, nouvelle valeur calculée à la main), que le relecteur lit séparément du code
   (`klikgo-review` § 4 passe 8 : test supprimé, sauté ou affaibli = `majeur`).
4. Règle métier qui changerait (prix, remise, annulation) : `besoinsDuChef` et « Points à
   arbitrer » (`klikgo-programme` § 8), le test ne bouge pas. Test d'un fichier qu'on ne possède
   pas : `besoinsDuChef`.

Les `test.skip(!isLocal(baseURL) || …)` de `tests/e2e/primitives.spec.ts` et
`design-foundation.spec.ts` protègent la production : ils restent.

## 7. Tests à ne pas écrire

- **Tautologies** : vérifier une valeur qu'on vient de poser, `expect(true)`, assertion miroir.
- **« Ne lève pas » seul** : vérifier le résultat produit.
- **Snapshots de balisage** (aucun dans le dépôt) : requêtes par rôle ; structure d'écran par
  snapshot ARIA Playwright (`testing-strategy` § 7).
- **Constantes et libellés incidents** : `expect(MAX_LINE_QUANTITY).toBe(99)` (bloc « bounds » de
  `pricing-line.test.ts`) n'attrape qu'un changement voulu ; le test utile est « 99 accepté,
  100 refusé ». Un texte se vérifie là où il est le livrable (notification, ticket).
- **Ce que le compilateur garantit**, après avoir vérifié qu'aucune entrée d'exécution ne le
  contourne : corps JSON, colonnes JSON, `localStorage`, paramètres d'URL se testent.
- **Exception voulue** : les gardes qui lisent les sources (`order-writers-guard.test.ts`,
  `src/lib/__tests__/middleware-matcher.test.ts`, bloc « src/lib/pricing stays pure » de
  `pricing-line.test.ts`, tout `tests/lib/*guard*.test.ts`) sont des contrôles d'architecture et
  restent, contrairement au conseil amont « ne pas lire le source ».

## 8. Composants (Testing Library)

- Requêtes par `screen`, dans l'ordre `getByRole`, `getByLabelText`, `getByText` ; `getByTestId`
  en dernier recours (élément sans rôle ni texte).
- `findBy…` plutôt que `waitFor` pour une apparition ; aucun effet de bord dans `waitFor` ;
  `queryBy…` pour une absence seulement ; matchers jest-dom (chargés par `tests/setup.ts`).
- `fireEvent` par défaut : `@testing-library/user-event` n'est pas installé (`testing-strategy` A1).
- Un callback reçu en prop (`onConfirm`) est la sortie du composant : vérifier son appel, ses
  arguments et leur ordre est légitime (modèle : `tests/components/confirm-dialog.test.tsx`).
- La logique qui mérite une preuve sort du composant vers un module `.ts` pur, testé en unitaire
  (modèle : `src/lib/cart/cart-line.ts`).

## 9. Temps et instabilité

Le temps est une entrée : `vi.useFakeTimers()` + `vi.setSystemTime()`, ou `now` passé au service.
Attendre une condition, jamais une durée. Test instable = défaut : `fix-errors` § 5 ; Playwright :
`testing-strategy` § 7.

## Pièges (vérifiés dans le dépôt)

- **Attendu recalculé avec le code** : `tests/integration/orders/commands-customer.test.ts` (ligne
  de remplacement : `lineTotalCents(…, resolveUnitPrice(…))`) et
  `src/lib/__tests__/pricing-adjustment.test.ts` (`Math.floor((687 * 2500 + 500) / 1000)`) : dans
  le premier, une promotion mal appliquée par `resolveUnitPrice` resterait verte ; dans le second,
  la formule recopiée reproduit son propre défaut. Écrire le littéral.
- **Transport vérifié par un compte seul** : `create-order.test.ts` vérifie
  `sendOrderConfirmationEmail` par `toHaveBeenCalledTimes(2)`, sans destinataire ni commande.
- **Prisma simulé** : des fichiers hérités affirment sur `prismaMock.*` (liste et compte :
  [etat-du-code.md](references/etat-du-code.md)) ; ce ne sont pas des modèles.
- **Un filtre qui ne lance rien** : un `-t` sans correspondance marque tout `skipped` et sort avec 0
  (`verification-before-done` § 4). Lire « Tests N passed ».
- **Données partagées** : `useCleanDatabase()` vide la base **avant** chaque test ; ce qu'un
  `beforeAll` crée disparaît. Le conseil amont « nettoyer après » ne s'applique pas.
- **`vitest run` sans `--project`** démarre l'intégration et réclame une base : scripts npm.
- **`.only` local** : refusé en CI (Vitest `allowOnly` vaut `!isCI`, Playwright `forbidOnly`), mais
  en local il donne un vert partiel silencieux.
- **`try/catch` qui capture le message** : `tests/lib/integration-database-url.test.ts` ne tient que
  parce que l'assertion suivante échoue sur un message vide ; préférer `toThrow`.

## Procédure (à recopier dans les notes du chantier)

```
Discipline des tests — [tâche]
- [ ] Régression nommée pour chaque test (titre ou rapport)
- [ ] Test lancé avant le code : rouge par assertion (première ligne citée)
- [ ] Valeurs attendues en littéraux, calcul à la main en commentaire
- [ ] Doublures limitées aux frontières permises ; état et contenu vérifiés, pas l'appel seul
- [ ] Cas adverses du § 4 pour chaque route ou service à identifiant
- [ ] Table de mutations au rapport ; une mutation réelle vue rouge, puis restaurée
- [ ] Aucun test supprimé, sauté, affaibli ; tout changement de test justifié à part
- [ ] Lancer node .claude/skills/testing-strategy/scripts/audit-tests.mjs : aucune erreur nouvelle
- [ ] Suites vertes et citées (verification-before-done)
```

Boucle : rouge pour une mauvaise raison → corriger le test jusqu'au rouge par assertion ; mutation
non attrapée → ajouter le test et relancer ; toute modification après le vert → relancer.

## Points à arbitrer (propriétaire)

- **Outil de mutation** (Stryker et son lanceur Vitest) : dépendance nouvelle, temps de CI.
  Recommandation : lancement ciblé sur `src/lib/pricing` et `src/lib/services/orders`, non
  bloquant. En attendant : § 5 à la main.
- **`@testing-library/user-event`** : `testing-strategy` A1 ; en attendant `fireEvent`.
- **Seuil de couverture** : `testing-strategy` A9. Un pourcentage mesure ce qui s'exécute, pas ce
  qui est prouvé : jamais une preuve à lui seul, jamais un objectif.
- **Lint des tests** (`next lint` ne lit pas `tests/`) : `testing-strategy` A10.

## Définition de terminé

- [ ] La procédure ci-dessus figure cochée au rapport, chaque case adossée à une commande citée
      ou à une raison écrite dans `nonVerifie`.
- [ ] Aucun test supprimé, sauté ni affaibli sans sa justification à part.

## Fichiers de référence

- [references/exemples.md](references/exemples.md) : à lire en écrivant un test — paires mauvais /
  bon en Vitest (prix, route et autre boutique, notification, composant, test rouge à trancher).
- [references/etat-du-code.md](references/etat-du-code.md) : à lire avant d'auditer les tests
  existants — motifs mesurés et commande qui les re-mesure.
- [references/sources.md](references/sources.md) : origine et licence de chaque règle.
- Voisins : `testing-strategy`, `verification-before-done`, `security-multitenant` (test
  d'isolation), `architecture-conventions` § 8 (caractérisation), `fix-errors` (test instable,
  test de régression d'un défaut), `klikgo-review` § 4 passe 8.
