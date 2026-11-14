---
name: security-multitenant
description: Sécurité applicative d'une marketplace multi-tenant, ancrée dans le code Klik&Go (Next 14.2.35, Prisma 6.19, Clerk 6.39.9, Vercel). Autorisation par construction (tenant dans le where, anti-IDOR), contrôle de propriété, protection contre le mass assignment, validation des entrées et encodage des sorties (XSS, JSON-LD, e-mails, URL), SSRF et envoi de fichiers, secrets, en-têtes de sécurité et CSP, rate limiting, vérification des webhooks et des crons, rapportés à OWASP ASVS 5.0 et à l'OWASP API Security Top 10 2023, avec la check-list de revue de toute nouvelle route. À charger avant de créer ou modifier un fichier sous src/app/api, une requête Prisma qui reçoit un identifiant du client, un fetch sortant, un upload, un en-tête ou une variable d'environnement.
when_to_use: Nouvelle route API ou nouveau handler ; route qui reçoit un id, shopId, orderId, userId ou une URL ; ajout d'un champ à un schéma Zod ; include ou select Prisma renvoyé au client ; dangerouslySetInnerHTML ; fetch vers une URL fournie par l'utilisateur ; upload ou proxy d'image ; nouveau webhook ou cron ; modification de next.config.mjs (headers, CSP, images.remotePatterns) ; nouvelle variable d'environnement ; clé de cache Redis ; revue de sécurité d'une PR ; question du type un boucher peut-il voir les données d'un autre.
---

# Sécurité multi-tenant — Klik&Go

Ce skill dit **comment écrire une route qui ne fuit pas**, avec nos helpers et nos versions. Il ne
remplace pas `CLAUDE.md` (§ « Sécurité multi-tenant », « Authentification API ») : il l'explique et
le complète ; tout désaccord va dans « Points à arbitrer ». Sources : [references/sources.md](references/sources.md)
(`[S…]` externe, `[L…]` code, commits, audits). État du code : branche de travail relue le
2026-11-14 (HEAD 32c581f + chantier « prix des commandes » **non commité**), 188 handlers `route.ts`.
Les numéros de ligne datent de ce relevé ; pour les fichiers que le chantier réécrit (`orders/**`,
`products/**`, `src/lib/services/orders/**`) le skill cite des symboles : chercher par nom.

Skills voisins, à ne pas dupliquer : `clerk-auth` (identité, middleware, rôles, webhook Clerk),
`api-route-conventions` (forme des handlers), `prisma-expert` (requêtes), `stripe-payment`
(paiement), `conformite-france` (RGPD, CNIL), `reliability-observability` (logs, Sentry),
`testing-strategy`, `background-jobs-notifications` (crons).

## 1. Qui peut quoi (modèle en une table)

| Acteur | Preuve | Clé de portée | Périmètre |
|---|---|---|---|
| Anonyme | aucune | — | lecture du catalogue public (jamais `proPriceCents`) |
| Invité | cookie httpOnly `klikgo-guest-token` | `User.guestToken` | ses commandes |
| Client / client pro | `getServerUserId()` → id Prisma | `userId` | ses commandes, panier, favoris, fidélité ; tarifs pro si `CLIENT_PRO` |
| Boucher | `getAuthenticatedBoucher()` | **`shopId` renvoyé par le helper** | une seule boutique : produits, commandes, clients de la boutique, images, promos |
| Admin / webmaster | `requireAdmin()` | aucune (trans-tenant, explicite) | tout, avec `writeAuditLog` sur mutation |
| Machine | signature Svix, `constructEvent` Stripe, `verifyCronAuth` | — | son seul endpoint |

Le **tenant** est la boutique (`shopId`). Une donnée de boutique vue ou modifiée par un autre
boucher est l'incident le plus grave possible ici (OWASP API1:2023, ASVS 8.2.2 et 8.4.1) [S2][S1].

## 2. Les douze règles

1. **Identité et tenant viennent du serveur.** `shopId`, `userId`, `role`, `ownerId` ne se lisent
   jamais dans le corps, la query ou un en-tête : ce que le client envoie est un *sélecteur*, pas
   une preuve [S3]. Si un schéma contient `shopId` (ex. `createProductSchema`), on le compare à
   celui du helper (`POST` de `src/app/api/products/route.ts` : `data.shopId !== authShopId`).
2. **Le tenant est dans le `where`, pas dans un `if` après coup.** `findFirst({ where: { id, shopId } })`,
   `updateMany({ where: { id, shopId } })`, `deleteMany(...)`. Oublier le `if` ne doit pas pouvoir
   arriver [S3][S4]. Objet d'un autre tenant ⇒ **404**, pas 403 (ne pas confirmer qu'il existe) [S3].
3. **Chaque handler s'autorise lui-même.** Le middleware n'est pas une frontière (skill
   `clerk-auth`) ; une route appelée « seulement par notre page » est un endpoint public [S9][S11].
4. **Toute mutation passe par Zod, et le schéma est une liste blanche** de ce que *cet* appelant
   peut changer. Jamais `data: body`. Schémas de mise à jour en `.strict()` pour qu'une clé en trop
   échoue au lieu d'être ignorée (ASVS 15.3.3) [S5][S1]. Bornes partout : `max()` sur chaînes,
   `int().min().max()` sur nombres, et tableau reçu d'un client déclaré par **`boundedArray()`**
   ([entrees-sorties.md](references/entrees-sorties.md) § 1) : avec Zod 3 (notre version),
   `z.array(x).max(n)` valide quand même chaque élément d'un tableau trop long (vérifié), et
   GHSA-mrhx-c7xc-m3w5 n'a pas de correctif 3.x [S22][L6].
5. **La sortie est un `select` explicite.** Pas de `include: { product: true }` ni d'objet Prisma
   entier vers le client : c'est ainsi que `proPriceCents`, `guestToken`, `clerkId`, `ownerId`
   sortent (API3:2023, ASVS 15.3.1) [S2][S1].
6. **Prix, totaux, commissions, statuts : calculés côté serveur** à partir de la base. Table des
   transitions : `src/lib/order-state-machine.ts` ; dans le chantier prix, seul
   `src/lib/services/orders/transition.ts` écrit `Order.status` (écriture conditionnelle portant
   la portée de l'appelant) — ne pas écrire un statut ailleurs (ASVS 2.3.1).
7. **Un cache est scoppé par son audience.** Clé Redis et `Cache-Control` portent la dimension
   (boutique, utilisateur, « pro ») ; une réponse dépendant de la session n'est jamais
   `apiCached()` ni `public` [S3][S9].
8. **Requête sortante vers une URL reçue du client** : `https`, hôte en liste blanche, pas de port,
   `redirect: "error"`, délai, taille plafonnée, type de contenu en liste blanche (ASVS 1.3.6) [S6].
9. **Fichier reçu** : rôle + propriété, taille, type déclaré **et** octets magiques, ré-encodage,
   nom généré, jamais de SVG ; ne jamais relayer ni stocker un `Content-Type` amont
   (`src/lib/image-content-type.ts`) (ASVS 5.2.x) [S7].
10. **Chaîne non fiable rendue hors de React** (JSON-LD, e-mail HTML, ticket imprimé, `href`) :
    échappement adapté au contexte ; `z.string().url()` accepte `javascript:` — toujours contraindre
    le schéma et l'hôte (ASVS 1.2.x) [S12][S1].
11. **Secret** : variable serveur, jamais `NEXT_PUBLIC_`, jamais dans une URL ni un log, comparé en
    temps constant, et **fermé par défaut** si absent (ASVS 13.3, 14.2.1) [S1][S8].
12. **Tout ce qui coûte ou écrit pour un anonyme est limité** (`checkRateLimit`), en sachant que
    notre limiteur est *ouvert en cas de panne* : il réduit l'abus, il n'autorise rien (ASVS 2.4.1,
    API4 et API6:2023) [S15][S2].

## 3. Autorisation par construction — le geste

```ts
const auth = await getAuthenticatedBoucher();
if (auth.error) return auth.error;
const data = patchSchema.parse(await req.json());          // .strict()
const { count } = await prisma.product.updateMany({
  where: { id: params.id, shopId: auth.shopId },            // le tenant est la condition
  data,
});
if (count === 0) return apiError("NOT_FOUND", "Produit introuvable");
```

- Client : `where: { id, user: { clerkId } }` ou `where: { id, userId: dbUser.id }`.
- Relation indirecte (image d'un produit, ligne d'une commande) : filtrer par la relation,
  `where: { id, product: { shopId: auth.shopId } }`.
- Liste d'ids reçue (catégories, produits d'une promo) : recharger avec `shopId` et comparer les
  longueurs (`PATCH` de `src/app/api/products/[id]/route.ts`, contrôle de `categoryIds`).
- Modèles déjà dans le dépôt (chantier prix, non commité) : `scopedOrderWhere()` et les commandes
  de `src/lib/services/orders/commands/` (`where: { id, shopId }`, `not_found` sinon), appelées par
  `boucher/orders/[orderId]/action/route.ts` ; `src/lib/public-projections.ts` pour la règle 5.
- Admin : pas de filtre de tenant, donc **toujours** `requireAdmin()` + audit ; ne jamais réutiliser
  une route boucher « avec un `if admin` ».
- `update()` accepte aussi `where: { id, shopId }` (Prisma ≥ 5), mais lève s'il n'y a rien : préférer
  `updateMany` + `count`, car `handleApiError` ne reconnaît plus ce cas (§ 8).

Détail, variantes compilées et anti-patrons du dépôt : [references/autorisation-par-construction.md](references/autorisation-par-construction.md).

## 4. Entrées, sorties, requêtes sortantes, fichiers

| Sujet | Règle courte | Référence |
|---|---|---|
| Zod | body, query **et** params ; `.strict()` en mise à jour ; `cuid()` sur les ids ; URL = `https` + hôtes | [entrees-sorties.md](references/entrees-sorties.md) |
| SQL brut | uniquement `` prisma.$queryRaw`…${v}` `` ; jamais `…Unsafe`, jamais de chaîne construite [S16] | idem |
| XSS | React échappe ; `dangerouslySetInnerHTML` = constante uniquement ; JSON-LD par `<JsonLd>` (`src/components/seo/JsonLd.tsx`, `serializeJsonLd()`, corrigé en 0b69e39) [S12] | idem |
| E-mails, tickets | échapper tout champ saisi : `esc()` (`src/lib/email-templates.ts:4`, non exporté : l'exporter pour le réutiliser), `escapeHtml()` (`components/boucher/OrderTicket.tsx:331`) ; état des autres gabarits : registre privé du programme | idem |
| Redirections | chemins relatifs en dur ; jamais une URL prise dans la requête (ASVS 3.7.2) | idem |
| SSRF | `isAllowedImportUrl` (`boucher/images/import/route.ts:30-41`) est le modèle | [ssrf-fichiers.md](references/ssrf-fichiers.md) |
| Upload | `uploads/product-image/route.ts` est le modèle (rôle, propriété, taille, magie, sharp) | idem |
| Blob | préfixe `shops/<shopId>/…` ; un préfixe n'est pas une autorisation [S3] | idem |

## 5. Secrets, en-têtes, CSP, dépendances

- En-têtes globaux dans `next.config.mjs:69-108` : HSTS 2 ans + preload, `nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`. Ne pas en retirer.
- CSP : ne pas compter sur elle pour arrêter un XSS ; c'est l'encodage de sortie qui protège
  (règle 10). Écarts actuels : registre privé du programme. Le
  minimum ASVS 3.4.3 / 3.4.6 et le plan de durcissement compatible avec le rendu statique sont dans
  [references/secrets-entetes-csp.md](references/secrets-entetes-csp.md). **Pas de CSP à nonce** :
  elle impose le rendu dynamique [S9][S18].
- Aucune route ne pose d'en-tête CORS : c'est voulu (même origine uniquement). En ajouter exige une
  liste blanche d'origines (ASVS 3.4.2).
- Next 14.2.35 est hors support [S23] et `sharp` doit suivre ses correctifs [S21] : montées à
  planifier (points à arbitrer 5 et 6) ; exposition détaillée : registre privé du programme. Toute
  tâche de sécurité commence par `npm audit --omit=dev` et
  `gh api "/advisories?ecosystem=npm&affects=<paquet>@<version>"` sur les paquets touchés.

## 6. Abus, webhooks, crons

- `rateLimits.*` (`src/lib/rate-limit.ts`) : choisir le plus strict qui convient ; clé =
  `"<action>:<userId ou shopId>"` pour un connecté, **et** l'IP pour un anonyme. Sur Vercel,
  `x-forwarded-for` est réécrit par la plateforme et n'est pas falsifiable par le client [S13].
- Webhook : signature d'abord, sur le corps **brut** (`req.text()`), puis idempotence par
  identifiant d'événement, et 2xx seulement après traitement durable [S8][S17]. Modèle :
  `src/app/api/payments/webhook/route.ts:45-148` (marqueur inséré, puis supprimé si le traitement échoue).
- Cron : `verifyCronAuth(req)` en première ligne, `401` sinon ; fonctionnement idempotent (Vercel
  peut livrer deux fois ou pas du tout) [S14].
- Détail : [references/abus-webhooks-crons.md](references/abus-webhooks-crons.md).

## 7. Check-list de revue — toute nouvelle route

Version commentée avec commandes de vérification : [references/checklist-revue-route.md](references/checklist-revue-route.md).

- [ ] **Audience écrite** en tête de fichier : publique / client / boucher / admin / machine.
- [ ] **Matcher** : la route est sous le matcher si elle appelle un helper Clerk ; sinon elle n'en importe aucun.
- [ ] **Première instruction du `try`** : le helper d'auth correspondant ; son `error` est renvoyé tel quel (ou la fabrique de `api-route-conventions`, qui appelle ces mêmes helpers, quand elle existera).
- [ ] **Aucun identifiant de portée lu chez le client** (`shopId`, `userId`, `role`, `ownerId`).
- [ ] **Chaque requête Prisma** portant un id reçu a le tenant ou le propriétaire dans son `where`.
- [ ] **Objet d'autrui ⇒ 404** ; rôle insuffisant ⇒ 403 ; pas de session ⇒ 401.
- [ ] **Zod** sur body, query et params ; bornes ; tableaux en `boundedArray()` ; `.strict()` si mise à jour ; pas de champ privilégié dans le schéma.
- [ ] **Réponse en `select`** ; pas de `proPriceCents`, `guestToken`, `clerkId`, `ownerId`, e-mail d'un tiers hors besoin.
- [ ] **Liste paginée** (≤ 50) et triée sur une colonne indexée.
- [ ] **`GET` sans effet de bord** ; mutation en `POST`/`PATCH`/`PUT`/`DELETE`.
- [ ] **Rate limit** si mutation anonyme, envoi (e-mail, SMS, push), appel payant (IA, Replicate, Blob) ou essai de code.
- [ ] **Cache** : `export const dynamic = "force-dynamic"` si la réponse dépend de la session ; jamais `apiCached` pour du privé ; clé Redis scoppée.
- [ ] **`fetch` sortant / fichier** : règles 8 et 9.
- [ ] **Erreurs** : `handleApiError(error, "contexte")` ; message générique ; `logger`, pas `console` ; aucun secret ni corps complet dans les logs.
- [ ] **Admin** : `writeAuditLog` sur toute mutation.
- [ ] **Tests** : anonyme → 401, mauvais rôle → 403, **mauvais tenant → 404**, entrée invalide → 400, cas nominal.

## 8. Erreurs déjà commises ici

| Erreur (commit ou audit) | Classe OWASP | Leçon |
|---|---|---|
| `/api/search` et `/api/suggestions` renvoyaient `proPriceCents` aux anonymes (0d6fd80) | API3 | règle 5 : `select`, pas de ligne entière |
| Cache Redis de `/api/products` servant la variante pro à tous pendant 60 s (0d6fd80) | API3 | règle 7 : audience dans la clé |
| Proxy d'images sans session, relayant le `Content-Type` amont (0d6fd80) | API8 + XSS stocké | règles 3 et 9 |
| Import d'image depuis n'importe quelle URL (0d6fd80) | API7 (SSRF) | règle 8 |
| `/api/calendar-events` renvoyait les événements de toutes les boutiques (0d6fd80) | API1 | règle 2 |
| `/api/cron/recipes` ouvert quand `CRON_SECRET` manquait (0d6fd80) | API2 | règle 11 : fermé par défaut |
| `guestToken` renvoyé dans le détail de commande (audit 2026-06-12) | API3 | règle 5 |
| Matcher excluant les extensions : coquille admin servie sans middleware | API5 | règle 3 |

Constats encore ouverts : tenus dans le registre privé du programme (non publiés tant qu'ils ne
sont pas corrigés). Corrigés depuis le relevé : JSON-LD échappé (0b69e39), détail de commande servi
par une projection client (chantier prix). Constats publiables et méthode pour clore un constat :
[references/constats-2026-11.md](references/constats-2026-11.md).

## 9. Points à arbitrer (propriétaire)

1. **Row Level Security PostgreSQL** comme seconde barrière : recommandée en défense en profondeur
   [S3], mais délicate derrière pgbouncer (contexte de tenant à poser par transaction). Non proposé
   à court terme ; l'isolation reste applicative.
2. **Rate limiting fermé** sur les endpoints sensibles (validation de code promo, commande
   invité) : aujourd'hui tout est ouvert si Redis tombe ou dépasse 5 s [S15]. Choix
   disponibilité contre abus.
3. **Jeton invité dans l'URL** (`?guestToken=`) : contraire à ASVS 14.2.1 (pas de secret en query
   string) [S1], mais nécessaire au lien de suivi envoyé par e-mail. Option : jeton par commande, à
   durée courte, échangé contre le cookie puis retiré de l'URL.
4. **Durcissement CSP** en deux temps (Report-Only puis blocage) : gain réel, risque de casser
   Clerk ou Stripe si mal testé.
5. **Montée de Next** (15.5.x) pour retrouver les correctifs de sécurité : hors périmètre de ce
   skill, à planifier (skill `nextjs-app-router`).
6. **`sharp` 0.35.x** : montée de mineure avec rupture possible, et/ou `sharp.block(...)`
   tout de suite (défense en profondeur) ; les deux touchent le traitement d'images en production.

7. **Zod 4 (≥ 4.6.6)** : seul correctif de GHSA-mrhx-c7xc-m3w5 [S22] ; changement de majeure sur
   tous les schémas. En attendant, `boundedArray()` (règle 4) ; à planifier ou à écarter.

## 10. Définition de terminé (travail touchant une route ou une donnée)

- [ ] Check-list du § 7 cochée pour chaque handler créé ou modifié.
- [ ] Un test « mauvais tenant » existe pour chaque route à identifiant (deux boutiques, A demande
      l'objet de B, attendu 404) et il appelle le **vrai** handler, pas une copie de la logique.
- [ ] `rg "data: (body|json|payload)" src/app/api` et `rg "RawUnsafe|Prisma\.raw\(" src` : aucun résultat.
- [ ] Aucune nouvelle variable `NEXT_PUBLIC_*` portant un secret ; nouveau secret documenté dans
      `CLAUDE.md` § Variables d'environnement.
- [ ] Aucun nouvel hôte dans la CSP ou `images.remotePatterns` sans justification en commentaire.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` verts.
- [ ] Essai manuel : la route appelée sans cookie, puis avec un compte d'un autre rôle, puis avec
      l'identifiant d'un objet d'une autre boutique.

## Références

- [references/autorisation-par-construction.md](references/autorisation-par-construction.md)
- [references/entrees-sorties.md](references/entrees-sorties.md)
- [references/ssrf-fichiers.md](references/ssrf-fichiers.md)
- [references/secrets-entetes-csp.md](references/secrets-entetes-csp.md)
- [references/abus-webhooks-crons.md](references/abus-webhooks-crons.md)
- [references/checklist-revue-route.md](references/checklist-revue-route.md)
- [references/owasp-mapping.md](references/owasp-mapping.md) — ASVS 5.0 et API Top 10 2023 ↔ notre code.
- [references/constats-2026-11.md](references/constats-2026-11.md) — constats publiables et méthode (les constats ouverts sont au registre privé).
- [references/sources.md](references/sources.md)
