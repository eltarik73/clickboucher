# Droit de la consommation et place de marché — détail

Pas un avis juridique. Identifiants → [sources.md](sources.md).

## 1. Mentions légales (`src/app/(client)/mentions-legales/page.tsx`)

Pour un entrepreneur individuel `[S2]` : nom, prénom + « entrepreneur individuel » ou « EI » ;
adresse ; e-mail **et téléphone** ; numéro RCS et/ou RNE ; TVA intracommunautaire le cas échéant ;
hébergeur **nom, adresse, téléphone** ; CGV en ligne. Écarts actuels : « SIRET : en cours
d'immatriculation », pas de téléphone, adresse limitée à la ville, Vercel sans téléphone, Railway
sans adresse ni téléphone, section cookies contraire au code ([rgpd-cnil.md § 1](rgpd-cnil.md)).
Ces données viennent de l'owner : ne jamais en inventer, ne jamais « compléter » une adresse.

## 2. Parcours de commande (`src/app/(client)/panier/page.tsx`)

Contrat à distance entre le client et **la boucherie**, conclu par l'intermédiaire de Klik&Go
(CGV art. 1). Klik&Go doit donner au vendeur l'espace pour communiquer ses informations
précontractuelles `[L1]`.

| Exigence | Source | État | À faire |
|---|---|---|---|
| Caractéristiques essentielles et prix TTC, rappelés juste avant la validation | L221-5 1°-2° `[L2]`, L221-14 `[L4]` | Récapitulatif + devis serveur `POST /api/orders/quote` | Garder le devis comme seule source du prix affiché (CLAUDE.md) |
| Identité et coordonnées du vendeur (la boucherie) | L221-5 4° `[L2]`, L111-7 3° `[L1]` | Nom de la boutique seulement | Afficher raison sociale (`Shop.legalName`), `siret`, adresse, téléphone avant validation ; `legalName` et `siret` sont optionnels en base |
| Moyens de paiement acceptés, au plus tard au début de la commande | L221-14 `[L4]` | Bloc « Mode de paiement » rendu seulement si `signedIn` | L'afficher aussi à l'invité, dès le panier |
| Absence de droit de rétractation | L221-5 10° `[L2]`, L221-28 4° `[L6]` | Absent | Phrase près du bouton + CGV. La fonctionnalité de rétractation (L221-21) n'est due que si un droit existe `[L2][L5]` |
| Médiateur de la consommation | L221-5 6° `[L2]`, `[M1]` | Absent partout | § 3 |
| Bouton qui dit l'obligation de payer | L221-14 `[L4]` | « Confirmer ma commande » | Formule sans ambiguïté (« Commande avec obligation de paiement » est celle du texte) ; variante adaptée au paiement au retrait : **[JURISTE]**. Même arbitrage que `click-and-collect` A4 |
| Confirmation sur support durable, au plus tard au retrait, reprenant les informations de L221-5 | L221-13 `[L5]` | `sendOrderConfirmationEmail` (`src/lib/services/orders/announce.ts`, gabarit `src/lib/emails/order-confirmation.ts`) ; `sendEmail` ne fait que journaliser quand `RESEND_API_KEY` est absent (configuration en production : voir le registre privé du programme) | Vérifier que l'envoi part réellement ; faire porter à l'e-mail : vendeur et ses coordonnées, articles, prix, retrait, absence de rétractation, médiateur |
| Total à payer exact | L221-5 2°, arrêté 1987 art. 1 et 14 `[L11]` | `amountDueCents` du devis | `serviceFeeCentsFor("ON_PICKUP") = 0` : ne jamais annoncer un frais qui n'est pas facturé (écart G7) |

**Ajustement au poids** (CLAUDE.md, palier 2 : hausse validée d'office après 5 min sans réponse) :
L121-17 exige le consentement exprès pour tout paiement **supplémentaire** au prix de l'objet
principal et exclut le consentement par défaut `[L3]`. Son application à un écart de pesée n'est pas
tranchée ici → point à arbitrer n° 2 **[JURISTE]**. D'ici là, ne pas élargir le mécanisme : CGV qui
annoncent la tolérance avant la commande, prix estimé affiché (« /kg » + poids), refus possible.

## 3. Médiateur et CGV (`src/app/(client)/cgv/page.tsx`)

Médiateur `[M1]` : obligatoire quelle que soit la taille ; choisi parmi les médiateurs référencés par
la CECMC et compétents pour le secteur, après convention (coût pour le professionnel, gratuit pour le
consommateur). Afficher **nom, adresse postale et site internet** du médiateur sur le site, dans les
CGV et les bons de commande. La vente étant conclue avec la boucherie, savoir quel médiateur
s'affiche (celui de chaque boucherie, celui de Klik&Go pour son propre service, ou les deux) :
**[JURISTE]**. En pratique : champ médiateur par boutique + médiateur de la plateforme dans les CGV.
**Pas** de lien vers la plateforme européenne RLL : supprimée le 20/07/2025 `[E1]`.

Autres compléments des CGV :
- absence de rétractation (denrées périssables) `[L6]` ;
- retirer « ou en ligne via la plateforme » tant que Stripe n'est pas actif (information inexacte) ;
  même correction sur les pages publiques qui écrivent « payez en ligne » ;
- critères de classement des boutiques (§ 4) `[L1]` ;
- ajustement de poids : tolérance, délai de réponse, effet du silence (**[JURISTE]**) ;
- modération des avis (§ 5) et point de contact (§ 4, DSA) ;
- accessibilité : si l'exemption de taille cesse, la description de conformité va dans les
  conditions générales (D412-57) `[A1]`.

## 4. Place de marché : classement et relations avec les boucheries

- **Clients** (L111-7 `[L1]`) : publier les modalités de classement. Le tri réel de la page d'accueil
  (`src/app/(client)/page.tsx`) : boutiques avec promotion active d'abord, puis note décroissante.
  L'écrire tel quel, et le mettre à jour dans la même PR que tout changement de tri. `Shop.featured`
  existe : une mise en avant **payée** doit être signalée (L121-4 25° `[L9]`, L111-7 2° `[L1]`).
- **Boucheries** — règlement P2B `[E3]`, applicable sans condition de taille sauf mention :
  - art. 5 : principaux paramètres de classement, leur importance relative et tout effet d'une
    rémunération, dans les conditions générales partenaires ;
  - art. 3 : toute modification des conditions est notifiée sur support durable (e-mail) avec un
    préavis d'au moins **15 jours** ;
  - art. 4 : restreindre ou suspendre une boutique → **motifs sur support durable** au plus tard à
    la prise d'effet ; résiliation totale → motifs **30 jours** avant. Aujourd'hui
    `src/app/api/admin/shops/[shopId]/suspend/route.ts` accepte un `reason` optionnel et n'envoie
    rien au boucher : rendre le motif obligatoire et l'envoyer ;
  - art. 11 et 12 (système interne de réclamation, médiateurs désignés) : non imposés à une petite
    entreprise.
- **DSA** `[E2]` : les sections 3 (plateformes) et 4 (places de marché, traçabilité des
  professionnels) ne s'appliquent pas aux micro et petites entreprises (art. 19 et 29), pas plus que
  le rapport de transparence (art. 15). Restent sans exemption de taille : point de contact unique
  pour les autorités et pour les utilisateurs (art. 11, 12), conditions générales décrivant la
  modération (art. 14), et, pour un hébergeur de contenus d'utilisateurs comme les avis, mécanisme
  de notification de contenu illicite (art. 16), motivation des retraits (art. 17), signalement des
  soupçons d'infraction pénale grave (art. 18). Qualification de Klik&Go et mise en œuvre :
  **[JURISTE]**. Sans attendre : une adresse de contact dans les mentions, un bouton « Signaler »
  sur les avis, un motif enregistré pour tout retrait d'avis ou suspension.
- Identité des vendeurs : rendre `Shop.siret` et `Shop.legalName` obligatoires avant publication
  d'une boutique et les afficher dans le parcours de commande (§ 2).

## 5. Avis en ligne

Deux circuits : `POST /api/reviews` (modèle `Review`) et
`POST /api/orders/[id]/rate` (`Order.rating`, lié à une commande retirée, service
`src/lib/services/orders/commands/rate.ts`). Les deux alimentent `Shop.rating`.

Un avis sans achat reste un « avis en ligne » au sens du décret (D111-16 `[L8]`) : il n'est pas
interdit. Ce qui est réputé trompeur, c'est de le présenter comme venant d'un acheteur sans mesure
de vérification (L121-4 27° `[L9]`). Décision d'ingénierie recommandée, plus simple à tenir : n'accepter
un avis que rattaché à une commande vérifiée côté serveur (statut `PICKED_UP` ou `COMPLETED`, même
client, même boutique), ou fusionner les deux circuits sur `orders/[id]/rate` ; test d'intégration
qui refuse un avis sans commande retirée. État actuel du contrôle : voir le registre privé du programme.

| Obligation `[L7][L8][L9]` | Implémentation |
|---|---|
| À proximité des avis : contrôle ou non | Ligne sous le titre « Avis clients » de `src/components/shop/ReviewList.tsx` : « Avis déposés par des clients ayant retiré une commande » **seulement si c'est vrai** ; sinon « Avis non contrôlés » |
| Date de publication **et** date de l'expérience | `Review.createdAt` + date de retrait de la commande liée (aujourd'hui seule `createdAt` est renvoyée par `GET /api/reviews`) |
| Critères de classement des avis | « Les plus récents d'abord » (`orderBy: { createdAt: "desc" }`, 50 au plus) |
| Rubrique accessible : contrepartie éventuelle, délai maximal de publication et de conservation, caractéristiques du contrôle, possibilité de modifier, motifs de refus | Page ou section liée depuis `ReviewList` (texte validé par l'owner) |
| Refus motivé à l'auteur (D111-19) | Dès qu'une modération existe : statut + motif + notification |
| Signalement gratuit et motivé par le professionnel visé | Bouton « Signaler cet avis » côté boucher, à côté de la réponse (`/api/reviews/[id]/reply` existe) ; motif obligatoire |
| Pas de faux avis, pas d'avis modifié ou trié pour promouvoir (28°) | Ne jamais masquer les avis négatifs ni n'afficher que les « meilleurs » ; JSON-LD et témoignages : `seo-anti-penalty` A à C |

## 6. Annonces de réduction de prix

L112-1-1 `[L10]` : tout prix barré, « -X % » ou « avant / après » indique un prix antérieur égal au
**prix le plus bas pratiqué dans les 30 jours** précédant la réduction (réductions successives :
celui d'avant la première). Hors champ : produits périssables menacés d'altération rapide
(périmètre pour la viande fraîche, sous vide, surgelée : **[JURISTE]**) et comparaison avec le prix
d'un autre professionnel.

Code : `src/components/product/ProductCard.tsx` et `ProductSheet.tsx` barrent `price.baseCents`
(prix courant hors promotion), `antiGaspiOrigPriceCents` et `packOldPriceCents`, sans historique.
Avant toute **nouvelle** promotion affichée : table d'historique de prix par produit (une ligne à
chaque changement de `priceCents`, migration avec `prisma-expert`), fonction pure
`referencePriceCents(history, promoStart)` dans `src/lib/pricing/` avec son test unitaire, et le
prix barré = cette valeur. Le prix barré anti-gaspi est le candidat naturel à l'exception
« périssables », à confirmer.

## 7. Prix au poids

Prix TTC en euros (arrêté 1987, art. 1), accompagné de **l'unité** pour un produit vendu au poids
(art. 8), indiqué précisément avant la conclusion du contrat à distance (art. 14) `[L11]`.
Barquettes préemballées : prix au kilo en plus du prix de vente (arrêté 1999) `[L12]`. Le code
affiche déjà `unitLabel(product.unit)` et une estimation : garder ces deux éléments sur toute
nouvelle carte, fiche ou ligne de panier, et passer par `src/lib/pricing/` pour tout montant
(CLAUDE.md « Commandes : quantités, prix, totaux »).
