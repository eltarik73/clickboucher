# Sources vérifiées — seo-expert

Consultées le **2026-11-13**, puis **rouvertes une par une le 2026-11-14** par le vérificateur
(chaque ligne ci-dessous a été relue sur la page citée). Résumés en nos propres mots. Pas de
dépôt GitHub tiers utilisé : le domaine est couvert par la documentation officielle des moteurs
(crédibilité = éditeur de la page, pas un nombre d'étoiles). Les blogs SEO cités par le garde-fou
du propriétaire (SEORAF, JourneyH, Metaflow, clickrank, searchlabdigital) ne sont **pas** des
sources primaires : leurs règles restent en vigueur parce que le propriétaire les a adoptées,
pas parce que ce skill les a vérifiées (voir points-a-arbitrer.md, A5).

| # | URL | Ce que la source appuie | Crédibilité |
|---|---|---|---|
| S1 | https://developers.google.com/search/docs/crawling-indexing/http-network-errors | 4xx (sauf 429) = contenu non utilisé, URLs déjà indexées retirées ; 5xx/429 ralentissent le crawl, URLs conservées puis retirées si l'erreur persiste ; ne pas limiter le crawl avec 401/403. Le code 402 n'y est pas nommé : il relève de « tous les 4xx sauf 429 » | Google Search Central (doc officielle ; pages crawling migrées vers le site « crawling » les 2025-11-20 et 2025-12-18 selon S5) |
| S2 | https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap | `lastmod` utilisé s'il est exact de façon constante et vérifiable ; modification significative = contenu principal, données structurées, liens ; `priority`/`changefreq` ignorés ; 50 000 URLs / 50 Mo ; soumission GSC, API ou robots.txt (aucun « ping ») ; sitemap = simple indice ; URLs absolues | Google Search Central |
| S3 | https://developers.google.com/search/docs/essentials/spam-policies | abus de contenu à grande échelle (pages produites en masse pour manipuler le classement) ; doorway (exemple des pages ciblant des villes qui renvoient vers une même page) ; aucun seuil de nombre de mots | Google Search Central |
| S4 | https://developers.google.com/search/docs/appearance/structured-data/review-snippet | avis auto-servis inéligibles pour LocalBusiness/Organization ; avis sur un élément précis, pas une liste ; pas d'agrégation d'autres sites ; avis visibles sur la page ; notes venant directement des utilisateurs ; pas d'avis faux ou incités non déclarés | Google Search Central |
| S5 | https://developers.google.com/search/updates | journal des docs : FAQ — avis de retrait publié le 2026-05-08 (« n'apparaît plus dans Search à partir du 7 mai 2026 »), doc supprimée le 2026-06-15 ; note llms.txt (2026-06-15) ; consigne avis faux/incités (2026-07-24) ; fil d'Ariane sur desktop (2025-01-22) ; recommandation avis avec commentaire + nom d'auteur (2025-01-15) ; docs retirées le 2025-09-09 (cours, salaire estimé, vidéo éducative, annonce spéciale, véhicule) ; sitelinks search box, doc retirée le 2024-11-29 | Google Search Central (changelog officiel) |
| S6 | https://developers.google.com/search/docs/appearance/structured-data/speakable | Speakable en bêta, utilisateurs aux États-Unis, appareils Google Home en anglais, éditeurs publiant en anglais, réponses à des requêtes d'actualité | Google Search Central |
| S7 | https://developers.google.com/search/docs/appearance/structured-data/event | ne pas baliser remises de courte durée, occasions d'achat, horaires d'ouverture, coupons ; tableau des pays/langues servis (Australie, Brésil, Canada, Allemagne, Inde, Amérique latine, Espagne, Royaume-Uni, États-Unis) : France absente | Google Search Central |
| S8 | https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls | canonical dans `<head>`, chemins absolus ; sitemap = signal faible de canonical ; ne pas utiliser robots.txt pour canonicaliser, `noindex` déconseillé pour cela ; lier vers l'URL canonique ; une URL bloquée par robots.txt peut être indexée sans son contenu | Google Search Central |
| S9 | https://developers.google.com/search/docs/appearance/structured-data/local-business | `name` + `address` requis ; `aggregateRating`/`review` recommandés seulement aux sites qui recueillent des avis sur d'autres commerces ; `geo` ≥ 5 décimales ; `opens`/`closes` au format hh:mm:ss ; types multiples en tableau ; sous-type le plus précis | Google Search Central |
| S10 | https://developers.google.com/search/docs/appearance/structured-data/merchant-listing | seules les pages où l'on peut acheter ; page centrée sur un seul produit ; prix > 0 ; `priceValidUntil` passé = annonce possiblement masquée ; prix à l'unité de mesure via `UnitPriceSpecification` + `referenceQuantity` ; `shippingDetails` et `hasMerchantReturnPolicy` recommandés, non requis | Google Search Central |
| S11 | https://blogs.bing.com/webmaster/July-2025/Keeping-Content-Discoverable-with-Sitemaps-in-AI-Powered-Search | `lastmod` = vraie date de modification du contenu (ISO 8601) ; `changefreq`/`priority` ignorés par Bing ; sitemap relu en général au moins une fois par jour ; sitemaps + IndexNow | Blog officiel Bing Webmaster (Microsoft), 2025-07-31, F. Canel et K. Madhavan |
| S12 | https://developers.google.com/search/docs/appearance/structured-data/sd-policies | ne pas baliser un contenu invisible ; exact, à jour, type le plus précis ; action manuelle = perte d'éligibilité aux résultats enrichis, sans effet sur le classement web ; éléments liés par `@id` ; test réussi ≠ affichage garanti | Google Search Central |
| S13 | https://support.google.com/business/answer/7091 | classement local : pertinence, distance, notoriété (liens, nombre d'avis, notes positives) ; aucun classement payant ; conseils : fiche validée, infos complètes, répondre aux avis (montre qu'on tient compte des clients — la page ne dit pas que répondre améliore le classement), photos | Aide Google Business Profile |
| S14 | https://support.google.com/business/answer/3038177 | éligibilité (lieu que les clients visitent, ou déplacement chez eux) ; nom réel, sans slogan, information de produit/service, localisation ; site représentant le point de vente ; URL de menu ≠ lien direct vers un service de commande tiers ; le moins de catégories possible ; adresse de domiciliation sans activité inéligible ; aucun lien dans la description | Aide Google Business Profile (règlement) |
| S15 | https://support.google.com/business/answer/10842217 | « Gérer les options de commande en ligne » : section « Commande de repas » ; fournisseurs tiers listés automatiquement, liens personnalisés possibles ; marquage « préféré » séparé pour retrait et livraison ; affichage variable selon pays/régions ; aucune liste de catégories éligibles | Aide Google Business Profile |
| S16 | https://developers.google.com/search/docs/crawling-indexing/links-crawlable | lien crawlable = `<a href>` ; ancre descriptive, concise, sans bourrage ; chaque page importante liée depuis au moins une autre page | Google Search Central |
| S17 | https://developers.google.com/search/docs/crawling-indexing/pause-online-business | coupure de 1-2 jours : 503 + `Retry-After` ; ne pas renvoyer 403/404/410 ni `noindex` ; robots.txt jamais en 503 ; pas de délai fixe pour récupérer d'un retrait complet, aucun moyen de l'accélérer ; reprise : Search Console pour quelques pages, sitemap pour beaucoup ; fermeture longue : accueil indexable en 200 | Google Search Central |
| S18 | https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history | mises à jour de classement 2026 : core mars (début 03-27), core mai (début 05-21), core novembre démarrée le 11-10 (pas de fin affichée le 2026-11-14) ; spam mars, juin, août, septembre | Google Search Status Dashboard (officiel) |
| S19 | https://developers.google.com/search/docs/appearance/ai-features | AI Overviews / AI Mode : aucune exigence technique supplémentaire, aucun schéma spécial, aucun fichier IA à créer ; trafic compté dans Performance, type « Web » ; contrôles nosnippet / max-snippet / noindex ; Google-Extended limite l'entraînement et l'ancrage hors Search | Google Search Central |
| S20 | https://support.google.com/webmasters/answer/7440203 | rapport Indexation des pages : libellés des motifs (vérifiés en français), avertissement « Indexée malgré le blocage par le fichier robots.txt » (lever le blocage puis `noindex`), « Valider la correction » (≈ 2 semaines, parfois plus) | Aide Search Console |
| S21 | https://developers.google.com/webmaster-tools/limits | API URL Inspection : 2 000/jour et 600/min par propriété ; quotas Search Analytics | Google (doc API Search Console) |
| S22 | https://www.indexnow.org/documentation | clé de 8 à 128 caractères (a-z, A-Z, 0-9, tiret), fichier `{clé}.txt` UTF-8 à la racine ; ≤ 10 000 URLs par POST ; codes 200/202/400/403/422/429 ; soumettre les URLs ajoutées, modifiées ou supprimées | Documentation officielle du protocole IndexNow |
| S23 | https://schema.org/Store | sous-types de Store (GroceryStore existe, pas de ButcherShop) ; parent LocalBusiness | schema.org (vocabulaire de référence) |
| S24 | https://developers.google.com/search/docs/crawling-indexing/block-indexing | pour que `noindex` agisse, la page ne doit pas être bloquée par robots.txt ; une page bloquée peut encore apparaître dans les résultats | Google Search Central |
| S25 | https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag | règles robots contradictoires : la plus restrictive s'applique ; page bloquée par robots.txt = règles meta/X-Robots-Tag ignorées | Google Search Central |
| S26 | https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt | correspondance par préfixe : `/fish/` ne couvre pas `/fish` ; `/fish` couvre `/fish`, `/fish.html`, `/fish/…`, `/fish.php?id=…` | Google Search Central |
| S27 | https://www.indexnow.org/faq | ne soumettre que lorsque le contenu a changé, ne pas resoumettre des URLs inchangées ; soumettre tout le site est acceptable après une migration ou une refonte ; pas fait pour rattraper d'anciens changements ; découverte continue = sitemap ; 429 = attendre | FAQ officielle du protocole IndexNow |
| S28 | https://support.google.com/webmasters/answer/16984139 | « Rapport sur les performances dans l'IA générative (Recherche) » : impressions dans AI Overviews et AI Mode, déployé pour tous les sites depuis le 2026-08-31, absent si trop peu d'impressions | Aide Search Console |
| S29 | https://developers.google.com/search/docs/fundamentals/ai-optimization-guide | fichiers IA (llms.txt…) : ni bénéfice ni dommage, Google Search les ignore ; pas de balisage spécial ; pas besoin de découper le contenu ; Business Profile et Merchant Center aident la visibilité locale | Google Search Central (guide du 2026-05-15) |
| S30 | https://developers.google.com/search/docs/appearance/structured-data/breadcrumb | `item` = URL de la page que représente le niveau (facultatif pour le dernier) ; fil représentant un parcours type ; fonctionnalité disponible sur desktop | Google Search Central |
| S31 | https://support.google.com/webmasters/answer/9679690 | rapport « Statistiques sur l'exploration » (Paramètres de la propriété) : répartition des réponses, OK (200) doit rester très majoritaire, état de l'hôte | Aide Search Console |

## Vérifications locales (pas de source web)

| Élément | Vérification |
|---|---|
| Next.js 14.2.35, `MetadataRoute.Sitemap` (`url`, `lastModified`, `changeFrequency`, `priority`, `alternates.languages`) | `node_modules/next/package.json`, `node_modules/next/dist/lib/metadata/types/metadata-interface.d.ts` |
| `generateSitemaps` supporté | `node_modules/next/dist/build/webpack/loaders/next-metadata-route-loader.js` |
| `serviceFeeCentsFor("ON_PICKUP") === 0` (et `SERVICE_FEE_CENTS` pour `ONLINE`, non proposé aujourd'hui) | `src/lib/pricing/totals.ts`, `src/lib/__tests__/pricing-totals.test.ts` — arbre de travail seulement (`git status` : `?? src/lib/pricing/`) ; sur `main`, `git grep SERVICE_FEE_CENTS HEAD -- "src/app/(client)/panier/page.tsx"` montre les 0,99 € encore ajoutés au panier |
| `Shop.updatedAt @updatedAt`, pas de champ code postal ; `Product.promoEnd`, `promoPct`, `promoFixedCents` | `prisma/schema.prisma` |
| Texte propre à chaque ville : 72 à 369 mots (médiane 112), `localContext` seul 45 à 280 (médiane 81) | script de comptage sur `src/lib/seo/cities.ts` (`localContext` + `description` + `specialty` + `districts`), 2026-11-14 |
| `JsonLd` seul émetteur de `application/ld+json` | `src/components/seo/JsonLd.tsx`, `src/lib/__tests__/json-ld.test.ts` |

## Constats en production (lecture seule, `curl`, 2026-11-14)

| Constat | Commande |
|---|---|
| Sitemap : 200, 215 `<loc>` (56 occasions, 55 villes + 1 quartier, 55 partenaires, 12 produit×ville, 9 boutiques, 7 recettes, 1 dimanche) | `curl -s https://klikandgo.app/sitemap.xml \| grep -o '<loc>' \| wc -l` |
| `/produits`, `/produits/merguez-halal`, `/occasions/aid-al-adha` → 404 ; `/occasions` → 308 | `curl -s -o /dev/null -w '%{http_code}' URL` |
| `/boutique/slug-inexistant` → 200, metas robots `index, follow` + `noindex` | `curl -s URL \| grep -o '<meta name="robots"[^>]*>'` |
| `/boucherie-halal/ville-inexistante` → 404 ; `/boucherie-halal/lyon` → `index, follow`, canonical auto-référent | idem |

## Sources examinées et écartées

- Articles de presse SEO sur le guide IA de Google (techwyse, demandsphere, dev.to…) : secondaires,
  remplacés par S19, S29 et S5.
- Pages Bing Webmaster Guidelines (`bing.com/webmasters/help/...`) : contenu non récupérable
  (page rendue en JavaScript) ; remplacées par S11, S22 et S27.
- Ancien skill (février-mars 2026) : « Core Update janvier 2026 », « Helpful Content Update juin
  2026 », « Page Experience Update septembre 2026 » : absents du tableau officiel S18, retirés.
