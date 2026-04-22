# Tour 1 — Audit UX klikandgo.app

Audit réalisé le 2026-04-22 via HTTP (curl). Approche : 10 personas, tests blackbox + sondage d'APIs publiques.

**Contexte serveur** : TTFB homepage 0.64s (frais), pages ville 0.12-0.14s (SSG OK). Site majoritairement en test : 8/9 boutiques en `status: CLOSED` dans `/api/shops` — probablement normal vu l'heure (01h45 local), mais UX à tester en conditions ouvertes.

---

## Persona 1 — Fatima, 42 ans, primo-visiteuse mobile (Chambéry)

**URLs** : `/boucherie-halal/chambery`, `/boutique/boucherie-tarik`, `/panier`

**Ce qui fonctionne**
- Page ville Chambéry : HTTP 200, 5 boutiques listées, title SEO propre (`Boucherie halal à Chambéry — Click & Collect | Klik&Go`).
- Boutique Tarik affiche numéro de téléphone (`0631931485`), produits (Cote, Gigot, Merguez...), bouton "Ajouter au panier".
- `<meta viewport>` correct, lang="fr", theme-color `#DC2626` présent.

**Frictions**
1. 🔴 **Recherche cassée sur mots accentués** : `/api/search?q=côte` retourne `count: 0`, alors que `/api/search?q=boeuf` retourne 10. Même `q=cote` (sans accent) = 0. Fatima tape "côte de bœuf" → aucun résultat. Abandon quasi certain.
2. 🔴 **Status `CLOSED` omniprésent** sur le JSON (8/9 boutiques) sans explication claire côté UI : Fatima arrive sur une boutique "Fermé" le weekend et ne comprend pas si elle peut quand même commander pour plus tard (mode click & collect programmé). Pas de copy "Commandez maintenant, retrait demain".
3. 🟠 **Description absente** pour `Boucherie Tarik` (seule OPEN) — `description: null` dans l'API. Les autres ont un texte marketing; la vitrine principale n'en a pas.
4. 🟠 Title de `/panier` est **dupliqué** : `Mon panier | Klik&Go | Klik&Go` (bug template).

**Impact** : abandon mobile, perte de conversion sur le parcours "recherche produit → boutique".

---

## Persona 2 — Karim, 28 ans, dev freelance (desktop, habitué e-commerce)

**URLs** : `/`, `/boutique/*`, `/panier`, `/api/cart`

**Ce qui fonctionne**
- `/api/cart` retourne `{success, data:{items:[]}}` même sans auth — bon (fix précédent validé).
- Homepage liste les boutiques, liens vers `/boutique/[slug]`.
- Panier persistant via Context/useReducer.

**Frictions**
1. 🟠 **Pas de comparateur** ni lien "Comparer cette boutique" — aucun état side-by-side, obligé d'ouvrir des onglets.
2. 🟠 **Recherche globale UX pauvre** : `placeholder="Rechercher un produit, une viande..."` mais `/api/suggestions?q=bo` retourne `{data: []}` — l'autocomplete est à vide.
3. 🟡 Pas d'indicateur de "distance/temps" côté homepage (listing est simple, pas de géoloc visible).

**Impact** : moins de comparaison = moins d'engagement. Pas critique mais optimisation.

---

## Persona 3 — Aicha, 55 ans, peu tech (lien WhatsApp)

**URLs** : `/boutique/boucherie-tarik` via lien direct

**Ce qui fonctionne**
- Page affiche téléphone cliquable (format `0631931485` apparaît 2× dans le HTML).
- Touch targets : 5× `min-h-[44` détectés, `aria-label` 7×.

**Frictions**
1. 🟠 **Téléphone sans `tel:` prefix** confirmé dans la sortie : `0631931485` est brut, pas toujours wrappé en `<a href="tel:">`. Aicha ne peut pas appeler en un tap sans formatage correct.
2. 🟠 **Police par défaut peut paraître petite** — pas de mode "gros texte" accessible. Pas de toggle a11y.
3. 🟡 Pas de bouton "Aide / Appeler" visible en haut de page.

**Impact** : Aicha ne téléphonera pas, elle n'osera pas commander en ligne.

---

## Persona 4 — Mohamed, 35 ans, restaurant B2B

**URLs** : `/pro`, `/espace-boucher`

**Ce qui fonctionne**
- `/pro` existe (HTTP 200), mentionne 85× "pro", 17× "Pro", 2× SIRET, 3× "professionnel", 3× "traiteur".
- Title : `Espace Professionnel | Klik&Go`, meta description correcte.

**Frictions**
1. 🔴 **Confusion naming** : `pRo` apparaît 3× (casse mixte "pRo") — probable texte mal formaté/cassé dans un composant. Peu professionnel pour une cible B2B.
2. 🟠 Pas de route claire `/pro/inscription` ou formulaire SIRET visible dans les links extraits de la page d'accueil.
3. 🟠 Onboarding ProAccess : le schéma mentionne `CLIENT_PRO_PENDING` — pas de page publique expliquant le délai d'activation.

**Impact** : Mohamed ne comprend pas comment obtenir son compte pro. Abandon.

---

## Persona 5 — Sofiane, 22 ans, étudiant (bons plans)

**URLs** : `/bons-plans`, `/bons-plans/anti-gaspi`

**Ce qui fonctionne**
- Page présente : "Anti-Gaspi" (3×), "Flash", "Promo", "Aujourd'hui".
- Anti-gaspi mentionne DLC.

**Frictions**
1. 🟠 **Aucun filtre par prix** ou tri visible dans le HTML de `/bons-plans` (grep sur `filtre`, `trier` → vide).
2. 🟠 Bons plans = liste globale sans géolocalisation / rayon — Sofiane ne voit pas si la promo est accessible depuis chez lui.
3. 🟡 Pas de badge `-X%` lisible à l'échelle mobile (seulement 1 fois "Promo").

**Impact** : pas catastrophique mais UX perfectible ; l'étudiant zap rapidement.

---

## Persona 6 — Noura, 30 ans, SEO Lyon 🔴 CRITIQUE

**URLs** : `/boucherie-halal/lyon`, `/boucherie-halal/aix-les-bains`, `/boucherie-halal/annecy`, `/boucherie-halal/grenoble`, `/boucherie-halal/saint-etienne`

**Frictions majeures**
1. 🔴🔴 **5 pages villes SUR 6 sont VIDES** : Aix, Annecy, Grenoble, Lyon, Saint-Étienne → 0 liens `href="/boutique/..."` dans le HTML. Copy visible : `"Bientôt à Lyon"`. `/api/shops?city=Lyon` retourne `[]`.
   - Seule **Chambéry** a 5 boutiques.
   - Ces 5 pages sont dans `sitemap.xml` → Google indexe **5 pages thin-content** = pénalité SEO, taux de rebond 100%.
2. 🔴 **Mensonge SEO** : le `meta description` de Lyon promet "les boucheries halal de Lyon" alors que la page est vide. Mauvais signal utilisateur + Googlebot.
3. 🟠 Pas de formulaire "Recevez-moi quand Klik&Go arrive à Lyon" pour capter l'email → opportunité marketing manquée.

**Impact** : acquisition SEO ruinée sur 5 villes majeures. Fix critique : soit désindexer (`noindex` sur villes vides), soit afficher un CTA waitlist.

---

## Persona 7 — Hamza, 40 ans, panier abandonné

**URLs** : `/panier`, `/api/cart`

**Ce qui fonctionne**
- `/api/cart` retourne `200 + items:[]` sans auth (pas de 401).
- Panier stocké dans Context/useReducer + probablement localStorage (standard).

**Frictions**
1. 🟠 Pas de **relance panier** visible (pas de API `/api/cart/abandoned` détectée, pas d'email Resend documenté pour rappel 2h).
2. 🟠 Title `Mon panier | Klik&Go | Klik&Go` → user retrouvant l'onglet ne voit pas le contenu résumé.
3. 🟡 Pas de badge "3 articles" dans le title de l'onglet pour signaler un panier plein.

**Impact** : taux de récupération panier abandonné probablement bas.

---

## Persona 8 — Leila, 27 ans, mobile Safari (PWA)

**URLs** : `/manifest.webmanifest`, `/manifest.json`, `/icons/*`

**Ce qui fonctionne**
- `/manifest.json` = HTTP 200, bien formé (name, icons, theme_color `#DC2626`).
- `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-maskable.png`, `/screenshots/home.png` → tous HTTP 200.
- `apple-mobile-web-app-capable: yes`, `apple-mobile-web-app-title: Klik&Go`.

**Frictions**
1. 🔴 **`/manifest.webmanifest` = 404** alors que `layout.tsx` référence `/manifest.json` (rel manifest crossOrigin=use-credentials). Si un crawler ou PWA audit cherche le standard `.webmanifest`, il échoue. Vérifier que Next.js ne redirige pas.
2. 🟠 `/icon-192.png` (sans `/icons/` préfixe) → 404 ; certains tools Android cherchent à la racine.
3. 🟡 Pas d'invite PWA visible dans le HTML mobile (composant `InstallPrompt` en lazy `ssr:false`, OK — mais vérifier le déclenchement).

**Impact** : installations PWA sous-optimisées, mauvais score Lighthouse PWA.

---

## Persona 9 — Yassine, 45 ans, testeur de limites

**URLs** : `/api/cart/items` POST, validation API

**Frictions**
1. 🟡 Test POST `/api/cart/items {productId:"invalid",quantity:50}` a été annulé (erreur curl 35 TLS) — impossible de tester l'auth mur côté API en une seule passe. À retester.
2. 🟠 `/api/shops/[id]/available-slots?date=2026-04-26` retourne 3 places par créneau, 00h-24h visible — pas de limite jour férié, pas d'exception de fermeture exceptionnelle visible.
3. 🟠 Pas de limite max visible pour `quantity` côté front (à investiguer sur boutique). Un user peut essayer 999 kg.

**Impact** : faible si validation serveur Zod stricte; audit backend nécessaire.

---

## Persona 10 — Amina, boucher (test mode)

**URLs** : `/boucher/dashboard`, `/boucher/commandes`, `/boucher/dashboard/catalogue`, `/boucher/dashboard/parametres` (avec cookie `klikgo-test-role=BOUCHER`)

**Ce qui fonctionne**
- `/boucher/dashboard` : HTTP 200, contenu présent (sidebar links: `/boucher/clients`, `/boucher/performance`, `/boucher/produits`, `/boucher/support`, `/boucher/images`, `/boucher/dashboard/anti-gaspi`, `/shop/offers`).

**Frictions**
1. 🔴 **`/boucher/dashboard/catalogue` et `/boucher/dashboard/parametres` = HTTP 404** même avec le cookie test-role BOUCHER. Pourtant CLAUDE.md liste ces routes (`boucher/dashboard/catalogue`, `boucher/dashboard/parametres`).
   - Les vraies routes semblent être `/boucher/produits` et `/boucher/parametres` (visibles dans les liens du sidebar). Incohérence entre doc et implémentation.
2. 🟠 Title de toutes les pages boucher : `Klik&Go — Click & Collect Boucherie Halal` (title client par défaut) — aucun title spécifique "Dashboard Boucher | Klik&Go". Mauvaise UX onglets (boucher ne distingue pas ses tabs).
3. 🟠 La page `/boucher/dashboard` contient littéralement le texte `"404"` et `"Page introuvable"` dans son HTML (peut-être un composant NotFound conditionnel ou un fallback côté sidebar). À investiguer.
4. 🟡 `/espace-boucher` bien fait (11× "rejoindre", 9× "inscription") — bon funnel B2B.

**Impact** : boucher perdu sur les sous-menus, incohérence doc/prod.

---

## SYNTHÈSE — TOP 15 frictions prioritaires

| # | Priorité | Friction | Impact | Persona(s) |
|---|----------|----------|--------|------------|
| 1 | 🔴 | **5/6 pages SEO ville VIDES** indexées dans sitemap (`/boucherie-halal/{lyon,annecy,grenoble,aix-les-bains,saint-etienne}`) — 0 shop, copy "Bientôt à X" | SEO détruit, acquisition à 0 | 6 |
| 2 | 🔴 | **Recherche insensible aux accents cassée** : `q=côte` → 0 résultat, `q=cote` → 0, alors que `q=boeuf` → 10 | Abandon massif | 1, 2 |
| 3 | 🔴 | **`/boucher/dashboard/catalogue` et `/parametres` → 404** alors que documentés dans CLAUDE.md | Boucher perdu, friction onboarding | 10 |
| 4 | 🔴 | **`/manifest.webmanifest` → 404** (seul `/manifest.json` existe) | Score PWA et crawler PWA dégradés | 8 |
| 5 | 🔴 | **Casse mixte "pRo" visible 3×** sur `/pro` — texte cassé / bug d'affichage B2B | Crédibilité B2B ruinée | 4 |
| 6 | 🟠 | **Title dupliqué** `Mon panier \| Klik&Go \| Klik&Go`, `Mes favoris \| Klik&Go \| Klik&Go`, `Connexion \| Klik&Go \| Klik&Go`, `Recettes halal [...] \| Klik&Go \| Klik&Go` | UX + SEO | 1, 7 |
| 7 | 🟠 | **Pages boucher ont le title client générique** `Klik&Go — Click & Collect Boucherie Halal` | Navigation onglets boucher pénible | 10 |
| 8 | 🟠 | **Status `CLOSED` sans copy explicative** click-and-collect programmé : user ne sait pas s'il peut commander pour plus tard | Abandon sur boutique fermée | 1, 3 |
| 9 | 🟠 | **Téléphone non cliquable systématiquement** (`0631931485` brut, pas `tel:`) | Aicha ne peut pas appeler | 3 |
| 10 | 🟠 | **Suggestions autocomplete vides** : `/api/suggestions?q=bo` retourne `[]` — feature morte | Recherche inefficace | 2 |
| 11 | 🟠 | **Pas de formulaire PRO inscription** visible, pas de `/pro/inscription` | Acquisition B2B bloquée | 4 |
| 12 | 🟠 | **Pas de filtres/tri sur `/bons-plans`** (prix, distance, DLC) | UX étudiant/bon plan médiocre | 5 |
| 13 | 🟠 | **Description vide pour la boutique principale** `Boucherie Tarik` (`description: null`), alors que les autres en ont | SEO boutique + lisibilité | 1 |
| 14 | 🟡 | **Page `/boucher/dashboard` contient `404` / `Page introuvable`** dans son DOM malgré HTTP 200 | Bug visuel ou composant fallback mal geré | 10 |
| 15 | 🟡 | **Pas de waitlist email** sur les villes "Bientôt" | Opportunité marketing manquée | 6 |

---

## Synthèse par thème

### Navigation & Information Architecture
- Confusion entre `/boucher/dashboard/catalogue` (doc) et `/boucher/produits` (réalité). Aligner la doc OU les routes.
- Pas de fil d'Ariane visible côté boucher.
- `/pro` vs `/espace-boucher` : deux funnels, à expliciter pour éviter confusion.

### Recherche (🔴 critique)
- **Normalisation accents absente** : fold côté server (`.normalize('NFD').replace(/[\u0300-\u036f]/g,'')`) requis avant le LIKE/Prisma `contains`.
- Suggestions cassées (retour `[]`).
- Pas de recherche full-text Postgres (`tsvector`) probablement.

### Panier & Checkout
- `/api/cart` OK (200, fallback vide).
- Titres dupliqués.
- Pas de relance panier abandonné.
- Validation quantity max à vérifier.

### Search/SEO
- 🔴 Sitemap inclut 5 pages vides → **pénalité SEO majeure**. Ajouter `if (shops.length === 0) noindex` ou retirer du sitemap.
- Description vide pour Boucherie Tarik.
- Title pattern buggué (suffixe `| Klik&Go` appliqué 2×).

### Mobile & PWA
- Manifest OK en `.json` mais pas en `.webmanifest` standard.
- Viewport, theme-color, apple-touch-icon OK.
- PWA install prompt lazy-loaded (OK perf) mais UX à valider en vrai mobile.
- Touch targets 44px présents (5×), bon signal.

### Accessibilité
- `lang="fr"` OK.
- `aria-label` présents (7×).
- **Manque** : skip-to-main-content, mode gros texte, focus-visible a verifier.
- Téléphones parfois non cliquables.

### B2B / Pro
- `/pro` présent mais bugs d'affichage ("pRo"), pas de formulaire clair.
- `CLIENT_PRO_PENDING` sans page d'explication du flow.

### Performance
- TTFB homepage 0.64s — acceptable mais améliorable (198KB HTML).
- Villes SSG 0.12-0.14s — excellent.
- Site = `output: standalone`, Vercel, OK.

---

## Actions recommandées (quick wins)

1. **Fix immédiat** : `.normalize('NFD')` sur tous les `where` de recherche produit.
2. **Fix immédiat** : ajouter `noindex` conditionnel dans `/boucherie-halal/[ville]/page.tsx` si `shops.length === 0`, et filtrer le sitemap.
3. **Fix immédiat** : le template de title (`generateMetadata`) applique `| Klik&Go` deux fois — vérifier `layout.tsx` title template vs `metadata.title` des pages.
4. **Fix**: router `/boucher/dashboard/catalogue|parametres` ou mettre à jour CLAUDE.md + liens du dashboard.
5. **Fix**: wrap tous les numéros en `<a href="tel:{num}">`.
6. **Fix**: texte "pRo" sur `/pro` — probable bug `{variable}` mal capitalisé.
7. **Add**: `app/manifest.webmanifest/route.ts` (rewrite vers manifest.json) ou renommer.
8. **Add**: waitlist email sur villes vides.
9. **Add**: copy click-and-collect programmé sur boutiques `CLOSED` ("Commandez pour demain 10h").
10. **Add**: filtres prix/distance sur `/bons-plans`.
