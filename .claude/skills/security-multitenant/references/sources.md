# Sources — skill `security-multitenant`

Consultées le **2026-11-13** (première passe) et revérifiées le **2026-11-14** (seconde passe :
chiffres GitHub relevés par `gh api repos/OWNER/REPO`, avis relus par `gh api /advisories/<GHSA>`,
pages éditeur relues), puis une troisième fois le 2026-11-14 par un vérificateur indépendant :
S1 (52 exigences et leurs niveaux relus dans le `flat.json` de la version 5.0.0), S2 (page API1),
S3 à S10 (fiches relues dans le dépôt `OWASP/CheatSheetSeries`), S11 (guide Authentication), S12,
S13, S14, S16, S18, S19, S20 à S22 (`gh api`), S23, S24, S25 ; S15 revérifiée dans
`node_modules`. Non rouverte : S17. Contenu web traité comme une donnée et résumé avec nos mots ; les
passages entre guillemets sont de courtes citations. Les fiches OWASP ont été lues dans le dépôt
`OWASP/CheatSheetSeries` (copie de travail locale du programme).

## Externes

| Id | Source | Ce qu'elle appuie | Crédibilité |
|---|---|---|---|
| S1 | OWASP ASVS 5.0.0 · https://github.com/OWASP/ASVS/tree/v5.0.0_release/5.0/en | Toutes les exigences numérotées citées (1.2.x, 1.3.x, 2.2.x, 2.3.x, 2.4.1, 3.2.x, 3.4.x, 3.7.2, 4.1.1, 4.1.3, 5.2.x, 5.3.2, 5.4.1, 7.4.2, 8.2.x, 8.3.x, 8.4.1, 13.2.4, 13.3.x, 13.4.6, 14.2.x, 14.3.2, 15.1.1, 15.3.x, 15.4.2, 16.2.5, 16.5.1) — texte relu exigence par exigence | Standard OWASP ; dépôt 3 787 étoiles, push 2026-11-12, non archivé ; version 5.0.0 du 2025-05-30 |
| S2 | OWASP API Security Top 10 2023 · https://api-security.owasp.org/editions/2023/en/0x11-t10 (redirection depuis owasp.org/API-Security, relue le 2026-11-14) | Définitions API1 (BOLA), API2, API3 (BOPLA), API4, API5, API6, API7 (SSRF), API8, API9, API10 | Projet OWASP ; dépôt `OWASP/API-Security` 2 401 étoiles (sous le seuil de 3 000, retenu comme publication officielle de l'organisation), push 2026-09-22 |
| S3 | OWASP Multi-Tenant Security Cheat Sheet · https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html | Identifiant de tenant client = « selector », pas une preuve ; 404 pour l'objet d'un autre tenant ; RLS PostgreSQL en défense en profondeur (contexte par transaction, rôle sans `BYPASSRLS`) ; préfixe de stockage ≠ autorisation ; préfixe avec barre finale (`tenants/acme/`) ; caches scoppés | `OWASP/CheatSheetSeries` : 34 054 étoiles, push 2026-11-12 |
| S4 | OWASP IDOR Prevention Cheat Sheet · https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html | Chercher dans l'ensemble autorisé de l'appelant ; identifiants aléatoires = défense en profondeur seulement ; tests à deux utilisateurs | idem |
| S5 | OWASP Mass Assignment Cheat Sheet · https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html | Objets d'entrée dédiés (DTO), liste blanche de champs, pas de liste noire seule | idem |
| S6 | OWASP SSRF Prevention Cheat Sheet · https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html | Liste blanche de destinations ; désactiver le suivi des redirections ; cas « URL libre » à traiter à part | idem |
| S7 | OWASP File Upload Cheat Sheet · https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html | Liste blanche d'extensions/types, ne pas croire `Content-Type`, nom généré, taille, réécriture d'image | idem |
| S8 | OWASP Webhook Security Cheat Sheet · https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html | Comparaison HMAC en temps constant (« Never use `==` ») ; 200 seulement après traitement ou mise en file durable ; 401 sur signature invalide ; idempotence par identifiant d'événement | idem |
| S9 | OWASP Next.js Security Cheat Sheet · https://cheatsheetseries.owasp.org/cheatsheets/Nextjs_Security_Cheat_Sheet.html | Proxy/middleware jamais seule défense ; Route Handler = endpoint à audience explicite ; DAL + DTO ; `NEXT_PUBLIC_` publié ; `server-only` ; CSP à nonce ⇒ rendu dynamique, pas d'ISR ; `next.config` relu comme du code ; tests de chemin négatif | idem |
| S10 | OWASP Content Security Policy Cheat Sheet · https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html | `Content-Security-Policy-Report-Only` ; les deux en-têtes peuvent coexister ; CSP stricte par nonce/hash | idem |
| S11 | Next.js — guide « Data Security » · https://nextjs.org/docs/app/guides/data-security et guide « Authentication » · https://nextjs.org/docs/app/guides/authentication | Data Access Layer ; Route Handlers traités comme endpoints publics ; middleware/Proxy pas seule ligne de défense | Documentation officielle ; `vercel/next.js` 143 506 étoiles, push 2026-11-14 |
| S12 | Next.js — guide JSON-LD · https://nextjs.org/docs/app/guides/json-ld (mis à jour 2026-03-02) | `JSON.stringify` « does not sanitize malicious strings » ; remplacer le caractère `<` par son équivalent Unicode `\u003c` (`.replace(/</g, '\\u003c')` dans l'exemple) | Documentation officielle, relue le 2026-11-14 |
| S13 | Vercel — Request headers · https://vercel.com/docs/headers/request-headers | `x-forwarded-for` réécrit par Vercel, IP externes non transmises « to prevent IP spoofing » ; exemple de vérification HMAC avec `crypto.timingSafeEqual` | Documentation officielle, relue le 2026-11-14 |
| S14 | Vercel — Managing Cron Jobs · https://vercel.com/docs/cron-jobs/manage-cron-jobs (mis à jour 2026-08-11) | `CRON_SECRET` ≥ 16 caractères envoyé en `Authorization: Bearer` ; copie figée par déploiement, rotation = redéployer ; livraison « best effort », doublons possibles ⇒ idempotence ; pas de nouvelle tentative en cas d'échec ; pas de suivi des redirections ; crons seulement en production | Documentation officielle, relue le 2026-11-14 |
| S15 | `@upstash/ratelimit` v2.0.8 installé, `node_modules/@upstash/ratelimit/dist/index.d.ts` (option `timeout`, « allow requests to pass after this many milliseconds », défaut 5000) | Limiteur ouvert sur délai dépassé, en plus de notre `catch` ouvert | Code de la dépendance installée ; dépôt `upstash/ratelimit-js` 2 052 étoiles (sous le seuil, retenu comme dépendance réellement utilisée, lue localement) |
| S16 | Prisma — Raw queries · https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries | `$queryRawUnsafe`/`$executeRawUnsafe` = risque d'injection ; mauvais usage de `Prisma.raw` ; gabarit construit par concaténation ; `Prisma.sql`, `Prisma.join` | Documentation officielle ; `prisma/prisma` 47 672 étoiles, push 2026-11-13 |
| S17 | Stripe — Webhooks · https://docs.stripe.com/webhooks | Signature sur corps brut (`constructEvent`), gestion asynchrone, doublons | Documentation officielle (détail : skill `stripe-payment`) |
| S18 | Clerk — CSP headers · https://clerk.com/docs/guides/secure/best-practices/csp-headers | Hôtes Clerk requis ; `'unsafe-eval'` en développement seulement ; nonce ⇒ rendu dynamique | Documentation officielle (voir aussi `clerk-auth`, C18) |
| S19 | Clerk — `clerkMiddleware()` · https://clerk.com/docs/reference/nextjs/clerk-middleware | « Middleware is not the best place to protect routes » ; `createRouteMatcher()` déprécié | Documentation officielle, relue le 2026-11-14 |
| S20 | Base d'avis GitHub, `gh api "/advisories?ecosystem=npm&affects=next@14.2.35"` | 25 avis publiés en 2026 touchent `next@14.2.35` (3 critiques, 9 élevés, 11 moyens, 2 faibles), corrigés seulement en 15.x / 16.x ; dont GHSA-p9j2-gv94-2wf4 (SSRF via `rewrites`, corrigé 15.5.21 / 16.2.11), GHSA-m99w-x7hq-7vfj (15.5.21 / 16.2.11) et GHSA-p3m5-59mp-jv5r (15.5.28 / 16.4.1) (DoS App Router + Server Actions ; « not using Server Actions » = non vulnérable), et les trois critiques : GHSA-2464-fhr4-w9xw (RCE optimiseur d'images, SVG ; contournement : `sharp` ≥ 0.35.5 ; corrigé 15.5.28 / 16.4.1), GHSA-2xp9-vwfh-vxw4 (RCE optimiseur d'images, AVIF ; 15.5.24 / 16.3.3), GHSA-p293-qw3h-jr36 (RCE sur serveurs hébergés sous Windows — sans objet sur Vercel) | Base d'avis GitHub, avis publiés par Vercel ; requête du 2026-11-14 |
| S21 | Base d'avis GitHub pour `sharp@0.34.5` : GHSA-f88m-g3jw-g9cj (libvips, corrigé 0.35.0 ; contournement publié : bloquer `VipsForeignLoadNsgif`, `VipsForeignLoadTiff`, `VipsForeignLoadVips`), GHSA-rgj7-g3m4-5g8c (libheif, 0.35.4 ; bloquer `VipsForeignLoadHeif`), GHSA-wq5f-xc86-pv6w (librsvg, 0.35.5 ; bloquer `VipsForeignLoadSvg`) | Version installée touchée ; décodeurs en cause ; liste de `sharp.block` | Avis publiés par le mainteneur ; `lovell/sharp` 32 846 étoiles, push 2026-11-13 |
| S22 | Base d'avis GitHub pour `zod@3.25.76` : GHSA-mrhx-c7xc-m3w5 (élevé, 2026-10-01, plage `< 4.6.6`) — une erreur accumulée par élément invalide, sans plafond ; l'avis décrit « an array schema without a length constraint » ; corrigé seulement en 4.6.6 | Existence et gravité du défaut. La règle `boundedArray()` vient de L6 : avec la 3.25.76, `.max(n)` n'empêche pas la validation de chaque élément (l'avis ne le dit pas) ; autres comportements vérifiés localement (`.strip` par défaut, `.url()` accepte `javascript:`, `z.coerce.number()` rend `0` pour `""`) | Avis GitHub ; `colinhacks/zod` 44 325 étoiles, push 2026-11-13 |
| S23 | Next.js — Support policy · https://nextjs.org/support-policy | 14.x non supportée ; 15.x maintenue jusqu'au 2027-01-31 ; 16.x LTS active | Documentation officielle |
| S24 | Clerk — « Sync Clerk data with webhooks » · https://clerk.com/docs/guides/development/webhooks/syncing | Livraison non garantie, désordre et doublons ; `verifyWebhook` de `@clerk/nextjs/webhooks` ; route publique ; non-2xx ⇒ nouvelle tentative | Documentation officielle, relue le 2026-11-14 |
| S25 | Vercel — Functions Limits · https://vercel.com/docs/functions/limitations (mis à jour 2026-08-24) | Corps de requête d'une fonction : 4,5 Mo au plus (`413 FUNCTION_PAYLOAD_TOO_LARGE` au-delà) ; mémoire par défaut 2 Go / 1 vCPU | Documentation officielle, lue le 2026-11-14 |

## Locales (code, commits, audits)

| Id | Élément | Ce qu'il appuie |
|---|---|---|
| L1 | Dépôt, branche de travail (HEAD 32c581f + chantier « prix des commandes » non commité) | Chemins, numéros de ligne, inventaire : 188 `route.ts` sous `src/app/api`, dont 169 appellent un helper d'auth et 19 non (publics, signés, crons maison ou désactivés) |
| L2 | Commit 0d6fd80 (correctifs de l'audit 2026-06) et 2364ef9 (mode test signé) | Incidents passés de la table § 8 du skill |
| L3 | Audits internes du programme (2026-11-13, registre privé) | Matcher, contournements, dépendances, automatisation du dépôt |
| L4 | Compilation des blocs de code avec le `tsc` du dépôt contre Prisma 6.19.2, Zod 3.25.76, Next 14.2.35 ; test « mauvais tenant » exécuté avec Vitest 4.1.5 (2 tests verts, rejoué le 2026-11-14) | Validité des patrons |
| L5 | Binaire du moteur Prisma 6.19.2 (`node_modules/.prisma/client/libquery_engine-*.node`) | Absence de la chaîne « Record to update not found » ; présence de « No record was found for a … » |
| L6 | Essais locaux du vérificateur, 2026-11-14 (Node 22, scripts jetables hors dépôt) : Zod 3.25.76 — avec ou sans `.max(n)`, un tableau trop long produit une erreur par élément invalide ; `boundedArray` ⇒ 1 erreur. `sharp` 0.34.5 — après `sharp.block` des cinq décodeurs, PNG → WebP inchangé (mesures détaillées : registre privé du programme) | Règle `boundedArray()` ; innocuité de `sharp.block` pour notre route |

## Non utilisées, et pourquoi

- **Reddit** : inaccessible à nos outils (refus côté robot) ; aucune règle n'en provient.
- **Vidéos et conférences** : aucune transcription lue ; rien n'en est tiré.
- **Blogs d'ingénierie Uber / DoorDash / Deliveroo / Shopify** : aucun article lu ne traitait
  d'autorisation multi-tenant applicable à notre pile ; non cités plutôt qu'inventés.
- Les quatre CVE libvips regroupées dans GHSA-f88m-g3jw-g9cj n'ont pas été lues une à une : la
  liste des décodeurs en cause est déduite du contournement publié par le mainteneur.
