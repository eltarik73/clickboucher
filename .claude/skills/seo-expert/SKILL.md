---
name: seo-expert
description: "SEO local et programmatique de Klik&Go (marketplace click & collect de boucheries halal) : indexation, sitemap et lastmod, robots, canonical, données structurées JSON-LD (Store/LocalBusiness, Product, BreadcrumbList, Event, avis), pages villes / quartiers / produits / occasions, maillage interne, IndexNow et Bing, Google Business Profile des bouchers, reprise d'indexation après une panne, mesure Search Console. À utiliser dès qu'on crée ou modifie une page publique indexable, src/app/sitemap.ts, src/app/robots.ts, src/lib/seo/*, src/components/seo/*, public/llms.txt, ou qu'on parle de SEO, référencement, Google, Bing, GSC, schema.org, rich results, pack local. Toujours en français. S'utilise AVEC le garde-fou seo-anti-penalty, jamais à sa place."
---

# SEO local et programmatique — Klik&Go

Écrit le 2026-11-13, revérifié le 2026-11-14 (code relu, chaque source rouverte, production
interrogée en lecture seule). Next 14.2.35. Chaque affirmation externe renvoie à
[references/sources.md](references/sources.md) (S1…S31).

## 0. Règles qui priment sur ce skill (à relire avant toute action)

1. **`.claude/skills/seo-anti-penalty/SKILL.md`** : garde-fou du propriétaire. Pas de faux avis,
   pas d'`aggregateRating` inventé, pas d'avis de boutique recopiés sur des produits, règle OR du
   `noindex` (≥ 500 mots uniques par instance → index ; villes cibles, hubs, pages partenaires →
   index même sans boutique), checklist pré-vol. Ce skill ne l'assouplit jamais.
2. **Mémoire `project_seo_rules_2026.md`** + `project_gsc_indexation_strategy.md` (soumissions
   manuelles GSC : jamais `/boutique/*` tant que le propriétaire n'a pas validé l'indexation des
   fiches boutique).
3. **CLAUDE.md** : sections SEO, GEO/AIO, « Coût CPU Vercel » (ISR, `generateStaticParams`,
   pas de `new Date()` dans le rendu initial d'une page statique/ISR, `prefetch={false}` sur les
   liens en masse), « Pas de livraison ».
4. En cas de contradiction entre ces textes : ne pas trancher seul → section 9 « Points à arbitrer ».

## 1. Ce que le code fait aujourd'hui (carte)

| Fichier | Rôle | Rendu |
|---|---|---|
| `src/app/sitemap.ts` | 215 URLs en production le 2026-11-14 : statiques, hubs, villes, partenaires, dimanche, produit×ville, quartiers, occasions, boutiques, recettes | ISR 3600, sans try/catch (voulu) |
| `src/app/robots.ts` | `*` + 9 bots IA autorisés, même `DISALLOW` (privé, `/api/`, `/recherche`) | statique |
| `src/lib/seo/cities.ts` | `SEO_CITIES` (55 villes ; texte propre à chaque ville mesuré : 72 à 369 mots, médiane 112 — voir A8), `SEO_DEPARTMENTS` (5) | config |
| `src/lib/seo/{products,occasions,districts}.ts` | 12 produits, 7 occasions, 12 quartiers + `*_PRIORITY_SLUGS` | config |
| `src/app/boucherie-halal/[ville]` | page ville, TOUJOURS index (revert `4fc4897`) | ISR + `generateStaticParams` |
| `src/app/boucherie-halal/[ville]/[quartier]`, `produits/[produit]/[ville]`, `boucheries-halal-ouvertes-dimanche/[ville]` | `noindex, follow` si 0 boutique visible dans la ville ; sitemap filtré par `populatedCitySlugs` | ISR |
| `src/app/occasions/[occasion]/[ville]` | TOUJOURS index ; JSON-LD `Event` si `eventStart`, sinon `WebPage` | ISR |
| `src/app/(client)/boutique/[slug]` | fiche boutique : `ShopSchema` + `BreadcrumbSchema` + 20 × `ProductSchema` | dynamique (voulu, cf. CLAUDE.md) |
| `src/components/seo/JsonLd.tsx` | **seul** fichier autorisé à écrire un `<script type="application/ld+json">` (échappement via `src/lib/seo/jsonld/serialize.ts`, verrouillé par `src/lib/__tests__/json-ld.test.ts`) | serveur |
| `src/components/seo/*` | `OrganizationSchema` (layout), `ShopSchema`, `ProductSchema`, `RecipeSchema`, `BreadcrumbSchema`, `SpeakableSchema`, `LastUpdated` | serveur |
| `src/lib/indexnow.ts` | **seul** client IndexNow utilisé (clé `b358…`, no-op hors production) | — |
| `src/app/api/cron/{indexnow-fresh,bing-daily,seo-audit}` | ping IndexNow quotidien ; audit Bing ; alerte Sentry si sitemap < 100 URLs, accueil sans title/canonical, `noindex` ou non-200 sur les 10 premières villes, 6 pages Aïd, 1 page partenaire | cron Vercel |
| `scripts/check-prerender.mjs` | CI : échoue si `/`, `/cgv`, `/a-propos`, `/boucherie-halal/chambery`, `/sitemap.xml` ne sont plus prérendus ou s'il reste < 250 routes prérendues | CI |

Détail fichier par fichier et défauts relevés : [references/code-map.md](references/code-map.md).

## 2. Règles de décision : indexer ou non

Ordre de lecture : seo-anti-penalty règle D, puis ce tableau.

| Type de page | Défaut | Sitemap |
|---|---|---|
| Ville `SEO_CITIES`, hub régional/départements, `devenir-boucher-partenaire/[ville]`, occasions × ville | index | toujours |
| Quartier, produit × ville, dimanche × ville | `noindex, follow` si 0 boutique | seulement si ville peuplée |
| Fiche `/boutique/[slug]` | index ; une boutique non `visible` doit sortir de l'index (404 ou `noindex`) — état actuel : voir le registre privé du programme (A3, D6) | boutiques `visible` |
| Pages transactionnelles et privées | `noindex` (layout) ; sous-chemins en `DISALLOW` | jamais |
| Recettes IA non `featured` | `noindex` | jamais |

- **Nouvelle famille programmatique** : une instance n'est indexable que si elle a ≥ 500 mots
  uniques (non gabarit) OU un inventaire réel (règle OR de seo-anti-penalty et de la mémoire) ;
  sinon `noindex, follow` + hors sitemap, et l'avis du propriétaire avant tout `noindex` sur une
  page business-critical. Google qualifie d'abus de contenu à grande échelle les pages produites
  en masse « pour manipuler le classement », et cite les pages par ville qui renvoient toutes
  vers une même destination comme exemple de doorway ; il ne donne aucun seuil de mots (S3).
  Compter les mots uniques réellement (texte propre à l'instance, hors gabarit) avant de conclure.
- **Une URL du sitemap = une URL indexable, en 200, avec canonical absolu identique** (S8, S2).
  Jamais une URL `noindex` dans le sitemap (erreur GSC déjà corrigée pour `/bons-plans/*`).
- **`robots.txt` ne sert pas à désindexer** : une URL bloquée peut rester indexée sans contenu
  (S8) et son `noindex` n'est jamais lu (S24, S25). Pour retirer une page publique : `noindex`
  d'abord, `DISALLOW` éventuellement après sa sortie de l'index. `Disallow: /panier/` ne couvre
  pas `/panier` (correspondance par préfixe, S26) : c'est le `noindex` du layout qui protège la
  racine. Si une URL privée apparaît « Indexée malgré le blocage par le fichier robots.txt »,
  lever le `DISALLOW` le temps que le `noindex` soit lu (S20).
- **Canonical** : `alternates.canonical` absolu `${SITE_URL}/…` dans `generateMetadata`,
  auto-référent ; vers une autre URL seulement pour un vrai doublon ; jamais via `noindex` ou
  robots.txt (S8).
- **Contenu** : aucun fait commercial faux. Les pages SEO affichent « payez en ligne » (faux : le
  paiement est sur place uniquement) et « frais 0,99 € » (que le chantier prix en cours ramène à
  0 : `serviceFeeCentsFor("ON_PICKUP")`, `src/lib/pricing/totals.ts`) → dette D1.

## 3. Sitemap et lastmod

- Google n'utilise `lastmod` que s'il est « régulièrement et vérifiablement » exact, et ignore
  `priority` et `changefreq` (S2). Bing ignore aussi ces deux champs et veut le vrai instant de
  modification du contenu (S11). Ne pas perdre de temps à régler `priority`.
- `lastmod` = dernière modification **significative** (contenu principal, données structurées,
  liens), pas l'heure de génération (S2, S11).
- Soumission : rapport Sitemaps de GSC, API Search Console ou ligne `Sitemap:` de robots.txt,
  déjà émise par `robots.ts` (S2 ; aucun « ping »). Limite : 50 000 URLs / 50 Mo par fichier.
- Défauts actuels (dette D3) : toutes les villes prennent `latestShop.updatedAt` (une boutique de
  Chambéry « modifie » Lyon) ; les boutiques prennent `Shop.updatedAt`, qui bouge à chaque
  écriture (`status`, `busyMode`, crons `busy-end`, `vacation-end`, `recalc-shop-tiers`).

Pattern conforme (même modèle que `SeoOccasion.lastUpdated`, déjà en place) :

```ts
// src/lib/seo/cities.ts — champ optionnel, bumpé à la main quand le texte change vraiment
export type SeoCity = { /* … */ lastUpdated?: string };

// src/app/sitemap.ts
const cityPages: MetadataRoute.Sitemap = SEO_CITIES.map((city) => ({
  url: `${BASE_URL}/boucherie-halal/${city.slug}`,
  lastModified: city.lastUpdated ? new Date(`${city.lastUpdated}T00:00:00Z`) : STATIC_CONTENT_UPDATED,
}));
```

Détails et IndexNow : [references/sitemap-indexnow.md](references/sitemap-indexnow.md).

## 4. Données structurées : ce qui sert encore (2026-11)

**Tout JSON-LD passe par `<JsonLd data={…} />`** (`@/components/seo/JsonLd`). Écrire soi-même un
`<script type="application/ld+json" dangerouslySetInnerHTML>` fait échouer
`src/lib/__tests__/json-ld.test.ts` (un texte de la base contenant `</script>` fermerait le bloc).

| Balisage | Statut Google | Décision Klik&Go |
|---|---|---|
| `FAQPage` | résultat enrichi **retiré de Search le 2026-05-07**, doc supprimée le 2026-06-15 (S5) | ne plus en ajouter ; l'existant est inoffensif s'il reste fidèle au texte visible (D1) |
| `SpeakableSpecification` | bêta, **États-Unis + anglais uniquement**, réponses d'actualité (S6) | aucun effet pour nous ; ne pas en ajouter |
| `Event` | France absente des pays servis ; ne pas baliser remises, occasions d'achat, coupons, horaires (S7) | point à arbitrer A2 |
| `LocalBusiness` / `Store` | `name` + `address` requis ; `geo` ≥ 5 décimales ; `aggregateRating`/`review` recommandés seulement aux sites qui recueillent des avis sur **d'autres** commerces (S9, S4) | garder `ShopSchema` |
| `Product` | marchand : page où l'on achète, centrée sur **un seul** produit, prix > 0 (S10) | fiche boutique = liste → non éligible ; pas de note boutique sur Product (D2) |
| `BreadcrumbList` | affiché sur desktop seulement (S5, S30) ; `item` = URL d'une vraie page (S30) | garder, URLs absolues **qui répondent 200** (D5) |
| `Organization` / `WebSite` | logo, nom du site ; le champ de recherche des liens annexes (sitelinks search box) n'existe plus, doc retirée le 2024-11-29 (S5) | garder ; le `SearchAction` vers `/recherche` (bloquée par robots) ne sert plus à rien |

Règles générales (S12) : le balisage décrit **ce que l'utilisateur voit sur la page**, exact et à
jour ; type le plus précis ; un balisage contraire aux règles peut valoir une action manuelle qui
retire les résultats enrichis (sans toucher au classement web). Avis : notes venant directement
des utilisateurs, jamais agrégées d'autres sites, visibles sur la page, sur un élément précis ;
consigne du 2026-07-24 contre les avis faux ou incités non déclarés (S4, S5).
Patterns et code : [references/structured-data.md](references/structured-data.md).

## 5. SEO local (pack local, fiches Google des bouchers)

- Google classe le local selon **pertinence, distance, notoriété** ; la notoriété dépend en
  partie des liens et du nombre d'avis ; on ne peut pas payer pour mieux se classer (S13).
- Une fiche Google Business Profile exige un lieu que les clients visitent ou un déplacement
  chez eux (S14) : tant que Klik&Go n'a pas de local ouvert au public, pas de fiche pour la
  marketplace. Le levier local, ce sont **les fiches des bouchers**.
- Fiche boucher : nom réel de l'enseigne, sans slogan, information de produit/service ni
  localisation ajoutés ; le moins de catégories possible ; site web représentant ce point de
  vente ; **l'URL de menu ne peut pas pointer vers un service de commande tiers** ; le lien
  Klik&Go se déclare dans la section « Commande de repas », marqué préféré pour le retrait,
  quand la fiche propose cette section (S14, S15 ; disponibilité pour une boucherie en France
  non vérifiée).
- Cohérence nom / adresse / téléphone entre la fiche Google, `Shop.address`/`phone` et le JSON-LD.
  `Shop` n'a pas de code postal (seulement `address`, `fullAddress`) → `postalCode` jamais émis.

Guide boucher et limites vérifiées : [references/local-seo.md](references/local-seo.md).

## 6. Maillage interne

- Liens crawlables : `<Link href>` / `<a href>` avec URL réelle, jamais `onClick` seul ; ancre
  descriptive et courte (« Boucherie halal à Grenoble »), ni « cliquez ici » ni bourrage (S16).
- Toute page indexable reçoit au moins un lien interne (pas d'orpheline) (S16). Hiérarchie :
  accueil → hub régional → départements → villes → quartiers / produits / occasions → boutiques.
- Liens en masse (footer, listes de villes, `otherCities`) : `prefetch={false}` (CLAUDE.md, coût
  CPU). **Non appliqué aujourd'hui** sur les gabarits ville / produit / occasion (dette D7).
- Lier en priorité les villes proches (même département, `getDepartmentForCity`) plutôt que
  les 54 autres villes à chaque page ; tout lien interne pointe vers l'URL canonique (S8).

## 7. Après une panne : reprise d'indexation (incident 05→13/11/2026)

Faits : le site a répondu **402** pendant 8 jours. Google n'utilise pas le contenu d'une URL
en 4xx (tous traités de même, sauf 429) et **retire de l'index les URLs déjà indexées** (S1). Un
5xx/429 ralentit le crawl et ne retire qu'à la longue ; Google conseille 503 + `Retry-After` pour
1-2 jours et dit qu'il n'y a « pas de délai fixe » pour récupérer d'un retrait complet (S1, S17).
Une mise à jour cœur a démarré le 2026-11-10 (S18) : les mouvements de novembre mélangent deux
causes, ne pas conclure trop vite.

Procédure pas à pas (curl, GSC, IndexNow, ce qu'il ne faut PAS faire) :
[references/indexation-recovery.md](references/indexation-recovery.md).

## 8. Mesure

- GSC Performance, type « Web » : inclut le trafic AI Overviews / AI Mode (S19). Rapport dédié
  « Performances dans l'IA générative (Recherche) » : impressions seulement, ouvert à tous les
  sites depuis le 2026-08-31, absent tant que le site a trop peu d'impressions (S28).
- Rapport « Indexation des pages » : motifs à suivre et « Valider la correction » (≈ 2 semaines)
  (S20) ; API URL Inspection : 2 000 requêtes/jour et 600/min par propriété (S21).
- Bing Webmaster Tools : date de dernière lecture du sitemap ; cron `bing-daily`.
- `llms.txt` : Google Search l'ignore, sans bénéfice ni dommage (S29, S5) ; le garder pour
  d'autres services, mais il doit dire vrai (D1). Voir [references/measurement.md](references/measurement.md).

## 9. Points à arbitrer (le propriétaire décide, ne pas trancher en code)

Résumé ; arguments et sources dans [references/points-a-arbitrer.md](references/points-a-arbitrer.md).

- **A1** Mémoire `project_seo_rules_2026.md` §A/§E (« ville sans boutique → noindex », sitemap
  filtré) contredit la règle OR de seo-anti-penalty et le code. Appliquer seo-anti-penalty.
- **A2** `Event` sur `/occasions/*` : sans effet en France et contraire aux consignes Google
  (occasion d'achat, Klik&Go en « organisateur » de l'Aïd). Remplacer par `WebPage` ?
- **A3** `/boutique/*` dans le sitemap et dans le ping IndexNow quotidien alors que la mémoire GSC
  interdit d'en demander l'indexation.
- **A4** Faut-il retirer les `FAQPage` existants (sans effet Google depuis mai 2026) ou les garder
  pour Bing/IA ? Garder impose qu'ils soient exacts (D1).
- **A5** Seuils « 500 mots » et « ≥ 1 inventaire » : issus de blogs SEO, pas de Google (S3 ne
  donne aucun seuil). Règle conservée telle quelle.
- **A6** Libellé de remplacement de « 0,99 € / payez en ligne » (D1) : à valider avant correction.
- **A7** `SpeakableSchema` : sans effet en France (S6) ; garder ou retirer.
- **A8** La règle OR justifie l'indexation des villes par « 700+ mots uniques » ; la mesure donne
  72 à 369 mots propres à la ville (aucune des 55 n'atteint 500), le reste est du gabarit. Règle
  appliquée : index. Au propriétaire de choisir : enrichir, ou limiter l'exception aux villes cibles.

## 10. Dette connue (à corriger dans un chantier dédié, avec test)

- **D1** « 0,99 € » / « payez en ligne » dans 16 fichiers publics (pages SEO, accueil,
  `a-propos`, `presse`, `cities.ts`, `occasions.ts`, FAQ JSON-LD, `llms.txt`). Le paiement en
  ligne n'existe pas. Les frais : `main` affiche encore 0,99 € au panier ; le chantier prix
  (`src/lib/pricing/`, non commité le 2026-11-14) les met à 0 en paiement sur place. Corriger les
  textes **avec** l'arrivée de ce chantier sur `main`, pas avant. Libellé : voir A6.
- **D2** `ProductSchema` : note **de la boutique** injectée en `aggregateRating` dans chaque
  `Product` (contraire à seo-anti-penalty C et à S4) ; `priceValidUntil = Date.now()+30j`
  (arbitraire, seo-anti-penalty F) ; `shippingDetails` déclare une livraison qui n'existe pas.
- **D3** lastmod inexacts (section 3) ; `Event.offers.validFrom = new Date()` dans une page ISR.
- **D4** `src/lib/seo/indexnow.ts` : doublon mort avec une 2ᵉ clé (`a050…`) → n'importer que
  `@/lib/indexnow`. Le cron `indexnow-fresh` renvoie chaque jour ≈ 120 URLs non modifiées ;
  la FAQ IndexNow demande de ne pas resoumettre des URLs inchangées (S22, S27).
- **D5** Fils d'Ariane JSON-LD vers des URLs sans page : `/produits` et `/produits/{produit}`
  (404), `/occasions/{occasion}` (404), `/occasions` (redirection) — constaté en production.
- **D6** `/boutique/{slug-inconnu}` répond **200** en production (2026-11-14) avec deux metas
  robots (`index, follow` + `noindex`) : soft-404 malgré le `notFound()` de `generateMetadata`.
  Comportement d'une fiche dont la boutique n'est pas `visible` : voir le registre privé du
  programme (A3).
- **D7** Aucun `prefetch={false}` sur les listes de villes des gabarits SEO (54 liens sur chaque
  page ville) ; `new Date().getFullYear()` dans le pied des pages ISR ville et partenaire.

## 11. Checklist avant de pousser un changement SEO

```
[ ] seo-anti-penalty relu ; checklist pré-vol remplie
[ ] Page nouvelle : décision index/noindex justifiée (tableau §2), canonical absolu, title unique
[ ] Sitemap : seulement des URLs 200 + indexables ; lastmod = vraie date de contenu
[ ] JSON-LD : via <JsonLd>, fidèle au texte visible, fil d'Ariane en 200, ni FAQPage ni Speakable neufs
[ ] Aucun montant / mode de paiement / délai faux dans le texte ou le JSON-LD
[ ] Pas de new Date()/Date.now() dans le rendu d'une page ISR/statique (CLAUDE.md)
[ ] Liens en masse prefetch={false} ; nouvelle page liée depuis son parent
[ ] Page ISR dynamique : generateStaticParams présent ; check-prerender passe en CI
[ ] npm run lint && npx tsc --noEmit && npm run test (dont seo-cities.test.ts, json-ld.test.ts)
```

## 12. Définition de terminé

1. Checklist §11 verte ; build CI (avec `check-prerender`) vert.
2. Après déploiement, sur chaque gabarit touché : code HTTP attendu, une seule balise
   `curl -s URL | grep -o '<meta name="robots"[^>]*>'`, canonical présent ; test des résultats
   enrichis si le JSON-LD change.
3. URLs réellement nouvelles ou modifiées signalées une fois (`@/lib/indexnow`, sitemap à jour).
4. Ligne datée (commit, URLs, effet attendu) ajoutée à la mémoire `project_bing_daily_log.md`
   (exigence de seo-anti-penalty).
5. Contrôle GSC planifié à J+7 (indexation) et J+28 (Performance) ; aucune conclusion pendant
   une mise à jour cœur.

## Références

Chaque section renvoie à son fichier de `references/` (carte du code, données structurées,
sitemap et IndexNow, reprise après panne, SEO local, mesure, points à arbitrer) ; toutes les
sources et les constats en production sont dans [references/sources.md](references/sources.md).
Skills liés : `seo-anti-penalty` (garde-fou), `web-performance` (Core Web Vitals),
`vercel-cost-performance` (ISR, middleware), `nextjs-app-router` (Metadata API, 404),
`conformite-france` (information du consommateur), `prisma-expert` (migrations).
