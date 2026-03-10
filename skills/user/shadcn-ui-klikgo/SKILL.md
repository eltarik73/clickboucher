---
name: shadcn-ui-klikgo
description: "Guide d'utilisation des composants shadcn/ui et du design system Klik&Go. Utiliser ce skill dès que l'utilisateur mentionne : shadcn, composant UI, Button, Card, Dialog, Sheet, Tabs, Toast, Badge, design system, ou demande de créer/modifier un composant d'interface. Aussi quand il mentionne les couleurs Klik&Go, le thème dark mode, ou les composants spécifiques du projet. Toujours répondre en français."
---

# shadcn/ui — Design System Klik&Go

Tu es un expert en composants shadcn/ui appliqués au design system Klik&Go.

## Règles shadcn/ui

### Principes
- Utiliser les composants shadcn/ui comme **base** (Button, Card, Dialog, Sheet, Tabs, Toast, Badge, etc.)
- Customiser **via Tailwind CSS uniquement** — ne jamais modifier les fichiers source shadcn
- **Semantic HTML** : nav, main, section, article, aside
- **Lucide React** pour toutes les icônes (jamais d'autre bibliothèque d'icônes)
- **Recharts** pour les graphiques et statistiques

### Styling
- Pas de CSS custom sauf cas exceptionnel
- Utiliser les CSS variables de shadcn pour le theming
- Dark mode supporté sur tous les composants (non négociable)
- Contrastes WCAG AA minimum

## Design System Klik&Go

### Identité visuelle
- **Couleur primaire** : rouge `#DC2626`
- **Font** : Outfit (jamais Inter, Roboto ou Arial)
- **Logo** : cercle rouge avec "K" blanc + 3 traits de vitesse ; texte "Klik" (noir/blanc dark) + "&" (rouge) + "Go" (noir/blanc dark)
- **Ton** : professionnel, moderne, orienté conversion

### Backgrounds
- Pas de blanc plat — toujours de la profondeur (subtle gradients, textures légères)
- Dark mode : fond sombre avec nuances, pas du noir pur `#000`

### Micro-interactions
- Feedback immédiat sur chaque action (toast, animation, vibration mobile)
- Transitions : 200-300ms (ease-in-out)
- Hover states soignés sur desktop

## Composants clés Klik&Go

### Card produit
- Image (aspect 4:3, object-cover, object-center)
- Nom du produit
- Prix (en gras, couleur primaire)
- Labels halal / traçabilité (pills vertes)
- Bouton "Ajouter au panier"

### Dialog commande (dashboard boucher)
- Détails de la commande
- Timer de préparation
- Actions boucher : Accepter / Refuser / Prêt

### Sheet panier (mobile)
- Bottom sheet avec résumé panier
- Liste des produits avec quantités modifiables
- Total + bouton "Commander"

### Tabs dashboard boucher
- **Nouvelles** : commandes entrantes (avec son Marimba)
- **En cours** : commandes acceptées en préparation
- **Prêtes** : commandes terminées en attente de retrait
- **Programmées** : précommandes planifiées

### Toast notifications
- Succès : vert (commande acceptée, paiement reçu)
- Erreur : rouge (échec paiement, erreur système)
- Info : bleu (nouvelle commande, mise à jour)
- Warning : orange (stock bas, créneau bientôt plein)

### Badge statut boutique
- **OPEN** : vert — boutique en ligne
- **BUSY** : orange — boutique en pause temporaire
- **PAUSED** : rouge — boutique fermée manuellement
- **VACATION** : violet — boutique en vacances

## Son de notification

- "Marimba Song" via **Web Audio API**
- Triangle wave, notes Sol-Si-Ré-Sol ascendant
- Son woody et profond
- Se déclenche sur nouvelle commande uniquement

## Images produits

### Composant ProductImage
- Composant réutilisable avec fallback
- Utiliser `aspect-[4/3]` avec `object-cover object-center`
- Ne pas utiliser de conteneurs à hauteur fixe
- Fallback : placeholder gris avec icône produit
- Utilitaire `getProductImage()` pour le mapping

### Photos IA (Recraft)
- Background : dark slate stone
- Éclairage : dramatic studio lighting
- Objectif : 85mm f/2.8
- Ratio : 4:3 (1024×768)
- Règle : "no text no watermark no human hands"
