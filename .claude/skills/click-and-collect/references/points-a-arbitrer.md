# Points à arbitrer — détail

Décisions qui reviennent au propriétaire. Chaque point oppose une règle écrite (CLAUDE.md), le code tel qu'il est au 14/11/2026 (arbre de travail, chantier « intégrité des commandes » compris) et, s'il y a lieu, une proposition. Tant qu'un point n'est pas tranché, la règle de CLAUDE.md s'applique et le code existant n'est pas modifié sur ce point. Les numéros sont stables : ils sont cités par SKILL.md, les autres références et le skill `ux-marketplace`. Identifiants de sources : [sources.md](sources.md).

## A1 — Ajustement de prix

CLAUDE.md décrit : baisse auto, hausse ≤ seuil avec 5 min pour répondre, hausse > seuil escaladée. Le code (`lib/price-adjustment-config.ts` `PA_DEFAULTS`, `lib/price-adjustment.ts` `computeTier`) fait, par défaut (valeurs réglables dans `PlatformConfig`) : baisse ou hausse ≤ 10 % approuvée d'office, 10–20 % approuvée après 30 s sans réponse, > 20 % escaladée après 10 min, plafond 50 %. Quelle est la règle ? Une hausse appliquée sans accord explicite est à valider avec `conformite-france`.

## A2 — Tolérance de poids

`Product.weightMargin` vaut 15 par défaut ; `WeightSheet` affiche `weightMargin` et, s'il est vide, 10 % en mode poids mais 15 % en mode pièces ; `services/weight.service.ts` applique 10 % (`TOLERANCE_PERCENT`, variable `WEIGHT_TOLERANCE_PERCENT`) mais n'est importé nulle part. Une seule valeur, affichée telle quelle.

## A3 — Compte à rebours de 5 s avant envoi

Chaque commande attend 5 s avant de partir (`OrderCountdown`), puis 2 s sur l'écran de succès ; « Réessayer » relance les 5 s. Alternative : envoi immédiat et annulation libre tant que `PENDING` (déjà permise). NN/g recommande de préférer l'annulation à la demande de confirmation [N10] ; l'appliquer ici est une transposition.

## A4 — Libellé du bouton final et moyens de paiement

« Confirmer ma commande » ; l'article L221-14 exige que la fonction de validation porte la mention « commande avec obligation de paiement » ou une formule analogue, et que les moyens de paiement acceptés soient indiqués au plus tard au début du processus de commande [L1]. Portée exacte pour un paiement sur place à trancher par `conformite-france`. Aujourd'hui le bloc « Mode de paiement » n'est montré qu'au client connecté ; l'invité ne lit « paiement sur place » que dans la note sous le total.

## A5 — Fidélité

CLAUDE.md : 3 paliers en euros (`LoyaltyReward`). `LoyaltyBadge` affiche un pourcentage par boutique (`/api/loyalty`). Quel programme le client voit-il ?

## A6 — Page de suivi unique

Proposition : `/suivi/[id]` devient la seule page (elle accepte l'invité), `/commande/[id]` redirige. Touche le lien de la cloche et la liste des commandes.

## A7 — Persistance du panier

Le panier (Context + `useReducer`, comme l'indique CLAUDE.md) est stocké en `sessionStorage` : il est perdu à la fermeture de l'onglet pour un invité. Passer à `localStorage` avec expiration ?

## A8 — Prix en ligne majoré

par rapport au prix boutique (`lib/services/stripe/commission.ts`, markup) : faut-il l'indiquer au client ? À voir avec `conformite-france`.

## A9 — Paiement en ligne

Sans objet depuis le chantier : `/panier` n'envoie que `ON_PICKUP` et le schéma refuse toute autre valeur. À rouvrir avec `stripe-payment`.

## A10 — Précommande boutique fermée

: aujourd'hui impossible (créneaux vides et refus serveur). Décision produit.

## A11 — Marge du premier créneau

CLAUDE.md fixe `maintenant + 10 min` arrondi au créneau supérieur. Une boutique à 30 min de préparation peut donc proposer un créneau dans 12 min. Proposition : `max(10 min, prepTimeMin + busyExtraMin)` avant arrondi. Ne pas modifier `earliestPickupMinutes` sans accord.

## A12 — Horaires non renseignés

Si l'invariant 4 est appliqué, une boutique sans `openingHours` devient non commandable. Bloquer l'activation d'une boutique sans horaires, ou la considérer ouverte ?

## A13 — Frais de service au retrait

Le chantier pose « 0 sur place, 0,99 € en ligne ». Conséquence : un code « Frais offerts » n'a rien à offrir sur une commande payée sur place (`NO_SERVICE_FEE_TO_WAIVE`), alors que CLAUDE.md prévoit un badge « Frais offerts » sur les cartes boutiques. Confirmer la règle et le sort de ces offres.

## A14 — Code promo pour l'invité

Le serveur le refuse (`resolveDiscount` → `LOGIN_REQUIRED` : audiences et « une fois par client » demandent une identité) et `/panier` masque le champ. Garder (et l'expliquer : « Connectez-vous pour utiliser un code ») ou ouvrir certains codes aux invités ?

## A15 — Commande programmée et acceptation automatique

CLAUDE.md se contredit : la liste des fonctionnalités annonce des « commandes programmées auto-acceptées », la section « Commandes Programmées » dit « PENDING … PAS auto-acceptées ». Le code accepte d'office quand `shop.autoAccept` est actif (E30). Quelle règle ? (même point dans `order-lifecycle-realtime`).
