---
name: prisma-expert
description: Prisma 6.19 et PostgreSQL pour Klik&Go (marketplace multi-tenant sur Vercel + Railway). Utiliser avant de modifier prisma/schema.prisma, d'écrire une migration, une requête Prisma ou du SQL brut, une transaction, un compteur, une pagination, un cron qui parcourt des lignes, un seed ou un test d'intégration, ou de toucher à DATABASE_URL et au pool de connexions.
when_to_use: 'Mots déclencheurs : schema.prisma, migration, migrate deploy, index, N+1, findMany, pagination, curseur, transaction, concurrence, verrou, P2002, P2024, P2028, pgbouncer, connection_limit, Decimal, Float, Json, soft delete, seed, base de test, requête lente, EXPLAIN.'
---

# Prisma et PostgreSQL — Klik&Go

Versions installées : `prisma` / `@prisma/client` 6.19.2 (moteur Rust, générateur `prisma-client-js`, aucune `previewFeatures`), TypeScript 5.9, PostgreSQL 16 en CI, 15 en local de vérification, version de production non relevée. La documentation, même sous `/v6/`, montre des exemples v7 : `--to-schema` n'existe pas chez nous (c'est `--to-schema-datamodel`), aucun adaptateur de pilote n'est installé, le dépôt n'a pas de `prisma.config.ts` et n'en reçoit pas dans un chantier de données. `npx prisma <commande> --help` fait foi.

Ancrages : `prisma/schema.prisma` (51 modèles), `src/lib/prisma.ts` (singleton), `src/lib/services/orders/**` (chantier 0, modèles à imiter), `src/lib/prisma-errors.ts`, `src/lib/paris-time.ts`, `scripts/prisma-migrate-prod-only.mjs`, `tests/integration/**`. Le chantier 0 (services de commande, `prisma-errors.ts`, tests d'intégration, migration `20261113120000_chantier0_order_integrity`) n'était pas commité le 14/11 : si ces fichiers manquent dans le worktree, le signaler au lieu de les réécrire.

Références (à lire selon la tâche) :

- [references/etat-du-code.md](references/etat-du-code.md) — fichiers modèles, écarts D1 à D22. **Lire avant tout chantier de données.**
- [references/migrations.md](references/migrations.md) — écrire une migration sans `migrate dev`, expand / contract, SQL dangereux, échec, baseline.
- [references/index-et-requetes.md](references/index-et-requetes.md) — index, N+1, lectures bornées, pagination par clé, agrégats, SQL brut, `EXPLAIN`.
- [references/transactions-concurrence.md](references/transactions-concurrence.md) — écriture conditionnelle, compteurs, verrous, transactions, nouvelles tentatives, erreurs.
- [references/schema-et-types.md](references/schema-et-types.md) — conventions, argent, temps de Paris, JSON, suppression logique, journal, seed, tests.
- [references/connexions-serverless.md](references/connexions-serverless.md) — pool, PgBouncer, Fluid compute, délais de garde, erreurs de connexion.
- [references/verifications-locales.md](references/verifications-locales.md) — mesures `[L…]` sur nos versions, et comment les refaire.
- [references/sources.md](references/sources.md) — sources `[PR…]`, `[PG…]`, etc., et corrections du vérificateur.

Les **statuts** de commande (machine à états, `OrderEvent`) relèvent de `order-lifecycle-realtime` ; la traduction des erreurs en réponses HTTP et le contrat de pagination, de `api-route-conventions` ; l'isolation par tenant côté route, de `security-multitenant` ; région et coût des fonctions, de `vercel-cost-performance`.

## Outils du skill (lecture seule, depuis la racine du dépôt)

```bash
node ${CLAUDE_SKILL_DIR}/scripts/schema-audit.mjs            # FK sans index, index doublons, Float monétaires, …Id sans relation, onDelete implicite
node ${CLAUDE_SKILL_DIR}/scripts/query-audit.mjs --quiet --max-unbounded=62   # cliquet : findMany sans take (62 au 14/11), boucles, skip, $…Unsafe
node ${CLAUDE_SKILL_DIR}/scripts/migration-lint.mjs prisma/migrations/<dossier>/migration.sql
```

Un constat de script invite à lire le code ; ce n'est pas une preuve. Baisser `--max-unbounded` à chaque correction, ne jamais le monter.

## Règles non négociables

1. **Un seul client** : `import prisma from "@/lib/prisma"`. Jamais `new PrismaClient()` dans `src/`, jamais `$disconnect()` dans un handler [PR3].
2. **Le tenant est dans le `WHERE`** de chaque lecture et écriture métier (`shopId`, ou `userId` côté client), y compris dans `updateMany`, `count`, `groupBy` et le SQL brut. `userId` = identifiant **Prisma** de l'utilisateur, jamais l'identifiant Clerk (CLAUDE.md, « Résolution userId »). Objet d'un tenant : `findFirst({ where: { id, shopId } })`. Valider la valeur avant la requête : `where: { shopId: undefined }` **supprime le filtre** et lit toute la table [L16][L38].
3. **Propriété d'une boutique** : clause `OR` sur `ownerId` (identifiant Clerk ou Prisma), comme l'impose CLAUDE.md, tant que l'arbitrage A6 n'est pas tranché.
4. **Aucune lecture non bornée** : tout `findMany` a un `take` ou une liste `in:` bornée par construction ; un cron ou un export avance par lots sur la clé (`index-et-requetes.md` § 4).
5. **Aucune requête dans une boucle** : `in:` + `Map`, `groupBy`, `updateMany`, `createMany`.
6. **`select` explicite** dans toute réponse d'API ; `include` charge toutes les colonnes et lance une requête par relation, sans jointure [L13].
7. **La condition va dans l'écriture**, pas dans une lecture qui la précède : `updateMany` gardé + `count`, contrainte unique, ou verrou pris **dans la transaction avant de lire** (ligne parente écrite, verrou consultatif). Sans ce verrou, un `findFirst` / `count` de contrôle ne protège de rien, même dans une transaction [L17][PG1].
8. **Transaction interactive** : uniquement `tx.` dedans — un `prisma.` s'y exécute **hors** transaction et, avec `connection_limit=1`, la bloque jusqu'à son expiration (`P2028`, ou `P2024` si `pool_timeout` est plus court) [L26][L40] ; aucun appel réseau (Stripe, Resend, push, Redis) ; effets externes après le `COMMIT` ; ne jamais attraper une erreur de base pour continuer (`25P02` [L21]) ; options = la constante `TRANSACTION_OPTIONS` des services de commande (`{ maxWait: 5_000, timeout: 10_000 }`).
9. **Argent en `Int` centimes**, jamais `Float` [PG10]. **Jour = jour de Paris** via `getParisWallClock` / `parisWallClockToUtc`, jamais `setHours(0,0,0,0)` ni `toISOString().slice(0, 10)` côté serveur [L27]. Bornes demi-ouvertes `{ gte, lt }`.
10. **SQL brut** : gabarit étiqueté seulement (``$queryRaw`…` ``), jamais `…Unsafe` ni concaténation [PR21] ; noms SQL snake_case ; `count(*)::int` [L15] ; dates en `(${d}::timestamptz AT TIME ZONE 'UTC')` [L37] ; `updated_at` écrit à la main [L4].
11. **Migrations** : écrites par `migrate diff` de schéma à schéma, relues, lintées, testées sur une base jetable (`migrations.md` § 2). `migrate dev`, `db push` et `migrate reset` **jamais** contre une base partagée ; `migrate deploy` seulement via le build de production (CLAUDE.md). Toute migration laisse fonctionner le code N−1.
12. **Jamais de commande contre la production** (lecture SQL comprise) ni de changement de `DATABASE_URL` (arbitrage A2) sans demande explicite du propriétaire. Ne pas lire les `.env`.

## Décisions rapides

| Besoin | Faire | Référence |
|---|---|---|
| Nouvelle clé étrangère | Relation Prisma + `onDelete` explicite + index dont elle est la 1re colonne | `index-et-requetes.md` § 1 |
| Nouvel index | Tenant en tête, égalités, puis une colonne de tri ; 3 colonnes max ; mesuré par `EXPLAIN` ; `CREATE INDEX CONCURRENTLY` seul dans son fichier sur table existante | `index-et-requetes.md` § 1, 7 ; `migrations.md` § 4 |
| Liste qui grandit (commandes, notifications, avis, journaux) | Pagination par clé `(createdAt, id)` avec borne `lte` + départage `OR`, `take: limit + 1` | `index-et-requetes.md` § 5 |
| Tableau admin à numéros de page, petit après filtre | `skip`/`take` + `count`, tri départagé par `id` [PR6] | idem |
| « Une seule fois » (récompense, réclamation) | `updateMany` gardé, `count === 0` → 409 ; jamais d'option `limit` sur cette écriture [L41] | `transactions-concurrence.md` § 3 |
| Plafond d'une offre (`maxUses`) | Appeler `consumeOffer` (`updateMany` avec référence de champ `tx.offer.fields.maxUses`) | § 3 ; `discount-ledger.ts` |
| Stock limité (anti-gaspi, vente flash) | Appeler `reserveLimitedStock` (décrément, relecture dans la transaction, exception si < 0) | § 3 ; `limited-stock.ts` |
| Édition de formulaire concurrente | `updateMany({ where: { id, shopId, updatedAt: lu } })`, `count === 0` → 409 [L39] ; formulaire humain seulement (jeton à la milliseconde) | § 3 |
| Numéro séquentiel | Commande : `allocateCustomerNumber` / `allocateDailyNumber` / `allocateOrderNumber`. Nouveau compteur : `INSERT … ON CONFLICT DO UPDATE … RETURNING` dans la transaction de création, en dernier, ordre constant | § 4 ; `numbering.ts` |
| Invariant sur plusieurs lignes (capacité d'un créneau) | ``tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))` `` puis `count` puis `create` ; même verrou dans **tous** les chemins d'écriture | § 5 |
| Idempotence | Colonne `@unique` (`idempotencyKey`, `StripeEvent.id`) ; `P2002` = « déjà fait », relire via `uniqueViolationFields()` | § 7, 9 |
| Conflit `P2034` | Rejouer **toute** la transaction (3 tentatives), sans effet externe dedans | § 7 |
| Donnée structurée | Colonnes/table si filtrée, jointe, concurrente ou croissante ; `Json` + Zod si instantané ou petite config | `schema-et-types.md` § 4 |
| Taux (TVA, commission) | Entier en unité explicite (points de base) ; pas de nouveau `Float` | `schema-et-types.md` § 2 |
| Chiffre par jour | `$queryRaw` groupé par `AT TIME ZONE 'Europe/Paris'` ; jamais additionner des lignes chargées en JS | `index-et-requetes.md` § 6 |
| Renommer / supprimer / changer un type | Expand / contract en 2 ou 3 déploiements, jamais `RENAME`/`DROP`/`ALTER TYPE` direct | `migrations.md` § 3 |
| Valeur d'enum | Ajout seul dans son fichier ; le code qui l'**écrit** part au déploiement suivant [L32][L35] ; jamais renommer/retirer | idem |

## Définition de terminé (tout changement qui touche la base)

- [ ] Chaque requête nouvelle ou modifiée : tenant dans le `WHERE`, `select` explicite, `take` ou lot, aucune requête en boucle ; `query-audit.mjs --max-unbounded=<valeur du jour>` passe.
- [ ] Toute garde de concurrence est dans l'écriture (ou sous verrou de transaction) et prouvée par un test d'intégration à appels simultanés (`tests/integration`, fabriques de `helpers/factories.ts`).
- [ ] Transactions : `tx.` seulement, aucun appel réseau, effets après le `COMMIT`, options standard.
- [ ] Schéma : `onDelete` explicite, FK indexée, pas d'index doublon, pas de `Float` monétaire (`schema-audit.mjs`) ; chaque index ajouté est justifié par une requête et un `EXPLAIN`.
- [ ] Migration : dossier horodaté UTC + `schema.prisma` dans le même commit ; `migration-lint.mjs` sans ERREUR, chaque AVERT justifié dans la PR ; en-tête qui dit pourquoi le code N−1 fonctionne ; essayée sur base jetable et `migrate diff --exit-code` à 0 ; `rollback.sql` si la migration n'est pas purement additive.
- [ ] Dates : jour de Paris, bornes demi-ouvertes ; montants en centimes entiers.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run test:integration` passent (ce dernier avec `DATABASE_URL` visant un PostgreSQL **local** : `schema-et-types.md` § 6).
- [ ] Aucune commande lancée contre une base distante ; les actions qui exigent la production sont listées pour le propriétaire.

## Erreurs Prisma à reconnaître (par code, jamais par texte)

`P2002` unicité (`meta.target` = colonnes **SQL** [L36]) · `P2003` clé étrangère / `Restrict` · `P2025` ligne absente sur `update`/`delete` (préférer `updateMany` + `count`) · `P2034` conflit, rejouer · `P2028` transaction expirée (chercher d'abord un `prisma.` dans le callback) · `P2024` pool épuisé · `P1001` / `P1017` connexion · `P2010` SQL brut : fonction `void` lue par `$queryRaw` [L18], ou violation d'unicité (`meta.code` `23505`, **pas** `P2002`) [L41]. Détails : `transactions-concurrence.md` § 9, `connexions-serverless.md` § 7.

## Erreurs déjà commises ici (ne pas refaire)

- Capacité de créneau comptée hors transaction puis dépassée (`shop-capacity.ts`, 20 commandes pour 5 places [L38]) — encore présent (D9) ; correction décrite dans `transactions-concurrence.md` § 5.
- Tableau JSON `Order.notifSent` lu puis réécrit : 9 ajouts perdus sur 10, double envoi possible [L23] — encore présent (D12).
- Jours en UTC dans finances, exports, stats (D8) ; compteur de tickets à la mauvaise date (corrigé par `numbering.ts`).
- `boucher-stats.ts` charge jusqu'à 5 000 commandes deux fois pour additionner en JS (D5) ; `cron/recalc-shop-tiers` fait un `aggregate` par boutique au lieu d'un `groupBy` (D6).
- Migrations passées qui renommaient une valeur d'enum, supprimaient des tables et changeaient un type en une fois (D19) ; index créés en SQL sans être déclarés dans le schéma (D2).
- Seed qui vide 26 tables sans garde d'hôte (D18).
- Habitudes de l'ancien skill (`prisma.$use`, `db push` en production, `skip` par défaut, `uuid()`) : liste en fin d'`etat-du-code.md`.

## Points à arbitrer (le propriétaire tranche ; ne pas appliquer d'office)

- **A1 — Historique des migrations cassé** (D1) : `migrate deploy` sur base vide échoue à la 3ᵉ migration [L1], donc `npm run db:migrate` / `db:reset` cités par CLAUDE.md ne fonctionnent pas, et CI + tests passent par `db push`. Proposition : baseline `0_baseline` + déclaration des 3 index `orders` hors schéma (`migrations.md` § 7).
- **A2 — Paramètres de `DATABASE_URL`** : CLAUDE.md prescrit `?pgbouncer=true&connection_limit=1`. Prisma déconseille `pgbouncer=true` avec PgBouncer ≥ 1.21 [PR4] et recommande la taille de pool par défaut derrière un pooler externe [PR3] ; Vercel déconseille un pool de 1 sous Fluid [V2]. Mais la présence et la version d'un PgBouncer en production ne sont pas vérifiées (`…proxy.rlwy.net` est le proxy TCP public de Railway [RW5], qui mène à PostgreSQL ou au PgBouncer géré [RW3]). **Ne pas changer l'URL** avant la liste de contrôle de `connexions-serverless.md` § 5 ; poser aussi `statement_timeout` sur le rôle.
- **A3 — Documents internes périmés** : `audit/db-runbook.md` (Prisma 5, table `"Order"`, suppression manuelle dans `_prisma_migrations`) et `audit/migrations.md`. Ne pas suivre leurs commandes.
- **A4 — Base des préversions** : si les préversions Vercel partagent la base de production, du code non validé et le mode test y écrivent. Prisma recommande une seconde base [PR13]. À vérifier dans Vercel.
- **A5 — Montants et taux en `Float`** (D15) : migrer `discountAmount`, `Offer.discountValue`, `Offer.minOrder`, `commissionPct`, `vatRate`, `rewardPercent` vers des entiers, par expand / contract.
- **A6 — `Shop.ownerId` sans relation** (D16) : contient un identifiant Clerk ou Prisma, d'où la clause `OR` de CLAUDE.md. Normaliser vers `User.id` + relation supprimerait l'`OR` ; la règle CLAUDE.md reste en vigueur d'ici là.
- **A7 — `timestamp` sans fuseau** : conforme à notre usage [PG14] ; une conversion réécrit les tables [L11]. Proposition : ne pas convertir.
