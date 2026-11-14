# SEO local : pack local et fiches Google des bouchers

Sources : S3, S9, S13, S14, S15, S16, S29. Stratégie géographique : mémoire
`project_agglo_chambery_strategy.md` (Chambéry priorité n° 1, puis Aix-les-Bains, Bissy, Grenoble,
agglo).

## Comment Google classe en local (S13)

- **Pertinence** : la fiche correspond-elle à la requête (catégorie, informations complètes).
- **Distance** : position du chercheur ; on n'y peut rien.
- **Notoriété** : en partie le nombre de sites qui renvoient vers l'établissement et le nombre
  d'avis ; davantage d'avis et de notes positives aident le classement local. Répondre aux avis
  montre qu'on tient compte des clients (la page ne dit pas que cela améliore le classement).
- Aucun moyen de payer pour un meilleur classement local.

Conséquence : le pack local se gagne **sur les fiches Google des boucheries**, pas sur
klikandgo.app. Nos pages villes visent les résultats web classiques sous le pack. Le guide IA de
Google cite aussi Business Profile comme aide à la visibilité dans les réponses IA (S29).

## Klik&Go lui-même

Pas de fiche Google Business Profile pour la marketplace tant qu'elle n'a pas de local ouvert au
public : l'éligibilité exige un lieu que les clients visitent ou un déplacement chez eux (S14).
Ne pas en créer une avec une adresse de domiciliation : une adresse postale louée où l'entreprise
n'exerce pas est inéligible (S14).

## Guide à donner aux bouchers partenaires (vérifié S14, S15)

| Élément | Règle |
|---|---|
| Nom | Nom réel de l'enseigne. Pas de slogan, d'information de produit ou de service, ni de localisation ajoutés (donc pas de « halal » ou de ville s'ils ne font pas partie du nom réel). |
| Catégorie | Le moins de catégories possible ; ce que l'établissement **est**, pas ce qu'il **a**. Choisir dans la liste proposée par l'interface. |
| Site web | Un site qui représente ce point de vente. |
| URL de menu | **Jamais** un lien direct vers un service de commande ou de livraison tiers (donc pas Klik&Go). |
| Lien de commande | Section « Commande de repas » de la fiche : ajouter le lien Klik&Go de la boutique et le marquer préféré pour le **retrait** (le marquage est distinct pour retrait et livraison). |
| Description | Aucun lien. |
| Horaires | Identiques à `Shop.openingHours` (clés `lundi`…`dimanche`, lire via `getDayHours`). |
| Avis | Répondre ; ne jamais acheter, filtrer ni inciter (seo-anti-penalty A). |

Non vérifié et donc non affirmé :
- que la section « Commande de repas » soit proposée aux fiches de catégorie boucherie en France
  (la page d'aide ne liste ni catégories ni pays ; à constater sur une vraie fiche partenaire
  avant d'en faire une promesse commerciale) ;
- que le champ « Site web » puisse pointer vers la page Klik&Go quand le boucher n'a pas de site ;
- le libellé exact des catégories et attributs (« halal », « retrait en magasin ») disponibles en
  France.

## Cohérence nom / adresse / téléphone

- Source de vérité côté Klik&Go : `Shop.name`, `Shop.address`, `Shop.fullAddress`, `Shop.phone`,
  `latitude/longitude`. Pas de champ code postal → `PostalAddress.postalCode` jamais émis par
  `ShopSchema` (sa prop `zipCode` n'est jamais fournie) ; l'ajouter demande une migration (skill
  prisma-expert).
- `geo` : ≥ 5 décimales (S9) ; ne jamais inventer de coordonnées (seo-anti-penalty F).
- `addressRegion`, `paymentAccepted`, `priceRange`, `servesCuisine` sont codés en dur pour toutes
  les boutiques : à revoir boutique par boutique (le balisage doit être exact, S12).

## Pages locales sur klikandgo.app

- Une page ville doit apporter ce que le pack local n'apporte pas : liste des boutiques
  partenaires avec créneaux, prix, retrait, contexte local réel. Des pages par ville qui
  diffèrent peu et renvoient vers une même destination sont l'exemple que Google donne du
  doorway (S3) ; c'est la raison de la règle OR de seo-anti-penalty. État mesuré : 72 à 369 mots
  propres à chaque ville, et le bloc « Klik&Go arrive bientôt à {ville} » sur toute ville sans
  boutique — la grande majorité aujourd'hui (point à arbitrer A8).
- Maillage : ville → quartiers/produits/occasions de la même ville → boutiques ; ville ↔ villes
  voisines (même département, `getDepartmentForCity`) plutôt que les 54 autres villes ; ancres
  descriptives (S16) ; `prefetch={false}` (absent aujourd'hui, dette D7).
- `areaServed` de `OrganizationSchema` liste 4 villes et la région : le garder aligné sur les
  villes où des boutiques existent réellement.
