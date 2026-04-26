# Phase 6 — Audit UX & Design

Date : 2026-04-26
Stack : Next.js 14, Tailwind 3.4, Outfit + DM Sans + Cormorant, primary `#DC2626`.

---

## 1. Score UX/Design : **7,5 / 10**

### Forces
- **Design system bien posé** : `tailwind.config.ts` expose tokens cohérents (couleurs HSL via CSS vars, fontFamily display/sans/serif, fontSize sémantique `hero/title/subtitle/body`, shadows soft/card/elevated, animations fadeIn/fadeUp/scaleIn).
- **Composants UI primitifs centralisés** : `Button` (cva, 8 variants × 6 sizes), `Input`, `Stepper`, `EmptyState`, `Toast`, `ConfirmDialog`, `Skeleton` tous présents dans `src/components/ui/`.
- **Toast feedback unifié** : `sonner` monté dans `layout.tsx:137` avec `richColors`, utilisé dans 41 fichiers — feedback async cohérent.
- **Empty states soignés** : `/favoris`, `/commandes` ont des illustrations + double CTA (primaire + secondaire) — bonne pratique.
- **ProductForm boucher déjà multi-étapes** (4 steps) — pattern correct pour formulaire long.
- **focus-visible:ring partout** : `Button`, `Input`, `ShopCard`, `ProductCard` ont l'anneau de focus rouge primaire — a11y clavier OK.
- **Mobile-first effectif** : `sm:` / `md:` utilisés correctement, breakpoints `BottomNav` (mobile only via `md:hidden`), padding safe-area-inset.
- **Pas de violet/glassmorphism AI-slop** : palette rouge dominante avec gris neutres — sobre.

### Faiblesses
- **Touch targets sous 44px** récurrents (ProductCard +/-, ThemeToggle 36px, header buttons).
- **Inscription boucher = 7 champs sur une page** sans Stepper alors que le composant existe.
- **Panier = pas de CTA sticky bottom mobile** : "Commander" exige de scroller vers le bas.
- **Contraste `text-gray-400` sur fond clair** : ~67 occurrences hors `dark:` — risque WCAG AA fail sur `#f8f6f3` light.
- **Stack typo non câblée au layout** : la classe `font-display` (Outfit) est utilisée mais pas systémique pour les H1/H2.

---

## 2. Findings importants 🟡

### 🟡 Touch targets ProductCard sous 44px
📁 `src/components/product/ProductCard.tsx:295,302,315`
🐛 Boutons +/- du stepper et bouton "+" d'ajout : `w-[36px] h-[36px]`. Sur mobile, le pouce moyen vise 44–48px (Apple HIG, Material). Sur grille 2 colonnes serrée, le risque de mistap est réel.
💥 Impact UX : taps ratés → frustration, ajouts non voulus, abandon panier. Surtout problématique pour utilisateurs âgés (cible boucherie traditionnelle).
✅ Fix : passer à `w-11 h-11` (44px) ou `w-12 h-12` (48px) — Le panier `panier/page.tsx:91` utilise déjà `w-11 h-11`, à uniformiser.

### 🟡 Pas de CTA sticky bottom dans /panier (mobile)
📁 `src/app/(client)/panier/page.tsx`
🐛 Aucune barre "Passer commande — XX,XX€" sticky en bas d'écran mobile. L'utilisateur doit scroller (items + créneaux + paiement + promo) pour atteindre le bouton final.
💥 Impact UX : abandons panier — pattern Uber Eats/Deliveroo : footer sticky avec total + CTA. Conversion réduite estimée 10-20%.
✅ Fix : footer fixed `bottom-16 md:bottom-0` (au-dessus du BottomNav) avec total + bouton "Commander" plein largeur.

### 🟡 Inscription boucher = formulaire monolithique 7 champs
📁 `src/app/(client)/inscription-boucher/page.tsx:43-51`
🐛 7 champs sur un seul écran (name, address, city, phone, email, siret, description, CGV) — pas de Stepper alors que `src/components/ui/stepper.tsx` existe. Validation seulement au submit (`canSubmit` via état dérivé).
💥 Impact UX : formulaire intimidant pour boucher non-tech. Pas de feedback inline (un SIRET invalide n'est révélé qu'au clic Submit, via `disabled`).
✅ Fix : 3 étapes (1. Identité boutique, 2. Contact + SIRET, 3. Pack & CGV) avec Stepper en haut + validation inline (message rouge sous chaque champ).

### 🟡 Inscription PRO : validation silencieuse
📁 `src/app/(client)/inscription-pro/page.tsx:70-71`
🐛 `siretValid` calculé mais aucun message d'erreur affiché à l'utilisateur — le bouton est juste `disabled` sans explication. Idem `companyName` < 2 chars.
💥 Impact UX : utilisateur ne sait pas pourquoi il ne peut pas soumettre. Frustration, support tickets.
✅ Fix : ajouter `<p className="text-xs text-red-600">SIRET invalide (14 chiffres)</p>` sous le champ après blur.

### 🟡 Contraste `text-gray-400` sur fond clair
📁 Multiple : 67 occurrences hors classes `dark:`
🐛 `text-gray-400` (#9CA3AF) sur fond `bg-[#f8f6f3]` ratio ~3.2:1 — WCAG AA exige 4.5:1 pour le texte normal. Exemple `BottomNav.tsx:55,67`, `OfferPopup.tsx:141,162`.
💥 Impact UX : illisible pour basse vision, malvoyance partielle. Non-conformité WCAG AA.
✅ Fix : remplacer par `text-gray-500` (#6B7280, ratio 4.7:1) ou `text-gray-600`. À valider en preview avec Lighthouse contrast.

### 🟡 ThemeToggle sous 44px
📁 `src/components/ui/ThemeToggle.tsx:13`
🐛 `w-9 h-9` = 36×36px — touch target insuffisant. Présent dans le header de toutes les pages.
💥 Impact UX : mistap sur mobile, particulièrement sur header dense (Logo + 3 liens + cart + theme + auth).
✅ Fix : `w-11 h-11` ou wrapper invisible `min-w-[44px] min-h-[44px]`.

### 🟡 H1 sr-only sur homepage — hiérarchie cachée
📁 `src/app/(client)/page.tsx:232,289`
🐛 H1 visible est `<h2>` ligne 284 ("Klik&Go") + ligne 289 ("Marre d'attendre…"). Le vrai `<h1>` est `sr-only` (SEO-only). Le visible "Klik&Go" est un `<h2>` mais il est plus gros que le slogan.
💥 Impact UX/a11y : ordre lecteur d'écran déroutant. Visuellement la hiérarchie est cassée (le slogan h2 ligne 289 devrait être visuellement plus important que le mot-marque).
✅ Fix : conserver h1 sr-only OK, mais utiliser `<p>` pour "Klik&Go" (mot-marque, pas un titre) et `<h2>` pour le slogan.

---

## 3. Findings améliorations 🟢

### 🟢 Pas de variant `loading` sur Button
📁 `src/components/ui/button.tsx`
🐛 Aucun état loading dans cva variants — chaque appelant doit gérer le `<Loader2 className="animate-spin" />` à la main (vu dans `inscription-pro:107`, `inscription-boucher:30`, etc.).
💥 Impact UX : duplication, états parfois oubliés (bouton restant cliquable pendant submit).
✅ Fix : prop `loading?: boolean` qui ajoute `<Loader2>` à gauche + `disabled` automatique.

### 🟢 Stepper composant existe mais peu utilisé
📁 `src/components/ui/stepper.tsx`
🐛 Le composant est défini, mais inscription pro/boucher ne l'importent pas. ProductForm utilise un système custom (4 steps inline).
✅ Fix : consolider — un seul Stepper utilisé partout.

### 🟢 Pas de `aria-invalid` sur les Inputs en erreur
📁 `src/components/ui/input.tsx`, formulaires
🐛 `Input` ne supporte pas natif `error` prop — pas d'aria-invalid, pas de `aria-describedby` vers le message d'erreur.
✅ Fix : enrichir `Input` avec `error?: string` qui pose `aria-invalid="true"` + classe border-red.

### 🟢 Backdrop-blur lourd sur sticky headers
📁 `BottomNav.tsx:39`, `panier:367`, `favoris:32`, `commandes:367`
🐛 `backdrop-blur-xl` sur 4 sticky headers + popup — coûteux GPU sur Android low-end.
✅ Fix : `backdrop-blur-md` suffit visuellement, ou opacity 95% sans blur.

### 🟢 OfferPopup : "Non merci" sous-stylé
📁 `src/components/client/OfferPopup.tsx:160-165`
🐛 Bouton "Non merci" en `text-sm text-gray-500` sans bordure ni padding — paraît cliquable mais discret. Confusion possible.
✅ Fix : variant `ghost` du Button + taille consistante avec "En profiter".

### 🟢 Hauteur image ShopCard varie sans skeleton
📁 `src/components/shop/ShopCard.tsx:150`
🐛 `h-36 sm:h-48` — entre breakpoints le layout shift CLS si l'image charge tard.
✅ Fix : déjà OK car SafeImage + fill, mais ajouter `loading.tsx` skeleton à hauteur fixe pour la grille initiale.

### 🟢 Pas de toggle "français/arabe" malgré cible halal
📁 N/A
🐛 i18n absent. La cible (FR-Maghreb) inclut souvent une demande arabophone secondaire.
✅ Fix : roadmap — `next-intl` + clés FR/AR. Faible priorité court terme.

### 🟢 ProductCard : flèche origin/halalOrg masquée md→lg
📁 `src/components/product/ProductCard.tsx:186,191`
🐛 `<span className="hidden md:inline lg:hidden">` → texte affiché sur tablette uniquement. Sur mobile et desktop, seulement le drapeau/symbole (peu lisible).
✅ Fix : afficher le label sur mobile aussi (l'espace existe en grille 2-col 375px).

### 🟢 `font-display` non systématique sur les H1/H2
📁 Multiple
🐛 Tailwind config définit `font-display: Outfit` mais beaucoup de titres utilisent la sans par défaut (DM Sans). Brief CLAUDE.md : "Font: Outfit".
✅ Fix : ajouter `font-display` à toutes les `<h1>`/`<h2>` ou modifier `@layer base` dans `globals.css` pour appliquer Outfit aux titres par défaut.

### 🟢 Pas de back-button persistant dans sous-pages mobile
📁 `panier`, `favoris`, `commandes` ont un ArrowLeft en sticky header — bien
🐛 Mais le `boutique/[slug]` aurait intérêt à garder un back vers la liste depuis n'importe où dans le scroll.
✅ Fix : déjà OK via header sticky. À vérifier en preview.

### 🟢 Dark mode toggle pas dans BottomNav
📁 `src/components/layout/BottomNav.tsx`
🐛 ThemeToggle uniquement dans le header. Sur mobile en scroll long, l'utilisateur ne peut pas basculer sans remonter.
✅ Fix : optionnel, ou laisser dans le header (standard).

### 🟢 PrepBadge couleur < 4.5:1 sur prepBadge amber/red
📁 `src/components/shop/ShopCard.tsx:60-62`
🐛 `bg-amber-500/90 text-white` ratio ~2.8:1, `bg-emerald-500/90 text-white` ~2.5:1. WCAG AA gros texte passe (3:1) mais texte normal échoue.
✅ Fix : `bg-amber-600` (ratio 3.5:1+) ou texte `text-amber-950` sur fond clair.

---

## 4. Quick wins UX (effort < 1h)

| # | Fix | Fichier | Effort |
|---|---|---|---|
| 1 | ProductCard +/- buttons → `w-11 h-11` | `ProductCard.tsx:295,302,315` | 5 min |
| 2 | ThemeToggle 36→44px | `ThemeToggle.tsx:13` | 2 min |
| 3 | OfferPopup "Non merci" via Button ghost | `OfferPopup.tsx:160` | 5 min |
| 4 | text-gray-400 → text-gray-500 (light) | grep + sed | 15 min |
| 5 | Sticky CTA bottom dans /panier | `panier/page.tsx` | 30 min |
| 6 | aria-invalid + message inline SIRET | `inscription-pro/-boucher` | 30 min |
| 7 | Button variant `loading` | `button.tsx` | 20 min |
| 8 | Replace h2 "Klik&Go" by p (sémantique) | `page.tsx:284` | 2 min |
| 9 | font-display sur tous les H1/H2 globaux | `globals.css @layer base` | 10 min |
| 10 | backdrop-blur-xl → md sur sticky | 4 fichiers | 5 min |

---

## 5. Tableau récap

| Sévérité | # findings | Catégorie principale |
|---|---|---|
| 🟡 Important | 6 | Touch targets, formulaires, contraste, sticky CTA |
| 🟢 Amélioration | 12 | Composants, a11y, perf, design system |
| **Total** | **18** | |

### Couverture checklist

| Item | État |
|---|---|
| Mobile-first responsive | ✅ OK (breakpoints cohérents) |
| Touch targets ≥ 44px | 🟡 ProductCard, ThemeToggle, header non conformes |
| CTA sticky panier | 🟡 Manquant |
| Feedback async (toasts) | ✅ OK (sonner partout) |
| Loading states | 🟢 Manuels — pas de Button.loading |
| Formulaires multi-étapes | 🟡 Inscription boucher monolithique |
| Validation inline | 🟡 Silencieuse (disabled sans message) |
| Empty states | ✅ OK (/favoris, /commandes soignés) |
| États composants | ✅ OK (focus-visible partout, hover/active) |
| WCAG AA contraste | 🟡 text-gray-400 + badges colorés à valider |
| Hiérarchie titres | 🟡 H1 sr-only + h2 mot-marque |
| Inputs avec label | ✅ OK (à vérifier exhaustivement) |
| Typographie Outfit | 🟢 Pas systémique sur H1/H2 |
| Anti-pattern AI (violet, glassmorphism) | ✅ Aucun détecté |
| Onboarding boucher | 🟡 1 page, 7 champs, pas de save&resume |
| Parcours commande | ✅ Linéaire panier→checkout (intégré dans /panier) |
| Design system tokens | ✅ Excellent (Tailwind config riche) |
| Couleurs hardcodées | 🟢 `#DC2626` répété (devrait être `bg-primary`) |
| Dark mode | ✅ OK (classe `dark:` partout, ThemeToggle fonctionnel) |

---

**Note** : les findings de contraste et CLS demandent validation en preview live (Lighthouse / axe DevTools). Aucun fix appliqué — audit lecture seule.
