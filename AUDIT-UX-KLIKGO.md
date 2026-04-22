# Audit UX Complet — Klik&Go (Parcours Client)

**Date** : 25 fevrier 2026
**Auditeur** : Lead Design Senior
**Scope** : Parcours client complet (decouvrir, boutique, panier, checkout, suivi commande)

---

## Resume executif

Klik&Go est une app Click & Collect bien architecturee avec un parcours client clair : **Decouvrir > Boutique > Panier > Checkout > Suivi > Retrait**. L'UX est globalement solide avec un design system coherent (rouge #DC2626, cards arrondies, typographie DM Sans/Outfit). Cependant, **20 problemes UX** ont ete identifies, dont **8 critiques/hauts** qui impactent directement la conversion et la satisfaction utilisateur.

**Score global : 7/10** — Bon fondation, axes d'amelioration clairs.

---

## 1. Parcours Decouverte (/decouvrir)

### Ce qui marche bien

- **Hero percutant** : Accroche "Marre d'attendre ?" claire et differenciante
- **Proposition de valeur** en 3 mots : "Commandez. Recuperez. Savourez."
- **SearchBar** presente et bien positionnee
- **Offres du moment** en scroll horizontal (pattern promo efficace)
- **NearbyShops** avec geolocalisation (tri par distance)
- **ActiveOrderBanner** pour rappeler les commandes en cours
- **ReorderCarousel** pour clients recurrents (pattern Uber Eats)

### Problemes identifies

| # | Probleme | Severite | Detail |
|---|----------|----------|--------|
| 1 | **Promos hardcodees** | CRITIQUE | Les offres du moment sont en dur dans le code (`const PROMOS = [...]`). Aucune donnee dynamique. Le boucher ne peut pas gerer ses promos. |
| 2 | **Barre de recherche : pas de feedback erreur** | HAUT | Le `.catch(() => {})` avale silencieusement les erreurs. L'utilisateur ne sait pas si la recherche a echoue. |
| 3 | **Bouton "recherche vocale" non fonctionnel** | HAUT | Le bouton existe mais ne fait que focus l'input. Interface trompeuse. |
| 4 | **Pas de coeur sur les ShopCards** depuis la page d'accueil | MOYEN | Il faut ouvrir une boutique pour la mettre en favori. Friction inutile. |
| 5 | **Geolocalisation silencieuse** | MOYEN | Aucune explication avant de demander la position. Pas de message d'erreur si refuse. |
| 6 | **Accents manquants dans les textes** | BAS | "Decouvrir", "reessayer", "etes" au lieu de "Decouvrir", "reessayer", "etes". |

### Recommandations

- Rendre les promos dynamiques via l'API `/api/offers`
- Ajouter un toast d'erreur quand la recherche echoue
- Soit implementer la recherche vocale (Web Speech API), soit retirer le bouton
- Ajouter un `FavoriteButton` directement sur les `ShopCard` dans la liste
- Afficher un bandeau explicatif avant de demander la geolocalisation

---

## 2. Parcours Boutique (/boutique/[id])

### Ce qui marche bien

- **Hero image** avec overlay degrade (pattern Uber Eats)
- **Favori** accessible en haut a droite
- **Temps de preparation** avec code couleur (vert/ambre/rouge)
- **Status badges** clairs (mode occupe, pause)
- **Categories en tabs** horizontal scroll (pattern standard e-commerce)
- **ISR 30s + cache Redis 60s** : performances excellentes

### Problemes identifies

| # | Probleme | Severite | Detail |
|---|----------|----------|--------|
| 7 | **Pas de skeleton loading** pour les produits | HAUT | La grille de produits apparait d'un coup apres le fetch. Pas de shimmer/placeholder. Layout shift visible. |
| 8 | **Bouton produit en rupture** : pas d'etat disabled clair | HAUT | L'element est simplement retire. Les utilisateurs au clavier ne comprennent pas pourquoi c'est non-interactif. |
| 9 | **Recherche = navigation boutique** (pas d'ajout direct au panier) | MOYEN | Cliquer sur un resultat de recherche navigue vers la boutique. Pas de "ajouter au panier" directement depuis la recherche. Friction supplementaire. |
| 10 | **Pas de presets poids** pour les produits au kg | MOYEN | L'utilisateur doit saisir manuellement le poids desire. Il manque des boutons rapides "250g / 500g / 1kg". |

### Recommandations

- Ajouter 4-6 `Skeleton` cards pendant le chargement produit
- Afficher un badge "Rupture" + bouton grise `disabled` au lieu de masquer
- Ajouter des boutons de poids preselectionnes dans le `WeightSheet`
- Permettre l'ajout au panier depuis les resultats de recherche

---

## 3. Parcours Panier & Checkout (/panier)

### Ce qui marche bien

- **Panier unifie** avec checkout sur la meme page (reduit les etapes)
- **CartItemRow** clean avec image, nom, quantite, prix, controles
- **Protection changement de boutique** : ConfirmDialog avant de vider
- **Persistance** : sessionStorage + sync DB (debounce 2s)
- **Notes au boucher** : textarea bien placee avec placeholder pertinent
- **Creneaux de retrait** : grille 3 colonnes avec places restantes
- **2 modes de paiement** : sur place + en ligne (conditionnel)
- **Suggestions cross-sell** apres les items du panier

### Problemes identifies

| # | Probleme | Severite | Detail |
|---|----------|----------|--------|
| 11 | **Creneaux complets** : pas d'indicateur visuel clair | HAUT | Les creneaux pleins sont juste grises avec `cursor-not-allowed`. Il manque un label "Complet" et une couleur plus marquee. |
| 12 | **Pas de temps estime** dans le resume panier | MOYEN | Avant de confirmer, l'utilisateur ne voit pas "Prete vers ~14h35". Manque de contexte temporel. |
| 13 | **CartSuggestions** : pas de skeleton loading | MOYEN | Les suggestions apparaissent apres un fetch sans aucun etat de chargement. |
| 14 | **Message "Total estime"** : explication insuffisante | BAS | "Le poids exact sera ajuste au retrait" est trop court. Il faudrait expliquer que le prix final peut varier de +/- X%. |
| 15 | **Bouton retour** renvoie toujours vers `/decouvrir` | BAS | Si l'utilisateur vient de `/boutique/xxx`, il devrait retourner vers la boutique, pas la page d'accueil. |

### Recommandations

- Ajouter un label "Complet" + barre rouge sur les creneaux pleins
- Afficher le temps de preparation estime a cote du total
- Skeleton pour les suggestions pendant le chargement
- Enrichir le disclaimer avec "+/- 10% selon le poids reel"
- Utiliser `router.back()` au lieu d'un lien fixe

---

## 4. Parcours Suivi Commande (/commande/[id])

### Ce qui marche bien

- **Ticket-style header** avec numero de commande en grand (pattern clair)
- **Status progressifs** bien differencies visuellement (icones + couleurs + animations)
- **QR Code** dynamique pour le retrait (innovation pertinente)
- **Confetti** quand la commande est prete (micro-interaction delightful)
- **TimeProgress bar** avec estimation en temps reel
- **Rating** post-retrait (5 etoiles + commentaire)
- **Polling 5s** avec arret automatique aux etats terminaux
- **PARTIALLY_DENIED** : gestion des ruptures avec alternatives

### Problemes identifies

| # | Probleme | Severite | Detail |
|---|----------|----------|--------|
| 16 | **Erreur = page bloquee** | CRITIQUE | L'etat d'erreur affiche un message mais **aucun bouton "Reessayer"**. L'utilisateur doit rafraichir manuellement la page. |
| 17 | **Note client invisible** dans le suivi | MOYEN | L'utilisateur a laisse une note au boucher mais ne peut pas la voir dans le suivi. Manque de transparence. |
| 18 | **Ajustement prix** : workflow en 2 etapes | MOYEN | Le bandeau orange dit "Cliquez pour valider" mais il faut naviguer vers `/validation/[id]`. Idealement, l'approbation devrait etre inline. |
| 19 | **Pas de timestamp "Prete depuis"** | BAS | L'etat READY montre l'adresse et le QR mais pas depuis quand la commande est prete. |
| 20 | **Polling vs WebSockets** | BAS (technique) | Le polling 5s genere du trafic reseau inutile. WebSockets serait plus efficient pour le temps reel. |

### Recommandations

- Ajouter un bouton "Reessayer" dans l'etat d'erreur + retry automatique apres 10s
- Afficher la note client dans un encart collapse dans le suivi
- Implementer l'approbation de l'ajustement prix directement dans la page de suivi
- Ajouter "Prete depuis 5 min" dans l'etat READY
- Migrer vers WebSockets (ou Server-Sent Events) pour le suivi temps reel

---

## 5. Navigation & Layout

### Ce qui marche bien

- **BottomNav** persistante avec 6 elements (pattern mobile standard)
- **Bouton central "Mon Boucher"** sureleve (pattern Uber pour le chat)
- **Badges** panier + notifications sur les icones
- **Clerk UserButton** integre pour le profil
- **Theme toggle** light/dark

### Problemes identifies

| # | Probleme | Severite | Detail |
|---|----------|----------|--------|
| — | **6 items** dans la bottom nav | MOYEN | Best practice = 5 max. Le bouton "Mon Boucher" au centre + 4 items + profil = 6 elements. Risque de surcharge sur petits ecrans. |
| — | **Ping animation** sur le bouton chat | BAS | L'animation `animate-ping` tourne en continu. Apres quelques minutes, ca devient fatiguant visuellement. Devrait s'arreter apres 3-5 cycles. |

---

## 6. Accessibilite (WCAG)

| Probleme | Impact | Recommandation |
|----------|--------|----------------|
| **SearchBar** : pas de `<label>` ni `aria-label` | Lecteurs d'ecran | Ajouter `aria-label="Rechercher une boucherie ou un produit"` |
| **Boutiques fermees** : opacity 60% mais cliquables | Confusion | Ajouter `aria-disabled="true"` + reduire les interactions |
| **Touch targets** : certains boutons < 44px | Mobile | Verifier tous les boutons (minimum 44x44px) |
| **Contraste texte gris** : `text-gray-400` sur fond blanc | WCAG AA | Passer a `text-gray-600` pour un ratio 4.5:1 minimum |
| **Recherches recentes** : pas de structure semantique | Navigation | Utiliser `<ul>` + `role="listbox"` pour les suggestions |

---

## 7. Metriques a suivre

| Metrique | Objectif | Comment mesurer |
|----------|----------|-----------------|
| **Taux d'abandon panier** | < 30% | Events: add_to_cart vs. order_placed |
| **Temps moyen checkout** | < 2 min | Timestamp panier ouvert > commande confirmee |
| **Taux de recommande** | > 40% | Orders par user unique |
| **Resolution PARTIALLY_DENIED** | > 80% acceptation | Alternatives choisies vs. commandes annulees |
| **Note moyenne** | > 4.2/5 | Reviews post-retrait |
| **Taux de completion rating** | > 50% | Reviews / commandes completees |

---

## 8. Roadmap d'ameliorations recommandee

### Sprint 1 — Quick Wins (1-2 semaines)

1. Bouton "Reessayer" sur la page de suivi commande (erreur)
2. Skeleton loading sur les produits et suggestions
3. Retirer ou implementer la recherche vocale
4. Ajouter "Complet" sur les creneaux pleins
5. Corriger les accents manquants dans les textes

### Sprint 2 — Conversion (2-3 semaines)

6. Promos dynamiques (remplacer le hardcode)
7. Presets poids (250g/500g/1kg) dans le WeightSheet
8. Coeur favori directement sur les ShopCards
9. Temps estime dans le resume panier
10. Approbation ajustement prix inline

### Sprint 3 — Polish & Perf (2-3 semaines)

11. Migration polling > WebSockets/SSE pour le suivi
12. Audit accessibilite complet (ARIA, contrastes, touch targets)
13. Ajout geolocalisation expliquee (bandeau avant demande)
14. Note client visible dans le suivi commande
15. Limiter l'animation ping du bouton chat

---

## Conclusion

Klik&Go a une base solide avec un parcours client bien pense et un design system coherent. Les **8 problemes critiques/hauts** meritent une attention immediate car ils impactent directement la conversion (creneaux confus, pas de recovery erreur, recherche vocale trompeuse) et l'experience mobile (pas de skeletons, pas de feedback). Les 3 sprints proposes permettraient d'atteindre un score UX de **9/10** en environ 6-8 semaines.
