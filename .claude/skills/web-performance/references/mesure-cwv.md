# Mesurer : terrain d'abord, labo pour expliquer

## Cibles (W1, W2)

| Métrique | Bon | Mauvais | Évaluée sur |
| --- | --- | --- | --- |
| LCP | ≤ 2,5 s | — (seuil « bon » seul confirmé dans W1) | 75e percentile, mobile et desktop séparés |
| INP | ≤ 200 ms | > 500 ms | idem |
| CLS | ≤ 0,1 | — | idem |

Notre cible : **mobile**, P75, pages publiques (`/`, `/boutique/[slug]`, `/boucherie-halal/[ville]`,
`/panier`). Le mode cuisine tourne sur tablette, plusieurs heures : l'INP y compte plus que le LCP.

## Terrain : ce qui est réellement disponible chez nous

| Source | Ce qu'elle donne | Limite |
| --- | --- | --- |
| CrUX / PageSpeed Insights / Search Console (W5, W5b) | Données Chrome réelles, moyenne glissante sur 28 jours | Absentes tant que la page ou l'origine n'est pas « suffisamment populaire » (seuil non publié) : très probable aujourd'hui (trafic humain quasi nul). Une page `noindex` ou qui ne répond pas 200 n'y entre jamais |
| Vercel Speed Insights gratuit (V1, V2) — `<SpeedInsights />` dans `src/app/layout.tsx` | **Real Experience Score seul**, 24 h / 7 j, routes « bonnes » et « à améliorer » seulement | 10 000 événements sur 30 jours glissants **partagés par les projets de l'équipe** ; au-delà, collecte coupée ≥ 14 jours. Les préversions comptent aussi (V1) |
| Speed Insights Plus (V2) | LCP, INP, CLS, FCP, TTFB par route et par élément | 10 $ / projet / mois + événements ; décision du propriétaire |
| Sentry (E3) | `browserTracingIntegration` capte LCP, CLS, INP, TTFB sur les transactions échantillonnées (`tracesSampleRate: 0.1` en prod dans `sentry.client.config.ts`) | Seulement si `NEXT_PUBLIC_SENTRY_DSN` est défini ; 10 % des chargements |
| `useReportWebVitals` (`next/web-vitals`, I10) | Rappel par métrique dans un Client Component | À brancher vers un puits : ne pas créer de route API pour ça (coût CPU, skill `vercel-cost-performance`) |

Conséquence : **ne pas conclure sur un P75 bâti sur quelques dizaines de visites**. Noter le
nombre d'échantillons à côté de chaque chiffre.

## Labo : reproduire et expliquer

- **Lighthouse** (G1) dans Chrome DevTools, profil mobile, navigation privée, sur l'URL de
  production ou un `next start` local (jamais `next dev` : pas de prefetch, code non minifié).
  Lighthouse **ne mesure pas l'INP** : regarder le TBT comme indicateur (W1).
- **DevTools > Performance** : enregistrer une interaction (ajout au panier, changement d'onglet
  du mode cuisine) ; repérer les tâches > 50 ms (W3) et la phase INP en cause (W2).
- **Onglet Réseau** : compter les requêtes d'une vue anonyme (doit rester stable, règle CLAUDE.md
  « Aucun appel API au montage pour un visiteur anonyme ») ; vérifier `Content-Type` des réponses
  `/_next/image` (AVIF ou WebP, cf. points à arbitrer).
- **Budget JS** : `scripts/first-load-js.mjs --html` sur un build (voir [budget-js.md](budget-js.md)).
  Le relevé « HTML » est celui qui correspond à l'onglet Réseau ; le relevé par manifestes
  sous-estime (chunks attachés par le rendu serveur, `error.tsx`).

## Procédure avant / après pour une PR « performance »

1. Build de `main` : `node <skill>/scripts/first-load-js.mjs --html --json > before.json`.
2. Build de la branche : `… --html --compare=before.json --max-delta=5`.
3. Lighthouse mobile, 3 passages, médiane, sur les mêmes URL avant / après ; noter LCP, TBT, CLS
   et l'élément LCP désigné.
4. Dans la PR : tableau avant / après, conditions (machine, réseau simulé), limites.
5. À J+7 : relever Speed Insights (RES) ou Sentry Web Vitals avec le nombre d'échantillons.

## Pistes INP propres à Klik&Go (hypothèses à profiler, pas des constats)

- Mode cuisine (`src/app/(boucher)/boucher/commandes/page.tsx`, `src/hooks/use-order-polling.ts`) :
  vérifier dans le profil si chaque tick de 5 s re-rend toutes les cartes ; si oui, mémoriser les
  cartes et découper le travail non visible (`yieldToMain`, W3).
- Panier (`src/app/(client)/panier/page.tsx`, `src/lib/hooks/use-order-quote.ts`) : la quantité
  affichée doit changer avant l'appel au devis serveur (motif `saveSettings` de W3).
- Tout gestionnaire d'événement qui dépasse 50 ms dans le profil est un défaut à corriger.
