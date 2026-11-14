# Côté boucher — traitement des commandes au comptoir

Écran : `/boucher/commandes` (`src/app/(boucher)/boucher/commandes/page.tsx`, 1 274 lignes), cartes `components/boucher/KitchenOrderCard.tsx` (749 lignes), données `hooks/use-order-polling.ts` (5 s, `GET /api/boucher/orders/kitchen`), actions `PATCH /api/boucher/orders/[orderId]/action` (`boucherActionSchema` : `accept`, `deny`, `start_preparing`, `add_time`, `mark_ready`, `item_unavailable`, `confirm_pickup`, `manual_pickup`, `cancel`, `add_note`), alertes `components/boucher/OrderAlertOverlay.tsx` + `lib/sounds.ts`, écran allumé `hooks/use-wake-lock.ts`, notifications navigateur `hooks/use-kitchen-notifications.ts`. Relevé du 14/11/2026 sur l'arbre de travail (voir l'avertissement de SKILL.md) ; mécanique serveur : `order-lifecycle-realtime`.

## Contexte d'usage à garder en tête

Tablette posée à distance, mains mouillées ou gantées, bruit, coup de feu du samedi. L'équipe design d'Uber Eats décrit des tests de maquettes dans les restaurants, pour accélérer les gestes en cuisine pendant le service du soir [P2] : nous ne pouvons pas le faire à chaque changement, donc on applique des règles strictes et on teste sur tablette réelle avant de livrer.

## Ce que font les outils du marché (faits vérifiés)

| Sujet | Uber Eats Orders [P5][P6] | Deliveroo [P8][P9] | Klik&Go aujourd'hui |
|---|---|---|---|
| Nouvelle commande | Écran qui passe au vert, appui pour accepter puis « Confirm » ; sans confirmation la commande expire | Rejet automatique 10 min après la commande, sauf acceptation automatique | Surcouche d'alerte + son en boucle ; `expiresAt` = création + `acceptTimeoutMin` (10 min par défaut), mais l'expiration réelle dépend d'un cron quotidien (E34) |
| Onglets | New Order · In Progress · Ready for Pickup · Order History | — | Nouvelles · En cours (à préparer / programmées) · Prêtes · Historique |
| Charge | « Busy Mode » : Standard / Busy (+10 min) / Very Busy (+20 min) | « Busy mode » conseillé pour absorber la charge | `busyMode` + `busyExtraMin` |
| Pause | « Pause New Orders » sur une durée choisie | Non documenté dans les pages lues | Modale 15 / 30 / 60 min, reprise en un appui |
| Pause automatique | Quand plusieurs commandes de suite ne sont pas acceptées ; bandeau « Paused » ; reprise manuelle, ou automatique à 6 h le lendemain | — | `AUTO_PAUSED` (`lib/shop-status.ts` `checkAutoPause`), déclenchée seulement par le cron quotidien (E34) ; bandeau |
| Retard sur une commande | « Delay Order », une seule fois par commande | — | « +5 min » / « +10 min », sans limite |
| Rupture | « Set Out of Stock Item » depuis la commande ; menu : Available / Sold Out Today / Not Planned to Restock | « Item out of stock » après acceptation → le client choisit un remplacement ou valide sans | Action `item_unavailable` → `PARTIALLY_DENIED` (possible aussi après acceptation) ; mise en veille produit (`snooze`) |
| Refus | « Cancel Order » avec motif | 5 motifs (ingrédient, fermeture anticipée, trop de commandes, autre, automatique) | Motif obligatoire, 5 préréglages + texte libre |
| Montant | « Edit Order Amount » avec motif | — | « Ajuster » → paliers d'ajustement de prix (`/api/orders/[id]/adjust-price`) |

Ces lignes décrivent des documents d'aide publics ; elles ne disent rien de ce qui se passe hors de ces pages. Le guide Uber lu vise un marché précis (il mentionne une taxe à la consommation de 8 %) : les réglages peuvent différer en France.

## Règles

1. **Une action principale par carte et par statut**, la plus grande et la plus à droite : `PENDING` → Accepter ; `ACCEPTED`/`PREPARING` → Prête ; `READY` → Récupérée. Les actions secondaires (imprimer, ajuster, +5 min) sont plus petites mais restent ≥ 44 px.
2. **Cibles tactiles ≥ 48 px en cuisine**, 8 px d'écart [W4] (choix d'équipe au-dessus des 44 px de CLAUDE.md). Aujourd'hui les boutons de carte font environ 34 px de haut (`p-[9px]` + `text-xs`) : c'est l'écart le plus pénalisant de cet écran (E20).
3. **Délai par défaut = celui de la boutique** (`shopPrepTime`), modifiable en un appui (10/15/20/30/45/60). Une commande à créneau s'accepte sans délai.
4. **Refuser coûte un motif**, et le motif est celui que le client lira : phrases complètes, pas de jargon. Retirer « Hors zone de retrait », sans objet en click & collect (E25).
5. **Un geste irréversible se rattrape.** « Prête » notifie le client et « Récupérée » clôt la commande, sans retour possible dans la machine à états. Préférer un court délai d'annulation (toast « Annuler » avant l'envoi de la notification) à une boîte de confirmation à chaque fois : NN/g recommande l'annulation plutôt que la confirmation pour les gestes fréquents [N10]. Décision produit à prendre avant de coder.
6. **L'état du lien est toujours visible** : connecté / hors ligne (`CONNECTION_STALE_MS`, 20 s), session expirée (bandeau après trois 401/403), son coupé, écran qui risque de s'éteindre (avertissement Wake Lock). Déjà en place : ne pas les masquer en « mode simple ».
7. **Le son demande un geste** (`AudioUnlockScreen`) ; ne jamais supposer que l'audio est débloqué après un rechargement.
8. **Pas de perte d'action hors ligne en silence** : si une action échoue, le toast dit quoi refaire ; la carte ne change pas d'état tant que le serveur n'a pas répondu. Une réponse 409 (`CONFLICT`) signifie que la commande a changé d'état entre-temps : recharger la carte, ne pas rejouer l'action.
9. **Charge** : proposer « occupé » avant que la pause automatique ne tombe ; rappeler au boucher pourquoi la boutique a été mise en pause (commandes manquées) et comment reprendre.
10. **Ticket** : numéro du jour et `Prénom.N` en tête, heure de retrait encadrée, code à 4 chiffres ; les boutons d'impression ont un nom accessible (`aria-label="Imprimer le ticket"`, absent aujourd'hui).

## Écarts relevés (détail dans ecarts-constates.md)

- Boutons de carte ≈ 34 px, préréglages de délai 36 px, boutons imprimante sans nom accessible (E20).
- Accents absents dans plusieurs libellés (« Preparer », « Prete », « Recuperee », « Delai de preparation ») (E22).
- « Récupérée » confirme avec le QR déjà connu de la carte (`confirm_pickup` avec `order.qrCode`) : ce n'est pas une vérification, et un appui accidentel est définitif.
- `+5 min` / `+10 min` répétables sans limite : chaque appui déplace l'heure promise au client. Uber limite le report à une fois par commande [P5]. Décider d'une limite, et prévenir le client à chaque report.
- Deux fichiers très au-delà de 300 lignes (règle CLAUDE.md) : toute nouvelle fonctionnalité commence par une extraction.

## Définition de terminé (écran boucher)

Testé sur une tablette réelle en paysage et sur téléphone ; parcours complet d'une commande immédiate et d'une commande à créneau ; alerte sonore vérifiée onglet en arrière-plan ; coupure réseau simulée pendant une action ; aucune cible sous 44 px ; libellés en français correct ; le client voit le changement sur `/suivi` en moins d'un cycle de polling (connecté — pour l'invité, voir E33).
