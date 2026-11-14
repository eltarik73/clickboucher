# Carte du code SEO (relevée le 2026-11-13, revérifiée le 2026-11-14 sur HEAD `32c581f`)

Décrit le code tel qu'il est. Les défauts sont numérotés comme dans SKILL.md (D1…D7).
CLAUDE.md parle encore de « 6 villes » dans `cities.ts` : périmé, il y en a 55.

## Routes et rendu

| Route | Fichier | index / noindex | Sitemap | Rendu |
|---|---|---|---|---|
| `/` | `src/app/(client)/page.tsx` | index | `lastModified = latestShop.updatedAt` | ISR 300 s |
| `/boucherie-halal/[ville]` | `src/app/boucherie-halal/[ville]/page.tsx` | toujours index (revert `4fc4897`) | toujours | ISR 3600 + `generateStaticParams` (SEO_CITIES) ; slug inconnu → 404 (vérifié en production) |
| `/boucherie-halal/[ville]/[quartier]` | `…/[quartier]/page.tsx` | `noindex, follow` si `shop.count` ville = 0 | si ville peuplée | ISR 3600 + `generateStaticParams` |
| `/produits/[produit]/[ville]` | `src/app/produits/[produit]/[ville]/page.tsx` | idem quartier | si ville peuplée | ISR 3600 + `generateStaticParams` |
| `/boucheries-halal-ouvertes-dimanche/[ville]` | `src/app/boucheries-halal-ouvertes-dimanche/[ville]/page.tsx` | idem | si ville peuplée (15 villes en dur, en double : `SUNDAY_CITIES` dans sitemap.ts et `ELIGIBLE_CITIES` dans la page — modifier les deux) | ISR 3600 + `generateStaticParams` |
| `/occasions/[occasion]/[ville]` | `src/app/occasions/[occasion]/[ville]/page.tsx` | toujours index | toujours (7 × 8 = 56), `lastmod` = `SeoOccasion.lastUpdated` | ISR 3600 |
| `/boucheries-halal-rhone-alpes`, `/boucheries-halal/[departement]` | hubs | index | toujours | ISR 86400 / 3600 |
| `/devenir-boucher-partenaire/[ville]` | layout + page | index (revert noindex) | toujours | ISR 86400 |
| `/boutique/[slug]` | `src/app/(client)/boutique/[slug]/page.tsx` | index, canonical auto-référent ; traitement d'une boutique non `visible` : voir le registre privé du programme | boutiques `visible` | **dynamique** (Upstash `no-store`, voulu) ; D6 |
| `/recettes/[slug]` | `src/app/(client)/recettes/[slug]/page.tsx` | `noindex, follow` si IA non `featured` | même filtre | ISR 3600 + `generateStaticParams` |
| `/cgv`, `/mentions-legales`, `/politique-de-confidentialite` | `(client)/…/page.tsx` | **index** (`robots: { index: true }` ; la mémoire disant « noindex » est périmée) | oui | statique |
| `/bons-plans/*` sous-pages, `/avantages`, `/pro`, `/recherche` | pages / layouts | `noindex` | non | — |
| privé (`/panier`, `/checkout`, `/commandes`, `/profil`, `/favoris`, `/onboarding`, admin) | layouts | `noindex` ; `DISALLOW` robots sur `/panier/`, `/checkout/`, `/commandes/`, `/profil/`… (sous-chemins seulement, S26) ; `/favoris` non bloquée | non | — |

Correspondance boutique ↔ ville : `city: { contains: city.name, mode: "insensitive" }` (pages) et
`c.includes(city.name.toLowerCase())` (sitemap). Un nom de ville saisi sans accent ou avec un
arrondissement peut donc rater ou matcher deux villes : vérifier sur données réelles avant de
s'appuyer sur `populatedCitySlugs`. En production le 2026-11-14, les seules pages filtrées
présentes au sitemap (1 quartier, 12 produit × ville, 1 dimanche) dérivent de Chambéry.

## Configuration programmatique (`src/lib/seo/`)

- `cities.ts` : `SeoCity { slug, name, region, description, latitude, longitude, districts, localContext, specialty }`,
  55 villes ; `SeoDepartment` (5) ; `getDepartmentForCity`. Test : `src/lib/__tests__/seo-cities.test.ts`
  (slugs uniques kebab-case, champs requis, `localContext` ≥ 120 **caractères**, lat/lng plausibles).
  Texte propre à chaque ville (`localContext` + `description` + `specialty` + `districts`) :
  72 à 369 mots, médiane 112. Les « 700+ mots » des commentaires du code comptent le gabarit
  (étapes, FAQ où seul le nom de ville change) — voir A8.
- `products.ts` : 12 produits, `PRODUCT_VILLE_PRIORITY_SLUGS`, `getProductCityCombinations()`.
- `occasions.ts` : 7 occasions, `OCCASION_VILLE_PRIORITY_SLUGS` (8 villes), `eventType?`,
  `eventStart?`, `eventEnd?`, `lastUpdated?` ; Aïd al-Adha 2027-05-16 et Ramadan 2027-02-08 =
  dates **estimées** (à revalider aux annonces officielles).
- `districts.ts` : 12 quartiers, `getCityDistrictCombinations()`.
- `jsonld/serialize.ts` : `serializeJsonLd(data)` échappe `<`, `>`, `&`, U+2028, U+2029.
- `indexnow.ts` : **doublon mort** (clé `a050cf04…`, aucun import) — D4.

## Composants JSON-LD (`src/components/seo/`)

- `JsonLd` : `<JsonLd data={…} id? />`, seul fichier de `src/` autorisé à combiner
  `application/ld+json` et `dangerouslySetInnerHTML` (garde : `src/lib/__tests__/json-ld.test.ts`).
  Tout nouveau schéma, y compris inline dans une page, passe par lui.
- `OrganizationSchema` (dans `src/app/layout.tsx`) : `Organization` (`@id #organization`, logo
  512 px, `areaServed` = 4 villes + la région, `contactPoint`, `sameAs` absent) + `WebSite` avec
  `SearchAction` vers `/recherche?q=` (route bloquée par robots.txt et `noindex`).
- `ShopSchema` : `["Store","FoodEstablishment","LocalBusiness"]`, `@id` = URL boutique, horaires
  via clés françaises (`lundi`…) + anglaises, émis en `HH:MM` (S9 demande hh:mm:ss ; le
  commentaire du code annonce `HH:MM:00` mais la fonction ne l'ajoute pas),
  `aggregateRating` si `ratingCount > 0`, 2 avis avec texte, `potentialAction: OrderAction`
  pickup. Valeurs codées en dur pour toutes les boutiques, à confirmer ou retirer :
  `addressRegion: "Auvergne-Rhône-Alpes"`, `paymentAccepted: "Cash, Credit Card"`,
  `priceRange: "€€"`, `servesCuisine: ["Halal", "Méditerranéenne"]`. Prop `zipCode` prévue mais
  jamais fournie (pas de champ en base).
- `ProductSchema` : D2 — reçoit `shop.rating/ratingCount` → `aggregateRating` sur chaque produit ;
  prop `reviews` prévue pour des avis boutique (non passée aujourd'hui par la fiche boutique) ;
  `priceValidUntil = Date.now()+30j` ; `shippingDetails` (livraison 0 € en 0-1 h vers FR) ;
  `hasMerchantReturnPolicy` (1 jour, `ReturnAtKiosk`, gratuit — non confirmé par les CGV). Appelé
  20 fois sur `/boutique/[slug]` (page liste → hors du périmètre « un seul produit », S10).
- `RecipeSchema` : nutrition estimée USDA documentée (conforme seo-anti-penalty F).
- `BreadcrumbSchema` : URLs absolues. Sur `/boutique` et les pages villes, le 2ᵉ niveau
  « Boucheries » pointe vers `/`. D5 : sur produit × ville le fil cite `/produits` et
  `/produits/{produit}` (404) ; sur occasion × ville, `/occasions` (redirigée vers
  `/trouver-boucherie-halal`) et `/occasions/{occasion}` (404).
- `SpeakableSchema` : sans effet en France (S6).
- `LastUpdated` : `<time dateTime>` ; `new Date(date)` sur une date fixe (pas d'horloge) → OK en ISR.
- `FAQPage` inline (via `JsonLd`) : villes, quartiers, produits, occasions, dimanche, départements,
  hub, partenaires, `trouver-boucherie-halal`.

## Événements et crons

- `src/lib/indexnow.ts` : `notifyIndexNow(urls): Promise<void>` — no-op hors
  `NODE_ENV=production`, filtre même hôte, n'échoue jamais (log `logger.warn`). Clé `b358f6be…`,
  fichier `public/b358f6be….txt`. Le commentaire d'en-tête (« déclenché à la création de produit,
  recette, offre ») est faux : seuls les trois appelants ci-dessous existent.
- Appelants : `api/admin/shops/[shopId]/validate` (fire-and-forget, envoie aussi `/sitemap.xml` et
  un slug de ville recalculé qui peut ne pas exister dans `SEO_CITIES`), `api/seo/indexnow`
  (admin, Zod `urls` 1..10 000), `api/cron/indexnow-fresh` (03:11 UTC, 2 + 55 × 2 + jusqu'à 20
  boutiques ≈ 120 URLs fixes chaque jour — D4).
- `api/cron/seo-audit` (10:11 UTC) : sitemap ≥ 100 `<loc>`, robots.txt, accueil (pas de `noindex`,
  title, canonical), **les 10 premières** `SEO_CITIES`, 6 pages Aïd al-Adha, la page partenaire de
  Chambéry (pas de `noindex`, réponse 200) → alerte via `logger.error` (Sentry). Ne couvre ni les
  45 autres villes, ni les canonicals hors accueil, ni l'en-tête `X-Robots-Tag`.
- `api/cron/bing-daily` (09:17 UTC) : audit Bing Webmaster.

## Dette D1 — faits commerciaux faux dans le contenu indexable

`grep -rlE "0,99 ?€|payez en ligne|paiement en ligne" src/app src/lib/seo public/llms.txt`
remonte aussi du back-office (`(boucher)`, `webmaster`, `api/orders`) : ne retenir que les 16
fichiers publics — pages ville, quartier, produit, occasion, dimanche, département, hub,
`trouver-boucherie-halal`, accueil, `a-propos`, `presse`, `commander-viande-halal`,
`click-and-collect-halal`, `cities.ts`, `occasions.ts`, `llms.txt` (« Paiement : en ligne (Stripe
Connect) ou sur place », « Frais client : 0,99 € »).
Réalité du code, en deux temps :
- « payez en ligne » est faux dès aujourd'hui : paiement sur place uniquement (CLAUDE.md).
- Frais : sur `main` (`32c581f`), `src/app/(client)/panier/page.tsx` ajoute encore
  `SERVICE_FEE_CENTS` (99) au total affiché. Le chantier prix en cours — `src/lib/pricing/`,
  présent dans l'arbre de travail mais **non commité** le 2026-11-14 — fixe
  `serviceFeeCentsFor("ON_PICKUP") = 0` et réserve les 0,99 € au mode `ONLINE`, pas encore proposé.
  Tant que ce chantier n'est pas sur `main`, le « 0,99 € » des pages SEO correspond au panier en
  production : corriger les textes dans le même lot que lui, pas avant.

Le texte apparaît aussi dans des `FAQPage` : le balisage doit refléter un contenu exact (S12).
Correction = chantier contenu (le propriétaire valide le libellé), pas un rechercher-remplacer
aveugle (Stripe est « à venir »).

## Dettes D5 à D7 — reproduire

```bash
# D5 : parents du fil d'Ariane sans page
for u in /produits /produits/merguez-halal /occasions /occasions/aid-al-adha; do
  curl -s -o /dev/null -w "%{http_code} $u\n" "https://klikandgo.app$u"; done
# D6 : soft-404 des fiches boutique (attendu : 404 et une seule meta robots)
curl -s -o /dev/null -w '%{http_code}\n' https://klikandgo.app/boutique/slug-inexistant
curl -s https://klikandgo.app/boutique/slug-inexistant | grep -o '<meta name="robots"[^>]*>'
# D7 : horloge et prefetch dans les gabarits SEO
grep -rn "new Date()\|Date.now()" src/components/seo src/app/boucherie-halal src/app/occasions \
  src/app/produits src/app/devenir-boucher-partenaire
grep -rL "prefetch={false}" src/app/boucherie-halal src/app/occasions src/app/produits --include=page.tsx
```

- D6 : en cas de règles robots contradictoires Google applique la plus restrictive (S25), donc
  ces URLs ne s'indexent pas, mais elles répondent 200 : c'est un soft-404, à traiter avec le
  skill `nextjs-app-router` (le segment a un `loading.tsx`).
- D7 : `src/app/boucherie-halal/[ville]/page.tsx` rend 54 `<Link>` « Autres villes » sans
  `prefetch={false}` et `new Date().getFullYear()` dans son pied de page (idem page partenaire).
