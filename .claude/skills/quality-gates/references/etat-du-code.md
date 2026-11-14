# État du code — portes qualité (mesure du 2026-11-14, UTC)

## Sommaire

1. Arbre mesuré et commande
2. Temps
3. Portes et versions
4. ESLint, règles bon marché
5. Lint typé
6. Options tsconfig
7. Échappatoires et tailles
8. Migrations
9. Écarts avec l'éclaireur
10. Re-mesurer à la main

Instantané : l'arbre bouge. Relancer la mesure avant de citer un chiffre, puis remplacer ce fichier
en gardant la date, `HEAD` et la commande. Toutes les commandes sont en lecture seule.

## 1. Arbre mesuré et commande

- `HEAD 4ec714a` (branche de documentation, égale à `origin/main` le jour de la mesure), aucun
  fichier de `src/`, `tests/`, `scripts/`, `prisma/` modifié ; 682 fichiers `.ts`/`.tsx` dans `src`.
- Depuis, `origin/main` est passé à `50f8886` (chantier C1-INVITES, 81 fichiers changés, et
  `.claude/settings.json` suivi) : les comptes ci-dessous n'ont pas été rejoués sur cet arbre,
  sauf mention ; relancer le script avant d'en citer un.
- Commande, depuis la racine :
  `node .claude/skills/quality-gates/scripts/mesurer-portes.mjs [dossier de travail hors dépôt]`
  (sortie : `resume.txt` dans ce dossier, plus les rapports JSON et les configurations d'essai).
- Zones : première qui correspond dans l'ordre `src/lib/services/orders`, `src/lib/pricing`,
  `src/lib/auth`, `src/lib/__tests__`, `src/lib`, `src/app/api`, `src/app` (pages et le reste de
  `app`), `src/components`, `src/hooks`, `src` (`middleware.ts`, `instrumentation.ts`…).

## 2. Temps (poste partagé avec d'autres agents : ordre de grandeur seulement)

| Mesure                                                                                                                   | Durée                                             |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| ESLint, configuration du dépôt, `src`                                                                                    | 46 s                                              |
| ESLint, règles bon marché, `src`                                                                                         | 27 à 39 s                                         |
| ESLint typé, 16 règles (dont `no-unsafe-*`, `prefer-nullish-coalescing`), `src`                                          | 65 à 115 s                                        |
| ESLint typé, 2 règles seulement (`switch-exhaustiveness-check`, `only-throw-error`), `src`                               | 21 s                                              |
| Cliquet simulé : 5 règles typées dans un override sur commandes, auth, prix ; reste de `src` sans types (mesures.md § 5) | 22 s, 1 signalement (`pricing/discount.ts`)       |
| Deux fichiers, avec règles typées / sans                                                                                 | 17 s / 10 s (surcoût par commit avec lint-staged) |
| `tsc` d'une option, `incremental: false`                                                                                 | ≈ 30 s chacune                                    |
| Script complet (3 passes ESLint + 9 `tsc`)                                                                               | 530 s                                             |

Le coût du lint typé dépend des règles choisies, pas seulement du programme TypeScript.

## 3. Portes et versions

- Versions installées (`node_modules/*/package.json`) : eslint 8.57.1, @typescript-eslint 8.59.1
  (déclaré `^8.59.1`), typescript 5.9.3, next 14.2.35, eslint-config-next 14.2.35 (dépendance
  paire : `eslint ^7.23.0 || ^8.0.0`), lint-staged 15.5.2, husky 9.1.7, prisma 6.19.2, zod 3.25.76.
  knip et @t3-oss/env-nextjs absents.
- `npm run lint` (configuration du dépôt) : 0 erreur, 5 avertissements `react-hooks/exhaustive-deps`
  (`admin/shops/[shopId]/page.tsx`, `admin/support/[ticketId]/page.tsx`,
  `boucher/support/[ticketId]/page.tsx`, `components/SplashScreen.tsx`,
  `components/location/LocationPicker.tsx`). `tests/` et `scripts/` : 0 signalement.
- `tsc` de base : 0 erreur.
- Gardes : `tests/lib/order-writers-guard.test.ts`, `src/lib/__tests__/middleware-matcher.test.ts`,
  `tests/components/ui-guards.test.ts`. La branche du chantier photos (`programme/c1-photos-a`, non
  fusionnée à la date de mesure) ajoute `tests/lib/image-writers-guard.test.ts` et une étape
  Playwright `tests/e2e/photos.spec.ts` dans le job `build`.
- CI (`.github/workflows/ci.yml`) : `lint`, `typecheck`, `test` (`db push` puis unitaires puis
  intégration), `build` (`db push`, `npm run build`, `check-prerender.mjs`). Aucun `migrate diff`.
- Hooks Claude : `.claude/hooks/*.sh` présents, aucun fichier `settings*.json` suivi par git sur
  `4ec714a` ; le commentaire de `pre-git-typecheck.sh` le dit branché dans
  `.claude/settings.local.json` (local). Sur `50f8886`, `.claude/settings.json` est suivi (plugin
  `mattpocock-skills`) et ne déclare aucun hook (relu le 2026-11-15).

## 4. ESLint, règles bon marché (configuration du dépôt + règles candidates)

| Règle (réglage d'essai)                             | `src`                | `tests/` + `scripts/` |
| --------------------------------------------------- | -------------------- | --------------------- |
| `no-restricted-syntax` sur `process.env`            | 165 dans 78 fichiers | 21 dans 7             |
| `complexity` > 15                                   | 99 dans 80           | 5 dans 4              |
| `max-lines` 300 (sans lignes vides ni commentaires) | 82 dans 82           | 7 dans 7              |
| `@typescript-eslint/no-unused-vars` (motifs `^_`)   | 47 dans 29           | 1 dans 1              |
| `@typescript-eslint/no-explicit-any`                | 13 dans 5            | 0                     |
| directives `eslint-disable` inutiles                | 10 dans 7            | —                     |
| `max-depth` > 4                                     | 7 dans 5             | 0                     |
| `no-console` (`warn` et `error` permis)             | 0                    | 162 dans 11 (scripts) |

- `no-explicit-any` : `boucher/clients/page.tsx` (2), `dashboard/marketing/page.tsx` (2),
  `webmaster/marketing/page.tsx` (2), `components/providers/LazyClerkProvider.tsx` (4),
  `lib/sounds.ts` (3).
- `no-unused-vars` : 37 « défini mais jamais utilisé », 10 « affecté mais jamais utilisé » ; 30 dans
  `src/app`, 10 dans `src/components`, 6 dans `src/app/api`, 1 dans `src/lib`.
- Directives inutiles : 9 `@next/next/no-img-element` (règle coupée dans `.eslintrc.json`) dans
  `boucher/images/page.tsx`, `webmaster/banners/page.tsx`, `ImageGenerateModal.tsx`,
  `ImageRetouchModal.tsx` (4), `ImageSearchModal.tsx`, `OfferPopup.tsx` ; 1
  `react-hooks/exhaustive-deps` posée une ligne trop haut dans `LocationPicker.tsx` (l'avertissement
  reste). Avec `@next/next/no-img-element` réactivée : 13 signalements dans 10 fichiers.
- `console.*` dans `src` : 27 `console.error`, 9 `console.warn`, 0 `console.log`.

## 5. Lint typé (`projectService`, configuration du dépôt + règles candidates)

| Règle                                                      | Signalements | Fichiers |
| ---------------------------------------------------------- | ------------ | -------- |
| `prefer-nullish-coalescing`                                | 787          | 244      |
| `no-unsafe-member-access`                                  | 552          | 104      |
| `no-unsafe-assignment`                                     | 418          | 178      |
| `no-unsafe-argument`                                       | 236          | 89       |
| `no-unnecessary-condition`                                 | 235          | 112      |
| `no-misused-promises`, attributs JSX (`onClick={async …}`) | 194          | 67       |
| `no-misused-promises`, autres cas                          | 14           | 12       |
| `consistent-type-imports`                                  | 164          | 158      |
| `no-floating-promises`                                     | 150          | 74       |
| `no-unsafe-call`                                           | 43           | 19       |
| `no-non-null-assertion`                                    | 43           | 27       |
| `no-unnecessary-type-assertion`                            | 32           | 20       |
| `no-unsafe-return`                                         | 13           | 9        |
| `switch-exhaustiveness-check` (options par défaut)         | 6            | 5        |
| `no-deprecated`                                            | 4            | 3        |
| `await-thenable`                                           | 2            | 2        |
| `only-throw-error`                                         | 0            | 0        |

Par zone, règles à fort signal (`no-floating-promises`, `no-misused-promises`,
`switch-exhaustiveness-check`, `await-thenable`, `only-throw-error`) :
`src/lib/services/orders` 0 · `src/lib/auth` 0 · `src/lib/pricing` 1 (`discount.ts`, `default` qui
couvre BOGO et BUNDLE) · `src/lib` 6 · `src/app/api` 4 · `src/components` 70 · `src/hooks` 16 ·
`src/app` (pages) 269. Toutes règles : `src/lib/services/orders` 4, `src/lib/auth` 2.

`switch` non exhaustifs : `admin/users/page.tsx`, `boucher/produits/page.tsx`,
`api/payments/webhook/route.ts` (paiement en ligne inactif), `lib/notifications.ts` (2),
`lib/pricing/discount.ts`. Avec `considerDefaultExhaustiveForUnions: true`, il en reste 1.

## 6. Options tsconfig, une à la fois (base : 0 erreur)

| Option                               | Erreurs | Fichiers | Répartition                                                                                                                 |
| ------------------------------------ | ------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `noFallthroughCasesInSwitch`         | 0       | 0        | —                                                                                                                           |
| `noImplicitReturns`                  | 2       | 2        | `decouvrir/CartBadge.tsx`, `src/middleware.ts` (rappel Clerk sans `return` final)                                           |
| `noImplicitOverride`                 | 2       | 1        | `LazyClerkProvider.tsx`                                                                                                     |
| `noUnusedParameters`                 | 3       | 3        | `api/users/me/export/route.ts`, `KitchenOrderCard.tsx`, un test d'intégration                                               |
| `noUnusedLocals`                     | 46      | 29       | pages 30, composants 8, API 5, hors `src` 2, `src/lib` 1                                                                    |
| `exactOptionalPropertyTypes`         | 121     | 73       | API 31, `src/lib` 30, composants 24, pages 13, hors `src` 11, commandes 9, tests unitaires 3                                |
| `noUncheckedIndexedAccess`           | 412     | 103      | hors `src` 213 (tests, seeds Prisma, scripts), pages 78, composants 34, tests unitaires 29, `src/lib` 25, API 23, autres 10 |
| `noPropertyAccessFromIndexSignature` | 529     | 161      | non proposé (impose `process.env["X"]`)                                                                                     |

Un tsconfig d'essai limité à `src/lib/services/orders` et `src/lib/pricing` avec
`noUncheckedIndexedAccess` signale aussi `src/lib/paris-time.ts`, `src/lib/boucher-auth.ts`,
`src/lib/auth/test-session.ts`, `src/lib/price-adjustment.ts` : tsc vérifie les fichiers importés.

## 7. Échappatoires et tailles (`src`, recherche textuelle)

| Motif                                           | Occurrences                          | Fichiers |
| ----------------------------------------------- | ------------------------------------ | -------- |
| `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` | 0                                    | 0        |
| `eslint-disable`                                | 20                                   | 13       |
| `as any`                                        | 4                                    | 2        |
| `: any`                                         | 10                                   | 10       |
| `as unknown as`                                 | 6                                    | 6        |
| `process.env`                                   | 158                                  | 78       |
| `.catch(() => {})`                              | 43                                   | 29       |
| `catch {}` vide (motif approché)                | 12                                   | 9        |
| barrel `index.ts` qui ré-exporte                | 1 (`src/components/layout/index.ts`) | —        |
| repli `NEXT_PUBLIC_SITE_URL \|\|`               | 47                                   | —        |

Tailles (lignes brutes) : 93 fichiers au-delà de 300, 25 au-delà de 600 ; les plus gros :
`boucher/produits/ProductFormPage.tsx` 1 861, `ProductForm.tsx` 1 711, `boucher/commandes/page.tsx`
1 426, `boucher/parametres/page.tsx` 1 245, `boucher/produits/page.tsx` 1 130.

## 8. Migrations

`prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma
--shadow-database-url [base PostgreSQL 15 jetable] --exit-code` : code 1, erreur `P3006` — la
migration `20260422000000_add_missing_indexes` échoue sur la base fantôme (colonne `expires_at`
inexistante). 14 dossiers de migration. Même constat que `prisma-expert` (A1) : la porte de dérive
exige d'abord la réparation de l'historique.

## 9. Écarts avec l'éclaireur

L'éclaireur « références » a mesuré le même jour un autre worktree, en chantier (722 fichiers) :
5 108 signalements avec `strict-type-checked` + `stylistic-type-checked`, 60 `no-unused-vars`
(options par défaut), `noUncheckedIndexedAccess` 492, 3 `console.log`. Ses chiffres ne valent que
pour cet arbre ; ce fichier vaut pour `HEAD 4ec714a`. Son préréglage complet n'a pas été rejoué ici.

## 10. Re-mesurer à la main

```bash
# depuis la racine ; rien n'est écrit dans le dépôt
c() { printf "%-22s %5s occ. %4s fichiers\n" "$1" \
  "$(grep -rnE --include=*.ts --include=*.tsx -- "$2" src | wc -l | tr -d ' ')" \
  "$(grep -rlE --include=*.ts --include=*.tsx -- "$2" src | wc -l | tr -d ' ')"; }
c ts-ignore "@ts-ignore|@ts-expect-error|@ts-nocheck"; c eslint-disable "eslint-disable"
c "as any" "as any\b"; c ": any" ":[[:space:]]*any\b"; c "as unknown as" "as unknown as"
c process.env "process\.env"; c "catch vide" "\.catch\(\(\)[[:space:]]*=>[[:space:]]*\{[[:space:]]*\}\)"
find src \( -name "*.ts" -o -name "*.tsx" \) -print0 | xargs -0 wc -l | grep -v " total$" \
  | awk '$1>300{a++} $1>600{b++} END{print a" > 300 lignes, "b" > 600"}'
```
