-- C1-FAILLES-CRITIQUES — Réparation de dérive : les trois colonnes de validation et de suspension
-- d'une boutique (shops.validated_at, suspended_at, suspend_reason) sont déclarées dans
-- prisma/schema.prisma, mais aucune migration ne les crée. Les bases locales, de CI et de tests les
-- tiennent de `prisma db push` ; la production les a très probablement (le client Prisma les nomme
-- dans chaque lecture de boutique faite sans `select`, et ces lectures fonctionnent), sans que cela
-- puisse être vérifié d'ici. Le nouveau code les ÉCRIT (suspension et réactivation par
-- l'administration, date de validation) : cette migration garantit leur présence avant lui.
--
-- Additif uniquement : trois colonnes nullables, sans défaut ni index (modification des seules
-- métadonnées, la table n'est pas réécrite), aucune ligne lue ni modifiée. Si une colonne existe
-- déjà, son ajout est ignoré (IF NOT EXISTS) et rien ne change.
-- Le code précédent fonctionne sur ce schéma pendant le déploiement et après un retour arrière
-- applicatif : son schéma Prisma déclare déjà ces colonnes, il ne les écrit jamais, et ses INSERT
-- y laissent NULL.
--
-- Chaque instruction est rejouable et `prisma migrate deploy` exécute ce fichier dans une seule
-- transaction : un échec n'applique rien. Après un échec (verrou non obtenu en 5 s, par exemple),
-- Prisma refuse tout nouveau déploiement (P3009) tant que la migration n'est pas déclarée annulée :
--   npx prisma migrate resolve --rolled-back 20261115120000_c1_failles_critiques
-- Le déploiement suivant la rejoue alors entièrement. Retour arrière du schéma : rollback.sql.
-- Avant `migrate deploy`, le build de production exécute preflight.sql (lecture seule) : s'il manque
-- une précondition, le build s'arrête sans que rien ne soit appliqué ni inscrit dans _prisma_migrations.
-- Après la bascule sur le nouveau code : backfill-after-release.sql (à lancer par le propriétaire,
-- voir son en-tête) marque « suspendues » les boutiques suspendues par le code précédent, qui ne
-- remplissait pas suspended_at.

SET lock_timeout = '5s';

-- Date de la validation par l'administration (approbation de la boutique).
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "validated_at" TIMESTAMP(3);

-- Suspension par l'administration : non NULL = boutique suspendue, quel que soit shops.visible.
-- Ni défaut ni remplissage : toute boutique existante est « non suspendue » pour le nouveau code.
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMP(3);

-- Motif de la suspension : interne, jamais montré au public.
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "suspend_reason" TEXT;
