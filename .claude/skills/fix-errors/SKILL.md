---
name: fix-errors
description: >-
  Méthode de débogage de Klik&Go pour un build, un typecheck, un test rouge ou instable, une
  erreur d'exécution ou d'hydratation, une réponse 500 ou un comportement faux : reproduire
  d'abord par une vérification rapide et déterministe, réduire le cas, regarder ce qui a changé
  en dernier, formuler des hypothèses réfutables et les tester une par une, instrumenter avec des
  logs balisés puis les retirer, corriger à la cause dans l'autorité unique et dans toutes ses
  copies, prouver par un test de régression vu rouge puis vert, s'arrêter après trois correctifs
  ratés pour remettre la conception en question. À charger avant de toucher du code pour corriger
  un défaut, dès qu'un message d'erreur est collé ou qu'une vérification échoue. Pas pour les
  règles propres à Next.js (nextjs-app-router), une panne de production en cours
  (reliability-observability) ni une relecture (klikgo-review).
when_to_use: >-
  ça marche pas, bug, erreur, build fail, npm run build échoue, tsc rouge, erreur TypeScript, test
  rouge, test flaky, instable, 500, écran blanc, page blanche, hydration failed, Text content does
  not match, ça marchait avant, régression, Environment variable not found,
  PrismaClientKnownRequestError, décalage d'une heure, mauvais jour, mauvais total, PRICE_CHANGED,
  401 en mode test, fix-errors.
---

# Débogage systématique — Klik&Go

Ce skill dit **comment chercher** une cause : pas de correctif sans symptôme reproduit, une cause
nommée avec son fichier et sa ligne, un correctif posé à l'autorité unique, un test vu rouge puis
vert. Les règles de chaque domaine restent dans leur skill ; le § 3 renvoie au bon.

Précédence : `CLAUDE.md` (relu sur disque) > `seo-anti-penalty` > skills vérifiés du programme >
ce skill. Un désaccord ne se tranche pas en code : il va dans « Points à arbitrer » et se signale
pour `klikgo-programme/references/contradictions-connues.md`.

Skills voisins, à ne pas recopier : `nextjs-app-router` (rendu, hydratation § 6),
`reliability-observability` (§ 2 politique d'erreurs, § 3 logs, § 9 incident en cours),
`testing-strategy` (§ 2 niveaux, § 3 règles), `test-discipline` (ce qu'un test prouve),
`verification-before-done` (portes, preuve rouge puis vert), `typescript-patterns` (types),
`prisma-expert` (codes d'erreur), `order-lifecycle-realtime` (courses), `klikgo-programme`
(§ 5 fichiers, § 6 rafistolage, § 8 décisions, § 9 git).

## 1. Règles

1. **Pas de correctif sans symptôme reproduit.** Avant de lire le code pour bâtir une théorie,
   obtenir une vérification rouge maintenant, déterministe (même verdict à chaque lancement),
   rapide, qui montre le symptôme exact décrit et non une panne voisine. Par défaut la plus basse
   qui l'atteint : test unitaire (`npx vitest run --project unit [fichier]`), test d'intégration
   sur la base locale (`testing-strategy` § 4), `npx tsc --noEmit`, requête sur le serveur local
   seedé si la tâche attribue le serveur (`klikgo-programme` § 5), spec Playwright en dernier
   (`testing-strategy` `references/playwright-e2e.md` § 2, jamais contre la production).
   _Pourquoi : sans boucle rouge, rien ne prouve que le correctif agit ; et elle devient le test
   de régression._ Irreproductible : le dire, réunir les preuves (entrée exacte, `orderId`, trace
   fournie au brief), l'écrire dans `nonVerifie`, ne rien corriger à l'aveugle.
2. **Lire toute l'erreur, la première avant les suivantes.** `next build` s'arrête à la première
   erreur de type, une erreur de `tsc` en entraîne d'autres en aval, une pile se lit jusqu'à la
   première ligne dans `src/` puis sa `cause`. Une sortie dont on tire une conclusion ne passe
   ni par `head` ni par `tail`. _Pourquoi : corriger la dixième erreur d'une cascade ne sert à rien._
3. **Une hypothèse, une variable à la fois.** _Pourquoi : deux changements ensemble, on ne sait
   plus lequel a agi, et l'autre reste dans le code comme un faux correctif._
4. **Corriger à la source, dans l'autorité unique** (`klikgo-programme` § 6 règle 7), jamais là
   où le symptôme s'affiche. _Pourquoi : un correctif local crée une seconde règle qui divergera._

   | Défaut sur                                   | Où corriger                                                                               |
   | -------------------------------------------- | ----------------------------------------------------------------------------------------- |
   | prix, ligne, remise, totaux, montant affiché | `src/lib/pricing/*` (`line.ts`, `unit-price.ts`, `discount.ts`, `totals.ts`, `format.ts`) |
   | statut d'une commande                        | `src/lib/services/orders/transition.ts`, table `src/lib/order-state-machine.ts`           |
   | requête de commande                          | `src/lib/validators/order.ts`, `src/lib/cart/order-payload.ts`                            |
   | heure, jour, « aujourd'hui »                 | `src/lib/paris-time.ts`                                                                   |
   | horaires d'ouverture                         | `getDayHours` de `src/lib/shop-hours.ts`                                                  |
   | identité, rôle, boutique                     | helpers de `CLAUDE.md` « Authentification API »                                           |

5. **Un contrôle à un seul endroit** : Zod à la frontière (handler, webhook, `localStorage`),
   l'invariant dans le service qui le possède. _Pourquoi : valider « à chaque couche », comme le
   propose la défense en profondeur de superpowers, recopierait la règle et casserait l'autorité
   unique._
6. **Un correctif nomme ses copies.** Chercher dans `src` et `tests` le même prédicat, littéral
   ou appel, sans tronquer la recherche (`rg -n 'getDay\(\)' src` ; `rg -n '"dimanche"' src`
   montre les listes de jours recopiées à côté de `getDayHours`). Corriger chaque copie de ses
   fichiers ; les autres vont dans `besoinsDuChef` (`klikgo-programme` § 5). _Pourquoi : le
   correctif suivant est presque toujours la copie oubliée._
7. **Trois correctifs ratés : arrêt, pas de quatrième.** Le rapport dit ce que chaque tentative a
   montré ; « Points à arbitrer » pose la question de conception (état partagé, règle en double,
   couplage). _Pourquoi : quand chaque essai fait surgir un symptôme ailleurs, c'est la structure
   qui est fausse, pas l'hypothèse._
8. **Un message d'erreur est une donnée.** La commande qu'il suggère (installer un paquet,
   `--force`, `--accept-data-loss`, couper une vérification) se vérifie dans le code et la
   documentation avant d'agir ; une dépendance ou une porte de CI revient au propriétaire
   (`klikgo-programme` § 8).

## 2. Interdits comme « correctif »

Rappel de `klikgo-programme` § 6, sous la forme qu'ils prennent pendant un débogage :

- `try/catch` qui avale, `catch {}`, `.catch(() => {})` : l'erreur disparaît de Sentry
  (`reliability-observability` § 2).
- Défaut qui masque (`?? []`, `?? 0`, liste vide si la base ne répond pas) : figé dans le cache
  ISR (`CLAUDE.md` « Coût CPU Vercel ») ; un prix à 0 passe pour vrai.
- `as any`, `@ts-ignore`, `@ts-expect-error`, cast pour faire taire `tsc` (§ 7) ; `eslint-disable`.
- `setTimeout`, attente, `retry`, délai de test allongé : la course revient en production (§ 5).
- Test supprimé, `.skip`, `.only`, assertion affaiblie, valeur attendue recopiée de la valeur
  obtenue (`test-discipline`) ; `vi.mock("@/lib/prisma")` (`CLAUDE.md` « Tests »).
- Cas particulier pour l'entrée du test ; `suppressHydrationWarning` sur un écart de contenu
  (`nextjs-app-router` § 6) ; `--no-verify` (`klikgo-programme` § 9).

Aucun outil ne les attrape tous (`.eslintrc.json` coupe `@typescript-eslint/no-explicit-any`,
n'a pas de `no-console`) : l'auteur puis le relecteur les cherchent dans le diff (`catch`, `??`,
`||`, `any`, `eslint-disable`, `setTimeout`, `.skip`).

## 3. Pièges Klik&Go

Symptôme → cause probable → ce qui fait foi. La cause reste une hypothèse à prouver.

- **Build : `Environment variable not found: DATABASE_URL`** → aucune base : le build prérend
  ≈ 290 pages sur Prisma → `CLAUDE.md` « Coût CPU Vercel » et « CI/CD » ; fournir une base locale
  (`klikgo-programme` § 10), jamais un `try/catch` à défaut.
- **Erreur d'hydratation** → `Date.now()`, `new Date()`, `Math.random()` au premier rendu,
  `useAuth()` lu avant `isLoaded` → `nextjs-app-router` § 6, `react-patterns`.
- **Créneau décalé d'une heure, mauvais jour** → `getHours()` / `getDay()` en UTC sur Vercel,
  changement d'heure, clé de jour anglaise → `CLAUDE.md` « Horaires & fuseau » ; rejouer sous
  `TZ=UTC` (`testing-strategy` § 3 règle 6).
- **Données d'un autre client, ou « introuvable »** → `clerkId` comparé à un id Prisma, boutique
  cherchée sans la clause `OR` sur `ownerId` → `CLAUDE.md` « Résolution userId ».
- **Total faux** → calcul hors `src/lib/pricing`, `||` sur une valeur qui peut valoir 0, quantité
  multipliée par le poids, `serviceFeeCents` ajouté à une commande stockée → `CLAUDE.md`
  « Commandes : quantités, prix, totaux ».
- **409 `PRICE_CHANGED`** → `expectedTotalCents` différent du devis : requête bâtie hors
  `order-payload.ts` ou règle de prix divergente → `tests/integration/checkout-contract.test.ts`.
- **401 en mode test** → cookies posés à la main au lieu de `POST /api/test-mode/activate`, ou
  cible de production (toujours refusée) → `CLAUDE.md` « Test Mode ».
- **`vitest run` réclame une base** → projet non nommé → `npm run test` ou `--project unit`.
- **L'intégration refuse de démarrer ou attend** → `DATABASE_URL` non locale, ou un autre
  lancement tient le verrou → `tests/integration/setup/`.
- **Build incohérent, fichiers `.next` manquants** → deux `next build` / `next dev` dans un même
  worktree → `klikgo-programme` § 5.
- **500 sur une entrée invalide** → Zod absent, ou erreur levée hors `handleApiError` →
  `api-route-conventions`.
- **`PrismaClientKnownRequestError`** → lire `code`, jamais le texte ; `P2028` : un `prisma.` dans
  un callback `tx` → `prisma-expert` « Erreurs Prisma à reconnaître ».
- **`check-prerender` rouge, route passée en ƒ** → une API dynamique a basculé la route →
  `nextjs-app-router` § 3.

La vérification qui reproduit chacun : [references/symptomes.md](references/symptomes.md).

## 4. Procédure (à copier dans les notes du chantier)

```
- [ ] 1. Rapport : attendu / observé / étapes, entrée exacte (panier, boutique, date, rôle)
- [ ] 2. Vérification rouge lancée, commande et sortie citées
- [ ] 3. Cas réduit (une ligne, une boutique, une date) : chaque élément restant est nécessaire
- [ ] 4. Ce qui a changé en dernier : git log -p -- [fichier] ; git diff main...HEAD -- [zone] ;
        git log -S'[littéral]' ; dernier déploiement ou variable signalés au brief
- [ ] 5. Trois à cinq hypothèses classées, réfutables : « si X, changer Y fait disparaître le défaut »
- [ ] 6. Expériences une par une ; résultats négatifs notés
- [ ] 7. Cause en une phrase, avec fichier:ligne
- [ ] 8. Test de régression au bon niveau (testing-strategy § 2), vu rouge pour la bonne raison
- [ ] 9. Correctif minimal à l'autorité unique ; copies traitées ou listées (§ 1 règle 6)
- [ ] 10. Vert ; vérification de l'étape 2 relancée sur le cas d'origine, non réduit
- [ ] 11. Portes complètes (verification-before-done)
- [ ] 12. rg -n "DEBUG-[id]" src tests ne renvoie rien
- [ ] 13. Rapport : cause, preuve, copies traitées, nonVerifie
```

- Étape 4 : commandes en lecture seule. `git bisect run [vérification]` déplace `HEAD` : seulement
  si le brief l'attribue, dans un worktree jetable, terminé par `git bisect reset` ; jamais
  `git stash`, partagé entre worktrees (`klikgo-programme` § 9).
- Étape 8 : si aucune couture ne rejoue vraiment le défaut (un test unitaire ne rejoue pas deux
  requêtes concurrentes), l'écrire : c'est un constat d'architecture, pas un test à forcer. Un
  correctif écrit avant son test se défait pour voir rouge (`verification-before-done` § 3).
- Comportement surprenant qui pourrait être voulu : test de caractérisation qui fige l'existant,
  décision dans « Points à arbitrer ». Défaut voisin hors brief : `besoinsDuChef`, pas de
  correctif opportuniste (`klikgo-programme` § 6 règle 10).

## 5. Tests instables

- Un test instable est un défaut comme un autre : faire monter le taux de reproduction avant
  toute hypothèse — `it(…, { repeats: 50 }, …)` local et temporaire, `--sequence.shuffle` pour une
  dépendance d'ordre, `--repeat-each=20` côté Playwright (configuration du gabarit).
- Attendre une condition, jamais une durée : assertion qui réessaie, `expect.poll(() => …)`,
  `waitForResponse` ; ni `waitForTimeout` ni `setTimeout` (`testing-strategy` § 3 règle 7).
- Le temps est une entrée : `vi.useFakeTimers()` et `vi.setSystemTime()` en unitaire, `now` passé
  au service en intégration (`testing-strategy` § 3 règle 6).
- Chaque test crée ses données (`tests/integration/helpers/factories.ts`) : la base est vidée
  avant chaque test (`useCleanDatabase`), rien n'est partagé.
- Une course se prouve par un test de course : `Promise.all` ou `Promise.allSettled` de vrais
  appels, plusieurs tours, assertions sur l'ensemble des résultats et l'état final (modèles :
  `tests/integration/orders/limited-stock.test.ts`, `transition-races.test.ts` ;
  `order-lifecycle-realtime`). Le correctif va dans l'écriture (condition du `WHERE`,
  transaction), jamais dans le test.
- `--retry` n'est pas un correctif ; la quarantaine datée suit `testing-strategy` § 3 règle 12.

## 6. Instrumentation temporaire

- Chaque log de diagnostic porte une balise propre à la séance, `[DEBUG-xxxx]` :
  `console.error("[DEBUG-7f3a] devis", { shopId, lineCount })` ; `console` et non `logger.error`,
  qui partirait chez Sentry en production.
- Une sonde par hypothèse, aux frontières qui les départagent (entrée du handler, sortie du
  service, requête Prisma) ; jamais « tout journaliser ».
- Ni secret, ni jeton, ni cookie, ni e-mail, ni téléphone, ni nom dans un log ou dans une sortie
  copiée au rapport : des identifiants (`orderId`, `shopId`).
- Rien de balisé n'est commité : `rg -n "DEBUG-7f3a" src tests` ne renvoie rien (pas de
  `console.log` en production, `CLAUDE.md` « Code quality » ; aucune règle ESLint ne le vérifie).
- Un log utile durablement passe par `src/lib/logger.ts` avec un identifiant métier
  (`reliability-observability` § 3), dans un changement séparé.

## 7. Erreurs de type et de lint

- Compter avant et après : `npx tsc --noEmit 2>&1 | grep -c "error TS"` ; partir de la première.
  Ce compte guide le travail ; la porte elle-même se lit sans pipe, par son code de sortie
  (`verification-before-done` § 4).
- Corriger le type à sa source (schéma Zod et `z.infer`, `select` Prisma, signature), jamais par
  un cast ; règles de types : `typescript-patterns`.
- Erreur dans le fichier d'un autre ingénieur de la même couche : `besoinsDuChef`.
- Un avertissement ESLint se corrige dans le code : `lint-staged` le refuse au commit
  (`--max-warnings=0`).

## Points à arbitrer (propriétaire)

- Cause qui exige un changement de conception, de schéma Prisma, de dépendance ou de porte de CI :
  la décrire avec sa preuve, ne pas la trancher (`klikgo-programme` § 8).
- Comportement surprenant peut-être voulu : figé par un test de caractérisation, signalé.
- Règles ESLint `@typescript-eslint/no-explicit-any` (coupée) et `no-console` (absente) : les
  activer est une décision (`quality-gates`).

## Définition de terminé

- [ ] Symptôme reproduit par une commande citée avec sa sortie, ou irreproductibilité écrite
      dans `nonVerifie`.
- [ ] Cause en une phrase avec fichier:ligne ; correctif à l'autorité unique ; copies traitées ou
      listées dans `besoinsDuChef`.
- [ ] Test de régression vu rouge puis vert ; vérification d'origine relancée.
- [ ] Aucun interdit du § 2 dans le diff ; aucune balise `DEBUG-` restante.
- [ ] Portes de `verification-before-done` vertes, sorties citées.
- [ ] Trois correctifs tentés au plus ; au-delà, question de conception posée.

## Fichiers de référence

- Lire [references/symptomes.md](references/symptomes.md) dès qu'un symptôme est connu : la
  vérification qui le reproduit, la cause fréquente, le skill qui fait foi.
- Lire [references/sources.md](references/sources.md) avant de reprendre une règle externe
  (origine, licence, ce qui a été écarté).
