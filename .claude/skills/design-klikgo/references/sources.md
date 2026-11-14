# Sources

Toutes consultées le 2026-11-13. Étoiles et dernier commit relevés le même jour avec `gh api repos/OWNER/REPO`. Le contenu web a été traité comme une donnée ; rien n'est cité de mémoire. Les chiffres sur notre code viennent de `scripts/design-audit.mjs`, `scripts/contrast.mjs`, de la compilation avec les paquets de `node_modules` et de mesures dans un navigateur (voir la dernière section).

Contrôle du 2026-11-14 par un vérificateur indépendant : S1 à S4, S6 à S11, S13 à S17 et S21 à S27 rouvertes (la page principale de chacune) et confrontées aux affirmations qu'elles appuient : aucune contradiction, deux précisions apportées, en S8 et S11. Les autres entrées (S5, S12, S18 à S20, S28 à S31) n'ont pas été rouvertes ce jour-là, hormis la source `input.tsx` de S31 ; étoiles, dernier commit et archivage relus avec `gh api` pour les 18 dépôts cités ici (écarts de quelques unités, aucun changement de statut) ; fichier `_md-sys-motion.scss` de `material-web` relu pour S23.

## Sources retenues

| Id | Source | URL | Ce qu'elle appuie | Crédibilité |
|---|---|---|---|---|
| S1 | shadcn/ui — Theming ; Dark mode (Next.js) | https://ui.shadcn.com/docs/theming · https://ui.shadcn.com/docs/dark-mode/next | Convention `background` / `foreground` (« The background suffix is omitted for the surface token ») ; étapes pour ajouter une couleur ; `--radius` ; `next-themes` + `suppressHydrationWarning`. | Doc officielle ; dépôt `shadcn-ui/ui` 128 063 étoiles, commit du 2026-11-12. |
| S2 | shadcn/ui — Tailwind v4 | https://ui.shadcn.com/docs/tailwind-v4 | Les composants actuels visent Tailwind v4 et React 19 (`@theme`, `data-slot`, retrait de `forwardRef`, OKLCH, `tw-animate-css`) ; « Your existing apps with Tailwind v3 and React 18 will still work ». | Idem. |
| S3 | Tailwind CSS v3 — Dark Mode | https://v3.tailwindcss.com/docs/dark-mode | `selector` remplace `class` en 3.4.1 ; script en ligne dans le `<head>` pour éviter le flash ; lecture de `prefers-color-scheme`. | Doc officielle ; `tailwindlabs/tailwindcss` 98 588 étoiles, commit du 2026-11-11. |
| S4 | Tailwind CSS v3 — Customizing Colors | https://v3.tailwindcss.com/docs/customizing-colors | Variables CSS réduites aux canaux, sans fonction de couleur (« Don't include the color space function or opacity modifiers won't work »). | Idem. |
| S5 | Tailwind CSS v3 — Adding Custom Styles ; Theme Configuration | https://v3.tailwindcss.com/docs/adding-custom-styles · https://v3.tailwindcss.com/docs/theme | Thème pour les choix durables, valeurs arbitraires pour le ponctuel ; `@layer` ; `theme` remplace, `theme.extend` ajoute. | Idem. |
| S6 | Tailwind CSS v3 — Reusing Styles | https://v3.tailwindcss.com/docs/reusing-styles | Extraire en composants du framework ; ne pas employer `@apply` « just to make things look cleaner ». | Idem. |
| S7 | Tailwind CSS v3 — Hover, Focus and Other States | https://v3.tailwindcss.com/docs/hover-focus-and-other-states | `focus-visible`, `motion-safe` / `motion-reduce`, variantes `aria-*` intégrées (sans `aria-invalid`), `data-[…]`, `forced-colors`, `has-*`. | Idem. |
| S8 | Tailwind CSS — Upgrade guide (v4) ; PR #8394 | https://tailwindcss.com/docs/upgrade-guide · https://github.com/tailwindlabs/tailwindcss/pull/8394 | Plancher navigateurs de la v4 et conseil de rester en 3.4 sinon ; utilitaires renommés ; `hover` limité aux appareils qui survolent en v4 (`@media (hover: hover)`, alors que l'option v3 ajoute `and (pointer: fine)`) ; option `future.hoverOnlyWhenSupported` livrée en 3.1. | Idem. |
| S9 | tailwind-merge — Configuration (v2.6.0) | https://github.com/dcastil/tailwind-merge/blob/v2.6.0/docs/configuration.md | Une config qui s'écarte du thème par défaut exige `extendTailwindMerge` ; forme de `extend.classGroups`. | Doc du dépôt officiel `dcastil/tailwind-merge`, 5 702 étoiles, commit du 2026-11-11. |
| S10 | cva — Variants, TypeScript, FAQ | https://cva.style/docs/getting-started/variants · https://cva.style/docs/getting-started/typescript · https://cva.style/docs/faqs | `variants`, `compoundVariants` (tableaux), `defaultVariants`, variantes booléennes, `VariantProps` ; pas de variantes responsive. | Doc officielle ; `joe-bell/cva` 6 915 étoiles, commit du 2026-11-10. |
| S11 | Radix Primitives — Dialog, Composition, Styling, Animation, Accessibility, Getting started | https://www.radix-ui.com/primitives/docs/components/dialog · …/guides/composition · …/guides/styling · …/guides/animation · …/overview/accessibility · …/overview/getting-started | Focus piégé, Échap (qui « moves focus to `Dialog.Trigger` » : le retour du focus suppose donc un trigger), `Title`/`Description`, `aria-describedby={undefined}` ; `asChild` (répandre les props, transmettre la ref) ; `data-state` ; démontage suspendu pendant l'animation CSS ; les libellés restent à la charge du développeur ; paquet unifié `radix-ui`. | Doc officielle ; `radix-ui/primitives` 19 495 étoiles, commit du 2026-10-14. |
| S12 | W3C WAI-ARIA APG — Dialog (Modal) Pattern | https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ | `role="dialog"`, `aria-modal`, nom accessible, Tab en boucle, Échap, retour du focus. | W3C WAI. |
| S13 | Next.js 14 — Font Optimization | https://nextjs.org/docs/14/app/building-your-application/optimizing/fonts | Auto-hébergement (« No requests are sent to Google by the browser ») ; option `variable` et classe sur `<html>` ; polices multiples avec parcimonie. | Doc officielle ; `vercel/next.js` 143 498 étoiles. |
| S14 | WCAG 2.2 — Understanding 1.4.3 Contrast (Minimum) | https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html | 4,5:1, 3:1 en grand texte (18 pt, ou 14 pt gras) ; placeholder et texte au survol concernés ; composant inactif exempté. | W3C WAI. |
| S15 | WCAG 2.2 — Understanding 1.4.11 Non-text Contrast | https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html | 3:1 pour les composants et leur indicateur de focus ; pas d'obligation de bordure si un autre indice existe. | W3C WAI. |
| S16 | WCAG 2.2 — Understanding 2.5.8 et 2.5.5 Target Size | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html · …/target-size-enhanced.html | 24 × 24 px (AA) avec exception d'espacement ; 44 × 44 px (AAA). | W3C WAI. |
| S17 | WCAG 2.2 — Understanding 2.4.13 Focus Appearance ; 2.4.11 Focus Not Obscured | https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html · …/focus-not-obscured-minimum.html | Indicateur d'au moins 2 px, 3:1 entre états ; élément focalisé non masqué par un bandeau fixe, technique `scroll-padding`. | W3C WAI. |
| S18 | WCAG 2.2 — Understanding 2.3.3 Animation from Interactions | https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html | Mouvement d'interaction désactivable (AAA), technique C39 ; couleur et opacité exclues. | W3C WAI. |
| S19 | WCAG 2.2 — Understanding 1.4.1 Use of Color | https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html | La couleur n'est jamais le seul moyen visuel (niveau A). | W3C WAI. |
| S20 | WCAG 2.2 — Understanding 1.4.10 Reflow | https://www.w3.org/WAI/WCAG22/Understanding/reflow.html | Utilisable à 320 px de large sans défilement dans deux directions (AA). | W3C WAI. |
| S21 | web.dev — prefers-reduced-motion ; High-performance CSS animations ; Accessible tap targets ; color-scheme | https://web.dev/articles/prefers-reduced-motion · https://web.dev/articles/animations-guide · https://web.dev/articles/accessible-tap-targets · https://web.dev/articles/color-scheme | Requête média et écoute `matchMedia` ; règle fourre-tout « at your own risk » ; animer `transform` et `opacity` ; cible d'environ 48 px espacée d'environ 8 px ; `color-scheme`. | Google Chrome (auteurs : T. Steiner, K. Basques, R. Andrew et al.). |
| S22 | Vercel Geist — Colors, Typography, Materials | https://vercel.com/geist/colors · https://vercel.com/geist/typography · https://vercel.com/geist/materials | Échelles où chaque palier a un rôle (fonds, filets, aplats, texte) ; aucun style de texte sous 12 px ; rayons et ombres par niveau d'élévation. | Design system officiel de Vercel (notre hébergeur). |
| S23 | Material Design — jetons de `material-web` ; aide Android Accessibilité | https://github.com/material-components/material-web/tree/main/tokens · https://support.google.com/accessibility/android/answer/7101858 | Durées 50–200, 250–400, 450–600 ms ; opacités d'état ; cible tactile de 48 dp. | Dépôt officiel Google `material-components/material-web`, 11 442 étoiles, commit du 2026-11-12 ; aide officielle Google. Le site m3.material.io n'a pas pu être lu (rendu JavaScript). |
| S24 | Apple — UI Design Dos and Don'ts | https://developer.apple.com/design/tips/ | Cibles de 44 × 44 points ; texte d'au moins 11 points. | Apple Developer. Les pages HIG détaillées n'ont pas pu être lues (rendu JavaScript). |
| S25 | Lucide — lucide-react ; Accessibility | https://lucide.dev/guide/packages/lucide-react · https://lucide.dev/guide/advanced/accessibility | Nom accessible sur le bouton, pas sur l'icône ; zone cliquable de 44 px autour d'une petite icône. | Doc officielle ; `lucide-icons/lucide` 25 734 étoiles. Écart constaté : la doc annonce `aria-hidden` par défaut, la 0.378.0 installée ne l'ajoute pas (lu dans `node_modules`). |
| S26 | MDN — font-weight, Fallback weights | https://developer.mozilla.org/en-US/docs/Web/CSS/font-weight | Algorithme de repli quand une graisse n'est pas chargée. | Mozilla ; `mdn/content` 11 137 étoiles. |
| S27 | Uber Engineering — How to Measure Design System at Scale (2024-09-24) | https://www.uber.com/us/en/blog/design-system-at-scale/ | Mesure d'adoption par écran, contrôle dans les builds quotidiens, garde-fous plutôt que bonne volonté. | Blog d'ingénierie d'Uber, auteurs nommés. |
| S28 | Design Tokens Community Group — Format Module 2025.10 | https://www.designtokens.org/tr/drafts/format/ | Vocabulaire : un token est une valeur nommée, un alias en référence une autre. | Groupe communautaire hébergé par le W3C ; le brouillon précise qu'il n'est pas une norme W3C. Utilisé pour le vocabulaire seulement. |
| S29 | Claude Code — Skills | https://code.claude.com/docs/en/skills.md | Format de ce skill : `SKILL.md` sous 500 lignes, fichiers d'appui chargés à la demande, champs de frontmatter. | Documentation Anthropic. |
| S30 | Sonner — toast() | https://sonner.emilkowal.ski/toast | `toast.success`, `toast.error`, `toast.loading`, `toast.promise`, durée par défaut. | Doc officielle ; `emilkowalski/sonner` 13 209 étoiles, commit du 2026-08-10. Signatures confirmées dans `node_modules/sonner`. |
| S31 | shadcn/ui — Introduction, Manual installation, sources `button.tsx` et `input.tsx` | https://ui.shadcn.com/docs · https://ui.shadcn.com/docs/installation/manual · https://github.com/shadcn-ui/ui/tree/main/apps/v4/registry/new-york-v4/ui | « This is not a component library. It is how you build your component library. » ; dépendances actuelles (`cn`, `tw-animate-css`, `radix-ui`) absentes chez nous ; `Input` en `text-base md:text-sm`. | Doc et dépôt officiels. |

## Paquets installés sans doc citée, vérifiés dans `node_modules`

| Paquet | Vérification |
|---|---|
| `tailwindcss` 3.4.19 | Compilation réelle de toutes les classes citées avec `tailwind.config.ts` ; option `hoverOnlyWhenSupported` lue dans `lib/featureFlags.js`. |
| `tailwind-merge` 2.6.1, `class-variance-authority` 0.7.1 | Exécution réelle (bug B1 et correctif) ; types lus dans `dist/*.d.ts`. |
| `@radix-ui/react-dialog` 1.1.15, `@radix-ui/react-slot` 1.2.4 | Types lus ; extraits compilés avec `tsc` en mode `strict`. `dist/index.mjs` lu : le dialogue modal annule le retour de focus par défaut et focalise `triggerRef` ; message d'erreur si `DialogTitle` manque. |
| `tailwindcss-animate` 1.0.7 | Classes `animate-in`, `fade-in-0`, `slide-in-from-*` compilées. `animate-in` pose `animation-duration: 150ms` ; durée calculée dans Chromium : `0.15s` avec un `duration-300` nu, `0.3s` avec `data-[state=open]:duration-300`. Dépôt `jamiebuilds/tailwindcss-animate` : 3 016 étoiles mais dernier commit 2024-07-28 ; ne rien bâtir de neuf dessus au-delà des entrées et sorties de modales. |
| `prettier-plugin-tailwindcss` 0.6.14 | Option `tailwindFunctions` lue dans le README installé ; dépôt 7 133 étoiles. |
| `@playwright/test` 1.59.1 | `emulateMedia({ colorScheme, reducedMotion, forcedColors })` lu dans les types. |

## Sources écartées

| Source | Raison |
|---|---|
| Reddit (r/tailwindcss, r/nextjs, r/reactjs…) | Domaine inaccessible à nos outils de recherche et de lecture : aucun fil consulté, aucune affirmation n'en provient. |
| YouTube, conférences | Aucune transcription lue : non utilisées. |
| DoorDash Engineering — « Implementing Theming in DoorDash's Design Language System », « Launching Dark Mode… » | Pages en erreur 403 ; seul un résumé de moteur de recherche était disponible : non utilisées. |
| m3.material.io, HIG Apple (pages détaillées), base.uber.com | Rendu JavaScript illisible ; remplacées par S23 et S24. |
| `emilkowalski/vaul` | 8 728 étoiles mais dernier commit 2025-10-03, plus de douze mois : non recommandé. |
| `francoismassart/eslint-plugin-tailwindcss` | 2 072 étoiles, sous le seuil de 3 000. |
| `Shopify/polaris` | Dépôt archivé. |
| `radix-ui/colors`, `primer/primitives` | Sous le seuil d'étoiles et outils que nous n'utilisons pas. |
| `pacocoursey/next-themes` | Fiable (6 353 étoiles, commit du 2026-02-25) mais non installé ; cité comme alternative, non requis. |

## Affirmations non corroborées par une source primaire

| Affirmation | Statut |
|---|---|
| « iOS Safari zoome sur un champ dont la police fait moins de 16 px » | Répandue (blogs, forums), **aucune doc Apple ou WebKit trouvée**. Le composant `Input` de shadcn applique `text-base md:text-sm` (S31). À vérifier sur un iPhone réel avant de généraliser. |
| Part du trafic sur des navigateurs antérieurs à Safari 16.4 | Inconnue : à mesurer avant toute décision sur Tailwind 4. |

## Mesures faites sur notre code et notre production

| Mesure | Méthode |
|---|---|
| Comptages de classes, paires clair/sombre, primitives vivantes ou mortes | `scripts/design-audit.mjs` et scripts d'analyse jetables, HEAD `161f920`. |
| Ratios de contraste | `scripts/contrast.mjs` (luminance relative WCAG 2.x). |
| CSS généré (rayons, `border-border/50`, variante `dark:`, classes fantômes, doublons d'animations) | `node_modules/.bin/tailwindcss` avec `tailwind.config.ts` et `src/styles/globals.css`, sortie hors dépôt. |
| Bordure blanche en sombre, portée de `:is(.dark *)` | Page de test dans le Chromium de Playwright (hors réseau) : `border-color` calculé `rgb(250, 250, 250)`. |
| Bug `cn()` | `twMerge` installé exécuté sur la sortie exacte de `buttonVariants` et sur chaque `<Button>` du code. |
| Polices non appliquées, bouton du panier, rayon de `rounded-lg`, règles `hover:` | Lecture de `getComputedStyle`, `document.fonts` et des feuilles de style sur https://klikandgo.app/ et /panier, le 2026-11-13 (deux fois) et le 2026-11-14, sans aucune écriture. |
| Classes de `src/lib` absentes du CSS (B12) | CSS complet compilé avec `tailwind.config.ts` tel quel, puis avec `./src/lib/**/*.{ts,tsx}` ajouté à `content` (copie hors dépôt) ; recherche de chaque classe de `src/lib/**` dans la sortie. |
| Durée des animations de modale (B13), anneau de focus et écart en sombre | Page de test hors réseau dans le Chromium de Playwright : `animationDuration` et `boxShadow` calculés. |
| Chiffres à `HEAD` et sur l'arbre du chantier de tarification | `design-audit.mjs` lancé sur une extraction `git archive HEAD` hors dépôt, puis sur l'arbre de travail, le 2026-11-14. |
