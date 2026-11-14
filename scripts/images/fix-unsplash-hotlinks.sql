-- scripts/images/fix-unsplash-hotlinks.sql — Remplace les photos Unsplash restées du premier seed
-- (8 produits dans 8 boutiques en production le 2026-11-14, dont « Escalope de dinde », photo morte)
-- par la photo du site que Klik&Go choisit déjà pour ce nom (keywordProductPhoto).
--
-- Essai à blanc (ne modifie rien) : affiche les lignes candidates et leur nombre N.
--   psql "$DIRECT_DATABASE_URL" -f scripts/images/fix-unsplash-hotlinks.sql
-- Application : une transaction ; validée seulement si exactement N lignes sont modifiées, après
-- l'écriture du journal unsplash_fix_journal.csv dans le dossier courant (ancienne et nouvelle URL).
--   psql "$DIRECT_DATABASE_URL" -v expected=N -f scripts/images/fix-unsplash-hotlinks.sql
-- Annulation depuis le journal : docs/photos.md. Seules des tables temporaires sont créées.
-- psql 10 ou plus récent (\if). Procédure complète : docs/photos.md, étape 3.

\set ON_ERROR_STOP on
\pset pager off

BEGIN;

CREATE TEMP TABLE unsplash_fix_targets (name text PRIMARY KEY, new_url text NOT NULL) ON COMMIT DROP;
-- Cible de chaque nom = keywordProductPhoto(nom) (src/lib/product-images.ts) ; vérifié, avec la
-- présence du fichier dans public/, par src/lib/__tests__/image-hotlink-targets.test.ts.
INSERT INTO unsplash_fix_targets (name, new_url) VALUES
  ('Côtelettes d''agneau', '/img/products/cotes-agneau-filet.jpg'),
  ('Émincé de poulet', '/img/products/poulet-blanc.jpg'),
  ('Escalope de dinde', '/img/products/filet-dinde.jpg'),
  ('Escalope de poulet', '/img/products/filet-poulet.jpg'),
  ('Foie de bœuf', '/img/products/abats-1.jpg'),
  ('Souris d''agneau', '/img/products/gigot-agneau.jpg'),
  ('Steak de bœuf', '/img/products/rumsteak.jpg'),
  ('Tripes de bœuf', '/img/products/abats-1.jpg');

CREATE TEMP TABLE unsplash_fix_journal ON COMMIT DROP AS
SELECT p.id, p.name, p.image_url AS old_url, t.new_url
FROM products p
JOIN unsplash_fix_targets t ON t.name = p.name
WHERE p.image_url LIKE 'https://images.unsplash.com/%';

SELECT s.slug AS boutique, j.id, j.name AS produit, j.old_url AS ancienne_url, j.new_url AS nouvelle_url
FROM unsplash_fix_journal j
JOIN products p ON p.id = j.id
LEFT JOIN shops s ON s.id = p.shop_id
ORDER BY s.slug, j.name, j.id;

SELECT count(*) AS candidates FROM unsplash_fix_journal \gset
\echo 'Lignes candidates :' :candidates

\if :{?expected}
  SELECT :'expected'::int AS expected_rows \gset
  \set journal_exists `test -e unsplash_fix_journal.csv && echo true || echo false`
  \if :journal_exists
    ROLLBACK;
    \echo 'unsplash_fix_journal.csv existe déjà dans ce dossier : c''est le journal d''un passage précédent.'
    \echo 'Rangez-le ailleurs, puis relancez. Rien n''a été modifié.'
    DO $$ BEGIN RAISE EXCEPTION 'Correction non lancée : journal existant'; END $$;
  \endif

  -- Compare-and-swap : une ligne modifiée depuis la lecture n'est pas touchée et sort du journal.
  WITH updated AS (
    UPDATE products p
    SET image_url = j.new_url
    FROM unsplash_fix_journal j
    WHERE p.id = j.id AND p.image_url = j.old_url
    RETURNING p.id
  ), unchanged AS (
    DELETE FROM unsplash_fix_journal j
    WHERE NOT EXISTS (SELECT 1 FROM updated u WHERE u.id = j.id)
    RETURNING j.id
  )
  SELECT (SELECT count(*) FROM updated) AS updated_rows, (SELECT count(*) FROM unchanged) AS unchanged_rows \gset
  \echo 'Lignes modifiées :' :updated_rows '— attendues :' :expected_rows '— laissées (modifiées entre-temps) :' :unchanged_rows

  SELECT (:updated_rows = :expected_rows AND :updated_rows > 0) AS count_matches \gset
  \if :count_matches
    \copy unsplash_fix_journal TO 'unsplash_fix_journal.csv' CSV HEADER
    COMMIT;
    \echo 'VALIDÉ. Journal écrit : unsplash_fix_journal.csv (gardez-le : il permet d''annuler).'
  \else
    ROLLBACK;
    \echo 'ANNULÉ : le nombre de lignes modifiées n''est pas celui attendu (ou vaut zéro). Rien n''a été modifié.'
    DO $$ BEGIN RAISE EXCEPTION 'Correction annulée : lignes modifiées différentes de expected, ou aucune'; END $$;
  \endif
\else
  ROLLBACK;
  \echo 'Essai à blanc : rien n''a été modifié. Pour appliquer : psql ... -v expected=<lignes candidates> -f scripts/images/fix-unsplash-hotlinks.sql'
\endif
