-- Pré-vol de la migration 20261116120000_c1_paiement_a (Prisma ignore ce fichier).
--
-- Exécuté par scripts/prisma-migrate-prod-only.mjs AVANT `prisma migrate deploy`, sur la connexion
-- directe. Lecture seule : aucune écriture, aucun DDL, aucune table temporaire.
-- But : migration.sql crée « si absents » deux types, une table, des colonnes et des index, puis
-- deux index UNIQUES sur orders. Un objet déjà présent sous une autre forme serait gardé tel quel
-- en silence (une marge de pesée avec une valeur par défaut serait une case pré-cochée), et deux
-- commandes portant le même identifiant Stripe feraient échouer la migration, inscrite « en échec »
-- dans _prisma_migrations, ce qui bloquerait tous les déploiements suivants (P3009). Ici, un échec
-- ne laisse aucune trace : le build s'arrête avec la liste COMPLÈTE des préconditions non remplies.
--
-- Sans effet si la migration est déjà appliquée. Les noms sont résolus dans current_schema().
-- Les contrôles de données ne sont faits que si la structure est conforme.

DO $$
DECLARE
    migration CONSTANT text := '20261116120000_c1_paiement_a';
    sch CONSTANT text := current_schema();
    errs text[] := ARRAY[]::text[];
    applied boolean := false;
    rel_oid oid;
    disputes_oid oid;
    kind text;
    typ text;
    not_null boolean;
    has_default boolean;
    labels text[];
    n bigint;
    sample text;
    r record;
BEGIN
    IF sch IS NULL THEN
        RAISE EXCEPTION 'preflight c1_paiement_a: aucun schéma courant (search_path vide)';
    END IF;

    -- 0) Migration déjà appliquée : rien à vérifier. Sans table _prisma_migrations, elle ne l'est pas.
    IF to_regclass(format('%I.%I', sch, '_prisma_migrations')) IS NOT NULL THEN
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I._prisma_migrations WHERE migration_name = $1'
                       ' AND finished_at IS NOT NULL AND rolled_back_at IS NULL)', sch)
            INTO applied USING migration;
        IF applied THEN
            RAISE NOTICE 'preflight c1_paiement_a: migration déjà appliquée, contrôles ignorés';
            RETURN;
        END IF;
    END IF;

    -- 1) Tables modifiées (obligatoires) ; stripe_disputes, créée « si absente », ne doit pas avoir
    --    son nom pris par autre chose qu'une table.
    FOR r IN SELECT * FROM (VALUES
        ('shops', true), ('users', true), ('orders', true), ('price_adjustments', true),
        ('stripe_events', true), ('stripe_disputes', false)
    ) v(tbl, required) LOOP
        SELECT c.relkind::text INTO kind
        FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
        WHERE ns.nspname = sch AND c.relname = r.tbl;
        IF kind IS NULL AND r.required THEN
            errs := errs || format('table %I.%I absente — ALTER TABLE … ADD COLUMN', sch, r.tbl);
        ELSIF kind IS NOT NULL AND kind NOT IN ('r', 'p') THEN
            errs := errs || format('%I.%I existe mais n''est pas une table (relkind %s)', sch, r.tbl, kind);
        END IF;
    END LOOP;
    disputes_oid := to_regclass(format('%I.%I', sch, 'stripe_disputes'));

    -- 2) Types créés « si absents » : déjà présents, ils doivent avoir exactement ces valeurs.
    FOR r IN SELECT * FROM (VALUES
        ('WeighTolerance', ARRAY['STANDARD', 'EXTENDED']),
        ('AdjustmentCloseReason', ARRAY['CUSTOMER_REFUSED', 'NO_ANSWER', 'ORDER_CHANGED'])
    ) v(type_name, expected) LOOP
        SELECT t.typtype::text, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FILTER (WHERE e.enumlabel IS NOT NULL)
        INTO kind, labels
        FROM pg_type t JOIN pg_namespace ns ON ns.oid = t.typnamespace
        LEFT JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE ns.nspname = sch AND t.typname = r.type_name
        GROUP BY t.typtype;
        IF kind IS NOT NULL AND (kind <> 'e' OR labels IS DISTINCT FROM r.expected) THEN
            errs := errs || format('type %I déjà présent mais différent (valeurs %s, attendu %s) — CREATE TYPE ignoré',
                                   r.type_name, coalesce(array_to_string(labels, ', '), 'aucune'), array_to_string(r.expected, ', '));
        END IF;
    END LOOP;

    -- 3) Colonnes. Celles qu'ajoute « IF NOT EXISTS » sont facultatives mais, si elles existent,
    --    doivent avoir la forme du schéma Prisma (sinon l'ajout est ignoré et la forme gardée).
    --    nullability : 'null' = nullable, 'notnull' = NOT NULL. dflt : true = défaut obligatoire,
    --    false = interdit, NULL = non vérifié.
    --    Les colonnes « required » sont lues par les index et la clé étrangère de la migration.
    FOR r IN SELECT * FROM (VALUES
        ('shops', 'stripe_requirements_due', 'text[]', 'null', true, false),
        ('shops', 'stripe_disabled_reason', 'text', 'null', false, false),
        ('shops', 'stripe_card_payments_active', 'boolean', 'notnull', true, false),
        ('users', 'weigh_tolerance', 'WeighTolerance', 'null', false, false),
        ('orders', 'id', 'text', 'notnull', NULL, true),
        ('orders', 'stripe_payment_intent_id', 'text', 'null', false, true),
        ('orders', 'stripe_checkout_session_id', 'text', 'null', false, true),
        ('orders', 'weigh_tolerance_rate_bps', 'integer', 'null', false, false),
        ('orders', 'weigh_tolerance_cap_cents', 'integer', 'null', false, false),
        ('orders', 'estimated_total_cents', 'integer', 'null', false, false),
        ('orders', 'stripe_charge_id', 'text', 'null', false, false),
        ('orders', 'authorized_amount_cents', 'integer', 'null', false, false),
        ('orders', 'payment_authorized_at', 'timestamp(3) without time zone', 'null', false, false),
        ('orders', 'capture_before', 'timestamp(3) without time zone', 'null', false, false),
        ('orders', 'card_network', 'text', 'null', false, false),
        ('orders', 'captured_amount_cents', 'integer', 'null', false, false),
        ('orders', 'payment_released_at', 'timestamp(3) without time zone', 'null', false, false),
        ('price_adjustments', 'status', 'AdjustmentStatus', 'notnull', NULL, true),
        ('price_adjustments', 'tier', 'integer', 'notnull', NULL, true),
        ('price_adjustments', 'answer_by', 'timestamp(3) without time zone', 'null', false, false),
        ('price_adjustments', 'close_reason', 'AdjustmentCloseReason', 'null', false, false),
        ('stripe_events', 'handled_at', 'timestamp(3) without time zone', 'null', false, false),
        ('stripe_events', 'livemode', 'boolean', 'null', false, false),
        ('stripe_events', 'account', 'text', 'null', false, false),
        -- stripe_disputes : vérifiée seulement si la table existe déjà (CREATE TABLE ignoré).
        ('stripe_disputes', 'id', 'text', 'notnull', false, true),
        ('stripe_disputes', 'charge_id', 'text', 'notnull', false, true),
        ('stripe_disputes', 'payment_intent_id', 'text', 'null', false, true),
        ('stripe_disputes', 'order_id', 'text', 'null', false, true),
        ('stripe_disputes', 'shop_id', 'text', 'null', false, true),
        ('stripe_disputes', 'amount_cents', 'integer', 'notnull', false, true),
        ('stripe_disputes', 'currency', 'text', 'notnull', false, true),
        ('stripe_disputes', 'reason', 'text', 'notnull', false, true),
        ('stripe_disputes', 'status', 'text', 'notnull', false, true),
        ('stripe_disputes', 'due_by', 'timestamp(3) without time zone', 'null', false, true),
        ('stripe_disputes', 'livemode', 'boolean', 'notnull', false, true),
        ('stripe_disputes', 'closed_at', 'timestamp(3) without time zone', 'null', false, true),
        ('stripe_disputes', 'created_at', 'timestamp(3) without time zone', 'notnull', true, true),
        ('stripe_disputes', 'updated_at', 'timestamp(3) without time zone', 'notnull', false, true)
    ) v(tbl, col, expected, nullability, dflt, required) LOOP
        rel_oid := to_regclass(format('%I.%I', sch, r.tbl));
        CONTINUE WHEN rel_oid IS NULL;
        typ := NULL;
        SELECT format_type(a.atttypid, a.atttypmod), a.attnotnull, a.atthasdef
        INTO typ, not_null, has_default
        FROM pg_attribute a
        WHERE a.attrelid = rel_oid AND a.attname = r.col AND a.attnum > 0 AND NOT a.attisdropped;
        IF typ IS NULL THEN
            IF r.required THEN
                errs := errs || format('colonne %I.%I absente', r.tbl, r.col);
            END IF;
            CONTINUE;
        END IF;
        IF replace(typ, '"', '') <> r.expected THEN
            errs := errs || format('colonne %I.%I de type %s, attendu %s', r.tbl, r.col, typ, r.expected);
        END IF;
        IF r.nullability = 'null' AND not_null THEN
            errs := errs || format('colonne %I.%I déjà présente mais NOT NULL, attendu nullable', r.tbl, r.col);
        ELSIF r.nullability = 'notnull' AND NOT not_null THEN
            errs := errs || format('colonne %I.%I déjà présente mais nullable, attendu NOT NULL', r.tbl, r.col);
        END IF;
        IF r.dflt IS NOT NULL AND has_default <> r.dflt THEN
            errs := errs || format('colonne %I.%I déjà présente %s valeur par défaut, attendu %s', r.tbl, r.col,
                                   CASE WHEN has_default THEN 'avec une' ELSE 'sans' END,
                                   CASE WHEN r.dflt THEN 'une valeur par défaut' ELSE 'aucune (pas de choix pré-rempli)' END);
        END IF;
    END LOOP;

    -- 4) Index et contraintes créés « si absents » : un nom déjà pris doit désigner exactement
    --    l'objet attendu (index valide, sans prédicat ni expression, sur ces colonnes).
    FOR r IN SELECT * FROM (VALUES
        ('orders_stripe_payment_intent_id_key', 'orders', ARRAY['stripe_payment_intent_id'], true),
        ('orders_stripe_checkout_session_id_key', 'orders', ARRAY['stripe_checkout_session_id'], true),
        ('price_adjustments_status_answer_by_idx', 'price_adjustments', ARRAY['status', 'answer_by'], false),
        ('stripe_disputes_pkey', 'stripe_disputes', ARRAY['id'], true),
        ('stripe_disputes_order_id_idx', 'stripe_disputes', ARRAY['order_id'], false),
        ('stripe_disputes_shop_id_status_idx', 'stripe_disputes', ARRAY['shop_id', 'status'], false)
    ) v(idx, tbl, cols, is_unique) LOOP
        rel_oid := to_regclass(format('%I.%I', sch, r.idx));
        CONTINUE WHEN rel_oid IS NULL;
        IF NOT EXISTS (
            SELECT 1 FROM pg_index i
            WHERE i.indexrelid = rel_oid AND i.indrelid = to_regclass(format('%I.%I', sch, r.tbl))
              AND i.indisvalid AND i.indpred IS NULL AND i.indexprs IS NULL
              AND i.indisunique = r.is_unique AND i.indnkeyatts = cardinality(r.cols)
              AND (SELECT array_agg(a.attname::text ORDER BY k.ord)
                   FROM unnest(i.indkey::int2[]) WITH ORDINALITY k(attnum, ord)
                   JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
                   WHERE k.ord <= i.indnkeyatts) = r.cols
        ) THEN
            errs := errs || format('le nom %I est déjà pris mais ne désigne pas un index %svalide sur %I(%s) — création ignorée',
                                   r.idx, CASE WHEN r.is_unique THEN 'unique ' ELSE '' END, r.tbl, array_to_string(r.cols, ', '));
        END IF;
    END LOOP;

    IF NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = to_regclass(format('%I.%I', sch, 'orders')) AND i.indisunique AND i.indimmediate
          AND i.indisvalid AND i.indpred IS NULL AND i.indexprs IS NULL AND i.indnkeyatts = 1
          AND i.indkey[0] = (SELECT a.attnum FROM pg_attribute a
                             WHERE a.attrelid = i.indrelid AND a.attname = 'id' AND NOT a.attisdropped)
    ) AND to_regclass(format('%I.%I', sch, 'orders')) IS NOT NULL THEN
        errs := errs || 'aucun index unique sur orders(id) — cible de la clé étrangère stripe_disputes_order_id_fkey';
    END IF;

    IF disputes_oid IS NOT NULL
       AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stripe_disputes_order_id_fkey' AND conrelid = disputes_oid)
       AND NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conname = 'stripe_disputes_order_id_fkey' AND c.conrelid = disputes_oid AND c.contype = 'f'
          AND c.confrelid = to_regclass(format('%I.%I', sch, 'orders')) AND c.confdeltype = 'n'
          AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = disputes_oid AND attname = 'order_id')]
    ) THEN
        errs := errs || 'la contrainte stripe_disputes_order_id_fkey existe mais n''est pas la clé étrangère stripe_disputes(order_id) → orders(id) ON DELETE SET NULL';
    END IF;

    -- 5) Données : uniquement si la structure est conforme (les requêtes ci-dessous en dépendent).
    --    Un identifiant Stripe porté par deux commandes empêche la création de l'index unique.
    IF cardinality(errs) = 0 THEN
        FOR r IN SELECT * FROM (VALUES
            ('stripe_payment_intent_id', 'orders_stripe_payment_intent_id_key'),
            ('stripe_checkout_session_id', 'orders_stripe_checkout_session_id_key')
        ) v(col, idx) LOOP
            CONTINUE WHEN to_regclass(format('%I.%I', sch, r.idx)) IS NOT NULL;
            EXECUTE format(
                'SELECT count(*), string_agg(d.v || '' ('' || d.n || '' commandes)'', '', '' ORDER BY d.v)'
                ' FILTER (WHERE d.rk <= 5) FROM (SELECT %2$I AS v, count(*) AS n, row_number() OVER (ORDER BY %2$I) AS rk'
                ' FROM %1$I.orders WHERE %2$I IS NOT NULL GROUP BY %2$I HAVING count(*) > 1) d', sch, r.col)
                INTO n, sample;
            IF n > 0 THEN
                errs := errs || format('orders.%I : %s valeur(s) portée(s) par plusieurs commandes (%s%s) — l''index unique %I ne pourrait pas être créé ; dédoublonner ces commandes avant de déployer',
                                       r.col, n, sample, CASE WHEN n > 5 THEN ', …' ELSE '' END, r.idx);
            END IF;
        END LOOP;

        IF disputes_oid IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stripe_disputes_order_id_fkey' AND conrelid = disputes_oid) THEN
            EXECUTE format('SELECT count(*) FROM %1$I.stripe_disputes d WHERE d.order_id IS NOT NULL'
                           ' AND NOT EXISTS (SELECT 1 FROM %1$I.orders o WHERE o.id = d.order_id)', sch)
                INTO n;
            IF n > 0 THEN
                errs := errs || format('stripe_disputes : %s ligne(s) dont order_id n''existe pas dans orders, la clé étrangère stripe_disputes_order_id_fkey ne pourrait pas être ajoutée', n);
            END IF;
        END IF;
    END IF;

    IF cardinality(errs) > 0 THEN
        RAISE EXCEPTION E'preflight c1_paiement_a: % précondition(s) non remplie(s) dans le schéma %, migration % NON appliquée :\n - %',
            cardinality(errs), sch, migration, array_to_string(errs, E'\n - ');
    END IF;

    -- 6) Information, jamais bloquante.
    EXECUTE format('SELECT coalesce(sum(t.n), 0), coalesce(string_agg(''palier '' || t.tier || '' : '' || t.n, '', '''
                   ' ORDER BY t.tier), ''aucun'') FROM (SELECT tier, count(*) AS n FROM %I.price_adjustments'
                   ' WHERE status = ''PENDING'' GROUP BY tier) t', sch)
        INTO n, sample;
    RAISE NOTICE 'preflight c1_paiement_a: % ajustement(s) de prix en attente (%) : sans réponse du client, le nouveau code les refuse à created_at + 5 min',
        n, sample;
    EXECUTE format('SELECT count(*) FROM %I.stripe_events', sch) INTO n;
    RAISE NOTICE 'preflight c1_paiement_a: % ligne(s) dans stripe_events (0 attendu : sans clé Stripe, le webhook répond 503)', n;
    EXECUTE format('SELECT count(*) FROM %I.orders WHERE stripe_payment_intent_id IS NOT NULL'
                   ' OR stripe_checkout_session_id IS NOT NULL', sch) INTO n;
    RAISE NOTICE 'preflight c1_paiement_a: % commande(s) portant un identifiant Stripe (0 attendu : paiement en ligne jamais activé)', n;

    RAISE NOTICE 'preflight c1_paiement_a: toutes les préconditions sont remplies';
END $$;
