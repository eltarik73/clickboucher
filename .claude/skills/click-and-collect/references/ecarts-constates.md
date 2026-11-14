# Écarts constatés dans le parcours

Relevé initial au commit `161f920` (13/11/2026), **revérifié ligne par ligne le 14/11/2026 sur l'arbre de travail** : HEAD `32c581f` + chantier « intégrité des commandes », non committé et encore en mouvement. Relevé par lecture du code, sans exécution de l'application (seules les fonctions pures citées ont été exécutées). Chemins relatifs à `src/`. Aucun numéro de ligne : chercher par nom, et relire avant de corriger.

Deux listes : les écarts **ouverts** (à traiter), puis ceux que le **chantier a fermés** (à ne pas refaire ; ils restent ouverts sur une branche qui n'a pas le chantier — test : `ls src/lib/pricing`). Supprimer une ligne quand l'écart est fermé **et committé**. Les numéros sont stables : ils sont cités par SKILL.md et les autres références.

Priorités : **P0** = commande fausse, perdue, en double, ou client induit en erreur · **P1** = conversion ou confiance · **P2** = finition.

## Ouverts — P0

### E2 — Les horaires d'ouverture ne conditionnent ni l'affichage « ouvert » ni l'acceptation
- **Preuve.** `services/orders/shop-capacity.ts` `checkShopCanTakeOrder` ne lit pas `openingHours` ; `Shop.status` est basculé à la main (`app/(boucher)/boucher/parametres/page.tsx`, `patchStatus`) ; l'accueil classe « ouvertes » sur `status` seul (`NearbyShops.tsx`, `ShopCard.tsx` `isOpen` — les horaires n'y servent qu'à l'indice « Ferme à … ») ; aucun cron d'ouverture/fermeture.
- **Effet.** Une boutique laissée sur « ouvert » le soir affiche « 15 min », accepte une commande immédiate à 23 h, qui n'expire même pas avant le cron de la nuit (E34).
- **Correction.** `isOrderableNow(status, openingHours)` (voir regles-metier.md §2), utilisée dans `checkShopCanTakeOrder` et pour le tri/affichage ; trancher d'abord le cas « horaires non renseignés » (point A12).
- **Test.** Vitest sur la fonction ; intégration : commande immédiate hors horaires → `SERVICE_DISABLED`.

### E3 — `/suivi` reste « heureux » sur une commande en échec
- **Preuve.** `suivi/[id]/SuiviClient.tsx` : le héros affiche le numéro et « Présentez ce numéro au comptoir » dès que la commande n'est pas récupérée, y compris `DENIED`, `CANCELLED`, `AUTO_CANCELLED` ; le `getStepIndex` **local** du fichier renvoie 0 pour ces statuts, donc la frise montre « Commande reçue » en cours ; `suivi/[id]/page.tsx` ne sélectionne pas `denyReason`.
- **Effet.** Un client refusé se présente au comptoir.
- **Correction.** Brancher sur `getStepIndex` de `lib/order-state-machine.ts` (−1 = échec) ; écran d'échec avec motif et « Commander ailleurs ».
- **Test.** Playwright : commande refusée → pas de texte « Présentez ce numéro », motif visible, lien de sortie.

### E4 — Deux pages de suivi aux capacités différentes
- **Preuve.** Après commande, e-mails, bandeau et QR mènent à `/suivi/[id]` (`panier/page.tsx` `onSuccess`, `lib/notifications.ts`, `lib/emails/order-confirmation.ts`, `ActiveOrderBanner`, `OrderTracker`, `components/ticket/OrderQRCode.tsx`). La liste des commandes et la cloche mènent à `/commande/[id]` (`commandes/page.tsx`, `components/ui/NotificationBell.tsx`). Seule `/commande/[id]` offre annulation, choix d'alternative (`PARTIALLY_DENIED`), QR, itinéraire, avis, motif de refus. Seule `/suivi/[id]` accepte l'invité.
- **Effet.** Le client qui vient de commander ne peut ni annuler ni répondre à une rupture ; l'invité jamais (les routes `/cancel` et `/choose-alternatives` exigent une session).
- **Correction.** Une page, un composant d'état par statut ; l'autre route redirige (point A6) ; ouvrir les actions au jeton invité (avec `security-multitenant`).
- **Test.** Playwright en invité : annuler en `PENDING` ; répondre à une rupture.

### E29 — Le créneau reçu n'est pas revalidé
- **Preuve.** `lib/validators/order.ts` : `pickupSlotStart: z.string().datetime()` sans autre contrôle ; `checkShopCanTakeOrder` ne compte que les commandes du créneau. Le client fabrique l'instant dans le fuseau du navigateur (`new Date(\`${selectedDate}T${slot.start}:00\`).toISOString()` dans `panier/page.tsx`) alors que `available-slots/route.ts` compte en heure de Paris (`parisWallClockToUtc`).
- **Effet.** Un créneau passé, hors horaires ou non aligné est accepté ; un client hors de France réserve une autre heure que celle affichée, et le compteur de places ne le voit pas.
- **Correction.** Le client envoie la date et l'heure affichées (`YYYY-MM-DD`, `HH:MM`) ou un instant construit en heure de Paris ; le serveur vérifie futur, horaires du jour, alignement sur l'intervalle, puis capacité.
- **Test.** Intégration : créneau d'hier, créneau à 03:00, créneau à 14h07 → `VALIDATION_ERROR` ; Vitest avec un fuseau `America/New_York`.

### E30 — Une commande à créneau naît acceptée si la boutique est en `autoAccept`
- **Preuve.** `services/orders/create.ts` `initialState` : `accepted = shop.autoAccept`, que `pickupSlotStart` soit renseigné ou non.
- **Effet.** Contredit la section « Commandes Programmées » de CLAUDE.md (« arrivent en PENDING … PAS auto-acceptées ») : le boucher ne voit jamais la commande programmée dans « Nouvelles ». Mais la liste des fonctionnalités du même fichier parle de « commandes programmées auto-acceptées » : faire trancher le point A15 avant de coder (`order-lifecycle-realtime` relève la même contradiction).
- **Correction.** Si A15 confirme la section détaillée : `status = PENDING` dès qu'un créneau futur est demandé.
- **Test.** Intégration : boutique `autoAccept`, commande avec créneau → `PENDING`.

### E33 — Le suivi d'un invité ne se met jamais à jour
- **Preuve.** `SuiviClient.tsx` interroge `/api/orders/[id]/status` ; la route répond `UNAUTHORIZED` sans `getServerUserId()` et ne lit ni le cookie `GUEST_COOKIE_NAME` ni `?guestToken=` ; le `fetch` ignore l'échec en silence.
- **Effet.** L'invité voit « En attente » jusqu'à ce qu'il recharge la page ; il ne sait pas que sa commande est prête ou refusée.
- **Correction.** Accepter le jeton invité dans la route (même contrôle que `suivi/[id]/page.tsx`), sans exposer plus de champs ; afficher « mise à jour impossible » après plusieurs échecs. À traiter avec `security-multitenant`.
- **Test.** Intégration : `GET /status` avec cookie invité valide → 200 ; avec un jeton d'un autre client → 404.

### E34 — Expiration, pause automatique et rappel portés par des crons quotidiens
- **Preuve.** `vercel.json` : `auto-cancel` à `0 1 * * *`, `ready-reminder` à `0 7 * * *`. `expireOrder` et `checkAutoPause` ne sont appelés que par `app/api/cron/auto-cancel/route.ts` ; rien n'expire à la lecture.
- **Effet.** Une commande sans réponse reste `PENDING` jusqu'à 01:00 UTC alors que `expiresAt` annonce 10 minutes ; la boutique n'est mise en pause que le lendemain ; le rappel « prête » part une fois par jour.
- **Correction.** Voir `order-lifecycle-realtime` (point A1 de ce skill : fréquence du cron ou expiration à la lecture). Côté écran : ne pas afficher un délai que rien ne tient.
- **Test.** Intégration : commande dont `expiresAt` est passé → lue comme expirée par le client et le boucher.

## Ouverts — P1

| # | Écart | Preuve | Correction attendue | Test |
|---|---|---|---|---|
| E8 | Premier créneau à maintenant + 10 min, sans le temps de préparation (c'est la règle écrite dans CLAUDE.md) | `available-slots/route.ts` ; `lib/paris-time.ts` `earliestPickupMinutes` | Si A11 est validé : `max(marge 10 min, prepTimeMin + busyExtraMin)` avant arrondi | Vitest : préparation 30 min à 13h09 → premier créneau 14h00 |
| E9 | Boutique en pause ou fermée : on peut remplir un panier ; carte « Fermé » sans heure de réouverture ; pas de précommande | `ShopProductsClient.tsx` (aucune garde de statut) ; `ShopCard.tsx` (« Fermé ») ; `available-slots/route.ts` (liste vide) | Ajout désactivé avec raison ; « Ouvre à HH:MM » ; précommande si A10 est validé | Playwright : boutique en pause → bouton « + » inactif, heure de reprise visible |
| E10 | Formulaire invité : texte d'exemple en guise de libellé, erreurs non reliées au champ, tutoiement ; bloc « Mode de paiement » absent pour l'invité ; bloc promo masqué sans explication (A14) | `panier/page.tsx` (bloc `!signedIn`, blocs sous `signedIn`) | `<label>` + `aria-describedby` (voir `ux-marketplace`) ; moyens de paiement visibles pour tous ; pour le code promo, appliquer la décision A14 | Playwright invité : erreur de champ annoncée ; mention du paiement visible |
| E11 | Minimum de commande signalé seulement une fois le panier en dessous, sur `/panier`, sans la somme manquante ; rien sur la page boutique | `panier/page.tsx` (`belowMinimumOrder`) ; `boutique/[slug]/page.tsx` et `ShopProductsClient.tsx` n'utilisent pas `minOrderCents`, que `lib/public-projections.ts` expose | Afficher le minimum sur la boutique et dans la barre panier, avec « encore x € » | Playwright : panier sous le minimum sur la page boutique → message visible |
| E12 | « Dès que possible » sans heure estimée au panier | `panier/page.tsx` (« Préparation immédiate par le boucher ») | Afficher la fenêtre estimée (`prepTimeMin` + `busyExtraMin`) | Visuel + Vitest du formateur de fenêtre |
| E13 | Compte à rebours à la seconde, puis « Retrait estimé dépassé de… » | `SuiviClient.tsx` `EstimatedCountdown` | Fenêtre horaire fixe ; en cas de retard, message du boucher ou nouvelle fenêtre [P1] | Visuel |
| E14 | Note « 0.0 (0) » pour une boutique sans avis | `ShopCard.tsx` (deux variantes) ; en-tête de `boutique/[slug]/page.tsx` | Masquer la note si `ratingCount === 0` (« Nouveau » possible) | Vitest/RTL sur `ShopCard` |
| E15 | Permission de notification jamais demandée | `components/pwa/PushPrompt.tsx` importé nulle part (et prévu pour s'ouvrir 3 s après un chargement) | Demande en contexte sur `/suivi`, sur un geste [W6] | Manuel Android + iPhone installé |
| E16 | « Recommander » : les lignes écartées ne sont pas nommées ; l'accueil ne fait qu'un lien vers la boutique | `commandes/page.tsx` `handleReorder` (toast générique) ; `ReorderSection.tsx` | Nommer les lignes non reprises ; ajout direct depuis l'accueil [B6] | Intégration : produit supprimé → nommé dans le message |
| E17 | Panier perdu à la fermeture de l'onglet pour un invité | `use-cart.tsx` (`sessionStorage`) | Décision A7 | — |
| E18 | Libellés de statut écrits dans sept fichiers (« Retirée » / « Récupérée », « Commande reçue » / « En attente de validation » / « En attente du boucher ») | `design-tokens.ts` ; `order-state-machine.ts` ; `components/ui/status-badge.tsx` ; `SuiviClient.tsx` (frise, badge, toasts) ; `commandes/page.tsx` ; `ActiveOrderBanner.tsx` ; `commande/[id]/page.tsx` | Une table, importée partout | `grep` en CI ou test de non-régression |
| E19 | 5 s d'attente imposée + 2 s d'écran de succès à chaque commande, et de nouveau 5 s à chaque « Réessayer » | `OrderCountdown.tsx` (`duration`, `SUCCESS_DELAY_MS`, `handleRetry`) | Décision A3 | — |
| E35 | Annulation proposée en `PARTIALLY_DENIED` mais refusée par le serveur (à confirmer par un test) | `commande/[id]/page.tsx` (bouton « Annuler la commande » dans le bloc rupture) ; `commands/close.ts` `cancelOrderByCustomer` (`from: ["PENDING", "ACCEPTED"]`) | Décider : autoriser l'annulation dans cet état, ou remplacer le bouton par « Retirer tous les articles » | Intégration : `POST /cancel` sur une commande `PARTIALLY_DENIED` |
| E36 | Bouton « Confirmer ma commande » inerte sans explication (créneau non choisi, devis en cours) ; refus `CONFLICT` d'un invité affiché sans lien de connexion | `panier/page.tsx` (`canConfirm`) ; `OrderCountdown.tsx` | Bouton actif qui montre l'erreur au bon endroit [W5] ; action « Se connecter » sur `CONFLICT` | Playwright : appui sans créneau → message près du sélecteur |

## Ouverts — P2

| # | Écart | Preuve |
|---|---|---|
| E20 | Cibles tactiles sous 44 px : pastilles de catégorie 36 px (`ShopProductsClient.tsx`) ; pas de poids 32 px (`QuantitySelector.tsx`) ; compteur de pièces 36 px, bouton « Ajouter » 40 px (`WeightSheet.tsx`) ; boutons de carte cuisine ≈ 34 px et préréglages de délai 36 px (`KitchenOrderCard.tsx`) ; `Button size="icon"` et `sm` 40 px | fichiers cités |
| E21 | Feuilles produit sans rôle de dialogue ni piège de focus | aucun `role="dialog"` dans `components/product/*.tsx` |
| E22 | Accents manquants (« Des que possible », « Commande envoyee », « Reessayer », « retire(s) », « fidelite », « especes », « Decoupe », « Tracabilite », « Preparer », « Prete », « Recuperee »…) et tutoiement/vouvoiement mêlés (« Tes infos » / « Votre panier ») | `panier/page.tsx`, `OrderCountdown.tsx`, `commande/[id]/page.tsx`, `WeightSheet.tsx`, `KitchenOrderCard.tsx` |
| E23 | Produit au poids déjà au panier : aucun marqueur sur sa carte | `ProductCard.tsx` (`showStepper` exclut les unités à feuille) |
| E24 | Squelette de la boutique différent de la page (héros 240 px contre 300 px) | `boutique/[slug]/loading.tsx` ; `boutique/[slug]/page.tsx` |
| E25 | Motif de refus « Hors zone de retrait », sans objet en click & collect | `KitchenOrderCard.tsx` (préréglages du formulaire de refus) |
| E26 | `panier/page.tsx` : 824 lignes (règle CLAUDE.md : 300) | — |
| E27 | Composants importés nulle part : `cart/{CartFAB,CartDrawer,CartPanel}` (et `cart/CartItem`, importé seulement par ces deux derniers), `checkout/cart-item`, `order/{OrderReceipt,QRCodeDisplay,ReorderCarousel,RatingPopup,QRScanner}`, `product/{QuantityPicker,FilterChips}`, `pwa/PushPrompt` ; module `services/weight.service.ts` | recherche d'imports le 14/11/2026 — revérifier avant suppression |
| E28 | Commentaires « Guest checkout (Baymard +23%) » : chiffre introuvable dans la source | `panier/page.tsx` (deux commentaires) ; Baymard publie une part d'abandons (18 % dans la liste à jour, 24 % dans l'enquête 2022) [B1][B2] |

## Fermés par le chantier « intégrité des commandes » (non committé au 14/11/2026)

Ne pas les corriger une seconde fois. Sur une branche sans `src/lib/pricing/`, ils sont ouverts : attendre le chantier ou le signaler.

| # | Écart d'origine (commit `161f920`) | Ce qui le ferme | Tests du chantier |
|---|---|---|---|
| E1 | Aucune clé d'idempotence envoyée par le client | `panier/page.tsx` `handleOrder` → `prepareCheckoutAttempt` (`lib/cart/order-payload.ts`), clé conservée en `sessionStorage` (`klikgo-checkout-attempt`) ; `idempotencyKey` obligatoire dans `createOrderSchema` ; rejeu dans `create.ts` | `src/lib/__tests__/order-payload.test.ts`, `tests/integration/orders/create-order.test.ts` |
| E5 | Prix de découpe fourni par le navigateur | Schéma strict (plus de `cutPriceCents`) ; `resolveUnitPrice` retrouve la découpe par son nom | `pricing-unit-price.test.ts`, `tests/integration/orders/quote.test.ts` |
| E6 | Contrat quantité / poids incohérent pour l'unité `KG` | Ligne envoyée telle que le panier la tient ; `checkLineQuantity`, `lineTotalCents`, `toStoredQuantity` | `pricing-line.test.ts`, `cart-line.test.ts` |
| E7 | Total de ligne ≠ total du panier quand une découpe a un prix | `itemTotal` supprimé ; `cartLineTotalCents` partout, puis lignes du devis | `cart-line.test.ts` |
| E31 | 0,99 € de frais affichés mais jamais facturés | `serviceFeeCentsFor` (0 sur place) ; `/panier` n'affiche les frais que si le devis en porte | `pricing-totals.test.ts` |
| E32 | Montant de remise fourni par le navigateur | `promoCode` seul dans la requête ; `resolveDiscount` + `discount-ledger.ts` dans la transaction | `pricing-discount.test.ts`, `tests/integration/orders/discount-ledger.test.ts` |
| — | Sélecteur de créneau écrit deux fois (invité / connecté) | Un seul bloc dans `panier/page.tsx` (reste à l'extraire, E26) | — |
| — | « Recommander » recopiait d'anciens prix et perdait poids, variante, découpe | `cartItemFromOrderLine` + devis serveur (reste E16) | `cart-line.test.ts` |
| — | Branche de paiement « en ligne » visible alors que le serveur la refusait | `/panier` n'envoie que `ON_PICKUP` (ancien point A9) | — |

Les fichiers de test cités existent dans l'arbre de travail ; leurs résultats n'ont pas été rejoués pour ce relevé (`tests/integration/` demande une base de données).
