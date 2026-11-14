# Sitemap, lastmod, robots.txt, IndexNow et Bing

Sources : S2, S8, S11, S17, S22, S24, S25, S26, S27. Code : `src/app/sitemap.ts`,
`src/app/robots.ts`, `src/lib/indexnow.ts`.

## Sitemap (`src/app/sitemap.ts`)

- ISR `revalidate = 3600`, **sans try/catch** autour de Prisma : une erreur DB fait échouer la
  régénération et l'ISR continue de servir le dernier sitemap valide. Ne pas « réparer » avec un
  `catch` qui renverrait un sitemap amputé (CLAUDE.md, « Le build exige une base joignable »).
- Prérendu vérifié en CI par `scripts/check-prerender.mjs` (`/sitemap.xml` dans `REQUIRED_ROUTES`).
- Contenu : chaque entrée doit être en 200, indexable, et identique à son canonical (S8).
  Toute nouvelle famille passe par le tableau de décision de SKILL.md §2.
- `priority` / `changeFrequency` : ignorés par Google et Bing (S2, S11). Les laisser tels quels,
  ne pas en débattre en revue.
- `lastModified` : date de la dernière modification significative du **contenu de cette URL**
  (texte principal, données structurées, liens) (S2, S11). Sources acceptables dans notre code :
  - pages statiques : constantes `STATIC_CONTENT_UPDATED` / `LEGAL_CONTENT_UPDATED`, bumpées à la
    main quand le texte change ;
  - occasions : `SeoOccasion.lastUpdated` (déjà en place, modèle à suivre) ;
  - villes : à ajouter `SeoCity.lastUpdated` (pattern dans SKILL.md §3) ; la liste de boutiques
    affichée change aussi le contenu → option : `max(city.lastUpdated, max(updatedAt des boutiques
    de CETTE ville))`, pas le `updatedAt` global ;
  - boutiques : `Shop.updatedAt` bouge à chaque écriture (statut, `busyMode`, crons). Une date
    exacte demanderait un champ dédié mis à jour quand nom, adresse, horaires, description ou
    catalogue changent → chantier Prisma (skill prisma-expert), pas un correctif SEO isolé.
- Taille : 50 000 URLs / 50 Mo par fichier (S2). Klik&Go : 215 URLs en production le 2026-11-14.
  `generateSitemaps` est disponible dans Next 14.2.35 si besoin.
- Soumission documentée par Google : GSC, API Search Console ou ligne `Sitemap:` (S2). `robots.ts`
  publie déjà `sitemap: ${SITE_URL}/sitemap.xml`. Un sitemap reste un indice, pas une garantie (S2).

## robots.txt (`src/app/robots.ts`)

- Bloque le privé et `/api/`. Ne jamais y bloquer une page qu'on veut sortir de l'index : Google ne
  lirait plus son `noindex` (S24, S25), et l'URL peut rester indexée sans contenu (S8).
- Correspondance par préfixe (S26) : `Disallow: /panier/` bloque `/panier/x`, pas `/panier`.
  `Disallow: /recherche` (sans barre finale) bloque `/recherche` et `/recherche?q=…`. Pour une
  nouvelle règle, choisir la forme en connaissance de cause.
- Ne jamais servir robots.txt en erreur pendant un incident (S17).
- Bots IA : autorisés explicitement (CLAUDE.md, GEO). `Google-Extended` limite l'usage pour
  l'entraînement et l'ancrage de modèles Google hors Search, pas l'apparition dans Search (S19).

## IndexNow (Bing, Yandex, etc.)

Faits (S22, S27) : clé de 8 à 128 caractères dans `/{clé}.txt` à la racine, UTF-8 ; POST JSON
jusqu'à 10 000 URLs ; 200 = reçu, 202 = reçu, clé en cours de validation, 400 = format invalide,
403 = clé invalide, 422 = URL hors hôte ou clé non conforme, 429 = trop de requêtes. On soumet
les URLs **ajoutées, modifiées ou supprimées** ; la FAQ dit de ne pas resoumettre des URLs
inchangées, admet la soumission de tout le site après une migration ou une refonte, et renvoie au
sitemap pour la découverte continue (S27). Bing recommande de combiner sitemap (couverture) et
IndexNow (changements unitaires) et relit un sitemap soumis en général au moins une fois par jour
(S11).

Règles Klik&Go :
1. Importer **uniquement** `notifyIndexNow` de `@/lib/indexnow` (clé `b358f6be…`). Ne pas utiliser
   `src/lib/seo/indexnow.ts` (doublon, autre clé) ; ne pas supprimer les fichiers de clé publics
   sans décision (les deux répondent 200 en production ; Bing a pu valider l'une ou l'autre).
2. Soumettre une URL quand **son** contenu change : validation d'une boutique, changement de nom /
   adresse / horaires, publication d'une recette `featured`, bump d'un `lastUpdated`.
3. Ne pas soumettre `/sitemap.xml` comme URL de page ; ne pas soumettre une URL `noindex` ou non
   200 (seo-anti-penalty, action 4).
4. Le cron `indexnow-fresh` renvoie chaque jour les mêmes ≈ 120 URLs, ce que la FAQ déconseille
   (S27) : à remplacer, dans un chantier dédié, par une sélection des URLs dont `lastModified` a
   changé depuis la veille.
5. Après une panne : le protocole ne prévoit pas ce cas (les contenus n'ont pas changé, seul le
   code HTTP est revenu à 200). Une soumission **unique** via `POST /api/seo/indexnow` (admin) est
   un choix raisonnable par analogie avec la tolérance « après migration » (S27), sans garantie
   d'effet ; ne pas la répéter.
6. Appel fire-and-forget dans une route serverless (`validate`) : la fonction peut être gelée
   après la réponse ; préférer `await` (l'appel n'échoue jamais, il journalise) — skill
   reliability-observability pour le délai maximal.

## Bing Webmaster Tools

- Sitemap soumis : vérifier « dernière lecture » et erreurs (S11).
- Cron `bing-daily` (09:17 UTC, remplace l'ancien usage local de `scripts/bing-daily-audit.ts` ;
  mémoire `project_bing_setup.md`).
