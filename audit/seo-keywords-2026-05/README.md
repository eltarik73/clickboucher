# 🎯 Audit SEO + Keywords Klik&Go — Mai 2026

> Audit complet réalisé par équipe SEO virtuelle (15 personnes — Head of SEO + Tech, Content, Local, Link, GEO/AIO, Analytics, Brand).
> Date : 2026-05-01.

## Pivot stratégique majeur

**AVANT :** "marketplace click & collect halal"  
**APRÈS :** **"annuaire de référence des boucheries halal en Rhône-Alpes"** (modèle Pages Jaunes / Yelp / Mappy spécialisé halal)

→ Les particuliers cherchent "boucherie halal Lyon" — pas "click and collect". Le pivot est UX-driven.

## Documents du dossier

| # | Fichier | Description |
|---|---|---|
| 01 | [`01-gsc-data.md`](./01-gsc-data.md) | Data Google Search Console 12 mois — 22 requêtes, insights |
| 02 | [`02-competitors.md`](./02-competitors.md) | Analyse 7 concurrents halal (Halbutche, Coq d'Or, Luhma, etc.) |
| 03 | [`03-action-plan.md`](./03-action-plan.md) | Plan d'action initial (avant pivot annuaire) |
| 04 | [`04-keywords-master.md`](./04-keywords-master.md) | **Master keyword list ~430 keywords** par catégories + top 30 quick wins + 10 long-tail uniques |
| 05 | [`05-reunion-head-of-seo.md`](./05-reunion-head-of-seo.md) | **Compte-rendu réunion équipe SEO** — 23 décisions actées, validation algos Google/Bing/IA |
| 06 | [`06-strategie-annuaire.md`](./06-strategie-annuaire.md) | **Stratégie pivot annuaire local** — architecture URL + Schemas + GBP + concurrents annuaires |

## TL;DR — Conclusions

### État actuel
- 10 pages indexées Google (sur 90+ sitemap)
- 254 impressions / 5 clics en 12 mois
- Position moyenne 9 (bas de page 1)
- Brand reconnu sur Bing (10/10 résultats top), embryonnaire sur Google

### Opportunité
- Marché halal techniquement faible : aucun concurrent ne fait sérieusement pages quartier + produit×ville + occasions Aïd/Ramadan/Aqiqa par ville
- ~430 keywords identifiés dont 30 quick wins
- 10 super-long-tail uniques (zero competition)

### Décisions consolidées (23)

#### Algorithmes
- **Google Mars 2026 update** → uniqueness obligatoire 250 mots min sur pages programmatiques
- **Google Septembre 2026 Page Experience** → fix LCP mobile avant fin août (actuel 4.2s → cible <2.5s)
- **Google Helpful Content** → noindex auto sur pages avec 0 boucherie (déjà actif)
- **Bing AI Performance Dashboard** → activer cette semaine pour tracker Copilot
- **GEO/AIO** → section TLDR 3 phrases parsable + WebPage description optimisée IA + dashboard tracking citations IA mensuel

#### Architecture
- **Migration URL** : `/boucherie-halal/[ville]` → `/boucheries-halal/[ville]` (pluriel = annuaire) avec 301
- **Hub régional** `/boucheries-halal-rhone-alpes` à créer
- **5 pages départementales** (Savoie, Haute-Savoie, Isère, Rhône, Loire)
- **Pages ville enrichies** (1500-2500 mots, lister TOUTES les boucheries halal de la zone, partenaires + non-partenaires)
- **~25 pages quartier** (Lyon Guillotière, Vénissieux Minguettes, etc.)
- **~50 fiches boucheries individuelles** (style Yelp/PJ avec photo, horaires, avis, carte)
- **Page geolocator** `/trouver-boucherie-halal`
- **180 pages occasions** (Aïd × villes, Ramadan × villes, méchoui × villes — Aïd 2026 = juin = URGENCE)
- **300 pages produits×villes** (merguez Lyon, gigot agneau Grenoble, etc.)
- **30 articles blog** (recettes + cuisson, Recipe schema)

#### Schema.org
- `ItemList` of `LocalBusiness` sur pages annuaire ville
- `Store` + `FoodEstablishment` combiné sur fiches boucheries individuelles
- `Organization` enrichi avec `areaServed` + `SearchAction`
- `Recipe` schema sur articles cuisson (rich snippet stars + temps de cuisson)
- `FAQPage` partout

#### Local SEO
- Optimisation GBP des 11 partenaires (NAP, photos, lien web, attribut click & collect, Q&A)
- 8 citations annuaires (PJ, Yelp, Mappy, Bing Places, Zabihah, etc.)
- Bing Places + Apple Business Connect

#### Link Building
- Cible Q2 : 30 backlinks DR 30+
- Sources : partenaires (11), annuaires niche (8), PR locale (5), guest posts (3)
- Campagne PR Aïd al-Adha lancée mai 2026

#### Content
- Champ `productSpecialty` ajouté à `cities.ts` (300 textes uniques produit×ville)
- 3 articles "Aïd 2026" lancés semaine 1 (mouton, quantité, où acheter)
- Hub recettes : 30 articles ≥ 1500 mots avec Recipe schema + CTA "Commander"

### Sprint 1 (semaine 1-2) — DÉFENSIF + AÏD ANTICIPATION

| Action | Owner | Impact |
|---|---|---|
| Étendre `cities.ts` (18 villes + 25 quartiers + 5 dpts) | Tech | +43 entry points |
| Implémenter scraping annuaire complet (Google Places API) | Tech | +200 fiches |
| Template `/boucheries-halal/[ville]/[boucher-slug]` (fiche annuaire) | Tech | Brand boucher capture |
| Page `/trouver-boucherie-halal` (geolocator) | Tech | "près de moi" |
| Template `/occasions/aid-al-adha/[ville]` × 30 | Tech + Content | URGENT saison juin |
| Optimiser 11 GBP partenaires (NAP, photos, attribut C&C) | Local | Pack Local |
| 3 articles "Aïd 2026" | Content | Traffic saisonnier |

### KPIs cibles (6 mois — décembre 2026)

| KPI | Aujourd'hui | Cible | Stretch |
|---|---|---|---|
| Pages indexées | 10 | 150 | 300 |
| Impressions/mois | 21 | 5 000 | 15 000 |
| Clics/mois | 0.4 | 150 | 500 |
| Position moyenne | 9 | 5 | 3 |
| Top 3 keywords | 5 | 50 | 100 |
| Backlinks DR 30+ | 0 | 30 | 50 |

## Prochaines étapes immédiates

1. ✅ Audit terminé (vous y êtes)
2. → Implémenter Sprint 1 (extension cities.ts + scraping + templates)
3. → Push code + déploiement Vercel
4. → Indexation manuelle GSC + IndexNow
5. → Sprint review semaine 2

## Risques majeurs identifiés

| Risque | Mitigation |
|---|---|
| **Aïd 2026 (juin) — pages non indexées à temps** | Sprint dédié + IndexNow + ping GSC manuel quotidien |
| **Pages thin pénalisées par Mars 2026 update** | Uniqueness 250 mots min obligatoire |
| **Pages Jaunes/Mappy gardent dominance** | Stratégie annuaire complet + UX supérieure + reviews fraîches |
| **LCP mobile fail Septembre 2026** | Sprint perf Q3 |
| **Scraping Pages Jaunes/Yelp = DMCA risk** | Politique stricte Google Places API officielle uniquement |
