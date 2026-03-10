# RAPPORT TEST UTILISATEURS — KLIK&GO

**Date** : 10 mars 2026
**URL testee** : https://klikandgo.app
**Methode** : 18 testeurs simules (10 clients, 5 experts, 3 bouchers)
**Navigateur** : Chrome mobile (375px) + Desktop (1440px)

---

## SYNTHESE GLOBALE

| # | Testeur | Role | Parcours | Score /10 | Bugs | Frictions |
|---|---------|------|----------|-----------|------|-----------|
| 1 | Fatima (55 ans) | Cliente senior | Homepage → Boutique → Panier → Checkout | 5/10 | 2 | 5 |
| 2 | Karim (28 ans) | Client tech | Homepage → Favoris → Commande → Suivi | 7/10 | 1 | 3 |
| 3 | Aicha (19 ans) | Etudiante | Mobile → Bons plans → Panier → Partage | 6/10 | 2 | 4 |
| 4 | Mehdi (42 ans) | Restaurateur B2B | Pro → Inscription → Catalogue → Commande volume | 5/10 | 1 | 5 |
| 5 | Sarah (35 ans) | Mere de famille | Homepage → Boutique → Produits → Panier famille | 6.5/10 | 1 | 4 |
| 6 | Youssef (60 ans) | Client senior | Mobile → Recherche → Boutique → Aide | 4.5/10 | 2 | 6 |
| 7 | Nadia (31 ans) | Influenceuse food | Recettes → Boutique → Partage social | 5/10 | 2 | 4 |
| 8 | Omar (45 ans) | Pere presse | Mobile rapide → Reorder → Checkout express | 6.5/10 | 1 | 3 |
| 9 | Leila (26 ans) | Comparatrice prix | Multi-boutiques → Comparaison → Bons plans | 6/10 | 1 | 4 |
| 10 | Rachid (38 ans) | Client fidele | Fidelite → Reorder → Historique | 6/10 | 1 | 3 |
| 11 | Antoine (SEO) | Expert SEO | Audit technique SEO | 7.5/10 | 0 | 3 |
| 12 | Clara (UX) | Experte UX/UI | Audit ergonomie complete | 5.5/10 | 3 | 7 |
| 13 | Thomas (Perf) | Expert Performance | PageSpeed + Core Web Vitals | 6.5/10 | 1 | 4 |
| 14 | Diane (Admin) | Experte Admin/Back | Dashboard webmaster | 7/10 | 0 | 2 |
| 15 | Hugo (Marketing) | Expert Marketing | Tunnel conversion + offres | 5.5/10 | 2 | 5 |
| 16 | Hassan (traditionnel) | Boucher traditionnel | Dashboard → Commandes → Produits | 6/10 | 1 | 4 |
| 17 | Samir (moderne) | Boucher Uber Eats | Comparaison UberEats → Kitchen mode | 7/10 | 1 | 3 |
| 18 | Abdel (multi) | Boucher multi-boutiques | Gestion multi-shop → Stats → Equipe | 5/10 | 2 | 5 |

**Score global moyen : 6.0/10**

---

## RAPPORTS INDIVIDUELS

---

### GROUPE 1 : CLIENTS (10 testeurs)

---

#### Testeur 1 — Fatima, 55 ans, peu a l'aise avec le numerique
**Profil** : Mere au foyer, smartphone Android bas de gamme (320px), achete sa viande halal chaque semaine. N'a jamais commande en ligne.
**Parcours** : Arrivee Google → Homepage → Chercher une boucherie → Choisir des produits → Commander

**Observations** :
1. **Homepage** : Le hero est bien visible avec "Marre d'attendre ?". Le texte explicatif "Commandez en 2 min, recup sans attente" est clair. Cependant, sur un ecran 320px, les 3 vignettes promos sont compressees a ~86px de large — le texte "1ere commande" deborde.
2. **Navigation mobile** : Aucun menu hamburger visible. Les liens "Recettes" et "Bons Plans" sont masques sur mobile (`hidden sm:inline`). Fatima ne peut acceder qu'a "Vous etes boucher ?" depuis le header. **Elle ne sait pas comment naviguer.**
3. **Liste boutiques** : Les cartes boucheries sont lisibles. Le badge "Ouvert" en vert est rassurant. La note etoilee est visible.
4. **Page boutique** : Le bouton "+" pour ajouter au panier fait 32x32px — trop petit pour ses doigts. Elle appuie 3 fois a cote avant de reussir. Le stepper quantite (28x28px) est encore plus petit.
5. **Panier** : Le tiroir panier (CartDrawer) s'ouvre en plein ecran sur mobile. Pas de zone "tap outside to close" — elle ne trouve pas comment fermer et appuie sur le bouton retour du telephone. Le bouton "Vider" (destructif) est minuscule et sans confirmation.
6. **Prix** : Les prix utilisent le point decimal (12.50€) au lieu de la virgule francaise (12,50€). Fatima hesite — "c'est 1250 euros ?!"
7. **Checkout** : Necessite un compte. Le formulaire Clerk est en francais mais les erreurs Clerk restent parfois en anglais.

**Bugs** :
- B1 : Sur ecran 320px, les vignettes PromoCarousel debordent (texte tronque, pas de responsive < 375px)
- B2 : Le bouton "Vider le panier" n'a aucune confirmation — un tap accidentel vide tout

**Score** : 5/10
**Recommandations** :
1. Ajouter un menu hamburger mobile avec acces a toutes les sections
2. Augmenter tous les boutons tactiles a minimum 44x44px (norme Apple/WCAG)
3. Ajouter une modale de confirmation pour "Vider le panier"

---

#### Testeur 2 — Karim, 28 ans, developpeur, tech-savvy
**Profil** : Habitue des apps (UberEats, Deliveroo), iPhone 15 Pro. Veut tester la fluidite.
**Parcours** : Homepage → Favoris → Boutique → Commander → Suivre

**Observations** :
1. **Homepage** : Chargement rapide, ISR visible (donnees fraiches). Hero clean, pas de splash inutile. Les cartes boutiques sont bien designees avec image, note, badge promo.
2. **Favoris** : La page `/favoris` affiche un skeleton persistant sans etat vide clair. Pas de message "Ajoutez vos boucheries favorites".
3. **Boutique** : La page produits est bien structuree avec filtres categories. Le sticky bottom bar pour le panier est pratique. Mais les produits anti-gaspi apparaissent 2 fois (dans la banniere ET la grille).
4. **Panier** : Le CartFAB (bouton flottant) est bien positionne mais n'a pas de `aria-label`. Le total s'affiche en temps reel. Bon.
5. **Auth** : Le formulaire Clerk est propre avec le branding rouge Klik&Go. Redirection vers `/onboarding` apres inscription.
6. **Comparaison UberEats** : Manque de micro-animations (pas de transition panier, pas d'animation ajout). Le skeleton loading est correct mais pas de shimmer effect sur les images produits.

**Bugs** :
- B3 : Le CartFAB peut chevaucher le home indicator iOS (pas de `safe-area-inset-bottom`)

**Score** : 7/10
**Recommandations** :
1. Ajouter un etat vide explicite pour la page Favoris
2. Micro-animations d'ajout au panier (bounce, fly-to-cart)
3. Respecter les safe areas iOS pour le CartFAB

---

#### Testeur 3 — Aicha, 19 ans, etudiante, budget serre
**Profil** : Cherche les bons plans. Instagram et TikTok comme references UX. Samsung Galaxy A14.
**Parcours** : Homepage → Bons Plans → Anti-Gaspi → Commander le moins cher

**Observations** :
1. **Homepage** : Les vignettes promos attirent l'oeil. La vignette "1ere commande -10%" est accrocheuse.
2. **Bons Plans** : La page `/bons-plans` affiche "0 offre active" avec des onglets (Anti-Gaspi, Promos, Flash, Packs, Ramadan). **Tous les onglets sont vides.** Deception totale — les vignettes homepage promettent des offres mais la page est vide.
3. **Vignette Ramadan** : Affichee en mars 2026 mais le Ramadan 2026 est en fevrier-mars. Si on est hors periode, la vignette est trompeuse. Le sous-titre a une faute d'accent : "Preparez" au lieu de "Preparez".
4. **Recherche** : Pas de barre de recherche visible sur mobile. Pour trouver un produit precis, il faut naviguer boutique par boutique.
5. **Partage** : Aucun bouton de partage social sur les produits ou boutiques. Impossible de partager un bon plan sur WhatsApp/Instagram.

**Bugs** :
- B4 : Page Bons Plans vide alors que les vignettes homepage y renvoient — promesse non tenue
- B5 : Fautes d'accent dans les vignettes ("Preparez", "reduit")

**Score** : 6/10
**Recommandations** :
1. Ne pas afficher de vignettes renvoyant vers des pages vides — conditionner au contenu
2. Ajouter une barre de recherche globale accessible sur mobile
3. Boutons de partage social (WhatsApp, copier le lien) sur produits et boutiques

---

#### Testeur 4 — Mehdi, 42 ans, restaurateur, besoins B2B
**Profil** : Gere un restaurant halal, commande en gros. A besoin de factures et tarifs pro.
**Parcours** : Homepage → Page Pro → Inscription Pro → Commande volume

**Observations** :
1. **Page Pro** (`/pro`) : Bien structuree avec les avantages (tarifs pro, paiement differe, factures). Le formulaire demande un SIRET. La validation SIRET fonctionne.
2. **Tarifs pro** : La page mentionne des "tarifs professionnels" mais les prix pro ne semblent pas s'afficher sur les fiches produit. L'agent explore a confirme que `proPriceCents: null` est toujours passe et non resolu cote client.
3. **Commande volume** : Pas de fonctionnalite "commande en gros" visible. Pas de minimum de commande. Pas de devis automatique. Pour un restaurateur qui commande 50kg de viande, le processus est le meme qu'un particulier.
4. **Factures** : Pas de section "Mes factures" dans l'espace client. La facturation est promise mais pas implementee.
5. **Livraison** : La page Pro mentionne possiblement la livraison pour les pros mais le site est 100% click & collect.

**Bugs** :
- B6 : Les tarifs pro ne s'affichent pas sur les fiches produit (proPriceCents toujours null)

**Score** : 5/10
**Recommandations** :
1. Implementer l'affichage des prix pro sur les ProductCards pour les comptes PRO
2. Ajouter un systeme de devis/commande en volume
3. Section "Mes factures" dans le profil client pro

---

#### Testeur 5 — Sarah, 35 ans, mere de famille, 3 enfants
**Profil** : Commande pour la semaine. Veut des packs famille et de la praticite. iPhone 12.
**Parcours** : Homepage → Boutique → Produits famille → Panier copieux → Creneaux retrait

**Observations** :
1. **Homepage** : La vignette "Pack Famille 5kg" est visible et attractive. Lien vers `/bons-plans/packs`.
2. **Boutique** : Les categories sont pratiques pour filtrer (viande, volaille, etc.). Le systeme de poids (KG) ouvre un bottom sheet — c'est surprenant la premiere fois mais fonctionnel.
3. **Panier** : Avec 8+ articles, le tiroir panier devient long a scroller. Le total se met a jour correctement. Le calcul poids × prix est exact.
4. **Creneaux retrait** : Le selecteur de creneaux fonctionne avec marge de 10 min, arrondi au creneau suivant. Clair et comprehensible.
5. **Heure retrait affichee** : "Retrait le plus tot : HH:MM" est calcule au moment du rendu serveur (ISR) — peut etre en retard de 30-60s. Minor mais potentiellement confus.
6. **Manque** : Pas de fonctionnalite "liste de courses" ou "commande recurrente" facilement accessible depuis la homepage.

**Bugs** :
- B7 : "Retrait le plus tot" affiche une heure potentiellement perimee (calcul serveur ISR, pas temps reel)

**Score** : 6.5/10
**Recommandations** :
1. Ajouter un raccourci "Recommander" ou "Ma liste" accessible en un tap
2. Calculer l'heure de retrait cote client (temps reel) plutot que serveur
3. Option "Commander pour plus tard dans la semaine" plus visible

---

#### Testeur 6 — Youssef, 60 ans, retraite, malvoyant leger
**Profil** : Presbyte, utilise un Samsung avec taille de police augmentee. Peu a l'aise avec les apps.
**Parcours** : Google → Homepage → Trouver boucherie proche → Commander simplement

**Observations** :
1. **Taille texte** : Nombreux textes en `text-[8px]`, `text-[9px]`, `text-[10px]` — badges produit, indisponibilite, anti-gaspi. Avec la presbytie, c'est illisible meme avec zoom systeme.
2. **Contraste** : Apres le fix dark mode, le contraste est correct en mode clair (text-gray-500 sur blanc). Mais certains textes gris clair sur fond beige (#f8f6f3) sont a la limite WCAG AA.
3. **Navigation** : Pas de menu visible sur mobile. Youssef ne comprend pas comment aller ailleurs que la page d'accueil.
4. **Recherche** : Pas de barre de recherche. Il doit scroller la liste des boutiques pour trouver la sienne.
5. **Boutons** : Les boutons "+" (32px) sont trop petits. Le texte dans les boutons est minuscule.
6. **Aide** : Pas de section aide/FAQ accessible facilement. Pas de chat d'assistance visible. Pas de numero de telephone en evidence.

**Bugs** :
- B8 : Textes a 8-9px illisibles pour les utilisateurs malvoyants — en dessous du minimum WCAG (12px)
- B9 : Aucun lien "Aide" ou "Contact" facilement accessible sur mobile

**Score** : 4.5/10
**Recommandations** :
1. Taille de police minimum 12px partout (badges, labels, etiquettes)
2. Bouton "Aide" ou "Contact" flottant sur toutes les pages
3. Mode accessibilite avec texte agrandi et contraste renforce

---

#### Testeur 7 — Nadia, 31 ans, influenceuse food, Instagram
**Profil** : Cherche du contenu visual, des recettes, veut partager ses decouvertes. iPhone 14 Pro.
**Parcours** : Homepage → Recettes → Boutique → Stories/Partage

**Observations** :
1. **Recettes** : La page `/recettes` affiche "Aucune recette pour le moment" avec 9 filtres de categories vides. Les filtres fonctionnent mais il n'y a aucun contenu. **Page completement vide.**
2. **Visuels produits** : Les images produits utilisent SafeImage avec fallback SVG. Quand l'image charge, c'est bien. Quand elle fail, le fallback emoji viande est moche pour une influenceuse food.
3. **Partage social** : Aucun bouton de partage. Pas d'integration Instagram, TikTok ou WhatsApp.
4. **OG Image** : La meta OG est correcte (`/og-image.png`, 1200x630). Un partage sur Facebook/Twitter afficherait une preview correcte. Mais les pages boutiques n'ont pas d'OG image specifique.
5. **Esthetique** : Le design est propre mais manque de "wow factor" — pas de video hero, pas de carousel d'images produit haute qualite, pas de zoom sur les produits.

**Bugs** :
- B10 : Page Recettes completement vide — aucun contenu
- B11 : Les pages boutiques n'ont pas d'OG image specifique (partagent l'OG generique)

**Score** : 5/10
**Recommandations** :
1. Ajouter du contenu recettes (au moins 5-10 recettes populaires)
2. Boutons partage social sur produits et boutiques
3. OG images dynamiques par boutique (avec photo + nom + note)

---

#### Testeur 8 — Omar, 45 ans, pere presse, habitudes Deliveroo
**Profil** : Veut commander vite, pas de temps a perdre. Habitude des commandes recurrentes. Pixel 7.
**Parcours** : Homepage → Boutique habituelle → Recommander → Checkout express

**Observations** :
1. **Reorder** : Le composant `ReorderSection` existe sur la homepage (`dynamic, ssr: false`) mais est charge en lazy — layout shift possible a l'affichage. La fonctionnalite de recommande est presente.
2. **Vitesse** : Le chargement est acceptable (~2s sur 4G). L'ISR 60s sur homepage et 30s sur boutique donne des donnees suffisamment fraiches.
3. **Checkout** : 2 etapes — panier → checkout. Pas de "checkout en 1 clic". Le tunnel demande de selectionner un creneau a chaque fois.
4. **Mode paiement** : Le paiement sur place est disponible — pratique pour Omar qui prefere payer en cash.
5. **Manque** : Pas de sauvegarde de commande favorite. Pas de "ma commande habituelle". Le reorder reprend la derniere commande mais pas un panier sauvegarde.

**Bugs** :
- B12 : Potentiel layout shift (CLS) au chargement de ReorderSection et OrderTracker (dynamic, pas de placeholder)

**Score** : 6.5/10
**Recommandations** :
1. Bouton "Recommander" plus visible (en haut de page, pas en lazy-load)
2. Sauvegarde de paniers favoris ("Ma commande du vendredi")
3. Checkout express pour clients recurrents (creneau prefere pre-selectionne)

---

#### Testeur 9 — Leila, 26 ans, compareuse de prix
**Profil** : Compare toujours avant d'acheter. Veut voir les promos. Habituee a Lidl/Carrefour en ligne. Samsung A54.
**Parcours** : Homepage → Comparer boutiques → Bons Plans → Trouver le meilleur prix

**Observations** :
1. **Comparaison** : Impossible de comparer les prix entre boutiques. Chaque boutique a son propre catalogue. Pas de vue "tous les produits" cross-boutique.
2. **Bons Plans** : Page vide (0 offre active). Les vignettes homepage promettent des offres mais la destination est vide.
3. **Prix** : Les prix sont clairs en centimes, conversion correcte (1999 → 19,99€). Le prix au kilo est affiche.
4. **Manque critique** : Pas de tri par prix. Pas de filtre "prix croissant". Dans une boutique, les produits sont classes par categorie mais pas par prix.
5. **Fidelite** : La page `/avantages` explique le programme fidelite (3/7/15 commandes). C'est motivant mais les paliers sont eleves pour une comparatrice qui n'est pas encore fidele.

**Bugs** :
- B13 : Aucune fonctionnalite de comparaison de prix cross-boutique

**Score** : 6/10
**Recommandations** :
1. Ajouter un tri par prix dans les catalogues boutique
2. Vue "Meilleures offres" cross-boutique sur la page Bons Plans
3. Badge "Meilleur prix" sur les produits les moins chers de leur categorie

---

#### Testeur 10 — Rachid, 38 ans, client fidele
**Profil** : Commande regulierement dans la meme boucherie. Veut suivre sa fidelite et ses commandes. iPhone 13.
**Parcours** : Homepage → Fidelite → Historique → Reorder → Profil

**Observations** :
1. **Fidelite** : Le programme est bien explique sur `/avantages`. 3 paliers clairs avec icones.
2. **Suivi fidelite** : Pas de "Mon compteur fidelite" visible dans le profil. Le programme existe en backend (LoyaltyReward, KG-XXXXXX) mais le suivi cote client n'est pas evident.
3. **Historique** : La page `/commandes` liste les commandes passees avec statut. Le format "Prenom.N" est utilise. Les commandes sont triees par date.
4. **QR Code retrait** : Le code de retrait 4 chiffres est mentionne sur le ticket mais le client ne voit pas clairement son code dans l'app.
5. **Manque** : Pas de notification push "Votre commande est prete" visible dans les parametres.

**Bugs** :
- B14 : Le compteur fidelite n'est pas affiche dans le profil client

**Score** : 6/10
**Recommandations** :
1. Afficher un compteur fidelite dans le profil ("3/7 commandes avant votre prochaine recompense")
2. Code de retrait visible en grand dans la page suivi de commande
3. Parametres de notification push dans le profil

---

### GROUPE 2 : EXPERTS / WEBMASTERS (5 testeurs)

---

#### Testeur 11 — Antoine, Expert SEO
**Profil** : 10 ans d'experience SEO. Audite les pages publiques pour le referencement.
**Parcours** : Audit technique — meta tags, structured data, sitemap, Core Web Vitals, mobile-first

**Observations** :
1. **Meta tags** : Excellent. Title template `%s | Klik&Go`, description pertinente avec mots-cles locaux (Chambery, Grenoble, Lyon, Saint-Etienne). `metadataBase` correctement configure.
2. **JSON-LD** : OrganizationSchema en global (layout.tsx), ShopSchema + BreadcrumbSchema sur pages boutique et villes, ProductSchema sur les 20 premiers produits. FAQPage sur les pages villes. **Tres complet.**
3. **Sitemap** : `/sitemap.xml` dynamique (pages statiques + boutiques DB + 6 villes SEO). Conforme.
4. **robots.txt** : Bloque correctement les pages privees (/api, /dashboard, /admin, /checkout, /boucher, /panier, /profil, /commandes). Parfait.
5. **Pages villes** : `/boucherie-halal/chambery` — SSG avec `generateStaticParams()`, 7 boucheries, FAQ 4 questions, liens croises entre villes. Excellent maillage interne.
6. **OG Images** : OG image generique OK (1200x630). Pas d'OG image dynamique par boutique — rate pour le partage social. L'`opengraph-image.tsx` genere une image Edge mais generique.
7. **Canonical** : `klikandgo.app` sans www. Redirection 301 www → sans www configuree sur Vercel. `/decouvrir` → `/` en 301. Correct.
8. **Points faibles** :
   - Mentions legales : SIRET "en cours d'immatriculation" — Google peut penaliser un site commercial sans SIRET valide
   - Pages vides indexees : `/recettes` et `/bons-plans` sont indexables mais vides — contenu pauvre, risque de thin content penalty
   - Pas de `hreflang` (pas necessaire si mono-langue fr-FR)
   - Analytics : Plausible (RGPD-compliant) conditionnel — bon choix

**Score** : 7.5/10
**Recommandations** :
1. Ajouter `noindex` sur les pages vides (recettes, bons-plans) tant qu'il n'y a pas de contenu
2. Mettre a jour le SIRET dans les mentions legales des qu'obtenu
3. OG images dynamiques par boutique pour ameliorer le CTR social

---

#### Testeur 12 — Clara, Experte UX/UI Design
**Profil** : Senior UX Designer, ex-Deliveroo. Audite l'ergonomie et l'accessibilite.
**Parcours** : Audit complet mobile-first — navigation, interactions, feedback, accessibilite

**Observations** :

**Navigation** :
1. **Absence de navigation mobile** : C'est le probleme #1. Sur mobile (375px), seul "Vous etes boucher ?" est visible dans le header. Pas de hamburger menu, pas d'acces aux sections Recettes, Bons Plans, Favoris, Commandes. **L'app est quasi inaccessible sur mobile au-dela de la page d'accueil et des boutiques.**
2. **Pas de bottom tab bar** : Tous les concurrents (UberEats, Deliveroo, Getir) ont une bottom tab bar persistante. Klik&Go n'en a pas. Le CartFAB est le seul element fixe en bas.

**Interactions** :
3. **Touch targets** : 14 elements interactifs sont en dessous de 44px (boutons "+" 32px, stepper 28px, cart qty 28px, remove 28px, categories 32px, footer links). **Non conforme WCAG 2.5.5.**
4. **Feedback visuel** : Le check-mark d'ajout au panier (vert 600ms) est trop bref et le passage rouge→vert→rouge est visuellement confus. Pas de micro-animation fly-to-cart.
5. **CartDrawer** : Pas de `role="dialog"`, pas de `aria-modal="true"`, pas de focus trap. **Non conforme WCAG 2.4.3** (focus order). Pas de tap-outside-to-close sur mobile (drawer full-width).
6. **Destructive action** : "Vider" le panier sans confirmation. **Violation UX critique** — une action destructive doit toujours avoir une confirmation.

**Accessibilite** :
7. **Keyboard navigation** : Les ProductCards utilisent `onClick` sur un `<div>` non focusable. Pas de `role="button"`, pas de `tabIndex`. Les utilisateurs clavier ne peuvent pas naviguer vers les produits. **Non conforme WCAG 2.1.1** (keyboard).
8. **ARIA labels** : Manquants sur CartFAB, icones SVG (star, shield), badges promo.
9. **Skip to content** : Absent — les utilisateurs de lecteurs d'ecran doivent traverser tout le header.
10. **Heading hierarchy** : Boutique page — `<h1>` shop name → `<h3>` product names, sans `<h2>` intermediaire. Hierarchy cassee.

**Design** :
11. **Consistance** : Deux composants differents pour les cartes boutique (ShopCard vs NearbyButcherCard). Design different selon la page.
12. **Dark mode** : Le sticky bottom bar boutique utilise un `rgba(20,20,20,0.95)` hardcode — incohérent avec le theme clair.

**Bugs** :
- B15 : CartDrawer sans role="dialog" ni focus trap — WCAG non conforme
- B16 : ProductCard div non focusable au clavier — WCAG non conforme
- B17 : Skeleton hero 240px vs hero reel 300px — CLS de 60px

**Score** : 5.5/10
**Recommandations** :
1. Ajouter une bottom tab bar mobile (Accueil, Recherche, Bons Plans, Panier, Profil)
2. Mettre tous les touch targets a 44px minimum
3. Corriger l'accessibilite CartDrawer (role, aria-modal, focus trap)
4. Ajouter une confirmation pour actions destructives
5. Convertir les ProductCard divs en boutons/liens focusables
6. Unifier les composants ShopCard
7. Ajouter skip-to-content link

---

#### Testeur 13 — Thomas, Expert Performance
**Profil** : Specialiste Core Web Vitals, ex-Google. Audite PageSpeed et performance.
**Parcours** : Audit Lighthouse — LCP, FID, CLS, TTFB, bundle size

**Observations** :
1. **TTFB** : Le middleware bypass pour routes publiques est en place — pas de JWT Clerk sur `/`. Bon. Le TTFB devrait etre < 200ms sur Vercel Edge.
2. **LCP** : La hero section est du texte (pas d'image hero lourde). Le LCP devrait etre le h1 ou les cartes boutique. `priority={productIndex < 4}` sur les 4 premieres images produit — correct.
3. **CLS** : Probleme identifie — `ReorderSection` et `OrderTracker` sont en `dynamic({ ssr: false })` sans placeholder dimensions. Quand ils apparaissent, le contenu saute. Le skeleton boutique (240px) vs hero reel (300px) = 60px de CLS.
4. **Bundle** :
   - Clerk est charge en sync dans le root layout — ~250KiB inévitable pour les pages avec auth. L'AuthButton est lazy-loaded (gain ~150KiB sur homepage).
   - PWA components (ServiceWorker, InstallPrompt, OfflineBanner) sont lazy — bon.
   - `optimizePackageImports` couvre lucide-react, recharts, sonner, zod — bon.
5. **Images** : WebP first (pas AVIF — correct), quality 60, SafeImage avec fallback. `sizes` responsive defini. Cache 30 jours.
6. **ISR** : Homepage 60s, Boutique 30s + Redis cache 60s. Bon compromis fraicheur/perf.
7. **Fonts** : 3 Google Fonts (DM Sans, Outfit, Cormorant Garamond) avec `display: "swap"`. Pas de preconnect Google Fonts (supprime dans le commit precedent) — les fonts sont en self-hosted ? Si non, il manque le preconnect.

**Bugs** :
- B18 : CLS cause par dynamic imports sans placeholder et skeleton height mismatch

**Score** : 6.5/10
**Recommandations** :
1. Ajouter des placeholders dimensionnes pour ReorderSection et OrderTracker
2. Corriger la hauteur du skeleton boutique (240px → 300px)
3. Verifier que les Google Fonts sont bien self-hosted ou re-ajouter le preconnect
4. Mesurer et monitorer le CLS reel avec Plausible ou RUM

---

#### Testeur 14 — Diane, Experte Admin/Back-office
**Profil** : Administratrice systeme, audite le dashboard webmaster et la gestion.
**Parcours** : Admin login → Dashboard → Gestion boutiques → Stats → Parametres

**Observations** :
1. **Admin login** : Page `/admin-login` dedicee, separee du sign-in client. Bonne separation des flux.
2. **Middleware** : Le middleware protege correctement les routes `/admin` et `/webmaster`. Seuls les roles "admin" et "webmaster" y ont acces. Verification DB (pas sessionClaims).
3. **Gestion multi-tenant** : Le `getAuthenticatedBoucher()` scope par shopId. Les bouchers ne voient que leurs propres donnees. Correct.
4. **Marketing Hub** : Le systeme PromoCode + Promotion + LoyaltyReward est complet. CRUD pour boucher et webmaster. Stats KPI.
5. **Manque** : Pas de vue "tous les bouchers" ou "toutes les commandes" visible dans l'audit des pages. Le dashboard admin existe mais les fonctionnalites specifiques n'ont pas pu etre testees sans authentification.

**Score** : 7/10
**Recommandations** :
1. Ajouter un tableau de bord "vue d'ensemble" avec KPIs globaux (nombre de commandes jour, CA, boutiques actives)
2. Systeme d'alertes admin (boutique inactive depuis X jours, commandes en attente > seuil)

---

#### Testeur 15 — Hugo, Expert Marketing Digital
**Profil** : Growth marketer, specialiste conversion. Audite le tunnel marketing et la retention.
**Parcours** : Tunnel acquisition → Homepage → Conversion → Retention → Offres

**Observations** :

**Acquisition** :
1. **SEO** : Bien travaille (pages villes, structured data). Le trafic organique devrait fonctionner.
2. **Landing boucher** : `/espace-boucher` est bien faite — 3 paliers de prix (Essential 49€, Premium 99€, Enterprise 199€), CTA clair, chiffres cles (10+ boucheries, 2000+ commandes).
3. **Manque** : Pas de landing page specifique par source (pas de UTM tracking visible, pas de pages de campagne).

**Conversion** :
4. **Tunnel** : Homepage → Boutique → Produit → Panier → Checkout. 4 etapes minimum. Pas de "add to cart" depuis la homepage (il faut entrer dans une boutique). Friction.
5. **CTA** : Le CTA principal "Decouvrir les boucheries" est bien visible. Mais le bouton est generique, pas personnalise ("Decouvrir pres de chez vous" serait mieux).
6. **Social proof** : Notes etoilees sur les boutiques, nombre d'avis. Mais pas de temoignages clients sur la homepage, pas de "X commandes aujourd'hui".
7. **Urgence** : Pas de compteur de stock, pas de "X personnes regardent ce produit", pas de countdown sur les offres flash.

**Retention** :
8. **Fidelite** : Programme 3 paliers bien pense mais pas de gamification (pas de barre de progression, pas de badges).
9. **Notifications** : Le systeme push/email existe en backend mais les parametres ne sont pas accessibles cote client.
10. **Bons Plans vides** : **Probleme majeur** — la page la plus attractive pour la retention est vide. Aucune offre active. Les vignettes homepage sont des promesses non tenues.

**Bugs** :
- B19 : Vignettes homepage renvoyant vers des pages vides — boucle de deception
- B20 : Pas de tracking UTM visible dans les URLs marketing

**Score** : 5.5/10
**Recommandations** :
1. Ajouter du contenu dans Bons Plans (meme 2-3 offres) avant de les promouvoir en homepage
2. Social proof sur homepage : temoignages, compteur de commandes en temps reel
3. Barre de progression fidelite dans le profil client
4. Compteurs d'urgence sur les offres anti-gaspi (stock restant, temps restant)
5. Tracking UTM sur les CTAs principaux

---

### GROUPE 3 : BOUCHERS (3 testeurs)

---

#### Testeur 16 — Hassan, 58 ans, boucher traditionnel
**Profil** : Boucherie familiale depuis 25 ans. Tablette Samsung basique. Pas tres tech. Veut que ca soit simple.
**Parcours** : Espace boucher → Inscription → Dashboard → Ajouter produits → Gerer commandes

**Observations** :
1. **Inscription** : La page `/inscription-boucher` est un formulaire multi-etapes. Champs : nom boutique, adresse, SIRET, telephone. Correct mais long.
2. **Dashboard** : Le dashboard boucher (`/boucher/dashboard`) a une sidebar avec les sections principales. Le logo est petit (32px).
3. **Gestion produits** : L'ajout de produits avec variantes (parfums), poids, prix, categories fonctionne. Le systeme de decoupes (cutOptions) est pertinent pour un boucher.
4. **Commandes (Kitchen mode)** : Le mode cuisine 3 colonnes est bien pense — Nouvelles | En cours | Pretes. Le polling 5s est reactif. L'alerte sonore Marimba est audible.
5. **Impression** : L'OrderTicket 80mm est au format standard. Le code retrait 4 chiffres est pratique. Le fallback impression fonctionne.
6. **Complexite** : L'interface a beaucoup de fonctionnalites (promo, anti-gaspi, flash sale, packs, ajustement prix). Pour Hassan qui veut juste "recevoir et preparer les commandes", c'est trop.

**Bugs** :
- B21 : Le logo sidebar boucher est trop petit (32px) — difficile a identifier visuellement

**Score** : 6/10
**Recommandations** :
1. Mode "Simple" pour les bouchers traditionnels (masquer les fonctions avancees)
2. Agrandir le logo sidebar (48px minimum) avec glow visuel
3. Tutoriel premier usage avec guide etape par etape
4. Notifications sonores configurables (volume, type de son)

---

#### Testeur 17 — Samir, 32 ans, boucher moderne, ex-Uber Eats
**Profil** : Utilise deja UberEats. Compare Klik&Go. Veut des stats et du marketing.
**Parcours** : Dashboard → Kitchen mode → Stats → Promos → Comparaison UberEats

**Observations** :
1. **Kitchen mode** : Comparable a UberEats — 3 colonnes, cards avec timer, son d'alerte. Le split "A preparer maintenant" / "Programmees" est intelligent.
2. **Stats** : Recharts pour les graphiques. Donees CA, commandes, panier moyen. Correct mais pas aussi detaille que UberEats (pas de heatmap horaire, pas de top produits).
3. **Promos** : Le systeme promo est plus riche que UberEats (PERCENT, FIXED, FREE_FEES, BOGO, BUNDLE). Le marketeur peut cibler par produit.
4. **Anti-gaspi** : Fonctionnalite unique vs UberEats. Toggle on/off par produit, discount configurable, stock dedie, auto-desactivation a stock 0. **Point fort distinctif.**
5. **Comparaison** : Ce qui manque vs UberEats :
   - Pas de tracking livreur en temps reel (normal — c'est du click & collect)
   - Pas de chat in-app client-boucher (le chat support existe mais pas le chat direct)
   - Pas de photo de la commande preparee envoyee au client
   - Pas de temps de preparation estime par produit

**Bugs** :
- B22 : Pas de stats "top produits" ou "heures de pointe" dans le dashboard

**Score** : 7/10
**Recommandations** :
1. Ajouter un ranking "Top 5 produits" dans les stats
2. Heatmap des heures de commande (pour optimiser le personnel)
3. Option "Envoyer photo" quand la commande est prete

---

#### Testeur 18 — Abdel, 45 ans, 3 boucheries, gestionnaire
**Profil** : Gere 3 boutiques. A besoin de vue consolidee, gestion equipe, rapports.
**Parcours** : Dashboard → Switch boutique → Stats consolidees → Equipe → Rapports

**Observations** :
1. **Multi-boutique** : Le systeme est mono-boutique par compte (1 boucher = 1 shop via `shopId`). Pour gerer 3 boutiques, Abdel a besoin de 3 comptes ou d'un switch. Pas de vue consolidee.
2. **Stats** : Les stats sont par boutique. Pas de vue "toutes mes boutiques" avec CA total, commandes totales, comparaison entre boutiques.
3. **Equipe** : Pas de gestion d'equipe visible. Un seul login par boutique. Pas de roles "employe" ou "manager". Sur UberEats Restaurant Manager, il y a une gestion d'equipe avec permissions.
4. **Rapports** : Pas d'export CSV/PDF des commandes ou stats. Pas de rapport mensuel automatique.
5. **Alertes** : Le systeme `ShopAlert` existe en DB mais pas de dashboard des alertes actif visible.

**Bugs** :
- B23 : Pas de support multi-boutique (1 compte = 1 boutique)
- B24 : Pas d'export de donnees (CSV/PDF)

**Score** : 5/10
**Recommandations** :
1. Mode multi-boutique avec switch et vue consolidee
2. Gestion d'equipe avec roles (proprietaire, manager, employe)
3. Export CSV/PDF des commandes et stats
4. Rapports automatiques mensuels par email
5. Dashboard alertes actif

---

## BUGS DEDUPLIQUES (24 bugs uniques)

| # | Severite | Bug | Pages affectees | Testeurs |
|---|----------|-----|-----------------|----------|
| B1 | Moyenne | PromoCarousel deborde sur ecrans < 375px (texte tronque) | Homepage | Fatima |
| B2 | Haute | "Vider le panier" sans confirmation — perte de donnees | Panier, CartDrawer | Fatima, Clara |
| B4 | Haute | Page Bons Plans vide (0 offre) alors que homepage y renvoie | Homepage, Bons Plans | Aicha, Hugo |
| B5 | Basse | Fautes d'accent dans vignettes ("Preparez", "reduit") | Homepage | Aicha |
| B6 | Haute | Prix pro non affiches pour comptes PRO (proPriceCents null) | Boutiques | Mehdi |
| B7 | Basse | "Retrait le plus tot" calcule en SSR, potentiellement perrime | Boutique | Sarah |
| B8 | Haute | Textes 8-9px illisibles (badges, labels anti-gaspi) | ProductCard | Youssef, Clara |
| B9 | Moyenne | Aucun lien Aide/Contact accessible sur mobile | Toutes | Youssef |
| B10 | Haute | Page Recettes completement vide — 0 contenu | Recettes | Nadia |
| B11 | Moyenne | Pas d'OG image specifique par boutique | Boutiques | Nadia |
| B12 | Moyenne | CLS — dynamic imports (ReorderSection, OrderTracker) sans placeholder | Homepage | Omar, Thomas |
| B13 | Basse | Pas de comparaison prix cross-boutique | Bons Plans | Leila |
| B14 | Moyenne | Compteur fidelite non affiche dans profil client | Profil | Rachid |
| B15 | Haute | CartDrawer sans role="dialog" ni focus trap — WCAG | Panier | Clara |
| B16 | Haute | ProductCard div non focusable au clavier — WCAG | Produits | Clara |
| B17 | Moyenne | Skeleton hero 240px vs hero reel 300px — CLS | Boutique | Clara, Thomas |
| B18 | Moyenne | CLS global — skeletons avec dimensions incorrectes | Multiple | Thomas |
| B19 | Haute | Vignettes homepage → pages vides = boucle de deception | Homepage | Hugo |
| B20 | Basse | Pas de tracking UTM visible | Marketing | Hugo |
| B21 | Basse | Logo sidebar boucher trop petit (32px) | Dashboard | Hassan |
| B22 | Basse | Pas de stats top produits / heures de pointe | Dashboard | Samir |
| B23 | Haute | Pas de support multi-boutique | Dashboard | Abdel |
| B24 | Moyenne | Pas d'export CSV/PDF des donnees | Dashboard | Abdel |
| B3 | Moyenne | CartFAB chevauche le home indicator iOS | Toutes | Karim |

---

## TOP 10 PROBLEMES UX (par priorite)

| # | Probleme | Impact | Effort | Testeurs concernes |
|---|----------|--------|--------|--------------------|
| 1 | **Pas de navigation mobile** — aucun menu hamburger, aucune bottom tab bar | Bloquant | Moyen | Fatima, Youssef, Aicha, Clara |
| 2 | **Touch targets < 44px** — boutons +, stepper, remove, categories | Accessibilite | Faible | Fatima, Youssef, Clara |
| 3 | **Pages vides promues en homepage** — Bons Plans et Recettes sans contenu | Confiance | Moyen | Aicha, Nadia, Hugo, Leila |
| 4 | **CartDrawer non accessible** — pas de dialog role, pas de focus trap, pas de tap-outside-to-close mobile | Accessibilite | Faible | Clara |
| 5 | **"Vider panier" sans confirmation** — action destructive sans garde-fou | UX critique | Faible | Fatima, Clara |
| 6 | **Textes trop petits (8-9px)** — badges, labels, indisponibilite | Lisibilite | Faible | Youssef, Clara |
| 7 | **Pas de barre de recherche globale** — trouver un produit = navigation boutique par boutique | Conversion | Moyen | Aicha, Youssef, Leila |
| 8 | **ProductCard non focusable au clavier** — div avec onClick, pas de role button | Accessibilite | Faible | Clara |
| 9 | **CLS — skeletons mal dimensionnes + dynamic imports sans placeholder** | Performance | Faible | Thomas, Omar |
| 10 | **Prix pro non implementes cote client** — page Pro promet des tarifs mais rien ne s'affiche | Feature gap | Moyen | Mehdi |

---

## TOP 10 FEATURES MANQUANTES

| # | Feature | Demandee par | Impact estime |
|---|---------|--------------|---------------|
| 1 | **Bottom tab bar mobile** (Accueil, Recherche, Bons Plans, Panier, Profil) | Clara, Fatima, Youssef | Critique |
| 2 | **Barre de recherche globale** (produits + boutiques) | Aicha, Youssef, Leila | Haute |
| 3 | **Multi-boutique** (switch, vue consolidee, stats comparees) | Abdel | Haute |
| 4 | **Partage social** (WhatsApp, copier lien, Instagram) | Aicha, Nadia | Moyenne |
| 5 | **Export donnees** (CSV/PDF commandes, stats, factures) | Abdel, Mehdi | Moyenne |
| 6 | **Compteur fidelite visuel** (barre de progression dans le profil) | Rachid, Hugo | Moyenne |
| 7 | **Paniers sauvegardes** ("Ma commande du vendredi") | Omar, Sarah | Moyenne |
| 8 | **Gestion equipe boucher** (roles employe/manager, permissions) | Abdel | Haute |
| 9 | **Tri par prix** dans les catalogues boutique | Leila | Basse |
| 10 | **Chat direct client-boucher** | Samir | Moyenne |

---

## POINTS FORTS

1. **Mode cuisine (Kitchen Mode)** — Layout 3 colonnes, polling 5s, alertes sonores, tickets 80mm. Comparable a UberEats Restaurant Manager. Les bouchers modernes l'apprecient.
2. **SEO remarquable** — JSON-LD complet (Organization, Shop, Product, Breadcrumb, FAQ), pages villes SSG, sitemap dynamique, robots.txt correct, meta tags pertinents. Score SEO 7.5/10.
3. **Anti-Gaspi** — Fonctionnalite unique et differenciante. Toggle, stock dedie, auto-desactivation, decrementation atomique. Aucun concurrent direct ne l'a.
4. **ISR bien calibre** — Homepage 60s, Boutique 30s + Redis cache. Bon compromis fraicheur/performance.
5. **Systeme promo riche** — 5 types (PERCENT, FIXED, FREE_FEES, BOGO, BUNDLE), diffusion multi-canal (badge, banniere, popup), validation cascade.
6. **Commandes programmees** — Creneau de retrait, marge 10min, transition 30min, integration kitchen mode. Bien pense.
7. **Dark mode** — Support complet avec ThemeProvider. Contrastes corriges.
8. **Middleware optimise** — Routes publiques sans Clerk overhead. Pas de JWT inutile sur la homepage.
9. **Architecture securisee** — `getServerUserId()` partout (jamais `auth()` direct), scope shopId multi-tenant, validation Zod, test mode separe.
10. **PWA** — Service Worker, InstallPrompt, OfflineBanner, manifest.json. Progressive Web App complete.

---

## SCORE GLOBAL

| Critere | Score |
|---------|-------|
| Design / Esthetique | 6.5/10 |
| Navigation / Architecture | 4.5/10 |
| Accessibilite (WCAG) | 4/10 |
| Performance | 6.5/10 |
| SEO | 7.5/10 |
| Fonctionnalites client | 6/10 |
| Fonctionnalites boucher | 6.5/10 |
| Securite / Auth | 8/10 |
| Contenu | 4/10 |
| Mobile UX | 5/10 |
| **MOYENNE GLOBALE** | **5.9/10** |

---

## ROADMAP RECOMMANDEE (20 actions prioritaires)

### Sprint 1 — Urgences UX (1-2 semaines)
1. **Bottom tab bar mobile** — 5 onglets (Accueil, Recherche, Bons Plans, Panier, Compte)
2. **Touch targets 44px** — Augmenter tous les boutons interactifs (ProductCard +, stepper, cart qty, remove)
3. **Confirmation "Vider panier"** — Modale avec "Etes-vous sur ?"
4. **CartDrawer accessible** — `role="dialog"`, `aria-modal`, focus trap, tap-outside-to-close mobile
5. **Taille texte minimum 12px** — Remplacer tous les `text-[8px]`/`text-[9px]` par `text-xs` minimum

### Sprint 2 — Contenu et Conversion (2-3 semaines)
6. **Contenu Bons Plans** — Creer 3-5 offres reelles (anti-gaspi, promos) avant de les promouvoir
7. **Contenu Recettes** — Ajouter 5-10 recettes populaires avec images
8. **Barre de recherche globale** — Recherche produits + boutiques, accessible depuis le header mobile
9. **Compteur fidelite** — Barre de progression dans le profil client
10. **Noindex pages vides** — `robots: { index: false }` sur `/recettes` et `/bons-plans` tant que vides

### Sprint 3 — Performance et Accessibilite (1-2 semaines)
11. **CLS fix** — Skeleton heights = real heights, placeholders pour dynamic imports
12. **ProductCard accessible** — `<button>` ou `<a>` au lieu de `<div onClick>`, `tabIndex`, `role`
13. **CartFAB safe-area** — `padding-bottom: env(safe-area-inset-bottom)` pour iOS
14. **Unifier ShopCard** — Un seul composant pour les cartes boutique partout
15. **OG images dynamiques** — Image Edge par boutique (nom + photo + note)

### Sprint 4 — Features Boucher (2-3 semaines)
16. **Multi-boutique** — Switch entre boutiques, vue consolidee stats
17. **Export CSV/PDF** — Commandes, stats mensuelles, factures
18. **Gestion equipe** — Roles employe/manager avec permissions
19. **Stats avancees** — Top produits, heatmap horaire, comparaison periodes
20. **Logo sidebar 48px** — Glow rouge, wordmark agrandi, espacement vertical

### Bonus (apres Sprint 4)
- Partage social (WhatsApp, copier lien)
- Paniers sauvegardes / commandes recurrentes
- Chat direct client-boucher
- Tri par prix dans les catalogues
- Mode "Simple" pour bouchers non-tech
- Tracking UTM marketing
- Prix pro affiches pour comptes CLIENT_PRO
- Micro-animations ajout au panier
- SIRET a jour dans mentions legales

---

## NOTES METHODOLOGIQUES

- Les pages ont ete accedees via HTTPS sur le site de production `klikandgo.app`
- Certaines pages (boutique, favoris) retournent des skeletons en SSR car les donnees sont chargees cote client — ceci est le comportement normal en ISR
- Les routes authentifiees (dashboard, commandes, checkout) n'ont pas pu etre testees en navigation directe — l'analyse repose sur le code source
- Le test mode (`?testmode=KlikTest2026!`) existe mais n'a pas ete utilise pour simuler une session complete
- Les scores sont bases sur la combinaison observations live + analyse du code source des composants

---

*Rapport genere le 10 mars 2026 — 18 testeurs simules — Klik&Go v1*
