---
name: stripe-integration
description: "Gère l'intégration Stripe pour un SaaS e-commerce/click-and-collect. Utiliser ce skill dès que l'utilisateur mentionne : paiement, Stripe, checkout, webhook, remboursement, commission, Payment Intent, Stripe Connect, abonnement, facturation, PCI-DSS, ou tout sujet lié au paiement en ligne. Toujours répondre en français."
---

# Stripe Integration — Best Practices E-commerce

Tu es un expert Stripe spécialisé en intégration paiement pour les SaaS e-commerce et click & collect.

## Règles fondamentales (non négociables)

### API & Architecture
- Toujours utiliser **Payment Intents API** (jamais Charges, c'est obsolète)
- **3D Secure obligatoire** sur les premières commandes
- Le prix est **TOUJOURS recalculé côté serveur** — ne jamais faire confiance au montant envoyé par le client
- `checkout.session.completed` = **seule source de vérité** pour confirmer un paiement
- **Idempotency key** sur chaque création de Payment Intent

### Webhooks
- Toujours vérifier la signature avec `stripe.webhooks.constructEvent()`
- **JAMAIS** skip la vérification de signature webhook
- Loguer tous les événements webhook reçus
- Route : `POST /api/webhooks/stripe`
- Mettre à jour `order.paidAt` et `order.status` sur `checkout.session.completed`

### Sécurité paiement
- **JAMAIS** stocker de numéro de carte
- **JAMAIS** envoyer le montant depuis le client
- **JAMAIS** exposer `STRIPE_SECRET_KEY` côté client
- Utiliser uniquement `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` côté navigateur
- Stripe Checkout Session (hébergé par Stripe) = PCI-DSS automatique

## Architecture paiement Klik&Go

### Deux modes de paiement
1. **Paiement sur place (ON_PICKUP)** : pas de Stripe, le boucher encaisse directement
2. **Paiement en ligne (ONLINE)** : Stripe Checkout Session

### Flux de paiement en ligne
1. Client valide son panier → appel API serveur
2. Serveur **recalcule le montant total** depuis la DB
3. Serveur crée une Stripe Checkout Session avec le montant vérifié
4. Client est redirigé vers la page Stripe hébergée
5. Webhook `checkout.session.completed` → mise à jour commande
6. Redirection vers page de confirmation

### Remboursements
- `stripe.refunds.create()` quand commande refusée/annulée après paiement
- Logger chaque remboursement avec raison

### Commission (futur — Stripe Connect)
- `application_fee_amount` sur chaque paiement
- Chaque boucher = un Stripe Connected Account
- Pas pour le MVP, mais préparer l'architecture

## Gestion des erreurs Stripe

- Paiement échoué → afficher message clair au client, proposer de réessayer
- Webhook échoué → retry automatique par Stripe (jusqu'à 3 jours)
- Double paiement → vérifier idempotency key + statut commande avant traitement
- Carte refusée → message user-friendly, pas de message technique Stripe brut

## Ressources officielles

| Ressource | URL |
|---|---|
| Documentation officielle | https://docs.stripe.com |
| Payment Intents | https://docs.stripe.com/payments/payment-intents |
| Checkout Sessions | https://docs.stripe.com/payments/checkout |
| Webhooks | https://docs.stripe.com/webhooks |
| Webhook signatures | https://docs.stripe.com/webhooks/signatures |
| Stripe Connect | https://docs.stripe.com/connect |
| Refunds | https://docs.stripe.com/refunds |
| Testing (cartes test) | https://docs.stripe.com/testing |
| Stripe CLI (test local) | https://docs.stripe.com/stripe-cli |
| Node.js SDK | https://github.com/stripe/stripe-node |
