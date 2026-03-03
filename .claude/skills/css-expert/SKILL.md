---
name: css-expert
user_invocable: false
description: Patterns CSS/Tailwind avances pour Klik&Go. Flexbox, Grid, responsive, animations, dark mode, design tokens, container queries, et accessibilite. Sources — Tailwind best practices 2025, umeshmk/Tailwindcss-cheatsheet, bulletproof-react performance.
---

# CSS Expert — Layout, Responsive & Design System

## Box Model

```
┌─────────────────────────────────┐
│            MARGIN               │
│  ┌───────────────────────────┐  │
│  │         BORDER            │  │
│  │  ┌───────────────────┐    │  │
│  │  │     PADDING       │    │  │
│  │  │  ┌─────────────┐  │    │  │
│  │  │  │   CONTENT    │  │    │  │
│  │  │  └─────────────┘  │    │  │
│  │  └───────────────────┘    │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

- `box-sizing: border-box` → width inclut padding + border (TOUJOURS utiliser)
- `margin` = exterieur, `padding` = interieur
- Margins verticaux fusionnent (margin collapse) entre elements block
- `display: none` retire du flux ; `visibility: hidden` garde l'espace

## Flexbox (utilise massivement dans Klik&Go)

```css
.container {
  display: flex;
  flex-direction: row;       /* row | column | row-reverse | column-reverse */
  justify-content: center;   /* Axe principal : start | center | end | space-between | space-around */
  align-items: center;       /* Axe croise : start | center | end | stretch | baseline */
  gap: 16px;                 /* Espace entre items */
  flex-wrap: wrap;           /* Retour a la ligne */
}

.item {
  flex: 1 0 0;     /* flex-grow: 1, flex-shrink: 0, flex-basis: 0 → parts egales */
  flex: 1;         /* Raccourci = flex: 1 1 0 */
  align-self: end; /* Override align-items pour cet item */
}
```

### Patterns Tailwind Klik&Go
```html
<!-- Centrer horizontalement et verticalement -->
<div class="flex items-center justify-center">

<!-- Espace entre elements (header) -->
<div class="flex items-center justify-between">

<!-- Stack vertical avec gap -->
<div class="flex flex-col gap-4">

<!-- Item qui prend tout l'espace restant -->
<div class="flex-1 min-w-0"> <!-- min-w-0 pour le text-overflow -->
```

## Grid

```css
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr); /* 3 colonnes egales */
  grid-template-columns: 240px 1fr;      /* Sidebar fixe + contenu flexible */
  gap: 24px;
  grid-column: 1 / -1;  /* Span toutes les colonnes */
}
```

### Patterns Tailwind Klik&Go
```html
<!-- Grille responsive : 1 col mobile, 2 tablette, 3 desktop -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

<!-- 2 colonnes sur boucher commandes -->
<div class="grid grid-cols-2 gap-4 lg:grid-cols-3">
```

## Position

- `static` : flux normal (defaut)
- `relative` : decale par rapport a sa position normale, sert de reference
- `absolute` : retire du flux, positionne par rapport au parent relative/absolute
- `fixed` : par rapport au viewport (headers sticky)
- `sticky` : hybride relative/fixed, colle au scroll

```css
/* Header Klik&Go */
.header { position: sticky; top: 0; z-index: 10; }

/* Badge superpose */
.badge { position: absolute; top: -4px; right: -4px; }
```

## Responsive Design

### Breakpoints Tailwind (mobile-first)
```
sm:  640px   → Petit ecran
md:  768px   → Tablette
lg:  1024px  → Desktop
xl:  1280px  → Grand ecran
2xl: 1536px  → Tres grand
```

### Unites
- `px` : fixe (pour les bordures, petits details)
- `rem` : relatif au root font-size (16px par defaut) — PREFERER pour font-size, spacing
- `em` : relatif au parent font-size (eviter pour le spacing)
- `%` : relatif au parent
- `vw/vh` : viewport width/height
- `fr` : fraction (Grid)

### Patterns Klik&Go
```html
<!-- Max width container -->
<main class="max-w-xl mx-auto px-5">

<!-- Responsive text -->
<h1 class="text-2xl md:text-4xl font-bold">

<!-- Image responsive -->
<img class="w-full max-w-[400px] object-cover rounded-2xl">

<!-- Touch targets minimum 44px -->
<button class="min-h-[44px] px-4 py-3">
```

## Dark Mode (Klik&Go)

```css
/* Tailwind class strategy : darkMode: ["class"] */
/* .dark sur <html> toggle le mode */
```

```html
<!-- Pattern bicolore Klik&Go -->
<div class="bg-[#f8f6f3] dark:bg-[#0a0a0a]">        <!-- Page bg -->
<div class="bg-white dark:bg-[#141414]">              <!-- Cards -->
<div class="border-[#ece8e3] dark:border-white/10">   <!-- Borders -->
<p class="text-[#2a2018] dark:text-white">            <!-- Text principal -->
<p class="text-[#999] dark:text-gray-400">            <!-- Text secondaire -->
<!-- Rouge identique dans les 2 modes -->
<span class="text-[#DC2626]">
```

## Animations & Transitions

```css
/* Transition (hover, focus, state change) */
transition: all 200ms ease;
transition: transform 300ms, opacity 200ms;

/* Proprietes qui NE triggent PAS de layout recalculation */
/* PERFORMANT : opacity, transform */
/* LENT : width, height, margin, padding, top, left */

/* Animation keyframes */
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
.bounce { animation: bounce 1s ease infinite; }
```

### Patterns Tailwind Klik&Go
```html
<!-- Hover scale -->
<button class="hover:scale-[1.02] active:scale-95 transition-all">

<!-- Loading dots -->
<div class="animate-bounce" style="animation-delay: 150ms">

<!-- Pulse pour attention -->
<div class="animate-pulse ring-2 ring-amber-500/50">

<!-- Fade in -->
<div class="animate-in fade-in duration-300">
```

## Specificity (du plus faible au plus fort)

1. Element : `p`, `div`, `h1` → 0,0,1
2. Classe : `.card`, `.active` → 0,1,0
3. ID : `#header` → 1,0,0
4. Inline style : `style="..."` → 1,0,0,0
5. `!important` → override tout (EVITER)

```css
/* Deux classes > une classe */
.card.active { } /* 0,2,0 — gagne contre .card seul */

/* En cas d'egalite → le dernier dans le CSS gagne */
```

## Accessibilite CSS

- `outline: none` sur :focus → INTERDIT sauf si :focus-visible est gere
- `:focus-visible` pour les focus ring clavier uniquement
- Contrast ratio WCAG AA : 4.5:1 texte normal, 3:1 gros texte
- `prefers-reduced-motion: reduce` pour desactiver les animations
- `prefers-color-scheme: dark` pour le dark mode system
- Touch targets : minimum 44x44px

```html
<!-- Focus visible Klik&Go -->
<button class="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]">

<!-- Screen reader only -->
<span class="sr-only">Fermer</span>
```

## Pseudo-elements & Pseudo-classes utiles

```css
::before, ::after  /* Contenu genere */
::placeholder      /* Style du placeholder input */
::selection        /* Texte selectionne */
:first-child, :last-child
:nth-child(2n+1)   /* Elements impairs */
:not(.disabled)     /* Negation */
:hover, :focus, :active, :visited
:focus-visible      /* Focus clavier uniquement */
:disabled, :invalid, :checked
```

## Tailwind 2025 — Best Practices

### Component-first Thinking
```html
<!-- MAUVAIS — classes utilitaires repetees partout -->
<button class="bg-[#DC2626] text-white px-6 py-3 rounded-xl font-semibold hover:scale-[1.02] active:scale-95 transition-all">
<button class="bg-[#DC2626] text-white px-6 py-3 rounded-xl font-semibold hover:scale-[1.02] active:scale-95 transition-all">

<!-- BON — extraire dans un composant React -->
<!-- Button.tsx avec les classes definies UNE fois -->
```

### Design Tokens via tailwind.config
```javascript
// tailwind.config.ts — Klik&Go tokens
theme: {
  extend: {
    colors: {
      brand: '#DC2626',
      'page-light': '#f8f6f3',
      'page-dark': '#0a0a0a',
      'card-light': '#ffffff',
      'card-dark': '#141414',
    },
    fontFamily: {
      sans: ['Plus Jakarta Sans', 'DM Sans', 'sans-serif'],
    },
    borderRadius: {
      'card': '16px',
      'button': '12px',
    },
  },
}
// Utiliser : bg-brand, bg-page-light, dark:bg-page-dark, rounded-card
```

### Container Queries (@container)
```html
<!-- Composant qui s'adapte a SON conteneur, pas au viewport -->
<div class="@container">
  <div class="@lg:flex @lg:gap-6 @sm:grid @sm:grid-cols-2">
    <!-- Layout change selon la largeur du PARENT -->
  </div>
</div>
```
- Plus granulaire que les media queries (responsive par composant)
- Ideal pour les cards qui apparaissent dans des contextes differents (sidebar vs main)

### @layer pour CSS global
```css
/* globals.css — Klik&Go */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  /* Styles globaux reset */
  html { scroll-behavior: smooth; }
  body { -webkit-font-smoothing: antialiased; }
}

@layer components {
  /* Classes reutilisables Klik&Go */
  .btn-primary {
    @apply bg-[#DC2626] text-white px-6 py-3 rounded-xl font-semibold
           hover:scale-[1.02] active:scale-95 transition-all;
  }
  .card-base {
    @apply bg-white dark:bg-[#141414] rounded-2xl border
           border-[#ece8e3] dark:border-white/10;
  }
}

@layer utilities {
  /* Utilitaires custom */
  .text-balance { text-wrap: balance; }
}
```

### Performance Tailwind
- Configurer `content` paths precisement (eviter scanner node_modules)
- Eviter les arbitrary values excessifs `[123px]` → utiliser le spacing scale
- Preferer les classes semantiques Tailwind aux valeurs inline
- `@apply` dans @layer components pour DRY, pas dans les composants React
- JIT mode (defaut depuis Tailwind 3) = AUCUNE classe inutile en production

### Patterns responsive Klik&Go avances
```html
<!-- Grille auto-fill (pas besoin de breakpoints) -->
<div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">

<!-- Clamp pour font-size fluide -->
<h1 class="text-[clamp(1.5rem,4vw,3rem)]">

<!-- Aspect ratio pour les images produit -->
<div class="aspect-[4/3] overflow-hidden rounded-2xl">
  <img class="w-full h-full object-cover" />
</div>

<!-- Safe area (iPhone notch) -->
<div class="pb-[env(safe-area-inset-bottom)]">
```

### Tailwind + Dark Mode avance
```html
<!-- Transition douce entre modes -->
<html class="transition-colors duration-300">

<!-- Ombres adaptatives -->
<div class="shadow-lg shadow-black/5 dark:shadow-black/30">

<!-- Opacites differentes selon le mode -->
<img class="opacity-100 dark:opacity-80">

<!-- Hover different en dark mode -->
<button class="hover:bg-gray-100 dark:hover:bg-white/10">
```
