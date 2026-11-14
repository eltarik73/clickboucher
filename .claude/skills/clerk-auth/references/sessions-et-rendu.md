# Sessions Clerk, pages statiques et mise en production

Sources : [sources.md](sources.md). Complète `nextjs-app-router` (rendu) sans le répéter.

## 1. Le modèle de session en quatre faits [C11]

1. **Deux jetons.** Un jeton client longue durée, cookie `__client`, httpOnly, posé sur le domaine
   de l'API Frontend Clerk (chez nous `clerk.klikandgo.app`) ; un **jeton de session** court, cookie
   `__session` sur notre domaine, non httpOnly (le SDK doit le lire), `SameSite=Lax`.
2. **60 secondes.** Le jeton de session expire au bout de 60 s ; clerk-js le renouvelle toutes les
   50 s tant que l'onglet vit.
3. **Hybride.** La session est en base chez Clerk (révocable), le jeton est un JWT vérifié
   localement (rapide). La révocation n'atteint donc nos serveurs qu'à l'expiration du jeton en
   cours : compter jusqu'à 60 s (déduction, la doc ne chiffre pas ce délai).
4. **Handshake.** Quand une requête **document** arrive avec un jeton expiré (onglet rouvert après
   quelques minutes), `clerkMiddleware` renvoie une redirection vers l'API Frontend, qui valide
   `__client`, réémet un jeton, et renvoie vers la page.

## 2. Ce que cela implique sur nos pages

| Type de page | Dans le matcher ? | Côté serveur | Côté client |
|---|---|---|---|
| Publique statique / ISR (`/`, villes, recettes, `/panier`) | non | aucun Clerk, HTML en cache | `useAuth()` passe de `isLoaded:false` à l'état réel après chargement de clerk-js |
| Coquille connectée (`/boucher/**`, `/admin/**`, `/webmaster/**`) | oui | middleware : redirection selon rôle ; handshake si jeton expiré | appels API après `isLoaded && isSignedIn` |
| Page serveur authentifiée (`/suivi/[id]`, `/admin-login`) | oui (obligatoire) | `getServerUserId()` → `auth()` | — |
| Connexion (`/sign-in`, `/sign-up`) | oui | Clerk gère | composants `<SignIn>` / `<SignUp>` |

Règles pratiques :

- **Pas de prop `dynamic` sur `<ClerkProvider>`** (règle `CLAUDE.md`). Clerk lui-même déconseille
  d'envelopper toute l'application avec, et recommande de la limiter au layout des routes qui en
  ont besoin [C13]. Chez nous : jamais, sans arbitrage du propriétaire.
- **`auth()` rend la route dynamique** (« opts your entire route into dynamic rendering ») [C13].
  Ne jamais l'appeler, même indirectement via `getServerUserId()`, dans un layout partagé ou une
  page publique : c'est le chemin le plus court vers la panne du 2026-11-05.
- **Premier rendu client = inconnu.** Écrire trois états, pas deux :

  ```tsx
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <Skeleton />;          // ni « connecté » ni « déconnecté »
  return isSignedIn ? <Compte /> : <SeConnecter />;
  ```

  Afficher « Se connecter » pendant `!isLoaded` fait clignoter l'interface des utilisateurs
  connectés ; lancer un `fetch` pendant `!isLoaded` part avec un jeton peut-être périmé (401) et
  facture un middleware + une fonction pour un anonyme.
- **Effets** : mettre `isLoaded` et `isSignedIn` dans les dépendances. Avec `[]`, un utilisateur
  connecté sur une page hors matcher ne récupère jamais ses données (bug du panier corrigé dans
  `src/lib/hooks/use-cart.tsx`) [L2].
- **Mode test** : Clerk dit « déconnecté » ; le drapeau client est `hasTestModeCookie()`
  (`src/lib/test-mode-client.ts`). La condition complète est
  `(isLoaded && isSignedIn) || hasTestModeCookie()`.
- **Liens vers une page du matcher** (`/sign-in`, `/commandes`, `/profil`) depuis une page
  publique : `prefetch={false}`, sinon chaque affichage déclenche un préchargement qui exécute le
  middleware [L2].
- **Une page qui déclenche un `fetch` authentifié dès le montage** et qui est une cible de lien
  profond (e-mail, notification push) doit soit rester dans le matcher (handshake sur la requête
  document), soit attendre `isSignedIn`. `/panier` a quitté le matcher grâce à la seconde option.

## 3. Redirections de connexion

- Connexion par défaut : `<SignIn fallbackRedirectUrl="/onboarding" />` ; `/onboarding` (dans le
  matcher) renvoie les rôles déjà connus vers leur espace (`middleware.ts:141-154`).
- Retour vers la page d'origine : liens `/sign-in?redirect_url=/chemin` (9 usages). Toujours un
  chemin **relatif** écrit en dur ; ne jamais y injecter une valeur venue de l'utilisateur.
  L'option `allowedRedirectOrigins` de `<ClerkProvider>` valide les URL de redirection fournies
  contre une liste de domaines et retombe sur la redirection par défaut sinon
  (`node_modules/@clerk/shared/dist/types/index.d.ts:9166-9168`) [L1] ; non configurée chez nous.
- Props dépréciées à ne plus écrire : `afterSignInUrl`, `afterSignUpUrl`, `redirectUrl` →
  `fallbackRedirectUrl` / `signUpFallbackRedirectUrl` / `forceRedirectUrl` [C8]. Il reste
  `<UserButton afterSignOutUrl="/">` à deux endroits (`decouvrir/ClerkAuthButton.tsx:13`,
  `components/layout/BottomNav.tsx:95`) : à migrer vers `<ClerkProvider afterSignOutUrl="/">` lors
  de la montée Core 3.
- `auth.protect()` : redirige une requête document vers la connexion, répond **404** à une requête
  non document non authentifiée (API) [L1][C2]. Dans nos routes API on ne l'utilise pas : nos
  helpers renvoient `401`/`403` au format `apiError`.

## 4. CSRF, cookies, origines

- Les cookies de session Clerk sont `SameSite=Lax` ; Clerk précise que cela protège de « la
  plupart » des attaques CSRF et que « la navigation seule ne doit jamais déclencher une mutation »
  [C17]. Conséquence : **aucun `GET` ne modifie l'état** (exception connue et protégée par secret :
  `GET /api/test-mode/activate`).
- `authorizedParties` : liste blanche d'origines vérifiée contre le claim `azp` du jeton ; protège
  d'un sous-domaine compromis ; « highly recommended » [C16]. Non configuré chez nous (point à
  arbitrer). Attention aux previews Vercel et à `localhost` : la liste doit venir de
  l'environnement. Ce n'est pas une barrière complète sur notre ligne : `azp` peut être absent
  quand l'en-tête `Origin` est vide [C14], et `@clerk/backend` 2.x laisse alors passer le jeton
  (constaté dans le code installé, confirmé par [C6]).

## 5. CSP et domaines Clerk

Notre CSP est statique, dans `next.config.mjs:95-106`. Hôtes Clerk attendus par la doc [C18] :
API Frontend (`https://clerk.klikandgo.app`) en `script-src` et `connect-src`,
`https://challenges.cloudflare.com` en `script-src` et `frame-src`, `https://img.clerk.com` en
`img-src`, `worker-src 'self' blob:`, `style-src 'unsafe-inline'`. La doc ajoute aujourd'hui
`https://*.protect.clerk.com` (script, connect avec `:*`, frame) : **absent** de notre CSP, à
vérifier sur une préproduction avant d'y toucher. `'unsafe-eval'` n'est requis qu'en développement
[C18] (durcissement de notre CSP : `security-multitenant`).
Une CSP à nonce impose le rendu dynamique de toutes les pages [C18] : incompatible avec la règle de
coût CPU.

## 6. Production : la liste de contrôle Clerk [C16]

- Instance de **production** : clés `pk_live_…` / `sk_live_…`. Des clés `pk_test_…` en production
  = instance de développement. Vérification sans lire de fichier `.env` : dans le HTML de la page de connexion, l'URL
  du script clerk-js pointe vers `clerk.klikandgo.app` (production) et non vers
  `*.clerk.accounts.dev`.
- Identifiants OAuth propres pour chaque fournisseur social : ceux, partagés, du mode
  développement « ne sont pas sûrs » en production.
- Webhook : point de terminaison et **secret de signature de l'instance de production**.
- DNS : enregistrements de la page Domains du dashboard ; sur Cloudflare, mode « DNS only ».
- `authorizedParties` (cf. § 4).
- Limites de l'API Backend : 1000 requêtes / 10 s en production, **100 / 10 s en développement** ;
  dépassement = `429` avec `Retry-After` [C12]. `currentUser()` et `clerkClient().users.getUser()`
  comptent : ne jamais les appeler dans une boucle ni sur un chemin chaud sans cache.

## 7. Diagnostic rapide

| Symptôme | Cause la plus probable ici | Vérifier |
|---|---|---|
| « auth() was called but Clerk can't detect usage of clerkMiddleware() » | le chemin n'est pas dans `config.matcher` | ajouter le chemin (page) ou retirer l'import du helper (handler exclu) |
| 401 sur le premier appel API d'une page, puis OK | `fetch` lancé avant `isLoaded` | règle `isLoaded && isSignedIn` |
| 307 inattendu sur une page publique | préfixe de matcher trop large | motifs stricts ; test `never` |
| Rôle correct en base, accès refusé à `/admin` | metadata Clerk non mises à jour, ou cache 60 s | chemin canonique du rôle ; attendre 60 s ; `invalidateRoleCache` |
| Rôle retiré en base, accès toujours accordé | metadata Clerk encore à `admin` (`requireAdmin`, middleware) | mettre à jour les metadata |
| Utilisateur connecté mais « introuvable » (404) dans une route boucher | ligne `User` absente (webhook, défaut W2) | `getOrCreateUser`, défaut W2 |
| Boucle `/sign-in` ↔ page | page protégée qui redirige elle-même + middleware | une seule autorité de redirection par chemin |
| 500 sur une URL mal encodée | `createRouteMatcher` appelé hors `try/catch` | `middleware.ts:220-226` |
| Tout fonctionne en mode test, casse avec un vrai compte | le mode test contourne `clerkMiddleware` et `auth()` | rejouer le parcours avec un compte Clerk réel |
