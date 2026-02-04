# 🚀 ClickBoucher — Guide de Déploiement

## Architecture cible

```
┌─────────────────────────────────────────────────┐
│                  INTERNET                        │
└────────────┬────────────────────┬───────────────┘
             │                    │
      ┌──────▼──────┐    ┌───────▼────────┐
      │   VERCEL    │    │  STRIPE (CB)   │
      │  Next.js    │◄───│  Webhooks      │
      │  App Router │    └────────────────┘
      │  + API      │
      └──────┬──────┘
             │
      ┌──────▼──────┐    ┌────────────────┐
      │  RAILWAY    │    │  TWILIO        │
      │  PostgreSQL │    │  SMS/WhatsApp  │
      └─────────────┘    └────────────────┘
```

---

## 1. Développement local

### Prérequis

- Node.js 18+
- PostgreSQL 14+ (ou Docker)
- Git

### Installation rapide

```bash
git clone <repo> && cd clickboucher
chmod +x setup.sh && ./setup.sh
```

### Installation manuelle

```bash
# 1. Dépendances
npm install

# 2. Environnement
cp .env.example .env
# → Éditer .env avec vos valeurs

# 3. PostgreSQL via Docker
docker compose up -d
# → DATABASE_URL="postgresql://clickboucher:clickboucher_dev@localhost:5432/clickboucher?schema=public"

# 4. Base de données
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed

# 5. Lancer
npm run dev
```

### URLs locales

| Service | URL |
|---------|-----|
| Client | http://localhost:3000/decouvrir |
| Boucher | http://localhost:3000/dashboard/commandes |
| API Health | http://localhost:3000/api/health |
| Prisma Studio | http://localhost:5555 (`npx prisma studio`) |
| pgAdmin | http://localhost:5050 (Docker) |

---

## 2. Déploiement Vercel + Railway

### 2.1 Railway (PostgreSQL)

1. Créer un projet sur [railway.app](https://railway.app)
2. Ajouter un service **PostgreSQL**
3. Copier la `DATABASE_URL` depuis **Variables**

### 2.2 Vercel (Application)

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel

# Configurer les variables d'environnement
vercel env add DATABASE_URL         # → URL Railway
vercel env add AUTH_SECRET           # → random 64 chars
vercel env add PAYMENT_PROVIDER     # → "mock" ou "stripe"
vercel env add NOTIFICATION_PROVIDER # → "stub" ou "twilio"
vercel env add NEXT_PUBLIC_APP_URL  # → https://votre-app.vercel.app
```

### 2.3 Migration en production

```bash
# Depuis le terminal local, avec DATABASE_URL pointant vers Railway
DATABASE_URL="postgresql://..." npx prisma migrate deploy
DATABASE_URL="postgresql://..." npx prisma db seed
```

### 2.4 Vérifier le déploiement

```bash
curl https://votre-app.vercel.app/api/health
# → { "status": "healthy", "checks": { "database": { "status": "ok" } } }
```

---

## 3. Activer Stripe (paiement réel)

### 3.1 Configuration

1. Créer un compte [Stripe](https://stripe.com)
2. Obtenir les clés depuis le Dashboard
3. Ajouter les variables :

```bash
vercel env add PAYMENT_PROVIDER        # → "stripe"
vercel env add STRIPE_SECRET_KEY       # → sk_test_... ou sk_live_...
vercel env add STRIPE_WEBHOOK_SECRET   # → whsec_...
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  # → pk_test_...
```

### 3.2 Webhook Stripe

1. Dashboard Stripe → Développeurs → Webhooks
2. Ajouter un endpoint : `https://votre-app.vercel.app/api/payments/webhook`
3. Événements à écouter :
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
4. Copier le signing secret → `STRIPE_WEBHOOK_SECRET`

### 3.3 Test

```bash
# Installer Stripe CLI
stripe listen --forward-to localhost:3000/api/payments/webhook
# → Copier le webhook secret affiché
```

---

## 4. Activer Twilio (SMS + WhatsApp)

### 4.1 Configuration

1. Créer un compte [Twilio](https://twilio.com)
2. Obtenir un numéro français (+33)
3. Activer WhatsApp Business (optionnel)

```bash
vercel env add NOTIFICATION_PROVIDER   # → "twilio"
vercel env add TWILIO_ACCOUNT_SID      # → AC...
vercel env add TWILIO_AUTH_TOKEN       # → ...
vercel env add TWILIO_PHONE_NUMBER     # → +33...
vercel env add TWILIO_WHATSAPP_NUMBER  # → whatsapp:+33... (optionnel)
```

### 4.2 Templates WhatsApp

Les templates pré-définis dans `notification.service.ts` :

| Template | Déclencheur |
|----------|------------|
| `order_confirmed` | Commande créée |
| `order_accepted` | Boucher accepte |
| `order_ready` | Commande prête |
| `weight_review` | Poids > +10% |
| `stock_issue` | Rupture stock |
| `order_cancelled` | Annulation |
| `otp_code` | Envoi OTP |

Pour WhatsApp Business API, soumettre ces templates pour approbation Meta.

---

## 5. CRON Jobs

Configurés dans `vercel.json`, 3 tâches automatiques :

| Tâche | Fréquence | Description |
|-------|-----------|-------------|
| `offers` | */15 min | Expire les offres DM, libère les réservations panier |
| `stale-orders` | */30 min | Annule les commandes PENDING > 1h |
| `daily-stats` | 23:59 | Génère les stats journalières par boutique |

Test manuel :
```bash
curl https://votre-app.vercel.app/api/cron?task=offers
```

---

## 6. Variables d'environnement — Référence complète

| Variable | Requis | Défaut | Description |
|----------|--------|--------|-------------|
| `DATABASE_URL` | ✅ | — | URL PostgreSQL |
| `AUTH_SECRET` | ✅ | — | Secret JWT/OTP |
| `OTP_EXPIRY_MINUTES` | — | `5` | Durée de validité OTP |
| `PAYMENT_PROVIDER` | — | `mock` | `mock` ou `stripe` |
| `STRIPE_SECRET_KEY` | si stripe | — | Clé secrète Stripe |
| `STRIPE_WEBHOOK_SECRET` | si stripe | — | Secret webhook |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | si stripe | — | Clé publique Stripe |
| `NOTIFICATION_PROVIDER` | — | `stub` | `stub` ou `twilio` |
| `TWILIO_ACCOUNT_SID` | si twilio | — | SID Twilio |
| `TWILIO_AUTH_TOKEN` | si twilio | — | Token Twilio |
| `TWILIO_PHONE_NUMBER` | si twilio | — | Numéro expéditeur |
| `TWILIO_WHATSAPP_NUMBER` | — | — | Numéro WhatsApp |
| `NEXT_PUBLIC_APP_URL` | — | `localhost:3000` | URL publique de l'app |
| `NEXT_PUBLIC_APP_NAME` | — | `ClickBoucher` | Nom affiché |
| `WEIGHT_TOLERANCE_PERCENT` | — | `10` | Tolérance poids (%) |
| `LAST_MINUTE_HOLD_MINUTES` | — | `10` | Durée réservation DM |
| `CRON_SECRET` | — | — | Auth pour endpoint CRON |

---

## 7. Structure des routes API

### Client

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/health` | Santé + config |
| GET | `/api/shops` | Liste des boutiques |
| GET | `/api/shops/[slug]` | Détail boutique |
| GET | `/api/shops/[slug]/products` | Produits |
| GET | `/api/shops/[slug]/packs` | Packs |
| GET | `/api/shops/[slug]/offers` | Offres |
| GET | `/api/offers` | Offres globales (Bons plans) |
| POST | `/api/orders` | Créer une commande |
| GET | `/api/orders` | Liste commandes |
| GET | `/api/orders/[id]` | Détail commande |
| POST | `/api/auth/otp/send` | Envoyer OTP |
| POST | `/api/auth/otp/verify` | Vérifier OTP |
| GET | `/api/favorites` | Favoris |
| POST | `/api/favorites/toggle` | Toggle favori |
| POST | `/api/cart/reserve` | Réserver offre DM |

### Boucher

| Méthode | Route | Description |
|---------|-------|-------------|
| PATCH | `/api/orders/[id]/status` | Changer statut |
| PATCH | `/api/orders/[id]/weight` | Soumettre pesées |
| POST | `/api/orders/[id]/stock-action` | Gérer rupture |
| PATCH | `/api/boucher/service` | Activer/désactiver service |
| PATCH | `/api/boucher/catalogue/[productId]` | Modifier produit |

### Système

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/health` | Health check complet |
| GET | `/api/cron` | CRON jobs |
| POST | `/api/payments/webhook` | Webhook paiement |
| GET | `/api/payments/[orderId]` | Statut paiement |

---

## 8. Passage en production — Checklist

- [ ] `DATABASE_URL` pointe vers Railway/production
- [ ] `AUTH_SECRET` est un secret aléatoire fort (64+ chars)
- [ ] `NEXT_PUBLIC_APP_URL` est l'URL Vercel finale
- [ ] Migrations appliquées (`prisma migrate deploy`)
- [ ] Seed exécuté avec données réelles (ou vide)
- [ ] `/api/health` retourne `"status": "healthy"`
- [ ] Images Unsplash remplacées par vraies photos
- [ ] Mock data remplacées par fetch API dans les pages
- [ ] PAYMENT_PROVIDER=stripe si paiement CB activé
- [ ] Webhook Stripe configuré et testé
- [ ] NOTIFICATION_PROVIDER=twilio si SMS/WA activé
- [ ] CRON_SECRET configuré pour sécuriser l'endpoint
- [ ] Domaine custom configuré sur Vercel
- [ ] SSL/HTTPS activé (automatique sur Vercel)
- [ ] Rate limiting en place (Vercel Edge)
- [ ] Monitoring/alerting configuré (Vercel Analytics)
