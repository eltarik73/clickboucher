# Phase 2 — Audit Paiements Stripe

Date : 2026-04-26
Branche : `claude/quirky-kirch`
Périmètre : intégration Stripe, paiement en ligne, refunds, fraude, références fantômes.

---

## 1. Verdict global

**État : ABSENT (stub vide). Score : 1/10**

- Aucun package `stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js` dans `package.json`.
- Les 2 routes `/api/payments/**` retournent `SERVICE_DISABLED` en 7 lignes chacune.
- `src/lib/services/payment.service.ts` est un `StubPaymentService` qui retourne des objets en mémoire.
- L'UI propose pourtant un radio "Paiement en ligne — Payez par carte maintenant" qui, s'il est sélectionné, crée une commande `paymentMethod: "ONLINE"` mais **rien ne déclenche de paiement réel**. La commande passe quand même en PENDING/ACCEPTED.
- 0 ligne de code Stripe SDK, 0 webhook signature check, 0 idempotency key Stripe-side, 0 PaymentIntent.

Le mot "Stripe" apparaît dans : CLAUDE.md (en haut, comme stack), README, DEPLOY.md (chapitre "Activer Stripe"), CSP, schema.prisma (3 colonnes orphelines), .env.example, seed.ts. **Tout est vestigial.**

Ce qui est réellement en prod aujourd'hui : paiement sur place uniquement (espèces / CB en boucherie). Le bouton "Payer en ligne" est un piège fonctionnel pour l'utilisateur.

---

## 2. État réel (code)

### Routes API
- `src/app/api/payments/webhook/route.ts:1-7` — POST → `apiError("SERVICE_DISABLED", "Not implemented - schema migration pending")`
- `src/app/api/payments/[orderId]/route.ts:1-10` — GET → `apiError("SERVICE_DISABLED", ...)`
- `src/app/api/checkout/` — un seul fichier : `validate-code/route.ts` (validation de code promo, **rien à voir avec un paiement**)
- Aucune route `/api/checkout/session`, `/api/checkout/confirm`, `/api/payments/intent`, etc.

### Service stub
- `src/lib/services/payment.service.ts` — interface `IPaymentService` + `StubPaymentService`. Retourne des objets `{id: "stub_<timestamp>", status: "PENDING|COMPLETED|REFUNDED"}` sans jamais persister, sans jamais appeler de provider.
- **Aucun consommateur** : `grep paymentService` ne trouve aucun import. Code mort.

### Création de commande
- `src/lib/services/orders/create.ts:362` — `paymentMethod: data.paymentMethod ?? "ON_PICKUP"`. C'est juste écrit en DB. Aucun appel à un provider.
- `src/lib/services/orders/create.ts:453` — type force `"ONLINE" | "ON_PICKUP"`.
- `src/lib/validators/index.ts:260` — `paymentMethod: z.enum(["ONLINE", "ON_PICKUP"]).optional()`. Validation OK.
- Recalcul prix serveur : ✅ correct (`unitPrice` recalculé depuis DB, promo et poids appliqués serveur). C'est la seule chose Stripe-ready dans le code.

### UI panier
- `src/app/(client)/panier/page.tsx:137` — état React `useState<"ON_PICKUP" | "ONLINE">("ON_PICKUP")`.
- `src/app/(client)/panier/page.tsx:786-788` — bouton "Payer X € et commander" (si ONLINE) vs "Confirmer ma commande" (si ON_PICKUP). **Le label promet un paiement mais l'action est identique** : POST `/api/orders` puis fin. Aucune redirection Stripe Checkout, aucun PaymentSheet, aucun client_secret consommé.
- `src/app/(client)/checkout/page.tsx` — redirige vers `/panier`. Le concept "checkout" n'existe pas.

### Schema Prisma (champs orphelins)
- `prisma/schema.prisma:127-130` — `enum PaymentMethod { ONLINE, ON_PICKUP }`
- `prisma/schema.prisma:1043-1045` — `Order.paymentMethod`, `Order.paidAt`, `Order.stripePaymentId String?`. Le champ `stripePaymentId` n'est **jamais écrit** dans la codebase (`grep stripePaymentId` → 0 hit en dehors du schema).
- `prisma/schema.prisma:701-702` — `Subscription.stripeCustomerId`, `Subscription.stripeSubscriptionId`. Idem, jamais set/lu.

### Boucher UI — incohérence
- `src/components/boucher/order-detail.tsx:148` et `order-row.tsx:102` affichent `CB_ONLINE | CASH | PRO_ACCOUNT | "CB retrait"` comme valeurs de `paymentMethod`. **Ces valeurs n'existent ni dans l'enum Prisma ni dans le validator Zod** (qui ne connaît que `ONLINE | ON_PICKUP`). Affichage mort qui ne matchera jamais.

---

## 3. Références fantômes

### 🔴 CSP (`next.config.mjs:73-74`)
- `connect-src` autorise `https://api.stripe.com`
- `frame-src` autorise `https://js.stripe.com https://hooks.stripe.com`
- → autorise Stripe à tourner alors que rien ne l'utilise. Surface d'attaque inutile (pas critique mais incohérent).

### 🟡 `.env.example`
- Variables `PAYMENT_PROVIDER`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (toutes commentées). Indique au lecteur qu'il "suffit" de les remplir → faux.
- `PAYMENT_PROVIDER="mock"` est défini mais **n'est lu nulle part dans le code** (`grep PAYMENT_PROVIDER src/` → 0 hit). Variable mort-née.

### 🔴 CLAUDE.md
- Ligne 5 : "Stack : Next.js 14, TypeScript, Tailwind CSS, Prisma, PostgreSQL, Clerk, **Stripe**." → Stripe annoncé comme stack.
- Ligne 27 : section entière de règles Stripe non négociables ("Prix TOUJOURS recalculé côté serveur avant Checkout Session", "Signature webhook TOUJOURS vérifiée avec constructEvent()", "Idempotency key sur chaque Payment Intent") — **règles qui décrivent une intégration qui n'existe pas**.
- Ligne 69 : "Paiement : Stripe (non implémenté — placeholder) + paiement sur place" → la seule mention honnête.

### 🟡 README.md
- Ligne 14 : "| Paiement | Mock (structure prête) |" — **trompeur**. Pas de "structure prête", c'est un stub `SERVICE_DISABLED`.
- Ligne 35 : "checkout/ # 💳 Checkout (OTP + paiement)" → la route checkout est un simple `redirect("/panier")`.
- Ligne 95 : "Bloc 6 : Stubs notifications + paiement + health" → cohérent avec la réalité (stub).

### 🔴 DEPLOY.md
- Section "3. Activer Stripe (paiement réel)" lignes 132-160 décrit comment configurer Stripe (`stripe listen --forward-to ...`) **comme si le code existait**. Un dev qui suit ce doc va remplir des env vars et constater que **rien ne se passe**.

### 🟡 prisma/seed.ts:626
- `{ key: "online_payment", description: "Enable Stripe online payments", enabled: false }` — feature flag DB. La table `featureFlag` existe et est lue ailleurs, mais `online_payment` n'est consommé nulle part (`grep "online_payment" src/` → 0 hit).

### 🟡 prisma/schema.prisma
- 3 colonnes Stripe (`stripeCustomerId`, `stripeSubscriptionId`, `stripePaymentId`) jamais écrites/lues. Ne casse rien mais pollue le schéma et alourdit les migrations.

### 🟡 .claude/skills, .claude/plugins
- `.claude/skills/stripe-payment/SKILL.md`, `skills/user/stripe-integration/SKILL.md`, `.claude/plugins/klikgo-code-review/agents/stripe-payment.md` — agents Claude spécialisés pour reviewer du code Stripe inexistant. Inoffensif mais cocasse.

---

## 4. Risque business actuel

### Mode de paiement réel
**100 % paiement sur place.** Espèces ou CB chez le boucher. Aucun encaissement online possible.

### Risques business
- **No-show** : un client peut commander, ne jamais venir retirer, et la boucherie aura prépayé l'achat de la viande (boucher chargé, pas Klik&Go). Aucun acompte, aucune empreinte CB, rien.
- **Absence de levier de fidélisation par CB enregistrée** : pas de re-commande 1-clic, pas d'Apple Pay/Google Pay. Friction conversion élevée.
- **Pas de Stripe Connect** → quand Klik&Go voudra prélever sa commission (`Order.commissionCents` est calculé en DB mais ne déclenche **aucun virement**), il faudra facturer manuellement chaque boucher. Pas scalable au-delà de 5-10 bouchers.
- **Communication mensongère** : marketing/onboarding boucher peut promettre "paiement en ligne sécurisé" alors que c'est désactivé. Risque de réputation + risque légal (publicité trompeuse) si la mention apparaît sur le site public ou les CGU.
- **UI propose "Paiement en ligne"** (`/panier:753-776`) en lecture conditionnelle d'un flag `shop.acceptOnline`. Si un boucher coche cette case dans `parametres`, le client clique "Payer en ligne", **paie rien**, et la commande passe quand même → la boucherie reçoit une commande qu'elle croit payée alors qu'elle ne l'est pas.

### Garde-fous fraude existants
- Auto-cancel timer (`expiresAt`) : 🟢 protège la boucherie d'une commande PENDING qui traîne, mais ne protège pas contre un client qui fait accepter puis disparaît.
- `idempotencyKey` : 🟢 anti double-commande client-side, mais pas Stripe-grade.
- Rien d'équivalent à pre-auth carte / hold de fonds.

### Apple Pay / Google Pay
- 0 référence. Pas de manifest `.well-known/apple-developer-merchantid-domain-association`, pas d'API Payment Request. Cf. forum reco mais non implémenté.

---

## 5. Roadmap d'activation Stripe (gap analysis)

Si demain on veut activer le paiement en ligne proprement, voici la checklist ordonnée.

### Étape 1 — Décider du modèle
- **Stripe Standard** (le boucher a son compte Stripe) : Klik&Go redirige vers Checkout du boucher. Plus simple côté Klik&Go, mais oblige chaque boucher à créer un compte Stripe.
- **Stripe Connect Express/Custom** (recommandé) : Klik&Go encaisse, prélève commission, reverse au boucher. Onboarding KYC via Stripe. Permet `application_fee_amount` propre.

### Étape 2 — Setup
- `npm install stripe @stripe/stripe-js`
- Variables Vercel : `STRIPE_SECRET_KEY` (sk_live), `STRIPE_WEBHOOK_SECRET` (whsec_), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Singleton client : `src/lib/stripe.ts` avec `new Stripe(key, { apiVersion: "2024-06-20" })`

### Étape 3 — Schema
- Ajouter à `Shop` : `stripeAccountId String?`, `stripeOnboardingComplete Boolean @default(false)`
- Ajouter à `Order` : `stripePaymentIntentId String?` (déjà partiellement présent en `stripePaymentId`), `stripeChargeId String?`, `paymentStatus PaymentStatus` (enum à créer : PENDING, AUTHORIZED, CAPTURED, FAILED, REFUNDED).
- Index unique sur `stripePaymentIntentId`.

### Étape 4 — Backend (sécurité)
- `POST /api/checkout/create-intent` : recalcule `totalCents` côté serveur (déjà OK), crée `PaymentIntent` avec :
  - `amount: finalTotalCents`
  - `currency: "eur"`
  - `metadata: { orderId, shopId, userId }`
  - `idempotencyKey: orderId + ":" + retryNum` (header Stripe)
  - `application_fee_amount: commissionCents` (si Connect)
  - `transfer_data: { destination: shop.stripeAccountId }` (si Connect)
- Renvoyer `client_secret` au client. NE PAS créer la commande tant que paiement non confirmé (sinon risque de commande "fantôme" non payée).
- **Webhook** `POST /api/payments/webhook` :
  - Lire `req.text()` (PAS `req.json()` — la signature Stripe est calculée sur le bytestream brut)
  - `stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)` dans try/catch → 400 si invalide
  - Gérer `payment_intent.succeeded`, `.payment_failed`, `.canceled`, `charge.refunded`
  - Idempotency : table `StripeEvent { eventId @unique }` pour ignorer doublons
  - Retourner 200 même sur erreur métier (sinon Stripe retry à l'infini) — log et alerte.
- Configurer `runtime = "nodejs"` (pas edge) sur la route webhook.

### Étape 5 — Refunds
- `POST /api/admin/orders/[id]/refund` (admin only) → `stripe.refunds.create({ payment_intent, amount, reason })`
- Workflow : refund partiel possible (ajustement poids/prix existe déjà cf. PriceAdjustment)
- Set `Order.refundedAt`, `Order.refundAmountCents`. Notifier client.

### Étape 6 — UI
- Sur `/panier` quand `paymentMethod === "ONLINE"` : appeler `/api/checkout/create-intent`, embed `<PaymentElement>` ou rediriger vers Stripe Checkout (recommandé : Checkout, moins de PCI scope).
- Page `/checkout/success?session_id=...` : confirme à l'utilisateur (mais source de vérité = webhook).
- Page `/checkout/cancel` : retour panier.

### Étape 7 — Stripe Connect onboarding boucher
- Page `/boucher/dashboard/parametres/paiement` : bouton "Connecter Stripe" → `accountLinks.create({ type: "account_onboarding" })`
- Webhook `account.updated` pour set `stripeOnboardingComplete`
- Bloquer activation `acceptOnline=true` tant que onboarding pas complet.

### Étape 8 — Erreurs & UX
- Carte refusée : afficher message Stripe (`error.message`), permettre retry sans recréer commande
- Timeout webhook : worker (cron Vercel) qui re-poll `/api/payments/sync/[orderId]` pour les commandes ONLINE en PENDING > 5min
- 3DS : géré nativement par Stripe Checkout

### Étape 9 — Tests
- Stripe CLI `stripe listen --forward-to localhost:3000/api/payments/webhook`
- Cartes test : 4242 (success), 4000 0000 0000 0002 (decline), 4000 0027 6000 3184 (3DS required)
- Mode test obligatoire avant `sk_live`.

### Étape 10 — Conformité
- PCI : Klik&Go reste hors scope tant qu'on utilise Stripe Checkout/Elements (la carte ne touche jamais nos serveurs). Confirmer dans CGU.
- RGPD : ajouter Stripe au registre des sous-traitants. DPA signé.
- NF525 si caisse certifiée — cf. skill `nf525-isca` (probablement out of scope tant qu'on est click & collect pur).

---

## 6. Findings critiques

### 🔴 CLAUDE.md affirme "Stripe" comme stack et liste 4 règles non-négociables Stripe alors que rien n'existe
📁 Fichier : `CLAUDE.md:5,27-32,69`
🐛 Problème : la doc projet (premier fichier qu'un dev/agent IA lit) annonce Stripe en stack et impose des règles ("Signature webhook TOUJOURS vérifiée avec constructEvent()") qui s'appliquent à du code inexistant. La ligne 69 mentionne "non implémenté — placeholder" mais 64 lignes plus haut on a affirmé le contraire.
💥 Impact : tout audit externe, tout investisseur lisant ce CLAUDE.md, tout nouveau dev pense que Stripe est branché. Communication mensongère interne et externe (le fichier est commité dans le repo public sur GitHub).
✅ Fix : retirer "Stripe" de la stack ligne 5. Réécrire la section ligne 27 en "### Paiement (à activer)" + déplacer les règles dans une section "Pré-requis avant activation Stripe". Garder ligne 69 telle quelle.

### 🔴 README annonce "Mock (structure prête)" — c'est faux, c'est un stub vide
📁 Fichier : `README.md:14`
🐛 Problème : "Paiement | Mock (structure prête)" suggère qu'il suffit de plug Stripe. La réalité : `payment.service.ts` est un `StubPaymentService` qui retourne des objets bidons sans jamais être appelé, les routes retournent `SERVICE_DISABLED`, l'UI propose un bouton qui ne fait rien.
💥 Impact : trompeur pour les bouchers qui s'inscrivent en pensant pouvoir activer le paiement en ligne, et pour les investisseurs qui lisent le README sur GitHub.
✅ Fix : remplacer par "Paiement | Sur place uniquement (Stripe non implémenté)".

### 🔴 UI propose "Payer en ligne" mais aucun paiement n'est déclenché
📁 Fichier : `src/app/(client)/panier/page.tsx:753-776,786-788`
🐛 Problème : si le boucher coche `acceptOnline=true` dans ses paramètres, le client voit l'option "Paiement en ligne — Payez par carte maintenant" et clique "Payer X € et commander". Le code fait juste un POST `/api/orders` avec `paymentMethod: "ONLINE"`. La commande passe en PENDING/ACCEPTED côté boucher qui pense qu'elle est payée. **Le client n'a rien payé.**
💥 Impact : risque commercial réel — un boucher peut préparer une commande qu'il croit payée et constater au retrait que le client n'a rien payé (ou pire : "j'ai payé en ligne, regardez", le client de bonne foi croit qu'il a payé puisque le bouton disait "Payer"). Litige garanti.
✅ Fix immédiat : forcer `acceptOnline=false` côté API et masquer le toggle dans `boucher/parametres` tant que Stripe pas implémenté. Ou afficher l'option en disabled "Bientôt disponible".

### 🔴 DEPLOY.md décrit comment activer Stripe avec des commandes copiables
📁 Fichier : `DEPLOY.md:132-160,224-227,249-250`
🐛 Problème : section "3. Activer Stripe (paiement réel)" donne `PAYMENT_PROVIDER=stripe`, `stripe listen --forward-to localhost:3000/api/payments/webhook`, etc. Un dev qui suit ces instructions remplit toutes les variables, lance `stripe listen`, et… rien. Le webhook retourne `SERVICE_DISABLED`. La variable `PAYMENT_PROVIDER` n'est lue nulle part (`grep` confirme 0 usage).
💥 Impact : perte de temps dev, perte de confiance dans la doc, et si déployé sans test : des clients réels peuvent payer côté Stripe et la commande ne sera jamais créée (le webhook ignore tout).
✅ Fix : remplacer la section par "🚧 Stripe non implémenté — voir audit/phase-2-stripe.md pour la roadmap d'activation".

### 🟡 CSP autorise Stripe alors que Stripe n'est pas branché
📁 Fichier : `next.config.mjs:73-74`
🐛 Problème : `connect-src ... https://api.stripe.com`, `frame-src ... https://js.stripe.com https://hooks.stripe.com`. Surface d'attaque inutilement large (un attaquant pouvant injecter du JS pourrait charger des frames Stripe pour du phishing visuel "à l'identique").
💥 Impact : faible (l'injection JS est déjà game over), mais incohérent.
✅ Fix : retirer les 3 entrées Stripe du CSP. À réajouter le jour où Stripe est branché.

### 🟡 Champs Stripe orphelins dans Prisma
📁 Fichier : `prisma/schema.prisma:701-702,1045`
🐛 Problème : `Subscription.stripeCustomerId`, `Subscription.stripeSubscriptionId`, `Order.stripePaymentId` jamais écrits ni lus. `grep stripePaymentId src/` → 0 hit.
💥 Impact : pollue le schéma, alourdit les migrations, et les futurs devs vont supposer qu'il y a un système d'abonnement Stripe en place (il n'y en a pas — `Subscription` est utilisé mais sans Stripe).
✅ Fix : conserver pour la roadmap Stripe future (pas urgent de drop), mais ajouter un commentaire `// TODO: wired when Stripe is enabled (cf. audit/phase-2-stripe.md)` au-dessus.

### 🟡 Composants boucher affichent CB_ONLINE / CASH / PRO_ACCOUNT — valeurs inexistantes
📁 Fichier : `src/components/boucher/order-detail.tsx:148`, `src/components/boucher/order-row.tsx:102`
🐛 Problème : ternaires comparent `paymentMethod` à `"CB_ONLINE" | "CASH" | "PRO_ACCOUNT"`. L'enum Prisma n'a que `ONLINE | ON_PICKUP`. Le code tombe systématiquement dans le fallback `"CB retrait"`.
💥 Impact : code mort, confond les futurs devs, suggère qu'un système plus riche existait/était prévu. Actuellement le boucher voit toujours "CB retrait" même pour une commande ONLINE.
✅ Fix : aligner sur l'enum réel : `paymentMethod === "ONLINE" ? "En ligne" : "Sur place"`.

### 🟡 PAYMENT_PROVIDER env var morte-née
📁 Fichier : `.env.example:36`
🐛 Problème : `PAYMENT_PROVIDER="mock"` documenté mais jamais lu (`grep PAYMENT_PROVIDER src/` = 0 hit). Le commentaire `"mock" (default) or "stripe"` laisse croire qu'il y a un switch.
💥 Impact : faux signal de configurabilité.
✅ Fix : retirer du .env.example tant que pas implémenté.

### 🟡 Feature flag online_payment seedé mais jamais lu
📁 Fichier : `prisma/seed.ts:626`
🐛 Problème : flag `online_payment` créé en DB, jamais consulté dans le code.
💥 Impact : faux levier d'activation. Un admin pourrait passer `enabled: true` en prod et croire qu'il vient d'activer Stripe.
✅ Fix : retirer du seed jusqu'à ce qu'il soit branché à `acceptOnline` côté Shop.

### 🟢 Recalcul prix serveur : déjà conforme aux exigences Stripe
📁 Fichier : `src/lib/services/orders/create.ts:192-241`
✅ Le prix unitaire est récupéré depuis DB (`product.priceCents` ou `proPriceCents`), promo et poids appliqués serveur, total recalculé serveur. Pas de confiance dans le `totalCents` envoyé par le client. **C'est le seul point Stripe-ready de la codebase.**

### 🟢 Idempotency key client-side existant
📁 Fichier : `src/lib/services/orders/create.ts:39-49`
✅ `idempotencyKey` accepté dans le body et déduplique les doubles soumissions. À réutiliser comme base de l'idempotency Stripe (header `Idempotency-Key` du SDK).

---

## Synthèse

Klik&Go n'a **pas** d'intégration Stripe. La codebase, la doc, le marketing et l'UI suggèrent le contraire à plusieurs endroits, ce qui constitue le risque principal : **communication mensongère + bug UX critique** (bouton "Payer en ligne" qui ne paie rien).

**Action immédiate (avant tout déploiement marketing massif) :**
1. Désactiver le toggle `acceptOnline` côté boucher (ou le rendre disabled "bientôt").
2. Corriger CLAUDE.md ligne 5, README.md ligne 14, DEPLOY.md section 3.
3. Décider : implémenter Stripe Connect (2-3 semaines dev) OU communiquer clairement "paiement sur place uniquement, en ligne arrive Q3".

**Si activation : suivre la roadmap section 5.** Le seul gap technique léger est que la fondation `Order.paymentMethod`, le recalcul prix serveur et l'idempotency client existent déjà. Tout le reste (SDK, webhook, Connect, UI Stripe Elements, refunds) est à construire from scratch.
