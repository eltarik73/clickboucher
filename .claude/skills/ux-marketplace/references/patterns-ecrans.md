# Patterns écran par écran

Pour chaque surface : ce qui existe (relu le 14/11/2026 sur l'arbre de travail, chantier « intégrité des commandes » compris), la cible, et la raison. Les règles métier associées sont dans `click-and-collect` ; ici on ne parle que de la forme et du comportement de l'interface. Identifiants de sources : [sources.md](sources.md). Les `E…` renvoient à `click-and-collect/references/ecarts-constates.md`.

## 1. Accueil — liste des boutiques

**Existant.** Héros avec logo et accroche, puis suivi de commande active, recherche, carrousel de promotions, « Commander à nouveau » + carte de localisation, liste « ouvertes » puis « fermées » en grille 1 colonne (2 dès `sm`). Géolocalisation IP silencieuse, GPS sur bouton.

**Cible.**
- Sur téléphone, la première carte boutique doit apparaître sans défilement excessif : le héros (logo 80 px + deux titres + boutons) repousse la liste. Mesurer sur 375 × 667 avant de toucher au reste. Un client qui revient n'a pas besoin de l'accroche : envisager un héros réduit quand une session ou un panier existe — après le montage seulement, la page étant prérendue (ISR).
- Ordre des blocs pour un client connu : commande en cours → commander à nouveau → boutiques. Pour un nouveau visiteur : boutiques d'abord. La dernière commande doit permettre l'ajout direct au panier, pas seulement un lien vers la boutique [B6] (E16).
- Chaque carte répond à quatre questions : puis-je commander maintenant, en combien de temps, à quelle distance, est-ce bien noté (avec le nombre d'avis [B10]).
- Section « Actuellement fermées » : garder les cartes cliquables (consultation du catalogue), afficher la prochaine ouverture. Le filtre `grayscale` appliqué à toute la grille réduit le contraste du texte : ne griser que l'image.

**À ne pas faire.** Demander la position au chargement ; vider la liste quand la géolocalisation ne trouve rien (le mode `silent` de `fetchNearby` le prévient déjà) ; afficher un indicateur de chargement plein écran alors que la liste serveur est déjà là ; ajouter un appel API au montage pour un visiteur anonyme (règle CLAUDE.md ; les deux appels de géolocalisation existants sont le budget admis, voir `vercel-cost-performance`).

## 2. Carte boutique — `ShopCard.tsx`

**Existant.** Variante par défaut (image 144/192 px, badges délai/statut/promo, favori, distance ou ville, nom, adresse, note) et variante compacte. Favori `min-w/min-h 44px`, visible seulement pour un client connecté.

**Cible.**
- Badge de délai : la couleur seule (vert/ambre/rouge) ne porte pas l'information — le nombre de minutes est déjà écrit, le garder toujours.
- Bouton « Voir la boutique » au survol : sans effet au doigt, à ne pas considérer comme un appel à l'action ; toute la carte est le lien.
- Note : composant `ShopRating` (snippets.md §7) ; rien ou « Nouveau » sans avis (E14).
- Promotion : badge court (« Frais offerts », « -20 % ») — conforme à CLAUDE.md ; le sens de « Frais offerts » quand aucun frais n'est facturé sur place est à arbitrer (`click-and-collect`, A13).
- Favori dans un lien : le bouton est imbriqué dans un `<a>` (contenu interactif imbriqué, même si `preventDefault` empêche la navigation). Cible et code : patron « Carte cliquable contenant un bouton » d'`accessibility-wcag` (§11).

## 3. Page boutique — en-tête et menu

**Existant.** Image 300 px avec nom, note, délai, statut ; adresse, téléphone, description, preuve sociale réelle, retrait le plus tôt, lien ville ; horaires en accordéon ; bandeau de pause ; bannière d'offre ; fidélité ; anti-gaspi ; pastilles de catégorie collantes (filtre) ; section promos ; grille produits ; barre panier ; avis.

**Cible.**
- Avant la grille de produits, il y a jusqu'à huit blocs. Les blocs marketing (bannière, fidélité, anti-gaspi) ne doivent pas repousser le premier produit de plus d'un écran sur téléphone : en afficher un seul déplié, les autres en ligne compacte. À vérifier sur 375 px.
- Minimum de commande dans l'en-tête ou la barre panier (heuristique 4, E11) ; frais seulement s'ils sont facturés.
- Pastilles : `min-h-[44px]`, état actif annoncé (`aria-pressed`), la première visible partiellement coupée à droite pour signaler le défilement horizontal.
- Recherche dans le catalogue dès qu'une boutique dépasse ce qui tient en trois écrans (choix d'équipe).
- Photos : priorité aux produits marqués `popular` ; selon l'analyse DoorDash, le nombre de photos est le premier facteur lié à la conversion d'un menu, surtout sur les articles phares [P4]. Les images de repli (`resolveProductImage`) dépannent, elles ne remplacent pas une vraie photo.
- Section « Les plus commandés » en tête de menu, calculée sur des ventes réelles : Uber Eats a généralisé cette catégorie après un test local [P2].

## 4. Carte produit — `ProductCard.tsx`

**Existant.** Carte compacte : image 4:3, badge promo ou anti-gaspi, bouclier de traçabilité, nom sur une ligne tronquée (12 px), pastilles origine/halal (10 px), prix + unité, estimation au poids minimum, bouton « + » 44 px qui devient compteur pour les unités à la pièce. Le prix affiché vient de `displayedUnitPrice` (aucune horloge avant le montage).

**Cible.**
- Texte : 12 px pour le nom et 10 px pour les pastilles sont à la limite de la lisibilité ; ne pas descendre en dessous, et vérifier le contraste des pastilles en mode sombre.
- Nom tronqué : le nom complet doit être lisible dans la feuille de détail (c'est le cas) ; garder l'ouverture de la feuille au toucher de la carte.
- Produit au poids déjà au panier : pastille « Au panier · 500 g » sur la carte [B9] (E23).
- Rupture : carte atténuée, étiquette « Indisponible », bouton retiré (en place). Ajouter la date de retour si le produit est en veille avec échéance.
- Promotion : ancien prix barré + nouveau prix ; le prix de référence relève de `conformite-france` [L3].
- « Plus que n ! » : uniquement sur `antiGaspiStock` réel (en place) [L2].
- Garder `displayedUnitPrice` et `portionPriceCents` : ne pas recalculer une promotion dans le composant.

## 5. Feuilles produit — poids, tranche, détail

**Existant.** `WeightSheet` : carte centrée de 340 px, préréglages, « − / saisie / + », bascule poids ↔ pièces, découpe, variante « Saveur », fiche de traçabilité repliable, note de tolérance, bouton « Ajouter + prix ». Fermeture par croix, clic sur le fond, Échap. Ni rôle de dialogue ni piège de focus (E21). `ProductSheet` (détail) : même construction ; pour un produit au poids ou à la tranche, son bouton (« Choisir le poids », « Choisir les tranches ») lance la fermeture de la fiche (fondu de 300 ms) et ouvre aussitôt la feuille suivante : les deux ne restent pas empilées.

**Cible.**
- Base technique : `ui/sheet.tsx` ou `ui/dialog.tsx` (snippets.md §9), pour le rôle de dialogue et le piège de focus ; retour du focus selon `accessibility-wcag` [W3][N6].
- Cibles : « − » et « + » 44 px, préréglages 44 px de haut, bouton principal 48 px, croix 44 px. La saisie libre reste possible (`inputMode="numeric"`, en place) [N7].
- Valeur par défaut : la plus choisie (aujourd'hui le deuxième préréglage de la catégorie, `presetsG[1]`) [N7].
- Le total du bouton se met à jour à chaque geste, y compris découpe et mode pièces.
- Option obligatoire (variante) : la signaler et empêcher l'ajout avec un message, plutôt qu'ajouter sans variante.
- Estimation « ≈ 4 pers. » (`computeEstimation`) : la garder, c'est l'aide à la décision propre à la boucherie.
- Une seule feuille à la fois : conserver l'enchaînement actuel (la fiche se referme quand la feuille poids s'ouvre) ; ne jamais en laisser deux empilées [N6]. En passant à Radix, fermer la première avant d'ouvrir la seconde, sinon deux pièges de focus se disputent.

## 6. Barre panier et confirmation d'ajout

**Existant.** Toast de 1,5 s en haut + vibration + bouton qui passe au vert ; barre fixe sombre « n · Panier · total · Commander → » au-dessus de la `BottomNav`.

**Cible.**
- Le compteur sur la carte est la meilleure confirmation [B8] ; le toast est un complément, pas la seule trace. Pour un produit au poids, le toast précise le poids (en place).
- La barre annonce son contenu aux lecteurs d'écran quand il change (région d'état « 3 articles, 42,50 € », composant `LiveRegion` d'`accessibility-wcag`) [W2].
- Libellé du bouton : « Voir le panier » décrit mieux l'étape suivante que « Commander » (la commande n'est pas passée à cet appui) [W5].
- Total affiché : c'est une estimation locale ; le dire (« estimé ») tant que des lignes sont au poids, et ne pas laisser un écart inexpliqué avec le total du devis sur `/panier` (heuristique 4).

## 7. Panier et validation — `/panier`

**Existant.** Lignes avec image, quantité, total, « − / + » 44 px, corbeille ; suggestions ; code promo (connectés) ; coûts issus du devis serveur ; identité (invités) ; créneau (un seul bloc) ; note ; paiement (connectés) ; bouton collant, désactivé tant que le devis n'est pas prêt, qu'un créneau manque ou que le minimum n'est pas atteint.

**Cible.**
- Ligne au poids : « − / + » multiplie les portions (2 × 500 g). Offrir aussi « Modifier le poids » (rouvre la feuille ; `updateWeight` existe dans `useCart`) — sinon le client doit supprimer et recommencer.
- Retrait d'une ligne : immédiat avec « Annuler » (snippets.md §6) [B11]. Garder `ConfirmDialog` pour « Vider le panier » seulement [N10].
- Coûts : chaque ligne de coût a son explication en clair sous le libellé (pas d'info-bulle `title`, encore utilisée pour les frais de service).
- Créneau : `PickupSlotPicker` (snippets.md §2) ; navigation de date bornée ; « Aucun créneau ce jour » propose le jour suivant en un appui.
- Bouton final : collant, pleine largeur, libellé stable ; désactivé seulement pendant l'envoi. S'il manque un choix (créneau), laisser le bouton actif et montrer l'erreur au bon endroit [W5] (E36).
- Écran d'envoi : si le compte à rebours est conservé (point A3 de `click-and-collect`), le bouton « Annuler » garde le focus (en place) et l'annonce vocale ne doit pas se répéter chaque seconde (le compteur est aujourd'hui dans une zone `aria-live="polite"` : annoncer une fois).

## 8. Suivi — `/suivi/[id]`

**Existant.** Numéro 72 px + « Prénom N. », numéro de client quand il existe, badge d'état, frise verticale à émojis, détail (quantités par `formatStoredLineQuantity`), message du boucher, coordonnées, compte à rebours à la seconde, toasts de changement. Aucune action ; même écran pour une commande refusée (E3).

**Cible.**
- Hiérarchie : (1) état en une phrase, (2) fenêtre horaire, (3) numéro + prénom, (4) action possible, (5) adresse et itinéraire, (6) détail. Dernière information en premier [N4].
- Nom au format `Prénom.N` (`formatClientName`), comme sur le ticket du boucher.
- Frise : segments horizontaux remplis (4 étapes), lisibles d'un coup d'œil [P1] ; icônes Lucide à la place des émojis ; l'étape en cours ne clignote pas sous `prefers-reduced-motion`.
- « Prête » : c'est le moment fort — plein écran vert, numéro, adresse, bouton itinéraire ; notification envoyée au même instant.
- Échec : écran dédié par cause, motif du boucher, bouton de sortie.
- Région d'état (snippets.md §3).
- Hors ligne ou mise à jour impossible : garder le dernier état, afficher « Dernière mise à jour à 14h32 » (aujourd'hui un échec de rafraîchissement est silencieux, ce qui masque E33 pour l'invité).

## 9. Historique, favoris, fidélité, avis

- **Historique** (`commandes/page.tsx`) : filtres Toutes / En cours / Terminées (en place) ; carte entièrement cliquable + « Recommander » séparé ; pagination au-delà de 50 (règle CLAUDE.md).
- **Favoris** : bouton cœur à retour immédiat (en place) ; pour un anonyme, plutôt qu'aucun bouton, un cœur qui propose la connexion — à arbitrer (ajoute une sollicitation).
- **Fidélité** (`LoyaltyBadge.tsx`) : progression chiffrée (« 2 / 5 commandes »), récompense nommée, visible aussi au panier au moment où elle s'applique. Le programme affiché est à arbitrer (`click-and-collect`, A5).
- **Avis** : demande après retrait, dans l'application, étoiles de 44 px, commentaire facultatif, remerciement ; liste datée, moyenne + nombre, réponse du boucher si elle existe. Règles de fond : `seo-anti-penalty`, `conformite-france` [L4].

## 10. Écran cuisine

Voir `click-and-collect/references/cote-boucher.md`. Côté forme : thème sombre conservé, texte d'action ≥ 14 px, boutons ≥ 48 px, une couleur par statut déjà utilisée ailleurs (`ORDER_STATUS_COLORS`), jamais l'information par la couleur seule.

## Mesures relevées le 14/11/2026 (pour suivre les corrections)

Tailles déduites des classes Tailwind, non mesurées dans un navigateur.

| Élément | Taille actuelle | Fichier |
|---|---|---|
| Bouton « + » carte produit | 44 × 44 px | `ProductCard.tsx` |
| « − / + » ligne panier | 44 × 44 px | `panier/page.tsx` |
| Jour précédent / suivant (créneaux) | 44 × 44 px | `panier/page.tsx` |
| Favori | min 44 × 44 px | `components/ui/FavoriteButton.tsx` |
| Entrée `BottomNav` | min 56 × 44 px | `components/layout/BottomNav.tsx` |
| Pastille de catégorie | hauteur min 36 px | `ShopProductsClient.tsx` |
| « − / + » feuille poids | 32 × 32 px | `QuantitySelector.tsx` |
| Compteur de pièces | 36 × 36 px | `WeightSheet.tsx` |
| Bouton « Ajouter » feuille poids | hauteur 40 px | `WeightSheet.tsx` |
| Créneau | ≈ 57 px disponible, ≈ 40 px complet (une ligne de texte en moins) | `panier/page.tsx` |
| Boutons carte cuisine | ≈ 34 px de haut | `KitchenOrderCard.tsx` |
| Préréglages de délai cuisine | hauteur min 36 px | `KitchenOrderCard.tsx` |
| Retour (flèche) des en-têtes | 40 × 40 px | `panier/page.tsx`, `SuiviClient.tsx` |
| `Button size="icon"` / `sm` | 40 px | `components/ui/button.tsx` |
| Croix de `ui/sheet.tsx` | ≈ 30 px | `components/ui/sheet.tsx` |
