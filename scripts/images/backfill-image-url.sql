-- scripts/images/backfill-image-url.sql — Une seule source de vérité pour la photo d'un produit :
-- products.image_url reçoit l'URL de la photo principale de product_images, comme le fait le
-- serveur à chaque enregistrement depuis C1-PHOTOS-A (planProductImageWrite). Concerne les produits
-- dont les photos ont été enregistrées avant (en production : 3 produits de boucherie-tarik sans
-- image_url, et ceux dont image_url diffère de la photo principale).
-- À lancer APRÈS la réparation (étape 4) : une photo principale morte serait sinon recopiée.
--
-- Essai à blanc (ne modifie rien) : affiche les lignes candidates et leur nombre N.
--   psql "$DIRECT_DATABASE_URL" -f scripts/images/backfill-image-url.sql
-- Application : une transaction ; validée seulement si exactement N lignes sont modifiées, après
-- l'écriture du journal backfill_image_url_journal.csv dans le dossier courant.
--   psql "$DIRECT_DATABASE_URL" -v expected=N -f scripts/images/backfill-image-url.sql
-- Annulation depuis le journal : docs/photos.md. Seules des tables temporaires sont créées.

\set ON_ERROR_STOP on
\pset pager off

BEGIN;

-- Photo principale : la première marquée is_primary, sinon la première par « order » ; à égalité,
-- la plus ancienne puis le plus petit id. Jumeau SQL de primaryImageOf (src/lib/images/product-photo.ts).
CREATE TEMP TABLE backfill_image_url_journal ON COMMIT DROP AS
SELECT p.id, p.name, p.image_url AS old_url, main_image.url AS new_url
FROM products p
JOIN LATERAL (
  SELECT i.url
  FROM product_images i
  WHERE i.product_id = p.id
  ORDER BY i.is_primary DESC, i."order" ASC, i.created_at ASC, i.id ASC
  LIMIT 1
) main_image ON true
WHERE p.image_url IS DISTINCT FROM main_image.url;

SELECT s.slug AS boutique, j.id, j.name AS produit, j.old_url AS ancienne_url, j.new_url AS nouvelle_url
FROM backfill_image_url_journal j
JOIN products p ON p.id = j.id
LEFT JOIN shops s ON s.id = p.shop_id
ORDER BY s.slug, j.name, j.id;

SELECT count(*) AS candidates FROM backfill_image_url_journal \gset
\echo 'Lignes candidates :' :candidates

\if :{?expected}
  SELECT :'expected'::int AS expected_rows \gset
  \set journal_exists `test -e backfill_image_url_journal.csv && echo true || echo false`
  \if :journal_exists
    ROLLBACK;
    \echo 'backfill_image_url_journal.csv existe déjà dans ce dossier : c''est le journal d''un passage précédent.'
    \echo 'Rangez-le ailleurs, puis relancez. Rien n''a été modifié.'
    DO $$ BEGIN RAISE EXCEPTION 'Recopie non lancée : journal existant'; END $$;
  \endif

  -- Compare-and-swap (NULL compris) : une ligne modifiée depuis la lecture n'est pas touchée.
  WITH updated AS (
    UPDATE products p
    SET image_url = j.new_url
    FROM backfill_image_url_journal j
    WHERE p.id = j.id AND p.image_url IS NOT DISTINCT FROM j.old_url
    RETURNING p.id
  ), unchanged AS (
    DELETE FROM backfill_image_url_journal j
    WHERE NOT EXISTS (SELECT 1 FROM updated u WHERE u.id = j.id)
    RETURNING j.id
  )
  SELECT (SELECT count(*) FROM updated) AS updated_rows, (SELECT count(*) FROM unchanged) AS unchanged_rows \gset
  \echo 'Lignes modifiées :' :updated_rows '— attendues :' :expected_rows '— laissées (modifiées entre-temps) :' :unchanged_rows

  SELECT (:updated_rows = :expected_rows AND :updated_rows > 0) AS count_matches \gset
  \if :count_matches
    \copy backfill_image_url_journal TO 'backfill_image_url_journal.csv' CSV HEADER
    COMMIT;
    \echo 'VALIDÉ. Journal écrit : backfill_image_url_journal.csv (gardez-le : il permet d''annuler).'
  \else
    ROLLBACK;
    \echo 'ANNULÉ : le nombre de lignes modifiées n''est pas celui attendu (ou vaut zéro). Rien n''a été modifié.'
    DO $$ BEGIN RAISE EXCEPTION 'Recopie annulée : lignes modifiées différentes de expected, ou aucune'; END $$;
  \endif
\else
  ROLLBACK;
  \echo 'Essai à blanc : rien n''a été modifié. Pour appliquer : psql ... -v expected=<lignes candidates> -f scripts/images/backfill-image-url.sql'
\endif
