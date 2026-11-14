-- tests/fixtures/images/repair-kit-pattern.sql — Le motif de production, sur une base LOCALE remplie
-- par le seed, pour répéter les scripts de scripts/images avant de les confier au propriétaire.
--
-- 8 boutiques (les 8 premières par slug) × les 8 produits qui portent encore une photo Unsplash en
-- production (5 photos, dont la morte de « Escalope de dinde ») = 64 lignes, plus 1 produit non
-- publié (is_active false) d'un autre nom avec une photo Unsplash dans une 9e boutique : 65 lignes.
-- Plus, dans la 9e boutique, 4 produits à recopier (image_url ≠ photo principale de product_images).
-- Rejouable : supprime d'abord ses propres lignes (id « repairkit-… »). Jamais sur une base partagée.
--   docker exec -i <conteneur> psql -U ci -d ci_photos_kit -f - < tests/fixtures/images/repair-kit-pattern.sql

\set ON_ERROR_STOP on

BEGIN;

DELETE FROM products WHERE id LIKE 'repairkit-%';

DO $$
BEGIN
  IF (SELECT count(*) FROM shops) < 9 THEN
    RAISE EXCEPTION 'Motif impossible : il faut au moins 9 boutiques (base remplie par le seed).';
  END IF;
END $$;

WITH ranked_shops AS (
  SELECT id, row_number() OVER (ORDER BY slug) AS rank FROM shops
), photos (name, url) AS (
  VALUES
    ('Côtelettes d''agneau', 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400&h=300&fit=crop&q=75'),
    ('Émincé de poulet', 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=300&fit=crop&q=75'),
    ('Escalope de dinde', 'https://images.unsplash.com/photo-1574672280600-4accfa404c11?w=400&h=300&fit=crop&q=75'),
    ('Escalope de poulet', 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=300&fit=crop&q=75'),
    ('Foie de bœuf', 'https://images.unsplash.com/photo-1551028150-64b9f398f678?w=400&h=300&fit=crop&q=75'),
    ('Souris d''agneau', 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400&h=300&fit=crop&q=75'),
    ('Steak de bœuf', 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&h=300&fit=crop&q=75'),
    ('Tripes de bœuf', 'https://images.unsplash.com/photo-1551028150-64b9f398f678?w=400&h=300&fit=crop&q=75')
)
INSERT INTO products (id, shop_id, name, price_cents, unit, image_url, updated_at)
SELECT 'repairkit-' || s.rank || '-' || left(md5(ph.name), 12), s.id, ph.name, 1500, 'KG', ph.url, now()
FROM ranked_shops s
CROSS JOIN photos ph
WHERE s.rank <= 8;

INSERT INTO products (id, shop_id, name, price_cents, unit, image_url, is_active, updated_at)
SELECT 'repairkit-9-merguez', s.id, 'Merguez maison', 1290, 'KG',
  'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&h=300&fit=crop&q=75', false, now()
FROM (SELECT id, row_number() OVER (ORDER BY slug) AS rank FROM shops) s
WHERE s.rank = 9;

-- Motif de boucherie-tarik pour la recopie de image_url (backfill-image-url.sql) : 3 produits sans
-- image_url dont la seule photo est dans product_images, et 1 produit dont image_url (photo du site)
-- diffère de sa photo principale. Ce sont les 4 photos Blob publiques relevées en production.
WITH ninth AS (
  SELECT id FROM (SELECT id, row_number() OVER (ORDER BY slug) AS rank FROM shops) s WHERE s.rank = 9
), patterns (suffix, name, image_url, photo) AS (
  VALUES
    ('backfill-1', 'Jarret de veau', NULL, 'https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com/products/product-1772972251751-983ca67110b13503.webp'),
    ('backfill-2', 'Viande hachée', NULL, 'https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com/products/product-1772635498764-991836e0b6afda39.webp'),
    ('backfill-3', 'Foie de poulet', NULL, 'https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com/products/product-1772972351471-16b0219f8d4c52df.webp'),
    ('backfill-4', 'Brochettes de bœuf', '/img/products/brochettes-boeuf.jpg', 'https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com/products/product-1772114082715-3e9f77cb76d4b0eb.webp')
), inserted AS (
  INSERT INTO products (id, shop_id, name, price_cents, unit, image_url, updated_at)
  SELECT 'repairkit-' || pt.suffix, ninth.id, pt.name, 1500, 'KG', pt.image_url, now()
  FROM patterns pt CROSS JOIN ninth
  RETURNING id
)
INSERT INTO product_images (id, product_id, url, is_primary)
SELECT 'repairkit-image-' || pt.suffix, 'repairkit-' || pt.suffix, pt.photo, true
FROM patterns pt
WHERE EXISTS (SELECT 1 FROM inserted i WHERE i.id = 'repairkit-' || pt.suffix);

COMMIT;

SELECT count(*) FILTER (WHERE image_url LIKE 'https://images.unsplash.com/%') AS lignes_unsplash,
       count(*) FILTER (WHERE id LIKE 'repairkit-backfill-%') AS produits_a_recopier
FROM products WHERE id LIKE 'repairkit-%';
