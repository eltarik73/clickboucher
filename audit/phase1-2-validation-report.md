## Rapport de validation Phase 1 + 2 marketplace

**Controller** : Claude QA (Opus 4.7)
**Date** : 2026-04-30 20:53 UTC
**Cible** : https://klikandgo.app
**Deployment ID** : `dpl_7ADRZxUAq7PYi6sTwHxmu2kHH8ws`
**Commit** : `2f97ca5` (feat: stripe marketplace Connect backend)

---

### Builds

| Phase | Commit | État | Notes |
|---|---|---|---|
| Phase 1 — Stripe Connect backend | `2f97ca5` | OK | Build clean (Prisma 6.19.2 generate + migrate deploy + next build), aucun deploy en ERROR depuis a2d5a1b |
| Phase 2 — Frontend (UI markup, dashboards, cron) | n/a | EN ATTENTE | Aucun deploy push depuis 2f97ca5 — l'agent CTO n'a pas encore poussé la phase 2 |

Build logs Phase 1 (extrait) :
- `Detected Next.js version: 14.2.35`
- `Generated Prisma Client (v6.19.2) ... in 691ms`
- `prisma generate && prisma migrate deploy && next build` — exit 0
- 8 lambdas Node.js déployées
- Aucun warning bloquant (uniquement le warning Prisma 7 future-deprecation sur `package.json#prisma`, sans impact)

2 deploys en ERROR antérieurs (`dpl_D6zvTjjuRcTmDzsjzWpkzt1F1Thb`, `dpl_4JMtEsAdo4FYXYnnpXB2gCLMQsaZ`) sont des redeploys du commit `27ea77b` (perf font/clerk) qui ont eu un transient — le 3ᵉ redeploy `3ueDLetj2rrZEcqAQmhBqx23iPvb` du même commit est passé. Pas de blocker.

---

### Tests fonctionnels — Phase 1

| Test | Endpoint | Code | Attendu | Statut |
|---|---|---|---|---|
| Site live (homepage) | `GET /` | 200 | 200 | OK |
| Page sign-in | `GET /sign-in` | 200 | 200 | OK |
| Health check | `GET /api/health` | 200 | 200 | OK |
| OG image | `GET /og-image.png` | 200 | 200 | OK |
| Sitemap XML | `GET /sitemap.xml` | 200 | 200 | OK |
| Robots | `GET /robots.txt` | 200 | 200 | OK |
| Boutique détail (slug) | `GET /boutique/boucherie-tarik` | 200 | 200 | OK |
| Page ville SEO | `GET /boucherie-halal/chambery` | 200 | 200 | OK |
| API shops | `GET /api/shops` | 200 | 200 | OK (renvoie `{success:true, data: [...]}`) |

#### Stripe env vars

- HTML homepage contient `pk_live_Y2xlcmsua2xpa2FuZGdvLmFwcCQ` (clé Clerk **production**).
- Aucune occurrence de `pk_test_` dans le bundle client (grep = 0).
- Domaine custom Clerk `clerk.klikandgo.app` chargé (CSP + sign-in HTML).
- CSP autorise `https://api.stripe.com`, `https://js.stripe.com`, `https://hooks.stripe.com` (frame-src) — Stripe Checkout iframe-able.

`STRIPE_SECRET_KEY` n'est **pas encore set** côté Vercel — ce qui est attendu : la phase 1 backend pose les fondations, l'activation est gated par `isStripeConfigured()` (cf. `audit/stripe-activation.md`).

#### Routes Stripe (dégradation gracieuse vérifiée)

Sans `STRIPE_SECRET_KEY` configurée, les routes répondent en mode "service désactivé" — par design :

| Route | Code | Body | Verdict |
|---|---|---|---|
| `GET /api/boucher/stripe/onboard` | **503** | `{"success":false,"error":{"code":"SERVICE_DISABLED","message":"Stripe non configuré"}}` | Conforme au design (le check `isStripeConfigured()` court-circuite avant l'auth) |
| `GET /api/boucher/stripe/dashboard-link` | **503** | `{"success":false,"error":{"code":"SERVICE_DISABLED","message":"Stripe non configuré"}}` | Conforme |
| `POST /api/payments/webhook` (sans signature) | **503** | `{"received":false,"reason":"not-configured"}` | Conforme (premier check : `isStripeConfigured() && STRIPE_WEBHOOK_SECRET`) |

> Le prompt initial attendait 401/400, ce qui suppose Stripe activé. En l'état (Stripe pas encore configuré), 503 `SERVICE_DISABLED` est le **bon code** — l'app reste en "paiement sur place". Une fois `STRIPE_SECRET_KEY` ajoutée à Vercel, les routes basculeront naturellement en 401 (auth requise) puis 200/redirect.

#### Sécurité auth

- `/sign-in` retourne `x-clerk-auth-status: signed-out` et `x-clerk-auth-reason: session-token-and-uat-missing` — middleware Clerk OK.
- Headers de sécurité présents : `strict-transport-security`, `x-content-type-options: nosniff`, `x-frame-options: DENY`, `referrer-policy: strict-origin-when-cross-origin`, `permissions-policy: camera=(), microphone=(), geolocation=(self)`.
- `/boucher/dashboard/*` et `/webmaster/*` retournent 307 (redirect vers sign-in) — middleware tenant correctement rétablit pour les Phase 2 pages futures.

---

### Tests fonctionnels — Phase 2

**Status : EN ATTENTE.** Aucun commit Phase 2 poussé sur `main` au moment du contrôle. Les pages `/boucher/dashboard/parametres/paiement`, `/boucher/dashboard/finances`, `/webmaster/finances` ne sont pas encore livrées (les 307 viennent uniquement du middleware d'auth, pas d'une 404).

Tests à rejouer dès la livraison :
- Page onboarding boucher (CTA Stripe, état du compte, bouton "Reprendre l'onboarding")
- Page finances boucher (KPI, graph payouts, palier de commission)
- Page finances webmaster (cumul GMV, paliers, application_fee, exports CSV)
- Cron de recalcul des paliers (`/api/cron/...`)

---

### Schema Prisma — phase 1

Migration `20260426093652_add_stripe_foundations` + ajouts du commit `2f97ca5` appliqués via `migrate deploy` sur Postgres prod (Railway). Champs ajoutés :

- `Shop.stripeAccountId / stripeAccountStatus / stripeChargesEnabled / stripePayoutsEnabled / tier (ShopTier enum) / markupPercent / gmvCents / earlyAdopter`
- `Product.boutiquePriceCents` (prix physique boutique)
- `Order.stripePaymentIntentId / stripeChargeId / stripeTransferId / stripeCheckoutSessionId / platformFeeCents / serviceFeeCents / stripeFeeCents / payoutCents / refundedAt / refundAmountCents`
- Modèle `StripeEvent` (idempotency)

Aucune erreur de migration dans les build logs.

---

### Audit Phase 1

Aucun rapport d'audit indépendant n'a été publié dans `audit/phase1-stripe-connect-audit.md` au moment du contrôle. À surveiller — si le fichier apparaît, ce rapport sera mis à jour.

Findings du Controller (lecture du code Phase 1) :
- **Bonne pratique** : le webhook utilise `req.text()` + `constructEvent()` (signature HMAC vérifiée) — pas de `req.json()` qui briserait la signature.
- **Bonne pratique** : idempotency via `StripeEvent.id` (Stripe rejoue après 5xx → safe).
- **Bonne pratique** : le webhook retourne 500 sur handler error pour forcer Stripe à rejouer.
- **Mineur** : `apiVersion: "2026-04-22.dahlia"` est codé en dur dans `src/lib/stripe.ts` — à bumper au prochain upgrade SDK + retest webhooks (déjà documenté en commentaire).

| Catégorie | Count |
|---|---|
| Bugs critiques (rouge) | 0 |
| Bugs importants (orange) | 0 |
| Mineurs / améliorations | 1 (commentaire de versioning Stripe) |
| Score global | 9/10 |

---

### Conclusion

**Phase 1 backend Stripe Connect : prête pour activation.**

- Le déploiement `dpl_7ADRZxUAq7PYi6sTwHxmu2kHH8ws` (commit `2f97ca5`) est sain et sert la prod (klikandgo.app).
- Les 3 routes Stripe et le webhook sont déployés et répondent correctement (dégradation gracieuse `SERVICE_DISABLED` tant que les env vars ne sont pas posées).
- Aucune régression sur les routes publiques existantes (homepage, sign-in, sitemap, boutiques, villes SEO).
- Les env vars Clerk sont bien en `pk_live_*` et le domaine custom `clerk.klikandgo.app` est actif.

**Étape suivante** : ajout des env vars Vercel `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (cf. `audit/stripe-activation.md`) puis push de la Phase 2 frontend.

**Phase 2 : non déployée à l'heure du contrôle.** Re-validation à effectuer dès le push.
