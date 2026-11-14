# Secrets, en-têtes de sécurité, CSP, dépendances

Sources : [sources.md](sources.md). Fichier central : `next.config.mjs` (136 lignes, relu le 2026-11-14).

## 1. Secrets (ASVS 13.3, 14.2.1, 16.2.5 ; API8:2023)

### Inventaire par nom (relevé par recherche de `process.env.` dans `src`, complété par `CLAUDE.md` pour les variables lues par les SDK ; aucun `.env` lu)

| Catégorie | Variables | Portée |
|---|---|---|
| Identité | `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET` | serveur |
| Données | `DATABASE_URL`, `DIRECT_DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `BLOB_READ_WRITE_TOKEN` | serveur |
| Paiement | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | serveur |
| Machines | `CRON_SECRET`, `TEST_SECRET`, `TEST_MODE`, `ALLOW_TEST_IN_PROD` | serveur |
| Services | `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `REPLICATE_API_TOKEN`, `PEXELS_API_KEY`, `UNSPLASH_ACCESS_KEY`, `GOOGLE_PLACES_API_KEY`, `BING_WEBMASTER_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `VAPID_PRIVATE_KEY`, `SENTRY_AUTH_TOKEN` | serveur |
| Publiques par nature | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, codes de vérification moteurs, `VAPID_PUBLIC_KEY` | navigateur |

### Règles

1. **`NEXT_PUBLIC_` = publié.** La valeur est incluse dans le JavaScript client au moment du
   build [S9]. N'y mettre que ce qui peut être lu par n'importe qui. Un secret qui y est passé une
   fois doit être **tourné**, pas seulement renommé.
2. **Fermé par défaut.** Un secret absent doit faire échouer le contrôle, jamais le rendre vrai.
   Bons modèles : `verifyCronAuth` (`if (!secret) return false`, `src/lib/cron-auth.ts:11`),
   webhook Stripe (503 si non configuré), webhook Clerk (500 si secret manquant). Contre-exemple
   corrigé : `/api/cron/recipes` comparait `undefined !== undefined` (0d6fd80).
3. **Comparaison en temps constant** pour tout secret partagé (fiche OWASP Webhook, exemple Vercel)
   [S8][S13]. Modèle dans le dépôt : `secretsMatch` (`test-session-node.ts`, depuis 2364ef9) ;
   état des autres comparaisons : registre privé du programme. Forme minimale :

```ts
import { timingSafeEqual } from "node:crypto";

// Comparaison en temps constant d'un secret partagé (cron, test-mode).
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
```

4. **Pas de secret dans une URL** (ASVS 14.2.1) [S1] : il finit dans les journaux d'accès et
   l'historique. Exception existante à ne pas étendre : `GET /api/test-mode/activate?secret=…`
   (préférer le `POST` du même fichier).
5. **`CRON_SECRET`** : chaîne aléatoire d'au moins 16 caractères ; Vercel l'envoie dans
   `Authorization: Bearer …` ; chaque déploiement garde la copie du secret capturée à son build,
   donc une rotation = modifier la variable **puis redéployer**, puis vérifier le premier appel
   dans l'onglet Cron Jobs [S14].
6. **Jamais dans un journal, une réponse ou une erreur.** `handleApiError` renvoie un message
   générique (ASVS 16.5.1) ; ne pas y ajouter `error.message` d'un service tiers, qui peut contenir
   une URL signée ou une clé.
7. **Moindre privilège** (ASVS 13.3.2) : une clé par service et par environnement ; les clés de
   production ne vont ni en preview ni en local. Clerk : `pk_live`/`sk_live` uniquement en
   production (skill `clerk-auth`).
8. **Module serveur seulement** : un fichier qui lit un secret ne doit pas être importable par un
   composant client. Le paquet `server-only` fait échouer le build dans ce cas [S9] ; il est
   présent dans `node_modules` (0.0.1, dépendance de Clerk) mais **pas** déclaré dans notre
   `package.json` — l'ajouter proprement avant de l'importer.
9. **Fuite avérée** : tourner la clé chez le fournisseur, mettre à jour Vercel, redéployer,
   vérifier, puis révoquer l'ancienne ; consigner la date. Ne jamais « nettoyer » l'historique git
   à la place de la rotation.

Les agents ne lisent pas les fichiers `.env` (règle du programme) ; les noms de variables se
documentent dans `CLAUDE.md` § « Variables d'environnement ».

## 2. En-têtes de sécurité (ASVS V3.4)

État de `next.config.mjs:69-108`, appliqué à `/(.*)` :

| En-tête | Valeur actuelle | Exigence ASVS 5.0 [S1] | Verdict |
|---|---|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | 3.4.1 : ≥ 1 an, sous-domaines au niveau 2 | conforme |
| `X-Content-Type-Options` | `nosniff` | 3.4.4 | conforme |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | 3.4.5 | conforme |
| `X-Frame-Options` | `DENY` | 3.4.6 : l'en-tête est « obsolète », exiger `frame-ancestors` dans la CSP | à compléter (garder les deux) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(self)` | — | **à vérifier** : `camera=()` interdit la caméra à toutes les origines, la nôtre comprise, alors que le mode cuisine monte un lecteur de QR code (`src/components/boucher/QRScanner.tsx:56-61`, `Html5Qrcode.start({ facingMode: "environment" })`). Déduit de la sémantique de l'en-tête, **non testé dans un navigateur** ; si le scan échoue sur tablette, la valeur attendue est `camera=(self)` |
| `Content-Security-Policy` | voir § 3 | 3.4.3, 3.4.6, 3.4.7 | à durcir (§ 3) |
| `X-Powered-By` | supprimé (`poweredByHeader: false`) | 13.4.6 | conforme |
| CORS | aucun en-tête | 3.4.2 : valeur fixe ou liste blanche | conforme (même origine) |

Règles :

- Ces en-têtes sont statiques et compatibles avec le rendu statique : ne pas les déplacer dans le
  middleware (il ne tourne plus sur les pages publiques).
- Une réponse de handler qui sert autre chose que du JSON (image du proxy, fichier) fixe son
  `Content-Type` elle-même et n'est jamais du HTML (ASVS 3.2.1, 4.1.1).
- Ajouter CORS = ouvrir l'API à d'autres origines : décision du propriétaire, liste blanche, jamais
  `*` avec des cookies.

## 3. Content-Security-Policy

### Ce que fait la CSP actuelle (`next.config.mjs:95-106`)

- Écarts de sécurité par rapport à ASVS 3.4.3 / 3.4.6 (directives, sources autorisées) : registre
  privé du programme. ASVS 3.4.3 demande au minimum `object-src 'none'` et `base-uri 'none'`, et
  3.4.6 `frame-ancestors` [S1] : la cible ci-dessous les contient.
- `connect-src` autorise `https://api.anthropic.com`, que le navigateur n'appelle jamais (les
  appels partent du serveur) : entrée inutile.
- `script-src` et `connect-src` **n'autorisent pas** `https://plausible.io`, alors que
  `src/components/AnalyticsConsent.tsx:65` charge `https://plausible.io/js/script.js` quand
  `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` est défini : le script serait bloqué (déduit de la lecture, non
  observé en production).
- Hôtes Clerk : la doc demande aujourd'hui aussi `https://*.protect.clerk.com` (script, frame, et
  `connect-src` avec le suffixe `:*`), absent de notre CSP, et `https://img.clerk.com` (à nommer
  dans `img-src`) ; `'unsafe-eval'` n'est requis qu'en développement [S18].

### Ce qui est possible sans casser le rendu statique

Une CSP « stricte » repose sur un **nonce par réponse** [S10] ; or un nonce impose le rendu
dynamique de chaque page : Next désactive l'optimisation statique et l'ISR, et Clerk confirme la
même contrainte [S9][S18]. C'est incompatible avec la règle de coût CPU de `CLAUDE.md`. On garde
donc `'unsafe-inline'` sur les scripts (requis par l'App Router sans nonce [S18]) et on durcit
tout le reste :

```
default-src 'self';
base-uri 'none';
object-src 'none';
frame-ancestors 'none';
form-action 'self';
script-src 'self' 'unsafe-inline' <hôtes Clerk> https://challenges.cloudflare.com <plausible si activé>;
img-src 'self' data: blob: <notre magasin Blob> https://*.replicate.delivery https://images.pexels.com https://images.unsplash.com https://img.clerk.com;
connect-src 'self' <hôtes Clerk> https://*.sentry.io <plausible si activé>;
…
```

Ce bloc est une **proposition**, pas une configuration vérifiée. Méthode imposée :

1. L'envoyer d'abord en `Content-Security-Policy-Report-Only`, à côté de la CSP actuelle : les
   navigateurs acceptent les deux en-têtes ensemble, la seconde ne bloque rien et remonte les
   violations [S10].
2. Parcourir : connexion et inscription Clerk (dont le défi Cloudflare), mode cuisine, impression
   de ticket (iframe), upload et galerie d'images, cartes et géolocalisation, PWA / service worker,
   pages SEO avec JSON-LD.
3. `'unsafe-eval'` : le retirer en production seulement si aucune violation n'apparaît (une
   bibliothèque peut en dépendre).
4. Basculer en blocage, garder le rapport.

À chaque nouveau tiers (script, image, iframe, API appelée par le navigateur) : une entrée de CSP
dans le même commit, avec un commentaire disant qui en a besoin. Un tiers appelé **par le serveur**
n'a rien à faire dans la CSP.

## 4. Dépendances et plateforme (ASVS 15.1, 15.2 ; API8)

- **Next 14.2.35 est la dernière 14.x et n'est plus supportée** ; la 15.x est maintenue jusqu'au
  2027-01-31, la 16.x est la LTS active [S23]. Les avis publiés contre cette version ne sont
  corrigés qu'en 15.5.x / 16.x [S20] ; notre exposition à chacun est évaluée dans le registre privé
  du programme. Montée à planifier (skill `nextjs-app-router`).
- **Avant et après toute tâche de sécurité** : `npm audit --omit=dev` ; lire les avis des paquets
  touchés (`gh api "/advisories?ecosystem=npm&affects=<paquet>@<version>"`).
- **Planchers Clerk** : voir `clerk-auth/references/core3-migration.md`.
- **Automatisation** : vérifier que les alertes Dependabot et les workflows de revue de sécurité
  sont actifs sur le dépôt (action du propriétaire ; état relevé : registre privé du programme).
- ASVS 15.1.1 demande des délais de correction documentés selon la gravité [S1] : à fixer avec le
  propriétaire (proposition : critique ou élevé exploitable chez nous → dans la semaine).
- Ne jamais ajouter une dépendance pour une fonction de sécurité sans vérifier son adoption et sa
  maintenance ; préférer les API de la plateforme (`node:crypto`, `fetch`, `URL`).
