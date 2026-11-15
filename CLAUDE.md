# CLAUDE.md — Klik&Go

## Projet

Klik&Go est une plateforme SaaS click-and-collect pour boucheries halal. Stack : Next.js 14, TypeScript, Tailwind CSS, Prisma, PostgreSQL, Clerk. Paiement sur place uniquement (Stripe à venir). Déployé sur Vercel (klikandgo.app).

## Règles non négociables

### Sécurité multi-tenant

- TOUTE requête Prisma sur des données métier DOIT être scopée par `shopId`
- TOUTE route API (sauf publiques) DOIT vérifier l'authentification Clerk
- TOUTE mutation DOIT valider les inputs avec Zod côté serveur
- JAMAIS exposer de secrets avec `NEXT_PUBLIC_` (sauf publishable keys)

### Champs plateforme, HTML et publication (chantier failles critiques — 2026-11)

- **Schémas du boucher = listes blanches `.strict()`** : `ownerShopUpdateSchema`, `updateServiceSchema`
  (`src/lib/validators/index.ts`), `shopStatusActionSchema` (`src/app/api/boucher/shop/status/action-schema.ts`),
  corps de `PATCH /api/boucher/onboarding`. Clé en trop → 400, rien n'est écrit. Chaque colonne de `Shop` est
  classée boucher ou plateforme dans `src/lib/__tests__/shop-field-ownership.test.ts` (colonne nouvelle à classer).
- **Commission** : écrite seulement par `PATCH /api/admin/shops/[shopId]/commission` et `/api/admin/commission/global`
  (audités), plus la valeur initiale de `POST /api/shops` (admin). Sans `commissionEnabled`, la route de la boutique
  change le taux seul. Contrôle d'abus en lecture seule :
  `prisma/migrations/20261115120000_c1_failles_critiques/commission-audit.readonly.sql`.
- **HTML écrit à la main** (exports, e-mails, tickets) : gabarit `html` et `escapeHtml` de `src/lib/html/escape.ts`
  uniquement, `trustedHtml` sur un littéral seulement ; garde `src/lib/__tests__/html-sinks.test.ts`, dont les
  compteurs `LEGACY_BASELINE` ne peuvent que baisser.
- **CSV exportés** : chaque cellule par `csvCell` / `csvLine` de `src/lib/csv.ts` (cellule toujours entre
  guillemets, formule de tableur `= + - @` neutralisée par une apostrophe).
- **Noms d'invité** : `firstNameSchema` / `lastNameSchema` de `src/lib/validators/person-name.ts`.
- **Suspension** = `Shop.suspendedAt`, écrite seulement par `src/lib/services/shops/moderation.ts` ; toute route
  du boucher qui change l'état de sa boutique (`/api/boucher/shop/status`, `/api/boucher/service`,
  `/api/shops/[id]/status`, onboarding) → 403 tant qu'elle dure, seul l'admin la lève (« Réactiver »).
- **`Shop.visible`** : écrivains en liste fermée (modération, congés de `src/lib/shop-vacation.ts` sous condition,
  les deux créations), verrouillée par `src/lib/__tests__/shop-visible-writers.test.ts`.
- **Publication** : `src/lib/shop-publication.ts` répond seul à « page accessible » (`isShopPageReachable`) et
  « peut commander » (`shopOrderRefusalMessage`, appelé par `prepareOrder` : devis et création), revérifié sous
  verrou partagé de la ligne boutique dans la transaction qui écrit la commande (`lockShopTakingOrders`,
  `src/lib/services/orders/order-shop.ts`). `GET /api/shops/[id]` n'est jamais en cache partagé.

### Performance

- JAMAIS de requête N+1 : utiliser `include`/`select` Prisma
- Pagination obligatoire sur les listes pouvant dépasser 50 items
- Singleton Prisma depuis `src/lib/prisma.ts` uniquement
- Index sur colonnes filtrées et triées

### Coût CPU Vercel (CRITIQUE — panne du 2026-11-05)

Le site a été mis hors ligne 402 `DEPLOYMENT_DISABLED` : quota « Fluid Active CPU » dépassé,
alors que le trafic humain était quasi nul. Chaque exécution de middleware ou de fonction est
facturée, y compris pour les bots. Règles :

- **JAMAIS la prop `dynamic` sur `<ClerkProvider>`** (`src/app/layout.tsx`) : elle bascule TOUTE
  l'app en rendu par requête (298 routes sur 308) et rend `revalidate` inopérant.
  Conséquence à connaître : `useAuth()` / `useUser()` valent `isLoaded: false` au premier rendu →
  toujours tester `isLoaded` et mettre les flags d'auth dans les deps des effets.
- **`config.matcher` du middleware = liste blanche** (`src/middleware.ts`). Le middleware ne tourne
  que sur les routes protégées et l'API authentifiée. Toute nouvelle famille protégée doit être
  ajoutée aux `createRouteMatcher` ET au matcher ; un handler API exclu du matcher ne doit jamais
  importer `server-auth` / `boucher-auth` / `admin-auth`
  (verrouillé par `src/lib/__tests__/middleware-matcher.test.ts`).
- **ISR sur segment dynamique** : `revalidate` seul ne suffit pas, il faut `generateStaticParams`
  (au besoin `return []` pour de l'ISR à la demande). `/boutique/[slug]` reste volontairement
  dynamique (données live + appel Upstash `no-store`).
- **Aucun appel API au montage pour un visiteur anonyme** : conditionner sur
  `(isLoaded && isSignedIn) || hasTestModeCookie()` (`src/lib/test-mode-client.ts`).
- **Liens en masse** (footer, sidebars) : `prefetch={false}`.
- **Polling** : jamais de `setInterval` nu. Utiliser `useVisiblePolling` (pause onglet caché,
  backoff sur erreur) ; le mode cuisine a sa propre boucle dans `use-order-polling.ts`.
- **Pas de `new Date()` / `Date.now()` dans le rendu initial** d'un composant rendu côté serveur
  (pages statiques/ISR) : calculer après montage.
- **Le build exige une base joignable** (≈ 290 pages prérendues interrogent Prisma). Ne pas
  « réparer » un build sans DB avec des try/catch à valeur par défaut : cela figerait des listes
  vides et des `noindex` dans le cache ISR.
- Garde-fou CI : job `build` + `scripts/check-prerender.mjs` (échoue si `/`, `/cgv`, `/a-propos`,
  une page ville ou le sitemap ne sont plus prérendus).

### Next.js App Router

- `"use client"` obligatoire sur composants avec hooks/browser APIs
- Route handlers dans `app/api/**/route.ts` avec try/catch
- Pas de `Date.now()`/`Math.random()` dans le rendu initial
- Error boundaries `error.tsx` dans chaque layout

### Stripe

- Prix TOUJOURS recalculé côté serveur avant Checkout Session
- Signature webhook TOUJOURS vérifiée avec `constructEvent()`
- `STRIPE_SECRET_KEY` JAMAIS côté client
- Idempotency key sur chaque Payment Intent
- **Paiement en ligne toujours refusé** tant que le propriétaire n'a pas décidé : `paymentMethodSchema`
  (`src/lib/validators/order.ts`, `ON_PICKUP` seul) refuse `ONLINE` au devis et à la création (400 « Le paiement en
  ligne n'est pas encore disponible. Réglez sur place au retrait. »), le panier envoie `ON_PICKUP`
  (`src/lib/cart/order-payload.ts`). Garde : `tests/integration/orders/online-refused.test.ts`.
- **Garde d'environnement** (`src/lib/stripe.ts`, `stripeKeyRefusal`) : en production Vercel (`isProductionDeployment()`,
  `src/lib/auth/test-mode-env.ts`) seule une clé live (`sk_live_`, `rk_live_`) est acceptée, partout ailleurs seule une
  clé de test (`sk_test_`, `rk_test_`) ; tout le reste est refusé. `isStripeConfigured()` n'est vrai que pour une clé
  acceptée ; `getStripeClient()` relit la clé à chaque appel et lève `Stripe unavailable: <motif>` sans jamais l'écrire.
  Client : `STRIPE_CLIENT_CONFIG` (10 s, 1 nouvel essai, `apiVersion` du SDK installé, à relire dans
  `node_modules/stripe/esm/apiVersion.js` à chaque mise à jour de `stripe`).
- **Secrets lus à l'appel**, jamais à l'import ; deux secrets de webhook (`stripeWebhookSecrets()`) :
  `STRIPE_WEBHOOK_SECRET` (endpoint « Your account ») et `STRIPE_CONNECT_WEBHOOK_SECRET` (« Connected accounts »),
  ignorés s'ils ne commencent pas par `whsec_`.
- **Tout appel réseau à Stripe** passe par `getPaymentGateway()` (`src/lib/payments/gateway.ts`, seul appelant de
  `getStripeClient()`), **jamais dans une transaction Prisma** : valider, puis appeler Stripe, puis écrire le résultat.
  Garde : `tests/lib/stripe-guard.test.ts` (listes fermées : import du paquet, construction du client, lecture des
  variables `STRIPE_*`, passerelle dans un fichier qui ouvre une transaction).
- **Webhook dormant** `POST /api/payments/webhook` (hors matcher du middleware, aucun helper d'auth) : 503 sans clé
  acceptée ou sans aucun secret ; signature vérifiée localement, secret plateforme puis Connect (`verifyStripeWebhook`,
  `src/lib/services/stripe/webhook/verify.ts`), sinon 400 sans rien écrire ; `livemode` différent du déploiement → 200
  ignoré. Registre `StripeEvent` (`ledger.ts`) : marqueur avant le traitement, `handledAt` après ; rejeu → 200
  `duplicate` ; marqueur non traité de moins de 60 s → 409, plus ancien repris ; échec → marqueur supprimé et 500.
  Statut uniquement par `transitionOrder` : seul `checkout.session.expired` en change un (`PENDING` → `AUTO_CANCELLED`
  d'une commande `ONLINE` ni autorisée ni payée) ; sur `orders`, les autres n'écrivent que des colonnes de paiement des
  commandes `ONLINE`, par `updateMany` conditionnel ; ailleurs, les litiges (`StripeDispute`) et l'état Stripe de la
  boutique (`account.updated`, qui peut couper `acceptOnline`, jamais l'activer). Ce que chaque gestionnaire écrit :
  en-tête de `src/lib/services/stripe/webhook/*`. Aucun gestionnaire n'appelle Stripe, n'accepte ni n'annonce une
  commande.

### UX & Design

- Mobile-first : styles de base pour 375px, breakpoints `md:`/`lg:` pour tablette/desktop
- Touch targets ≥ 44px
- Dark mode supporté sur tous les composants
- Font : Outfit. Couleur primaire : `#DC2626`
- Icônes : Lucide React uniquement
- Images produits : `aspect-[4/3] object-cover object-center`

### Code quality

- Pas de `any` TypeScript sans justification en commentaire
- Pas de `console.log` en production
- Pas de code commenté
- Fichiers < 300 lignes (sauf exceptions justifiées)
- Try/catch dans chaque route handler avec logging structuré

## Conventions de nommage

- Routes API : `app/api/[resource]/route.ts`
- Composants : PascalCase (`ProductCard.tsx`)
- Modules de `src/lib` : fichiers en kebab-case (`src/lib/shop-hours.ts`, `src/lib/order-state-machine.ts`)
- Variables d'environnement : SCREAMING_SNAKE_CASE

## Build & Deploy

- `npm run build` doit passer sans erreur avant tout push
- Déploiement automatique par Vercel quand une pull request est fusionnée dans `main` (protégée : jamais de
  push direct, voir « Décisions du propriétaire (2026-11-15) »)
- Migrations prod : `npx prisma migrate deploy` (JAMAIS `migrate dev`)

## Tests

- **Runner** : Vitest 4 (config dans `vitest.config.ts`), deux projets : `unit` et `integration`.
  Un `vitest run` sans `--project` lance les deux et exige donc une base : passer par les scripts npm.
- **Commandes** :
  - `npm run test` (= `npm run test:run`) → tests unitaires, sans base ni réseau (utilisée par CI)
  - `npm run test:integration` → tests d'intégration sur un PostgreSQL RÉEL (utilisée par CI)
  - `npm run test:watch` → mode watch local (unitaires)
  - `npm run test:coverage` → rapport couverture v8 (text + html + lcov, unitaires)
- **Intégration en local** : `DATABASE_URL=postgresql://<user>:<mdp>@127.0.0.1:<port>/<base>?schema=public npm run test:integration`
  (base locale jetable, ex. un conteneur Docker Postgres 16 ; jamais la base de production). L'hôte doit être
  `localhost`, `127.0.0.1` ou `::1`, sinon le setup refuse de démarrer. La suite tourne dans le schéma
  **`itest`** de cette base (créé et poussé par `tests/integration/setup/global-setup.ts`, vidé avant chaque
  test) et ne touche jamais `public`. Un fichier à la fois ; deux runs simultanés s'attendent (verrou advisory).
- **Conventions** :
  - Tests unitaires dans `src/lib/__tests__/*.test.ts` ou `tests/lib/*.test.ts` (fonctions pures uniquement — pas de DB ni réseau).
  - Tests d'intégration dans `tests/integration/**/*.test.ts` : 1re ligne `// @vitest-environment node`,
    `useCleanDatabase()` en tête de fichier (précédé de `// eslint-disable-next-line react-hooks/rules-of-hooks`),
    données via `tests/integration/helpers/factories.ts`.
  - **Ne JAMAIS mocker Prisma** (`@/lib/prisma`) ni quoi que ce soit qui parle à PostgreSQL : tout ce qui
    touche la base se teste en intégration. Mocks permis : transports sortants (`@/lib/email`, `@/lib/push`,
    `@/lib/whatsapp`, `@/lib/emails/*`), helpers d'auth quand on appelle un route handler directement, et la
    passerelle Stripe `@/lib/payments/gateway` (faux : `tests/integration/helpers/fake-payment-gateway.ts`, qui
    enregistre chaque appel et refuse tout appel non prévu). Webhooks testés avec des charges signées localement
    (`Stripe.webhooks.generateTestHeaderString`, `tests/integration/payments/stripe-event-fixtures.ts`) : jamais de
    clé réelle ni d'appel réseau.
  - E2E : Playwright dans `tests/` (`npm run test:e2e`).
  - Pour un test sans DOM, ajoute `// @vitest-environment node` en tête de fichier (l'environnement par défaut est `jsdom`).
- **Garde-fous commande** : `tests/integration/checkout-contract.test.ts` (panier → payload navigateur →
  devis → commande, sur 12 paniers types) et `tests/lib/order-writers-guard.test.ts` (liste fermée des
  fichiers qui écrivent dans `orders`, chacun avec sa raison ; seul `transition.ts` écrit le statut, sans exception).
- **Garde-fous sécurité** : `src/lib/__tests__/shop-field-ownership.test.ts` (colonnes de `Shop` du boucher ou de la
  plateforme), `src/lib/__tests__/shop-visible-writers.test.ts` (écrivains de la publication),
  `src/lib/__tests__/html-sinks.test.ts` (HTML écrit à la main) ; en intégration `tests/integration/security/**`
  (champs plateforme, suspension, prise de commande, XSS de l'export, noms d'invité).
- **Couvert actuellement** : formatters Kitchen (`format-kitchen.ts`), state machine commande, prix (`src/lib/pricing/*`), panier (`cart-line`, `order-payload`), numéros (`order-number-format`), commission, créneaux ouverture, RBAC Clerk, segments marketing, `api/errors`, `auth/test-auth`, `seo/cities`, `estimate`, `utils`, photos (URL durable, résolveurs, contrat d'envoi, plan d'écriture des photos produit, ingestion avec le vrai sharp, stockage, champ « Photos » du boucher), marge de pesée et décision d'ajustement (`pricing-tolerance`, `pricing-adjustment-lines`, textes `price-adjustment-messages`, champ `weighTolerance` du validateur), garde de clé Stripe (`stripe-env`), garde Stripe statique (`tests/lib/stripe-guard.test.ts`) ; en intégration : devis, création, remises, numérotation, transitions et courses, stock limité, tableau cuisine, notifications, données publiques, photos (`tests/integration/images/**` : envoi et quota, miroir `Product.imageUrl`, règle d'écriture, suppression depuis la galerie, source de retouche, charges utiles, recensement et maintenance), marge de pesée à la création (`orders/weigh-tolerance`) et dans le profil (`api/users-me-tolerance`), paiement en ligne refusé (`orders/online-refused`), ajustements de prix (`orders/price-adjustment*` : matrice de la marge, accord explicite, silence = refus, lignes héritées), paiement (`tests/integration/payments/**` : schéma et migration, route du webhook et registre des événements, effets sur les commandes, comptes connectés et litiges).
- **Règle** : tout helper pur ajouté dans `src/lib/**` mérite un test ; les fonctions qui touchent Prisma/HTTP restent en intégration.

## CI/CD

- **Workflow** : `.github/workflows/ci.yml` — déclenché sur push `main` + PRs.
- **Jobs parallèles** (Node 22, `ubuntu-24.04` figé : `ubuntu-latest` est passé à 26.04, où Playwright
  n'installe pas Chromium) :
  - `lint` → `npm run lint` (ESLint)
  - `typecheck` → `npx tsc --noEmit`
  - `test` → `npm run test:run` (unitaires) puis `npm run test:integration` (intégration sur le
    service Postgres 16 du job, schéma `itest` ; le schéma `public` poussé pour le job n'est pas modifié)
  - `build` → `npm run build` sur Postgres 16 (schema poussé) puis `node scripts/check-prerender.mjs`
    (échoue si les pages publiques ne sont plus prérendues — cf. « Coût CPU Vercel »). Ensuite, le job
    remplit sa base par le seed et lance `tests/e2e/photos.spec.ts` (Playwright Chromium) sur l'app
    construite (`next start`), en mode test ouvert par POST avec un `TEST_SECRET` tiré à chaque
    lancement, et avec le stockage local des photos sur disque (aucun jeton Blob en CI).
- **Uptime** : `.github/workflows/uptime.yml` — toutes les 6 h, échoue si `/` ou `/sitemap.xml`
  ne répondent pas 200 ou portent `x-vercel-error`. Contrôle EXTERNE au projet Vercel (les crons
  internes ne tournent pas quand le projet est en pause), mais PAS suffisant seul : dépôt public,
  GitHub désactive les workflows planifiés après 60 jours sans commit (arrivé à Claude Security
  Review le 2026-08-31). Prévoir en plus un moniteur externe (Sentry Uptime, UptimeRobot…) sur
  `https://klikandgo.app/` ; après une longue pause : `gh workflow enable Uptime`.
- **Cache** : `node_modules` + `~/.npm` indexés sur `package-lock.json`. Concurrency cancel-in-progress par ref.
- **Env stub** : `DATABASE_URL` pointe sur le service Postgres 16 des jobs `test` et `build` ; clés Clerk fake (format valide).
- **Dependabot** : `.github/dependabot.yml` — npm + GitHub Actions, hebdo lundi 06:00 Paris, max 5 PRs npm + 3 PRs CI. Majeurs Next/React/Clerk/Prisma ignorés (upgrade manuel).
- **PR template** : `.github/pull_request_template.md` — checklist build/lint/typecheck/test + screenshots si UI.
- **Vercel preview** : l'environnement Preview de Vercel n'a PAS de `DATABASE_URL`, or le build
  prérend ≈ 290 pages sur la base → tout déploiement de preview échouait
  (`Environment variable not found: DATABASE_URL`). `vercel.json` (`git.deploymentEnabled` :
  `"**": false, "main": true`) ne déploie donc QUE `main` (production) : aucune branche de pull
  request ne lance de preview ; c'est le job CI `build` qui les valide.
  Pour une vraie recette en ligne : créer une base Postgres DÉDIÉE (jamais celle de production —
  le mode test y est autorisé et les URLs de preview sont publiques), y pousser le schéma + le seed,
  définir `DATABASE_URL` / `DIRECT_DATABASE_URL` et les clés Clerk de dev sur l'environnement
  Preview, puis autoriser la branche voulue dans `git.deploymentEnabled` (`"<motif>": true`).

## Stack

- **Framework** : Next.js 14 (App Router) + TypeScript
- **UI** : Tailwind CSS + shadcn/ui + Lucide React
- **Auth** : Clerk (3 rôles : CLIENT, BOUCHER, ADMIN)
- **ORM** : Prisma + PostgreSQL (Railway)
- **State** : React Context + useReducer (panier)
- **AI** : Anthropic SDK (support tickets)
- **Paiement** : Paiement sur place uniquement (Stripe à venir — pas encore implémenté)
- **Notifications** : Resend (email), web-push, Svix (webhooks)
- **Rate limiting** : Upstash Redis
- **QR Code** : qrcode.react + html5-qrcode (scan)
- **Charts** : Recharts (dashboard boucher)
- **Hébergement** :
  - **Frontend Next.js + serverless** : Vercel (déploiement automatique de `main`) — **seul service web actif**
  - **PostgreSQL** : Railway (DB uniquement, host `switchyard.proxy.rlwy.net`)
  - ⚠️ **Pas de service Next.js sur Railway** : l'ancien service `clickboucher` du projet Railway `perpetual-clarity` doit rester désactivé (ou supprimé). Sinon il essaie de re-builder à chaque push GitHub et envoie des emails "Build failed" inutiles. Si tu reçois ces mails : Railway dashboard → projet `perpetual-clarity` → service `clickboucher` (PAS le service Postgres) → Settings → désactiver Auto Deploy ou Delete Service.
- **Repo** : https://github.com/eltarik73/clickboucher
- **Production** : https://klikandgo.app (canonical, sans www)

## Commandes

```bash
npm run dev          # Dev server
npm run build        # Build (prisma generate + next build)
npm run lint         # ESLint
npm run db:migrate   # prisma migrate dev
npm run db:push      # prisma db push
npm run db:seed      # prisma db seed (npx tsx prisma/seed.ts)
npm run db:studio    # prisma studio
npm run db:reset     # prisma migrate reset
```

- **Installation locale** : `docker compose up -d`, `npx prisma db push`, `npm run db:seed` (la CI aussi pousse le
  schéma puis lance le seed). Le seed refuse toute base dont l'hôte n'est pas local (`prisma/seed-guard.ts`).

## Structure du projet

```
src/
├── app/
│   ├── (client)/                 # Route group client
│   │   ├── page.tsx              # Homepage (boutiques + offres, ISR 300s)
│   │   ├── decouvrir/            # Redirect → / (legacy)
│   │   ├── boutique/[slug]/       # Détail boutique + produits
│   │   ├── panier/               # Panier
│   │   ├── checkout/             # Paiement
│   │   ├── commandes/            # Suivi commandes
│   │   ├── bons-plans/           # Dernière minute
│   │   ├── favoris/              # Boutiques favorites
│   │   ├── pro/                  # Espace PRO (B2B)
│   │   ├── suivi/[id]/           # Suivi commande
│   │   └── validation/[id]/      # Validation poids
│   ├── (boucher)/
│   │   └── boucher/
│   │       ├── commandes/        # Mode Cuisine (3 colonnes sur grand écran, 4 onglets sur mobile, polling 5s)
│   │       ├── dashboard/        # Accueil du back-office + anti-gaspi, calendrier, export, finances, parrainage, statistiques
│   │       ├── produits/         # Catalogue (liste, nouveau, [id]/modifier)
│   │       ├── historique/       # Commandes des 7 derniers jours
│   │       ├── clients/          # Clients de la boutique
│   │       ├── parametres/       # Réglages boutique
│   │       └── images/  performance/  support/
│   ├── boucherie-halal/[ville]/   # Pages SEO par ville (SSG)
│   ├── robots.ts                 # robots.txt dynamique
│   ├── sitemap.ts                # Sitemap XML (shops + villes)
│   ├── opengraph-image.tsx       # OG image (prérendue au build, runtime Node)
│   └── api/                      # 27+ groupes de routes API
│       ├── shops/  orders/  products/  cart/  payments/
│       ├── auth/  users/  webhooks/  admin/  onboarding/
│       ├── favorites/  reviews/  loyalty/  notifications/
│       ├── push/  search/  suggestions/  support/  chat/
│       ├── uploads/  recurring-orders/  boucher/
│       └── calendar-events/  cron/  health/  webmaster/
├── components/
│   ├── ui/          # shadcn/ui primitives
│   ├── cart/        # CheckoutLineRow, CartSuggestions (page /panier)
│   ├── shop/        # ShopCard
│   ├── product/     # ProductCard
│   ├── order/       # OrderTracker, ActiveOrderBanner, QRCodeDisplay, QRScanner, RatingPopup, Reorder*, order-timeline
│   ├── checkout/    # Checkout flow
│   ├── boucher/     # KitchenOrderCard, OrderTicket, PrepTimer, OrderAlertOverlay, PriceAdjustModal
│   ├── seo/         # OrganizationSchema, ShopSchema, BreadcrumbSchema, ProductSchema
│   ├── webmaster/   # ShopAdjustmentsTab, etc.
│   └── providers/   # CartProviderWrapper
├── hooks/
│   ├── use-order-polling.ts  # Polling kitchen (5s), filtered views, scheduled detection
│   ├── use-pending-order-count.ts  # Compteur « en attente » du tableau de bord (useVisiblePolling, 30 s)
│   ├── use-kitchen-notifications.ts  # Browser notifications, title blink
│   └── use-wake-lock.ts     # Screen wake lock for tablet
├── lib/
│   ├── utils.ts
│   ├── hooks/use-cart.tsx    # Hook panier (React Context + useReducer)
│   ├── notifications.ts     # Multichannel: email, push, WhatsApp, in-app
│   ├── sounds.ts            # startOrderAlert() / stopOrderAlert()
│   ├── boucher-auth.ts      # getAuthenticatedBoucher()
│   ├── api/errors.ts         # apiError / apiSuccess / handleApiError
│   ├── cart/                 # cart-line.ts (ligne de panier, réducteur), stored-cart.ts (panier stocké), order-payload.ts (requête de commande)
│   ├── pricing/              # SEULE source des prix : ligne, prix unitaire, remise, totaux, affichage
│   ├── seo/                  # cities.ts (SEO_CITIES config)
│   ├── services/             # Business logic (orders/ : quote, create, numbering, transition, commands/)
│   └── validators/           # Schémas Zod
└── types/index.ts
```

## Système de panier

- **Fichier source** : `src/lib/hooks/use-cart.tsx` (Context + useReducer)
- **Re-export** : `src/lib/hooks/useCart.ts`
- **Import correct** : `import { useCart } from "@/lib/hooks/use-cart"`

```typescript
const { state, addItem, removeItem, updateQty, updateWeight, clear, itemCount, totalCents } =
  useCart();
// state = { shopId, shopName, shopSlug, items: CartItem[] }
```

- **Ligne de panier** : `CartItem` est défini dans `src/lib/cart/cart-line.ts` (réducteur, `cartLineId`) ; le
  panier stocké est relu par `normalizeStoredCart` (`src/lib/cart/stored-cart.ts`). Une ligne a le sens d'une ligne de
  requête (voir « Commandes : quantités, prix, totaux » plus bas) : jamais de quantité pré-multipliée par le poids.
- **`totalCents` du panier = estimation locale.** Le panier (`/panier`) affiche le devis du serveur
  (`POST /api/orders/quote`, hook `use-order-quote`) et envoie la commande via
  `src/lib/cart/order-payload.ts`, seul constructeur de la requête.
- **Refus par ligne** : quand le devis ou la commande refuse des lignes, `refusedCartLines`
  (`src/lib/cart/order-payload.ts`) les rattache au panier : les détails `items.N.<champ>` désignent
  `items[N]` (la requête garde l'ordre du panier), `STOCK_INSUFFICIENT.unavailableProductIds` marque
  toutes les lignes de ces produits. Chaque ligne affiche son message et un bouton « Retirer cet article »
  (`src/components/cart/CheckoutLineRow.tsx`) ; le message générique ne sert que si aucun détail ne
  nomme une ligne. Garder le format de clé `items.N.<champ>` dans `quote.ts`.
- **Marge de pesée et bouton de commande** : au-dessus du bouton, la clause « Pour gagner du temps, votre boucher
  ajuste le prix après la pesée sans vous déranger, dans la limite choisie » et le choix 5 % / 10 %
  (`WeighToleranceChoice`), sans choix pré-coché (art. L121-17 du Code de la consommation). Le choix affiché part dans
  `weighTolerance` de la requête de création (`CheckoutSelection.weighTolerance`, `src/lib/cart/order-payload.ts`),
  jamais dans le devis. Bouton final : « Commander avec obligation de paiement » (art. L221-14). Règle et serveur :
  « Ajustement de prix (marge de pesée) ».

## Photos

- **Une seule route d'envoi** : `POST /api/uploads/image` (`file` + `purpose` PRODUCT | RETOUCH_SOURCE |
  REFERENCE, formulaire construit par `buildUploadForm`, `src/lib/images/upload-contract.ts`). 4 Mo au plus
  (le navigateur réduit avant d'envoyer), 30 envois par heure et par boutique. Côté boucher :
  `ProductPhotosField` + `useProductPhotos` (`src/components/boucher/photos/`) ; ne pas réécrire d'envoi.
  La retouche envoie sa source ainsi (`RETOUCH_SOURCE`) puis ne transmet que son URL (`retouch-request.ts`).
- **Une seule entrée** : `persistImage` (`src/lib/images/ingest.ts`) : octets magiques, sharp (redressée,
  sans métadonnées, fond blanc), WebP 2048 px + vignette 400 px `-t`, ligne `generated_images` après les
  deux fichiers. JAMAIS importer `@vercel/blob` hors de `src/lib/images/store.ts` ni `sharp` hors de
  `src/lib/images/process.ts` (garde `tests/lib/image-writers-guard.test.ts`, liste fermée).
- **Règle d'écriture** (`imageWriteRefusal`, `src/lib/images/durable-url.ts`) : URL durable seulement (Blob
  épinglé, `/img/(products|shops|recipes)/…`, `/local-images` hors prod), et un fichier de notre magasin doit
  appartenir à la boutique de la ligne ou à la plateforme (`src/lib/images/write-scope.ts`) ; une valeur
  inchangée sur la ligne reste acceptée. Unsplash/Pexels : affichage seulement. Jamais `replicate.delivery`.
- **Une source de vérité** : `Product.imageUrl` est le miroir, écrit par le serveur, de la photo principale
  de `ProductImage` (`planProductImageWrite`, `src/lib/images/product-image-write.ts`) ;
  `clearImageUrl: true` la retire ; remplacement atomique ; produit à photos : `imageUrl` / `clearImageUrl`
  sans `images` → 400. Ne jamais écrire `imageUrl` d'un produit à côté.
- **Affichage** : photos de produit et de boutique par `ProductPhoto` / `ShopPhoto` (`src/components/media/`),
  jamais un `<img>` ou `next/image` avec `onError` qui change `src`. `resolveProductImage` reste pour le JSON-LD.
- **Stockage local** : sans `BLOB_READ_WRITE_TOKEN`, hors Vercel et hors production, `.image-store/` servi
  par `/local-images/…` (développement et CI seulement ; 404 ailleurs).
- **Suppression** : le formulaire n'efface aucun fichier ; la galerie refuse (409) une image utilisée.
- **Réparation des données (propriétaire seulement)** : `scripts/images/` (recensement, Unsplash, copie dans
  Blob, recopie d'`image_url`, purge), essai à blanc par défaut, journaux CSV/JSONL, aucune table créée.
  Procédure, variables, annulation et données transmises à des tiers : `docs/photos.md`.

## Base de données (Prisma)

Modèles principaux : User, Shop, Category, Product, Order, OrderItem, Cart, CartItem, Review, LoyaltyPoint, Notification, Subscription, SupportTicket, ProAccess, PriceAdjustment, RecurringOrder, Referral, DailyCounter, GlobalCategory, ReferenceProduct, ShopAlert.

Features Uber Eats/Deliveroo : busy mode, pause manuelle, auto-pause, vacation mode, order throttling, snooze produit, auto-cancel commandes, QR code retrait, ajustement prix/poids, commandes programmées auto-acceptées.

Rôles : CLIENT, CLIENT_PRO, CLIENT_PRO_PENDING, BOUCHER, ADMIN.

## Mode Cuisine (Kitchen Mode)

- **Page** : `src/app/(boucher)/boucher/commandes/page.tsx`
- **Layout desktop** (`lg`) : 3 colonnes — Nouvelles (40 %) | En cours (reste, 2 sections) | Prêtes (20 %), + Historique
  dans la barre du bas ; mode simple : 2 colonnes (Nouvelles | En cours / Prêtes)
- **Layout mobile** : 4 onglets (Nouv. / En cours / Prêtes / Histo.)
- **Polling** : `useOrderPolling` hook (5s), callbacks: `onNewOrder`, `onStatusChange`, `onScheduledReady`
- **Source** : `GET /api/boucher/orders/kitchen` → `{ active, activeTruncated }` : TOUTES les commandes
  PENDING / ACCEPTED / PREPARING / READY / PARTIALLY_DENIED de la boutique, avec les seules colonnes affichées
  (`kitchenOrderSelect`, `src/lib/services/orders/kitchen.ts`). Au-delà de 500 actives,
  `activeTruncated: true` → bandeau rouge (jamais de troncature silencieuse). `?history=1` ajoute `history` :
  les 50 commandes terminées les plus récentes des 7 derniers jours, en colonnes légères
  (`kitchenHistorySelect`). Le hook ne demande l'historique qu'au premier passage, puis au plus une fois par
  minute, quand une commande quitte le tableau et quand l'onglet Historique s'ouvre (`refreshHistory`).
  Badge du menu : `GET /api/boucher/orders/pending-count`.
- **Accueil du tableau de bord boucher** : chiffres du jour (journée de Paris) et 5 dernières commandes par
  `GET /api/boucher/orders/summary` (`src/lib/services/orders/shop-summary.ts`), compteur « en attente » par
  `pending-count` — jamais à partir de `GET /api/orders`, limité à 50. Ce compteur est relu toutes les 30 s par
  `src/hooks/use-pending-order-count.ts` (`useVisiblePolling`) ; le résumé du jour et le statut de la boutique sont relus
  toutes les minutes (et aussitôt quand ce compteur change) ; aucun flux SSE (`src/lib/__tests__/urgences/no-sse.test.ts`).
- **Composants** : `KitchenOrderCard`, `OrderTicket` (80mm thermal Uber Eats style), `PrepTimer`, `OrderAlertOverlay`
- **"En cours" split** : 2 sections TOUJOURS visibles (même vides) — section haute "À préparer maintenant" (ASAP + scheduled ≤30min) + section basse "Précommandes" (scheduled >30min, compact cards avec countdown)
- **Cards programmées compactes** : ligne unique — `#num Prénom.N | heure retrait | countdown | bouton imprimer`

## Commandes Programmées

- Les commandes avec `pickupSlotStart` arrivent en **PENDING** dans Nouvelles (PAS auto-acceptées)
- Bandeau orange "📅 PROGRAMMÉE — Retrait à HH:MM" visible sur la card
- Boucher clique Accepter (pas de sélecteur de délai — l'API utilise pickupSlotStart comme estimatedReady)
- Après acceptation → va dans "En cours" section "Précommandes" avec countdown
- 30 min avant retrait → bascule en section "À préparer maintenant" + son Marimba + notification boucher + notification client via `/api/orders/[id]/scheduled-notify`
- Boucher traite normalement : En préparation → Prête
- Tickets imprimés avec bannière "📅 COMMANDE PROGRAMMÉE — RETRAIT HH:MM"
- Pas de nouveau champ Prisma — utilise `pickupSlotStart` / `pickupSlotEnd` existants

## Ticket de Commande (Style Uber Eats)

- **Fichier** : `src/components/boucher/OrderTicket.tsx`
- **Impression silencieuse** : iframe caché (`position:fixed, top:-10000px, height:900px`), `window.print()`, nettoyage auto via `afterprint` + timeout 10s
- **Format** : Logo SVG Klik&Go + nom boutique → hero noir inversé (#num + Prénom.N) → dates → encadré RETRAIT → articles avec HALAL → note client → sous-total/payé → 🔑 code retrait 4 chiffres (extrait du UUID) → footer
- **Compatibilité tablette** : layout float (pas flex) pour lignes articles/totaux, `-webkit-print-color-adjust: exact !important`, `@media print { width: 80mm }`
- **Fallback** : `printOrderTicketFallback()` ouvre nouvelle fenêtre avec bouton imprimer manuel

## Format Nom Client

- **Règle** : `Prénom.N` partout (ex: Tarik.B, Fatima.A)
- **Logique** : `firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()` + `.` + `lastName.charAt(0).toUpperCase()`
- **Appliqué dans** : OrderTicket, KitchenOrderCard, HistoryCard (page commandes)

## Horaires & fuseau (Europe/Paris)

- **Clés de jour** : `openingHours` est stocké avec des clés FRANÇAISES (`lundi` … `dimanche`) par
  les réglages boucher, le seed et les créneaux. Toujours lire via `getDayHours(openingHours, jsDay)`
  de `src/lib/shop-hours.ts` (accepte aussi `mon` … `sun`) — ne jamais indexer `hours.mon` à la main.
- **Fuseau** : les fonctions Vercel tournent en UTC. Pour « aujourd'hui », « maintenant » ou
  « ouvert / fermé » côté serveur, passer par `src/lib/paris-time.ts`
  (`getParisWallClock`, `toParisWallClockDate`, `parisWallClockToUtc`), jamais `new Date().getHours()`.

## Créneaux de Retrait (Pickup Slots)

- **Route** : `GET /api/shops/[id]/available-slots?date=YYYY-MM-DD`
- **Marge** : now + 10min, arrondi vers le HAUT au prochain créneau (intervalMin, défaut 30min)
- **Exemples** : 13h09→13h30 | 13h22→14h00 | 14h05→14h30 | 14h31→15h00
- **Formule** : `rawMin = now + 10; remainder = rawMin % intervalMin; nowMinutes = remainder === 0 ? rawMin : rawMin + intervalMin - remainder`

## Ajustement de prix (marge de pesée)

- **Choix du client** : `STANDARD` = 5 % du total estimé, 10 € au plus ; `EXTENDED` = 10 %, 20 € au plus
  (`WEIGH_TOLERANCE_TERMS`, `src/lib/pricing/tolerance.ts`). Marge = `min(taux × total estimé, plafond)`, arrondie vers
  le bas (`toleranceCents`). Préférence du membre : `User.weighTolerance`, NULL tant qu'il n'a pas choisi (choix actif à
  la première commande, aucun défaut), modifiable dans le profil (`PATCH /api/users/me { weighTolerance }`).
- **À la création** (`resolveWeighTolerance`, `src/lib/services/orders/weigh-tolerance.ts`) : le panier envoie le choix
  dans `weighTolerance` (un nom, jamais un montant ; le devis ne le porte pas). Choix de la requête, sinon préférence
  enregistrée, sinon 400 `VALIDATION_ERROR` « Choisissez votre marge de pesée avant de commander. » ; le choix envoyé
  par un membre est enregistré dans la transaction de création. Invité : choix obligatoire à chaque commande, jamais lu
  ni écrit sur `users`. La commande fige `weighToleranceRateBps`, `weighToleranceCapCents` et `estimatedTotalCents`
  (= `totalCents` du devis) ; NULL (commande antérieure) = aucune marge : toute hausse demande l'accord du client.
- **Règle, une seule autorité** : `decideAdjustment` (`src/lib/pricing/tolerance.ts`), appelée par
  `src/lib/services/orders/adjust-price.ts` et revérifiée par l'écrivain. Baisse (ou total inchangé) : appliquée
  aussitôt (`AUTO_APPROVED`). Hausse de pesée (`WEIGHT`) : appliquée sans demander tant que la hausse cumulée, somme
  sur les lignes disponibles de (total de la ligne − `estimatedPriceCents`), reste dans la marge figée
  (`availableLinesAfter`, `src/lib/pricing/adjustment.ts` : une ligne en rupture ne donne aucune marge aux autres).
  Sinon (au-delà de la marge, `PRICE` ou `MANUAL`, commande sans marge, ligne sans estimation) : ajustement `PENDING`,
  le client doit répondre explicitement. Filet de la plateforme conservé : jamais plus de `pa_max_increase_pct`
  (50 % par défaut ; seul réglage restant, `PATCH /api/webmaster/config/price-adjustment`, entier de 1 à 100) au-dessus
  du total actuel.
- **Délai de réponse** : 5 min (`ADJUSTMENT_ANSWER_WINDOW_SECONDS`, colonne `answerBy`), seule constante du serveur,
  du compte à rebours et des textes. **Le silence vaut refus** : passé `answerBy` (ligne sans `answerBy` : 5 min après
  `createdAt`), l'ajustement est fermé `REJECTED`, `closeReason` `NO_ANSWER`, à la lecture (`settleDueAdjustment` /
  `settleDueAdjustmentsWithin` : page de la commande, page de suivi et sa route `/status` (seulement si la ligne lue
  est échue, `isAdjustmentAnswerDue`), cuisine, listes, résumé du jour), sans cron, et la boutique est
  prévenue (`PRICE_ADJUSTMENT_EXPIRED`). Un oui tardif ne change rien. Jamais de validation automatique, plus
  d'escalade au webmaster.
- **Après un refus** (`CUSTOMER_REFUSED` ou `NO_ANSWER`) : la commande garde son dernier prix accepté ; le boucher peut
  repeser dans la marge ou déclarer l'article en rupture. Une ligne `PriceAdjustment` par commande, remplacée par la
  proposition suivante ; tant que le client peut encore répondre, une nouvelle proposition est refusée (409).
- **Route** : `PATCH /api/orders/[id]/adjust-price` — SEUL moyen de changer le total d'une commande après sa
  création (les actions `adjust_weight` / `adjust_price` de la route boucher unifiée n'existent plus). Réponses du
  client : `POST /api/orders/[id]/adjustment/accept` et `/reject`.
- **Seuls écrivains d'un total ajusté** : `src/lib/services/orders/adjustment-settlement.ts` (`settleAdjustmentInTx` :
  verrou de la commande, mise à jour conditionnelle `PENDING` → `AUTO_APPROVED` / `APPROVED`, refus si la commande a
  changé depuis : fermé `REJECTED`, `ORDER_CHANGED`) et `adjustment-answers.ts` (oui du client avant `answerBy`, refus,
  silence ; seul le gagnant notifie, après commit). Les fermetures sans application passent par `adjustment-closure.ts`
  (écriture conditionnelle de la ligne `PENDING`, jamais du total). Toute fermeture de commande, rupture ou retrait
  ferme l'ajustement en attente (`closePendingAdjustment`). Lignes repesées via `src/lib/pricing/adjustment.ts`.
- **Preuve du consentement** : un `OrderEvent` dans la même transaction, `PRICE_ADJUSTED` (from, to, settledAs,
  adjustmentType, toleranceCents, cumulatedIncreaseCents) ou `PRICE_ADJUSTMENT_CLOSED` (reason, from, to,
  adjustmentType) ; ces événements sont l'historique des ajustements.
- **Notifications** : au client `PRICE_ADJUSTMENT_AUTO_APPROVED` (appliqué) ou `PRICE_ADJUSTMENT_PENDING` (à répondre) ;
  à la boutique `PRICE_ADJUSTMENT_ACCEPTED`, `PRICE_ADJUSTMENT_REJECTED`, `PRICE_ADJUSTMENT_EXPIRED`. Textes écrits une
  fois dans `src/lib/price-adjustment-messages.ts`.
- **Héritage** : le nouveau code écrit `tier` 1 (appliqué sans demander) ou 3 (réponse demandée), jamais 2, ni
  `autoApproveAt`, `escalateAt`, `AUTO_VALIDATED`, `ESCALATED` : ces valeurs ne restent que sur d'anciennes lignes et ne
  décident de rien ; une ligne en attente héritée n'est jamais appliquée sans réponse. `Shop.priceAdjustmentThreshold`
  (colonne conservée, migration additive) ne décide plus de rien.

## Authentification API (CRITIQUE)

Toutes les routes API utilisent `getServerUserId()` de `@/lib/auth/server-auth` — **JAMAIS `auth()` de Clerk directement**.

```typescript
// ✅ Correct — supporte le test mode
import { getServerUserId } from "@/lib/auth/server-auth";
const userId = await getServerUserId();

// ✅ Routes boucher — retourne { userId, shopId }
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
const authResult = await getAuthenticatedBoucher();
if (authResult.error) return authResult.error;

// ✅ Routes admin
import { requireAdmin } from "@/lib/admin-auth";

// ❌ INTERDIT — casse le test mode
import { auth } from "@clerk/nextjs/server";
const { userId } = await auth();
```

Pour les vérifications de rôle, toujours faire un lookup DB :

```typescript
const dbUser = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true, role: true } });
if (!isAdmin(dbUser?.role)) { ... }
```

Shop ownership — toujours chercher avec OR clause (le shop peut stocker soit le clerkId soit le user.id Prisma) :

```typescript
const shop = await prisma.shop.findFirst({
  where: { OR: [{ ownerId: clerkId }, { ownerId: dbUser.id }] },
});
```

## Test Mode

- **JAMAIS en production Vercel** : `isTestMode()` renvoie `false` dès que `VERCEL_ENV=production`
  (ou la valeur figée au build `KLIKGO_DEPLOY_ENV`), quelles que soient les variables. Règle unique
  dans `src/lib/auth/test-mode-env.ts`. Ne JAMAIS réintroduire d'échappatoire : jusqu'au 2026-11-13,
  `TEST_MODE` + `ALLOW_TEST_IN_PROD` étaient définis en prod et deux cookies en clair donnaient
  l'accès ADMIN à n'importe quel visiteur.
- **Où il sert** : en local et sur les déploiements de preview/recette. `TEST_MODE=true` ; sur un
  build de production hors prod Vercel (preview, `next start` local) il faut en plus
  `ALLOW_TEST_IN_PROD=true`. `TEST_SECRET` : au moins 16 caractères, server-only.
- **Activation** : `?testmode=<TEST_SECRET>` dans l'URL → `POST /api/test-mode/activate` (secret
  vérifié côté serveur, comparaison à temps constant, limité en débit) → pose un **jeton de session
  signé** (HMAC-SHA256, rôle + expiration 8 h) dans le cookie httpOnly `klikgo-test-session`.
- **Ce que le serveur croit** : uniquement ce jeton (`src/lib/auth/test-session.ts` pour le middleware,
  `test-session-node.ts` pour les helpers). Les cookies lisibles `klikgo-test-activated` et
  `klikgo-test-role` ne sont que des indices d'interface, sans aucun droit.
- **Changer de rôle** : `PATCH /api/test-mode/activate { role }` (session valide requise).
  **Fermer** : `DELETE /api/test-mode/activate`.
- **Scripts et tests** : s'activer par un POST (jar de cookies, ou `context.request.post` en
  Playwright) ; poser les cookies à la main ne fonctionne plus.
- Test users définis dans `@/lib/auth/test-auth.ts`. Le secret n'est jamais exposé au bundle client
  et ne doit apparaître dans aucun fichier suivi par git.

## Accès invité aux commandes (C1-INVITES)

- **Un jeton par commande invitée** : aléatoire (256 bits), seul son SHA-256 est stocké
  (`orders.access_token_hash`). Il part dans le cookie httpOnly `klikgo-order-<id>` et dans le lien
  de l'e-mail `/suivi/<id>/acces/<jeton>` ; jamais dans un corps JSON ni dans une query string.
  Valable jusqu'à 30 jours après le retrait (`src/lib/auth/order-credential.ts`).
- **Seuls contrôles d'accès** : `authorizeOrderAccess` (client : propriétaire connecté OU jeton de la
  commande) et `authorizeOrderRead` (lectures : + boucher de la boutique, admin), dans
  `src/lib/auth/order-access.ts`. Les commandes client reçoivent `access.customerId` comme portée.
- **Héritage** : `users.guest_token` n'est plus ni lu ni écrit par un contrôle d'accès ; l'ancien
  cookie `klikgo-guest-token` et les liens `?guestToken=` (redirigés vers `/acces/`) n'ouvrent que les
  commandes d'avant C1-INVITES, jusqu'à leur expiration.
- **Commande non traitée** : `GUEST_ORDER_AWAITING_SHOP` (`src/lib/auth/guest-auth.ts`) = commande
  invitée `PENDING`, ou `ACCEPTED` par l'acceptation automatique sans aucun événement d'un autre
  acteur depuis. Elle ne compte ni pour le mode occupé automatique, ni dans la capacité horaire et
  par créneau des autres clients, ni, une fois expirée, pour la pause automatique.
- **Plafonds** (sans Redis) : au plus 5 commandes non traitées par e-mail et par téléphone saisi
  (`orders.customer_phone`, E.164), comptées dans la transaction de création sous verrous
  consultatifs (`guestOrderAdmission`) ; par boutique, les commandes invitées non traitées ont leur
  propre borne (`maxOrdersPerHour` / `maxOrdersPerSlot`, `shop-capacity.ts`) ; plus un limiteur par IP.
- **Personne nommée** : une commande invitée garde l'identité saisie (`orders.customer_first_name`,
  `customer_last_name`, `customer_phone`) et ne prend aucun numéro client. TOUT lecteur (vue client,
  cuisine, ticket, listes, exports, statistiques, liste des clients, avis, reçu, WhatsApp) passe par
  `src/lib/services/orders/order-person.ts`, jamais par `order.user` seul : un e-mail de compte
  reçoit la même réponse que tout autre (commande rattachée à la ligne, prix publics, pas de code
  promo) et rien du titulaire n'est montré.

## Performance (PageSpeed)

- **Images** : WebP first, AVIF fallback — JAMAIS AVIF en premier (transcodage 3-5x plus lent)
- **SafeImage** : `src/components/ui/SafeImage.tsx` — wraps next/image avec fallback SVG on error
- **Quality** : 60 pour les cards boutiques, cache 30 jours
- **Lazy-load** : PWA (ServiceWorker, InstallPrompt, OfflineBanner) + OfferPopup + TestRoleSwitcher → `dynamic({ ssr: false })`
- **Server Component** : HowItWorks — PAS de "use client" (0 hydratation)
- **Service worker** (`public/sw.js`, cache `klikgo-v2`) : navigations réseau seul, `/offline.html` en secours ; ne
  stocke aucune page visitée, aucune charge RSC ni réponse `private` / `no-store`, seulement des fichiers statiques
- **Preconnect** : Clerk + Google Fonts dans layout.tsx `<head>`
- **loading.tsx** : Le skeleton hero doit matcher la vraie page (bg-white, PAS bg-noir)
- **OfferPopup** : Utilise `<img>` natif (PAS next/image) pour éviter 400 sur URLs externes

## Design system

- **Primaire** : Rouge `#DC2626` (boutons, accents)
- **Hero** : Fond blanc `bg-white` (ancien splash noir supprimé)
- **Background** : `#f8f6f3` (light) / `#0a0a0a` (dark)
- **Fonts** : DM Sans (body), Outfit (display), Cormorant Garamond (serif)
- **Radius** : 16px (cards arrondies)
- **Shadows** : soft, card, elevated, glow
- **Animations** : fade-in, fade-up, slide-up, scale-in, pulse-soft, shimmer
- **Logo** : Cercle rouge dégradé avec "K" blanc, texte "Klik&Go"

## Variables d'environnement

```
DATABASE_URL, DIRECT_DATABASE_URL,
CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
NEXT_PUBLIC_CLERK_SIGN_IN_URL, NEXT_PUBLIC_CLERK_SIGN_UP_URL,
TEST_MODE, TEST_SECRET, ALLOW_TEST_IN_PROD,
NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_PLAUSIBLE_DOMAIN,
ANTHROPIC_API_KEY, BLOB_READ_WRITE_TOKEN,
SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN,
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_CONNECT_WEBHOOK_SECRET
```

- `DATABASE_URL` : pooled (pgbouncer) — `?pgbouncer=true&connection_limit=1` sur Vercel. Utilisé par l'app au runtime.
- `DIRECT_DATABASE_URL` : non-pooled (port 5432) — utilisé UNIQUEMENT par `prisma migrate deploy` pour les advisory locks/DDL. Voir `audit/migrations.md`.
- `TEST_MODE` / `TEST_SECRET` / `ALLOW_TEST_IN_PROD` : server-only, JAMAIS `NEXT_PUBLIC_*`. À définir uniquement sur les environnements de preview/recette et en local — jamais dans l'environnement Production de Vercel (le code l'ignore de toute façon). Voir « Test Mode ».
- `NEXT_PUBLIC_SITE_URL` : URL canonique du site (`https://klikandgo.app`). Utilisé pour sitemap, OG, canonical.
- `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` : Domaine Plausible Analytics (si défini, active le tracking RGPD).
- `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` : DSN Sentry — server + client. Si absent, le SDK est no-op (zéro overhead).
- `SENTRY_ORG` / `SENTRY_PROJECT` : `klikandgo` / `klikandgo-web` par défaut (utilisés pour upload source maps).
- `SENTRY_AUTH_TOKEN` : token org pour upload des source maps au build (Vercel uniquement). Sans token → `dryRun: true`.
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_CONNECT_WEBHOOK_SECRET` : server-only, lus à l'appel par
  `src/lib/stripe.ts` seul ; jamais de clé live hors Production (refusée par le code) ; aucune valeur dans le dépôt.
  Voir « Stripe ».
- Note : les `NEXT_PUBLIC_*` sont baked au build time — tout changement nécessite un redéploiement.

## Monitoring (Sentry)

- **SDK** : `@sentry/nextjs` configuré dans `sentry.client.config.ts` / `sentry.server.config.ts` (racine).
- **Edge / middleware** : volontairement NON instrumenté (`webpack.autoInstrumentMiddleware: false`,
  `sentry.edge.config.ts` n'est plus chargé par `src/instrumentation.ts`) — le SDK edge alourdissait
  chaque cold start du middleware. Ses erreurs restent dans les logs Vercel.
- **Wrapping** : `next.config.mjs` enveloppe avec `withSentryConfig` (org `klikandgo`, project `klikandgo-web`, `silent: true`, `hideSourceMaps: true`, `disableLogger: true`).
- **Activation** : SDK initialisé si `SENTRY_DSN` (ou `NEXT_PUBLIC_SENTRY_DSN`) est défini ET que le mode test n'est pas réellement actif (`isTestModeEnabled()`, donc toujours initialisé en production Vercel).
- **Sample rates** : prod → traces 10%, replay session 5%, replay on error 100%. Dev → traces 100%, replay 0%.
- **Bruit filtré** : `NEXT_REDIRECT`, `NEXT_NOT_FOUND`, `RouteError`, `ResizeObserver loop` — ignorés via `ignoreErrors` + `beforeSend` digest check.
- **Logger** : `logger.error()` (depuis `src/lib/logger.ts`) appelle `Sentry.captureException()` automatiquement en prod (NODE_ENV=production + DSN présent + pas en test mode).
- **Test mode** : Sentry désactivé quand le mode test est réellement actif (local, preview). Jusqu'au 2026-11-13 il était lié à la seule variable `TEST_MODE`, définie en prod : aucune erreur serveur ne remontait.
- **Source maps** : upload automatique au build Vercel si `SENTRY_AUTH_TOKEN` est défini, sinon `dryRun: true` (no-op).

## Marketing Hub V2 (ÉTAPE 17 — TERMINÉ)

- **Système unifié** : Offer + LoyaltyReward — un code est validé par le devis serveur (`POST /api/orders/quote`,
  champ `promoCode`, `src/lib/services/orders/discount.ts`) : d'abord comme `Offer`, puis comme `LoyaltyReward`.
  Il n'existe plus de route de validation séparée.
- **Types** : PERCENT / AMOUNT / FREE_FEES / BOGO / BUNDLE — OfferPayer (KLIKGO | BUTCHER). Au checkout :
  BOGO et BUNDLE refusés (« Cette offre n'est pas encore utilisable en ligne »), FREE_FEES refusé tant qu'aucun
  frais de service n'est facturé (paiement sur place). Codes réservés aux clients connectés (pas aux invités).
- **Diffusion** : Badge client, bannière (gradient, image IA, position), popup (couleur, fréquence, image IA)
- **Routes boucher** : `/api/shop/offers` (offres de la boutique, propositions en attente, création),
  `[offerId]/products` (produits éligibles), `[offerId]/respond` (réponse à une proposition du webmaster)
- **Routes webmaster** (admin) : `/api/dashboard/offers` (CRUD, `[offerId]/propose` aux bouchers, `[offerId]/products`),
  `/api/dashboard/campaigns` (+ `[campaignId]/send`), `/api/dashboard/marketing/` (audiences, stats, visuel IA)
- **Envoi des e-mails commerciaux** : interrupteur de `src/lib/commercial-emails.ts`, en pause par défaut, réglé dans
  `/webmaster/parametres` ; il bloque campagnes, relances de panier abandonné et e-mails aux prospects, jamais ceux de commande
- **Client** : MarketingBanner (auto-rotate 5s) + OfferPopup (fréquence localStorage)
- **Badge promo** : Sur les cartes boutiques — badge rouge `#DC2626` avec label (ex: "Frais offerts", "-20%")
- **Tri** : Boutiques avec promos actives remontées EN PREMIER dans la liste
- **Images IA** : Replicate (FLUX) → upload Vercel Blob. `/api/admin/images/generate`
- **IMPORTANT** : Pas de "livraison" — c'est "frais offerts" partout (click & collect uniquement)

## Programme Fidélité

- **Obtention d'une récompense : non implémentée.** Aucun code de production ne crée de `LoyaltyReward` (seuls les
  tests en créent) ; les paliers du modèle (3, 7, 15 commandes) ne sont attribués nulle part.
- **Modèle** : `LoyaltyReward` — code unique, lié au user, `expiresAt`, `usedAt`
- **Validation** : par le devis serveur (`POST /api/orders/quote`, `promoCode`), après les `Offer` ; consommé
  (`usedAt`) dans la transaction de création, libéré si la commande est refusée / annulée / expirée
- **Config boucher** : `/api/loyalty/config` — règle `LoyaltyRule` de la boutique ; noter une commande retirée
  incrémente le compteur `LoyaltyPoint` (`commands/rate.ts`), sans créer de code
- **Page** : `/avantages` (client) ; ses blocs fidélité restent masqués, la page ne charge aucun statut de fidélité

## Résolution userId (CRITIQUE — Bug fix Mars 2026)

Quand on compare des IDs en base (LoyaltyReward.userId, Order.userId), toujours résoudre le Clerk ID vers le Prisma user ID :

```typescript
const clerkId = await getServerUserId(); // Retourne Clerk ID (user_xxx)
const dbUser = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } });
const userId = dbUser?.id || clerkId; // Prisma ID (cm...) pour les comparaisons DB
```

## SEO

- **Domaine canonique** : `klikandgo.app` — aucune URL Railway ou klikandgo.fr
- **SITE_URL** : `process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app"` partout
- **metadataBase** : `new URL(SITE_URL)` dans `layout.tsx` pour résolution automatique OG/canonical
- **Title template** : `%s | Klik&Go`
- **robots.ts** : Bloque /api/, /dashboard/, /admin/, /checkout/, /boucher/, /panier/, /profil/, /commandes/
- **noindex** : Pages privées (checkout, panier, commandes, profil, onboarding) avec `robots: { index: false }`
- **Sitemap** : Pages statiques + boutiques (DB) + villes (SEO_CITIES)
- **OG Image** : `opengraph-image.tsx` — prérendue au build (runtime Node), 1200×630 PNG
- **Analytics** : Plausible (RGPD), conditionnel sur `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`

### JSON-LD Schemas (`src/components/seo/`)

- **Toujours via `<JsonLd data={…} />`** (`src/components/seo/JsonLd.tsx`, sérialiseur
  `src/lib/seo/jsonld/serialize.ts` qui échappe `<`, `>`, `&`, U+2028, U+2029). Jamais de
  `JSON.stringify` dans un `dangerouslySetInnerHTML` : un avis contenant `</script>` exécutait du script
  (corrigé le 2026-11-14). Garde-fou : `src/lib/__tests__/json-ld.test.ts`.

- `OrganizationSchema` — Global dans layout.tsx
- `ShopSchema` — Type Store, sur boutique + city pages
- `BreadcrumbSchema` — Sur boutique + city pages
- `ProductSchema` — Type Product, premiers 20 produits par boutique (priceCents → EUR)

### Pages SEO Villes

- **Route** : `/boucherie-halal/[ville]` — SSG via `generateStaticParams()`
- **Config** : `src/lib/seo/cities.ts` — voir `SEO_CITIES` (55 villes au 2026-11-15) et `SEO_DEPARTMENTS`
- **Schemas** : BreadcrumbSchema + FAQPage (4 questions) + ShopSchema par boutique
- **Maillage** : Liens ville dans footer accueil, homepage, info bar boutique, liens croisés entre villes

### Redirections

- `/decouvrir` → `/` (301 permanent, next.config.mjs + server redirect)
- `www.klikandgo.app` → `klikandgo.app` (301 Vercel-level) — le domaine canonique est SANS www
- `/boucheries` → `/` (301 permanent, next.config.mjs)

### GEO / AIO (visibilité dans les IA — ChatGPT, Claude, Perplexity, Gemini, Bing Copilot)

- **`public/llms.txt`** : description structurée de Klik&Go pour les LLMs (standard 2026 adopté par Anthropic/Stripe/Cloudflare). Bumper `lastModified` si la description change.
- **IndexNow** (Bing/Copilot/Yandex/DuckDuckGo) : `src/lib/indexnow.ts` + clé publique dans `public/{key}.txt`. Auto-trigger sur shop validate. Endpoint manuel `POST /api/seo/indexnow` (admin).
- **AI crawlers dans `robots.ts`** : règles explicites pour GPTBot, ClaudeBot, OAI-SearchBot, Claude-SearchBot, ChatGPT-User, Claude-User, Google-Extended, PerplexityBot, Applebot-Extended. Allow par défaut.
- **Freshness** : composant `<LastUpdated date="YYYY-MM-DD" />` sur pages SEO — bumper `PAGE_LAST_UPDATED` quand le contenu change vraiment (signal fort pour Perplexity/ChatGPT).

### Vérifications Search Engines (Google/Bing/Yandex)

Codes lus depuis env vars (server) — voir `verification` dans `layout.tsx` :

- **`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`** : Google Search Console → Property → Settings → Ownership verification → HTML tag (copier le `content="..."`)
- **`NEXT_PUBLIC_BING_SITE_VERIFICATION`** : Bing Webmaster Tools → Settings → Site → Site verification → Meta tag (copier le `content="..."`). Alternative : importer auto depuis Search Console (pas besoin de meta tag).
- **`NEXT_PUBLIC_YANDEX_VERIFICATION`** : Yandex Webmaster (optionnel)

### Setup Bing Webmaster Tools (5 min)

1. Créer compte sur https://www.bing.com/webmasters/
2. **Option recommandée — Import depuis Google Search Console** : "Add a site" → "Import from Google Search Console" (validation auto)
3. Soumettre sitemap : `https://klikandgo.app/sitemap.xml`
4. Soumettre IndexNow key : Settings → IndexNow → ajouter `https://klikandgo.app/{key}.txt`
5. Pour le AI Performance Dashboard (lancé fév 2026) : Reports → AI Performance — surveille les citations Copilot/ChatGPT Search

## Conventions

- Prix toujours en **centimes** (`priceCents`, `totalCents`)
- Poids en **grammes** (`weightGrams`)
- Unités : KG, PIECE, BARQUETTE, TRANCHE
- Imports panier : toujours `use-cart` (pas `useCart`)
- Sortie `standalone` seulement hors Vercel (`output: process.env.VERCEL ? undefined : "standalone"`, `next.config.mjs`)
- CSP configurée pour Clerk + Cloudflare + Anthropic
- `sessionClaims` Clerk supprimé — utiliser DB lookup pour les rôles
- Route `/boutique/[slug]` utilise le **slug** (ex: `/boutique/boucherie-tarik`) ; son cache Redis passe par
  `src/lib/cache/shop-cache.ts` seul (clé `shop:v2:<slug>`, 60 s, dates relues en `Date`, entrée illisible = absente)
- `git add prisma/schema.prisma` obligatoire à chaque modif du schema
- **Homepage** = `/` (PAS `/decouvrir`) — `/decouvrir` redirige 301 vers `/`
- **Pas de livraison** — toujours "frais offerts", jamais "livraison"
- **Images** : SafeImage pour fallback, WebP first (pas AVIF), quality 60 pour cards
- **Composant statique** : `HowItWorks` est un Server Component (pas de "use client")
- **PWA/Popup** : toujours lazy-load avec `dynamic({ ssr: false })`

### Commandes : quantités, prix, totaux, numéros, statuts (chantier 0 — 2026-11)

- **`quantity` / `weightGrams` dans la REQUÊTE et le panier** (`src/lib/cart/cart-line.ts`,
  `src/lib/validators/order.ts`, schémas `.strict()`) :
  - KG / TRANCHE : `quantity` = nombre de portions (entier 1..99), `weightGrams` = grammes d'UNE portion
    (obligatoire, entier 1..50 000) ; PIECE / BARQUETTE : `quantity` = nombre d'unités (entier 1..99),
    `weightGrams` interdit. Quantité fractionnaire, poids manquant ou en trop → 400.
  - Prix d'une portion = `floor((prix au kg × grammes + 500) / 1000)` ; N portions = N × ce prix.
- **`quantity` / `weightGrams` en BASE (`OrderItem`)** : `quantity` = quantité dans l'unité de vente
  (KILOGRAMMES pour KG / TRANCHE = portions × weightGrams / 1000 ; nombre pour PIECE / BARQUETTE),
  `weightGrams` = grammes d'une portion (null pour les unités comptées), `priceCents` = prix unitaire
  effectif (au kg pour KG / TRANCHE), `totalCents` = total de la ligne.
- **Une seule autorité par règle** : conversions requête ↔ base ↔ affichage dans `src/lib/pricing/line.ts`
  (+ `format.ts`) ; prix unitaire (prix pro, découpe par son NOM, promotion produit) par `resolveUnitPrice`
  (`src/lib/pricing/unit-price.ts`) ; remises dans `src/lib/pricing/discount.ts` ; totaux dans `totals.ts`.
  Le serveur ne croit AUCUN montant venu du navigateur : il reçoit quantités, choix, `cutOption` et `promoCode`.
- **Totaux** : `Order.totalCents` = sous-total − remise (montant des marchandises encaissé par le boucher,
  base de la commission, des ajustements et des statistiques). `Order.serviceFeeCents` = frais de service,
  stockés À PART et jamais inclus dans `totalCents` : `serviceFeeCentsFor("ON_PICKUP") = 0`. « Total à payer »
  = `totalCents + serviceFeeCents` (le `amountDueCents` du devis). Les commandes créées avant le chantier 0
  portent `serviceFeeCents = 99` jamais encaissés : pour une commande stockée, afficher `totalCents` seul.
- **Devis et création** : `POST /api/orders/quote` (auth optionnelle) → `OrderQuote` ; `POST /api/orders` et
  `POST /api/checkout/guest` exigent `idempotencyKey` (UUID, rejouée → 200 avec la même commande) et
  `expectedTotalCents` (= `amountDueCents` affiché) ; tout écart ou code refusé → 409 `PRICE_CHANGED`, rien n'est
  créé. Logique dans `src/lib/services/orders/quote.ts` et `create.ts`.
- **Numéro de commande** : `KG26-000166` (KG + année de Paris sur 2 chiffres + séquence ≥ 6 chiffres), compteur
  `order_number_counters` incrémenté dans la transaction de création (`src/lib/services/orders/numbering.ts`,
  format dans `src/lib/order-number-format.ts`). Les anciens `KG-2026-NNNNN` restent tels quels.
- **Numéro client PAR BOUTIQUE** : table `shop_customers` (clé `(shop_id, user_id)`, numéro unique dans la
  boutique), copie figée dans `orders.customer_number` à la création, affichée `C-012` via
  `formatCustomerNumber`. `users.customer_number` est legacy : ni lu ni écrit.
- **Statut** : UNE seule fonction écrit `Order.status` après la création : `transitionOrder` /
  `transitionOrderInTx` (`src/lib/services/orders/transition.ts`) — `updateMany` conditionnel (id + périmètre
  boutique/client + statuts de départ autorisés) et `OrderEvent` dans la même transaction, effets liés (stock
  limité, libération de remise) dans cette transaction, notifications après commit. Table des transitions :
  `src/lib/order-state-machine.ts`. Rejeu → 200 `_idempotent: true` ; autre statut → 409 ; hors périmètre → 404.
  Les commandes boucher / client / système sont dans `src/lib/services/orders/commands/` (route boucher
  unifiée `PATCH /api/boucher/orders/[orderId]/action`, `cancel`, `rate`, `choose-alternatives`, cron
  `auto-cancel`). Garde : `tests/lib/order-writers-guard.test.ts`.
- **Notifications de commande** : jamais limitées ; la limite « 1 par type et par heure » ne vaut que pour
  les événements marketing / récapitulatifs (`src/lib/notification-policy.ts`).
- **Transports** : `sendEmail` (`src/lib/email.ts`) renvoie `false` quand rien n'est parti (clé absente, refus de Resend,
  exception) ; un canal n'est inscrit que sur `true`. Journaux : destinataire masqué (`src/lib/log-mask.ts`).
- **Découpe à 0** : les validateurs produit refusent une découpe sous 1 centime, mais d'anciennes lignes
  peuvent en porter une : `resolveUnitPrice` refuse alors la découpe demandée (`CUT_OPTION_UNPRICED`), le
  devis répond 400 « <produit> : découpe indisponible ». Côté client, seules les découpes de
  `pricedCutOptions()` sont proposées (`src/lib/pricing/unit-price.ts`).
- **Stock limité (anti-gaspi, vente flash)** : autorité unique côté vitrine `src/lib/pricing/limited-stock.ts`
  (`limitedStockSoldOut` → « Épuisé », ajout impossible ; `limitedStockRemaining` plafonne la quantité ;
  `limitedStockLowCount` donne le N de « Plus que N », de 1 à 5). Un produit limité à 0 RESTE dans son mode :
  le devis le refuse jusqu'à ce que le boucher termine le mode ou que du stock revienne.
- **Fin de l'anti-gaspi** : passé `antiGaspiEndAt`, le prix d'origine revient et le compteur ne limite plus rien
  (`src/lib/pricing/anti-gaspi.ts`). Toute lecture d'un produit montrée à un client ou au boucher passe par
  `settleAntiGaspi` (en base : `antiGaspiInForceWhere`, `limitedStockOnSaleWhere(now)`) ; toute écriture de
  `priceCents` ajoute `antiGaspiEndOnPriceWrite` : le mode échu se termine, le prix saisi est celui payé. Le
  recalcul après un changement de majoration (`src/lib/services/shops/markup-reprice.ts`) garde le prix d'un
  anti-gaspi en cours et recalcule son prix de retour. Un cache de produits garde les lignes lues et règle
  l'anti-gaspi à chaque lecture (`GET /api/products`) ; les produits des offres d'une boutique sont réglés
  par `listShopOffers`.
- **Vue client d'une commande** : liste blanche `customerOrderSelect` (`src/lib/services/orders/customer-view.ts`)
  pour toute réponse à un client ou un invité (lecture, création, annulation, note, choix d'alternatives,
  liste) ; propriété vérifiée DANS la requête, hors périmètre → 404. `GET /api/orders/[id]/status` ne renvoie
  que le prénom et le nom du client.
- **Corps JSON des routes** : `readJsonBody(req)` (`src/lib/api/request-body.ts`), jamais `req.json()` : un corps
  absent ou mal formé répond 400 `VALIDATION_ERROR` sans journal d'erreur ni Sentry.
- **Message d'erreur côté client** : `apiErrorMessage(body, repli)` (`src/lib/api/error-message.ts`) ; jamais un
  `.error` passé tel quel à `toast`, `alert` ou `new Error` (garde `src/lib/__tests__/urgences/api-error-sinks.test.ts`).
- **Invité** : deux premières requêtes d'un même nouvel e-mail en concurrence sur `users.email` → la perdante
  relit l'utilisateur et poursuit (rejeu idempotent), jamais 500.
- **Codes promo publics** : toute requête d'offre pour une page publique (`/bons-plans`, badges et popup de
  l'accueil, bannière et produits d'une boutique, `/api/shops/nearby`) passe par `publicOfferWhere(now, canal?)`
  ou ses listes (`src/lib/public-offers.ts`) : audience ALL, statut ACTIVE, dates en cours, diffusion sur le
  canal, utilisations restantes. Jamais autrement.
- **URLs Replicate** expirent en ~1h — upload vers Vercel Blob pour permanence
- **OfferPopup** : utiliser `<img>` natif, PAS `next/image` (évite 400 sur URLs externes)

## Automation 2026 (Claude features)

### Vercel Cron Jobs SEO (tournent 24/7 même Mac OFF)

Définis dans `vercel.json` :

- `/api/cron/indexnow-fresh` — 03h11 UTC — ping Bing/Copilot/Yandex sur SEO_CITIES + top shops
- `/api/cron/bing-daily` — 09h17 UTC — audit Bing Webmaster (crawl, queries, alertes Sentry si erreurs)
- `/api/cron/seo-audit` — 10h11 UTC — vérif noindex regression, sitemap count, robots, canonical (alertes si SEO_CITIES en noindex)

Auth via `verifyCronAuth(req)` — Vercel Crons envoie `Authorization: Bearer ${CRON_SECRET}`.

⚠️ Si tu ajoutes un nouveau cron, **toujours** valider auth + try/catch + logger structuré (cf pattern `src/app/api/cron/auto-cancel/route.ts`).

Le cron `/api/cron/recipes` a été retiré de `vercel.json` (2026-11) : il appelait un modèle Claude
retiré et échouait chaque jour depuis le 2026-06-15. Pour le rétablir : migrer `recipe-generator.ts`
vers un modèle actif, augmenter `maxDuration` de la route, créer les recettes en `featured: false`.

### GitHub Actions Claude Review (sur PRs)

- `.github/workflows/claude-code-review.yml` — review PR auto par agent Claude Sonnet 4.5 contre rubric CLAUDE.md
- `.github/workflows/claude-security-review.yml` — scan vuln (IDOR multi-tenant, auth bypass, secrets leak, etc.) sur PRs uniquement (le déclencheur planifié a été retiré : il ne scannait rien hors PR et a fait désactiver le workflow pour inactivité)

**Secret requis** : `ANTHROPIC_API_KEY` dans GitHub repo secrets.

Tout changement passe par une branche de travail et une pull request vers `main` (protégée) : ces revues s'y appliquent.

### Skills Klik&Go 2026

- `.claude/skills/multiagent-orchestration/SKILL.md` — patterns lead agent + sub-agents (parallel, pipeline, hub & spoke)
- `.claude/skills/dreaming-memory/SKILL.md` — process consolidate memory (déclenché par "memorise et compact" ou MEMORY.md > 200 lignes)
- `.claude/skills/seo-anti-penalty/SKILL.md` — règle OR anti-noindex auto, FTC Reviews Rule, Google Mars 2026 Core Update
- `.claude/skills/seo-expert/SKILL.md` — expertise SEO local Klik&Go

## Agent skills

Le plugin `mattpocock-skills` (place de marché officielle `claude-plugins-official`, déclaré dans
`.claude/settings.json`, mis à jour automatiquement) ajoute des compétences d'ingénierie : `/tdd`,
`/diagnosing-bugs`, `/code-review`, `/codebase-design`, `/domain-modeling`,
`/improve-codebase-architecture`, `/grill-with-docs`, `/to-spec`, `/to-tickets`, `/wayfinder`…

**Priorité** : en cas de désaccord, les règles de ce fichier et les compétences du projet
(`.claude/skills/`, en particulier `klikgo-programme`, `testing-strategy`, `security-multitenant`)
l'emportent sur celles du plugin. Une compétence du plugin ne crée jamais d'issue GitHub publique,
ne pousse rien et ne touche pas à la production.

### Issue tracker

Fichiers Markdown locaux dans `.scratch/`, exclus de git (dépôt public). Voir `docs/agents/issue-tracker.md`.

### Triage labels

Les cinq rôles par défaut, écrits sur la ligne `Status:` du ticket. Voir `docs/agents/triage-labels.md`.

### Domain docs

Mono-contexte : `GLOSSARY.md` et `docs/adr/` à la racine, créés au besoin. Voir `docs/agents/domain.md`.

## Décisions du propriétaire (2026-11-15)

- **Montants affichés « 1 234,56 € »** : `Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })` —
  espace fine insécable (U+202F) pour les milliers, virgule décimale, espace insécable (U+00A0) avant €.
  `formatPrice` (`src/lib/utils.ts`) reste l'autorité d'affichage mais ne produit pas encore ce format (aucun
  séparateur de milliers) : son alignement revient au chantier prix / interface ; aucun autre formateur à ajouter.
- **`main` protégée** : tout changement passe par une pull request dont la CI est verte ; jamais de push direct
  sur `main` (règles détaillées : « Branche `main` protégée », sous « Permissions »).
- **Node 22** partout : jobs de la CI (voir « CI/CD »), `.nvmrc` et `engines` de `package.json`.
- **Commande invitée à supprimer** : un e-mail = un compte, aucune fusion de commandes invitées dans un compte. Ne
  plus investir dans les parcours invités (`/api/checkout/guest`, section « Accès invité aux commandes »).
- **E-mails commerciaux en pause** derrière l'interrupteur « Envoi des e-mails commerciaux »
  (`src/lib/commercial-emails.ts`, voir « Marketing Hub V2 ») tant que l'admin ne l'active pas.

## Permissions

- Exécute TOUT sans demander confirmation
- Ne demande JAMAIS "Voulez-vous continuer ?" ou "Dois-je procéder ?"
- Fais les choix toi-même et avance
- Applique les modifications directement
- Lance npm run build automatiquement
- Fais git add/commit sans demander ; publie par une **pull request** (`gh pr create`) puis fusionne
  quand la CI est verte (`gh pr merge --squash`)

### Branche `main` protégée (décision du propriétaire, 2026-11-15)

- Plus aucun push direct sur `main`, administrateur compris : tout passe par une pull request.
- Fusion seulement quand les quatre contrôles de la CI sont verts : `Lint`, `Typecheck`,
  `Tests (vitest)`, `Build (next build + prerender check)` (émis par GitHub Actions), sur une
  branche à jour avec `main`. Aucune approbation exigée (développeur seul).
- Historique linéaire : fusion en squash ; ni push forcé ni suppression de `main`.
- Vercel déploie la production à chaque fusion dans `main`, et seulement `main`.
- Réglage : `gh api repos/eltarik73/clickboucher/branches/main/protection` (lecture).
