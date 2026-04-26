# DB Runbook — Klik&Go (PostgreSQL on Railway)

Operational playbook for migrations, rollbacks, hot fixes, and DB health.
Pragmatic, not theoretical. Copy-paste commands.

## Stack rappel

- **PostgreSQL** : Railway (managed)
- **ORM** : Prisma 5.x
- **Migrations** : `prisma/migrations/`
- **Conn string** : `DATABASE_URL` (Railway prod) / `.env.local` (dev)
- **Pooler** : Railway PgBouncer recommandé pour serverless

---

## 1. Migration normale (ajout colonne, table, index)

```bash
# 1. Local — créer la migration
npx prisma migrate dev --name add_<feature>

# 2. Vérifier le SQL généré
cat prisma/migrations/<timestamp>_add_<feature>/migration.sql

# 3. Commit (CRITIQUE — schema + migration ensemble)
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add <feature>"

# 4. Prod — déployé automatiquement par le build script (npm run build)
#    qui execute `prisma migrate deploy`
git push
```

**JAMAIS `migrate dev` en prod.** Toujours `migrate deploy`.

---

## 2. Rollback d'une migration appliquée

Prisma ne génère **pas** de scripts "down". Trois stratégies, par ordre de préférence :

### 2.a — Forward-fix (recommandé)

Le moyen le plus sûr : créer une nouvelle migration qui **annule l'effet** de la précédente.

```bash
# Exemple : on a ajouté une colonne `bad_field` qu'il faut supprimer
npx prisma migrate dev --name revert_bad_field
# Edit schema.prisma : retirer le champ
# Prisma génère DROP COLUMN
git add prisma/ && git commit -m "fix(db): revert bad_field" && git push
```

### 2.b — SQL down manuel (urgence prod)

Si rien n'est encore committé en prod et qu'il faut annuler une migration appliquée :

```bash
# 1. Connecter à la prod
railway link
railway run psql $DATABASE_URL

# 2. Inspecter _prisma_migrations
SELECT id, migration_name, applied_steps_count, finished_at
FROM _prisma_migrations
ORDER BY finished_at DESC LIMIT 5;

# 3. Écrire le SQL d'annulation manuellement (ex: DROP COLUMN, DROP TABLE)
BEGIN;
ALTER TABLE "Order" DROP COLUMN "bad_field";
DELETE FROM _prisma_migrations WHERE migration_name = '20260426120000_add_bad_field';
COMMIT;

# 4. Supprimer le dossier migration en local
rm -rf prisma/migrations/20260426120000_add_bad_field
git rm -r prisma/migrations/20260426120000_add_bad_field
# Réaligner schema.prisma sur la prod
git commit -m "revert(db): drop bad_field migration"
```

### 2.c — Restore from Railway PITR

Last resort. Voir section 3.

---

## 3. Restauration full DB (Railway PITR)

Railway garde des **point-in-time backups** sur les plans Pro+.

```bash
# 1. Console Railway → Postgres service → "Backups" tab
# 2. Choisir le timestamp cible (granularité ~5 min)
# 3. "Restore" — crée une nouvelle DB à partir du backup
# 4. Récupérer la nouvelle DATABASE_URL
# 5. Mettre à jour les env vars Vercel :
vercel env rm DATABASE_URL production
vercel env add DATABASE_URL production  # paste new URL
vercel --prod  # redeploy

# 6. Smoke test
curl https://klikandgo.app/api/health
```

**Coupure attendue** : 5–10 min. Prévenir les bouchers.

---

## 4. Hot fix urgence — Checklist

Quand quelque chose pète en prod et qu'il faut bouger vite :

- [ ] Snapshot manuel : Railway → "Backups" → "Create snapshot now"
- [ ] Vérifier Sentry pour le scope de l'erreur
- [ ] Couper le traffic si data-corruption en cours :
  - Vercel → "Deployments" → rollback to previous green
- [ ] Si fix DB nécessaire : ouvrir psql via `railway run psql`
- [ ] Toujours `BEGIN; … COMMIT;` (pas d'auto-commit)
- [ ] Tester sur un row avant : `SELECT … LIMIT 1;` puis `UPDATE … WHERE id = 'xxx';`
- [ ] Logger dans `#incidents` Slack
- [ ] Post-mortem dans les 24h

---

## 5. Reset DB locale (test mode)

```bash
# Reset complet (DROP + recreate + migrations + skip seed)
npx prisma migrate reset --skip-seed

# Avec seed
npm run db:reset

# Just push schema sans migration (prototypage rapide)
npm run db:push
```

---

## 6. Connection pool — paramètres recommandés

PgBouncer (Railway) — `?pgbouncer=true` dans DATABASE_URL.

| Paramètre               | Dev   | Prod (Vercel serverless) | Notes                              |
|-------------------------|-------|--------------------------|------------------------------------|
| `connection_limit`      | 5     | 1                        | Vercel = 1 connexion / lambda      |
| `pool_timeout`          | 10s   | 10s                      |                                    |
| `pgbouncer`             | false | true                     | Mode transaction                   |
| `statement_cache_size`  | —     | 0                        | Obligatoire avec PgBouncer trans   |
| `connect_timeout`       | 10    | 5                        | Fail-fast en prod                  |

Exemple prod :
```
postgres://user:pwd@host:5432/db?pgbouncer=true&connection_limit=1&statement_cache_size=0&connect_timeout=5
```

---

## 7. Monitoring DB

### Queries lentes

```sql
-- Top 10 queries les plus lentes (depuis pg_stat_statements)
SELECT
  substring(query, 1, 80) AS short_query,
  calls,
  round(total_exec_time::numeric, 0) AS total_ms,
  round(mean_exec_time::numeric, 2) AS mean_ms,
  rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

Activation : `CREATE EXTENSION IF NOT EXISTS pg_stat_statements;`

### Lock detection

```sql
-- Locks en cours
SELECT
  pid,
  usename,
  state,
  wait_event_type,
  wait_event,
  query
FROM pg_stat_activity
WHERE state != 'idle'
  AND query NOT LIKE '%pg_stat_activity%';

-- Tuer une query qui locke (en dernier recours)
SELECT pg_cancel_backend(<pid>);   -- soft cancel
SELECT pg_terminate_backend(<pid>); -- hard kill
```

### Index manquants

```sql
-- Tables avec beaucoup de seq scans (= indexes manquants)
SELECT
  schemaname,
  relname,
  seq_scan,
  idx_scan,
  seq_tup_read,
  pg_size_pretty(pg_relation_size(relid)) AS size
FROM pg_stat_user_tables
WHERE seq_scan > idx_scan AND seq_scan > 1000
ORDER BY seq_tup_read DESC
LIMIT 20;
```

### Bloat

```sql
-- Taille des tables (données + index)
SELECT
  relname,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;
```

---

## 8. Backup manuel (avant opération sensible)

```bash
# Dump complet
railway run pg_dump $DATABASE_URL -Fc -f backup_$(date +%Y%m%d_%H%M).dump

# Restore
railway run pg_restore -d $DATABASE_URL backup_xxx.dump
```

---

## 9. Conseils anti-incident

- **JAMAIS** `prisma migrate dev` en prod
- **JAMAIS** modifier le schema sans committer la migration en même temps
- **JAMAIS** `DROP TABLE` sans backup snapshot dans la minute précédente
- **JAMAIS** `DELETE FROM <table>` sans `WHERE` (testez `SELECT` avant)
- **TOUJOURS** transaction explicite (`BEGIN; … COMMIT;`)
- **TOUJOURS** vérifier `_prisma_migrations` avant rollback
- **TOUJOURS** prévenir les bouchers si downtime > 30s
