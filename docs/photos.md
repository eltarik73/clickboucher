# Photos — fonctionnement, réglages et procédures du propriétaire

Livraison 1 du chantier photos (C1-PHOTOS-A, novembre 2026). Ce document décrit le circuit des
photos tel qu'il est dans le code, ce qu'il faut configurer, et la réparation des données de
production, que seul le propriétaire lance. Aucune des commandes de réparation ne tourne toute
seule, et aucune ne crée de table dans la base.

## 1. Le circuit, en une page

- **Envoi** — `POST /api/uploads/image` (`src/app/api/uploads/image/route.ts`), seule route d'envoi.
  Formulaire `file` + `purpose` (`PRODUCT`, `RETOUCH_SOURCE`, `REFERENCE`), construit par
  `buildUploadForm` (`src/lib/images/upload-contract.ts`). Pas d'identifiant de produit : la photo
  appartient à la boutique de la session (à la plateforme pour `REFERENCE`, admin seulement).
- **Navigateur** — `ProductPhotosField` et `useProductPhotos` (`src/components/boucher/photos/`), dans
  les deux formulaires produit. Le navigateur réduit la photo à 2048 px (JPEG 0,85, puis 0,7),
  n'envoie jamais plus de 4 Mo et traduit toute réponse non JSON (413 ou 504 de Vercel) en message
  français. Enregistrer reste bloqué tant qu'une photo s'envoie ou a échoué.
- **Enregistrement** — `persistImage` (`src/lib/images/ingest.ts`), seule entrée d'un fichier :
  octets magiques (JPEG, PNG, WebP, GIF, AVIF ; ni SVG, ni HEIC, ni HTML), puis sharp 0.35 redresse
  la photo (EXIF), retire toutes les métadonnées (GPS compris), aplatit sur fond blanc, écrit une
  photo WebP de 2048 px au plus et une vignette de 400 px (`<uuid>-t.webp`), puis la ligne de
  `generated_images` (modèle `UPLOAD`, `prompt` vide, usage selon l'envoi). Un fichier refusé ne
  laisse rien : 422 `IMAGE_REJECTED` et message français.
- **Stockage** — `src/lib/images/store.ts`, seul fichier qui importe `@vercel/blob` (garde
  `tests/lib/image-writers-guard.test.ts` : liste fermée qui ne peut que rétrécir). Vercel Blob quand
  `BLOB_READ_WRITE_TOKEN` existe ; sinon, hors Vercel et hors production, le disque local
  `.image-store/` servi par `/local-images/…` ; sinon 503 « Le stockage des photos est
  momentanément indisponible ». Jamais de repli sur le disque en production.
- **Règle d'écriture** — `src/lib/images/durable-url.ts`. Un champ d'image n'accepte qu'une URL
  durable : notre magasin Blob (hôte épinglé), une photo du site
  `/img/(products|shops|recipes)/<nom>.(jpg|jpeg|png|webp)`, ou `/local-images/…` hors production.
  Un fichier de notre magasin doit en plus appartenir au périmètre de la ligne
  (`src/lib/images/write-scope.ts`) : enregistré dans `generated_images` pour cette boutique ou pour
  la plateforme (`shop_id` NULL), ou publié dans le catalogue de référence. Le fichier d'une autre
  boutique, ou un chemin sans fichier enregistré, est refusé : une boutique ne peut ni montrer la
  photo d'une autre, ni l'empêcher de la supprimer de sa galerie. Même règle pour `imageUrl` et
  `bannerUrl` d'une boutique (routes `/api/shops`).
  Une valeur ancienne déjà enregistrée sur la même ligne reste acceptée telle quelle (droit acquis) :
  un réenregistrement ne casse jamais. Unsplash et Pexels sont tolérés à l'affichage seulement, en
  attendant la réparation. Les liens `replicate.delivery` (expirés en une heure) ne sont ni
  enregistrés ni affichés.
- **Une source de vérité** — `planProductImageWrite` (`src/lib/images/product-image-write.ts`).
  `Product.imageUrl` est le miroir, tenu par le serveur, de la photo principale de `ProductImage`, à
  la création, à la modification et à la duplication ; `clearImageUrl: true` retire la photo ; le
  remplacement des photos d'un produit est atomique (une seule écriture imbriquée). Pour un produit
  qui a des photos, la photo principale fait foi : un `imageUrl` ou un `clearImageUrl` envoyé sans
  `images` est refusé (400 « La photo principale du produit fait foi : modifiez les photos du
  produit. ») ; renvoyer la valeur enregistrée ne change rien. Cuisine, panier, recherche et JSON-LD
  lisent donc la photo que la vitrine montre.
- **Affichage** — `ProductPhoto` et `ShopPhoto` (`src/components/media/`), avec les candidates de
  `resolveProductPhoto` / `resolveShopPhoto` (`src/lib/images/product-photo.ts`) : photo principale,
  `imageUrl`, puis une photo du site qui existe toujours. En cas d'échec, une seule tentative par
  candidate, puis une icône (aucune requête). Jamais de `onError` sur `next/image`, jamais de `src`
  modifié à la main.
- **Suppression** — `DELETE /api/boucher/images/[id]`. Le formulaire n'efface jamais de fichier. La
  galerie refuse (409, avec le nom des produits) une image encore utilisée : `findImageReferences`
  (`src/lib/images/references.ts`) cherche la photo et sa vignette dans toutes les colonnes d'image.
  Sinon la ligne puis les deux fichiers sont effacés.

Limites : 4 Mo par photo envoyée, 50 mégapixels, 30 envois par heure et par boutique (par
administrateur pour le catalogue de référence), comptés dans PostgreSQL sur `generated_images`
(la production n'a pas de Redis). La source envoyée pour « Retoucher » suit le même chemin et le
même quota : la fenêtre de retouche l'envoie par `uploadImage(…, "RETOUCH_SOURCE")`
(`src/components/boucher/photos/upload-transport.ts`), puis demande la retouche avec son URL
(`src/components/boucher/photos/retouch-request.ts`) ; la route de retouche
ne reçoit jamais d'octets. Elle ne propose d'emblée la photo du produit comme source que si c'est un
fichier de notre magasin Blob (une photo du site `/img` n'est pas lisible par le fournisseur).

Statistiques des envois (lecture seule) :

```sql
SELECT s.slug, (g.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris')::date AS jour, count(*)
FROM generated_images g LEFT JOIN shops s ON s.id = g.shop_id
WHERE g.model = 'UPLOAD'
GROUP BY 1, 2 ORDER BY 2 DESC, 1;
```

## 2. Variables d'environnement

| Variable                      | Où                               | Rôle                                                                                                                                                                                                                   |
| ----------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BLOB_READ_WRITE_TOKEN`       | Vercel (Production), déjà défini | Jeton du magasin Vercel Blob. Serveur seulement. Sa présence choisit le stockage Blob.                                                                                                                                 |
| `NEXT_PUBLIC_IMAGE_BLOB_HOST` | Facultatif                       | Hôte du magasin Blob, par défaut `nzqbbcqekyom7ajd.public.blob.vercel-storage.com`. À définir seulement si le magasin change ; valeur publique, figée au build (le navigateur et le serveur appliquent la même règle). |
| `IMAGE_LOCAL_STORE_DIR`       | Développement seulement          | Dossier du stockage local, par défaut `.image-store/` à la racine (ignoré par git). Ignoré sur Vercel.                                                                                                                 |

Aucune nouvelle variable n'est nécessaire en production. Vérifier une fois que la version de Node
du projet Vercel est 20.x ou 22.x (sharp 0.35 exige Node 20.9 ou plus récent).

## 3. Développement local et CI

- Sans `BLOB_READ_WRITE_TOKEN`, les photos vont dans `.image-store/` et sont servies par
  `GET /local-images/<chemin>` (hors `/api`, donc hors du middleware). Cette route répond 404 sur
  Vercel, en production ou dès qu'un jeton Blob existe.
- La CI fait de même : le parcours Playwright des photos tourne sur la build de production locale,
  sans jeton Blob.
- Tests : `npm run test` (règles pures, garde des écrivains, cibles du script Unsplash),
  `npm run test:integration` (envoi, miroir, règle d'écriture, suppression, recensement,
  réparation, purge, sur PostgreSQL réel avec un stockage en mémoire).

## 4. Réparer les photos de production (propriétaire)

Production en lecture seule pour l'équipe : c'est vous qui lancez chaque étape, dans votre
terminal, depuis la racine du dépôt (`npx tsx` charge le code du dépôt). Les scripts lisent
`DATABASE_URL` ; Prisma lit aussi le fichier `.env` du dossier s'il existe. La **première ligne**
affichée donne la base visée : vérifiez-la avant de continuer. Les journaux restent sur votre
machine ; ne les ajoutez pas au dépôt.

Préparer le terminal (le mot de passe n'apparaît ni à l'écran ni dans l'historique) :

```bash
read -rs DIRECT_DATABASE_URL && export DIRECT_DATABASE_URL   # coller l'URL directe (port 5432), Entrée
export DATABASE_URL="$DIRECT_DATABASE_URL"
```

**Étape 0 — Sauvegarde (obligatoire).** `pg_dump` doit être d'une version au moins égale à
celle du serveur.

```bash
pg_dump "$DIRECT_DATABASE_URL" -Fc -f photos-avant-reparation-$(date +%Y%m%d-%H%M).dump \
  -t products -t product_images -t generated_images -t shops -t categories -t offers \
  -t campaigns -t site_banners -t recipes -t reference_products -t reference_product_images
```

**Étape 1 — Recensement (lecture seule).**

```bash
npx tsx scripts/images/census.ts --probe --check-blob --check-local --out prod-dry-run.json
```

Il classe chaque valeur des 15 colonnes d'image (notre Blob, photo du site, Unsplash/Pexels,
autre magasin Blob, Replicate, ancien `/api/uploads`, `data:`, autre, NULL), envoie un GET aux
sources non durables (10 s, 12 Mo au plus) et un GET d'un octet aux fichiers de notre Blob (ni SDK,
ni `/_next/image`), et liste les produits Unsplash avec boutique, id et nom. Quelques dizaines de
requêtes, aucune vers klikandgo.app, aucune écriture.

**Étape 2 — Revue, avec l'équipe.** Connu : 64 `products.image_url` Unsplash dans 8 boutiques
(5 photos, celle de « Escalope de dinde » est morte). Décision 5 : A, photos du catalogue du site
(recommandé, étape 3) ; B, copier les 4 photos encore en ligne dans notre stockage (sauter
l'étape 3 : l'étape 4 les copie et vide la photo morte). Toute autre ligne listée reçoit une
décision avant l'étape 4.

**Étape 3 — Photos Unsplash → photos du site (option A).** D'abord l'essai à blanc, qui affiche
les lignes et leur nombre N, puis l'application avec ce nombre :

```bash
psql "$DIRECT_DATABASE_URL" -f scripts/images/fix-unsplash-hotlinks.sql
psql "$DIRECT_DATABASE_URL" -v expected=N -f scripts/images/fix-unsplash-hotlinks.sql
```

Une seule transaction : seules les lignes Unsplash des 8 noms connus changent ; si le nombre de
lignes modifiées n'est pas N (ou vaut zéro), tout est annulé (ROLLBACK, code de sortie 3). Avant
de valider, le journal `unsplash_fix_journal.csv` (id, nom, ancienne et nouvelle URL) est écrit
dans le dossier courant ; un journal déjà présent bloque le lancement.

**Étape 4 — Les autres valeurs non durables.** Essai à blanc d'abord (aucune écriture), puis
application avec le jeton Blob exporté dans votre terminal (jamais collé dans une conversation) :

```bash
npx tsx scripts/images/repair.ts --check-blob
read -rs BLOB_READ_WRITE_TOKEN && export BLOB_READ_WRITE_TOKEN
npx tsx scripts/images/repair.ts --check-blob --apply --journal prod-journal-$(date +%Y%m%d-%H%M).jsonl
```

- Source vivante (Unsplash, Pexels, autre magasin Blob, autre hôte `https`) : téléchargée
  (sans redirection, 15 s, 12 Mo), réencodée par `persistImage` dans
  `shops/<boutique>/repair/<uuid>.webp` (modèle `REPAIR`), une copie par source et par boutique ;
  puis chaque ligne est remplacée par compare-and-swap (la mise à jour exige que la colonne ait
  encore l'ancienne valeur). Une ligne modifiée entre-temps est laissée et notée
  `skipped-changed`. Un autre hôte qu'Unsplash, Pexels ou Vercel Blob n'est téléchargé qu'avec
  `--allow-host <hôte>`.
- Source morte (404/410, lien Replicate, ancien `/api/uploads`) : mise à NULL seulement là où
  l'affichage a un repli (`products.image_url`, `shops.image_url`, bannière et popup des offres).
- Tout le reste est listé « À DÉCIDER » et n'est jamais touché : `data:`, valeur inconnue, sonde en
  échec pour une autre raison (délai, 5xx…), photo du site absente, lignes de `generated_images`,
  `product_images` et des autres colonnes sans repli. Pour supprimer une photo de produit morte,
  après décision (`ROLLBACK;` au lieu de `COMMIT;` si psql n'affiche pas `DELETE` suivi du nombre
  attendu) :

  ```sql
  BEGIN;
  SELECT id, product_id, url FROM product_images WHERE id IN ('<id>', '<id>');
  DELETE FROM product_images WHERE id IN ('<id>', '<id>');
  COMMIT;
  ```

- `--apply` refuse d'écrire sans jeton Blob, sauf sur une base locale (répétition), et exige un
  nouveau fichier de journal. Une ligne JSON par ligne traitée, écrite après chaque validation :
  `{ at, table, column, id, old, new, action }`.

**Étape 5 — `products.image_url` = photo principale.** Après l'étape 4.

```bash
psql "$DIRECT_DATABASE_URL" -f scripts/images/backfill-image-url.sql
psql "$DIRECT_DATABASE_URL" -v expected=N -f scripts/images/backfill-image-url.sql
```

Même forme que l'étape 3, journal `backfill_image_url_journal.csv`. Attendu en production : les
3 produits de boucherie-tarik sans `image_url`, plus « Brochettes de bœuf » (photo du site alors
que sa photo principale est une photo envoyée).

**Étape 6 — Vérification.** Relancer l'étape 1 : aucune valeur non durable, aucun fichier Blob
manquant. L'équipe retire alors la tolérance Unsplash/Pexels de l'affichage et de `next.config.mjs`
(livraison 3).

### Annuler

Depuis un journal CSV (étapes 3 et 5 ; remplacer le nom du fichier). Seules les lignes qui ont
encore la valeur écrite par la correction sont rétablies ; `UPDATE n` doit valoir le nombre de
lignes du journal, sinon `ROLLBACK;` au lieu de `COMMIT;`.

```sql
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE undo_journal (id text PRIMARY KEY, name text, old_url text, new_url text) ON COMMIT DROP;
\copy undo_journal FROM 'unsplash_fix_journal.csv' CSV HEADER
UPDATE products p
SET image_url = u.old_url
FROM undo_journal u
WHERE p.id = u.id AND p.image_url IS NOT DISTINCT FROM u.new_url;
SELECT count(*) AS lignes_du_journal FROM undo_journal;
COMMIT;
```

Depuis le journal JSONL de l'étape 4 (seules les lignes `copied` et `nulled` sont rétablies, table
par table ; les fichiers copiés restent dans Blob, sans effet) :

```sql
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE undo_lines (line text) ON COMMIT DROP;
\copy undo_lines FROM 'prod-journal.jsonl' WITH (FORMAT csv, DELIMITER E'\x01', QUOTE E'\x02')
CREATE TEMP TABLE undo_repair ON COMMIT DROP AS
SELECT entry ->> 'table' AS tbl, entry ->> 'column' AS col, entry ->> 'id' AS id,
       entry ->> 'old' AS old_value, entry ->> 'new' AS new_value
FROM (SELECT line::jsonb AS entry FROM undo_lines) lines
WHERE entry ->> 'action' IN ('copied', 'nulled');
DO $$
DECLARE r record; n integer;
BEGIN
  FOR r IN SELECT DISTINCT tbl, col FROM undo_repair LOOP
    EXECUTE format(
      'UPDATE %I t SET %I = u.old_value FROM undo_repair u '
      'WHERE u.tbl = %L AND u.col = %L AND t.id = u.id AND t.%I IS NOT DISTINCT FROM u.new_value',
      r.tbl, r.col, r.tbl, r.col, r.col);
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE '%.% : % ligne(s) rétablie(s)', r.tbl, r.col, n;
  END LOOP;
END $$;
SELECT count(*) AS lignes_a_retablir FROM undo_repair;
COMMIT;
```

Ces deux gabarits ont été exécutés sur une copie locale après chaque script : les valeurs d'origine
sont revenues à l'identique.

### Répéter sur une base locale

Sur une base jetable remplie par le seed (jamais une base partagée) :
`tests/fixtures/images/repair-kit-pattern.sql` reproduit le motif de production (64 lignes Unsplash
sur 8 boutiques, 1 produit non publié d'un autre nom, 4 produits à recopier). `repair.ts --apply`
y écrit avec le stockage sur disque (`IMAGE_LOCAL_STORE_DIR`).

### Ce que la réparation ne fait pas

- Les fichiers Blob effacés autrefois sont perdus : le produit montre une photo du site, le boucher
  doit renvoyer sa photo.
- Les fichiers orphelins du magasin Blob ne sont pas nettoyés (pas de ramasse-miettes).
- Les 6 photos de boutique en double ne sont pas traitées.
- `updated_at` des lignes corrigées n'est pas modifié.

## 5. Retrait d'une photo sur demande (personne dans le cadre, droits)

```bash
npx tsx scripts/images/purge.ts "<url de la photo>"            # qui l'utilise, ce qui serait effacé
npx tsx scripts/images/purge.ts "<url de la photo>" --apply    # avec BLOB_READ_WRITE_TOKEN exporté
```

Refusé tant qu'une colonne d'image utilise la photo ou sa vignette (les lignes sont listées :
changer la photo de ces produits d'abord). Sinon la photo et sa vignette sont effacées, puis les
lignes de `generated_images` qui la portent. Vercel Blob peut encore servir le fichier jusqu'à une
minute. Les copies optimisées (`/_next/image`) restent en cache : lancer ensuite, depuis le dépôt
lié au projet (`vercel link`), les commandes affichées :
`vercel cache dangerously-delete --srcimg "<url>" --yes` (photo et vignette).
`vercel cache invalidate --srcimg` ne suffit pas pour un retrait : il sert encore une fois l'ancienne
copie avant de la renouveler.

## 6. Données transmises à des tiers (pour la politique de confidentialité — décision du propriétaire)

- « Retoucher » envoie la photo du boucher à Replicate (États-Unis) pour générer les versions
  retouchées ; la génération envoie le texte de la demande. C'était déjà le cas avant cette
  livraison ; la politique de confidentialité doit le mentionner (texte juridique : propriétaire).
- Photos de banque d'images : Pexels demande un lien visible « Photos fournies par Pexels »
  (ajouté par la livraison 3). Les règles de l'API Unsplash imposent d'afficher leurs photos depuis
  leurs serveurs : c'est pourquoi l'option A (photos du site) est recommandée à l'étape 2.
- Les photos envoyées sont stockées sans métadonnées (ni position GPS, ni appareil).

## 7. Ce que les livraisons suivantes ajoutent

- **C1-PHOTOS-B** : génération et retouche par IA en tâches enregistrées d'abord en base (aucune
  image payée perdue), webhook signé et rattrapage, quotas IA par boutique, la seule migration du
  chantier (rejouable, avec `preflight.sql` et `rollback.sql`), la garde réduite à `store.ts` et au
  transport du fournisseur.
- **C1-PHOTOS-C** : `ProductPhoto` sur les écrans restants, sélecteur « Mes images », import Pexels
  par `persistImage`, règle d'écriture sur offres, campagnes, bannières et catalogue de référence,
  recensement quotidien (`runImageCensus`) dans le cron seo-audit, JSON-LD et og:image après la
  décision 7, fin de la tolérance Unsplash/Pexels et hôte Blob épinglé dans `next.config.mjs`.
