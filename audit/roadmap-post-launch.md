# Roadmap post-launch marketplace Klik&Go

> Audit du 2026-04-29 — marketplace Stripe Connect implémenté à 95%. Cette roadmap liste les 8 priorités à exécuter après le go-live de la première commande payée en ligne avec split automatique vers le compte Connect du boucher.

## Top 8 priorités (ordre P0→P3)

### P0 — Critique pour 1ère commande

1. **Monitoring Stripe + alerting Sentry** — Brancher Sentry sur les routes `/api/payments/*` et `/api/webhooks/stripe`, alerter Slack/email sur tout `payment_intent.payment_failed`, `charge.dispute.created`, `account.updated` (capabilities révoquées) et webhook qui retourne ≠ 2xx. Sans ça, on est aveugle sur la 1ère commande prod. — **1 j**

2. **Dunning onboarding Connect incomplet** — Cron quotidien (`/api/cron/connect-status`) qui vérifie `charges_enabled` + `payouts_enabled` + `requirements.currently_due` et notifie le boucher (email + in-app) tant que le compte n'est pas pleinement actif. Aujourd'hui un boucher peut recevoir des commandes sans avoir terminé le KYC Stripe → fonds bloqués. — **1 j**

### P1 — Premier mois

3. **Factures PDF automatiques (légal France)** — Génération PDF auto à la commande payée : facture client (TVA 5,5/10/20%, mention KlikGo en tant que marketplace facilitateur), relevé de commission boucher mensuel. Stockage Vercel Blob, téléchargement depuis `/commandes/[id]` et `/boucher/dashboard/finances`. Bloquant comptablement. — **3 j**

4. **Dashboard finances boucher v2 — exports CSV/Excel** — Ajouter export comptable mensuel (transactions, commissions, payouts Stripe, TVA collectée) et reconciliation par numéro de payout Stripe. Le boucher doit pouvoir donner ça à son comptable sans demander au support. — **2 j**

### P2 — Trimestre 1

5. **Programme de parrainage boucher → boucher** — Code de parrainage `KG-PARRAIN-XXXX` : 0% de commission pendant 30 jours pour le filleul + 50€ de crédit pour le parrain quand le filleul fait sa 10e commande. Levier de croissance le moins cher du marché halal (réseau familial). — **3 j**

6. **Litiges & remboursements partiels self-service** — UI boucher pour rembourser tout ou partie d'une commande directement depuis Mode Cuisine (produit indisponible, erreur poids, client mécontent), avec reverse de la commission KlikGo proportionnel via `application_fee_refund`. Aujourd'hui chaque litige = ticket support manuel. — **3 j**

### P3 — Backlog

7. **PWA push notifications transactionnelles** — Étendre `web-push` existant aux events Stripe : "Paiement reçu", "Payout en route", "Action requise sur ton compte Stripe". Ferme la boucle entre l'app boucher et la trésorerie sans email. — **2 j**

8. **Analytics marketplace globale (webmaster)** — Dashboard `/webmaster/marketplace` : GMV, take rate effective (commission / GMV), AOV, taux de payout réussi, top 10 bouchers par GMV, cohort retention 30/60/90j. Indispensable pour pitcher des investisseurs et piloter la commission. — **3 j**

## Conclusion

Go-live = **P0 d'abord** : Sentry + cron Connect (2 jours combinés) avant la 1ère commande réelle, sinon on découvre les bugs via les bouchers furieux. Puis P1 (factures + exports) pour rester en règle URSSAF/DGFIP dès le 1er mois. Le reste suit selon les retours terrain.
