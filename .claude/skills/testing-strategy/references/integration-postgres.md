# Intégration sur PostgreSQL réel — handlers et services

Ce qui se prouve ici et nulle part ailleurs : une écriture, une transaction, une contrainte unique, une course entre deux requêtes, le périmètre d'une boutique. CLAUDE.md : « tout ce qui touche la base se teste en intégration », jamais sur un Prisma simulé. Recommandation de Prisma pour ce niveau : une vraie base dans un conteneur `[PR1]` ; principe général : « Each test should act on its own records only » `[GY1]`. Forme d'un handler et tests simulés de câblage : skill `api-route-conventions` (`references/tests-handlers.md`). Patrons de transition et d'idempotence : `order-lifecycle-realtime`.

## 1. L'outillage en place (chantier 0)

| Fichier | Rôle |
|---|---|
| `tests/integration/setup/database-url.ts` | Dérive l'URL `?schema=itest` de `DATABASE_URL` ; refuse tout hôte autre que `localhost`, `127.0.0.1`, `::1` ; ne met jamais l'URL dans un message (elle porte le mot de passe). |
| `setup/global-setup.ts` | Une fois par lancement : verrou consultatif PostgreSQL (un second lancement attend jusqu'à 10 min), puis `prisma db push` avec le CLI installé. |
| `setup/env.ts` | Dans chaque worker, avant tout import applicatif : `DATABASE_URL` et `DIRECT_DATABASE_URL` vers le schéma `itest`. |
| `helpers/db.ts` | `prisma` (le client de l'application, jamais un mock), `resetDatabase()` (`TRUNCATE` de toutes les tables du seul schéma `itest`), `useCleanDatabase()`. |
| `helpers/factories.ts` | `createTestUser`, `createTestShop`, `createTestProduct`, `createTestOffer`, `createTestOrder`. |
| `orders/commands-fixtures.ts`, `orders/create-order-fixtures.ts` | `createWorld()`, `jsonRequest`, `readResponse`, `eventsOf`, `notificationsOf`, `reload` ; `customerOf`, `quoteRequest`, `confirmedBody` (total confirmé = devis serveur). |

Configuration Vitest (`vitest.config.ts`, projet `integration`) : environnement `node`, `fileParallelism: false` (une base, un fichier à la fois), `testTimeout` 30 s, `hookTimeout` 120 s `[VT2][VT5][VT9]`.

### Lancer en local

```bash
# Une base jetable (port au choix, jamais la base de développement) :
docker run -d --name klikgo-itest -e POSTGRES_USER=ci -e POSTGRES_PASSWORD=ci -e POSTGRES_DB=ci \
  -p 127.0.0.1:55433:5432 postgres:16-alpine -c fsync=off -c synchronous_commit=off -c full_page_writes=off
DATABASE_URL="postgresql://ci:ci@127.0.0.1:55433/ci?schema=public" npm run test:integration
DATABASE_URL=… npx vitest run --project integration tests/integration/orders/quote.test.ts   # un fichier
```

Les réglages non durables accélèrent une base qu'on accepte de perdre `[PG1]`. Mesure de 08 h 27 : 18 fichiers, 233 tests en 40 à 45 s `[L25]` (17 fichiers et 216 tests une demi-heure plus tôt `[L19]`). Le port est libre de choix (`docker ps` avant de lancer : un autre conteneur peut déjà tenir le 55433).

## 2. Anatomie d'un test (copier `orders/create-order.test.ts` ou `orders/transition-races.test.ts`)

```ts
// @vitest-environment node
// <Une phrase : quelle règle ce fichier protège, et ce que casserait une régression.>
import { describe, expect, it, vi } from "vitest";

// 1. Frontières réseau simulées DANS le fichier (vi.mock est propre au fichier et remonté en tête) [VT3].
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({ sendWhatsAppMessage: vi.fn(async () => true), sendWhatsAppRaw: vi.fn(async () => true) }));

// 2. Le vrai handler ou le vrai service, importé après les simulations.
import { PATCH } from "@/app/api/boucher/orders/[orderId]/action/route";
import { prisma, useCleanDatabase } from "../helpers/db";

// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React, seulement le préfixe « use »
useCleanDatabase();
```

Ce que chaque test vérifie — les sorties d'une unité de travail `[GY1]` :

1. **La réponse** : statut HTTP et `error.code` (pas le message, c'est du contenu).
2. **Le nouvel état en base**, relu par `prisma` : statut, montants, stock, compteurs.
3. **Les effets journalisés** : `OrderEvent`, `Notification` (le module `@/lib/notifications` n'est pas simulé, il écrit en base).
4. **Les appels sortants** : `vi.mocked(sendEmail)` appelé, avec quoi, combien de fois.
5. **Ce qui ne doit pas changer** : sur un refus, l'état relu est identique et aucun événement n'est écrit. C'est la moitié des bugs de sécurité.

## 3. Identité : simuler Clerk, pas nos helpers (T1)

Aujourd'hui 6 fichiers simulent `@/lib/boucher-auth` ou `@/lib/auth/server-auth`. CLAUDE.md le permet (« helpers d'auth quand on appelle un route handler directement ») et c'est acceptable pour tester la logique métier d'une action, mais **la règle d'accès vit dans ces helpers** (clause `OR` sur `ownerId`, rôle relu en base, caches) : un test d'isolation doit les faire tourner pour de vrai.

Étape suivante, vérifiée deux fois le 2026-11-14 sur l'arbre courant `[L20][L26]` :

- `templates/integration/setup/clerk-mock.ts` → `tests/integration/setup/clerk-mock.ts`, ajouté aux `setupFiles` du projet `integration` **après** `env.ts`. Il ne simule que `@clerk/nextjs/server` (`auth`, `currentUser`, `clerkClient` qui lève une erreur). Ajouté à toute la suite actuelle : elle reste verte (216/216 à 08 h 00, 233/233 à 08 h 27). La modification de `vitest.config.ts` (une entrée de `setupFiles`) se coordonne avec le chantier qui tient ce fichier.
- `templates/integration/helpers/session.ts` : `signInAs(user)` / `signOut()` ; l'état vit dans un module ordinaire lu par import dynamique dans la fabrique de `vi.mock` `[VT6]`.
- `templates/integration/helpers/http.ts` : `apiRequest(method, path, body)` (même rôle que `jsonRequest` des fixtures de commande ; à unifier).
- `templates/integration/api/boucher-isolation.test.ts` : propriétaire avec `ownerId` = id Prisma **et** = clerkId (200), sans session (401), boucher d'une autre boutique (404, ni statut ni `OrderEvent`), client connecté (403), devis puis commande d'un client (total 2 580 = devis). 6 verts.

Règle : **toute nouvelle route qui reçoit un identifiant venu du client** (`orderId`, `productId`, `shopId`) a son test « autre boutique » dans ce format. C'est le test que réclame `security-multitenant` ; `tests/security/multitenant.test.ts` (T2) ne le fait pas.

Pièges : un même `clerkId` relu dans les 60 s tombe sur `memCache` de `boucher-auth.ts` (T10) — les fabriques donnent des identifiants uniques, ne pas les réutiliser entre tests ; `UPSTASH_REDIS_REST_URL` doit être vide dans l'environnement de test.

## 4. Courses et idempotence

Une simulation n'a ni verrou ni contrainte unique : une course ne se teste que sur la base (défauts D3 et D4, [etat-des-lieux.md](etat-des-lieux.md) §4).

```ts
it.each(Array.from({ length: 5 }, (_, round) => round))("tour %i : un seul gagnant", async () => {
  const [accepted, cancelled] = await Promise.all([accept(order.id), customerCancel(order.id)]);
  expect([accepted.status, cancelled.status].sort()).toEqual([200, 409]);
  // Puis : l'état final correspond au gagnant, un seul OrderEvent, stock et usage d'offre cohérents.
});
```

- Plusieurs tours (`it.each`) : un seul essai peut passer par chance.
- Affirmer l'**ensemble** des statuts (`sort()`), jamais l'ordre d'arrivée.
- Rejeu (même `idempotencyKey`, même action) : même réponse, aucune nouvelle ligne (`create-order-concurrency.test.ts`).
- Limite connue : la production passe par pgbouncer (`connection_limit=1`), la suite non. Un comportement qui dépend du pool n'est pas prouvé ici.

## 5. Données et temps

- **Fabriques, pas le seed.** Le seed est aléatoire et destructeur (T8). Chaque test crée ses lignes ; seules les colonnes utiles au test sont écrites, le reste garde la valeur par défaut de la base. Ajouter une fabrique dans `helpers/factories.ts` quand un modèle revient dans trois fichiers ; sinon une fonction locale (`createWorld`). Danger d'un « Object Mother » trop riche : les tests finissent par dépendre de ses valeurs exactes `[MF3]`.
- **Un montant attendu** : soit écrit en dur à partir d'un exemple calculé à la main (2 × 12,90 € = 2 580), soit lu dans le devis du serveur (`confirmedBody`). Jamais recalculé avec la formule du code.
- **Le temps** : les services prennent `now` en paramètre quand ils le peuvent (`expireOrder({ orderId, now })`, `quoteOrder(request, customer, now)`) : le passer. Sinon, placer les dates relativement à l'heure réelle (`createdAt: new Date(Date.now() - 10 * MINUTE_MS)`), loin des seuils (10 min pour un seuil de 5 min). `vi.useFakeTimers()` est à éviter ici, par précaution (non mesuré) : le client Prisma et son moteur de connexion utilisent de vrais minuteurs ; aucun test d'intégration du dépôt ne s'en sert.
- **Ordre** : ne jamais dépendre de l'ordre des lignes sans `orderBy`.

## 6. Check-list d'un nouveau test d'intégration

- [ ] Fichier sous `tests/integration/<domaine>/`, `// @vitest-environment node`, commentaire d'en-tête « ce que casserait une régression ».
- [ ] Transports simulés dans le fichier ; ni `@/lib/prisma` (CLAUDE.md) ni `@/lib/notifications` simulés.
- [ ] `useCleanDatabase()` ; données créées par les fabriques ; aucun identifiant partagé entre tests.
- [ ] Les cinq sorties du §2 ; sur un refus, l'état relu est inchangé.
- [ ] Route qui reçoit un identifiant : cas « autre boutique » avec Clerk seul simulé (§3).
- [ ] Action concurrente possible : test de course à plusieurs tours (§4).
- [ ] Vu rouge une fois : casser la règle dans le code, constater l'échec, rétablir `[AN1]`.
- [ ] `npm run test:integration` vert en local sur une base jetable.
