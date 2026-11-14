# Modèle Connect — comptes, type de charge, commission, coûts

Repères `[S..]` : voir [sources.md](sources.md).

## 1. Compte du boucher

| Propriété | Valeur visée | Effet |
|---|---|---|
| Tableau de bord | Express | Le boucher voit ses virements et ses informations ; Stripe héberge l'interface [S7] |
| Collecte des exigences (KYC) | Stripe | Stripe demande lui-même les pièces quand la réglementation évolue [S7] |
| Payeur des frais Stripe | Plateforme | Obligatoire en destination charge : les frais sont pris sur la plateforme [S1] |
| Pertes (soldes négatifs) | Plateforme | Recommandation Stripe pour les charges créées sur la plateforme [S1] |
| Capacités | `card_payments` et `transfers` | `transfers` (en v2 : `stripe_balance.stripe_transfers` de la configuration `recipient`) est requis pour les paiements indirects [S2] ; `card_payments` pour `on_behalf_of` [S5] |
| Pays | `FR`, non modifiable après création [S7] | |

Le code crée ce compte avec `type: "express"` (`connect.ts:48`). Stripe classe ce paramètre parmi les types hérités [S1][S7] et propose deux remplaçants :

- **Propriétés `controller`** (API Accounts v1) : même comportement, migration facultative, aucun changement de version d'API [S6]. Extrait compilé : [patterns.md](patterns.md) § 10.
- **Accounts v2** : recommandé pour les nouvelles intégrations [S1], exposé par notre SDK (`stripe.v2.core.accounts`, fichiers `node_modules/stripe/cjs/resources/V2/Core/Accounts*`), mais l'exemple officiel utilise une version d'API `preview` et les réglages de virement (calendrier hebdomadaire de `connect.ts`) restent en v1 [S2][S5].

Différence à connaître : un compte créé par `type: "express"` reçoit `controller.fees.payer = application_express`, un compte créé par propriétés reçoit `application`. L'écart ne joue que sur les direct charges [S6], que nous n'utilisons pas.

Aucun compte réel n'existe tant que Stripe n'est pas activé : c'est le moment de choisir, car le type de tableau de bord est immuable [S6]. Une plateforme Connect créée aujourd'hui peut devoir activer explicitement le support Accounts v1 avant d'appeler `accounts.create` [S2].

## 2. Type de charge

| Critère | Direct | **Destination (retenu)** | Separate charges and transfers |
|---|---|---|---|
| Charge créée sur | compte du boucher | plateforme | plateforme |
| Frais Stripe pris sur | boucher ou plateforme | plateforme | plateforme |
| Remboursements, litiges débités sur | boucher | plateforme (récupérable par annulation du transfert) | plateforme |
| Adapté à | SaaS dont le marchand connaît Stripe | une commande, un vendeur | panier multi-vendeurs, transfert différé ou supérieur au paiement |
| Avec comptes Express hérités | déconseillé | recommandé | possible |

Source : [S4][S1]. Raisons du choix : un panier Klik&Go ne contient qu'une boutique (`CartState.shopId`), le boucher n'a pas à gérer Stripe, la commission se prélève à la source.

**Quand passer aux transferts séparés** : seulement si l'on doit verser au boucher plus que ce que le client a payé (remise financée par Klik&Go) ou si un panier multi-boutiques apparaît [S4]. Le transfert part alors du solde disponible de la plateforme et échoue s'il est insuffisant, sans nouvelle tentative automatique [S3].

## 3. `application_fee_amount` plutôt que `transfer_data.amount`

Avec `application_fee_amount`, la totalité du paiement est transférée au boucher puis la commission revient à la plateforme ; un objet « Application Fee » est créé, visible dans le Dashboard et utilisable pour le rapprochement. Le boucher voit le montant total et la commission dans son tableau de bord [S5]. Avec `transfer_data.amount`, le boucher ne voit que le montant net et il n'y a pas d'objet de commission [S5]. On garde `application_fee_amount` : la transparence envers le boucher fait partie du modèle « commission uniquement ».

Règles :
- `application_fee_amount` est plafonné au montant de la transaction. Lors d'une capture inférieure à l'autorisé, Stripe ne compare pas la commission au montant capturé et ne renvoie pas d'erreur : il la plafonne au capturé, et le boucher ne garde alors rien [S5]. Donc recalculer la commission sur le montant final, la passer dans l'appel de capture (`application_fee_amount` est un paramètre de `paymentIntents.capture`), et contrôler `platformFeeCents < montant capturé` avant l'appel.
- Les frais Stripe sont déduits de la part de la plateforme, après retour de la commission [S5].

## 4. Qui supporte quoi

Exemple : panier 20,00 € TTC, boucherie Bronze (8 %), carte standard de l'EEE.

| Ligne | Calcul | Montant |
|---|---|---|
| Le client paie | 20,00 + 0,99 | 20,99 € |
| HT du panier | 20,00 / 1,055 | 18,96 € |
| Commission | 18,96 x 8 % | 1,52 € |
| `application_fee_amount` | 1,52 + 0,99 | 2,51 € |
| Le boucher reçoit | 20,99 - 2,51 | 18,48 € |
| Frais Stripe (plateforme) | 20,99 x 1,5 % + 0,25 [S23] | environ 0,56 € |
| Reste à Klik&Go avant coûts Connect | 2,51 - 0,56 | environ 1,95 € |

Calcul fait par `computeOrderFees()` (`services/stripe/commission.ts`) ; les frais Stripe réels se lisent sur `balance_transaction.fee`, ils montent à 2,8 % + 0,25 € pour une carte premium de l'EEE [S23].

Coûts Connect à la charge de la plateforme [S24] : 2 € par boucher actif et par mois (actif = au moins un virement bancaire dans le mois), 0,25 % + 0,10 € par virement. D'où le calendrier hebdomadaire de `connect.ts` : quatre virements par mois au lieu d'une vingtaine.

Risques portés par la plateforme :
- **Remboursement après virement au boucher.** Juste après le virement hebdomadaire, le solde Stripe du boucher peut être vide. Selon [S4], un remboursement demandé avec une reprise de transfert renvoie alors une **erreur** au lieu de créer le remboursement ; [S10] ne décrit l'échec d'une reprise que pour les comptes dont Stripe porte les pertes, ce qui n'est pas notre configuration. Le comportement exact est donc à constater en bac à sable avant d'écrire la règle du service de remboursement ([remboursements-litiges.md](remboursements-litiges.md)) : attendre de nouveaux encaissements, ou rembourser sans reprise (la plateforme avance l'argent) et récupérer ensuite.
- **Solde négatif d'un boucher** (litige, reprise de transfert) : Stripe retient une réserve sur le solde disponible de la plateforme tant qu'il dure, et la prélève au bout de 180 jours [S3].
- **Litige** : montant + 20 € [S23].
- Parade commune : activer `debit_negative_balances` sur les comptes connectés pour que Stripe prélève le compte bancaire du boucher (pays SEPA couverts) [S3].

## 5. `on_behalf_of` et libellé de relevé

Sans `on_behalf_of` (état actuel) : Klik&Go est l'entité de règlement, le relevé bancaire du client affiche le préfixe statique de la plateforme suivi du suffixe dynamique [S27], la page Checkout porte la marque Klik&Go [S5].

Avec `on_behalf_of: <compte du boucher>` : le boucher devient l'entité de règlement, son libellé apparaît sur le relevé, la page Checkout utilise sa marque, les frais suivent la grille de son pays, le délai de mise à disposition suit son `delay_days` [S4][S5]. Les litiges restent débités sur la plateforme dans les deux cas [S10].

Tant que la décision n'est pas prise (point à arbitrer n° 5) : garder l'état actuel et corriger le suffixe. Format du relevé : `PREFIXE* SUFFIXE`, 5 à 22 caractères au total, préfixe de 2 à 10 caractères (réglé dans le Dashboard), caractères latins, au moins une lettre dans le préfixe et dans le suffixe, sans `< > \ ' " *` [S27]. Un suffixe de 10 caractères ou moins tient toujours ; au-delà de la place disponible (22 moins le préfixe, moins 2 pour `* `), Stripe accepte la requête et tronque le libellé [S27]. Le suffixe doit être le nom de la boutique nettoyé et tronqué ([patterns.md](patterns.md) § 2), pas `KLIKANDGO`, qui ne dit pas quelle boucherie a encaissé. Un client qui reconnaît sa boucherie sur son relevé conteste moins.

## 6. Remise financée par Klik&Go

`Order.discountSource` vaut `SHOP`, `PLATFORM` ou `LOYALTY` (`src/lib/services/orders/discount.ts` : offre sans `shopId` = `PLATFORM`, récompense fidélité = `LOYALTY`). Aujourd'hui la commission est calculée sur le total après remise sans regarder qui la finance (défaut D10).

| Financeur | Traitement |
|---|---|
| Boucher (`SHOP`) | Rien à changer : le client paie moins, le boucher reçoit moins, commission sur le montant payé |
| Klik&Go, remise inférieure ou égale à la commission | Réduire `application_fee_amount` du montant de la remise |
| Klik&Go, remise supérieure à la commission | `application_fee_amount` minimal, puis `transfers.create` complémentaire vers le boucher, avec `transfer_group` égal à l'identifiant de commande, depuis le solde disponible de la plateforme [S4][S3] |

Le second transfert doit avoir sa propre clé d'idempotence et son propre champ en base. À ne construire qu'après l'arbitrage n° 6.

## 7. Commission sur le paiement au comptoir

Une commande `ON_PICKUP` ne crée aucun objet Stripe : aucune commission n'est prélevée, et le cron de palier l'ignore puisqu'il filtre sur `paidAt`. Options à présenter au fondateur :

| Option | Mécanisme | Limites |
|---|---|---|
| Paiement en ligne obligatoire | Supprimer `ON_PICKUP` | Perte des clients sans carte ou réticents |
| Encaissement au comptoir par Stripe | Terminal ou Tap to Pay sur iPhone, compatible destination charge [S28] | Application mobile ou lecteur à déployer ; autorisation en présence de la carte valable 2 jours pour Mastercard et Amex [S8] |
| Débit du solde Connect | `charges.create({ source: accountId })` [S25] | Consentement juridiquement contraignant du boucher, 1,4 % du volume débité [S24], ne peut pas rendre le solde négatif hors réserve, suppose des encaissements en ligne suffisants |
| Facture mensuelle | Hors Stripe ou Stripe Billing | Recouvrement manuel, risque d'impayé |

Ne rien coder avant décision.

## 8. Cadre réglementaire (repères, pas un avis)

- Stripe présente Connect comme conçu pour que la plateforme ne détienne ni ne contrôle les fonds dus au vendeur, et précise que son guide n'est pas un avis juridique (guide daté de 2021) [S29].
- L'ACPR rappelle que l'encaissement pour compte de tiers relève des services de paiement réservés aux prestataires agréés ou à leurs agents, et que l'exception d'agent commercial ne couvre généralement pas une marketplace qui ne négocie ni ne conclut la vente [S30].
- Conséquence pratique pour le code : ne jamais faire transiter d'argent par un compte bancaire de Klik&Go hors Stripe, ne pas retarder artificiellement les transferts, ne pas construire de « porte-monnaie » interne.
- CGV, information précontractuelle, obligations déclaratives des plateformes, facturation de la commission : skill `conformite-france`.
