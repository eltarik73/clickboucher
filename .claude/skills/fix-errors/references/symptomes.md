# Symptômes : la vérification qui les reproduit

Pour chaque symptôme : la vérification à lancer d'abord (règle 1 du skill), la cause la plus
fréquente ici, et ce qui fait foi. La cause est une hypothèse à prouver, jamais un correctif à
appliquer d'office. Chaque chemin se revérifie (`rg`) avant usage : l'arbre bouge.

Sommaire : Build et typecheck · Tests · Exécution et API · Rendu · Données et métier · Retiré de
l'ancienne fiche.

## Build et typecheck

| Symptôme                                                               | Vérification                                                                   | Cause fréquente                                                                                          | Fait foi                                                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Environment variable not found: DATABASE_URL` pendant `npm run build` | relancer `npm run build`, lire la ligne qui cite `schema.prisma`               | aucune base : le build prérend ≈ 290 pages sur Prisma                                                    | base PostgreSQL locale (`klikgo-programme` § 10) ; jamais de valeur par défaut (`CLAUDE.md` « Coût CPU Vercel ») |
| `[check-prerender]` : une route « n'est pas prérendue »                | `npm run build` puis `node scripts/check-prerender.mjs` ; table des routes (ƒ) | `cookies()`, `headers()`, `searchParams` ou `dynamic` ajoutés ; `revalidate` sans `generateStaticParams` | `nextjs-app-router` § 3–4                                                                                        |
| `Dynamic server usage` au build                                        | idem                                                                           | API dynamique dans une route voulue statique                                                             | `nextjs-app-router` § 2–3 ; ne pas poser `force-dynamic` pour faire taire (CPU facturé à chaque requête)         |
| `You're importing a component that needs useState`                     | `npm run build` (`tsc` peut passer)                                            | hook dans un composant serveur                                                                           | `"use client"` sur le plus petit composant concerné, pas sur la page ni le layout (`nextjs-app-router` § 5)      |
| `window is not defined`, `localStorage is not defined`                 | build ou rendu serveur de la page                                              | API navigateur lue au chargement du module ou au rendu                                                   | `useEffect`, ou `dynamic(…, { ssr: false })` dans un fichier client (`nextjs-app-router` § 6, § 8)               |
| `@prisma/client did not initialize yet`                                | `npx tsc --noEmit` ou lancement local                                          | client non régénéré après un changement de schéma                                                        | `npx prisma generate` (déjà dans `npm run build`)                                                                |
| `Cannot find module '@/…'`                                             | `npx tsc --noEmit`                                                             | chemin faux ; alias `@/*` → `./src/*` (`tsconfig.json`, `vitest.config.ts`)                              | corriger l'import ; un paquet manquant est une dépendance, donc une décision (`klikgo-programme` § 8)            |
| Erreurs `tsc` en cascade                                               | `npx tsc --noEmit 2>&1 \| grep -c "error TS"`, avant et après                  | un type source (schéma Zod, `select`, signature) a changé                                                | § 7 du skill, `typescript-patterns`                                                                              |
| Build incohérent, `ENOENT` sous `.next`                                | relancer seul                                                                  | deux `next build` / `next dev` dans le même worktree                                                     | `klikgo-programme` § 5                                                                                           |

## Tests

| Symptôme                                | Vérification                                                       | Cause fréquente                                                            | Fait foi                                   |
| --------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------ |
| `vitest run` demande une base           | `npm run test`                                                     | projet non nommé                                                           | `vitest.config.ts` (commentaire d'en-tête) |
| L'intégration refuse la base            | lire le message levé par `tests/integration/setup/database-url.ts` | hôte autre que `localhost`, `127.0.0.1`, `::1`                             | `testing-strategy` § 4                     |
| L'intégration attend sans fin           | un autre terminal lance-t-il la suite ?                            | verrou advisory tenu par un autre lancement                                | `tests/integration/setup/global-setup.ts`  |
| Vert seul, rouge dans la suite          | `npx vitest run --project unit --sequence.shuffle`                 | état partagé : horloge factice non rétablie, simulation non réinitialisée  | `testing-strategy` § 3 règles 6 et 10      |
| Rouge une fois sur N                    | `it(…, { repeats: 50 }, …)` local, ou boucle de `Promise.all`      | attente d'une durée, horloge réelle, course                                | skill § 5 ; `order-lifecycle-realtime`     |
| Reste vert quand on défait le correctif | défaire le correctif, relancer                                     | assertion sur une simulation, valeur attendue recalculée par le code testé | `test-discipline`                          |

## Exécution et API

| Symptôme                                | Vérification                                                               | Cause fréquente                                                                            | Fait foi                                                             |
| --------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 500 sur une entrée invalide             | test du handler avec un corps invalide                                     | Zod absent, ou erreur levée hors du `try`                                                  | `api-route-conventions` ; `handleApiError` (`src/lib/api/errors.ts`) |
| 405                                     | requête avec la méthode                                                    | `route.ts` n'exporte pas cette méthode                                                     | `api-route-conventions`                                              |
| `PrismaClientKnownRequestError` `P2002` | test d'intégration qui écrit deux fois                                     | contrainte unique ; colonnes lues par `uniqueViolationFields` (`src/lib/prisma-errors.ts`) | `prisma-expert` « Erreurs Prisma à reconnaître »                     |
| `P2025`                                 | idem                                                                       | `update` / `delete` sur une ligne absente ; préférer `updateMany` et son `count`           | `prisma-expert`                                                      |
| `P2028`, `P2024`                        | test d'intégration de la transaction                                       | `prisma.` au lieu de `tx.` dans le callback (`connection_limit=1`)                         | `prisma-expert` règle 8                                              |
| `The table … does not exist` en local   | `npm run db:push` sur la base **locale**                                   | schéma non poussé ; la production n'est jamais touchée par un agent                        | `prisma-expert`, `klikgo-programme` § 8                              |
| 401 en mode test                        | `POST /api/test-mode/activate` avec un jar de cookies, puis la requête     | cookies posés à la main ; `TEST_MODE` absent ; cible de production                         | `CLAUDE.md` « Test Mode », `clerk-auth` § 6                          |
| 404 sur une commande qui existe         | test d'intégration avec le propriétaire et un boucher d'une autre boutique | `clerkId` comparé à un id Prisma ; mauvais `shopId`                                        | `CLAUDE.md` « Résolution userId », `security-multitenant`            |

## Rendu

| Symptôme                                                                                                      | Vérification                                        | Cause fréquente                                                                         | Fait foi                |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------- |
| `Text content does not match server-rendered HTML`, `Hydration failed because the initial UI does not match…` | la page sur le serveur local, console du navigateur | horloge, `Math.random()`, `localStorage`, `useAuth()` avant `isLoaded` au premier rendu | `nextjs-app-router` § 6 |
| Page blanche                                                                                                  | console du navigateur, sortie du serveur local      | erreur de rendu non couverte par un `error.tsx`                                         | `nextjs-app-router` § 7 |
| Liste vide ou `noindex` figés en production                                                                   | build sur une base seedée, puis la page             | `try/catch` à valeur par défaut autour de Prisma                                        | `nextjs-app-router` § 9 |

## Données et métier

| Symptôme                                        | Vérification                                                                                                  | Cause fréquente                                                         | Fait foi                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Créneau décalé d'une heure, surtout un dimanche | unitaire sur `paris-time.ts` aux changements d'heure (dimanches de fin mars et de fin octobre), sous `TZ=UTC` | `getHours()` en UTC, conversion de fuseau à la main                     | `src/lib/paris-time.ts` ; modèle : `src/lib/__tests__/paris-time.test.ts`  |
| Boutique « fermée » un jour ouvert              | unitaire de `getDayHours` avec les clés françaises                                                            | `hours.mon` lu à la main ; liste de jours recopiée                      | `src/lib/shop-hours.ts` ; `rg -n '"dimanche"' src`                         |
| Total ou ligne faux                             | unitaire de `src/lib/pricing/*`, valeur attendue calculée à la main                                           | calcul hors `pricing` ; `\|\|` sur 0 ; quantité multipliée par le poids | `CLAUDE.md` « Commandes : quantités, prix, totaux »                        |
| 409 `PRICE_CHANGED`                             | `tests/integration/checkout-contract.test.ts`                                                                 | requête bâtie hors `order-payload.ts`, règle de prix divergente         | idem                                                                       |
| Statut figé, ou 409 inattendu                   | intégration de la transition                                                                                  | écriture hors `transitionOrder` ; transition absente de la table        | `order-lifecycle-realtime` ; garde `tests/lib/order-writers-guard.test.ts` |

## Retiré de l'ancienne fiche

L'ancienne version de ce skill donnait des parades vérifiées fausses dans ce dépôt :
« caster si nécessaire » (le type ment), « installer le package » (dépendance = décision),
`try/catch` sur une violation d'unicité (lire `code`), `export const dynamic = 'force-dynamic'`
contre `Dynamic server usage` (rendu facturé à chaque requête), `typeof window` dans le rendu
(mismatch d'hydratation), `npm run build 2>&1 | head -100` (sortie tronquée lue comme complète).
Ce qu'elle disait du singleton Prisma et des `error.tsx` est dans `CLAUDE.md` « Performance » et
`nextjs-app-router` § 7.
