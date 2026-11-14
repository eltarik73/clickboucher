# Budget JavaScript et découpage du code

## État mesuré (I1, I12 — build local du 2026-11-14)

Le script donne deux relevés. **Manifestes** : ce que `next build` appelle « First Load JS »,
disponible pour toutes les pages. **HTML** (`--html`) : somme des `<script>` du HTML prérendu,
c'est-à-dire ce qu'un navigateur moderne télécharge vraiment (hors `noModule`) ; disponible pour
les pages prérendues seulement. C'est le relevé HTML qui compte ; le relevé par manifestes sert
aux pages `ƒ` et à localiser un poids.

| Périmètre | Manifestes (gzip) | HTML réel (gzip) |
| --- | --- | --- |
| Partagé par toutes les pages (`rootMainFiles`) | ≈ 208 KB | — |
| Plancher (page vide, `/_not-found`) | — | ≈ 319 KB |
| `/boucherie-halal/[ville]` | ≈ 280 KB | ≈ 321 KB |
| `/` (accueil) | ≈ 337 KB | ≈ 340 KB |
| `/cgv`, `/a-propos` (pages de texte !) | ≈ 312 KB | ≈ 341 KB |
| `/panier` | ≈ 335 KB | ≈ 358 KB (maximum) |
| `/boutique/[slug]` (page `ƒ`, pas de HTML) | ≈ 344 KB | non mesurable hors navigateur |

Décomposition d'une page de texte (`/cgv`, 341 KB réels) :

| Couche | gzip | Contenu (repéré par chaînes, à confirmer avec un analyseur) |
| --- | --- | --- |
| JS partagé | 208 KB | React DOM 54 ; Session Replay 37 ; chunk principal 118 (runtime Next + SDK Sentry) ; reste 5 |
| Layout racine | 57 KB | Clerk ≈ 30 à 39 ; `sonner` ≈ 10 ; Speed Insights + Analytics ≈ 3 ; chunk du layout ≈ 5 (dont les cinq composants censés être chargés tard) |
| Layout `(client)` | 46 KB | chunk du layout 16 (`SeoFooter` + `SEO_CITIES`) ; Radix ≈ 11 ; panier ≈ 6 ; divers |
| Groupe de chunks de la page d'accueil, attaché par erreur | 26 KB | voir poste 1 |
| `error.tsx` (racine et groupe) | 3 KB | non comptés par les manifestes |
| La page elle-même | 0,4 KB | |

Les trois postes identifiés, par ordre de rendement :

1. **`next/dynamic` avec `ssr: false` dans le layout racine, qui est un Server Component (I11,
   I12).** Deux effets mesurés en 14.2.35 : (a) aucun chunk séparé n'est créé —
   `.next/react-loadable-manifest.json` n'a aucune entrée `app/layout.tsx -> …` et le code des
   cinq composants est dans `app/layout-*.js` ; la doc le dit : pas de découpage automatique
   quand un Server Component importe dynamiquement un Client Component (N8) ; (b) le rendu
   serveur émet cinq fois la référence client `BailoutToCSR`, dont la liste de chunks est celle
   du groupe de la **page d'accueil** : toute page charge donc `app/(client)/page-*.js` et ses
   chunks associés. Surcoût : ≈ 26 KB sur les pages `(client)`, ≈ 39 KB sur
   `/boucherie-halal/[ville]`, ≈ 52 KB sur une page hors groupe ; 0 sur l'accueil. Correctif :
   patron 2. Le gain attendu n'a **pas** été mesuré (aucun build possible ici) : le valider par
   `--html` avant / après.
2. **Sentry dans le JS partagé (I2).** Session Replay : 37 KB gzip, un chunk entier, chargé même
   pour les 95 % de sessions non enregistrées (`replaysSessionSampleRate: 0.05`). SDK : dans le
   chunk principal de 118 KB, où il est mêlé au runtime client de Next — les modules qui portent
   une marque Sentry font ≈ 129 KB bruts sur 405 (≈ 43 KB gzip compressés seuls). S'y ajoute du
   code que Sentry tire sans qu'on s'en serve : le routeur du Pages Router (`next/router`,
   ≈ 38 KB bruts), importé par `pagesRouterRoutingInstrumentation` de `@sentry/nextjs` (import
   lu dans `node_modules` ; aucun fichier de `src/` n'importe `next/router`). Ordre de grandeur :
   **80 à 100 KB gzip attribuables à Sentry**, pas 155 (somme des deux chunks, qui compte aussi
   le runtime de Next). Chiffre exact : `@next/bundle-analyzer` avant de promettre un gain.
3. **Layout client du groupe `(client)` (I3).** `src/app/(client)/layout.tsx` porte
   `"use client"`, donc `SeoFooter` et tout `SEO_CITIES` (textes `localContext` compris) sont
   envoyés au navigateur sur chaque page client (chunk de 70 KB, ≈ 16 KB gzip). Correctif :
   patron 1.

## Règles de découpage (N6, N8, R1)

- `"use client"` contamine tout ce que le fichier importe (R1). Le placer **sur la feuille
  interactive**, jamais sur un layout ou une page entière. Passer le contenu serveur en `children`.
- `next/dynamic` ne diffère que des Client Components (N6) et ne découpe que s'il est **appelé
  depuis un fichier `"use client"`** (N8, I11). Pour un composant client qu'un Server Component
  veut charger tard avec `ssr: false`, créer un petit fichier client qui porte le `dynamic(...)`
  (patrons 1 et 2). Next 15 refuse `ssr: false` dans un Server Component (N9).
- Bibliothèque lourde utilisée par un seul écran (Recharts, Leaflet, html5-qrcode) : un fichier
  local qui l'importe, chargé par **un seul** `dynamic(() => import("./StatsCharts"))`. Les pages
  statistiques font aujourd'hui 7 à 10 `dynamic(() => import("recharts").then(m => m.X))` : ça
  marche (un seul chunk), mais chaque composant a son propre état de chargement.
- Code chargé sur action (scan QR, export, éditeur d'image) : `await import()` dans le
  gestionnaire, pas au montage.
- Icônes : `lucide-react` est déjà dans `optimizePackageImports` (`next.config.mjs`) ; ne pas
  importer `import * as Icons`.
- Toute nouvelle dépendance client : mesurer avant / après avec le script, chiffre dans la PR.

## Patron 1 — layout `(client)` redevenu Server Component

```tsx
// src/components/chat/ChatWidgetLazy.tsx
"use client";

import dynamic from "next/dynamic";

export const ChatWidgetLazy = dynamic(
  () => import("@/components/chat/ChatWidget").then((m) => m.ChatWidget),
  { ssr: false },
);
```

```tsx
// src/app/(client)/layout.tsx — plus de "use client" : SeoFooter et SEO_CITIES restent côté serveur
import { BottomNav } from "@/components/layout/BottomNav";
import { SeoFooter } from "@/components/layout/SeoFooter";
import { CartProviderWrapper } from "@/components/providers/CartProviderWrapper";
import { ChatWidgetLazy } from "@/components/chat/ChatWidgetLazy";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProviderWrapper>
      <div className="pb-20 md:pb-0">{children}</div>
      <SeoFooter />
      <BottomNav />
      <ChatWidgetLazy />
    </CartProviderWrapper>
  );
}
```

`SeoFooter` n'a ni hook ni gestionnaire (vérifié) ; `BottomNav` et `CartProviderWrapper` portent
déjà `"use client"`. Vérifier ensuite : le chunk `app/(client)/layout-*.js` ne contient plus
`localContext`, le HTML du pied de page est identique (SEO : charger `seo-anti-penalty` avant),
`check-prerender.mjs` passe.

## Patron 2 — composants chargés tard du layout racine

```tsx
// src/components/layout/RootLazy.tsx
"use client";

import dynamic from "next/dynamic";

export const ServiceWorkerRegistrationLazy = dynamic(
  () => import("@/components/pwa/ServiceWorkerRegistration"),
  { ssr: false },
);
export const InstallPromptLazy = dynamic(() => import("@/components/pwa/InstallPrompt"), { ssr: false });
export const OfflineBannerLazy = dynamic(() => import("@/components/pwa/OfflineBanner"), { ssr: false });
export const AnalyticsConsentLazy = dynamic(
  () => import("@/components/AnalyticsConsent").then((m) => m.AnalyticsConsent),
  { ssr: false },
);
export const TestRoleSwitcherLazy = dynamic(
  () => import("@/components/test/TestRoleSwitcher").then((m) => m.TestRoleSwitcher),
  { ssr: false },
);
```

Dans `src/app/layout.tsx` : supprimer les cinq `dynamic(...)` et l'import de `next/dynamic`,
importer ces cinq noms et les poser **aux mêmes endroits** de l'arbre. Rien d'autre ne change :
la règle CLAUDE.md « PWA / popup : toujours `dynamic({ ssr: false })` » reste respectée, seul le
fichier qui porte l'appel change ; ne pas toucher à `<ClerkProvider>` (jamais de prop `dynamic`).

Contrôle, dans cet ordre : (1) `react-loadable-manifest.json` contient cinq entrées
`components/layout/RootLazy.tsx -> …` ; (2) `first-load-js.mjs --html --compare` : baisse sur
toutes les pages sauf l'accueil ; (3) `grep -c BailoutToCSR .next/server/app/cgv.rsc` ne trouve
plus la référence ; (4) le service worker s'enregistre toujours, le bandeau de consentement et le
sélecteur de rôle du mode test s'affichent. Si (2) ne montre pas de baisse, ne pas garder le
changement « par principe » : le signaler.

## Patron 3 — options Sentry de réduction (clés vérifiées dans `@sentry/nextjs` 10.49.0)

```js
// next.config.mjs, dans withSentryConfig(nextConfig, { … })
webpack: {
  autoInstrumentMiddleware: false, // existant, ne pas retirer (coût CPU)
  treeshake: {
    removeDebugLogging: true,      // remplace `disableLogger`, marqué déprécié dans les types installés
    excludeReplayIframe: true,     // Replay masque déjà tout ; iframes Clerk/Stripe inutiles
    excludeReplayShadowDOM: true,
  },
},
```

Ces options ne valent que pour un build webpack (E2), ce qui est notre cas. Ne pas activer
`excludeReplayCompressionWorker` (déconseillé sans worker hébergé, E2) ni `removeTracing` (il
supprime la seule source gratuite de Web Vitals terrain, arbitrage C). Gain non mesuré : relever
le JS partagé avant / après.

Le chargement différé de Replay documenté par Sentry (E1) n'est **pas** encore une règle : avec
webpack et l'import statique de `@sentry/nextjs`, le gain n'est pas garanti. Le tester sur une
branche et ne le garder que si `first-load-js.mjs` montre une baisse du JS partagé. Retirer Replay
ou le tracing est une décision produit (voir points à arbitrer), pas une optimisation silencieuse.

## Budget et CI

Aucun garde-fou de poids n'existe aujourd'hui (le job `build` de `.github/workflows/ci.yml` ne
vérifie que le prérendu). Proposition, à appliquer par une PR qui touche la CI, après l'étape
`check-prerender` :

```yaml
      - name: JS budget (first load, gzip)
        run: node .claude/skills/web-performance/scripts/first-load-js.mjs --top=5 --max-shared=215 --max-page=350 --html --max-html=362
```

Seuils de départ = état mesuré (208 / 344 / 358) + quelques KB de marge, **à abaisser** à chaque
gain obtenu (cliquet). Ne jamais les relever sans justification écrite dans la PR. Variante plus
fine : produire `--html --json` sur `main` comme artefact et comparer la branche avec
`--html --compare --max-delta=5`.

Lighthouse CI (G3) est possible en complément, avec des assertions en `warn` d'abord (le labo
varie d'une machine CI à l'autre) :

```json
{
  "ci": {
    "collect": { "numberOfRuns": 3 },
    "assert": {
      "assertions": {
        "largest-contentful-paint": ["warn", { "maxNumericValue": 2500, "aggregationMethod": "median" }],
        "total-blocking-time": ["warn", { "maxNumericValue": 300, "aggregationMethod": "median" }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1, "aggregationMethod": "median" }]
      }
    }
  }
}
```

À compléter par `collect.url` et `collect.startServerCommand` (G3). Les trois identifiants
d'audit existent dans Lighthouse (G1) ; sans `aggregationMethod`, LHCI prend la valeur
« optimiste » des passages (G3). Il demande `@lhci/cli` (nouvelle dépendance : accord du
propriétaire) et un serveur `next start` avec base en CI. Le seuil de 300 ms de TBT est un choix
interne, pas une norme publiée.

## Analyser un chunk

1. `first-load-js.mjs --filter="<route>"` pour situer la page (ajouter `--html` pour le réel).
2. Lister les fichiers de la page dans `.next/app-build-manifest.json`, puis chercher les noms de
   bibliothèques dans le plus gros (`grep -o <lib> <chunk> | wc -l`) : heuristique rapide.
3. Un chunk chargé sans raison apparente : chercher qui le référence dans le `.rsc` de la page
   (`grep -o 'I\[[0-9]*,\[[^]]*\],"[^"]*"\]' .next/server/app/<page>.rsc`) ; chaque ligne donne
   un composant client et la liste des chunks qu'il fait charger.
4. Pour une analyse exacte : `@next/bundle-analyzer` + `ANALYZE=true npm run build` (N7) —
   dépendance de développement à faire accepter. `next analyze` n'existe pas en Next 14
   (Next 16.1 et Turbopack, N7).
