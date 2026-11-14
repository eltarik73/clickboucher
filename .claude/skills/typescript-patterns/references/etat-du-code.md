# État du code TypeScript — mesure du 2026-11-14, à relancer

## Sommaire

1. Comptes par recherche de texte
2. Contrôle typé (fichiers touchés, puis tout `src/`)
3. Ce que `tsc` ne voit pas
4. Assertions, `any`, `!` (ESLint sans types)
5. `catch` vides ou muets
6. Écarts nommés

Arbre mesuré : `origin/main` au commit `4ec714a` (639 fichiers `.ts`/`.tsx` sous `src/`,
`__tests__` exclus). Toutes les commandes se lancent depuis la racine du dépôt, en lecture seule :
elles n'écrivent rien dans le dépôt (pas de `--cache`, pas de fichier de configuration). Un chiffre
cité ailleurs se remesure d'abord : l'arbre bouge.

## 1. Comptes par recherche de texte

```bash
g() { grep -rnE --include='*.ts' --include='*.tsx' "$1" src | grep -v '/__tests__/'; }
g 'as unknown as' | wc -l
g 'eslint-disable' | wc -l
g '@ts-(ignore|expect-error|nocheck)' | wc -l
g '\.catch\(\(\)[[:space:]]*=>[[:space:]]*\{[[:space:]]*\}\)' | wc -l
g '(Cents|[qQ]uantity|[wW]eightGrams)\)?[[:space:]]*\|\|[[:space:]]*[A-Za-z0-9_.?]+' | grep -vE '\|\|[[:space:]]*[A-Za-z_.?]+[[:space:]]*[<>!=]' | wc -l
g 'Cents\)?[[:space:]]*\?\?[[:space:]]*0\b' | grep -v '_sum\.' | wc -l
g 'JSON\.parse\(' | wc -l
g 'as Record<string' | wc -l
g 'openingHours as' | wc -l
g '(\|\||\?\?)[[:space:]]*clerkId\b'
g '\b(TODO|FIXME|XXX)\b'
g '(//|\*).*\bchantier\b'
g '//.*no longer exists \(removed in'
grep -rlE --include='*.ts' --include='*.tsx' 'process\.env' src | grep -v '/__tests__/' | wc -l
grep -rlE --include='*.ts' --include='*.tsx' '\.strict\(\)' src | grep -v '/__tests__/'
grep -cE '^\s+\w+\s+Json' prisma/schema.prisma
```

| Motif                                             | Occurrences | Fichiers                                     | Lecture                                                                                                                                                       |
| ------------------------------------------------- | ----------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `as unknown as`                                   | 3           | 3                                            | `src/lib/prisma.ts` (admis), `api/payments/webhook/route.ts`, `api/admin/scrape-butchers/route.ts`                                                            |
| `eslint-disable`                                  | 20          | 13                                           | dont des désactivations de `no-explicit-any`                                                                                                                  |
| `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` | 0           | 0                                            | à garder à zéro                                                                                                                                               |
| `.catch(() => {})` sur une ligne                  | 43          | 29                                           | 45 dans 31 fichiers en comptant les formes sur plusieurs lignes (arbre syntaxique)                                                                            |
| `                                                 |             | ` de repli sur centimes / quantité / grammes | 30                                                                                                                                                            | —   | 24 sur un agrégat Prisma (`_sum`, `_avg`) ; 6 ailleurs : 4 dans `webmaster/facturation/page.tsx` (`period?.revenueCents \|\| 0` affiche 0 € pendant le chargement), `avantages/page.tsx`, `boucher/order-detail.tsx` |
| `?? 0` sur un `…Cents` hors `_sum`                | 10          | —                                            | justes : aucune remise (`quote.ts`, `create.ts`) ; à examiner : prix initial d'un formulaire produit, montants de libellés dans `services/orders/discount.ts` |
| `JSON.parse(`                                     | 13          | 13                                           | à suivre d'un parseur                                                                                                                                         |
| `as Record<string`                                | 30          | 21                                           | lectures de `Json` surtout                                                                                                                                    |
| `openingHours as`                                 | 15          | 12                                           | aucun parseur de la colonne                                                                                                                                   |
| repli `?? clerkId` / `\|\| clerkId`               | 1           | 1                                            | `api/reviews/[id]/reply/route.ts` (`repliedById`)                                                                                                             |
| `TODO` / `FIXME`                                  | 3           | 3                                            | 2 `TODO(refactor)` dans `ProductForm*.tsx`, 1 mention dans un commentaire du webhook                                                                          |
| commentaire qui nomme un chantier                 | 5           | 5                                            | `cart-line.ts`, `order-payload.ts`, `stock-hold.ts`, `create.ts`, `CartSuggestions.tsx`                                                                       |
| « no longer exists (removed in …) »               | 4           | 4                                            | `statistiques`, `webmaster/catalogue`, `profil`, `avantages` ; plus « now imported » dans `order-state-machine.ts`                                            |
| fichiers qui lisent `process.env`                 | 77          | —                                            | pas de module d'environnement validé                                                                                                                          |
| fichiers avec `.strict()`                         | 2           | —                                            | `validators/order.ts`, `api/boucher/orders/kitchen/route.ts` ; `validators/index.ts` : 37 `z.object`, aucun strict                                            |
| colonnes `Json` du schéma                         | 20          | —                                            | parseur pour `cutOptions` seulement parmi celles lues ici                                                                                                     |

## 2. Contrôle typé (fichiers touchés, puis tout `src/`)

Règles de typescript-eslint qui demandent les types ; le dépôt ne les active pas (`.eslintrc.json`
n'a ni `parserOptions.project` ni `projectService`). Commande pour les fichiers d'un diff, environ
dix secondes pour trois fichiers :

```bash
node_modules/.bin/eslint --no-eslintrc --parser @typescript-eslint/parser \
  --parser-options projectService:true --plugin @typescript-eslint \
  --rule '@typescript-eslint/no-floating-promises: error' \
  --rule '@typescript-eslint/no-misused-promises: error' \
  --rule '@typescript-eslint/switch-exhaustiveness-check: error' \
  --rule '@typescript-eslint/prefer-nullish-coalescing: error' \
  --rule '@typescript-eslint/no-explicit-any: error' \
  --rule '@typescript-eslint/only-throw-error: error' \
  src/chemin/fichier-touche.ts src/chemin/autre.tsx
```

Liste des fichiers touchés : `git diff --name-only --diff-filter=AM HEAD -- '*.ts' '*.tsx'`
(lecture seule) ; la passer explicitement, jamais une liste vide.

Seuls comptent les constats sur des lignes ajoutées : un fichier ancien en porte déjà. Les messages
« Definition for rule … was not found » viennent des commentaires `eslint-disable` d'autres
greffons, sans effet ici.

Tout `src/` (une trentaine de secondes) : même commande avec `--ignore-pattern '**/__tests__/**'
--ext .ts,.tsx src` et les règles `no-unsafe-*`, filtrée par
`| grep -oE '@typescript-eslint/[a-z-]+ *$' | sort | uniq -c | sort -rn`.

| Règle                                    | Constats | Fichiers | Répartition                                                                                    |
| ---------------------------------------- | -------- | -------- | ---------------------------------------------------------------------------------------------- |
| `prefer-nullish-coalescing`              | 787      | 244      | toutes valeurs confondues, pas seulement des nombres                                           |
| `no-unsafe-member-access`                | 542      | 102      | surtout pages et composants (`any` venu de `res.json()`)                                       |
| `no-unsafe-assignment`                   | 413      | 177      | idem                                                                                           |
| `no-unsafe-argument`                     | 236      | 89       | idem                                                                                           |
| `no-misused-promises`                    | 208      | 75       | pages 154, composants 47, `src/lib` 3, `src/app/api` 2, `src/hooks` 2                          |
| `no-floating-promises`                   | 144      | 73       | pages 113, composants 22, `src/hooks` 8, `src/lib` 1                                           |
| `switch-exhaustiveness-check`            | 6        | 5        | `lib/notifications.ts` ×2, `lib/pricing/discount.ts`, `api/payments/webhook/route.ts`, 2 pages |
| `use-unknown-in-catch-callback-variable` | 5        | 4        | `.catch((e) => …)` dans 4 routes ou pages                                                      |
| `only-throw-error`                       | 0        | 0        | —                                                                                              |

`src/lib/services/orders` et `src/lib/pricing` : aucun constat de promesse. Le même relevé avec
les préréglages complets `strict-type-checked` + `stylistic-type-checked` compte environ 5 100
constats (mesure de l'éclaireur, `quality-gates`).

## 3. Ce que `tsc` ne voit pas

Essai sur un fichier de synthèse compilé avec `strict` **et** `noImplicitReturns` : `tsc` accepte
sans erreur un `switch` dont le `default` rend une valeur générique pour deux membres oubliés, une
promesse flottante, une fonction `async` passée où `() => void` est attendu, et
`adjusted || total` sur un nombre. La commande du § 2 signale les quatre. Sans `default`, un
membre oublié se voit si la fonction déclare son type de retour (`strict` : TS2366) ou, sinon,
avec `noImplicitReturns` (TS7030) ; avec un `default` générique, jamais.

## 4. Assertions, `any`, `!` (ESLint sans types)

```bash
node_modules/.bin/eslint --no-eslintrc --parser @typescript-eslint/parser --plugin @typescript-eslint \
  --ignore-pattern '**/__tests__/**' --ext .ts,.tsx \
  --rule '@typescript-eslint/consistent-type-assertions: [error, {assertionStyle: never}]' \
  --rule '@typescript-eslint/no-non-null-assertion: error' \
  --rule '@typescript-eslint/no-explicit-any: error' src
```

| Constat                                   | Nombre | Fichiers |
| ----------------------------------------- | ------ | -------- |
| assertion `as T` (hors `as const`)        | 266    | 126      |
| `!` non nul                               | 41     | 25       |
| `any` non couvert par un `eslint-disable` | 13     | 5        |
| mot-clé `any` au total (arbre syntaxique) | 21     | 9        |
| `as const` (pas une assertion de type)    | 134    | 77       |
| `satisfies`                               | 19     | 13       |

## 5. `catch` vides ou muets

```bash
python3 -I .claude/skills/reliability-observability/scripts/audit-catches.py .
```

`catch` sans instruction (commentaire seul compris) : 15 dans `src/app/api`, 12 dans `src/lib`,
68 dans l'interface ; `catch` non vide qui ne journalise, ne relance ni ne rapporte : 13, 10 et 52.
La décision par cas appartient à `reliability-observability` § 2.

## 6. Écarts nommés

| Écart                                                                                 | Où                                                               | Règle du skill                                           |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------- |
| `default` générique : pas de cas `PRO_VALIDATED`, `PRO_REJECTED`                      | `src/lib/notifications.ts`, `getPushPayload`                     | § 2                                                      |
| `BOGO`, `BUNDLE` refusés dans `default`                                               | `src/lib/pricing/discount.ts`, `offerGrant`                      | § 2                                                      |
| `switch` sans type de retour déclaré ni `never` (complet aujourd'hui)                 | `services/orders/commands/http.ts`, `transitionResponse`         | § 2                                                      |
| `openingHours: JSON.stringify({})` écrit une chaîne ; relue par `as` et `Object.keys` | `api/shops/register/route.ts`, `api/boucher/onboarding/route.ts` | § 1 (constaté par lecture et `node`, non rejoué en base) |
| `(await res.json()) as {…}`                                                           | `src/lib/image-search.ts`                                        | § 1                                                      |
| corps de webhook vérifié puis `as WebhookEvent`                                       | `api/webhooks/clerk/route.ts`                                    | § 1                                                      |
| `repliedById: dbUser?.id ?? clerkId`                                                  | `api/reviews/[id]/reply/route.ts`                                | § 7                                                      |
| tables à tableaux modifiables                                                         | `src/lib/order-state-machine.ts`                                 | § 8                                                      |
| commentaire « now imported from »                                                     | `src/lib/order-state-machine.ts`                                 | § 10                                                     |
