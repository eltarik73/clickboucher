# Confiance, preuve, urgence, promotions, mesure

Principe : sur une place de marché locale, la confiance se gagne par l'exactitude. Tout élément persuasif repose sur une donnée réelle de la base, ou n'est pas affiché. Les règles du propriétaire sur les avis (`seo-anti-penalty`) et le cadre légal (`conformite-france`) priment ; ce fichier ne traite que de la présentation. Identifiants de sources : [sources.md](sources.md). Champs et fichiers relus le 14/11/2026.

## 1. Signaux de confiance propres à une boucherie halal

| Signal | Donnée source | Règle d'affichage |
|---|---|---|
| Certification halal | `Product.halalOrg`, `labels` | Afficher l'organisme tel que saisi par le boucher ; jamais de badge « Halal » générique sans donnée |
| Origine | `origin`, `originRegion` | Drapeau + pays en toutes lettres (le drapeau seul n'est pas lu par tous) |
| Traçabilité | `race`, `elevageMode`, `halalMethod`, `freshDate` | Fiche repliable (« Fiche Confiance », en place dans `WeightSheet`) ; n'apparaît que si au moins un champ est rempli |
| Fraîcheur | `freshness`, `freshDetail` | Mention explicite pour surgelé et sous vide (en place) |
| Boutique réelle | adresse, téléphone, horaires, photo | Toujours visibles sur la page boutique ; photo réelle plutôt qu'image de repli |
| Prix | prix au kilo, total estimé, tolérance, frais réellement facturés | Voir heuristique 4 ; aucun coût caché, aucun coût affiché que le serveur ne facture pas |

Une mention de certification ou d'origine inexacte est un sujet légal, pas seulement d'interface : renvoyer à `conformite-france` avant d'ajouter un nouveau badge.

## 2. Notes et avis

- La moyenne s'affiche toujours avec le nombre d'avis. Dans les enquêtes Baymard, une note de 4,5 sur 57 avis est préférée près de deux fois plus souvent qu'un 5 sur 4 avis [B10].
- Sans avis : rien, ou « Nouveau » (snippets.md §7). Jamais « 0.0 ».
- Seuil minimal d'affichage (1 avis ? 5 ?) : à décider par le propriétaire. Un très petit nombre peut desservir la boutique [N11].
- Tri des boutiques : jamais sur la moyenne seule [B10].
- Chaque avis porte sa date. Le site indique si les avis sont contrôlés et comment [L4]. Affirmer qu'un avis vient d'un client sans l'avoir vérifié, ou publier un faux avis, est une pratique réputée trompeuse [L2].
- Demande d'avis : après le retrait, une seule fois, dans l'application (pas de pression au comptoir), sans contrepartie liée au contenu (règle détaillée dans `seo-anti-penalty`).
- Avis négatifs : affichés comme les autres ; prévoir la réponse du boucher.
- Dans le code, une note est enregistrée par deux appels successifs (`/api/orders/[id]/rate` puis `/api/reviews`, depuis `commande/[id]/page.tsx`) : vérifier qu'un avis reste lié à une commande retirée avant d'écrire « avis vérifié » où que ce soit.

## 3. Preuve sociale et urgence

| Élément | Autorisé si | Modèle dans le code |
|---|---|---|
| « n commandes cette semaine » | `count` réel, au-dessus d'un seuil (5 aujourd'hui) | `boutique/[slug]/page.tsx` (`ordersThisWeek`) |
| « Populaire » | Calculé sur des ventes réelles, ou choisi par le boucher et présenté comme son choix (« Sélection du boucher ») | `Product.popular` (aujourd'hui un simple drapeau saisi) |
| « Plus que n ! » | Stock réel suivi (`antiGaspiStock`, `flashSaleStock`) | `ProductCard.tsx` |
| Compte à rebours de promotion | Date de fin réelle (`promoEnd`) et la promotion s'arrête vraiment à cette date côté serveur (`resolveUnitPrice` ne l'applique plus) | `FlashCountdown.tsx` |
| « Ferme dans 45 min » | Calculé sur les horaires | `lib/shop-hours.ts` (`formatClosingHint`) |
| « n places » sur un créneau | Capacité réelle (`remaining`) | `available-slots/route.ts` |

Interdits : « commandé il y a 5 min », « 12 personnes regardent », stock inventé, minuteur qui redémarre, faux prix barré. Raisons : la rareté ne fonctionne durablement que si elle est vraie et utilisée avec modération, et elle coûte de la crédibilité quand le client en doute [N8] ; déclarer faussement qu'un produit n'est disponible que très peu de temps est une pratique réputée trompeuse [L2].

Un petit nombre affiché peut jouer contre l'offre [N11] : garder un seuil, et préférer ne rien afficher.

## 4. Promotions et prix barrés

- Un prix barré est une annonce de réduction : le prix de référence est le plus bas pratiqué dans les 30 jours précédents ; les produits périssables menacés d'altération rapide font exception [L3]. La qualification d'un produit anti-gaspi relève de `conformite-france`.
- Trois sources de prix barré existent dans `ProductCard.tsx` (promotion → `baseCents` de `displayedUnitPrice`, `antiGaspiOrigPriceCents`, `packOldPriceCents`) : toute nouvelle présentation de promotion passe par la même vérification.
- Un seul badge de promotion par carte, le plus avantageux ; anti-gaspi prioritaire (en place).
- Code promo : champ replié par défaut (« J'ai un code »), pour ne pas pousser le client à quitter la page en chercher un — choix d'équipe, non sourcé. Il est réservé au client connecté par le serveur (voir `click-and-collect`, A14).
- « Frais offerts », jamais « livraison offerte ». Tant que les frais de service sont nuls en paiement sur place, une promesse « Frais offerts » n'offre rien : ne pas l'afficher comme un avantage sans la décision A13 de `click-and-collect`.

## 5. Mesure

Aucun événement de conversion n'est émis aujourd'hui (voir SKILL.md, points à arbitrer). Tant que c'est le cas, ne pas écrire « +x % de conversion » dans un commentaire, une PR ou un skill.

Proposition d'entonnoir minimal (à valider par le propriétaire, puis à instrumenter avec `conformite-france` pour le consentement) :

| Étape | Événement | Déclencheur |
|---|---|---|
| 1 | `shop_view` | Affichage d'une page boutique |
| 2 | `add_to_cart` | Premier ajout de la session dans une boutique |
| 3 | `checkout_view` | Arrivée sur `/panier` avec au moins un article |
| 4 | `order_submitted` | Réponse 201 de `POST /api/orders` ou `/api/checkout/guest` (avec `guest: true/false`, `mode: asap/slot`) ; ne pas compter un rejeu (200) |
| 5 | `order_picked_up` | Passage à `PICKED_UP` (côté serveur) |
| — | `order_refused` | Refus serveur, avec le code (`SERVICE_DISABLED`, `CAPACITY_EXCEEDED`, `PRICE_CHANGED`…) |

Lecture : le taux 3 → 4 est celui que les heuristiques de formulaire visent ; 4 → 5 mesure la promesse tenue (refus, expirations, oublis). Repère général, tous secteurs confondus : 70 % de paniers abandonnés en moyenne sur 50 études [B1] — ce n'est pas une cible pour une commande à retirer. Tout événement émis depuis le navigateur respecte la règle CLAUDE.md : aucun appel ajouté au montage pour un visiteur anonyme.

Les seuils chiffrés de l'ancienne version de ce skill (« taux d'ajout > 30 % », « moins de 5 appuis », « rétention > 40 % ») n'avaient pas de source : ils ont été retirés. Les objectifs se fixent à partir de nos propres mesures.

## 6. Ce qu'on ne fait pas

- Pas de fenêtre surgissante à l'arrivée qui masque la liste des boutiques avant toute interaction ; `OfferPopup` existe (monté sur l'accueil) : respecter sa fréquence (`popupFrequency`) et ne jamais l'ouvrir sur `/panier` ou `/suivi`.
- Pas de case pré-cochée, pas d'option payante ajoutée par défaut, pas de bouton de refus moins lisible que le bouton d'acceptation.
- Pas de compteur de stock ou de temps décoratif.
- Pas de confettis ni d'animation qui retarde l'information utile ; toute animation respecte `prefers-reduced-motion`.
- Pas de demande de création de compte, d'installation ou de notification avant que le client ait obtenu ce qu'il venait chercher [B3][W6].
