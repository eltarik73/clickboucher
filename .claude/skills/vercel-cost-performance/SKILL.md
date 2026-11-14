---
name: vercel-cost-performance
description: >-
  Coût et capacité Vercel pour Klik&Go. À charger AVANT de toucher à src/middleware.ts
  (config.matcher), vercel.json (crons, régions, maxDuration), next.config.mjs (images, en-têtes,
  Sentry), au mode de rendu d'une page (revalidate, generateStaticParams, force-dynamic, cookies ou
  auth dans un layout), aux en-têtes Cache-Control d'une route API, à un polling, un setInterval ou
  un flux SSE, aux liens en masse (prefetch), ou quand il est question de facture Vercel, quota,
  Fluid Active CPU, invocations, requêtes CDN, ISR, optimisation d'images, robots et scrapers,
  pare-feu, limitation de débit, Spend Management, plan Hobby ou Pro, erreur 402
  DEPLOYMENT_DISABLED ou 503 DEPLOYMENT_PAUSED, mesure de l'usage par route. Contient les règles de
  décision, les limites par plan, les erreurs de la panne du 2026-11-05 et deux scripts de contrôle.
---

# Coût et capacité Vercel — Klik&Go

Le 2026-11-05 le site a été coupé (`402 DEPLOYMENT_DISABLED`) pour dépassement du quota de CPU,
avec un trafic humain presque nul et aucun commit depuis 146 jours. Ce skill sert à ce que cela ne
se reproduise pas quand le produit grandit. CLAUDE.md (§ « Coût CPU Vercel ») fait foi en cas de doute.
Dépôt vérifié à `2364ef9` ; prix et quotas relus dans la documentation Vercel le 2026-11-13.

Skills voisins : `nextjs-app-router` (mécanique du rendu), `web-performance`,
`order-lifecycle-realtime` (polling, SSE), `background-jobs-notifications` (crons),
`reliability-observability` (sondes, incidents), `clerk-auth` et `security-multitenant` (ce que le
middleware protège), `seo-anti-penalty` et `seo-expert` (**obligatoires avant toute action sur les
robots, `robots.ts` ou le sitemap**). Skill cité encore absent du dépôt : s'en tenir à CLAUDE.md.

## 1. Le modèle mental

1. **Vercel facture des exécutions.** Toute requête compte comme requête CDN ; s'y ajoutent le CPU
   et la mémoire dès que le middleware ou une fonction tourne (route API, page `ƒ`, régénération
   ISR, cron). Un robot paie le même prix qu'un client.
2. **À faible trafic, chaque exécution est un démarrage à froid** : environ 50 ms de CPU pour le
   middleware contre 0,2 ms à chaud ; plusieurs centaines de ms pour une fonction qui charge Sentry,
   Clerk et Prisma (mesures locales de l'audit, pas la production). On réduit le coût en
   **supprimant des exécutions**, pas en accélérant le code.
3. **Le compteur qui lâche en premier est le CPU actif** (4 h par mois sur Hobby, pour toute
   l'équipe), bien avant les invocations ou les requêtes CDN.
4. **Le middleware passe avant le cache** : une réponse en cache paie quand même le middleware si
   son chemin est dans le matcher.
5. **Le CPU ne compte pas l'attente (base, Redis, e-mail) ; la mémoire, si.** Une connexion tenue
   ouverte facture de la mémoire tout le temps.

Détail des compteurs, prix et quotas : [references/facturation-vercel.md](references/facturation-vercel.md).

## 2. Règles de décision

| Situation | Règle | Pourquoi |
| --- | --- | --- |
| Nouvelle page publique | Statique ou ISR. Segment dynamique : `revalidate` **et** `generateStaticParams`. Ajouter un chemin à `REQUIRED_ROUTES` (`scripts/check-prerender.mjs`) | une page `ƒ` = une fonction par vue, robots compris |
| Fenêtre ISR | La plus longue compatible avec la fraîcheur ; jamais sous 300 s sans chiffrer `86 400 / revalidate` régénérations par chemin et par jour | fenêtre plus courte que l'intervalle entre deux visites = une fonction par visite |
| Nouvelle famille protégée | L'ajouter au `createRouteMatcher` **et** à `config.matcher`, puis lancer le test du matcher | hors matcher, la route n'est plus gardée ; matcher trop large = panne |
| Nouveau GET d'API identique pour tous | `apiCached(...)` sur toutes les branches, aucun import d'auth, chemin exclu du matcher, paramètres normalisés | sinon un HIT du CDN paie encore le middleware, ou ne se produit jamais |
| Réponse qui dépend de l'utilisateur | Jamais de cache partagé (`apiCached`, `s-maxage`, Redis à clé commune) | la clé de cache du CDN ne contient pas les cookies : fuite de données |
| Composant client sur page publique | Aucun `fetch("/api/…")` au montage sans `(isLoaded && isSignedIn) \|\| hasTestModeCookie()` | chaque appel = middleware + fonction, pour une réponse vide |
| Rafraîchissement périodique | `useVisiblePolling` ; jamais de `setInterval` nu qui appelle le réseau | un onglet oublié appelle l'API jour et nuit |
| Besoin de temps réel | Polling court conscient de la visibilité, pas de connexion tenue ouverte, sauf arbitrage | SSE = mémoire facturée en continu + reconnexion toutes les 30 s (`maxDuration`) |
| Liens en masse (pied de page, navigation latérale, longues listes) | `prefetch={false}` | tout lien visible est préchargé en production |
| Nouveau cron | Quotidien au plus tant que le plan n'est pas confirmé Pro ; `verifyCronAuth` ; ne pas modifier `updatedAt` sans changement de contenu | Hobby refuse le déploiement sinon ; un `lastmod` qui bouge fait recrawler tout le site |
| Trafic robot gênant | Règle de pare-feu (gratuite, en amont), d'abord en mode Log | bloquer dans le middleware ou dans la fonction, c'est déjà payer l'exécution |
| Nouvelle dépendance importée par le middleware | Refuser sauf nécessité prouvée | chaque kB se paie à chaque démarrage à froid |
| Optimisation de coût envisagée | Mesurer avant, chiffrer avec `capacity.mjs`, mesurer après | l'audit n'a jamais su quelle route consommait le CPU en production |

## 3. À ne jamais faire (et pourquoi)

- **Prop `dynamic` sur `<ClerkProvider>`** (`src/app/layout.tsx`) : 298 routes sur 308 étaient
  devenues des fonctions. Conséquence à assumer : `useAuth()` vaut `isLoaded: false` au premier rendu.
- **Matcher attrape-tout** (`"/((?!_next…).*)"`, `"/(.*)"`) ou entrée construite par une variable :
  Next n'analyse que des constantes, une valeur dynamique est ignorée.
- **`cookies()`, `headers()`, `auth()` dans un layout partagé**, ou `force-dynamic` sur une page publique.
- **`export const runtime = "edge"`** sur une page ou une route de métadonnées : plus de prérendu.
- **`new Date()`, `Date.now()`, `Math.random()` dans le rendu d'une page ISR** : le HTML change à
  chaque régénération, donc une écriture ISR facturée à chaque fois.
- **Réparer un build sans base par des `try/catch` à valeur par défaut** : des listes vides et des
  `noindex` seraient figés dans le cache ISR.
- **Ré-instrumenter le middleware avec Sentry** (`autoInstrumentMiddleware`, `sentry.edge.config`).
- **Refuser les robots d'IA ou toucher à `robots.ts`** pour économiser : règle GEO du propriétaire.
- **Poser une règle de pare-feu sans la consigner** dans la PR ou `DEPLOY.md`.
- **Héberger une sonde de disponibilité dans le projet** : elle s'arrête avec lui.

Toutes les erreurs de la panne et leur garde-fou : [references/panne-2026-11-05.md](references/panne-2026-11-05.md).

## 4. Patrons de code (compilés avec next 14.2.35 à `2364ef9`)

Écrits avec les helpers présents aujourd'hui ; quand les fabriques `openRoute` / `cronRoute` du skill
`api-route-conventions` existeront (`src/lib/api/route-open.ts`, absent à ce jour), passer par elles.

**Famille protégée** — deux endroits de `src/middleware.ts`, même chaîne, puis le test :

```ts
const isProtectedRoute = createRouteMatcher(["/checkout(.*)", "/commandes(.*)", "/profil(.*)", "/chat(.*)", "/factures(.*)"]);
export const config = { matcher: [/* … entrées existantes … */ "/factures(.*)"] }; // puis test du matcher (§ 6)
```

**GET public cacheable** — le fichier et tout ce qu'il importe ignorent Clerk ; ajouter le chemin à
l'exclusion de l'entrée `/api/(` du matcher (`…|shops/nearby$|shops/by-city$).*)`) :

```ts
// src/app/api/shops/by-city/route.ts (exemple)
import { NextRequest } from "next/server";
import { apiCached, handleApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const city = (req.nextUrl.searchParams.get("city") ?? "").trim().toLowerCase(); // clé normalisée
    const shops = await prisma.shop.findMany({
      where: { visible: true, city: { equals: city, mode: "insensitive" } },
      select: { id: true, slug: true, name: true },
      take: 50,
    });
    return apiCached(shops, 300); // public, s-maxage=300, stale-while-revalidate=600
  } catch (error) {
    return handleApiError(error);
  }
}
```

**Page ISR sur segment dynamique** (`src/app/boucherie-halal/[ville]/page.tsx`, existant) :

```tsx
export const revalidate = 3600;
export async function generateStaticParams() {
  return SEO_CITIES.map((city) => ({ ville: city.slug })); // ou `return []` : ISR à la première visite
}
```

**Composant client** — aucun appel anonyme, polling conscient de la visibilité :

```tsx
"use client";
import { useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";
import { hasTestModeCookie } from "@/lib/test-mode-client";

export function UnreadBadge() {
  const { isLoaded, isSignedIn } = useUser();
  // hasTestModeCookie() : indice d'interface, jamais une preuve (le serveur exige le jeton signé, 2364ef9)
  const canPoll = (isLoaded && !!isSignedIn) || hasTestModeCookie();
  const refresh = useCallback(async () => {
    const res = await fetch("/api/notifications");
    return res.ok; // false → backoff
  }, []);
  useVisiblePolling(refresh, 30_000, canPoll);
  return null;
}
```

**Cron** — entrée dans `vercel.json` (heure UTC), route sous `/api/cron/` (déjà hors matcher), même
forme que `src/app/api/cron/auto-cancel/route.ts` :

```ts
import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { verifyCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic"; // comme tous les crons existants
export const maxDuration = 60; // prime sur les 30 s de vercel.json

export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) return apiError("UNAUTHORIZED", "Invalid cron secret");
    return apiSuccess({ done: true });
  } catch (error) {
    return handleApiError(error, "cron/exemple");
  }
}
```

Tâche de maintenance qui écrit dans `Shop` : repasser l'`updatedAt` lu dans `data` (modèle :
`refreshShopMetrics(shopId, keepUpdatedAt)`, `src/lib/services/performance.ts`). Cache CDN, ISR,
images, cas `/boutique/[slug]` : [references/cache-cdn-isr.md](references/cache-cdn-isr.md).

## 5. Limites par plan à connaître par cœur

| | Hobby | Pro (20 $ par mois, dont 20 $ de crédit) |
| --- | --- | --- |
| CPU actif / mémoire / invocations | 4 h / 360 GB-h / 1 M, **pour toute l'équipe** | 0,177 $ par heure / 0,0147 $ par GB-h / 0,60 $ par million |
| Requêtes CDN | 1 M | 1 M + 1 TB inclus (Flat Rate CDN) |
| Au dépassement | coupure `402`, jusqu'à 30 jours | facturé ; pause `503` seulement si Spend Management la demande |
| Budget et alertes | aucun | budget, seuils 50 / 75 / 100 %, pause de **tous** les projets, reprise manuelle |
| Crons | 1 fois par jour, à l'heure près | à la minute |
| Pare-feu | 3 règles dont 1 de limitation de débit | 40 règles |
| Journaux | 1 heure | 1 jour |
| Usage commercial | interdit | autorisé |

## 6. Mesurer

Depuis la racine du dépôt (`cost-audit.mjs` audite le répertoire courant ; dans une PR ou un script,
écrire le chemin `.claude/skills/vercel-cost-performance/scripts/…`) :

```bash
node ${CLAUDE_SKILL_DIR}/scripts/cost-audit.mjs          # régressions connues (lecture seule)
node ${CLAUDE_SKILL_DIR}/scripts/capacity.mjs shops=10   # ordre de grandeur CPU / coût
npx vitest run src/lib/__tests__/middleware-matcher.test.ts  # matcher en liste blanche
node scripts/check-prerender.mjs                         # après un build (CI)
```

État de référence de `cost-audit.mjs` à `2364ef9` : 0 erreur, 2 avertissements connus (polling
plafonné de `boucher/support/[ticketId]` ; cinq routes où cache public et helper d'auth cohabitent,
à relire méthode par méthode), 4 infos. Tout nouvel écart s'explique dans la PR. En production :
Usage, Observability, Firewall, en-tête `x-vercel-cache`, `vercel billing usage --breakdown daily`.
Méthode et modèle de capacité : [references/mesure-et-capacite.md](references/mesure-et-capacite.md).

## 7. Robots et pare-feu

Trois réglages à proposer (jamais appliqués sans accord ni sans lire `seo-anti-penalty`) : refus
des chemins de scanners (`.php`, `/wp-`, `/.env`), une règle de limitation de débit sur `/api/`
(hors webhooks et crons), Bot Protection en `log` puis `challenge`. Le jeu « AI Bots » reste sur
Allow. La sonde `uptime.yml` (`curl` avec agent Chrome) serait mise au défi par Bot Protection :
prévoir sa règle `bypass` avant. Ordre d'activation et conduite en cas d'emballement :
[references/bots-firewall.md](references/bots-firewall.md).

## 8. Points à arbitrer

Décisions du propriétaire : exposer coût et risque, ne pas trancher. Détail : [references/points-a-arbitrer.md](references/points-a-arbitrer.md).

- **A. Plan** : à confirmer dans Settings → Billing (constat : registre privé du programme). Hobby
  interdit l'usage commercial et ne tient pas une boutique active.
- **B. Budget** : la pause Spend Management coupe tous les projets de l'équipe ; isoler Klik&Go ?
- **C. Robots d'IA** : les refuser réduirait le trafic, la règle GEO les autorise.
- **D. Images** : avec `formats: [webp, avif]`, AVIF est servi dès que le navigateur l'accepte
  (test local, guide Vercel), contrairement à la règle « WebP d'abord » ; à confirmer en production.
- **E. Région** `sfo1` : sujet de latence, pas de coût ; à déplacer avec la base, jamais sans elle.
- **F. `/boutique/[slug]`** rendu à chaque requête : premier poste restant.
- **G. `indexnow-fresh` quotidien** : sollicite un recrawl de 112 à 132 URL inchangées.
- **H. Trois outils de mesure en parallèle** : sur Pro, Web Analytics se paie à l'événement ; Speed Insights reste gratuit mais plafonné.
- **I. Cadence du polling à 5 s** : poste qui grandit avec le nombre de boutiques.

## 9. Définition de terminé

Un changement touchant middleware, rendu, cache, polling, cron, images ou configuration Vercel est terminé quand :

- [ ] `cost-audit.mjs` : 0 erreur, et aucun avertissement nouveau non expliqué dans la PR ;
- [ ] le test `middleware-matcher` passe, et toute route gardée ajoutée figure aux deux endroits ;
- [ ] la table des routes du job CI `build` ne montre aucune page publique passée de `○` / `●` à
      `ƒ`, et `check-prerender.mjs` passe (chemin ajouté à `REQUIRED_ROUTES` si nouvelle famille) ;
- [ ] une vue anonyme des pages touchées ne déclenche aucun appel API nouveau (onglet Réseau, en
      navigation privée) ;
- [ ] toute réponse mise en cache est identique pour tous les utilisateurs, et l'en-tête
      `x-vercel-cache` a été vérifié (MISS puis HIT) sur l'aperçu Vercel ;
- [ ] tout nouvel intervalle réseau passe par `useVisiblePolling`, avec arrêt sur état final ;
- [ ] tout nouveau cron : `verifyCronAuth`, `try/catch`, fréquence compatible avec le plan, aucun
      effet sur `updatedAt` sans changement de contenu ;
- [ ] l'effet attendu est chiffré dans la PR (invocations par jour avant et après, ou sortie de
      `capacity.mjs`, avec les hypothèses), puis CPU actif, invocations et requêtes CDN relevés à J+1 et J+7 ;
- [ ] aucun nombre de prix ou de quota n'a été recopié dans le code : il renvoie à ce skill ;
- [ ] tout point touchant à un arbitrage (§ 8) a été remonté, pas tranché.

## 10. Sources

[references/sources.md](references/sources.md) : toutes les sources (`S…`, `I…`), leur crédibilité,
ce qui n'a pas pu être vérifié. Relire la page Vercel citée avant de chiffrer une décision.
