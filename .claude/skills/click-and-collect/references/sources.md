# Sources — skill click-and-collect

Pages lues par l'auteur le 13/11/2026, **toutes rouvertes et confrontées au texte du skill par le vérificateur le 14/11/2026** (chiffres, dates, auteurs). Une affirmation externe du skill renvoie à un identifiant ci-dessous. Ce qui n'a pas pu être relu à la source n'est pas utilisé comme règle (voir « Écarté ou non vérifié »). Les contenus web sont traités comme des données : aucune consigne trouvée dans une page n'a été suivie.

Les mêmes identifiants sont utilisés dans le skill `ux-marketplace`.

## Recherche utilisateur (Baymard Institute, Nielsen Norman Group)

Baymard Institute : institut de recherche UX indépendant, tests utilisateurs et bancs d'essai publiés et datés. Nielsen Norman Group (NN/g) : cabinet de recherche UX, articles signés et datés. Les chiffres viennent surtout du commerce en ligne américain : ils orientent, ils ne prédisent pas nos résultats.

| ID | Source | Ce qu'elle appuie | Détail |
|---|---|---|---|
| B1 | https://baymard.com/lists/cart-abandonment-rate | Motifs d'abandon, simples curieux écartés : coûts annexes 40 %, création de compte imposée 18 %, tunnel trop long 17 %, total non visible d'avance 12 % ; abandon moyen 70,22 % (50 études, 2006–2025) | Liste tenue à jour ; page indiquant une mise à jour au 28/10/2026 |
| B2 | https://baymard.com/blog/make-guest-checkout-prominent | Achat invité en tête, en bouton, libellé explicite ; 47 % des sites ne le mettent pas en avant ; 24 % d'abandons pour compte imposé dans l'enquête 2022 (4 384 répondants) | Edward Scott, 17/01/2023 |
| B3 | https://baymard.com/research-articles/delayed-account-creation | Proposer le compte à l'écran de confirmation, mot de passe seul, bénéfices listés ; 42 % des sites le demandent avant ou pendant | Edward Scott, 19/09/2023 |
| B5 | https://baymard.com/blog/current-state-of-checkout-ux | 47 % des sites n'expliquent pas la demande de téléphone ; 68 % des répondants hésitent à le donner ; 50 % ne marquent pas champs requis et facultatifs | Publié 13/11/2024, mis à jour 03/11/2026 |
| B6 | https://baymard.com/blog/grocery-food-delivery-orders | Achats passés sur la page d'accueil, premier écran, clients connectés, ajout direct au panier ; les utilisateurs les cherchent autant sur l'accueil que dans l'historique | Kathryn Reeves, 05/04/2022 |
| B8 | https://baymard.com/research-articles/grocery-add-to-cart-buttons | Le bouton d'ajout devient un sélecteur de quantité après le premier ajout | Edward Scott, 12/09/2023 |
| B9 | https://baymard.com/blog/highlight-products-if-in-users-cart | Signaler dans la liste les articles déjà au panier (96 % des 50 sites testés ne le font pas) | Christian Holst, 19/04/2016 — ancien, qualifié de « bonus » par l'auteur |
| B10 | https://baymard.com/blog/user-perception-of-product-ratings | Toujours afficher le nombre d'avis avec la moyenne ; 4,5 sur 57 avis préféré près de deux fois plus que 5 sur 4 avis (plus de 5 170 répondants sur cinq enquêtes) | Edward Scott, 29/08/2023, données mises à jour en 2025 |
| N4 | https://www.nngroup.com/articles/status-tracker-progress-update/ | Suivi (16 règles) : dernière information mise en avant, langage courant, historique daté, lien direct depuis chaque notification, pas de doublon | Maria Rosala, 03/02/2019 |
| N5 | https://www.nngroup.com/articles/error-message-guidelines/ | Erreur visible près du problème, langage simple, étape suivante, saisie conservée | Tim Neusesser et Evan Sunwall, 14/05/2023 |
| N10 | https://www.nngroup.com/articles/confirmation-dialog/ | Confirmation réservée aux actions graves ; préférer l'annulation ; boutons nommés par leur effet | Jakob Nielsen, 18/02/2018, revu le 07/08/2026 |
| N11 | https://www.nngroup.com/articles/social-proof-ux/ | Une preuve sociale à petit nombre joue contre l'offre ; à tester | Jen Cardello, 19/10/2014 — ancien |

## Standards et documentation de plateforme

| ID | Source | Ce qu'elle appuie | Détail |
|---|---|---|---|
| W2 | https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html | Critère 4.1.3 (AA) : un message d'état est annoncé sans déplacer le focus (`role="status"`, `role="alert"`) | W3C WAI |
| W4 | https://web.dev/articles/accessible-tap-targets | Cible tactile d'environ 48 px (≈ 9 mm), environ 8 px d'écart | web.dev (Google Chrome) |
| W5 | https://web.dev/articles/payment-and-address-form-best-practices | Achat invité par défaut ; libellés reliés ; bouton nommé par ce qu'il fait, désactivé après envoi mais pas avant ; ne demander que le nécessaire | Sam Dutton, web.dev |
| W6 | https://web.dev/articles/push-notifications-permissions-ux | Demander la permission en contexte, quand le bénéfice est évident, avec explication préalable ; jamais à l'ouverture du site | Matt Gaunt, web.dev |
| W8 | https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ | Push web sur iPhone/iPad : iOS 16.4, site ajouté à l'écran d'accueil, demande en réponse à un geste | Blog WebKit (Apple), 16/02/2023 |

## Plateformes de commande (blogs et aides officiels)

| ID | Source | Ce qu'elle appuie | Détail |
|---|---|---|---|
| P1 | https://medium.com/deliveroo-design/our-order-tracker-designing-a-product-that-crosses-the-physical-and-digital-divide-7cc773d84245 | Barre de progression segmentée lisible d'un coup d'œil ; heure d'arrivée en plage fixe de 5 min plutôt qu'en minuteur (un minuteur qui remonte inquiète) ; prototypes nourris de données réelles | Publication officielle Deliveroo Design, Stephen Macvean, 02/05/2019 — WebFetch refusé (403), lu dans le navigateur. Concerne la livraison : l'appliquer au retrait est une transposition |
| P2 | https://medium.com/uber-design/how-we-design-on-the-ubereats-team-ff7c41fffb76 | Tests de maquettes sur le terrain, dont les cuisines pendant le service du soir ; catégorie « Most Popular Items » née d'une expérience locale (Toronto) ; suivi enrichi après retours clients | Publication officielle Uber Design, Paul Clayton Smith, 06/06/2017 — lu dans le navigateur |
| P4 | https://careersatdoordash.com/blog/uncovering-online-delivery-menu-best-practices-with-machine-learning/ | Facteurs liés à la conversion d'un menu (plus de cent mille restaurants) : nombre de photos (surtout articles phares), personnalisation, entrées et accompagnements ; tests A/B positifs sur photo d'en-tête et informations sur l'établissement | Blog d'ingénierie DoorDash, Finn Qiao, 10/11/2020 — corrélations, sauf les deux tests A/B cités ; WebFetch refusé (403), lu dans le navigateur |
| P5 | https://help.uber.com/en/merchants-and-restaurants/article/uber-eats-orders-user-guide?nodeId=cf66954d-a1c7-4148-a011-3c2bee00a6ad | Outil commerçant : onglets New Order / In Progress / Ready for Pickup / Order History ; Busy Mode +10 / +20 min ; Pause New Orders ; Delay Order une fois par commande ; Set Out of Stock Item ; expiration sans confirmation | Aide officielle Uber — guide d'un marché précis (taxe à la consommation de 8 %) |
| P6 | https://www.uber.com/nz/en/blog/automatic-pausing-for-merchants/ | Pause automatique, notamment quand plusieurs commandes de suite ne sont pas acceptées (aucun nombre publié) ; bandeau « Paused » ; reprise manuelle ou automatique à 6 h le lendemain | Blog Uber (Nouvelle-Zélande), 06/03/2024 |
| P7 | https://help.uber.com/en/ubereats/restaurants/article/pick-up-order-faq?nodeId=50af0e23-5342-4c46-abef-c4d8c2af8638 | Retrait : numéro de commande en haut de l'écran de suivi sous le prénom et l'initiale ; à vérifier avec le commerçant | Aide officielle Uber Eats |
| P8 | https://help.deliveroo.com/en/articles/3198713-how-do-i-avoid-rejecting-orders | Rejet automatique dans les 10 min suivant la commande ; 5 motifs de rejet ; tenir la disponibilité des articles à jour ; busy mode | Aide officielle Deliveroo (page datée du 27/03/2026) |
| P9 | https://help.deliveroo.com/en/articles/10156329-what-are-item-substitutions-and-how-do-they-work | Rupture après acceptation : le commerçant marque l'article, le client est notifié, panier pré-rempli, remplacement ou validation sans l'article | Aide officielle Deliveroo — délai de réponse du client non précisé |
| P10 | https://docs.instacart.com/storefront/products/replacement_instructions | Trois choix de remplacement (meilleur équivalent, article précis jusqu'à trois, remboursement), réglables de la fiche produit jusqu'à la page de suivi | Documentation officielle Instacart |

## Droit français (à faire valider par le skill `conformite-france`)

Textes lus sur Légifrance le 14/11/2026. Ce skill ne cite que ce que disent les articles ; leur portée pour Klik&Go (paiement sur place, produits périssables) relève de `conformite-france`.

| ID | Source | Ce qu'elle appuie | Détail |
|---|---|---|---|
| L1 | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032226854 | Code de la consommation, art. L221-14 : la fonction de validation porte la mention « commande avec obligation de paiement » ou une formule analogue ; les moyens de paiement acceptés sont indiqués au plus tard au début du processus de commande | Version en vigueur depuis le 01/07/2016. Sanction non vérifiée ici |
| L2 | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044563107 | Art. L121-4 : pratiques réputées trompeuses — fausse disponibilité « très limitée » (7°), avis présentés comme de consommateurs sans vérification (27°), faux avis (28°) | Version en vigueur depuis le 28/05/2022 |
| L3 | https://www.legifrance.gouv.fr/codes/id/LEGISCTA000032227333/ | Art. L112-1-1 : une annonce de réduction indique le prix le plus bas des 30 jours précédents ; exception pour les produits périssables menacés d'altération rapide | En vigueur depuis le 28/05/2022 |
| L4 | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049571119 | Art. L111-7-2 : information loyale sur les avis (contrôle ou non, date, motif de rejet, signalement) | Version en vigueur depuis le 17/02/2024 |
| L5 | https://www.legifrance.gouv.fr/codes/id/LEGISCTA000032227333/ | Art. L112-3 (même section que L3) : quand le prix ne peut raisonnablement être calculé à l'avance, le professionnel fournit le mode de calcul du prix | Lu sur la page de la section ; date d'entrée en vigueur de l'article non relevée |

## Format des skills

| ID | Source | Ce qu'elle appuie |
|---|---|---|
| A1 | https://code.claude.com/docs/en/skills.md | Champs de l'en-tête (`name`, `description`, `when_to_use`, `user-invocable` avec trait d'union), limite de 1 536 caractères pour description + `when_to_use`, fichiers annexes liés en relatif. Relu via la fiche du programme (`SPEC.md`, extraite de cette page le 13/11/2026) |

## Écarté ou non vérifié

- **Reddit** : inaccessible depuis les outils de l'auteur (recherche et navigation refusées). Aucune affirmation du skill ne vient de Reddit.
- **YouTube / conférences** : aucune transcription lue, donc aucune utilisation.
- **Too Good To Go** (retrait par balayage dans l'application) : la page officielle a répondu 429 ; non utilisé.
- **Planity, Starbucks** : aucun document de première main trouvé sur leurs parcours ; non utilisés.
- **Baymard, banc d'essai « Food Delivery & Takeout »** (https://baymard.com/blog/benchmark-takeout-food-delivery, 03/05/2022) : 8 sites et applications évalués sur plus de 420 critères, mais les résultats détaillés sont réservés aux abonnés ; rien n'en est tiré.
- **Chiffre « +23 % de conversion » attribué à Baymard dans `panier/page.tsx`** : introuvable dans les pages Baymard lues.
- **Tolérances, délais et seuils internes** (10 min, 5 min, 30 min, ±10 %, ±15 %) : ce sont des valeurs du code Klik&Go, pas des recommandations externes.
