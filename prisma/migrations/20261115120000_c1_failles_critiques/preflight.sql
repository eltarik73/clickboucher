-- Pré-vol de la migration 20261115120000_c1_failles_critiques (Prisma ignore ce fichier).
--
-- Exécuté par scripts/prisma-migrate-prod-only.mjs AVANT `prisma migrate deploy`, sur la connexion
-- directe. Lecture seule : aucune écriture, aucun DDL, aucune table temporaire.
-- But : migration.sql ajoute trois colonnes « si elles n'existent pas ». Une colonne déjà présente
-- avec un autre type, NOT NULL ou un défaut serait gardée telle quelle, et le nouveau code, qui
-- lit « suspended_at non NULL = boutique suspendue », se tromperait en silence. Ici, un échec ne
-- laisse aucune trace : le build s'arrête avec la liste COMPLÈTE des préconditions non remplies.
--
-- Sans effet si la migration est déjà appliquée. Les noms sont résolus dans current_schema().

DO $$
DECLARE
    migration CONSTANT text := '20261115120000_c1_failles_critiques';
    sch CONSTANT text := current_schema();
    errs text[] := ARRAY[]::text[];
    applied boolean := false;
    rel_oid oid;
    rel_kind text;
    typ text;
    not_null boolean;
    has_default boolean;
    hidden_now bigint;
    r record;
BEGIN
    IF sch IS NULL THEN
        RAISE EXCEPTION 'preflight c1_failles_critiques: aucun schéma courant (search_path vide)';
    END IF;

    -- 0) Migration déjà appliquée : rien à vérifier. Sans table _prisma_migrations, elle ne l'est pas.
    IF to_regclass(format('%I.%I', sch, '_prisma_migrations')) IS NOT NULL THEN
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I._prisma_migrations WHERE migration_name = $1'
                       ' AND finished_at IS NOT NULL AND rolled_back_at IS NULL)', sch)
            INTO applied USING migration;
        IF applied THEN
            RAISE NOTICE 'preflight c1_failles_critiques: migration déjà appliquée, contrôles ignorés';
            RETURN;
        END IF;
    END IF;

    -- 1) Table modifiée.
    rel_oid := to_regclass(format('%I.%I', sch, 'shops'));
    SELECT c.relkind::text INTO rel_kind FROM pg_class c WHERE c.oid = rel_oid;
    IF rel_oid IS NULL THEN
        errs := errs || format('table %I.shops absente — ALTER TABLE … ADD COLUMN', sch);
    ELSIF rel_kind NOT IN ('r', 'p') THEN
        errs := errs || format('%I.shops existe mais n''est pas une table (relkind %s) — ALTER TABLE … ADD COLUMN',
                               sch, rel_kind);
    END IF;

    -- 2) Colonnes ajoutées par « IF NOT EXISTS » : si elles existent déjà, l'ajout est ignoré, elles
    --    doivent donc avoir exactement la forme que le schéma Prisma déclare (nullables, sans défaut).
    IF rel_kind IN ('r', 'p') THEN
        FOR r IN SELECT * FROM (VALUES
            ('validated_at', 'timestamp(3) without time zone', 'date de validation par l''administration'),
            ('suspended_at', 'timestamp(3) without time zone', 'non NULL = boutique suspendue'),
            ('suspend_reason', 'text', 'motif de la suspension')
        ) v(col, expected, why) LOOP
            typ := NULL;
            SELECT format_type(a.atttypid, a.atttypmod), a.attnotnull, a.atthasdef
            INTO typ, not_null, has_default
            FROM pg_attribute a
            WHERE a.attrelid = rel_oid AND a.attname = r.col AND a.attnum > 0 AND NOT a.attisdropped;
            CONTINUE WHEN typ IS NULL;
            IF typ <> r.expected THEN
                errs := errs || format('colonne shops.%I de type %s, attendu %s — %s', r.col, typ, r.expected, r.why);
            END IF;
            IF not_null THEN
                errs := errs || format('colonne shops.%I déjà présente mais NOT NULL, attendu nullable — %s', r.col, r.why);
            END IF;
            IF has_default THEN
                errs := errs || format('colonne shops.%I déjà présente avec une valeur par défaut, attendu aucune — %s',
                                       r.col, r.why);
            END IF;
        END LOOP;
    END IF;

    IF cardinality(errs) > 0 THEN
        RAISE EXCEPTION E'preflight c1_failles_critiques: % précondition(s) non remplie(s) dans le schéma %, migration % NON appliquée :\n - %',
            cardinality(errs), sch, migration, array_to_string(errs, E'\n - ');
    END IF;

    -- 3) Information, jamais bloquante : boutiques encore listées dont suspended_at est rempli. Le
    --    nouveau code les traite comme suspendues (masquées, page introuvable, commandes refusées).
    --    Cas attendu : une boutique suspendue par ce code, puis « réactivée » par le code précédent
    --    après un retour arrière (il ne vide pas suspended_at) ; voir rollback.sql.
    IF EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = rel_oid AND a.attname = 'suspended_at'
               AND a.attnum > 0 AND NOT a.attisdropped) THEN
        EXECUTE format('SELECT count(*) FROM %I.shops WHERE suspended_at IS NOT NULL AND visible', sch)
            INTO hidden_now;
        RAISE NOTICE 'preflight c1_failles_critiques: % boutique(s) listée(s) avec suspended_at rempli, que le nouveau code traitera comme suspendue(s)',
            hidden_now;
    END IF;

    RAISE NOTICE 'preflight c1_failles_critiques: toutes les préconditions sont remplies';
END $$;
