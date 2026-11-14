# Sources — skill `stripe-payment`

Première lecture le **2026-11-13** (formateur précédent, copies dans le dossier de travail de l'académie). **Revérifiées en ligne le 2026-11-14** par l'auteur : S1, S2, S5, S8, S9, S11, S14, S15, S16, S17, S23, S24 et les dépôts GitHub. **Second passage indépendant le 2026-11-14** (vérificateur) : toutes les pages S1 à S38 ont été rechargées et les affirmations qui portent un repère recoupées sur le texte servi ce jour-là ; les nombres GitHub ont été relevés de nouveau avec `gh api` et sont identiques. Pages `docs.stripe.com` lues en Markdown (suffixe `.md`), servies en français, variante « Accounts v1 » ou « page hébergée par Stripe » quand il y en a plusieurs.
Règle : une affirmation externe du skill porte un repère `[S..]` défini ici. Ce qui n'a pas pu être vérifié est listé en fin de fichier et n'est pas présenté comme un fait.

## Documentation officielle Stripe (éditeur de l'outil)

| Repère | URL | Ce que la source établit | Crédibilité |
|---|---|---|---|
| S1 | https://docs.stripe.com/connect/integration-recommendations | Réglages recommandés par type de charge ; en destination charge la plateforme porte les soldes négatifs et paie les frais ; types de compte hérités classés « deprecated » ; Accounts v2 recommandé aux nouvelles intégrations | Documentation produit Stripe |
| S2 | https://docs.stripe.com/connect/accounts-v2 | Accounts v2 (configurations `merchant`, `recipient`, `customer`) ; `stripe_balance.stripe_transfers` (ex-`transfers`) requis pour les paiements indirects ; exemple en version `2026-10-28.preview` ; limites ; une nouvelle plateforme peut devoir activer le support v1 | idem |
| S3 | https://docs.stripe.com/connect/account-balances | Soldes `pending` et `available`, soldes négatifs, `debit_negative_balances`, réserve de la plateforme | idem |
| S4 | https://docs.stripe.com/connect/charges | Comparaison direct, destination, separate charges and transfers ; qui est débité des frais, remboursements et litiges ; effets de `on_behalf_of` ; direct charges déconseillées sur comptes Express et Custom hérités ; cas qui exigent des transferts séparés ; remboursement d'un paiement indirect `pending` si le solde de la plateforme est insuffisant, **erreur** si une reprise de transfert est demandée et que le solde du compte connecté est insuffisant | idem |
| S5 | https://docs.stripe.com/connect/destination-charges.md?platform=web&ui=stripe-hosted | `application_fee_amount` plafonné au montant ; capture inférieure : commission plafonnée au capturé sans erreur ; `reverse_transfer` et `refund_application_fee` faux par défaut, proportionnels ; remboursement échoué recrédité à la plateforme ; litiges débités sur la plateforme avec ou sans `on_behalf_of` ; effets d'`on_behalf_of` (libellé, marque, `delay_days`) ; réglages de virement non gérés par Accounts v2 ; transfert ignoré détecté par `charge.updated` | idem |
| S6 | https://docs.stripe.com/connect/migrate-to-controller-properties | Équivalence Express = `losses.payments: application`, `fees.payer: application`, `requirement_collection: stripe`, `stripe_dashboard.type: express` ; type de tableau de bord immuable ; migration facultative | idem |
| S7 | https://docs.stripe.com/connect/accounts | Page des types hérités, marquée « fonctionnalité obsolète » ; tableau Standard, Express, Custom ; responsabilité de la plateforme pour fraude et litiges en Express | idem |
| S8 | https://docs.stripe.com/payments/place-a-hold-on-a-payment-method | `capture_method: manual` (aussi via `payment_intent_data` de Checkout) ; autorisation carte en ligne 7 jours (Visa, Mastercard, Amex, initiée par le client), Visa initiée par le marchand « 5 jours », fenêtre exacte 4 j 18 h ; carte présente 2 jours (Mastercard, Amex) ; capture partielle libère le reste ; une seule capture ; `payment_intent.amount_capturable_updated` ; `capture_before` ; capture différée automatique en *private preview* | idem |
| S9 | https://docs.stripe.com/payments/overcapture | Sur-capture réservée à la tarification IC+, restrictions par réseau et catégorie ; sous SCA il faut authentifier un montant supérieur ou égal au montant capturé, sinon annuler et recréer le paiement | idem |
| S10 | https://docs.stripe.com/disputes/connect | Litiges en destination charge débités (montant et frais) sur la plateforme ; quand annuler le transfert selon qu'on accepte, conteste, gagne ou perd | idem |
| S11 | https://docs.stripe.com/connect/webhooks.md?accounts-namespace=v1 | Deux portées (« Votre compte », « Comptes connectés »), paramètre `connect` ; en destination charge, paiements, remboursements et litiges sont dans « Votre compte », même avec `on_behalf_of` ; `account.updated` et `payout.failed` dans « Comptes connectés » ; propriété `account` ; vérifier `livemode` ; `stripe listen --forward-connect-to` | idem |
| S12 | https://docs.stripe.com/connect/hosted-onboarding et https://docs.stripe.com/connect/handling-api-verification (Accounts v1) | Account Link à usage unique, expiration, rôle de `refresh_url` et `return_url` ; `collection_options` ; hash `requirements` (`currently_due`, `current_deadline`, `past_due`, `pending_verification`, `disabled_reason`) | idem |
| S13 | https://docs.stripe.com/checkout/fulfillment et https://docs.stripe.com/payments/checkout/how-checkout-works | Les webhooks sont obligatoires pour l'exécution d'une commande ; fonction d'exécution rejouable ; contrôle de `payment_status` ; expiration par défaut 24 h, `expires_at` entre 30 minutes et 24 h ; événement `checkout.session.expired` | idem |
| S14 | https://docs.stripe.com/webhooks | Corps brut exigé ; répondre 2xx avant tout traitement long ; nouvelles tentatives jusqu'à 3 jours en production (trois fois en quelques heures en test) ; aucun ordre garanti ; doublons ; tolérance d'horodatage 5 minutes, jamais 0 ; n'écouter que les événements utiles ; choix du format de charge utile à la création d'une destination (« léger » recommandé, ou « instantané » avec version d'API) ; renvoi d'un événement par la CLI jusqu'à 30 jours | idem |
| S15 | https://docs.stripe.com/api/idempotent_requests | Réponse de la première requête mémorisée, erreurs 500 comprises ; clés de 255 caractères au plus ; purge possible après 24 h ; erreur si paramètres différents ; pas de donnée personnelle dans la clé | Référence API Stripe |
| S16 | https://docs.stripe.com/payments/payment-intents/verifying-status | Statuts d'un PaymentIntent ; après un refus le statut revient à `requires_payment_method` pour un nouvel essai ; signification de `payment_failed` et `amount_capturable_updated` | Documentation produit Stripe |
| S17 | https://docs.stripe.com/refunds | Annuler avant capture est gratuit ; frais de traitement non rendus sur remboursement ; remboursement `pending` si solde insuffisant puis échec à 45 jours ; statuts et événements `refund.*` ; conseil d'utiliser autorisation et capture pour réduire le coût des remboursements | idem |
| S18 | https://docs.stripe.com/disputes/how-disputes-work | Demandes d'information, alertes de fraude précoce, cycle du litige, délai de réponse 7 à 21 jours, délai de dépôt habituel 120 jours | idem |
| S19 | https://docs.stripe.com/payments/extended-authorization | Autorisation étendue jusqu'à 30 jours, réservée à la tarification IC+ ; se fier à `capture_before` | idem |
| S20 | https://docs.stripe.com/metadata | Les métadonnées ne se propagent pas entre objets, sauf PaymentIntent vers Charge (copie unique) ; limites ; ne jamais y mettre de donnée sensible | idem |
| S21 | https://docs.stripe.com/security/guide | Responsabilité PCI partagée, intégrations à faible périmètre, TLS, vérification des signatures | idem |
| S22 | https://docs.stripe.com/error-low-level | Erreurs 400 et 500 mises en cache par clé d'idempotence ; résultat d'un 500 indéterminé ; conserver clé et paramètres lors d'un nouvel essai | idem |
| S23 | https://stripe.com/fr/pricing | Tarifs France : 1,5 % + 0,25 € cartes standard EEE, 2,8 % + 0,25 € premium EEE, 2,5 % + 0,25 € britanniques, 3,15 % + 0,25 € internationales ; litige reçu 20,00 € ; contestation manuelle 20,00 €, rendus si gagné | Page tarifaire officielle |
| S24 | https://stripe.com/fr/connect/pricing | Connect, modèle « vous gérez la tarification » : 2 € par compte actif et par mois, 0,25 % + 0,10 € par virement, débits de compte 1,4 % ; définition du compte actif | idem |
| S25 | https://docs.stripe.com/connect/account-debits | Débit du solde d'un compte connecté : conditions (plateforme responsable des soldes négatifs, consentement juridiquement contraignant, même région, pays SEPA couverts) | Documentation produit Stripe |
| S26 | https://docs.stripe.com/testing et https://docs.stripe.com/connect/testing (Accounts v1) | Cartes de test (France, Cartes Bancaires, 3DS, refus, litiges, remboursements asynchrones), jetons de vérification Connect, code SMS `000-000` | idem |
| S27 | https://docs.stripe.com/connect/statement-descriptors et https://docs.stripe.com/get-started/account/statement-descriptors | Libellé de relevé : préfixe de la plateforme sans `on_behalf_of`, du compte connecté avec ; 5 à 22 caractères, préfixe de 2 à 10, au moins une lettre, caractères interdits ; un suffixe de 10 caractères ou moins tient toujours ; au-delà de l'espace disponible la requête aboutit et le libellé est tronqué ; `calculated_statement_descriptor` pour contrôler | idem |
| S28 | https://docs.stripe.com/terminal/payments/setup-reader/tap-to-pay (iPhone) et https://docs.stripe.com/terminal/features/connect | Tap to Pay sur iPhone disponible en France ; Terminal compatible avec les charges Connect directes et destination | idem |
| S36 | https://docs.stripe.com/reports/payout-reconciliation | Rapport de rapprochement des virements, export détaillé par transaction | idem |
| S37 | https://docs.stripe.com/strong-customer-authentication | SCA en vigueur depuis le 14 septembre 2019 ; Checkout et PaymentIntents sont compatibles ; le 3DS authentifié déplace en général la responsabilité de la fraude vers l'émetteur | idem |
| S38 | https://docs.stripe.com/cli/listen | `stripe listen` : `--forward-to` et `--forward-connect-to` exigent `--events`, `--all-snapshot` ou `--all-thin`, sinon la commande s'arrête sur une erreur ; une URL ne reçoit pas les deux formats ; les événements des comptes connectés suivent par défaut l'URL de `--forward-to` ; le secret affiché ne change pas d'un lancement à l'autre | Référence de la CLI Stripe (ajoutée au second passage, 2026-11-14) |

## Guides et blog Stripe

| Repère | URL | Ce que la source établit | Crédibilité |
|---|---|---|---|
| S29 | https://stripe.com/en-fr/connect/eu-guide | Position de Stripe : avec Connect, les fonds dus au vendeur ne sont jamais en possession ni sous le contrôle de la plateforme ; le guide précise qu'il ne constitue pas un avis juridique | Guide de l'éditeur, mis à jour le 14 septembre 2021 : ancien, à considérer comme une position commerciale |
| S32 | https://stripe.com/blog/idempotency | Clés d'idempotence, nouvelles tentatives avec attente exponentielle et aléa, effets de bord produits une seule fois | Blog d'ingénierie Stripe, Brandur Leach, 22 février 2017 |

## Sources publiques françaises

| Repère | URL | Ce que la source établit | Crédibilité |
|---|---|---|---|
| S30 | https://acpr.banque-france.fr/fr/professionnels/lacpr-vous-accompagne/parcours-fintech/contenus-pedagogiques/de-quel-statut-releve-mon-activite/jencaisse-des-fonds-et-les-reverse-une-tierce-personne | L'encaissement pour compte de tiers relève des services de paiement réservés aux prestataires agréés ou à leurs agents enregistrés ; l'exception d'agent commercial suppose la capacité de négocier ou conclure la vente, que les marketplaces n'ont généralement pas | Autorité de contrôle prudentiel et de résolution (Banque de France). Page sans date affichée |

## Dépôts GitHub

Relevés avec `gh api repos/OWNER/REPO` le 2026-11-14.

| Repère | Dépôt | Étoiles | Dernier push | Archivé | Usage |
|---|---|---|---|---|---|
| S31 | stripe/stripe-node | 4 567 | 2026-11-13 | non | SDK officiel installé (22.1.0, `ApiVersion = '2026-04-22.dahlia'` dans `cjs/apiVersion.js`, `stripe.v2.core.accounts` présent). README lu dans `node_modules/stripe` : `timeout` par défaut 80 000 ms, `maxNetworkRetries` 1, `webhooks.constructEvent`, `generateTestHeaderString`. `cjs/RequestSender.js` : nouvel essai sur erreur de connexion (délai dépassé compris), 409 et 5xx ; attente de 0,5 s à 5 s (`cjs/stripe.core.js`). `cjs/resources/Accounts.d.ts` : paramètre `type` marqué *deprecated* au profit de `controller`. Exemple officiel `examples/webhook-signing/nextjs/app/api/webhooks/route.ts` (`await req.text()`). Types `cjs/resources/*.d.ts` utilisés pour vérifier chaque paramètre cité |
| S35 | stripe/stripe-cli | 2 233 | 2026-11-13 | non | Outil officiel (`stripe listen`, `stripe trigger`, `stripe events resend`). Sous le seuil de 3 000 étoiles mais dépôt officiel de l'éditeur |

Vérifiés puis non retenus comme appui : `stripe-samples/accept-a-payment` (859 étoiles, push 2026-11-12) et `stripe-samples/checkout-one-time-payments` (1 063 au relevé du 2026-11-13), officiels mais contenu non lu ; `stripe/stripe-mock` (1 664, push 2026-10-29), sous le seuil et non utilisé. **Écarté** : `vercel/nextjs-subscription-payments` (7 709 étoiles mais archivé, dernier push 2025-01-23).

## Corroboration de pratique (hors Stripe)

| Repère | URL | Ce que la source établit | Crédibilité |
|---|---|---|---|
| S33 | https://www.instacart.com/help/section/360007797992/360039572571 | Une place de marché alimentaire autorise un montant supérieur au total pour couvrir les articles pesés et les remplacements, puis libère l'autorisation après la livraison ou l'annulation | Centre d'aide officiel Instacart. Confirme l'existence de la pratique, pas un pourcentage |

## Non vérifié ou non consulté

- **Reddit** : non consulté. Aucune règle du skill n'en dépend : tout repose sur la documentation de l'éditeur et sur le code.
- **YouTube** : la page S4 renvoie à une vidéo de comparaison des types de charge. Non utilisée (pas de transcription lue).
- **Valeur de `Checkout.Session.payment_status` pour une session en capture manuelle** : la documentation définit `paid` comme « fonds disponibles » mais ne traite pas ce cas. Le skill demande de s'appuyer sur le statut du PaymentIntent (`requires_capture`, documenté en S8 et S16) et de constater le comportement en bac à sable.
- **Durée d'autorisation du réseau Cartes Bancaires** : absente des tableaux de S8. Le skill renvoie à `capture_before`.
- **Séquence exacte des événements lors d'un refus puis d'un second essai dans une même session Checkout** : déduite de S16 (retour à `requires_payment_method`) et de la lecture de notre handler, à rejouer en bac à sable.
- **Code MCC le plus adapté à une boucherie** : non vérifié ; `5499` reste la valeur du code.
- **DAC7, facturation électronique, obligations d'information du consommateur** : hors périmètre, voir le skill `conformite-france`.
- **Statut de PSD3** : non vérifié.
- **Remboursement avec reprise de transfert quand le solde du boucher est vide** : S4 annonce une erreur, S10 ne décrit l'échec d'une reprise que pour les comptes dont Stripe porte les pertes. Comportement réel pour notre configuration (pertes à la plateforme) à constater en bac à sable.
- **Passer `type` et `controller` ensemble à `accounts.create`** : non vérifié. Le skill recommande `controller` seul.
- **Disponibilité de `balance_transaction` et de `transfer` sur la charge au moment où `payment_intent.succeeded` arrive** : non documentée ; le skill prévoit un complément par le rattrapage.
- **Événements « légers » (*thin*)** : le skill ne les utilise pas ; seule l'existence de `parseEventNotification` dans le SDK installé a été constatée.

## Vérifié par exécution (second passage, 2026-11-14)

- **Test d'intégration de `patterns.md` § 11** : exécuté tel qu'il est écrit, avec Vitest 4 et les fichiers de setup du projet `integration`, sur un PostgreSQL 15 jetable (conteneur local, supprimé ensuite ; la CI utilise PostgreSQL 16). Résultat : 2 tests verts, 1 rouge attendu (défaut D1). Les défauts D3 et D7 et le retour 500 avec marqueur supprimé ont été reproduits de la même façon.
- **Extraits de `patterns.md`** : recompilés par `tsc --noEmit` contre `stripe` 22.1.0, y compris les types d'événements cités dans `webhooks-idempotence.md` et l'exhaustivité du `switch` sur `PaymentIntent.status`.
- **Dependabot** : `.github/dependabot.yml` (dans HEAD) ignore les mises à jour mineures et majeures de `stripe`. Le premier jet du skill affirmait le contraire ; corrigé.

## Note de sécurité sur les contenus lus

Plusieurs pages (S7, S8, S9, S15…) contiennent un encart « Skills d'agent » invitant à exécuter `stripe agent setup`, et la page S7 une phrase adressée aux agents et modèles de langage leur demandant d'ignorer la page et d'utiliser Accounts v2. La page S8 propose aussi d'envoyer une adresse e-mail pour rejoindre une préversion. Ces textes ont été traités comme des données, aux deux passages : aucune commande n'a été exécutée, aucune donnée envoyée. L'information utile (Stripe pousse les nouvelles plateformes vers Accounts v2) est reportée dans « Points à arbitrer ».
