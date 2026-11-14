# Migrations sans interruption

`[L…]` : mesures de `verifications-locales.md`. `[PR…]`, `[PG…]`, `[E…]`, `[GH…]` : `sources.md`.

## Sommaire

1. Comment une migration arrive en production ici
2. Écrire une migration (procédure)
3. Expand / contract : les cas que nous rencontrons
4. Opérations dangereuses et écriture sûre
5. Verrous et reprises de données
6. Migration en échec : s'en sortir
7. Réparer l'historique (baseline) — plan soumis à arbitrage

## 1. Comment une migration arrive en production ici

`npm run build` = `prisma generate && node scripts/prisma-migrate-prod-only.mjs && next build`.

- Le script n'agit que si `VERCEL_ENV=production` ; il lance `prisma migrate deploy`, qui passe par `DIRECT_DATABASE_URL` (`directUrl` du schéma). Préversions, CI et postes locaux : rien n'est migré.
- La migration s'applique **avant** `next build`. La base change donc plusieurs minutes avant le code, et reste changée si le build échoue ou si l'on revient à la version précédente depuis Vercel.
- Chaque fichier `migration.sql` de plusieurs instructions s'exécute comme un bloc transactionnel [L8] : tout ou rien, et les verrous pris par la première instruction durent jusqu'à la dernière.
- `migrate deploy` ne détecte pas la dérive, ne réinitialise rien, prend un verrou consultatif de 10 s [PR9]. Un échec bloque **tous** les déploiements suivants (`P3009`) jusqu'à résolution manuelle [L8][PR10].

D'où la règle unique : **toute migration doit laisser fonctionner le code qui tourne déjà** (version N−1), pendant le build et après un retour arrière. C'est la contrainte que GitLab et Stripe décrivent pour leurs propres déploiements [E3][E1].

Ce que le client Prisma N−1 ne supporte pas, mesuré ou lu dans le SQL qu'il émet :

- une colonne ou une table qu'il connaît et qui disparaît ou change de nom : il nomme chaque colonne dans ses `SELECT` ;
- une colonne obligatoire sans défaut qu'il ne connaît pas : ses `INSERT` échouent ;
- une valeur d'enum qu'il ne connaît pas dans une ligne qu'il lit : toute requête qui sélectionne la colonne échoue, liste entière comprise [L32] ;
- un type de colonne changé sous ses pieds.

## 2. Écrire une migration (procédure)

`prisma migrate dev` est **inutilisable** dans ce dépôt : il rejoue l'historique dans une base fantôme, et l'historique échoue à la 3ᵉ migration [L1]. On produit donc le SQL par comparaison de deux schémas, sans base.

```bash
# 1. Modifier prisma/schema.prisma, puis obtenir le SQL de la différence avec la branche de base
git show origin/main:prisma/schema.prisma > "${TMPDIR:-/tmp}/schema.base.prisma"
npx prisma migrate diff \
  --from-schema-datamodel "${TMPDIR:-/tmp}/schema.base.prisma" \
  --to-schema-datamodel prisma/schema.prisma --script

# 2. Créer le dossier (horodatage UTC, ordre lexicographique = ordre d'application)
mkdir "prisma/migrations/$(date -u +%Y%m%d%H%M%S)_<nom_en_snake_case>"
#    y écrire migration.sql : le SQL de l'étape 1, RELU et corrigé d'après les § 3 à 5

# 3. Relecture automatique : aucune ERREUR, chaque AVERT justifié dans la PR
node .claude/skills/prisma-expert/scripts/migration-lint.mjs prisma/migrations/<dossier>/migration.sql

# 4. Essai sur une base jetable (verifications-locales.md, « Refaire une vérification ») :
#    pousser le schéma de BASE, exécuter la migration, puis comparer au schéma cible
npx prisma db push --schema "${TMPDIR:-/tmp}/schema.base.prisma" --skip-generate
npx prisma db execute --url "$DATABASE_URL" --file prisma/migrations/<dossier>/migration.sql
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code   # 0 = la migration mène bien au schéma, 2 = il reste un écart
```

Les quatre étapes ont été rejouées le 14/11 sur la migration du chantier 0 : code de sortie 0 [L42]. `psql` n'est pas installé sur le poste ; `prisma db execute` le remplace (ou `docker exec -i <conteneur> psql …`). L'étape 4 exige que `DATABASE_URL` **et** `DIRECT_DATABASE_URL` visent la base jetable, exportées dans la même commande shell : lire l'hôte affiché par la CLI avant de valider.

Cette comparaison de schéma à schéma ne regarde aucune base : elle ne peut pas proposer de supprimer les objets créés en SQL que Prisma ignore (index trigramme, index partiels, `CHECK`) [L2][L5]. Ne **jamais** générer une migration par `migrate diff --from-url <production>` ni par `db push` : c'est là que ces objets sautent.

À respecter en plus :

- `prisma/schema.prisma` et le dossier de migration dans le **même commit** (CLAUDE.md : `git add prisma/schema.prisma`).
- Ne jamais modifier ni supprimer une migration déjà appliquée ; corriger par une nouvelle migration.
- SQL rejouable quand c'est possible (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) : une migration résolue en `--rolled-back` est rejouée en entier.
- Un commentaire d'en-tête dit pourquoi le code N−1 continue de fonctionner (modèle : `prisma/migrations/20261113120000_chantier0_order_integrity/migration.sql`).
- Les exemples v7 de la documentation ne s'appliquent pas tels quels : `--to-schema` n'existe pas dans notre CLI (c'est `--to-schema-datamodel`) [PR25], et le dépôt n'a pas de `prisma.config.ts` (ne pas en ajouter : `connexions-serverless.md` § 8).

## 3. Expand / contract : les cas que nous rencontrons

Principe [PR7][E1] : ajouter le nouveau (expand), écrire dans les deux, reprendre les données, basculer les lectures, cesser d'écrire l'ancien, puis supprimer l'ancien (contract). Une étape par déploiement ; chaque étape est réversible par un simple retour arrière applicatif.

| Besoin | Déploiement 1 | Déploiement 2 | Déploiement 3 |
|---|---|---|---|
| **Ajouter** une colonne, une table, un index | Migration additive + code qui l'utilise. Colonne : nullable ou avec `DEFAULT` constant | — | — |
| **Renommer un champ TypeScript seulement** | Changer le nom du champ, garder `@map("ancien_nom")` : migration vide [L10] | — | — |
| **Renommer une colonne** | Ajouter la nouvelle colonne ; le code écrit les deux et lit l'ancienne | Reprise des lignes (hors transaction de migration si la table est grande) ; le code lit la nouvelle, écrit encore les deux | Le code n'écrit plus l'ancienne ; puis suppression (ligne suivante) |
| **Supprimer** une colonne ou une table | Le code ne la lit ni ne l'écrit plus, et le champ **sort de `schema.prisma`** sans migration (le client cesse de la nommer). Noter l'écart dans la PR | Migration `DROP COLUMN` / `DROP TABLE` | — |
| **Changer un type** (ex. `Float` → `Int` en centimes) | Nouvelle colonne du bon type ; double écriture | Reprise, bascule des lectures | Suppression de l'ancienne (deux déploiements, comme ci-dessus) |
| **Rendre obligatoire** (`NOT NULL`) | Le code écrit toujours la valeur ; reprise des `NULL` | Migration `SET NOT NULL` (grande table : § 4) | — |
| **Ajouter une valeur d'enum** | Migration `ADD VALUE` + code qui **sait la lire** mais ne l'écrit pas | Code qui l'écrit. Un retour arrière vers une version d'avant le déploiement 1 n'est plus possible dès qu'une ligne la porte [L32] | — |
| **Renommer ou retirer une valeur d'enum** | Ne pas le faire. Cesser de l'écrire ; au besoin ajouter une nouvelle valeur et migrer les lignes | | |
| **Ajouter une contrainte d'unicité** | Dédoublonner ; migration `CREATE UNIQUE INDEX CONCURRENTLY "<table>_<colonnes>_key"` seule dans son fichier, et `@@unique` dans le schéma du même commit [L34] | — | — |

Exemple en cours dans le dépôt : `User.customerNumber` attend sa contraction (colonne et index unique gardés pour le code N−1, plus lus ni écrits par le code du chantier 0 ; le commentaire du schéma le dit). Sa suppression suivra la ligne « Supprimer » : sortie du schéma d'abord, `DROP COLUMN` et de son index unique dans un déploiement ultérieur.

## 4. Opérations dangereuses et écriture sûre

Règle de lecture : `ALTER TABLE` prend `ACCESS EXCLUSIVE` sauf mention contraire, le seul verrou qui bloque aussi les lectures [PG2][PG4]. Le SQL que Prisma génère n'emploie jamais `CONCURRENTLY` ni `NOT VALID` [L10][PR19]. La colonne « lint » donne la règle de `migration-lint.mjs`.

| SQL généré ou tentant | Risque | Écriture sûre | Lint |
|---|---|---|---|
| `CREATE INDEX …` sur une table existante | Écritures bloquées pendant la construction [PG3] | `CREATE INDEX CONCURRENTLY IF NOT EXISTS …` **seul dans son fichier** [L8] ; déclarer le même index dans `schema.prisma` | `index-bloquant`, `concurrently-seul` |
| `DROP INDEX …` | Même verrou ; ou index simplement absent du schéma [L2] | Vérifier `pg_stat_user_indexes` ; `DROP INDEX CONCURRENTLY IF EXISTS`, seul dans son fichier | `drop-index` |
| `DROP COLUMN` + `ADD COLUMN` après un renommage | Perte de données, sans avertissement [L10] | § 3 | `suppression` |
| `ALTER COLUMN … SET DATA TYPE` | Réécriture de la table et de ses index [PG4][E5] ; `timestamp` → `timestamptz` aussi [L11] | Nouvelle colonne, § 3 | `changement-de-type` |
| `ADD COLUMN … NOT NULL` sans défaut | Échoue si la table a des lignes ; casse les `INSERT` du code N−1 | Nullable, ou `DEFAULT` constant (pas de réécriture [PG4]) | `not-null-sans-defaut` |
| `ADD COLUMN … DEFAULT <fonction volatile>` | Réécriture [PG4] | Colonne sans défaut, défaut posé ensuite, reprise par lots | `defaut-volatile` |
| `SET NOT NULL` | Parcours complet sous verrou [PG4] | `CHECK (col IS NOT NULL) NOT VALID`, `VALIDATE CONSTRAINT`, `SET NOT NULL`, `DROP CONSTRAINT` | `set-not-null` |
| `ADD CONSTRAINT … FOREIGN KEY` / `CHECK` sur une table existante | Validation de toutes les lignes sous verrou [PG4] | `… NOT VALID` dans une migration, `VALIDATE CONSTRAINT` dans la suivante [GH1] | `contrainte-validee` |
| `CREATE UNIQUE INDEX` (ce que Prisma génère pour `@unique` / `@@unique`) | Construction bloquante ; échec s'il existe des doublons | Dédoublonner, puis `CREATE UNIQUE INDEX CONCURRENTLY` sous le nom que Prisma attend (`<table>_<colonnes>_key`), seul dans son fichier : Prisma le reconnaît comme la contrainte, sans autre instruction [L34] | `index-bloquant`, `unique-bloquant` |
| `ALTER TYPE … RENAME VALUE`, `CREATE TYPE "X_new"` | Casse le client N−1 [L32] ; le retrait réécrit chaque colonne du type [L10] | § 3 | `enum-renommage`, `enum-retrait` |
| `ALTER TYPE … ADD VALUE` + usage dans le même fichier | Une valeur ajoutée n'est pas utilisable dans la transaction qui l'ajoute (« unsafe use of new value ») [L35] | Fichier dédié | `enum-ajout` |
| `UPDATE` / `DELETE` sans `WHERE`, `TRUNCATE` | Toute la table, sous les verrous de la migration | Reprise par lots, § 5 | `sans-where`, `destructif` |
| Structure et données dans le même fichier | Les verrous du DDL durent pendant toute la reprise | Deux migrations ; acceptable sur une petite table, à justifier | `ddl-et-donnees` |
| `CREATE EXTENSION` | Absente de l'image de la CI ou de Railway [RW1] | `IF NOT EXISTS` ; vérifier les deux environnements | `extension` |

`CREATE INDEX CONCURRENTLY IF NOT EXISTS` ne répare pas un index laissé « invalid » par une tentative échouée : il le trouve et s'arrête [PG3]. Avant de rejouer : `SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;` puis `DROP INDEX CONCURRENTLY`.

Ce que Prisma ne sait pas exprimer et qu'on écrit en SQL dans une migration : index partiel, index unique partiel, index d'expression, `CHECK`, `INCLUDE` [PR19][PR15]. Prisma ne les voit pas et ne les supprime pas [L5]. Deux réserves : les bases nées de `db push` (CI, tests d'intégration) ne les ont pas, donc un test ne peut pas compter dessus ; un index partiel n'est choisi que si le prédicat est impliqué par la requête à la planification, ce que les requêtes à paramètres de Prisma ne garantissent pas dans tous les modes de plan [PG12][L30]. Les lister dans un commentaire du modèle concerné.

## 5. Verrous et reprises de données

- **Borner l'attente.** Un `ALTER TABLE` qui attend derrière une transaction ouverte bloque à son tour toutes les requêtes arrivées après lui [E4], lectures comprises (mesuré : un `SELECT` retenu 2,7 s) [L9]. Mettre `SET lock_timeout = '5s';` en première ligne de tout fichier qui contient un `ALTER TABLE` sur une table existante (impossible dans un fichier `CONCURRENTLY` [L8]). En cas d'expiration la migration échoue proprement : § 6.
- **Une table existante par migration** quand c'est possible : deux tables verrouillées dans une même transaction peuvent s'interbloquer avec l'application [E6].
- **Reprise de données** : idempotente (`WHERE nouvelle_colonne IS NULL`), par lots bornés, hors de la transaction qui change la structure [GH1]. Petite table (boutiques, offres) : une migration SQL séparée suffit. Grande table (`orders`, `order_items`, `notifications`) : script ou cron qui avance par clé (patron « parcours par lots », `index-et-requetes.md` § 4), relançable.
- **Écrire `updated_at` à la main** dans une reprise SQL si le changement doit être vu par la cuisine : la colonne n'a ni défaut ni déclencheur, seul le client Prisma la renseigne [L4].
- Toujours comparer avant de basculer une lecture : `SELECT count(*) FROM t WHERE nouvelle IS DISTINCT FROM <expression de l'ancienne>` doit rendre 0 [E1].

## 6. Migration en échec : s'en sortir

Symptôme : le build de production s'arrête sur `P3018` ; les suivants sur `P3009`. Le site continue de tourner sur la version précédente. L'accès à la base de production appartient au propriétaire : un agent prépare les commandes, il ne les lance pas sans demande explicite.

1. Lire l'erreur PostgreSQL dans le journal du build (ou la colonne `logs` de `_prisma_migrations` [PR10]).
2. Fichier transactionnel : rien n'a été appliqué. Fichier `CONCURRENTLY` : chercher un index « invalid » (§ 4) et le supprimer.
3. `npx prisma migrate resolve --rolled-back <nom_du_dossier>` (avec les deux URL de production exportées).
4. Corriger la cause : verrou non obtenu → relancer le déploiement à une heure calme ; SQL fautif → corriger **ce** fichier, puisqu'il n'a jamais été appliqué.
5. Redéployer : `migrate deploy` rejoue la migration [L8].

Si la migration a été terminée à la main, la déclarer par `migrate resolve --applied <nom>` [PR10]. Ne jamais supprimer de ligne dans `_prisma_migrations` (contrairement à ce qu'écrit `audit/db-runbook.md`).

Revenir en arrière sur le **schéma** : par une nouvelle migration (ou le `rollback.sql` fourni avec la migration), jamais par restauration. Revenir en arrière sur le **code** : toujours possible si le § 1 a été respecté.

## 7. Réparer l'historique (baseline) — plan soumis à arbitrage

But : que `migrate deploy` sache reconstruire une base vide, que `migrate dev` et un contrôle de CI (`migrate diff --from-migrations … --exit-code`) redeviennent possibles. Vérifié en local seulement [L7][L33] ; à exécuter par le propriétaire, pas dans le cadre d'un autre chantier.

1. Sur une copie restaurée de la production : `npx prisma migrate diff --from-url <copie> --to-schema-datamodel prisma/schema.prisma --script`. Tant que la sortie n'est pas vide, aligner le schéma (les trois index `orders` de [L3]) ou écrire la migration manquante. C'est la seule étape qui dit ce que la production contient réellement.
2. Archiver les dossiers actuels hors de `prisma/migrations` ; créer `prisma/migrations/0_baseline/migration.sql` = `CREATE EXTENSION IF NOT EXISTS pg_trgm;` + la sortie de `migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` [PR8] + les objets SQL que Prisma ignore.
3. **Avant** de pousser ce commit : `npx prisma migrate resolve --applied 0_baseline` contre la production. Dans l'ordre inverse, le build tente d'exécuter la baseline et échoue (`type "Role" already exists`) [L33].
4. Pousser. `migrate deploy` répond « No pending migrations » ; les anciennes lignes de `_prisma_migrations` restent et ne gênent pas [L33].
5. Remplacer `db push` par `migrate deploy` dans la CI, et y ajouter le contrôle de l'étape 1 de cette liste entre l'historique et le schéma.

Point ouvert de l'étape 2 : l'index trigramme. Déclaré dans `schema.prisma`, il casse `db push` partout où l'extension manque ou quand le schéma PostgreSQL n'est pas `public` (tests d'intégration) ; laissé en SQL seul, il reste invisible de Prisma [L3]. Tant que les tests reposent sur `db push`, le laisser en SQL dans la baseline et le noter en commentaire du modèle `Product`.
