---
name: design-klikgo
description: Design UI/UX style Uber Eats et click & collect moderne pour Klik&Go. Utiliser quand on crée ou modifie des composants, pages, ou interfaces utilisateur. Applique le design system Klik&Go (bordeaux #DC2626, fond sombre, mobile-first, touch targets 44px+).
---

# Design System Klik&Go — Style Uber Eats / Getir / Planity

## Identité visuelle
- Primaire : #DC2626 (bordeaux/rouge)
- Fond sombre : #0A0A0A (cuisine), #FAFAFA (client)
- Accents : emerald-600 (succès), amber-500 (warning), red-500 (erreur)
- Fonts : Plus Jakarta Sans ou DM Sans (JAMAIS Inter, Roboto, Arial)
- Radius : rounded-xl minimum (rounded-2xl pour les cartes)
- Shadows : shadow-sm à shadow-lg, jamais de flat boring

## Mobile-first OBLIGATOIRE
- Concevoir pour 375px d'abord
- Touch targets ≥ 44px (boutons cuisine ≥ 56px)
- CTA principal visible sans scroller
- 3 taps max pour une action clé
- Bottom bar panier sticky sur mobile

## Patterns par interface

### Client (catalogue, panier, suivi)
- Grille produits : 2 col mobile, 3 tablette, 4 desktop
- Carte produit ultra-compact : image 4:3, nom, prix, bouton "+"
- Badges : 🇫🇷 France / ☪ Halal (icônes seuls en 4 col, texte en 2-3 col)
- Bottom bar panier : glassmorphism, sticky, total + bouton commander
- Suivi commande : timeline verticale avec statuts animés

### Boucher cuisine (tablette)
- Fond NOIR (#0A0A0A) pour réduire fatigue en cuisine
- TOUT en gros : text-xl minimum, boutons h-14 minimum
- Cartes commande : bg-[#141414] border-white/5
- Timer countdown : text-5xl font-mono
- Overlay alerte : plein écran, vert pulsant, z-[9999]

### Boucher dashboard (gestion)
- Sidebar : bg-white, items avec icônes, hover bg-gray-100
- Stats cards : icône + nombre + label + évolution %
- Tableaux : headers bg-gray-50, hover bg-gray-50, rounded-xl
- Graphiques : Recharts, couleurs cohérentes avec le design system

### Admin (webmaster)
- Interface sobre, fonctionnelle
- Tableaux avec filtres, pagination
- Badges statut colorés

## Anti-patterns INTERDITS
- ❌ Interfaces génériques blanches sans personnalité
- ❌ Boutons trop petits (< 44px)
- ❌ Pas de feedback sur les actions (toujours un toast ou animation)
- ❌ Formulaires de plus de 6 champs par écran
- ❌ Emojis comme seul indicateur (toujours couleur + forme + texte)
- ❌ CTA noyé en bas de page sans contrast

## Composants shadcn/ui utilisés
Button, Card, Dialog, Sheet, Tabs, Toast, Badge, Input, Select, Checkbox, Switch, Table, DropdownMenu, Tooltip, Separator

## Icônes : Lucide React exclusivement

## Animations
- Transitions : 200-300ms ease
- Hover : scale-[1.02] ou brightness
- Toast : slide-in depuis le haut
- Overlay : fade-in 300ms
- Timer pulse : animate-pulse quand < 2min
