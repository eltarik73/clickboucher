# Déploiement Klik&Go — Vercel (application) et Railway (PostgreSQL)

## Architecture

```
                    INTERNET
                       |
              +--------v--------+
              |     VERCEL      |
              |  Next.js (App   |
              |  Router + API,  |
              |  crons)         |
              +--------+--------+
                       |
              +--------v--------+
              |     RAILWAY     |
              |   PostgreSQL    |
              |   (base seule)  |
              +-----------------+
```

---

## 1. Developpement local

### Prerequis

- Node.js 22
- PostgreSQL 14+ (ou Docker)
- Git

### Installation rapide

```bash
git clone <repo> && cd clickboucher
chmod +x setup.sh && ./setup.sh
```

### Installation manuelle

```bash
# 1. Dependances
npm install

# 2. Environnement
cp .env.example .env
# -> Editer .env avec vos valeurs

# 3. PostgreSQL via Docker
docker compose up -d
# -> DATABASE_URL="postgresql://clickboucher:clickboucher_dev@localhost:5432/clickboucher?schema=public"

# 4. Base de donnees : schema par db push (comme la CI), puis donnees de demo
npx prisma generate
npx prisma db push
npm run db:seed

# 5. Lancer
npm run dev
```

### URLs locales

| Service | URL |
|---------|-----|
| Client | http://localhost:3000/ |
| Boucher | http://localhost:3000/boucher/dashboard |
| API Health | http://localhost:3000/api/health |
| Prisma Studio | http://localhost:5555 (`npx prisma studio`) |

---

## 2. Déploiement en production

L'application Next.js est déployée par **Vercel** (projet relié au dépôt GitHub) à chaque mise à jour de
`main`. **Railway** n'héberge que la base PostgreSQL : aucun service Next.js ne doit y tourner (l'ancien
service `clickboucher` du projet Railway reste désactivé, voir CLAUDE.md « Stack », « Hébergement »).

### 2.1 Variables d'environnement

Vercel > Settings > Environment Variables. Liste et rôle de chaque variable : CLAUDE.md « Variables
d'environnement ». `DATABASE_URL` est l'URL poolée (PgBouncer) de la base Railway, `DIRECT_DATABASE_URL`
son URL directe, utilisée par les migrations.

### 2.2 Migrations en production

Le build Vercel (`npm run build`) lance `scripts/prisma-migrate-prod-only.mjs` : en production seulement
(`VERCEL_ENV=production`), il exécute en lecture seule les pré-vols `preflight.sql`, puis
`npx prisma migrate deploy`. C'est la seule commande Prisma qui s'exécute contre la base de production.

Le seed ne s'exécute jamais en production : `prisma/seed.ts` vide les tables avant de les remplir et refuse
toute base qui n'est pas locale (localhost, 127.0.0.1 ou ::1).

### 2.3 Vérifier le déploiement

```bash
curl https://klikandgo.app/api/health
# -> { "status": "ok", "checks": { "db": "ok", "redis": "ok" | "skip" }, ... }
```

---

## 3. Activer Stripe (paiement reel) — TODO: not implemented

> ⚠️ Stripe n'est pas encore intégré. Toutes les commandes utilisent **paiement sur place** (`ON_PICKUP`).
> Les variables d'environnement et webhooks ci-dessous sont fournis à titre indicatif pour la future intégration mais ne sont pas lus par le code actuel.

### 3.1 Configuration

1. Creer un compte [Stripe](https://stripe.com)
2. Obtenir les cles depuis le Dashboard
3. Ajouter les variables dans Railway :

```
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 3.2 Webhook Stripe

1. Dashboard Stripe > Developpeurs > Webhooks
2. Ajouter un endpoint : `https://<votre-app>.up.railway.app/api/payments/webhook`
3. Evenements a ecouter :
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
4. Copier le signing secret > `STRIPE_WEBHOOK_SECRET`

### 3.3 Test

```bash
stripe listen --forward-to localhost:3000/api/payments/webhook
```

---

## 4. Activer Twilio (SMS + WhatsApp)

### 4.1 Configuration

1. Creer un compte [Twilio](https://twilio.com)
2. Obtenir un numero francais (+33)
3. Activer WhatsApp Business (optionnel)

Ajouter dans Railway :

```
NOTIFICATION_PROVIDER=twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+33...
TWILIO_WHATSAPP_NUMBER=whatsapp:+33...
```

---

## 5. CRON Jobs

Railway supporte les cron jobs via un service dedie ou via le endpoint `/api/cron`.

### Option 1 : Railway Cron Service

1. **+ New** > **Cron Job**
2. Configurer :

| Tache | Schedule | Command |
|-------|----------|---------|
| Offres | `*/15 * * * *` | `curl $APP_URL/api/cron?task=offers` |
| Commandes | `*/30 * * * *` | `curl $APP_URL/api/cron?task=stale-orders` |
| Stats | `59 23 * * *` | `curl $APP_URL/api/cron?task=daily-stats` |

### Option 2 : cron-job.org (gratuit)

1. Aller sur [cron-job.org](https://cron-job.org)
2. Creer 3 jobs pointant vers votre API :
   - `https://<votre-app>.up.railway.app/api/cron?task=offers` (toutes les 15 min)
   - `https://<votre-app>.up.railway.app/api/cron?task=stale-orders` (toutes les 30 min)
   - `https://<votre-app>.up.railway.app/api/cron?task=daily-stats` (23:59)

Test manuel :
```bash
curl https://<votre-app>.up.railway.app/api/cron?task=offers
```

---

## 6. Variables d'environnement — Reference complete

| Variable | Requis | Defaut | Description |
|----------|--------|--------|-------------|
| `DATABASE_URL` | oui | — | URL PostgreSQL (Railway auto) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | oui | — | Cle publique Clerk |
| `CLERK_SECRET_KEY` | oui | — | Cle secrete Clerk |
| `AUTH_SECRET` | oui | — | Secret JWT/OTP (64 chars) |
| `OTP_EXPIRY_MINUTES` | — | `5` | Duree de validite OTP |
| `PAYMENT_PROVIDER` | — | `mock` | `mock` ou `stripe` |
| `STRIPE_SECRET_KEY` | si stripe | — | Cle secrete Stripe |
| `STRIPE_WEBHOOK_SECRET` | si stripe | — | Secret webhook |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | si stripe | — | Cle publique Stripe |
| `NOTIFICATION_PROVIDER` | — | `stub` | `stub` ou `twilio` |
| `TWILIO_ACCOUNT_SID` | si twilio | — | SID Twilio |
| `TWILIO_AUTH_TOKEN` | si twilio | — | Token Twilio |
| `TWILIO_PHONE_NUMBER` | si twilio | — | Numero expediteur |
| `TWILIO_WHATSAPP_NUMBER` | — | — | Numero WhatsApp |
| `NEXT_PUBLIC_APP_URL` | — | `localhost:3000` | URL publique de l'app |
| `NEXT_PUBLIC_APP_NAME` | — | `ClickBoucher` | Nom affiche |
| `LAST_MINUTE_HOLD_MINUTES` | — | `10` | Duree reservation DM |
| `CRON_SECRET` | — | — | Auth pour endpoint CRON |

---

## 7. Passage en production — Checklist

- [ ] `DATABASE_URL` pointe vers Railway PostgreSQL
- [ ] Clerk keys configurees (publishable + secret)
- [ ] `AUTH_SECRET` est un secret aleatoire fort (64+ chars)
- [ ] `NEXT_PUBLIC_APP_URL` est l'URL Railway finale
- [ ] Migrations appliquees (`prisma migrate deploy`)
- [ ] `/api/health` retourne `"status": "healthy"`
- [ ] PAYMENT_PROVIDER=stripe si paiement CB active
- [ ] Webhook Stripe configure et teste
- [ ] NOTIFICATION_PROVIDER=twilio si SMS/WA active
- [ ] CRON jobs configures (Railway ou cron-job.org)
- [ ] Domaine custom configure dans Railway (Settings > Domains)
- [ ] SSL/HTTPS actif (automatique sur Railway)
