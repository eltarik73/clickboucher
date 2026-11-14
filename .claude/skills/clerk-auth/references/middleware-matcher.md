# Middleware et matcher — anatomie et procédures

Fichier : `src/middleware.ts` (279 lignes, branche de travail du 2026-11-14, numéros de ligne
revérifiés un à un le même jour). Test : `src/lib/__tests__/middleware-matcher.test.ts`.
Sources : [sources.md](sources.md).

## 1. Ordre d'évaluation d'une requête

Next décide **d'abord** si le middleware s'exécute, à partir de `config.matcher` appliqué au chemin
**brut** ; ensuite seulement notre code tourne [L2].

```
requête ──► config.matcher (liste blanche, littéraux)
            │ non → le middleware ne tourne pas : aucune règle, aucun contexte Clerk
            ▼ oui
        middleware()                                   src/middleware.ts:207
          1. cookie de mode test valide ?  → next()    :209   (Clerk court-circuité)
          2. %2F ou %5C dans le chemin ?    → 400       :213
          3. isPublicRoute(req) (try/catch) → next()    :220-229
          4. handleClerkAuth = clerkMiddleware(...)     :232
               sign-in / sign-up            → rien      :136
               /onboarding                  → sign-in ou redirection selon rôle   :141-154
               /admin, /webmaster           → /admin-login ou /                   :157-180
               /boucher                     → /espace-boucher ou /                :183-193
               /checkout /commandes /profil /chat → auth.protect()                :196-201
               le reste (dont /api/**)      → passe, avec le contexte Clerk       :203
```

Conséquences à garder en tête :

- **Le matcher gagne.** Une règle `createRouteMatcher` sans entrée correspondante dans
  `config.matcher` ne s'exécute jamais. Les deux listes ne peuvent pas partager une constante :
  Next n'accepte que des littéraux analysables statiquement, sinon il retombe sur « tout matcher »
  (retour du problème de coût) [L2].
- **`/api/**` n'est gardé par aucune règle du middleware.** Le middleware y sert uniquement à ce
  que `auth()` fonctionne. L'autorisation est dans chaque handler.
- **Hors matcher, `auth()` lève** « Clerk: auth() was called but Clerk can't detect usage of
  clerkMiddleware() » (`node_modules/@clerk/nextjs/dist/cjs/server/errors.js:49`) [L1].
- En mode test activé, `clerkMiddleware` ne tourne pas du tout : seuls les helpers de
  `server-auth.ts` savent répondre.

## 2. Ce que contient `config.matcher` et pourquoi

| Entrées | Raison |
|---|---|
| `/admin`, `/admin/(.*)`, `/webmaster`, `/webmaster/(.*)`, `/boucher`, `/boucher/(.*)`, `/onboarding`, `/checkout(.*)`, `/commandes(.*)`, `/profil(.*)`, `/chat(.*)` | Mêmes chaînes que les règles de garde (le test l'exige) |
| `/admin-login`, `/suivi/(.*)` | Leur Server Component appelle `getServerUserId()` → `auth()` |
| `/sign-in(.*)`, `/sign-up(.*)` | Comportement Clerk inchangé |
| `/commande/(.*)`, `/shop/offers`, `/dashboard/marketing` | Pages connectées qui lancent un `fetch` authentifié au montage : on garde le rafraîchissement de session sur la requête document |
| `/((?!_next/).*%[0-9A-Fa-f]{2}.*)` | Tout chemin percent-encodé repasse par les règles (ferme `/%61dmin/…`) |
| Entrée API (littéral exact sous le tableau) | Toute l'API sauf les handlers qui n'appellent jamais Clerk : `cron`, `webhooks/`, `payments/webhook`, `health`, `test-mode/`, `geo`, `shops/nearby` |

Littéral de l'entrée API (ne pas le recopier de mémoire) :

```
/api/((?!cron(?:/|$)|webhooks/|payments/webhook$|health$|test-mode/|geo$|shops/nearby$).*)
```

## 3. Classes de contournement connues (toutes rencontrées ici)

| Classe | Exemple | Pourquoi ça passait | Fermeture |
|---|---|---|---|
| Préfixe trop large | `/boucher(.*)` attrape `/boucheries-halal/rhone` | `(.*)` collé au mot n'exige pas de `/` ; Clerk le documente depuis 7.5.13 et suggère désormais `/x/:path*` [C3] | motifs `"/x"` + `"/x/(.*)"` |
| Exclusion par extension | `/admin/shops/x.css` | l'ancien matcher excluait tout chemin contenant `.css`, alors que la route dynamique accepte les points [L2] | liste blanche par préfixe |
| Percent-encodage | `/%61dmin/dashboard`, `/admin%2Fdashboard` | le matcher voit le chemin brut, le routeur résout le chemin décodé ; `createRouteMatcher` < 3.47.4 ne normalisait pas (GHSA-vqx2-fgx2-5wq9, CVSS 9.1) [C4][L2] | Clerk 6.39.9 + entrée percent-encodée + rejet `%2F`/`%5C` |
| Encodage invalide | `/boutique/%`, `/admin/%ff` | depuis `@clerk/shared` 3.47.4 le matcher **lève** `MalformedURLError` ; hors `clerkMiddleware` rien ne la rattrape → 500 [L3] | `try/catch` → 400 |
| En-tête interne Next | `x-middleware-subrequest` | CVE-2025-29927 : contournement de toute autorisation faite en middleware, corrigé en 14.2.25, déploiements Vercel protégés d'office [C20] | Next 14.2.35 + règle 1 du skill |
| Server Functions | appel par identifiant, pas par chemin | le middleware ne voit pas le « chemin protégé » [C2] | nous n'écrivons pas de Server Action ; si un jour oui, contrôle dans la fonction |

Non vérifié localement : la résolution par Vercel des variantes de casse (`/ADMIN/…`) et de la forme
`.rsc` d'une page racine (`/admin.rsc`). L'audit recommande, après chaque déploiement touchant le
middleware, `curl -sI https://klikandgo.app/ADMIN/dashboard` → 404 ou 307, jamais 200 [L2].

## 4. Procédure — ajouter une famille de pages protégées

1. Décider si la page a réellement besoin du middleware : une coquille client dont toutes les
   données viennent d'API protégées peut rester hors matcher **si** elle ne lance aucun appel avant
   `isLoaded && isSignedIn` et si l'on accepte qu'un anonyme voie la coquille vide.
2. Sinon, dans `src/middleware.ts` : ajouter les deux motifs stricts à la bonne liste
   `createRouteMatcher` (`"/x"`, `"/x/(.*)"`), **puis les mêmes chaînes** dans `config.matcher`.
3. Si un rôle est requis, ajouter la branche dans `handleClerkAuth` en copiant celle de
   `/webmaster` (redirection, jamais `auth.protect()` seul : il ne connaît pas nos rôles).
4. `src/lib/__tests__/middleware-matcher.test.ts` : la liste `GUARDED` couvre déjà les cinq listes
   existantes ; pour une **nouvelle** liste, l'ajouter à `GUARDED`, et ajouter un chemin d'exemple
   dans `must`.
5. Vérifier qu'aucune page publique ne commence par le même préfixe
   (`rg --files src/app | rg "/x"`), sinon elle sera redirigée.
6. `npm run test -- middleware-matcher`, `npm run build`, puis les essais déconnectés du § 11 du skill.
7. SEO : une page protégée ne doit pas figurer au sitemap ; toute modification de `robots.ts` suit
   les skills `seo-anti-penalty` et `seo-expert`, pas celui-ci.

## 5. Procédure — exclure un handler API du matcher

À ne faire que pour un handler appelé en masse sans session (webhook, cron, sonde, endpoint
purement public), parce que chaque exécution du middleware est facturée.

1. Le handler et **toute sa fermeture d'imports** ne doivent atteindre ni `server-auth.ts`, ni
   `boucher-auth.ts`, ni `admin-auth.ts`, ni un import de valeur `auth`/`currentUser` de Clerk.
2. Ajouter l'alternative dans le lookahead de la dernière entrée du matcher, avec une ancre
   (`$` ou `/`) pour ne pas exclure les voisins (`/api/health` mais pas `/api/healthz`).
3. Ajouter le chemin à la liste `never` du test et un voisin à la liste `must`.
4. Donner au handler son propre contrôle : signature, `verifyCronAuth`, ou rate limit s'il est public.

## 6. Ce qu'il ne faut pas faire dans ce fichier

- Appeler un `createRouteMatcher` **hors** de `clerkMiddleware` sans `try/catch`.
- Reconstruire un matcher à chaque requête (les déclarer au niveau module).
- Ajouter une requête Prisma : le middleware tourne sur le runtime Edge et sur chaque requête
  protégée ; Next recommande de n'y lire que la session, sans base [C19].
- Envelopper le middleware avec Sentry (`autoInstrumentMiddleware: false` est volontaire).
- Remettre un matcher « négatif » (tout sauf …) : c'est la cause de la panne du 2026-11-05.
- Passer `secretKey`/`publishableKey` en option de `clerkMiddleware` : en Core 3 cela exige en plus
  `CLERK_ENCRYPTION_KEY` [C8] ; nous utilisons les variables d'environnement.

## 7. Options de `clerkMiddleware` utiles (présentes en 6.39.9) [L1][C1]

| Option | Usage | Statut chez nous |
|---|---|---|
| `authorizedParties: string[]` | liste blanche d'origines comparée au claim `azp` ; protège de l'attaque « subdomain cookie leaking » ; « highly recommended » en production [C16]. Limite en Core 2 : un jeton **sans** `azp` passe le contrôle (`@clerk/backend` 2.33.9, `assertAuthorizedPartiesClaim` ; confirmé par l'avis [C6]) | **absent** — point à arbitrer |
| `clockSkewInMs` | tolérance d'horloge (5000 ms par défaut) | défaut |
| `debug: true` | journal détaillé, en local uniquement | absent |
| `contentSecurityPolicy` | injecte une CSP compatible Clerk ; le mode `strict` génère un nonce par requête, ce qui force le rendu dynamique [C18] | **ne pas activer** (contraire à la règle de coût CPU) |

Forme compatible avec notre fichier (second argument de `clerkMiddleware`) :

```ts
const handleClerkAuth = clerkMiddleware(
  async (auth, req) => {
    /* … */
  },
  { authorizedParties: ["https://klikandgo.app"] } // à piloter par variable d'environnement
);
```
