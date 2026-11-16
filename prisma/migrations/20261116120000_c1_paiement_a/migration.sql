-- C1-PAIEMENT-A — Marge de pesée du client, champs du paiement en ligne (inactif), registre des
-- événements Stripe, litiges et état Connect des boutiques.
--
-- Ce que la migration ajoute, dans l'ordre du fichier :
--   1. deux types : WeighTolerance (marge de pesée) et AdjustmentCloseReason (motif d'un refus).
--   2. shops : état du compte Connect (exigences, motif de désactivation, paiement par carte actif).
--   3. users.weigh_tolerance : marge de pesée choisie par le client (NULL = jamais choisie).
--   4. orders : marge figée à la création (taux, plafond, total estimé) ; champs d'autorisation,
--      de capture et de libération du paiement en ligne ; index uniques sur
--      stripe_payment_intent_id et stripe_checkout_session_id.
--   5. price_adjustments : échéance de la réponse du client (answer_by) et motif d'un refus
--      (close_reason), index (status, answer_by) des ajustements en attente échus.
--   6. stripe_events : handled_at (traitement terminé), livemode, account (compte Connect).
--   7. stripe_disputes : une fiche par litige carte, gardée si sa commande disparaît.
--
-- Additif uniquement : deux types nouveaux, une table nouvelle, des colonnes nullables ou à
-- défaut constant (modification des seules métadonnées : aucune table réécrite, aucune ligne
-- existante lue ni modifiée), aucune valeur ajoutée à un type existant. Chaque colonne a la forme
-- que Prisma génère pour schema.prisma (`prisma db push` des tests et de la CI compris). Les deux
-- index uniques portent sur des colonnes NULL sur toute commande (le paiement en ligne n'a jamais
-- fonctionné) ; preflight.sql le vérifie et arrête le build avant toute écriture si deux commandes
-- partagent un identifiant Stripe. Leur construction tient le verrou de `orders` quelques
-- millisecondes. Verrous pris dans l'ordre de la création de commande (boutique, puis client,
-- puis commande), pour ne pas croiser une transaction de l'application ; attente bornée à 5 s.
--
-- Le code précédent fonctionne sur ce schéma pendant le déploiement et après un retour arrière
-- applicatif : son client Prisma ne nomme que ses propres colonnes, les nouvelles lui sont
-- invisibles et ses INSERT y laissent NULL ou le défaut. Une commande qu'il crée n'a pas de marge
-- figée : le nouveau code demande l'accord du client pour toute hausse. Un ajustement en attente
-- qu'il crée (palier 2, auto_approve_at) est, pour le nouveau code, en attente de réponse jusqu'à
-- created_at + 5 min, puis refusé. Une ligne créée par le nouveau code (palier 1 déjà réglé, ou
-- palier 3 sans escalate_at) ne peut être ni validée seule ni escaladée par le code précédent ;
-- ses routes d'acceptation et de refus fonctionnent dessus. Son webhook reste en sommeil (aucune
-- clé Stripe). Les index uniques ne le gênent pas : il n'écrit ces identifiants qu'à partir d'une
-- session Stripe, jamais créée.
--
-- Chaque instruction est rejouable (IF NOT EXISTS, exception duplicate_object, contrainte
-- cherchée dans pg_constraint) et `prisma migrate deploy` exécute ce fichier dans une seule
-- transaction : un échec n'applique rien. Après un échec (verrou non obtenu en 5 s, par exemple),
-- Prisma refuse tout nouveau déploiement (P3009) tant que la migration n'est pas déclarée annulée :
--   npx prisma migrate resolve --rolled-back 20261116120000_c1_paiement_a
-- Le déploiement suivant la rejoue alors entièrement. Retour arrière du schéma : rollback.sql.
-- Avant `migrate deploy`, le build de production exécute preflight.sql (lecture seule) : s'il manque
-- une précondition, le build s'arrête sans que rien ne soit appliqué ni inscrit dans _prisma_migrations.
-- Aucune reprise de données : les clients existants choisiront leur marge à leur prochaine commande.

SET lock_timeout = '5s';

-- 1) Types nouveaux (aucune valeur ajoutée à un type existant).
DO $$
BEGIN
    CREATE TYPE "WeighTolerance" AS ENUM ('STANDARD', 'EXTENDED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "AdjustmentCloseReason" AS ENUM ('CUSTOMER_REFUSED', 'NO_ANSWER', 'ORDER_CHANGED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2) Boutique : état du compte Connect, recopié depuis Stripe. Défauts constants : les boutiques
--    existantes valent « aucune exigence connue, paiement par carte inactif ».
ALTER TABLE "shops"
    ADD COLUMN IF NOT EXISTS "stripe_requirements_due" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS "stripe_disabled_reason" TEXT,
    ADD COLUMN IF NOT EXISTS "stripe_card_payments_active" BOOLEAN NOT NULL DEFAULT false;

-- 3) Client : marge de pesée. NULL = jamais choisie : le choix actif est demandé à la commande.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "weigh_tolerance" "WeighTolerance";

-- 4) Commande : marge figée à la création ; paiement en ligne (écrit par le webhook seulement).
--    Toutes nullables : NULL sur les commandes existantes (aucune marge = toute hausse demande
--    l'accord explicite du client).
ALTER TABLE "orders"
    ADD COLUMN IF NOT EXISTS "weigh_tolerance_rate_bps" INTEGER,
    ADD COLUMN IF NOT EXISTS "weigh_tolerance_cap_cents" INTEGER,
    ADD COLUMN IF NOT EXISTS "estimated_total_cents" INTEGER,
    ADD COLUMN IF NOT EXISTS "stripe_charge_id" TEXT,
    ADD COLUMN IF NOT EXISTS "authorized_amount_cents" INTEGER,
    ADD COLUMN IF NOT EXISTS "payment_authorized_at" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "capture_before" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "card_network" TEXT,
    ADD COLUMN IF NOT EXISTS "captured_amount_cents" INTEGER,
    ADD COLUMN IF NOT EXISTS "payment_released_at" TIMESTAMP(3);

-- Une session ou un PaymentIntent Stripe désigne une seule commande. Les NULL ne sont pas
-- comparés : toutes les commandes payées sur place restent permises. Noms attendus par Prisma
-- pour @unique. Les index simples orders_stripe_*_idx créés par une migration antérieure restent
-- (le code précédent ne les nomme pas ; leur suppression appartient à un chantier de nettoyage).
CREATE UNIQUE INDEX IF NOT EXISTS "orders_stripe_payment_intent_id_key" ON "orders"("stripe_payment_intent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "orders_stripe_checkout_session_id_key" ON "orders"("stripe_checkout_session_id");

-- 5) Ajustement de prix : échéance de la réponse du client et motif d'un refus. NULL sur les
--    lignes existantes : le nouveau code compte leur échéance depuis created_at.
ALTER TABLE "price_adjustments"
    ADD COLUMN IF NOT EXISTS "answer_by" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "close_reason" "AdjustmentCloseReason";

CREATE INDEX IF NOT EXISTS "price_adjustments_status_answer_by_idx" ON "price_adjustments"("status", "answer_by");

-- 6) Registre des événements Stripe : traitement terminé, mode et compte Connect émetteur.
--    NULL sur les lignes existantes (aucune attendue en production : sans clé, le webhook répond
--    503) ; une telle ligne n'est reconsidérée que si Stripe relivre le même événement.
ALTER TABLE "stripe_events"
    ADD COLUMN IF NOT EXISTS "handled_at" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "livemode" BOOLEAN,
    ADD COLUMN IF NOT EXISTS "account" TEXT;

-- 7) Litiges carte : une ligne par litige Stripe, écrite par le webhook seulement.
CREATE TABLE IF NOT EXISTS "stripe_disputes" (
    "id" TEXT NOT NULL,
    "charge_id" TEXT NOT NULL,
    "payment_intent_id" TEXT,
    "order_id" TEXT,
    "shop_id" TEXT,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "due_by" TIMESTAMP(3),
    "livemode" BOOLEAN NOT NULL,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stripe_disputes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "stripe_disputes_order_id_idx" ON "stripe_disputes"("order_id");
CREATE INDEX IF NOT EXISTS "stripe_disputes_shop_id_status_idx" ON "stripe_disputes"("shop_id", "status");

-- La fiche survit à sa commande : ON DELETE SET NULL. La recherche est limitée à CETTE table
-- (conrelid), un nom de contrainte n'étant unique que par table.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'stripe_disputes_order_id_fkey' AND conrelid = '"stripe_disputes"'::regclass
    ) THEN
        ALTER TABLE "stripe_disputes" ADD CONSTRAINT "stripe_disputes_order_id_fkey"
            FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
