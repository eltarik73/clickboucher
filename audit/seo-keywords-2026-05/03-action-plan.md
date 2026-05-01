# Plan d'action SEO Klik&Go — Roadmap par priorité

> Synthèse opérationnelle issue des analyses GSC + concurrents. Le master keyword list (4) sert de référence pour la priorisation.

## P0 — Quick wins immédiats (cette semaine)

### A. Villes manquantes dans `SEO_CITIES`
**Source :** GSC montre des recherches sur des villes hors sitemap.

Ajouter à `src/lib/seo/cities.ts` :
1. **Saint-Jean-de-Maurienne** (Savoie, vallée) — 1 impression GSC, 0 concurrent SEO local
2. **Thyez** (Haute-Savoie, vallée de l'Arve) — 1 impression GSC
3. **Échirolles** (Isère, banlieue Grenoble) — 0 concurrent
4. **Saint-Martin-d'Hères** (Isère, banlieue Grenoble) — 0 concurrent
5. **Bron** (Rhône, banlieue Lyon) — 0 concurrent
6. **Vaulx-en-Velin** (Rhône, banlieue Lyon, communauté musulmane forte) — 0 concurrent
7. **Givors** (Rhône) — 0 concurrent
8. **Roanne** (Loire) — 0 concurrent
9. **Bourgoin-Jallieu** (Isère) — 0 concurrent
10. **Cluses** (Haute-Savoie, vallée Arve) — 0 concurrent
11. **Albertville** (Savoie) — 0 concurrent
12. **Voiron** (Isère) — 0 concurrent
13. **Meyzieu** (Rhône) — 0 concurrent
14. **Oullins** (Rhône) — 0 concurrent

→ +14 pages SSG, ~14 nouvelles entry points longue traîne

### B. Page geo-locator "trouver près de moi"
**Source :** GSC 4 impressions sur "boucherie halal à proximité de ma position"

Créer `src/app/trouver-boucherie-halal/page.tsx` :
- Hero : "Trouvez la boucherie halal la plus proche de chez vous"
- Géolocalisation utilisateur (consent banner)
- Liste triée par distance
- Map intégrée
- Schema LocalBusiness

### C. Optimisation pages boutique pour search "[nom boucher] [ville]"
**Source :** GSC montre 8 requêtes sur noms de bouchers partenaires.

Modifier `src/app/(client)/boutique/[slug]/page.tsx` :
- Title pattern : `{shop.name} — Boucherie halal {shop.city} | Click & Collect Klik&Go`
- H1 : `{shop.name} — Votre boucherie halal à {shop.city}`
- Meta description avec mention quartier si présent
- Schema Store enrichi avec aggregateRating, openingHours, priceRange
- Page également indexable sur "boucher tarek", "elba market bissy", etc.

### D. Sitemap : intégrer les nouvelles entries
- Ajouter automatiquement les nouvelles villes
- Pages quartier, produit, occasion (au fur et à mesure)

## P1 — Mid-term (2-4 semaines)

### A. Pages quartier (extension géo)
Nouveau template `src/app/boucherie-halal/[ville]/[quartier]/page.tsx` :
- 4 quartiers Lyon : Croix-Rousse, Vaise, Guillotière, Vénissieux
- 3 quartiers Grenoble : Villeneuve, Mistral, Echirolles centre
- 3 quartiers Chambéry : Biollay, Hauts-de-Chambéry, Chambéry-le-Vieux
- 2 quartiers Saint-Étienne : Tarentaize, Bellevue
- Total : ~15 pages quartier
- Maillage : depuis page ville parent + boucheries situées dans le quartier

### B. Pages produit × ville
Nouveau template `src/app/[ville]/[produit]/page.tsx` ou `src/app/produits-halal/[produit]/[ville]/page.tsx` :
- Produits prioritaires (top recherches) :
  1. Merguez halal
  2. Gigot d'agneau halal
  3. Côte de bœuf halal
  4. Brochettes halal
  5. Kefta / viande hachée halal
  6. Poulet fermier halal
  7. Côte d'agneau halal
  8. Épaule d'agneau halal
- Croisement : 8 produits × 14 villes = **112 pages produit/ville**
- Contenu : intro produit + boucheries qui le proposent + recettes liées + Schema Product

### C. Hub occasions (gap concurrentiel majeur)
Nouvelles pages :
- `/aid-el-kebir-[ville]` — Aïd al-Adha mouton sacrifice (juin 2026 → URGENCE)
- `/aid-el-fitr-[ville]` — fin Ramadan
- `/ramadan-[ville]` — Iftar / Suhour
- `/aqiqa-mouton-naissance` — niche peu concurrentielle
- `/mechoui-[ville]` — événements privés
- `/barbecue-halal-[ville]` — saisonnier mai-août
- `/viande-mariage-halal-[ville]` — gros panier

→ ~20-30 pages occasion

### D. Hub recettes (Recipe schema = avantage SERP)
Nouveau template `src/app/recettes/[slug]/page.tsx` :
- 20 recettes top en France :
  1. Tajine agneau pruneaux
  2. Couscous merguez
  3. Gigot d'agneau au four 7h
  4. Brochettes marinées halal
  5. Kefta sauce tomate
  6. Côte de bœuf plancha
  7. Méchoui agneau entier
  8. Hachis parmentier halal
  9. Pastilla poulet
  10. Boulettes viande hachée
  11. Cuisses poulet rôti
  12. Bourguignon halal
  13. Magret canard halal (rare)
  14. Saucisses agneau halal
  15. Chich taouk
  16. Chiche kebab
  17. Cordon bleu maison halal
  18. Steak haché 5%
  19. Filet de bœuf
  20. Foie gras (volaille)
- Recipe schema sur chacune
- Cross-link vers boutiques qui proposent les ingrédients

## P2 — Long-term (1-3 mois)

### A. Hub éditorial / E-E-A-T
- `/guide/certification-halal-comprendre-les-labels` (AECFI, AVS, Achahada)
- `/blog/calendrier-fetes-musulmanes-2026-2027`
- `/blog/comment-choisir-sa-boucherie-halal`
- `/blog/origine-viande-halal-france`

### B. Pages comparatives
- "boucherie halal pas cher Lyon"
- "meilleure boucherie halal Chambéry"
- "boucherie halal bio Grenoble"

### C. Calculateurs / outils
- "Combien de viande pour [N] personnes ?"
- "Combien coûte un méchoui ?"
- Calendrier Aïd avec countdown

## Synthèse volumes

| Catégorie | Pages à créer | Priorité | Délai |
|---|---|---|---|
| Villes manquantes | 14 | P0 | 1 semaine |
| Geo-locator | 1 | P0 | 1 semaine |
| Optim pages boutique | (existantes) | P0 | 1 semaine |
| Pages quartier | ~15 | P1 | 2 semaines |
| Produit × ville | ~112 | P1 | 3 semaines |
| Hub occasions | ~25 | P1 | 4 semaines |
| Hub recettes | ~20 | P1 | 4 semaines |
| Éditorial / blog | ~10 | P2 | 1-3 mois |

**Total : ~200 nouvelles pages SSG, sans rédacteur externe (génération programmatique avec template + données structurées).**

## KPIs cibles à 6 mois

- Pages indexées GSC : 10 → **150+**
- Impressions mensuelles : 254 sur 12 mois (~21/mois actuellement) → **5000+/mois**
- Clics mensuels : 0.4/mois → **150+/mois**
- Position moyenne : 9 → **5**
- Top 3 sur 50+ keywords longue traîne (vs aujourd'hui : top 3 sur ~5)

## Risques

- **Duplicate content thin** sur pages produit × ville si template trop répétitif → DOIT avoir ≥150 mots uniques par page (intro produit, contexte ville, boucheries locales différentes)
- **Cannibalisation** entre `/[ville]/merguez` et `/recettes/merguez-barbecue` → bien différencier intention (acheter vs cuisiner)
- **Indexation lente** : Google prend 2-8 semaines pour indexer une nouvelle page sur un site jeune → utiliser IndexNow systématiquement, ping Google Search Console en manuel pour les pages stratégiques
