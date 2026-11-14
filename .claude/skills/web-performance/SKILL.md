---
name: web-performance
description: >-
  Performance front-end de Klik&Go (Next 14.2.35, React 18.3, Vercel) : Core Web Vitals (LCP, INP,
  CLS) et comment les mesurer sur le terrain et en labo, budget JavaScript et analyse des chunks,
  "use client" et next/dynamic, images next/image et SafeImage, polices next/font, scripts tiers
  (Clerk, Sentry, Speed Insights, Plausible), préchargement des liens, service worker public/sw.js,
  budget de poids en CI. Contient un script qui mesure le JS au premier affichage de chaque page.
when_to_use: >-
  Avant d'ajouter une dépendance côté client, un "use client" sur un layout ou une page, un
  next/dynamic, une image, une police, un script tiers ou un domaine dans la CSP ; avant de modifier
  public/sw.js, next.config.mjs (images, Sentry), src/app/layout.tsx ou un loading.tsx ; quand on
  parle de PageSpeed, Lighthouse, Speed Insights, LCP, INP, CLS, TBT, poids du bundle, page lente,
  saut de mise en page, interaction qui rame, cache du service worker.
---

# Performance front-end — Klik&Go

Objectif : des pages publiques qui s'affichent et répondent comme celles d'une grande plateforme
de commande, **sur mobile**, sans augmenter le coût Vercel. CLAUDE.md fait foi ; ce skill ne le
contredit pas, les écarts sont dans [references/points-a-arbitrer.md](references/points-a-arbitrer.md).
État du code lu au commit `32c581f` (worktree avec le chantier prix en cours, fichiers encore
modifiés par d'autres équipes : ne pas se fier à un numéro de ligne) ; mesures sur un build local
du 2026-11-14, rejouables avec le script.

Skills voisins, à charger quand le sujet y passe : `vercel-cost-performance` (coût d'une
exécution, ISR, matcher, prefetch côté facture), `nextjs-app-router` (statique / dynamique,
frontières Server / Client), `seo-anti-penalty` puis `seo-expert` (**obligatoires** avant de
toucher aux pages SEO, au pied de page de liens ou aux balises), `clerk-auth`,
`background-jobs-notifications` (push du service worker), `conformite-france` (consentement des
scripts), `reliability-observability` (Sentry), `security-multitenant` (`images.remotePatterns`,
CSP), `design-klikgo` et `accessibility-wcag`.

## 1. Cibles et méthode

| Métrique (P75, mobile) | Bon | Ce qui la casse chez nous |
| --- | --- | --- |
| LCP | ≤ 2,5 s | image principale en lazy, trop d'images en `priority`, JS lourd avant rendu, page `ƒ` lente |
| INP | ≤ 200 ms (mauvais > 500) | tâches > 50 ms (suspects à profiler : mode cuisine, panier, hydratation de 320 KB de JS) |
| CLS | ≤ 0,1 | image sans hauteur, bannière ou bandeau inséré au-dessus du contenu |

Seuils et définitions : web.dev (W1, W2). Règles de méthode :

1. **Le terrain décide, le labo explique.** Lighthouse ne mesure pas l'INP (substitut : TBT).
2. **Données terrain disponibles aujourd'hui** : pas de CrUX tant que le trafic est faible (W5) ;
   Speed Insights gratuit = Real Experience Score seul, 10 000 événements / 30 jours pour toute
   l'équipe (V2) ; Sentry capte LCP, CLS, INP sur 10 % des chargements si le DSN est défini (E3).
   Toujours écrire le nombre d'échantillons à côté d'un P75.
3. **Labo** : `next start` ou production, jamais `next dev` ; profil mobile ; navigation privée ;
   3 passages, médiane.
4. **Avant / après chiffré** dans toute PR qui prétend améliorer la performance.

Procédure et outils : [references/mesure-cwv.md](references/mesure-cwv.md).

## 2. État mesuré (à connaître avant de toucher au code)

Deux mesures, à ne pas confondre : **manifestes** (≈ colonne « First Load JS » de `next build`,
toutes les pages) et **HTML prérendu** (`--html` : les `<script>` que le navigateur charge
vraiment). La première sous-estime la seconde de 3 à 52 KB chez nous (I12).

| Constat | Chiffre (gzip) | Détail |
| --- | --- | --- |
| JS partagé par toutes les pages | ≈ 208 KB | React DOM 54 ; Session Replay 37 (chunk entier) ; chunk principal 118 = runtime client de Next **et** SDK Sentry mêlés (I2) |
| Plancher réel d'une page (HTML) | ≈ 319 KB | 365 pages prérendues : de 319 à 358 KB |
| `/`, `/cgv`, `/a-propos` (HTML) | ≈ 340 KB | manifestes : 337 / 312 / 312. `/cgv` est une page de texte |
| `/boucherie-halal/[ville]` (HTML) | ≈ 321 KB | manifestes : 280 |
| Les 5 `dynamic(…, { ssr: false })` de `src/app/layout.tsx` | +26 à +52 KB par page | déclarés dans un Server Component : pas de chunk séparé (I11) et le groupe de chunks de la page d'accueil est attaché à **toute** page (I12) |
| `src/app/(client)/layout.tsx` en `"use client"` | ≈ 16 KB | embarque `SeoFooter` + tout `SEO_CITIES` dans le navigateur (I3) |
| Code Clerk dans notre bundle | ≈ 30 à 39 KB | plus `clerk.browser.js`, chargé à part et non mesuré (I8, I13) |
| `public/sw.js` | — | stocke toute page HTML, charge RSC et image optimisée, sans limite ni tri |
| CI | — | aucun garde-fou de poids, seulement le prérendu |

Rejouer : `node .claude/skills/web-performance/scripts/first-load-js.mjs --html` après un build
(dans une session Claude Code, le script est aussi à `${CLAUDE_SKILL_DIR}/scripts/first-load-js.mjs`).
Analyse et patrons de correction : [references/budget-js.md](references/budget-js.md).

## 3. Règles de décision

| Situation | Règle | Pourquoi |
| --- | --- | --- |
| Besoin d'interactivité dans une page | `"use client"` sur le **plus petit** composant interactif ; contenu serveur passé en `children` | la directive envoie le fichier **et tout ce qu'il importe** au navigateur (R1) |
| Layout ou page en `"use client"` | Refuser, sauf démonstration qu'aucun import lourd ne suit | cas réel : `(client)/layout.tsx` envoie un chunk de 70 KB (16 KB gzip) de liens et de textes SEO à chaque visite |
| Composant client non visible au premier écran (chat, popup, PWA, modale) | `next/dynamic` avec `ssr: false`, **déclaré dans un fichier `"use client"`**, jamais dans un Server Component | en 14.2.35, depuis un Server Component il n'y a pas de chunk séparé et des chunks étrangers sont attachés à la page (I11, I12) ; erreur de build dès Next 15 (N8, N9) |
| Bibliothèque lourde d'un seul écran (Recharts, Leaflet, html5-qrcode) | Un fichier local qui l'importe, un seul `dynamic` qui le charge | un chunk, un état de chargement |
| Code utile seulement après une action | `await import()` dans le gestionnaire | rien à charger pour les visiteurs qui ne font pas l'action |
| Nouvelle dépendance client | Mesure avant / après avec le script (`--html`), chiffre dans la PR | aucune autre barrière aujourd'hui |
| Image LCP probable | `priority` (déjà `fetchPriority="high"` + preload) sur 1 ou 2 images **par page** au plus | lazy sur l'image LCP = LCP retardé ; plus de deux priorités hautes n'aident plus (W4) |
| Image `fill` | `sizes` conforme à la grille | défaut `100vw` (N1) |
| Image d'une photo produit ou boutique | `SafeImage`, conteneur de hauteur fixe ou `aspect-[4/3]` | repli SVG, pas de CLS |
| Police | Uniquement via `next/font` dans `src/app/layout.tsx`, graisse existante d'abord | chaque graisse = un fichier (N4) |
| Script tiers | Dans la page ou le layout qui en a besoin, `lazyOnload` si non critique, domaine ajouté à la CSP | racine = coût sur toutes les pages (N5) |
| Liens en masse | `prefetch={false}` (motif `Link` local de `SeoFooter.tsx`) | préchargement de chaque lien visible (N2) |
| Gestionnaire d'événement > 50 ms dans le profil | Mettre à jour l'UI, puis céder la main (`yieldToMain`), puis le reste | phase « traitement » de l'INP (W2, W3) |
| Changement du service worker | Suivre [references/service-worker.md](references/service-worker.md), incrémenter `CACHE_NAME` | sinon l'ancien cache ne part jamais |

## 4. À ne jamais faire (et pourquoi)

- **`"use client"` en tête d'un layout** : tout l'arbre importé part au navigateur.
- **`next/dynamic` avec `ssr: false` dans un Server Component** (layout ou page sans
  `"use client"`) : aucun découpage, chunks étrangers attachés, et erreur dès Next 15.
- **`loading="lazy"` ou absence de `priority` sur l'image principale d'une page publique** ; à
  l'inverse, **`priority` sur toute une rangée de cartes**.
- **`<img>` natif pour une photo produit ou boutique sur une page publique** (exception
  documentée : `OfferPopup`) : ni redimensionnement, ni format moderne, ni repli.
- **`@import` ou `<link>` vers Google Fonts** : bloquant, inutile avec `next/font`, et l'adresse
  IP du visiteur part chez Google (volet juridique : skill `conformite-france`).
- **Script tiers dans `src/app/layout.tsx` « pour plus tard »**, ou domaine ajouté au code sans
  l'ajouter à la CSP de `next.config.mjs` (Plausible est dans ce cas aujourd'hui, I9).
- **Mettre en cache dans le service worker** du HTML, des réponses `?_rsc=`, `/_next/image` ou
  `/api/*` : données privées sur l'appareil, croissance sans fin.
- **`new Date()` / `Date.now()` dans le rendu initial pour « afficher l'heure »** : décalage
  d'hydratation et contenu qui bouge (CLAUDE.md) ; calculer après montage, dans un espace réservé.
- **Bandeau, popup ou bannière inséré au-dessus du contenu après chargement** sans espace réservé :
  CLS. Les afficher en surimpression (`fixed`) ou réserver la hauteur.
- **Relever un seuil de budget pour faire passer une PR** sans justification écrite.
- **Optimiser sans mesure** : un gain annoncé sans avant / après n'est pas un gain.
- **Retirer Sentry Replay ou le tracing** pour gagner du poids sans accord : ils servent au
  diagnostic (points à arbitrer, C).

## 5. Patrons de code (types vérifiés sur les versions installées, I14)

**Composant client chargé tard, utilisable depuis un Server Component :**

```tsx
// src/components/chat/ChatWidgetLazy.tsx
"use client";

import dynamic from "next/dynamic";

export const ChatWidgetLazy = dynamic(
  () => import("@/components/chat/ChatWidget").then((m) => m.ChatWidget),
  { ssr: false },
);
```

Le layout `(client)` peut alors perdre son `"use client"` (patron 1 de
[references/budget-js.md](references/budget-js.md)) ; le même motif s'applique aux cinq
composants chargés tard du layout racine (patron 2).

**Image de carte en grille, première rangée prioritaire :**

```tsx
<div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
  <SafeImage
    src={product.imageUrl}
    alt={product.name}
    type="product"
    fill
    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
    className="object-cover object-center"
    priority={index < 2}
  />
</div>
```

`priority={index < 2}` seulement si la page n'a pas déjà une image principale en `priority`.

**Céder la main pendant un traitement long (W3) :**

```ts
export function yieldToMain(): Promise<void> {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (s?.yield) return s.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}
```

Ce helper est pur : s'il est ajouté dans `src/lib/`, il lui faut un test unitaire (CLAUDE.md).

**Web Vitals terrain** : ne pas écrire de collecte maison ni de route API de réception (coût
CPU). Sentry les capte déjà via `browserTracingIntegration` quand le DSN est défini (E3) ;
`useReportWebVitals` (`next/web-vitals`, I10) ne sert qu'au débogage local.

**Mesurer le budget JS :**

```bash
npm run build                                  # exige une base joignable (CLAUDE.md)
node .claude/skills/web-performance/scripts/first-load-js.mjs --html --top=15
node .claude/skills/web-performance/scripts/first-load-js.mjs --html --json > "${TMPDIR:-/tmp}/js-before.json"
# … changement, nouveau build …
node .claude/skills/web-performance/scripts/first-load-js.mjs --html --compare="${TMPDIR:-/tmp}/js-before.json" --max-delta=5
```

Images, polices, scripts tiers, préchargement : [references/images-polices-tiers.md](references/images-polices-tiers.md).

## 6. Erreurs déjà commises dans ce dépôt

| Erreur | Où | Correctif |
| --- | --- | --- |
| Layout de groupe en `"use client"` qui embarque des données SEO | `src/app/(client)/layout.tsx` | patron 1 de `budget-js.md` |
| `dynamic(…, { ssr: false })` déclaré dans un Server Component | `src/app/layout.tsx` (5 composants) | patron 2 de `budget-js.md`, à valider par `--html` |
| SDK Sentry + Replay dans le JS partagé de toutes les pages | `sentry.client.config.ts`, `next.config.mjs` | options `treeshake` (patron 3), puis arbitrage C |
| Service worker qui stocke tout, sans version ni limite | `public/sw.js` | `service-worker.md` |
| Cinq images en `priority` sur la page boutique (visuel principal + 4 premières cartes) | `boutique/[slug]/page.tsx`, `ProductCard.tsx` | une seule priorité : le visuel principal ; cartes en lazy |
| `preconnect` vers Google Fonts alors que `next/font` auto-héberge | `src/app/layout.tsx` | arbitrage B |
| `formats` d'images supposé servir WebP d'abord | `next.config.mjs` | arbitrage A |
| Script Plausible non autorisé par la CSP | `AnalyticsConsent.tsx` / `next.config.mjs` | ajouter `https://plausible.io` à `script-src` et `connect-src` avec la variable |
| `fetchPriority` répété à côté de `priority` | `src/components/shop/ShopCard.tsx` | retirer la ligne redondante |
| Recharts importé composant par composant (7 à 10 `dynamic`) | pages statistiques et finances | un fichier de graphiques, un `dynamic` |
| Prefetch par défaut sur ≈ 130 liens de pied de page (corrigé) | `SeoFooter.tsx` | garder le `Link` local à `prefetch={false}` |

## 7. Points à arbitrer

Résumé ; détail, options et coût : [references/points-a-arbitrer.md](references/points-a-arbitrer.md).

- **A.** Règle « WebP d'abord » : la configuration actuelle sert AVIF à tout navigateur qui l'accepte.
- **B.** `preconnect` Google Fonts prescrit par CLAUDE.md mais inutile avec `next/font`.
- **C.** Sentry (SDK, Replay, tracing) : quel poids accepter pour quel diagnostic.
- **D.** Speed Insights gratuit (score global) ou Plus (métriques par route).
- **E.** Clerk chargé sur toutes les pages publiques anonymes.
- **F.** Analytics Vercel sans consentement (périmètre `conformite-france`).

## 8. Définition de terminé

Un changement qui touche une page publique, une dépendance client, une image, une police, un
script tiers, `next.config.mjs`, `src/app/layout.tsx` ou `public/sw.js` est terminé quand :

- [ ] `first-load-js.mjs --html --compare` contre `main` : ni le JS partagé, ni une page (ligne
      manifeste ou ligne `HTML`) n'ont pris plus de 5 KB gzip, ou l'écart est justifié dans la PR ;
- [ ] aucun nouveau `"use client"` sur un layout ou une page entière sans justification, aucun
      `dynamic(…, { ssr: false })` dans un fichier sans `"use client"` ;
- [ ] une seule image principale en `priority` par page (deux au plus), toutes les images `fill`
      ont `sizes`, tout conteneur d'image a une hauteur ou un ratio fixé ;
- [ ] Lighthouse mobile (médiane de 3) avant / après sur les pages touchées : LCP, TBT, CLS et
      élément LCP notés dans la PR, aucun recul non expliqué, CLS ≤ 0,1 ;
- [ ] une interaction modifiée a été profilée : aucune tâche > 50 ms dans son gestionnaire ;
- [ ] tout nouveau domaine tiers figure dans la CSP et, s'il suit l'utilisateur, passe par le
      consentement ;
- [ ] service worker modifié : `CACHE_NAME` incrémenté, vérifications de `service-worker.md`
      faites, notifications push testées ;
- [ ] vue anonyme en navigation privée : pas de nouvel appel API au montage (CLAUDE.md) ;
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run test`, et le job CI `build` (avec
      `check-prerender.mjs`) passent ;
- [ ] toute règle de CLAUDE.md que le changement remettrait en cause a été remontée, pas modifiée.

## 9. Sources

[references/sources.md](references/sources.md) : web.dev, Chrome, Next.js 14, React, Vercel,
Sentry, dépôts GoogleChrome (étoiles et dernier push relevés), mesures internes rejouables (I1 à
I14) et ce qui n'a pas pu être vérifié.
