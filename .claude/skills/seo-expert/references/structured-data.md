# Données structurées : politiques Google 2026 et patterns Klik&Go

Préalable obligatoire : seo-anti-penalty, règles B, C et F. Sources : S4, S5, S6, S7, S9, S10, S12,
S23, S30.

## 0. Règle d'écriture (verrouillée par un test)

```tsx
import { JsonLd } from "@/components/seo/JsonLd";

<JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: title }} />
```

`JsonLd` sérialise avec `serializeJsonLd` (`src/lib/seo/jsonld/serialize.ts`), qui échappe `<`,
`>`, `&`, U+2028 et U+2029 : un avis client ou un nom de boutique contenant `</script>` ne peut
plus fermer le bloc. `src/lib/__tests__/json-ld.test.ts` échoue si un autre fichier de `src/`
contient à la fois `application/ld+json` et `dangerouslySetInnerHTML`. Ne jamais contourner.

## 1. Règles transverses (S12, S4)

1. Le JSON-LD décrit **ce qui est visible** sur la page. Une note, un avis, un prix, une FAQ absents
   du rendu ne se balisent pas.
2. Exact et à jour. Un montant faux (D1) dans un `FAQPage` ou un `Offer` est un balisage inexact.
3. Type le plus précis qui reste vrai (S12, S9). schema.org n'a pas de « ButcherShop » ; `Store`
   convient, `GroceryStore` est un sous-type existant (S23) — changement non décidé. Le triple type
   actuel `["Store","FoodEstablishment","LocalBusiness"]` est une forme acceptée (types multiples
   en tableau, S9) ; ne pas en ajouter d'autres.
4. Plusieurs entités sur une page : les relier par `@id` (S12). `ShopSchema` utilise déjà
   `@id = ${SITE_URL}/boutique/${slug}` : réutiliser ce même `@id` partout où la boutique apparaît.
5. Un balisage contraire aux règles peut valoir une action manuelle : la page perd l'éligibilité
   aux résultats enrichis, son classement web n'est pas touché (S12). Réussir le test des
   résultats enrichis ne garantit ni l'affichage ni la conformité aux règles (S12).
6. Pas d'horloge dans le JSON-LD d'une page ISR/statique (`new Date()`, `Date.now()`) : valeur
   figée au rendu, fausse ensuite, et contraire à CLAUDE.md.
7. Horaires : `opens` / `closes` au format hh:mm:ss (S9). `ShopSchema` émet aujourd'hui `HH:MM`.

## 2. Ce que Google affiche encore (fin 2026)

- **Retirés ou sans effet pour nous** : FAQ (n'apparaît plus depuis le 2026-05-07, S5) ; Speakable
  (bêta, États-Unis, anglais, S6) ; Event (France absente des pays servis, S7) ; types dont la doc
  a été retirée le 2025-09-09 (cours, salaire estimé, vidéo éducative, annonce spéciale, véhicule ;
  S5) ; champ de recherche des liens annexes (doc retirée le 2024-11-29, S5). Ne pas en ajouter.
- **Toujours utiles** : `LocalBusiness`/`Store` (fiche boutique), `Organization` + logo,
  `BreadcrumbList` (desktop), `Recipe`, `Product` sur une page produit unique.
- AI Overviews / AI Mode : aucun schéma spécial requis ; le JSON-LD doit simplement correspondre au
  texte visible (S19, S29).

## 3. Avis et notes (S4, S9, seo-anti-penalty A-C)

- Klik&Go recueille des avis de clients **sur des boucheries tierces** : c'est le cas où
  `LocalBusiness.aggregateRating`/`review` est recommandé (S9). Il deviendrait « auto-servi »
  (inéligible) si la boutique contrôlait elle-même ses avis (S4).
- `aggregateRating` seulement si `ratingCount > 0` et note affichée sur la page (déjà le cas :
  `boutique/[slug]` affiche `rating · ratingCount avis` et `ReviewList` ; `ShopCard` affiche la
  note sur les pages villes).
- Avis d'une boutique : jamais sur `Product`, `Recipe`, `Event` (S4 « élément précis, pas une
  liste » ; seo-anti-penalty C).
- Google recommande de n'accepter que des notes accompagnées d'un commentaire et d'un nom
  d'auteur (S5, 2025-01-15), et interdit les avis faux ou incités non déclarés (S4 ; ajout du
  2026-07-24, S5) : toute incitation (points fidélité, code promo) liée au dépôt d'un avis doit
  être évaluée avec seo-anti-penalty A et la skill conformite-france.

## 4. Pattern corrigé `ProductSchema` (D2)

À appliquer seulement le jour où une page produit unique existe ou si l'on garde le balisage sur la
fiche boutique en connaissance de cause (S10 : pages où l'on achète, centrées sur un seul produit).

```tsx
// src/components/seo/ProductSchema.tsx — props sans note ni avis de boutique
interface ProductSchemaProps {
  product: {
    id: string;
    name: string;
    description?: string | null;
    priceCents: number;
    imageUrl?: string | null;
    inStock?: boolean;
    category?: { name: string } | null;
    promoEnd?: Date | null; // date de fin réelle, sinon pas de priceValidUntil
  };
  shop: { name: string; slug: string };
}

// dans le composant
const offers: Record<string, unknown> = {
  "@type": "Offer",
  url: `${SITE_URL}/boutique/${shop.slug}`,
  priceCurrency: "EUR",
  price: (product.priceCents / 100).toFixed(2),
  availability:
    product.inStock !== false ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
  seller: { "@type": "Organization", name: shop.name },
  ...(product.promoEnd && { priceValidUntil: product.promoEnd.toISOString().slice(0, 10) }),
};
// … puis : return <JsonLd data={schema} />;
```

- Supprimer `aggregateRating` et `review` tant qu'il n'existe pas d'avis **par produit**.
- Supprimer `shippingDetails` : Klik&Go ne livre pas (CLAUDE.md « Pas de livraison ») ; déclarer
  une livraison gratuite en 0-1 h est inexact. Le champ est recommandé, pas requis (S10).
- `hasMerchantReturnPolicy` (recommandé, pas requis, S10) : seulement s'il reprend la politique
  réellement écrite dans les CGV.
- `priceValidUntil` : une date passée peut masquer l'annonce (S10) ; ne l'émettre que pour une
  vraie fin de promo (`Product.promoEnd` existe en base).
- Attention unités : pour KG/TRANCHE, `priceCents` est un prix **au kilo** ; ne jamais le présenter
  comme prix d'une pièce. Google documente le prix à l'unité de mesure avec
  `UnitPriceSpecification` + `referenceQuantity` (S10) ; ce montage n'a pas été testé ici : tant
  qu'il ne l'est pas (test des résultats enrichis sur une URL réelle), ne baliser en `Product`
  que les unités comptées (PIECE, BARQUETTE).
  Le prix balisé ignore aussi `promoPct`/`promoFixedCents` : si une promo est affichée, le prix
  balisé doit être celui affiché. Les règles de prix vivent dans `src/lib/pricing/*`
  (seule autorité, CLAUDE.md ; dossier du chantier prix, non commité le 2026-11-14) : réutiliser
  `resolveUnitPrice` (`src/lib/pricing/unit-price.ts`) une fois ce chantier sur `main`, ne pas
  recalculer dans le composant.

## 5. `Event` sur les occasions (point A2)

Le code émet un `Event` « Aïd al-Adha halal à {ville} », organisé par Klik&Go, lieu = une ville,
offre gratuite, `validFrom = new Date()`. Google demande de ne pas baliser en événement les
remises de courte durée, les occasions d'achat, les coupons (S7) ; la France n'est pas dans les
pays servis (S7) ; et `new Date()` viole CLAUDE.md. Proposition à faire valider : utiliser la
branche `WebPage` déjà écrite pour toutes les occasions.

## 6. Fil d'Ariane (D5)

- `item` = URL de la page que représente le niveau ; facultatif pour le dernier niveau ; le fil
  représente un parcours type de l'utilisateur, pas forcément la structure de l'URL (S30).
- Règle Klik&Go : chaque `url` passée à `BreadcrumbSchema` doit répondre 200 et être indexable.
  Aujourd'hui les gabarits produit × ville et occasion × ville citent des parents sans page
  (404 ou redirection). Correctif type : remplacer ces niveaux par des pages qui existent
  (`/trouver-boucherie-halal`, `/boucherie-halal/{ville}`), ou créer les pages parentes après
  passage par le tableau de décision de SKILL.md §2.

## 7. Contrôles avant push

```bash
# Aucun JSON-LD écrit hors de JsonLd (même contrôle que le test)
npm run test -- src/lib/__tests__/json-ld.test.ts
# Aucune note de boutique sur Product
grep -n "aggregateRating\|review" src/components/seo/ProductSchema.tsx
# Aucune horloge dans le JSON-LD ou le rendu des pages ISR SEO
grep -rn "new Date()\|Date.now()" src/components/seo src/app/boucherie-halal src/app/occasions src/app/produits
# Aucun nouveau FAQPage / Speakable
git diff --cached | grep -n '"FAQPage"\|SpeakableSchema'
```

Les deux premiers `grep` remontent aujourd'hui les défauts connus D2, D3 et D7 : le but est de ne
pas en ajouter. Puis, après déploiement : test des résultats enrichis + validator.schema.org sur
une URL par gabarit modifié (seo-anti-penalty, checklist).
