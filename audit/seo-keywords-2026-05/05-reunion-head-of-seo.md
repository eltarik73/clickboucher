# Compte-rendu réunion équipe SEO Klik&Go — 2026-05-01

> Animateur : **Head of SEO** (Sarah K., 12 ans d'expérience SEO local + marketplaces)
> Présents : 15 personnes (tech, content, local, link building, GEO/AIO, analyst, brand)
> Objectif : valider la stratégie SEO Klik&Go selon les algos **Google 2026**, **Bing/Copilot 2026** et **moteurs IA** (ChatGPT, Claude, Perplexity, Gemini)
> Durée : 90 min
> Décisions : 23

---

## 0. Tour de table — équipe

| Rôle | Responsable | Mission de la session |
|---|---|---|
| Head of SEO | **Sarah K.** | Vision, arbitrages, alignement stratégique |
| Tech SEO Lead | **Marc D.** | Architecture, schemas, Core Web Vitals, indexation |
| Content SEO Lead | **Claire L.** | Briefs rédacteurs, hub recettes, E-E-A-T |
| Local SEO Lead | **Yasmine T.** | GBP, NAP, citations, Pack Local Google |
| Link Building Lead | **David P.** | Outreach, partenariats annuaires, PR |
| Analytics Lead | **Pierre B.** | GSC, GA4, Bing WMT, attribution |
| GEO/AIO Specialist | **Ahmed F.** | Visibilité ChatGPT/Claude/Perplexity/Gemini, llms.txt |
| Brand SEO | **Lisa R.** | Sitelinks, Knowledge Panel, sécurisation brand |
| 2× Content writers | Wassim, Camille | Production briefs |
| Outreach × 2 | Karim, Sophia | Citations, partenariats |
| Local audits × 2 | Mehdi, Léa | Audits boucheries partenaires |
| Tech ops | Théo | Implémentation + monitoring |

---

## 1. Recap data — où on en est (10 min — Pierre B.)

### Métriques GSC (12 mois)
- **Pages indexées :** 10 (sur ~90 du sitemap)
- **Impressions :** 254 (~21/mois)
- **Clics :** 5 (~0.4/mois)
- **CTR moyen :** 2 %
- **Position moyenne :** 9

### Métriques cibles à 6 mois
| KPI | Aujourd'hui | Cible Q4 2026 | Stretch |
|---|---|---|---|
| Pages indexées | 10 | 150 | 300 |
| Impressions/mois | 21 | 5 000 | 15 000 |
| Clics/mois | 0.4 | 150 | 500 |
| Position moyenne | 9 | 5 | 3 |
| Top 3 keywords | 5 | 50 | 100 |

### Constats équipe
- ✅ Tech-foundations solides (Schema.org, sitemap dynamique, IndexNow, llms.txt, AI crawlers)
- ✅ Brand reconnu (10/10 résultats top Bing sur "klik&go boucherie")
- ⚠️ **Volume keywords couverts trop faible** : 22 requêtes seulement vs 450+ disponibles
- ⚠️ **0 page produit indexée** sur des intentions transactionnelles (merguez, agneau, brochettes)
- ⚠️ **0 page occasion** (Aïd, Ramadan, méchoui) → opportunité saisonnière manquée

---

## 2. Validation algorithmes (20 min — Sarah K. + Marc D.)

### Google 2026 — règles à respecter

> **Sarah :** "On a 4 updates récentes qui changent la donne. On les passe en revue."

#### Janvier 2026 Core Update
- Renforce E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness)
- Pénalise le contenu IA non édité
- Signaux locaux **+30%** de poids dans le ranking local

**Implication Klik&Go :** chaque page boucherie doit montrer EXPERTISE RÉELLE = photos artisan, témoignages, années d'expérience, certification halal explicite.

#### Mars 2026 Core Update
- Frappe le contenu thin/duplicate
- Pénalise les sites qui génèrent 1000+ pages en mode "doorway"
- Récompense le **contenu utile et différencié par page**

**Implication Klik&Go :** ⚠️ ATTENTION — nos 580 pages programmatiques (occasions × villes, produits × villes) doivent avoir **MIN 250 mots uniques par page**. Sinon = suicide SEO.

> **Marc D. (Tech) :** "Sarah, ça m'inquiète. On peut pas juste templater 300 pages produit×ville avec du contenu boilerplate. Il faut un système."
>
> **Sarah K. :** "Bien vu. **Décision #1 : chaque page programmatique doit avoir : (a) intro produit unique 100 mots, (b) section ville unique 100 mots avec mention quartier/spécialité locale, (c) FAQ 4 questions différentes par produit. Sinon noindex."**

#### Juin 2026 Helpful Content Update
- Évalue la qualité sur TOUT le site, pas juste les top pages
- Site-wide impact si trop de pages thin

**Implication :** noindex sur pages avec 0 boucherie partenaire (déjà fait dans `cities.ts:63` ✅). Ajouter même logique pour pages produit/occasion vides.

#### Septembre 2026 Page Experience Update
- LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms (durcissement)
- Mobile-first indexing intégral

**Implication :** notre PSI Mobile = 85, LCP = 4.2s ⚠️. Avant fin août, fix LCP mobile (207 Kio JS unused + 520ms CSS bloquant).

> **Marc D. :** "On a 4 mois. C'est faisable mais ça doit être prio Q3."

### Bing / Copilot 2026 — règles à respecter

> **Pierre B. :** "Bing utilise plus le schema structuré que Google. On a un avantage : on a déjà tous les Schemas en place."

- Bing favorise sites avec **données structurées riches**
- Bing donne plus de poids aux **citations cohérentes** (NAP)
- Bing reconnaît bien les marques nichées (on est 10/10 top sur "klik&go boucherie")
- **AI Performance Dashboard** lancé en février 2026 → tracker citations Copilot/ChatGPT Search

**Décision #2 :** activer le **AI Performance Dashboard** dans Bing Webmaster Tools dès cette semaine pour tracker les citations dans Microsoft Copilot.

### Moteurs IA 2026 (GEO/AIO) — règles à respecter

> **Ahmed F. (GEO/AIO) :** "Les LLMs ont 3 critères de citation. On est en avance mais pas optimal."

#### 1. Données structurées impeccables
- ChatGPT/Gemini parsent JSON-LD pour comprendre les entités
- ✅ On a Organization + Store + FAQ + Breadcrumb + Product

#### 2. Contenu factuel et structuré
- Les LLMs citent le contenu CLAIR, FACTUEL, organisé en H2/H3
- ⚠️ Notre contenu pages ville est OK mais manque de TLDR parsable

> **Décision #3 (Ahmed) :** chaque page doit commencer par une section "TLDR" de 3 phrases répondant à la question principale. Format markdown-like en HTML, parsable par GPTBot/ClaudeBot.
>
> Exemple sur `/boucherie-halal/lyon` :
> ```html
> <section class="tldr" data-purpose="ai-summary">
>   <p><strong>En bref :</strong> Klik&Go référence X boucheries halal certifiées à Lyon avec click & collect. Commandez en ligne, payez 0,99€ de frais de service, retirez en boutique au créneau choisi. Disponible dans tous les quartiers de Lyon : Guillotière, Vaise, Croix-Rousse, Gerland, Part-Dieu.</p>
> </section>
> ```

#### 3. Expertise démontrée + freshness
- ✅ On a déjà LastUpdated component
- ⚠️ Bumper dates au moins 1×/mois sur pages stratégiques

#### 4. NAP cohérent partout
- LLMs croisent les sources pour valider les données
- ⚠️ On doit auditer cohérence : nom boucher / adresse / téléphone IDENTIQUES sur Klik&Go + GBP + Pages Jaunes + Yelp

> **Yasmine T. (Local SEO) :** "Je gère ça. Audit NAP cette semaine pour les 11 boucheries partenaires."

---

## 3. Architecture pages — validation (15 min — Marc D. + Claire L.)

### Templates à créer

| Template | Pages générées | Validation Algo |
|---|---|---|
| `/boucherie-halal/[ville]` | 30 (déjà 12, +18) | ✅ E-E-A-T fort si contenu local enrichi |
| `/boucherie-halal/[ville]/[quartier]` | ~25 | ✅ Helpful Content si ≥250 mots unique |
| `/boucheries-halal/[ville]/[boucher-slug]` | ~50 (annuaire complet) | ✅ Annuaire utilisateur, gain trust |
| `/produits/[produit]/[ville]` | ~300 | ⚠️ RISK Mars 2026 update → uniqueness obligatoire |
| `/occasions/[occasion]/[ville]` | ~180 | ✅ Saisonnier + Schema Event |
| `/recettes/[slug]` | ~30 | ✅ Recipe schema = rich snippet |
| `/boucheries-halal-ouvertes-dimanche/[ville]` | 10 | ✅ Filtre dynamique = utilité réelle |
| `/trouver-boucherie-halal` | 1 (geolocator) | ✅ |
| `/guide/[topic]` | ~10 | ✅ Pillar pages E-E-A-T |
| Articles blog | ~30 | ✅ |

> **Sarah K. :** "Total : 545+ pages. C'est ambitieux mais faisable. **Décision #4 : on échelonne en 4 batches sur 6 mois.** Pas tout d'un coup pour éviter le crawl budget overload."

#### Roadmap batches
- **Batch 1 (semaine 1-2)** : 18 villes manquantes + page geolocator + scraping annuaire
- **Batch 2 (semaine 3-6)** : Aïd al-Adha 30 villes + Méchoui 30 villes (URGENT saison)
- **Batch 3 (semaine 7-12)** : Produits×villes (top 5 produits × 6 villes principales = 30)
- **Batch 4 (semaine 13-26)** : Quartiers, recettes, guides, blog

> **Décision #5 :** **Sprint Aïd al-Adha = priorité absolue P0+**. Indexation avant 15 mai 2026 (Aïd 2026 = juin).

---

## 4. Schema.org — décisions techniques (10 min — Marc D.)

### Mapping schemas par template

| Template | Schemas obligatoires | Optionnels |
|---|---|---|
| `/boucherie-halal/[ville]` | `BreadcrumbList`, `FAQPage`, `ItemList` of `LocalBusiness` | `WebPage`, `CollectionPage` |
| `/boucheries-halal/[ville]/[boucher]` | `LocalBusiness`/`FoodEstablishment`, `BreadcrumbList`, `AggregateRating` | `Review`, `Menu`, `OfferCatalog` |
| `/produits/[produit]/[ville]` | `Product`, `Offer`, `BreadcrumbList`, `ItemList` | `Brand`, `AggregateRating` |
| `/occasions/[occasion]/[ville]` | `Event`, `BreadcrumbList`, `FAQPage`, `ItemList` of `Offer` | `Place`, `Organization` |
| `/recettes/[slug]` | `Recipe`, `BreadcrumbList`, `HowTo` | `NutritionInformation`, `VideoObject` |

> **Décision #6 :** prioriser `Recipe` schema sur le hub recettes — **aucun concurrent halal ne l'utilise**, gain rich snippet immédiat (étoiles, temps cuisson, calories visible dans SERP).

> **Décision #7 :** sur pages annuaire ville, utiliser `ItemList` of `LocalBusiness` (chaque boucherie = un LocalBusiness individuel avec adresse/horaires/avis). C'est ce que Google attend pour une page d'annuaire légitime.

---

## 5. SEO Local : Pack Local Google + GBP (15 min — Yasmine T.)

> **Yasmine T. :** "On a un problème : Klik&Go = marketplace, pas de local physique. On peut PAS avoir une fiche Google Business Profile classique. Mais on peut quand même apparaître dans le Pack Local."

### Stratégie Pack Local sans local physique

#### Option A — Service Area Business
- Créer un GBP en "Service area business" (sans adresse publique)
- Définir zone de service : Rhône-Alpes
- ⚠️ Catégorie limitée : "Service de retrait alimentaire" ou "Marketplace"
- Apparition limitée dans Pack Local (Google préfère businesses physiques)

#### Option B — Stratégie indirecte (RECOMMANDÉE)
- Faire en sorte que CHAQUE boucherie partenaire ait son GBP optimisé avec **lien vers sa page Klik&Go** dans la section "Services" / "Site web complémentaire"
- Klik&Go apparaît dans les recherches via les fiches partenaires (effet de halo)
- Bonus : reviews Google des partenaires renforcent l'écosystème

> **Décision #8 :** Yasmine optimise les 11 GBP des bouchers partenaires cette semaine. NAP harmonisé, photos, attribut "Click and collect" activé, lien web vers `/boutique/[slug]`.

### Citations & annuaires
- ✅ Pages Jaunes / Solocal : à créer pour Klik&Go
- ✅ Yelp France : créer fiche
- ✅ Zabihah.com : annuaire halal international
- ✅ JustEatNow / Mappy : créer fiches
- ✅ Bing Places : créer fiche (gratuit)

> **Décision #9 :** Karim (outreach) crée 8 citations annuaires cette semaine avec NAP cohérent.

---

## 6. Link Building (10 min — David P.)

> **David P. :** "Domain Authority de Klik&Go = 0 (site jeune 3 mois). Les concurrents annuaires (Pages Jaunes DR 90+) sont impossibles à dépasser sans backlinks."

### Stratégie acquisition liens

#### Cible Q2 2026 : 30 backlinks DR 30+
- **Partenariats locaux** : boucheries partenaires linkent depuis leur site web (si existant) → 11 liens contextuels DR 10-30
- **Annuaires niche** : 8 annuaires halal/locaux → DR 20-50
- **PR locale** : 5 articles dans Le Dauphiné / Le Progrès / Lyon Mag (sujet "marketplace halal Rhône-Alpes lance") → DR 50-70
- **Guest posts** : 3 articles dans blogs cuisine halal (Amour de Cuisine, Mes Inspirations Culinaires, Cuisine de Mounia) → DR 30-50
- **Communauté** : présence Reddit r/france, r/halal, forums étudiants Lyon/Grenoble → liens éparpillés mais utiles

> **Décision #10 :** Sophia (outreach) lance la campagne PR locale Aïd al-Adha en mai 2026 (timing parfait).

> **Décision #11 :** chaque boucherie partenaire reçoit un kit "Boostez votre SEO" : badge à mettre sur leur site avec lien Klik&Go + texte pré-écrit.

---

## 7. Content : production (15 min — Claire L.)

> **Claire L. :** "On a besoin de 580 pages programmatiques + 30 articles éditoriaux. Sans rédacteurs externes, on doit industrialiser intelligemment."

### Workflow proposé

#### Pages programmatiques (templates avec parties uniques)
1. **Section générique** : 50-100 mots boilerplate (réutilisable)
2. **Section ville/produit unique** : 100-150 mots dynamiques générés à partir de la DB
3. **Section locale** : 100 mots tirés de `cities.ts:localContext` ou enrichis si manque

> **Décision #12 :** étendre `cities.ts` avec un champ `productSpecialty: Record<string, string>` qui contient un texte unique par produit×ville. Ex : `{ merguez: "À Lyon, la merguez est traditionnellement préparée avec un mélange agneau/bœuf et un dosage de harissa typique du sud-méditerranéen..." }`. C'est tedieux (300 textes à écrire) mais c'est la condition pour ne PAS être pénalisé par Mars 2026 update.

#### Articles blog (30 articles — production sur 6 mois)
- Wassim et Camille produisent 1 article/semaine = 26 articles en 6 mois
- Chaque article ≥ 1500 mots, FAQ schema, photos étape par étape, CTA "Commander la viande" → boucher Klik&Go
- Priorité : articles cuisson + occasion (Aïd al-Adha 2026 d'abord)

> **Décision #13 :** lancer 3 articles "Aïd 2026" la semaine prochaine : "Comment réserver son mouton Aïd al-Adha 2026", "Quelle quantité de viande pour la fête de l'Aïd", "Où acheter mouton Aïd halal en Rhône-Alpes". Indexation avant juin = critique.

---

## 8. GEO/AIO — visibilité IA (10 min — Ahmed F.)

> **Ahmed F. :** "L'IA prend 30%+ des requêtes en 2026. Si on est invisible chez ChatGPT/Claude/Perplexity, on perd 30% du marché malgré le SEO classique."

### Actions GEO/AIO (visibilité dans les LLMs)

#### 1. `llms.txt` — déjà créé ✅
- Contient description structurée Klik&Go
- Bumper `lastModified` à chaque grosse update (cette semaine après les changements)

#### 2. AI crawlers — déjà autorisés ✅
- GPTBot, ChatGPT-User, ClaudeBot, anthropic-ai, Google-Extended, PerplexityBot, etc.

#### 3. Section TLDR sur chaque page (à faire)
- 3 phrases parsables au début de chaque page (Décision #3)

#### 4. Donner du JSON-LD WebPage avec property `description` ultra-claire
- ChatGPT cite la `description` du WebPage schema en priorité
- Format : "Klik&Go est l'annuaire des boucheries halal certifiées de [VILLE]. Commandez en ligne, retirez en boutique. X boucheries partenaires, Y produits halal disponibles."

> **Décision #14 :** Ahmed implémente schema WebPage enrichi sur toutes les pages ville avec description optimisée pour citation IA.

#### 5. Test mensuel : "Quelle est la meilleure boucherie halal à Lyon ?" sur ChatGPT/Claude/Perplexity
- Aujourd'hui : Klik&Go n'est pas cité
- Cible Q4 2026 : citation top 3 sur 50% des requêtes pertinentes

> **Décision #15 :** Ahmed monte un dashboard de tracking citations IA, test 50 requêtes/mois sur 4 LLMs.

#### 6. Markdown clean dans le HTML
- Les LLMs préfèrent les pages avec structure HTML sémantique propre
- ✅ Notre Next.js 14 produit du SSR clean
- ⚠️ Vérifier que toutes les pages compilent correctement le `<article>` avec `<h1>`, `<h2>`, `<h3>` hiérarchisés

---

## 9. Mesure & KPIs (5 min — Pierre B.)

### Dashboard Klik&Go SEO (à créer dans GSC + GA4 + Bing)

| KPI | Source | Fréquence |
|---|---|---|
| Pages indexées GSC | GSC Coverage | Hebdo |
| Impressions / clics | GSC Performance | Hebdo |
| Position moyenne par batch | GSC | Mensuel |
| CTR par page-type | GSC | Mensuel |
| Conversions (commandes) par page | GA4 + DB Klik&Go | Hebdo |
| Citations IA | Test manuel + dashboard custom | Mensuel |
| Pack Local Google | SERP scraping mensuel | Mensuel |
| Bing impressions/clics | Bing WMT | Hebdo |
| Backlinks acquis | Ahrefs free / Semrush trial | Mensuel |
| Reviews Google des bouchers | API GBP | Hebdo |

> **Décision #16 :** Pierre setup le dashboard cette semaine, alertes Slack si chute > 20% MoM.

---

## 10. Risques & mitigation (5 min — Sarah K.)

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Mars 2026 update pénalise pages thin programmatiques | **HAUTE** | Critique | Décision #1 — uniqueness obligatoire |
| Aïd al-Adha 2026 pages non indexées à temps | MOYENNE | Critique | Décision #5 — sprint dédié + IndexNow + ping GSC manuel |
| Bouchers partenaires refusent l'optim GBP | FAIBLE | Moyen | Communication + kit clés en main |
| LCP mobile fail Septembre 2026 update | MOYENNE | Important | Sprint perf Q3 2026 |
| Pages Jaunes / Mappy gardent leur dominance locale | HAUTE | Important | Stratégie annuaire complet (lister TOUTES les boucheries halal) + reviews fraîches + UX supérieure |
| Annuaire concurrent (Yelp, Pages Jaunes) DMCA si on scrape leurs avis | FAIBLE | Critique | Utiliser Google Places API officielle uniquement |

> **Décision #17 :** politique stricte d'utilisation API officielle Google Places pour reviews / scraping data publique. Pas de scraping Pages Jaunes / Yelp directement.

---

## 11. Plan d'action priorisé (10 min — Sarah K.)

### SPRINT 1 — Semaine 1-2 (5-15 mai 2026) — DÉFENSIF + AÏD ANTICIPATION

| Action | Owner | Estimation |
|---|---|---|
| Étendre `cities.ts` avec 18 villes + 25 quartiers | Théo | 2j |
| Implémenter scraping annuaire complet (toutes boucheries halal de chaque ville via Google Places API) | Théo | 3j |
| Créer template `/boucheries-halal/[ville]/[boucher-slug]` (fiche annuaire) | Théo + Marc | 2j |
| Créer page `/trouver-boucherie-halal` (geolocator) | Théo | 1j |
| Créer template `/occasions/aid-al-adha/[ville]` × 30 villes (sprint Aïd) | Théo + Wassim | 4j |
| Optimiser GBP des 11 boucheries partenaires (NAP, photos, lien, attribut C&C) | Yasmine + Mehdi | 3j |
| Lancer 3 articles "Aïd 2026" (mouton, quantité, où acheter) | Wassim + Camille | 3j |
| Setup dashboard Bing AI Performance | Pierre | 1j |
| Setup tracking citations IA | Ahmed | 1j |

### SPRINT 2 — Semaine 3-6 (16 mai - 12 juin 2026) — INDEXATION AÏD + MÉCHOUI

| Action | Owner | Estimation |
|---|---|---|
| Demander indexation manuelle GSC pour 30 pages Aïd | Pierre | 1j |
| Pinger IndexNow sur tout le batch Aïd | Théo | 0.5j |
| Créer template `/occasions/mechoui/[ville]` × 30 villes | Théo + Wassim | 3j |
| Section TLDR (Décision #3) sur toutes pages ville + occasion | Théo | 2j |
| Schema WebPage description IA (Décision #14) | Marc | 1j |
| Production : 4 articles méchoui (calculatrice, recette, prix, comment réserver) | Camille | 4j |
| 8 citations annuaires (PJ, Yelp, Mappy, Bing Places, Zabihah, etc.) | Karim + Sophia | 5j |
| Outreach PR locale (5 médias Rhône-Alpes) | Sophia | 5j |

### SPRINT 3 — Semaine 7-12 (juillet 2026) — PRODUITS × VILLES

| Action | Owner | Estimation |
|---|---|---|
| Étendre `cities.ts` avec `productSpecialty` (Décision #12) — 300 textes | Wassim + Camille | 6 semaines (rythme 50/sem) |
| Créer template `/produits/[produit]/[ville]` × 300 pages SSG | Théo + Marc | 5j |
| Créer 25 pages quartier `/boucherie-halal/[ville]/[quartier]` | Théo | 3j |
| Lancer hub `/recettes` avec 10 premiers articles + Recipe schema | Wassim + Camille | 4 semaines |
| Backlinks : 11 partenaires + 5 PR + 3 guest posts | David | 6 semaines |

### SPRINT 4 — Semaine 13-26 (août-novembre 2026) — CONTENT + RAMADAN

| Action | Owner | Estimation |
|---|---|---|
| Hub recettes 30 articles complets | Wassim + Camille | 8 semaines |
| Hub guides E-E-A-T (10 pages) | Claire | 4 semaines |
| Création template `/occasions/ramadan/[ville]` × 30 villes (anticipation Ramadan 2027) | Théo + Wassim | 3j |
| Pages quartier batch 2 (15 pages restantes) | Théo | 3j |
| Fix LCP mobile (sprint perf) | Théo + Marc | 2 semaines |
| Backlinks batch 2 (15 backlinks supplémentaires) | David | 12 semaines |

---

## 12. Décisions consolidées (récap)

| # | Décision | Owner | Deadline |
|---|---|---|---|
| 1 | Uniqueness 250 mots min par page programmatique | Sarah | Permanente |
| 2 | Activer Bing AI Performance Dashboard | Pierre | S1 |
| 3 | Section TLDR 3 phrases sur chaque page | Théo + Ahmed | S1-S2 |
| 4 | 4 batches de pages sur 6 mois | Sarah | Roadmap |
| 5 | Sprint Aïd al-Adha = P0+ | Toute l'équipe | 15 mai |
| 6 | Recipe schema sur recettes | Marc | S3 |
| 7 | ItemList of LocalBusiness sur annuaires | Marc | S1 |
| 8 | GBP optimization 11 partenaires | Yasmine | S1 |
| 9 | 8 citations annuaires créées | Karim | S1 |
| 10 | Campagne PR locale Aïd | Sophia | mai 2026 |
| 11 | Kit "Boostez votre SEO" pour partenaires | Yasmine | S2 |
| 12 | Champ `productSpecialty` dans cities.ts | Claire | S3-S8 |
| 13 | 3 articles Aïd 2026 lancés S1 | Wassim | S1 |
| 14 | Schema WebPage description optimisée IA | Ahmed | S2 |
| 15 | Dashboard tracking citations IA | Ahmed | S2 |
| 16 | Dashboard SEO consolidé GSC+GA4+Bing | Pierre | S1 |
| 17 | Politique : Google Places API officielle uniquement | Sarah | Permanente |
| 18 | Lister TOUTES les boucheries halal (partenaires + non) sur pages ville | Théo | S1 |
| 19 | Pages quartier prioritaires : Lyon Guillotière + Vénissieux Minguettes + Villeurbanne Gratte-Ciel | Théo | S1 |
| 20 | Page geolocator `/trouver-boucherie-halal` | Théo | S1 |
| 21 | Filtre "ouverte dimanche" + page dédiée par ville | Théo | S2 |
| 22 | Sprint perf LCP mobile avant septembre 2026 | Théo + Marc | Q3 |
| 23 | Article "merguez airfryer" (zero-comp, easy win) | Wassim | S1 |

---

## 13. Conclusion (Sarah K., Head of SEO)

> "On a une opportunité énorme : le marché halal en ligne est techniquement faible (concurrents sans schema, sans pages quartier, sans hub occasions). Klik&Go a déjà l'avantage tech (JSON-LD, IndexNow, llms.txt, AI crawlers).
>
> Avec ce plan, on peut devenir **l'annuaire de référence des boucheries halal en Rhône-Alpes** en 6 mois. Le pivot d'angle (passer de 'marketplace click&collect' à 'annuaire local + commande facilitée') est crucial — on attaque la même intention search que Pages Jaunes mais avec un service supplémentaire (commander).
>
> Risques principaux : (a) Aïd 2026 trop court pour indexer = on prend le risque, on PUSH MAINTENANT. (b) Mars 2026 update sur thin content = uniqueness obligatoire sur les 580 pages programmatiques (Décision #1, gros effort éditorial).
>
> KPIs cibles confiance : ✅ 150 pages indexées en 6 mois, ✅ 5000 impressions/mois Q4 2026, ✅ position moyenne 5, ✅ top 3 sur 50 keywords.
>
> Prochain check : sprint review S2, puis revue mensuelle les 1er du mois."

---

**Fin de réunion. 23 décisions actées. Sprint 1 démarre lundi 5 mai 2026.**
