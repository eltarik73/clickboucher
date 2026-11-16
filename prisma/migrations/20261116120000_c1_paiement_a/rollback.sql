-- Retour arrière du SCHÉMA de C1-PAIEMENT-A (Prisma ignore ce fichier : il ne lit que migration.sql).
--
-- Retour arrière normal : redéployer le build précédent et NE PAS exécuter ce fichier. Le schéma
-- reste en place ; le code précédent ne nomme aucun des objets ajoutés et fonctionne dessus (voir
-- l'en-tête de migration.sql).
--
-- À n'exécuter que si le schéma lui-même doit disparaître, et seulement APRÈS avoir redéployé le
-- code d'avant C1-PAIEMENT-A (le code de C1-PAIEMENT-A ne fonctionne pas sans ces objets) :
--   npx prisma db execute --url "$DIRECT_DATABASE_URL" \
--     --file prisma/migrations/20261116120000_c1_paiement_a/rollback.sql
--
-- Pertes assumées, définitives :
--   - la marge de pesée enregistrée par chaque client (users.weigh_tolerance) : il la choisira de
--     nouveau à sa prochaine commande si C1-PAIEMENT-A est redéployé ;
--   - la marge figée sur les commandes créées par le nouveau code (taux, plafond, total estimé) ;
--     redéployée plus tard, une telle commande n'aurait plus de marge : toute hausse demanderait
--     l'accord explicite du client ;
--   - l'échéance et le motif des ajustements de prix (answer_by, close_reason). Un ajustement
--     encore en attente créé par le nouveau code (palier 3, sans escalate_at) reste en attente
--     d'une réponse du client pour le code précédent, qui ne l'escalade jamais ;
--   - le registre étendu des événements Stripe, les fiches de litige, l'état Connect des
--     boutiques et les champs de paiement en ligne des commandes (inactif : vides).
-- Les index simples orders_stripe_*_idx d'une migration antérieure ne sont pas touchés.
--
-- Tout ou rien : une seule transaction, rejouable sans effet. Verrous pris dans l'ordre de la
-- création de commande (boutique, client, commande), attente bornée à 5 s.

BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE "shops"
    DROP COLUMN IF EXISTS "stripe_requirements_due",
    DROP COLUMN IF EXISTS "stripe_disabled_reason",
    DROP COLUMN IF EXISTS "stripe_card_payments_active";

ALTER TABLE "users" DROP COLUMN IF EXISTS "weigh_tolerance";

-- La table des litiges d'abord : sa clé étrangère vise orders.
DROP TABLE IF EXISTS "stripe_disputes";

DROP INDEX IF EXISTS "orders_stripe_payment_intent_id_key";
DROP INDEX IF EXISTS "orders_stripe_checkout_session_id_key";

ALTER TABLE "orders"
    DROP COLUMN IF EXISTS "weigh_tolerance_rate_bps",
    DROP COLUMN IF EXISTS "weigh_tolerance_cap_cents",
    DROP COLUMN IF EXISTS "estimated_total_cents",
    DROP COLUMN IF EXISTS "stripe_charge_id",
    DROP COLUMN IF EXISTS "authorized_amount_cents",
    DROP COLUMN IF EXISTS "payment_authorized_at",
    DROP COLUMN IF EXISTS "capture_before",
    DROP COLUMN IF EXISTS "card_network",
    DROP COLUMN IF EXISTS "captured_amount_cents",
    DROP COLUMN IF EXISTS "payment_released_at";

DROP INDEX IF EXISTS "price_adjustments_status_answer_by_idx";

ALTER TABLE "price_adjustments"
    DROP COLUMN IF EXISTS "answer_by",
    DROP COLUMN IF EXISTS "close_reason";

ALTER TABLE "stripe_events"
    DROP COLUMN IF EXISTS "handled_at",
    DROP COLUMN IF EXISTS "livemode",
    DROP COLUMN IF EXISTS "account";

-- Plus aucune colonne ne les utilise.
DROP TYPE IF EXISTS "WeighTolerance";
DROP TYPE IF EXISTS "AdjustmentCloseReason";

-- L'historique Prisma suit le schéma : sans cette ligne, un futur déploiement de C1-PAIEMENT-A
-- croirait la migration déjà appliquée et ne recréerait pas les objets supprimés ci-dessus.
-- (`prisma migrate resolve --rolled-back` ne convient pas ici : il n'accepte qu'une migration
-- en échec, erreur P3012 sur une migration appliquée.)
DO $$
BEGIN
    IF to_regclass('"_prisma_migrations"') IS NOT NULL THEN
        DELETE FROM "_prisma_migrations"
        WHERE "migration_name" = '20261116120000_c1_paiement_a';
    END IF;
END $$;

COMMIT;
