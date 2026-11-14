# Trajectoire vers Clerk Core 3 (`@clerk/nextjs` 7)

Faits vérifiés le 2026-11-13 (registre npm, changelog `clerk/javascript`, guides Clerk), relus le
2026-11-14 par le vérificateur (mêmes sources rouvertes).
Sources : [sources.md](sources.md). **Ne pas lancer cette montée sans décision du propriétaire** :
c'est un changement de majeure sur l'authentification d'un site en production.

## 1. Où nous sommes, où est Clerk

| | Installé | Dernière de la ligne | Dernière absolue |
|---|---|---|---|
| `@clerk/nextjs` | 6.39.9 (Core 2) | 6.39.9 (`dist-tag latest-v5`) | 7.10.0 (`latest` au 2026-11-14 ; 7.9.26 la veille) |
| `@clerk/backend` | 2.33.9 | — | 3.x |
| `@clerk/shared` | 3.48.1 | — | 4.x |
| Prérequis Next | `^14.2.25` accepté | — | `^15.2.8 ‖ ^15.3.8 ‖ ^15.4.10 ‖ ^15.5.9 ‖ ^16.0.10…` (le guide Core 3 dit « 15.2.3+ » ; le `peerDependencies` publié est plus strict et fait foi) |
| Prérequis Node | — | — | `>= 20.9.0` |

Conséquence : **la v7 est impossible tant que Next reste en 14**. Next 14 est par ailleurs hors
support (« unsupported ») ; Next 15 est en maintenance jusqu'au 2027-01-31 ; Next 16 est la LTS
active [C21]. L'ordre est donc : Next 15.5.x (cf. `nextjs-app-router/references/next15-next16.md`)
**puis** Clerk 7, jamais les deux dans le même déploiement.

## 2. Pourquoi il ne faut pas traîner indéfiniment

- La ligne v6 reçoit encore des correctifs de sécurité (le dernier, GHSA-wpqf-h9rq-rg73, est du
  2026-11-12 et a bien été publié en `@clerk/backend` 2.33.9) [C6], mais Core 1 n'en reçoit plus :
  c'est le sort qui attend Core 2 un jour.
- `createRouteMatcher()` — le cœur de notre middleware — est **déprécié depuis 7.5.14** et
  « sera retiré dans la prochaine majeure » ; raison donnée par Clerk : la correspondance de
  chemins en middleware « peut diverger de la façon dont Next.js route les requêtes et laisser des
  ressources protégées atteignables » [C2][C3].
- Next 14.2.35 cumule des avis de sécurité 2026 sans correctif en 14.x (exposition : registre
  privé du programme).

## 3. Planchers de version à ne jamais franchir vers le bas (ligne v6)

| Avis | Sujet | Corrigé en | Notre exposition avant correctif |
|---|---|---|---|
| GHSA-vqx2-fgx2-5wq9 (CVE-2026-41248, critique) [C4] | contournement de `createRouteMatcher` par requête forgée | `@clerk/nextjs` 6.39.2, `@clerk/shared` 3.47.4 | **oui** : forme `if (matcher(req))` exactement la nôtre |
| GHSA-w24r-5266-9c3c (CVE-2026-42349, élevé) [C5] | `has()` / `auth.protect()` combinant plusieurs conditions | `@clerk/nextjs` 6.39.3, `@clerk/shared` 3.47.5 | non (nous n'utilisons ni Organizations ni `has()`), mais plancher à tenir |
| GHSA-wpqf-h9rq-rg73 (moyen, 2026-11-12) [C6] | jeton OIDC d'identité accepté comme jeton de session | `@clerk/backend` 2.33.9 | seulement si l'instance émet des jetons OIDC (application OAuth avec scope `openid`) ; plancher atteint |
| GHSA-9mp4-77wg-rwx9 (CVE-2025-53548, élevé) [C7] | `verifyWebhook()` acceptait des signatures invalides | `@clerk/backend` 2.4.0, `@clerk/nextjs` 6.23.3 | non (nous vérifions avec `svix`), plancher atteint |

Vérifier après toute opération sur le lockfile (lecture du fichier : `require('@clerk/nextjs/package.json')`
échoue avec `ERR_PACKAGE_PATH_NOT_EXPORTED`) :
`node -e "for (const p of ['nextjs','backend','shared']) console.log(p, JSON.parse(require('fs').readFileSync('node_modules/@clerk/'+p+'/package.json','utf8')).version)"`
— ou `npm ls @clerk/nextjs @clerk/backend @clerk/shared`.

## 4. Inventaire de ce que la v7 casse chez nous [C3][C8]

| Changement v7 | Nos occurrences | Travail |
|---|---|---|
| Next ≥ 15.2.8 (peerDependencies de la 7.x publiée), Node ≥ 20.9 | Next 14.2.35 | montée Next d'abord |
| `<ClerkProvider>` doit être **dans** `<body>` | `src/app/layout.tsx:151` enveloppe `<html>` | déplacer (l'outil `npx @clerk/upgrade` le fait) |
| `<SignedIn>`, `<SignedOut>`, `<Protect>` → `<Show when=…>` | aucune | rien |
| Props `afterSignInUrl` / `afterSignUpUrl` / `redirectUrl` retirées | aucune (nous utilisons `fallbackRedirectUrl`) | rien |
| `UserButton afterSignOutUrl` retiré | `decouvrir/ClerkAuthButton.tsx:13`, `components/layout/BottomNav.tsx:95` | `<ClerkProvider afterSignOutUrl="/">` |
| `@clerk/types` → sous-chemin `/types` du SDK | aucun import direct | rien |
| `useAuth().getToken` lève pendant le SSR ; `getToken()` lève `ClerkOfflineError` hors ligne | aucun usage de `getToken` | rien (à surveiller pour la PWA hors ligne) |
| `auth.protect()` : 401 au lieu de 404 pour une Server Action non authentifiée | aucune Server Action maison | rien |
| `secretKey` passé à `clerkMiddleware` exige `CLERK_ENCRYPTION_KEY` | non utilisé | rien |
| `createRouteMatcher` déprécié (7.5.14), avertissement en développement | 8 appels dans `src/middleware.ts` | § 5 |
| `@clerk/localizations` (import `frFR`) | `src/app/layout.tsx` | vérifier la version compagne de la v7 (non vérifié ici) |
| Nouveaux hôtes CSP (`*.protect.clerk.com`) [C18] | CSP statique `next.config.mjs` | ajouter et tester en préproduction |

La surface est petite : l'essentiel du coût est la montée Next et la refonte du middleware.

## 5. Sortir de `createRouteMatcher` sans rouvrir la panne CPU

Ce que demande le guide de migration [C2] : chaque ressource serveur fait son propre contrôle —
pages, Route Handlers (« chaque fonction de verbe HTTP exportée »), Server Functions ; protéger
uniquement les layouts « ne suffit pas, car ils ne se re-rendent pas toujours avec les pages » ;
`clerkMiddleware()` et `config.matcher` restent requis ; une redirection anticipée des anonymes en
middleware reste permise comme **optimisation**, pas comme garantie ; la logique de chemin non liée
à l'auth passe par `req.nextUrl.pathname`.

Traduction chez nous, par étapes sûres :

1. **Maintenant (v6)** : tenir la règle 1 du skill. 169 de nos 188 handlers appellent déjà un
   helper d'auth (comptage par recherche de texte, 2026-11-14) ; les 19 autres sont publics,
   signés ou désactivés. Toute nouvelle route fait de même. C'est la moitié de la migration, sans
   risque.
2. **Avec la montée Next 15** : remplacer les `createRouteMatcher` par une fonction locale pure sur
   `req.nextUrl.pathname` (préfixes exacts : `p === "/admin" || p.startsWith("/admin/")`),
   testée par `middleware-matcher.test.ts`. Le middleware garde son rôle de redirection optimiste
   et de liste blanche ; plus aucune dépendance à l'API dépréciée.
3. **Décision du propriétaire** (point à arbitrer n° 1 du skill) : garde serveur dans les pages
   des back-offices, ou maintien des coquilles statiques dont toutes les données passent par
   l'API. La seconde option respecte l'esprit du guide (les données sont protégées à la ressource)
   et la règle de coût CPU ; la première ajoute une exécution de fonction par navigation.
4. **Puis** `npx @clerk/upgrade` (à lancer avant toute retouche manuelle, d'après le guide [C8]),
   sur une branche, avec une préproduction branchée sur l'instance Clerk de développement.

## 6. Recette de validation d'une montée Clerk (mineure ou majeure)

1. `npm run typecheck`, `npm run test` (dont `middleware-matcher`), `npm run build`,
   `scripts/check-prerender.mjs` : les pages publiques restent prérendues.
2. Déconnecté, sur la préproduction : `/admin` → `/admin-login` ; `/boucher/dashboard` →
   `/espace-boucher` ; `/checkout` → connexion ; `/%61dmin/dashboard` et `/admin%2Fdashboard` → 400,
   redirection ou 404, **jamais** 200 ; `/admin/%ff` → 400 et non 500.
3. Connecté client : commande de bout en bout, `/commandes`, `/profil`, déconnexion.
4. Connecté boucher : mode cuisine (polling), une mutation catalogue.
5. Connecté admin : `/webmaster`, un changement de rôle, vérifier l'effet sous 60 s.
6. Webhook : « Send example » `user.created` depuis le dashboard Clerk → 200 ; signature fausse → 401.
7. Mode test : activation par secret, bascule de rôle, puis désactivation.
8. Après mise en production : journaux Vercel du middleware (pas de 500), quota CPU inchangé le
   lendemain (skill `vercel-cost-performance`).
