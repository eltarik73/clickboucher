# Connexions : Prisma 6, Vercel, Railway, PgBouncer

`[L…]` : `verifications-locales.md`. `[PR…]`, `[PG…]`, `[PGB…]`, `[V…]`, `[RW…]`, `[GH…]` : `sources.md`.

## Sommaire

1. Ce qui est établi et ce qui ne l'est pas
2. Comment notre client se connecte
3. Ce que `connection_limit=1` impose au code
4. Choisir les paramètres de `DATABASE_URL` (arbre de décision)
5. Liste de contrôle à dérouler avant toute décision
6. Délais de garde
7. Lire une erreur de connexion
8. Préversions, sauvegardes, Prisma 7

## 1. Ce qui est établi et ce qui ne l'est pas

Établi par le dépôt : un seul `PrismaClient` (`src/lib/prisma.ts`), moteur Rust de Prisma 6.19.2 ; `url = env("DATABASE_URL")`, `directUrl = env("DIRECT_DATABASE_URL")` ; fonctions en `sfo1`, `maxDuration` 30 s pour `src/app/api/**` (`vercel.json`) ; CLAUDE.md documente `DATABASE_URL` en `?pgbouncer=true&connection_limit=1` et un hôte `…proxy.rlwy.net`.

**Non vérifié** (aucun accès à Vercel ni à Railway pendant la rédaction, fichiers `.env` non lus) : la valeur réelle des deux URL, la présence d'un PgBouncer, sa version, la version de PostgreSQL et son `max_connections`, la région de la base, l'état de Fluid compute. Un hôte `…proxy.rlwy.net` est le proxy TCP public de Railway [RW1][RW5] : il mène à PostgreSQL, ou au PgBouncer géré quand celui-ci est activé [RW3], et ne prouve donc ni la présence ni l'absence d'un pooler. Tout choix de paramètre attend la liste du § 5 ; d'ici là, **ne pas modifier `DATABASE_URL`** et écrire du code correct pour une connexion unique (§ 3).

## 2. Comment notre client se connecte

- Chaque instance de fonction possède **son** pool. Taille par défaut : `2 × cœurs + 1` (17 sur un poste à 8 cœurs [L26]) ; `connection_limit` la fixe [PR2][PR20].
- Une requête qui n'obtient pas de connexion en `pool_timeout` secondes (10 par défaut) échoue en `P2024` [PR2][L26].
- Le client envoie des requêtes préparées (cache de 100 par connexion [PR20]). Un pooler en mode transaction doit soit les suivre (`max_prepared_statements` non nul, défaut 200 dans la configuration actuelle de PgBouncer [PGB2]), soit recevoir `?pgbouncer=true` [PR4].
- Prisma Migrate ne fonctionne pas à travers PgBouncer : c'est le rôle de `DIRECT_DATABASE_URL` [PR4][RW3].
- Avec Fluid compute (activé par défaut pour les projets créés depuis le 23/04/2025), une instance sert plusieurs requêtes à la fois et partage son état global, donc son pool [V1].
- Ne jamais appeler `$disconnect()` dans un handler ; ne jamais créer un second client [PR3][PR5].

## 3. Ce que `connection_limit=1` impose au code

Mesuré avec `connection_limit=1` [L26][L40] :

| Écriture | Effet |
|---|---|
| `prisma.x` (au lieu de `tx.x`) dans le callback d'une transaction interactive | La requête attend la connexion que la transaction tient. Avec `pool_timeout` par défaut (10 s) : la transaction expire à son `timeout` (5 s par défaut, 10 s avec `TRANSACTION_OPTIONS`), `P2028`, tout est annulé, **puis** la requête `prisma.` s'exécute seule, hors transaction. Avec un `pool_timeout` plus court que ce `timeout` : `P2024`. Avec un pool plus grand : aucune erreur, la requête part simplement hors transaction |
| `Promise.all([q1, q2, q3])` | Exécution en série (3 × 300 ms = 924 ms). Correct, mais sans gain ; ne pas compter dessus pour tenir un délai |
| Requête longue (export, lecture non bornée, agrégat sur toute une table) | Toute autre requête de la même instance attend derrière elle, puis `P2024` |
| Transaction interactive plus longue que son `timeout` | `P2028`, tout est annulé |
| Travail lancé sans `await` après la réponse | Il occupe l'unique connexion pendant que la requête suivante attend |

Règles qui en découlent, valables quel que soit le réglage final : lectures bornées, transactions courtes et sans appel réseau, uniquement `tx.` dans une transaction, pas de boucle de requêtes.

## 4. Choisir les paramètres de `DATABASE_URL` (arbre de décision)

À appliquer **après** le § 5, par le propriétaire. C'est l'arbitrage A2 du skill.

1. **Un PgBouncer en mode transaction est-il sur le chemin de `DATABASE_URL` ?**
   - **Oui.** Prisma recommande alors la taille de pool par défaut comme point de départ, le pooler protégeant la base [PR3] ; Vercel déconseille un maximum de 1 sous Fluid, qui pénalise la concurrence sans réduire le total [V2]. Point de départ proposé par ce skill, sans source qui le fixe : `connection_limit` de 3 à 5 (l'exemple de Railway, un `pg.Pool` et non Prisma, prend `max: 5` en précisant que ce n'est pas une règle [RW4]), à valider par mesure (`P2024`, attente côté PgBouncer). `pgbouncer=true` : déconseillé par Prisma à partir de PgBouncer 1.21 [PR4], encore conseillé par le guide Railway [RW3] ; aucune des deux sources ne le dit dangereux, le garder tant que la version n'est pas connue.
   - **Non** (connexion directe par le proxy TCP). Le total possible vaut « instances simultanées × `connection_limit` » et doit rester sous `max_connections` moins la marge des migrations et des outils. Prisma : partir de 1 et n'augmenter que si des requêtes parallèles expirent [PR3]. Sous Fluid, 1 met toutes les requêtes d'une instance en file [L26][V2] : soit activer le PgBouncer géré de Railway [RW3] (branche « oui »), soit rester à 1 en acceptant la file.
2. **`DIRECT_DATABASE_URL`** vise toujours PostgreSQL sans pooler (`DATABASE_PUBLIC_UNPOOLED_URL` chez Railway quand le pooler est activé) [RW3].
3. **Région** : fonctions et base dans la même région [V3] ; aujourd'hui `sfo1`, sujet tenu par `vercel-cost-performance` (un déplacement se fait avec la base, jamais sans elle).

Activer le PgBouncer de Railway change les URL exposées : `DATABASE_PUBLIC_URL` pointe alors vers le pooler, et les variables copiées dans Vercel doivent être mises à jour à la main [RW3].

## 5. Liste de contrôle à dérouler avant toute décision

```text
Railway  [ ] Service Postgres → Config → Connection Pooling : PgBouncer présent ? mode ? version ?
         [ ] Région du service ; version de PostgreSQL ; sauvegardes planifiées ; PITR activé ?
Vercel   [ ] Settings → Functions : Fluid compute activé ? région ?
         [ ] Variables d'environnement Production : DATABASE_URL et DIRECT_DATABASE_URL visent-elles
             le pooler et la base directe ? paramètres présents dans l'URL ?
         [ ] Variables Preview : quelle base ? (§ 8)
Base     [ ] SHOW max_connections;  SHOW server_version;
         [ ] SELECT state, count(*) FROM pg_stat_activity WHERE datname = current_database() GROUP BY 1;
         [ ] SELECT rolname, rolconfig FROM pg_roles WHERE rolname = current_user;   -- délais posés sur le rôle ?
         [ ] SELECT indexrelname, idx_scan FROM pg_stat_user_indexes ORDER BY idx_scan LIMIT 30;  -- index jamais lus
Sentry   [ ] Occurrences de P2024, P1001, P1017, P2028 sur 30 jours
```

Les requêtes SQL sont en lecture seule. Un agent ne les lance contre la production que sur demande explicite du propriétaire.

## 6. Délais de garde

PostgreSQL n'en a aucun par défaut : `statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout` valent 0 [PG8].

- **Transactions Prisma** : `maxWait` 2 s, `timeout` 5 s par défaut [PR1] ; les services de commande utilisent 5 s / 10 s. Ne pas aller au-delà sans raison écrite (`maxDuration` des routes : 30 s).
- **Requêtes de l'application** : poser `statement_timeout` (valeur à choisir sous le `maxDuration` de 30 s ; 15 s est une proposition de ce skill, pas une valeur sourcée) et `idle_in_transaction_session_timeout` sur le **rôle** de l'application (`ALTER ROLE … SET …`), pas dans `postgresql.conf` [PG8] et pas par `SET` de session, qu'un pooler en mode transaction ne conserve pas [PGB1][GH1]. Action du propriétaire, à inscrire dans A2.
- **Migrations** : `SET lock_timeout = '5s'` en tête de fichier, ou `?options=-c%20lock_timeout%3D5s` sur l'URL directe [L9]. Le paramètre `options` n'est pas accepté par PgBouncer sans configuration [PGB2] : URL directe uniquement.

## 7. Lire une erreur de connexion

| Code | Libellé [PR17] | Lecture ici |
|---|---|---|
| `P1001` | Can't reach database server | Base arrêtée, proxy injoignable, mauvaise URL |
| `P1017` | Server has closed the connection | Connexion coupée par la base, le proxy ou le pooler (inactivité, redémarrage) ; la requête suivante se reconnecte |
| `P2024` | Timed out fetching a new connection from the connection pool | Pool local épuisé : requête longue, trop de parallélisme pour `connection_limit`, `prisma.` dans une transaction quand `pool_timeout` est plus court que son `timeout` (§ 3) |
| `P2028` | Transaction API error | Transaction interactive expirée (`timeout`), connexion non obtenue (`maxWait`), ou `prisma.` dans le callback avec `connection_limit=1` (§ 3) |
| `P2034` | Write conflict or deadlock, please retry | Niveau `Serializable` ou interblocage : rejouer **toute** la transaction |
| `P2037` | Too many database connections opened | `max_connections` atteint côté base : trop d'instances × `connection_limit`, pas de pooler |
| `prepared statement "s0" already exists` | (erreur PostgreSQL) | Commande Prisma Migrate ou client sans `pgbouncer=true` à travers un pooler qui ne suit pas les requêtes préparées [PR4] |

`src/lib/api/errors.ts` reconnaît ces erreurs par fragments de texte : voir `api-route-conventions` avant d'y toucher.

## 8. Préversions, sauvegardes, Prisma 7

- **Préversions.** `scripts/prisma-migrate-prod-only.mjs` ne migre qu'en production et indique que `DIRECT_DATABASE_URL` n'existe que là. Si les préversions utilisent le `DATABASE_URL` de production, elles lisent et écrivent les données réelles avec un code non validé, et le mode test (autorisé en préversion par CLAUDE.md) agit alors sur la base de production. Prisma recommande une seconde base pour les préversions [PR13]. À vérifier puis trancher : arbitrage A4.
- **Sauvegardes Railway.** Les sauvegardes de volume sont planifiables (quotidienne gardée 6 jours, hebdomadaire 27, mensuelle 89), se restaurent dans le même projet et le même environnement, et disparaissent si le volume est effacé [RW2]. La restauration à un instant donné demande un espace Pro, doit être activée et ne couvre pas ce qui précède son activation [RW4]. Aucun SLA publié [RW4]. Avant toute migration destructive (phase de contraction) : sauvegarde manuelle. Suivi : `reliability-observability`.
- **Prisma 7** : ESM seulement, pilote `@prisma/adapter-pg` obligatoire, `prisma.config.ts`, `.env` non chargé, pool du pilote à la place de celui du moteur, plus de seed automatique [PR24][PR2]. Dependabot ignore les versions majeures de Prisma (CLAUDE.md). Ne pas monter de version dans le cadre d'un autre chantier. Les exemples v7 de la documentation ne s'appliquent pas tels quels : `--to-schema` n'existe pas dans notre CLI [PR25] ; `prisma.config.ts` y est accepté (option `--config`) mais le dépôt n'en a pas ; en ajouter un remplace `package.json#prisma` (notre commande de seed) et coupe le chargement automatique de `.env` par la CLI (messages lus dans `node_modules/@prisma/config` et `node_modules/prisma/build`) : hors périmètre d'un chantier de données. L'avertissement « `package.json#prisma` is deprecated » affiché par la CLI 6.19 est attendu.
