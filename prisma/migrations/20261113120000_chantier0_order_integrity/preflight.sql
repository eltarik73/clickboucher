-- Pré-vol de la migration 20261113120000_chantier0_order_integrity (Prisma ignore ce fichier).
--
-- Exécuté par scripts/prisma-migrate-prod-only.mjs AVANT `prisma migrate deploy`, sur la connexion
-- directe. Lecture seule : aucune écriture, aucun DDL, aucune table temporaire.
-- But : la base de production a surtout été construite par `prisma db push` ; si elle s'écarte de ce
-- que migration.sql suppose, la migration échouerait, serait inscrite « en échec » dans
-- _prisma_migrations et bloquerait tous les déploiements suivants (P3009). Ici, un échec ne laisse
-- aucune trace : le build s'arrête avec la liste COMPLÈTE des préconditions non remplies.
--
-- Sans effet si la migration est déjà appliquée. Les noms sont résolus dans current_schema().
-- Les contrôles de données ne sont faits que si la structure est conforme.

DO $$
DECLARE
    migration CONSTANT text := '20261113120000_chantier0_order_integrity';
    sch CONSTANT text := current_schema();
    errs text[] := ARRAY[]::text[];
    applied boolean := false;
    rel_oid oid;
    idx_oid oid;
    typ text;
    n bigint;
    r record;
BEGIN
    IF sch IS NULL THEN
        RAISE EXCEPTION 'preflight chantier0: aucun schéma courant (search_path vide)';
    END IF;

    -- 0) Migration déjà appliquée : rien à vérifier. Sans table _prisma_migrations, elle ne l'est pas.
    IF to_regclass(format('%I.%I', sch, '_prisma_migrations')) IS NOT NULL THEN
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I._prisma_migrations WHERE migration_name = $1'
                       ' AND finished_at IS NOT NULL AND rolled_back_at IS NULL)', sch)
            INTO applied USING migration;
        IF applied THEN
            RAISE NOTICE 'preflight chantier0: migration déjà appliquée, contrôles ignorés';
            RETURN;
        END IF;
    END IF;

    -- 1) Tables lues ou écrites. Les deux tables créées par « IF NOT EXISTS » sont facultatives,
    --    mais leur nom ne doit pas être pris par autre chose qu'une table (sinon création ignorée).
    FOR r IN SELECT * FROM (VALUES
        ('orders', true, 'lue et modifiée (§1, §2, §3)'),
        ('users', true, 'lue (§2) et cible de clé étrangère'),
        ('shops', true, 'cible de clé étrangère (§2)'),
        ('customer_counters', true, 'INSERT … ON CONFLICT ("shop_id") (§2)'),
        ('order_number_counters', false, 'CREATE TABLE IF NOT EXISTS (§1)'),
        ('shop_customers', false, 'CREATE TABLE IF NOT EXISTS (§2)')
    ) v(tbl, required, why) LOOP
        SELECT c.relkind::text INTO typ
        FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
        WHERE ns.nspname = sch AND c.relname = r.tbl;
        IF typ IS NULL AND r.required THEN
            errs := errs || format('table %I.%I absente — %s', sch, r.tbl, r.why);
        ELSIF typ IS NOT NULL AND typ NOT IN ('r', 'p') THEN
            errs := errs || format('%I.%I existe mais n''est pas une table (relkind %s) — %s', sch, r.tbl, typ, r.why);
        END IF;
    END LOOP;

    -- 2) Colonnes et types. kind : text = text/varchar, int4 = integer exact (forme créée par la
    --    migration), int = integer/bigint, ts = timestamp sans fuseau. Une table absente est déjà signalée.
    FOR r IN SELECT * FROM (VALUES
        ('orders', 'order_number', 'text', true, 'filtre regex et substring (§1)'),
        ('orders', 'shop_id', 'text', true, 'INSERT shop_customers et UPDATE orders (§2, §3)'),
        ('orders', 'user_id', 'text', true, 'jointure users, INSERT shop_customers, UPDATE orders (§2, §3)'),
        ('orders', 'service_fee_cents', 'int', true, 'ALTER COLUMN … SET DEFAULT 0 (§3)'),
        ('orders', 'customer_number', 'int4', false, 'ADD COLUMN IF NOT EXISTS … INTEGER (§3)'),
        ('users', 'id', 'text', true, 'jointure et clé étrangère shop_customers.user_id (§2)'),
        ('users', 'customer_number', 'text', true, 'reprise des numéros « C-n » (§2)'),
        ('shops', 'id', 'text', true, 'clé étrangère shop_customers.shop_id (§2)'),
        ('customer_counters', 'id', 'text', true, 'INSERT (id = ''cc_'' || md5) (§2)'),
        ('customer_counters', 'shop_id', 'text', true, 'INSERT … ON CONFLICT ("shop_id") (§2)'),
        ('customer_counters', 'last_number', 'int', true, 'INSERT et GREATEST (§2)'),
        ('order_number_counters', 'year', 'int4', true, 'table déjà présente : forme attendue (§1)'),
        ('order_number_counters', 'last_number', 'int4', true, 'table déjà présente : forme attendue (§1)'),
        ('shop_customers', 'shop_id', 'text', true, 'table déjà présente : forme attendue (§2)'),
        ('shop_customers', 'user_id', 'text', true, 'table déjà présente : forme attendue (§2)'),
        ('shop_customers', 'number', 'int4', true, 'table déjà présente : forme attendue (§2)'),
        ('shop_customers', 'created_at', 'ts', true, 'table déjà présente : forme attendue (§2)')
    ) v(tbl, col, kind, required, why) LOOP
        rel_oid := to_regclass(format('%I.%I', sch, r.tbl));
        CONTINUE WHEN rel_oid IS NULL;
        SELECT a.atttypid::regtype::text INTO typ
        FROM pg_attribute a
        WHERE a.attrelid = rel_oid AND a.attname = r.col AND a.attnum > 0 AND NOT a.attisdropped;
        IF typ IS NULL THEN
            IF r.required THEN
                errs := errs || format('colonne %I.%I absente — %s', r.tbl, r.col, r.why);
            END IF;
        ELSIF NOT (
            (r.kind = 'text' AND typ IN ('text', 'character varying'))
            OR (r.kind = 'int4' AND typ = 'integer')
            OR (r.kind = 'int' AND typ IN ('integer', 'bigint'))
            OR (r.kind = 'ts' AND typ = 'timestamp without time zone')
        ) THEN
            errs := errs || format('colonne %I.%I de type %s, attendu %s — %s', r.tbl, r.col, typ, r.kind, r.why);
        END IF;
    END LOOP;

    -- customer_counters.id reçoit 'cc_' || md5(...) = 35 caractères.
    SELECT a.atttypmod - 4 INTO n
    FROM pg_attribute a
    WHERE a.attrelid = to_regclass(format('%I.%I', sch, 'customer_counters')) AND a.attname = 'id'
      AND a.atttypid = 'character varying'::regtype AND a.atttypmod > 0;
    IF n IS NOT NULL AND n < 35 THEN
        errs := errs || format('colonne customer_counters.id limitée à %s caractères, 35 nécessaires (§2)', n);
    END IF;

    -- 3) Colonnes NOT NULL sans défaut que les INSERT de la migration ne remplissent pas.
    FOR r IN SELECT * FROM (VALUES
        ('customer_counters', ARRAY['id', 'shop_id', 'last_number']),
        ('order_number_counters', ARRAY['year', 'last_number']),
        ('shop_customers', ARRAY['shop_id', 'user_id', 'number'])
    ) v(tbl, filled) LOOP
        rel_oid := to_regclass(format('%I.%I', sch, r.tbl));
        CONTINUE WHEN rel_oid IS NULL;
        SELECT string_agg(quote_ident(a.attname), ', ') INTO typ
        FROM pg_attribute a
        WHERE a.attrelid = rel_oid AND a.attnum > 0 AND NOT a.attisdropped
          AND a.attnotnull AND NOT a.atthasdef AND a.attidentity = '' AND a.attgenerated = ''
          AND a.attname::text <> ALL (r.filled);
        IF typ IS NOT NULL THEN
            errs := errs || format('%I : colonne(s) NOT NULL sans défaut non remplie(s) par l''INSERT de la migration : %s', r.tbl, typ);
        END IF;
    END LOOP;

    -- 4) Index uniques exigés (ON CONFLICT, cibles de clé étrangère, forme des tables déjà présentes) :
    --    unique, non différé, valide, sans prédicat ni expression, exactement sur ces colonnes.
    FOR r IN SELECT * FROM (VALUES
        ('customer_counters', ARRAY['shop_id'], 'ON CONFLICT ("shop_id") (§2)'),
        ('shops', ARRAY['id'], 'cible de la clé étrangère shop_customers_shop_id_fkey (§2)'),
        ('users', ARRAY['id'], 'cible de la clé étrangère shop_customers_user_id_fkey (§2)'),
        ('order_number_counters', ARRAY['year'], 'ON CONFLICT ("year") (§1)'),
        ('shop_customers', ARRAY['shop_id', 'user_id'], 'clé primaire attendue (§2)')
    ) v(tbl, cols, why) LOOP
        rel_oid := to_regclass(format('%I.%I', sch, r.tbl));
        CONTINUE WHEN rel_oid IS NULL;
        IF NOT EXISTS (
            SELECT 1 FROM pg_index i
            WHERE i.indrelid = rel_oid AND i.indisunique AND i.indimmediate AND i.indisvalid
              AND i.indpred IS NULL AND i.indexprs IS NULL
              AND (SELECT array_agg(a.attname::text)
                   FROM unnest(i.indkey::int2[]) WITH ORDINALITY k(attnum, ord)
                   JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
                   WHERE k.ord <= i.indnkeyatts) @> r.cols
              AND i.indnkeyatts = cardinality(r.cols)
        ) THEN
            errs := errs || format('aucun index unique (ou clé primaire) sur %I(%s) — %s', r.tbl, array_to_string(r.cols, ', '), r.why);
        END IF;
    END LOOP;

    -- 5) Objets nommés que « IF NOT EXISTS » ignorerait s'ils existaient déjà.
    IF to_regclass(format('%I.%I', sch, 'shop_customers')) IS NULL THEN
        FOREACH typ IN ARRAY ARRAY['shop_customers_pkey', 'shop_customers_shop_id_number_key'] LOOP
            IF to_regclass(format('%I.%I', sch, typ)) IS NOT NULL THEN
                errs := errs || format('le nom %I est déjà pris dans le schéma %I alors que shop_customers n''existe pas (§2)', typ, sch);
            END IF;
        END LOOP;
    END IF;
    IF to_regclass(format('%I.%I', sch, 'order_number_counters')) IS NULL
       AND to_regclass(format('%I.%I', sch, 'order_number_counters_pkey')) IS NOT NULL THEN
        errs := errs || format('le nom order_number_counters_pkey est déjà pris dans le schéma %I alors que order_number_counters n''existe pas (§1)', sch);
    END IF;

    rel_oid := to_regclass(format('%I.%I', sch, 'shop_customers'));
    IF rel_oid IS NOT NULL THEN
        idx_oid := to_regclass(format('%I.%I', sch, 'shop_customers_shop_id_number_key'));
        IF idx_oid IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM pg_index i
            WHERE i.indexrelid = idx_oid AND i.indrelid = rel_oid
              AND i.indisunique AND i.indisvalid AND i.indpred IS NULL AND i.indexprs IS NULL
              AND i.indnkeyatts = 2
              AND (SELECT array_agg(a.attname::text)
                   FROM unnest(i.indkey::int2[]) WITH ORDINALITY k(attnum, ord)
                   JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
                   WHERE k.ord <= i.indnkeyatts) @> ARRAY['shop_id', 'number']
        ) THEN
            errs := errs || 'shop_customers_shop_id_number_key existe mais n''est pas un index unique sur shop_customers(shop_id, number) (§2)';
        END IF;

        FOR r IN SELECT * FROM (VALUES
            ('shop_customers_shop_id_fkey', 'shop_id', 'shops'),
            ('shop_customers_user_id_fkey', 'user_id', 'users')
        ) v(con, col, target) LOOP
            IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = r.con AND conrelid = rel_oid)
               AND NOT EXISTS (
                SELECT 1 FROM pg_constraint c
                WHERE c.conname = r.con AND c.conrelid = rel_oid AND c.contype = 'f'
                  AND c.confrelid = to_regclass(format('%I.%I', sch, r.target))
                  AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = rel_oid AND attname = r.col)]
                  AND c.confkey = ARRAY[(SELECT attnum FROM pg_attribute
                                         WHERE attrelid = to_regclass(format('%I.%I', sch, r.target)) AND attname = 'id')]
            ) THEN
                errs := errs || format('la contrainte %I existe mais n''est pas une clé étrangère shop_customers(%s) → %s(id) (§2)', r.con, r.col, r.target);
            END IF;
        END LOOP;
    END IF;

    -- 6) Données : uniquement si la structure est conforme (les requêtes ci-dessous en dépendent).
    IF cardinality(errs) = 0 THEN
        -- §2 : chaque ligne reprise dans shop_customers doit avoir une boutique existante.
        EXECUTE format(
            'SELECT count(*) FROM %1$I.orders o JOIN %1$I.users u ON u.id = o.user_id'
            ' WHERE u.customer_number ~ ''^C-[0-9]{1,9}$'''
            ' AND (o.shop_id IS NULL OR NOT EXISTS (SELECT 1 FROM %1$I.shops s WHERE s.id = o.shop_id))', sch)
            INTO n;
        IF n > 0 THEN
            errs := errs || format('%s commande(s) de clients numérotés sans boutique existante : la reprise dans shop_customers violerait la clé étrangère (§2)', n);
        END IF;

        IF rel_oid IS NOT NULL THEN
            IF to_regclass(format('%I.%I', sch, 'shop_customers_shop_id_number_key')) IS NULL THEN
                EXECUTE format('SELECT count(*) FROM (SELECT 1 FROM %I.shop_customers GROUP BY shop_id, number HAVING count(*) > 1) d', sch)
                    INTO n;
                IF n > 0 THEN
                    errs := errs || format('shop_customers : %s doublon(s) (shop_id, number), l''index unique ne pourrait pas être créé (§2)', n);
                END IF;
            END IF;
            FOR r IN SELECT * FROM (VALUES
                ('shop_customers_shop_id_fkey', 'shop_id', 'shops'),
                ('shop_customers_user_id_fkey', 'user_id', 'users')
            ) v(con, col, target) LOOP
                CONTINUE WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname = r.con AND conrelid = rel_oid);
                EXECUTE format('SELECT count(*) FROM %1$I.shop_customers sc WHERE NOT EXISTS'
                               ' (SELECT 1 FROM %1$I.%2$I t WHERE t.id = sc.%3$I)', sch, r.target, r.col)
                    INTO n;
                IF n > 0 THEN
                    errs := errs || format('shop_customers : %s ligne(s) dont %s n''existe pas dans %s, la clé étrangère %s ne pourrait pas être ajoutée (§2)', n, r.col, r.target, r.con);
                END IF;
            END LOOP;
        END IF;
    END IF;

    IF cardinality(errs) > 0 THEN
        RAISE EXCEPTION E'preflight chantier0: % précondition(s) non remplie(s) dans le schéma %, migration % NON appliquée :\n - %',
            cardinality(errs), sch, migration, array_to_string(errs, E'\n - ');
    END IF;

    RAISE NOTICE 'preflight chantier0: toutes les préconditions sont remplies';
END $$;
