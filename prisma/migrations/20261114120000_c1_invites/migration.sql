-- C1-INVITES — Un jeton d'accès par commande invitée, et l'identité saisie par l'invité.
-- Additif uniquement : cinq colonnes ajoutées à "orders". Aucune colonne existante n'est supprimée,
-- renommée ni réécrite ; seules deux des nouvelles colonnes sont remplies, et seulement pour les
-- commandes des invités existants (§3) ; les trois colonnes d'identité (§4) restent NULL sur les
-- commandes existantes, ce qui veut dire « la ligne users fait foi ».
-- Le code précédent (d1a1358) continue de fonctionner sur ce schéma pendant le déploiement et après
-- un retour arrière applicatif : il ignore ces colonnes, et ses INSERT reçoivent NULL et false.
-- Mais un retour arrière du code seul rouvre le défaut A01-02 (le code précédent remet le jeton
-- par personne users.guest_token à quiconque commande avec le même e-mail) : voir rollback.sql.
--
-- Chaque instruction est rejouable (IF NOT EXISTS, « access_token_hash IS NULL ») et
-- `prisma migrate deploy` exécute ce fichier dans une seule transaction : un échec n'applique rien.
-- Après un échec (verrou non obtenu en 5 s, par exemple), Prisma refuse tout nouveau déploiement
-- (P3009) tant que la migration n'est pas déclarée annulée :
--   npx prisma migrate resolve --rolled-back 20261114120000_c1_invites
-- Le déploiement suivant la rejoue alors entièrement. Retour arrière du schéma : rollback.sql.
-- Avant `migrate deploy`, le build de production exécute preflight.sql (lecture seule) : s'il manque
-- une précondition, le build s'arrête sans que rien ne soit appliqué ni inscrit dans _prisma_migrations.
-- Après la bascule sur le nouveau code : backfill-after-release.sql (à lancer par le propriétaire,
-- voir son en-tête).

SET lock_timeout = '5s';

-- 1) Empreinte SHA-256 (hexadécimal minuscule) du jeton propre à la commande, jamais le jeton.
--    Ni index ni contrainte d'unicité : la colonne n'est jamais cherchée par sa valeur, et les
--    commandes héritées d'un même invité partagent la même empreinte (§3).
--    Colonne sans défaut : modification des seules métadonnées, la table n'est pas réécrite.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "access_token_hash" TEXT;

-- 2) Commande passée sans être connecté. Défaut constant : PostgreSQL ≥ 11 ne réécrit pas la table,
--    et les lignes existantes valent false.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "placed_as_guest" BOOLEAN NOT NULL DEFAULT false;

-- 3) Commandes invitées passées avant C1-INVITES : elles restent ouvertes par le jeton par personne
--    déjà remis à leur auteur (cookie klikgo-guest-token, lien ?guestToken=), désormais comparé
--    à l'empreinte de LA commande ouverte et non plus à users.guest_token. Même fonction de hachage
--    que src/lib/auth/order-credential.ts (hashOrderCredential). Ne touche que les commandes des
--    utilisateurs invités porteurs d'un jeton ; une ligne qui a déjà une empreinte n'est pas modifiée.
--    Même instruction que backfill-after-release.sql.
UPDATE "orders" AS o
SET "placed_as_guest" = true,
    "access_token_hash" = encode(sha256(convert_to(u."guest_token", 'UTF8')), 'hex')
FROM "users" AS u
WHERE u."id" = o."user_id"
  AND u."is_guest" = true
  AND u."guest_token" IS NOT NULL
  AND o."access_token_hash" IS NULL;

-- 4) Identité saisie lors d'une commande invitée (prénom, nom, téléphone E.164), seule montrée au
--    client : la ligne users de l'e-mail saisi peut appartenir à quelqu'un d'autre. NULL veut dire
--    « la ligne users fait foi » (commande d'un membre, ou passée avant C1-INVITES) : aucun
--    remplissage des lignes existantes. Colonnes sans défaut ni index : métadonnées seulement ; le
--    plafond par téléphone ne parcourt que les commandes en attente (index existant sur status).
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_first_name" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_last_name" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_phone" TEXT;
