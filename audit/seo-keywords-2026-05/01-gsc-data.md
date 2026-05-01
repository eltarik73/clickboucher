# GSC Data — 12 derniers mois (extrait le 2026-05-01)

> Source : Google Search Console — propriété `sc-domain:klikandgo.app` (compte `contact@bativio.fr`)
> Période : ~02/03/2026 → 01/05/2026 (~2 mois de data réelle, le site est jeune)

## Métriques globales
- **Clics totaux :** 5
- **Impressions totales :** 254
- **CTR moyen :** 2 %
- **Position moyenne :** 9

## Top 22 requêtes (toutes celles enregistrées)

| # | Requête | Clics | Impressions | Position |
|---|---------|-------|-------------|----------|
| 1 | klik and go | 0 | 18 | 2.2 |
| 2 | elba market bissy | 0 | 8 | 9.2 |
| 3 | boucherie halal cognin | 0 | 8 | 10.8 |
| 4 | el fath boucherie chambery | 0 | 6 | 10.7 |
| 5 | klikandgo | 0 | 5 | 2.2 |
| 6 | boucherie cognin halal | 0 | 5 | 12.6 |
| 7 | boucherie halal à proximité de ma position | 0 | 4 | 9.5 |
| 8 | boucherie halal bissy | 0 | 4 | 9.8 |
| 9 | mektoub boucherie | 0 | 4 | 18.5 |
| 10 | boucherie el fath chambéry | 0 | 3 | 9.3 |
| 11 | klik&go | 0 | 3 | 32.7 |
| 12 | klik et go | 0 | 2 | 2.0 |
| 13 | click and collect boucherie | 0 | 2 | 9.0 |
| 14 | boucherie el fath chambery | 0 | 2 | 15.0 |
| 15 | boucherie tarek | 0 | 1 | 5.0 |
| 16 | market boucherie halal | 0 | 1 | 11.0 |
| 17 | boucherie elba | 0 | 1 | 13.0 |
| 18 | boucherie halal saint jean de maurienne | 0 | 1 | 41.0 |
| 19 | boucherie thyez halal | 0 | 1 | 47.0 |
| 20 | boucherie le 134 | 0 | 1 | 63.0 |
| 21+22 | (autres queue) | – | – | – |

## Lecture stratégique

### Patterns détectés

**A. BRAND fortement recherché (~31 impressions, 12% du total)**
- "klik and go" : 18
- "klikandgo" : 5
- "klik&go" : 3
- "klik et go" : 2
- 3 variantes orthographiques → besoin de redirections + meta optimisées

**B. NOM DE BOUCHER PARTENAIRE recherché (~24 impressions, 9% du total)**
- "elba market bissy" : 8
- "el fath boucherie chambery" : 6
- "boucherie cognin halal" : 5 (sans doute = boucherie partenaire à Cognin)
- "mektoub boucherie" : 4
- "boucherie el fath chambéry" : 3
- "boucherie el fath chambery" : 2 (variant)
- "boucherie tarek" : 1
- "boucherie elba" : 1
- "boucherie le 134" : 1

→ **OPPORTUNITÉ #1 :** créer une page dédiée par boucherie partenaire (`/boutique/[slug]` existe déjà mais pas optimisée SEO pour ce pattern de search). Booster meta title : "Nom Boucherie | Boucherie halal [ville] | Click & Collect Klik&Go"

**C. QUARTIER + GEO recherché (~17 impressions)**
- "boucherie halal cognin" : 8
- "boucherie cognin halal" : 5 (variant)
- "boucherie halal bissy" : 4
- → Les pages quartier marchent (déjà créées dans cities.ts)
- Position 10-12 → potentiel de monter en top 5 avec contenu enrichi

**D. RECHERCHES "PROXIMITÉ"**
- "boucherie halal à proximité de ma position" : 4
→ **OPPORTUNITÉ #2 :** créer une page geo-locator `/trouver-boucherie-halal` avec géolocalisation utilisateur

**E. VILLES MANQUANTES dans le sitemap**
- "boucherie halal saint jean de maurienne" : 1 (Savoie, à 1h de Chambéry)
- "boucherie thyez halal" : 1 (Haute-Savoie, vallée de l'Arve)
→ **OPPORTUNITÉ #3 :** ajouter ces villes à `SEO_CITIES`

### Insights critiques

1. **0 clic sur 254 impressions** — le site apparaît mais ne convertit pas le clic
   - Cause probable : position moyenne 9 (bas de page 1)
   - Cause secondaire : SERP encombrée par Google Maps + Pages Jaunes en top
   - **Action :** travailler le CTR via meta titles + emoji + rich snippets (rating, availability)

2. **22 requêtes en 2 mois** — site jeune, indexation en cours
   - Comparaison : un site mature aurait 1000+ requêtes
   - Va monter mécaniquement avec l'âge + plus de pages indexées

3. **Aucune requête PRODUIT** (merguez, agneau, kefta, brochettes)
   - Cause : pas de pages produit catégorie indexées
   - **Action :** créer pages catégorie produit `/[ville]/[produit]` (ex : `/lyon/merguez`, `/chambery/agneau-halal`)

4. **Aucune requête OCCASION** (Aïd, Ramadan, méchoui, BBQ)
   - Cause : pas de pages occasion
   - **Action :** créer pages saisonnières `/aid-al-adha-[ville]`, `/viande-ramadan-[ville]`, `/meilleure-merguez-bbq-[ville]`

## TOP wins identifiables direct

1. ✅ Boucheries partenaires → page boutique dédiée optimisée (déjà existante, à booster)
2. ✅ Quartiers Cognin/Bissy → enrichir pages existantes (déjà créées)
3. 🆕 Saint-Jean-de-Maurienne + Thyez → ajouter à SEO_CITIES
4. 🆕 Page "trouver boucherie halal proche de moi" avec geo
5. 🆕 Pages produit + ville (~80-100 nouvelles pages programmatiques)
6. 🆕 Pages occasion (~20-30 pages saisonnières)
