# Images, polices, scripts tiers, préchargement

## Images (`next/image`, `SafeImage`)

Configuration actuelle (`next.config.mjs`) : `formats: ["image/webp", "image/avif"]`,
`deviceSizes: [640, 750, 828, 1080, 1200]`, `minimumCacheTTL` 30 jours, `remotePatterns` Blob,
Replicate, Pexels, Unsplash. `SafeImage` (`src/components/ui/SafeImage.tsx`) enveloppe
`next/image` et bascule sur un SVG en `data:` en cas d'erreur ; c'est un Client Component
(`useState`) : l'utiliser dans une liste de cartes est correct, pas dans un composant qui devrait
rester serveur sans raison.

Règles (N1, W4) :

| Cas | Faire | Ne pas faire |
| --- | --- | --- |
| Image LCP probable (1re ou 2e carte boutique, visuel principal de `/boutique/[slug]`, image de recette en tête) | `priority` (il pose déjà `fetchPriority="high"` et le `preload`, I6) | `loading="lazy"`, ou `priority` sur plus de deux images par page (W4) |
| Image en `fill` | Toujours `sizes` conforme à la grille réelle (ex. ShopCard : `(max-width: 640px) 100vw, 50vw`) | Oublier `sizes` : défaut `100vw`, fichier jusqu'à 9 fois trop lourd sur une grille à 3 colonnes |
| Conteneur | Hauteur ou ratio fixés (`aspect-[4/3]` pour les produits, CLAUDE.md) | Conteneur dont la hauteur dépend de l'image chargée (CLS) |
| Qualité | 60 pour les cartes boutique (CLAUDE.md) ; défaut 75 ailleurs | Monter la qualité « pour être sûr » sans comparaison visuelle |
| Nouvelle source distante | `remotePatterns` précis (protocole + hôte + chemin, N1) | Joker large : n'importe qui ferait optimiser ses images à nos frais. État des motifs actuels : voir le registre privé du programme (suivi par le skill `security-multitenant`) |
| URL Replicate | Copier dans Vercel Blob avant affichage (expire en ≈ 1 h, CLAUDE.md) | Mettre en cache 30 jours une URL qui va mourir |
| `<img>` natif | Accepté pour `OfferPopup` (CLAUDE.md), aperçus d'upload `blob:`/`data:` dans le back-office | Sur une page publique pour une photo produit ou boutique |

Défauts déjà présents :

- `ShopCard` répète `fetchPriority: "high"` à côté de `priority` (redondant, sans effet).
- `/boutique/[slug]` : le visuel principal est en `priority` **et** `ProductCard` met `priority`
  sur les quatre premières cartes (`isEager = productIndex < 4`) : cinq préchargements en
  priorité haute pour une seule image LCP. Garder la priorité du visuel principal, laisser les
  cartes en lazy, puis vérifier l'élément LCP dans Lighthouse.
- `ProductCard` utilise `next/image` directement, avec un `onError` qui réécrit `src` : passer à
  `SafeImage` quand on y touche.
- Pages villes (`/boucherie-halal/[ville]` et pages sœurs) : `ShopCard` y est rendu sans
  `priority`. Ce n'est un défaut que si Lighthouse désigne une image de carte comme élément LCP
  (sur mobile, le titre est plus probable) : mesurer avant de changer.
- 16 composants utilisent `<img>` (surtout back-office et modales d'image : à laisser) ;
  `ProductSheet`, `CartSuggestions` et `ProductQuickAdd` sont côté client public — à migrer vers
  `SafeImage` quand on y touche, avec `sizes`.

`minimumCacheTTL` de 30 jours et **aucune invalidation** (N1) : remplacer une image en gardant la
même URL ne se voit pas avant 30 jours. Toujours une nouvelle URL quand un boucher change sa
photo. Les sept appels à `put` (`@vercel/blob`) du dépôt le garantissent aujourd'hui par un nom
de fichier horodaté (`Date.now()`), pas par `addRandomSuffix` : garder ce motif dans tout nouvel
envoi et ne jamais réécrire un fichier sous le même nom.

## Polices (`next/font`)

`src/app/layout.tsx` charge trois familles : DM Sans (400/600/700), Outfit (500/700/800),
Cormorant Garamond (500, `preload: false`), toutes `display: "swap"`, `subsets: ["latin"]`.

- `next/font/google` **auto-héberge** les fichiers : le navigateur n'appelle jamais Google (N4).
  Les `<link rel="preconnect">` vers `fonts.googleapis.com` et `fonts.gstatic.com` du layout
  ouvrent donc deux connexions inutiles sur chaque page (voir points à arbitrer : CLAUDE.md les
  prescrit).
- Chaque graisse est un fichier : ajouter une graisse ou une famille se justifie (N4, « use
  multiple fonts conservatively »). Préférer une graisse déjà chargée.
- Police décorative rare (Cormorant) : garder `preload: false`.
- Jamais de `@import` Google Fonts dans un CSS ni de `<link>` vers Google : bloquant, et l'adresse
  IP du visiteur part chez Google (qualification juridique : skill `conformite-france`).

## Scripts tiers

Inventaire au 2026-11-14 :

| Script | Où | Chargement | Remarque |
| --- | --- | --- | --- |
| Clerk (`clerk.browser.js`, I8) | Toute page, via `<ClerkProvider>` racine | Script de l'API Frontend Clerk, en plus de ≈ 30 à 39 KB gzip de code Clerk dans notre propre bundle (I13) | Poids du script distant non mesuré ; c'est le tiers le plus lourd probable. Le relever dans l'onglet Réseau d'une page publique anonyme |
| Speed Insights + Web Analytics Vercel | Racine | Scripts servis par Vercel sous `/_vercel/…` | Petits ; Speed Insights gratuit plafonné (V2) |
| Plausible | `AnalyticsConsent`, après consentement | `next/script`, `lazyOnload` | Bloqué par la CSP si activé (I9) : ajouter `https://plausible.io` à `script-src` et `connect-src` en même temps que la variable |
| Sentry | Bundle partagé (pas un script tiers) | Toujours | Voir [budget-js.md](budget-js.md) |
| Stripe | `dns-prefetch` seulement | — | Ne charger `js.stripe.com` que sur le paiement le jour où Stripe sera actif (skill `stripe-payment`) |

Règles (N5) : un script tiers va dans le layout ou la page qui en a besoin, jamais dans la racine
« au cas où » ; `lazyOnload` pour ce qui n'est pas nécessaire à l'interaction ; tout nouveau
domaine passe par la CSP de `next.config.mjs` **et** par le consentement si c'est du suivi.
`strategy="worker"` ne fonctionne pas avec `app/` (N5).

## Préchargement des liens (`next/link`)

- En production, tout lien visible est préchargé (N2) ; pour une route dynamique, seulement
  jusqu'au premier `loading.tsx`, gardé 30 s (N3). Chaque préchargement d'une page `ƒ` coûte une
  fonction (skill `vercel-cost-performance`).
- `prefetch={false}` sur les liens en masse (CLAUDE.md) ; en 14.2.35 il coupe aussi le
  préchargement au survol (I5) : sur un lien isolé très probable (« Commander », « Panier »),
  laisser le défaut.
- `SeoFooter` le fait via un `Link` local à `prefetch={false}` : réutiliser ce motif.
- Ne pas précharger depuis une liste paginée de 50 boutiques : `prefetch={false}` sur les cartes
  si la liste dépasse l'écran (à mesurer : `ShopCard` ne le fait pas aujourd'hui).
