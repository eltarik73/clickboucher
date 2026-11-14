-- Pré-vol de la migration 20261114120000_c1_invites (Prisma ignore ce fichier).
--
-- Exécuté par scripts/prisma-migrate-prod-only.mjs AVANT `prisma migrate deploy`, sur la connexion
-- directe. Lecture seule : aucune écriture, aucun DDL, aucune table temporaire.
-- But : si la base s'écarte de ce que migration.sql suppose, la migration échouerait, serait
-- inscrite « en échec » dans _prisma_migrations et bloquerait tous les déploiements suivants
-- (P3009). Ici, un échec ne laisse aucune trace : le build s'arrête avec la liste COMPLÈTE des
-- préconditions non remplies.
--
-- Sans effet si la migration est déjà appliquée. Les noms sont résolus dans current_schema().

DO $$
DECLARE
    migration CONSTANT text := '20261114120000_c1_invites';
    sch CONSTANT text := current_schema();
    errs text[] := ARRAY[]::text[];
    applied boolean := false;
    rel_oid oid;
    typ text;
    not_null boolean;
    r record;
BEGIN
    IF sch IS NULL THEN
        RAISE EXCEPTION 'preflight c1_invites: aucun schéma courant (search_path vide)';
    END IF;

    -- 0) Migration déjà appliquée : rien à vérifier. Sans table _prisma_migrations, elle ne l'est pas.
    IF to_regclass(format('%I.%I', sch, '_prisma_migrations')) IS NOT NULL THEN
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I._prisma_migrations WHERE migration_name = $1'
                       ' AND finished_at IS NOT NULL AND rolled_back_at IS NULL)', sch)
            INTO applied USING migration;
        IF applied THEN
            RAISE NOTICE 'preflight c1_invites: migration déjà appliquée, contrôles ignorés';
            RETURN;
        END IF;
    END IF;

    -- 1) Tables modifiées ou lues.
    FOR r IN SELECT * FROM (VALUES
        ('orders', 'ALTER TABLE … ADD COLUMN et UPDATE (§1 à §4)'),
        ('users', 'lue par l''UPDATE … FROM (§3)')
    ) v(tbl, why) LOOP
        SELECT c.relkind::text INTO typ
        FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
        WHERE ns.nspname = sch AND c.relname = r.tbl;
        IF typ IS NULL THEN
            errs := errs || format('table %I.%I absente — %s', sch, r.tbl, r.why);
        ELSIF typ NOT IN ('r', 'p') THEN
            errs := errs || format('%I.%I existe mais n''est pas une table (relkind %s) — %s', sch, r.tbl, typ, r.why);
        END IF;
    END LOOP;

    -- 2) Colonnes lues par l'UPDATE (obligatoires) et colonnes ajoutées par « IF NOT EXISTS »
    --    (facultatives : si elles existent déjà, l'ajout est ignoré, elles doivent donc avoir la
    --    forme attendue). kind : text = text/varchar, text_exact = text, bool = boolean.
    FOR r IN SELECT * FROM (VALUES
        ('users', 'id', 'text', true, 'jointure de l''UPDATE (§3)'),
        ('users', 'guest_token', 'text', true, 'haché par l''UPDATE (§3)'),
        ('users', 'is_guest', 'bool', true, 'filtre de l''UPDATE (§3)'),
        ('orders', 'user_id', 'text', true, 'jointure de l''UPDATE (§3)'),
        ('orders', 'access_token_hash', 'text_exact', false, 'ADD COLUMN IF NOT EXISTS … TEXT (§1)'),
        ('orders', 'placed_as_guest', 'bool', false, 'ADD COLUMN IF NOT EXISTS … BOOLEAN NOT NULL DEFAULT false (§2)'),
        ('orders', 'customer_first_name', 'text_exact', false, 'ADD COLUMN IF NOT EXISTS … TEXT (§4)'),
        ('orders', 'customer_last_name', 'text_exact', false, 'ADD COLUMN IF NOT EXISTS … TEXT (§4)'),
        ('orders', 'customer_phone', 'text_exact', false, 'ADD COLUMN IF NOT EXISTS … TEXT (§4)')
    ) v(tbl, col, kind, required, why) LOOP
        rel_oid := to_regclass(format('%I.%I', sch, r.tbl));
        CONTINUE WHEN rel_oid IS NULL;
        typ := NULL;
        SELECT a.atttypid::regtype::text, a.attnotnull INTO typ, not_null
        FROM pg_attribute a
        WHERE a.attrelid = rel_oid AND a.attname = r.col AND a.attnum > 0 AND NOT a.attisdropped;
        IF typ IS NULL THEN
            IF r.required THEN
                errs := errs || format('colonne %I.%I absente — %s', r.tbl, r.col, r.why);
            END IF;
        ELSIF NOT (
            (r.kind = 'text' AND typ IN ('text', 'character varying'))
            OR (r.kind = 'text_exact' AND typ = 'text')
            OR (r.kind = 'bool' AND typ = 'boolean')
        ) THEN
            errs := errs || format('colonne %I.%I de type %s, attendu %s — %s', r.tbl, r.col, typ, r.kind, r.why);
        ELSIF r.tbl = 'orders' AND r.col = 'placed_as_guest' AND NOT not_null THEN
            errs := errs || format('colonne orders.placed_as_guest déjà présente mais acceptant NULL — %s', r.why);
        END IF;
    END LOOP;

    -- 3) Fonctions de hachage de l'UPDATE (sha256 : PostgreSQL ≥ 11).
    IF to_regprocedure('sha256(bytea)') IS NULL THEN
        errs := errs || 'fonction sha256(bytea) introuvable (PostgreSQL 11 ou plus requis) (§3)'::text;
    END IF;
    IF to_regprocedure('convert_to(text,name)') IS NULL THEN
        errs := errs || 'fonction convert_to(text, name) introuvable (§3)'::text;
    END IF;

    IF cardinality(errs) > 0 THEN
        RAISE EXCEPTION E'preflight c1_invites: % précondition(s) non remplie(s) dans le schéma %, migration % NON appliquée :\n - %',
            cardinality(errs), sch, migration, array_to_string(errs, E'\n - ');
    END IF;

    RAISE NOTICE 'preflight c1_invites: toutes les préconditions sont remplies';
END $$;
