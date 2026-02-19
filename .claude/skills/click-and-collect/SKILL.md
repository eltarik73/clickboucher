---
name: click-and-collect
description: Expert Click & Collect pour Klik&Go. Patterns UX et techniques pour la commande en ligne avec retrait en boutique. Utiliser quand on travaille sur le parcours commande, le panier, les créneaux de retrait, le suivi commande, et le flux complet client → boucher → retrait.
---

# Click & Collect Expert — Klik&Go

## Le flux complet (5 étapes)

### 1. DÉCOUVERTE — Le client choisit sa boucherie
```
/decouvrir → liste des boucheries
  ├── Carte : photo, nom, adresse, note, distance, statut (🟢/🔴)
  ├── Filtres : distance, note, ouvert maintenant
  ├── Recherche par nom ou ville
  └── Clic → /boutique/[slug] (page boutique)
```
Patterns :
- Géolocalisation pour trier par distance (navigator.geolocation)
- Badge "Ouvert" (vert) / "Fermé" (gris) / "Occupé" (orange)
- Nombre de commandes en cours (social proof)

### 2. CATALOGUE — Le client remplit son panier
```
/boutique/[slug] → catalogue produits
  ├── Catégories en tabs horizontaux (Bœuf, Agneau, Volaille, Merguez...)
  ├── Grille produits (4 colonnes, cartes ultra-compact)
  ├── Bouton "+" ajoute au panier (feedback immédiat : toast + badge panier)
  ├── Produit au poids → sélecteur quantité en grammes/kg
  ├── Bottom bar panier sticky (total + "Voir le panier")
  └── Badges : 🇫🇷 France / ☪ Halal / 🏷️ Promo / ⭐ Pro
```
Patterns :
- Panier persistant en localStorage (survit au refresh)
- Compteur badge sur l'icône panier (top right)
- Animation micro quand on ajoute (scale bounce)
- Produit indisponible → grisé + "Rupture de stock"
- Prix au kg affiché, total calculé dynamiquement selon la quantité

### 3. PANIER & CRÉNEAU — Le client valide
```
/panier → récapitulatif
  ├── Liste des items (quantité modifiable, supprimer)
  ├── Sous-total par item + total
  ├── Sélecteur créneau de retrait :
  │   ├── "Dès que possible" (défaut)
  │   ├── Aujourd'hui : créneaux de 30 min (14h-14h30, 14h30-15h...)
  │   └── Demain : créneaux de 30 min
  ├── Note pour le boucher (champ texte optionnel)
  ├── Choix paiement : "En ligne" ou "Sur place"
  └── Bouton "COMMANDER" (CTA principal)
```
Patterns :
- Créneaux générés selon horaires boutique (Shop.openingHours)
- Créneaux passés = grisés
- Créneau occupé (trop de commandes) = "⚠️ Temps d'attente élevé"
- Résumé commande visible sans scroller
- Frais de service si applicable (transparence)

### 4. PAIEMENT & CONFIRMATION
```
Commander →
  ├── Paiement "En ligne" → Stripe Checkout → redirect /commande/[id]/confirmation
  └── Paiement "Sur place" → direct → /commande/[id]/confirmation

/commande/[id]/confirmation →
  ├── ✅ "Commande envoyée !"
  ├── Numéro de commande (#KG-042)
  ├── Récapitulatif items
  ├── Créneau de retrait choisi
  ├── Adresse boutique + lien Google Maps
  ├── "Suivre ma commande →" (lien)
  └── Notification push activée (demander permission)
```
Patterns :
- Numéro de commande court et mémorisable (KG-XXX)
- QR code généré pour le retrait (scanné par le boucher)
- Email de confirmation (si Resend configuré)
- Redirection vers suivi automatique après 5s

### 5. SUIVI EN TEMPS RÉEL
```
/commande/[id]/suivi →
  ├── Timeline verticale avec statuts :
  │   ├── ✅ Commande envoyée (heure)
  │   ├── ✅ Acceptée par le boucher (heure)
  │   ├── 🔄 En préparation (timer countdown)
  │   ├── ⏳ Prête ! Venez récupérer (alerte)
  │   └── ✅ Récupérée
  ├── Timer "Prête dans ~12 min"
  ├── Barre de progression animée
  ├── Infos boutique (adresse, téléphone, Google Maps)
  └── Bouton "Appeler la boucherie" (tel:)
```
Patterns :
- Polling toutes les 10s pour mettre à jour le statut
- Animation de transition entre chaque statut
- Notification push quand statut change (surtout READY)
- Timer qui se met à jour en temps réel
- Si commande refusée → message clair + raison + bouton "Recommander"

## Gestion du panier — Context React

```typescript
// src/context/CartContext.tsx
"use client"

interface CartItem {
  productId: string
  shopId: string
  name: string
  priceCents: number
  quantity: number       // en grammes pour le poids, unités sinon
  unit: 'g' | 'kg' | 'piece'
  imageUrl?: string
}

interface CartState {
  items: CartItem[]
  shopId: string | null  // UN seul shop par panier (pas de multi-shop)
}

// Actions : ADD_ITEM, REMOVE_ITEM, UPDATE_QUANTITY, CLEAR_CART
// Persist dans localStorage
// Si le client ajoute un produit d'un AUTRE shop → alerte "Vider le panier ?"
```

Règle : UN PANIER = UNE BOUCHERIE. Si le client change de boutique, le panier se vide (avec confirmation).

## Créneaux de retrait

```typescript
// src/lib/time-slots.ts
interface TimeSlot {
  start: string  // "14:00"
  end: string    // "14:30"
  available: boolean
  ordersCount: number
}

// Générer les créneaux :
// 1. Lire les horaires du shop (openingHours)
// 2. Découper en tranches de 30 min
// 3. Exclure les créneaux passés
// 4. Marquer "occupé" si > X commandes sur le créneau
// 5. Commencer minimum 30 min après maintenant (temps de prép)
```

## Commande en DB

```typescript
// Champs essentiels Order
{
  orderNumber: "KG-042",        // auto-généré, unique par shop
  status: OrderStatus,          // PENDING → ACCEPTED → PREPARING → READY → PICKED_UP
  shopId: string,
  userId: string,
  items: OrderItem[],
  totalCents: number,
  paymentMethod: "ONLINE" | "ON_PICKUP",
  paidAt: DateTime?,            // null si ON_PICKUP
  pickupSlot: DateTime?,        // créneau choisi
  pickupType: "ASAP" | "SCHEDULED",
  prepMinutes: number?,         // temps de prép estimé
  estimatedReadyAt: DateTime?,
  note: string?,                // note client
  qrCode: string?,              // pour validation retrait
}
```

## Anti-patterns Click & Collect
- ❌ Multi-shop dans un panier (trop complexe, Uber ne le fait pas non plus)
- ❌ Pas de créneau horaire (le client ne sait pas quand venir)
- ❌ Pas de suivi après commande (le client est perdu)
- ❌ Commande sans numéro mémorisable
- ❌ Pas de note client (le boucher a besoin d'infos)
- ❌ Paiement en ligne OBLIGATOIRE (proposer toujours "sur place")
