# Deploiement ClickBoucher — Full Railway

## Architecture

```
                    INTERNET
                       |
              +--------v--------+
              |    RAILWAY      |
              |  +-----------+  |     +----------------+
              |  | Next.js   |  |     |  STRIPE (CB)   |
              |  | App Router|<-------+  Webhooks      |
              |  | + API     |  |     +----------------+
              |  +-----+-----+  |
              |        |        |     +----------------+
              |  +-----v-----+  |     |  TWILIO        |
              |  | PostgreSQL|  |     |  SMS/WhatsApp  |
              |  +-----------+  |     +----------------+
              +-----------------+
```

---

## 1. Developpement local

### Prerequis

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
# 1. Dependances
npm install

# 2. Environnement
cp .env.example .env
# -> Editer .env avec vos valeurs

# 3. PostgreSQL via Docker
docker compose up -d
# -> DATABASE_URL="postgresql://clickboucher:clickboucher_dev@localhost:5432/clickboucher?schema=public"

# 4. Base de donnees
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
| Boucher | http://localhost:3000/boucher/dashboard |
| API Health | http://localhost:3000/api/health |
| Prisma Studio | http://localhost:5555 (`npx prisma studio`) |

---

## 2. Deploiement Railway

### 2.1 Creer le projet

1. Aller sur [railway.app](https://railway.app)
2. New Project > Deploy from GitHub repo
3. Selectionner le repo `clickboucher`

### 2.2 Ajouter PostgreSQL

1. Dans le projet Railway, cliquer **+ New** > **Database** > **PostgreSQL**
2. La variable `DATABASE_URL` sera automatiquement disponible pour le service Next.js
3. Lier la variable : Service Next.js > Variables > Add Reference > `DATABASE_URL`

### 2.3 Configurer le service Next.js

**Variables d'environnement** (Settings > Variables) :

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/decouvrir
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/decouvrir
AUTH_SECRET=<random-64-chars>
PAYMENT_PROVIDER=mock
NOTIFICATION_PROVIDER=stub
NEXT_PUBLIC_APP_URL=https://<votre-app>.up.railway.app
```

**Build Command** :
```
npx prisma generate && npm run build
```

**Start Command** :
```
npm run start
```

**Port** : `3000`

### 2.4 Migration en production

```bash
# Depuis le terminal local, avec DATABASE_URL de Railway
DATABASE_URL="postgresql://..." npx prisma migrate deploy
DATABASE_URL="postgresql://..." npx prisma db seed
```

### 2.5 Verifier le deploiement

```bash
curl https://<votre-app>.up.railway.app/api/health
# -> { "status": "healthy", "checks": { "database": { "status": "ok" } } }
```

---

## 3. Activer Stripe (paiement reel)

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
| `WEIGHT_TOLERANCE_PERCENT` | — | `10` | Tolerance poids (%) |
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
