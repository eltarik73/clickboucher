# Abus, webhooks, crons

Sources : [sources.md](sources.md). État du code : branche de travail, 2026-11-14.

## 1. Rate limiting (ASVS 2.4.1, 6.3.1 ; API4 et API6:2023)

### Ce que fait `src/lib/rate-limit.ts`

- Upstash `Ratelimit.slidingWindow`, une instance par usage : `api` 30/min, `orders` 5/min,
  `aiChat` 3/min, `otpSend` 2/min, `otpVerify` 5/5 min, `ai` 10/min, `search` 30/min,
  `promoValidate` 10/min, `tickets` 10/h.
- `checkRateLimit(limiter, id)` est **ouvert** dans trois cas : Redis non configuré
  (`limiter === null`), exception (`catch` → `success: true`), et délai dépassé : l'option
  `timeout` d'Upstash vaut 5000 ms par défaut et laisse passer la requête [S15].
- 36 handlers l'appellent (recherche de texte, 2026-11-14).

Conséquence : le limiteur **réduit** l'abus, il ne **garantit** rien. Aucun contrôle de sécurité
ne doit reposer sur lui seul (un code à 4 chiffres, par exemple, doit aussi expirer et se
verrouiller après N échecs en base).

### Choisir la clé

| Appelant | Clé | Exemple existant |
|---|---|---|
| Connecté | `"<action>:<userId Prisma ou clerkId>"` | — |
| Boucher | `"<action>:<shopId>"` | `product-patch:${auth.shopId}` (patron) |
| Anonyme | `"<action>:<ip>"` avec l'IP de `x-forwarded-for` (premier élément) | `cart-add:${ip}`, `test-mode:${ip}` |
| Anonyme avec identifiant métier | `"<action>:<email en minuscules>"` **et** IP | état actuel : registre privé du programme |

Sur Vercel, `x-forwarded-for` est réécrit par la plateforme et n'est pas falsifiable par le
client [S13] (ASVS 4.1.3). Ce n'est **pas** vrai en local ni derrière un autre proxy.

### Quand limiter (obligatoire)

Mutation anonyme ; envoi d'e-mail, SMS, push ; appel payant (Anthropic, Replicate, Vercel Blob,
Google Places) ; essai d'un code ou d'un secret (promo, OTP, code de retrait, mode test) ;
recherche et export. Choisir le limiteur **le plus strict** qui laisse passer l'usage normal.

## 2. Webhooks entrants (ASVS 2.4, 4.x ; API10:2023)

Ordre invariable [S8][S24][S17] :

1. Secret absent ⇒ réponse d'erreur, **jamais** traitement (fermé par défaut).
2. Corps **brut** (`await req.text()`) ; aucune lecture de JSON avant vérification.
3. Signature vérifiée par la bibliothèque du fournisseur (`constructEvent` Stripe, `svix` ou
   `verifyWebhook` Clerk) ; échec ⇒ 401 (Stripe : 400 historique chez nous, accepté).
4. Idempotence par identifiant d'événement (`event.id` Stripe, en-tête `svix-id` Clerk).
5. 2xx **seulement** après traitement durable ; sinon non-2xx pour que le fournisseur réessaie.
6. Traitement ordonné-indépendant : un événement ancien ne doit pas écraser un plus récent.
7. Route exclue du matcher du middleware et n'important aucun helper d'auth (`clerk-auth`).

### Nos deux webhooks

| | `payments/webhook/route.ts` (Stripe) | `webhooks/clerk/route.ts` |
|---|---|---|
| Secret absent | 503 (`:37-42`) | 500 (`:25-31`) |
| Corps brut + signature | `:45-63` | `:47-63` |
| Marqueur d'idempotence | ligne `StripeEvent` insérée (`P2002` ⇒ doublon), **supprimée si le traitement échoue** (`:66-148`) | clé Redis `SET NX` posée **avant** le traitement et jamais retirée (`:67-80`) |
| Verdict | **modèle à copier** | défaut W1 : un échec transitoire perd l'événement (détail et correctif : `clerk-auth/references/roles-et-synchronisation.md`) |

Limite du modèle Stripe, à connaître : le marqueur est retiré dans le `catch`. Si la fonction est
tuée entre l'insertion et la fin du traitement (délai dépassé, arrêt de l'instance), il reste et la
nouvelle tentative est acquittée comme doublon. Pour un événement qui ne doit jamais se perdre
(paiement), ajouter un rattrapage : état « reçu / traité » sur la ligne, ou réconciliation
périodique (skills `stripe-payment`, `background-jobs-notifications`).

## 3. Crons (Vercel)

Faits Vercel [S14] : `CRON_SECRET` (≥ 16 caractères) envoyé en `Authorization: Bearer …` ;
chaque déploiement garde la copie capturée à son build (rotation = modifier puis **redéployer**) ;
livraison « best effort », parfois en double, **sans** nouvelle tentative en cas d'échec ; pas de
suivi de redirection ; exécution en production uniquement. La même page annonce que les Cron Jobs
sont une fonctionnalité « legacy » appelée à migrer vers « Schedules » : à suivre dans
`background-jobs-notifications`, rien à changer ici aujourd'hui.

Règles :

- Première instruction : `if (!verifyCronAuth(req)) return apiError("UNAUTHORIZED", …)`
  (`src/lib/cron-auth.ts`, fermé si `CRON_SECRET` absent). Ne pas réécrire la comparaison à la
  main (`src/app/api/cron/route.ts` le fait encore, avec l'en-tête historique `x-cron-secret`).
- Comparaison : en temps constant pour un secret partagé, comme le demande OWASP [S8] (l'exemple
  de Vercel pour les crons utilise `!==` [S14]) : `safeEqual` de
  [secrets-entetes-csp.md](secrets-entetes-csp.md). État actuel : registre privé du programme.
- Idempotent et « par rattrapage » : traiter tout ce qui est en attente depuis le dernier succès,
  pas « ce qui est arrivé depuis une heure » ; verrou Redis si une exécution peut dépasser
  l'intervalle [S14].
- Une route cron ne lit pas de session, ne prend pas d'identifiant dans la query et ne renvoie
  aucune donnée personnelle dans sa réponse.
- `export const dynamic = "force-dynamic"` (une réponse en cache n'exécute rien et n'apparaît pas
  dans les journaux [S14]).
- Détail des tâches de fond et des notifications : skill `background-jobs-notifications`.

## 4. Flux métier abusables (API6:2023)

| Flux | Abus | Contrôle en place | À garder en tête |
|---|---|---|---|
| Commande invité | commandes factices, saturation d'une boutique | état actuel : registre privé du programme | limiter par e-mail **et** par IP ; plafond de commandes en attente par boutique |
| Codes promo / fidélité | énumération de codes | `rateLimits.promoValidate` (`orders/quote`) | codes longs et aléatoires ; usage unique vérifié en transaction |
| Avis | faux avis | état actuel : registre privé du programme | un avis par commande retirée, vérifié côté serveur, unicité en base ; règles `seo-anti-penalty` (FTC) |
| Tickets support, chat IA | coût Anthropic | `rateLimits.tickets` ; `rateLimits.ai` sur `/api/chat` (`aiChat` est défini mais utilisé nulle part) | jamais d'appel IA anonyme non limité |
| Images IA | coût Replicate | `rateLimits.ai` | rôle boucher requis |
| OTP | brute force, coût SMS | `otpSend`, `otpVerify` | expiration et compteur d'échecs en base |
