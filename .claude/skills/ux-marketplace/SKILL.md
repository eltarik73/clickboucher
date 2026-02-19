---
name: ux-marketplace
description: Patterns UX de marketplace et e-commerce inspirés d'Uber Eats, Getir, Deliveroo, Planity, et Amazon. Utiliser pour améliorer l'expérience utilisateur, les conversions, la rétention, et le parcours d'achat.
---

# UX Marketplace — Patterns qui convertissent

## Patterns Uber Eats à copier

### 1. Carte restaurant/boutique
```
┌──────────────────────────────┐
│  [PHOTO grande, 16:9]        │
│  ❤️ (favoris top right)      │
├──────────────────────────────┤
│  Nom Boucherie    ⭐ 4.8     │
│  📍 1.2 km · 🕐 15-20 min   │
│  🏷️ Halal · Bœuf · Agneau   │
└──────────────────────────────┘
```
- Photo GRANDE (occupe 60% de la carte)
- Info essentielles en 1 coup d'œil
- Distance + temps estimé = décision rapide

### 2. Page boutique (scroll vertical)
```
[HERO PHOTO boutique]
[Nom + note + infos]
[Barre recherche produits]
[Catégories scrollables horizontal]
[Grille produits]
[Bottom bar panier sticky]
```
- Catégories = tabs horizontaux scrollables (pas un dropdown)
- Sticky search bar quand on scroll
- Panier TOUJOURS visible en bas

### 3. Social proof
- "🔥 Populaire" sur les produits les plus commandés
- "⏱️ Commandé il y a 5 min" (récence)
- "🛒 X personnes ont commandé aujourd'hui"
- "⭐ 4.8 (156 avis)" (note + nombre)
- "Nouveau ! 🆕" sur les nouveaux produits

### 4. Urgence / scarcité
- "🟢 Ouvert — ferme dans 2h"
- "⚠️ Plus que 3 en stock"
- "🕐 Temps de prép : ~15 min"
- Timer sur les créneaux disponibles

### 5. Feedback immédiat
- Ajout panier : micro-animation bounce + toast + badge compteur
- Changement quantité : haptic feedback (vibration)
- Commande envoyée : confettis ou check animé
- Erreur : shake animation + message clair en rouge

## Patterns Getir (livraison rapide)

### Bottom sheet panier
```
┌─────────────────────────────────┐
│  🛒 3 articles · 42,50 €       │
│  [VOIR LE PANIER →]            │
└─────────────────────────────────┘
```
- Fixé en bas de l'écran
- Glassmorphism (backdrop-blur)
- Se glisse vers le haut pour voir le détail
- Disparaît quand panier vide (animation slide-down)

### Catégories visuelles
- Icônes pour chaque catégorie (🐄 Bœuf, 🐑 Agneau, 🐔 Volaille, 🔥 Merguez)
- Scroll horizontal
- Active = fond bordeau + texte blanc
- Inactive = fond gris + texte gris

## Patterns Planity (prise de RDV)

### Sélecteur créneau
```
┌─────────────────────────────────┐
│  📅 Aujourd'hui    Demain  >   │
├─────────────────────────────────┤
│  [14:00] [14:30] [15:00]       │
│  [15:30] [16:00] [16:30]       │
│  [17:00]  ----    ----         │
└─────────────────────────────────┘
```
- Jours en scroll horizontal
- Créneaux en grille
- Disponible = bordeau, plein
- Occupé = grisé
- Sélectionné = bg-[#DC2626] text-white scale-105

## Métriques UX à surveiller
- Taux d'ajout au panier (> 30% = bon)
- Taux d'abandon panier (< 50% = bon)
- Temps pour compléter une commande (< 3 min = excellent)
- Nombre de taps pour commander (< 5 = optimal)
- Taux de retour client (> 40% = excellente rétention)

## Checklist UX avant livraison
- [ ] Un nouveau client peut commander en < 3 minutes
- [ ] Le panier est visible à tout moment
- [ ] Le feedback est immédiat sur chaque action
- [ ] Le suivi commande est clair et rassurant
- [ ] Le boucher peut traiter une commande en < 30 secondes
- [ ] Tout fonctionne avec le pouce sur mobile
- [ ] Les prix sont clairs (TTC, au kg, total)
