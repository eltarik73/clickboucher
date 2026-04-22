# Etude de Marche — Klik&Go
## Plateforme Click & Collect pour Boucheries Halal

*Date : Fevrier 2026*

---

## Table des matieres

1. [Resume executif](#1-resume-executif)
2. [Audit produit — Etat actuel](#2-audit-produit)
3. [Analyse du marche](#3-analyse-du-marche)
4. [Paysage concurrentiel](#4-paysage-concurrentiel)
5. [Analyse SWOT](#5-analyse-swot)
6. [Cible et personas](#6-cible-et-personas)
7. [Modele economique recommande](#7-modele-economique-recommande)
8. [Feuille de route vers la commercialisation](#8-feuille-de-route)
9. [Estimation budgetaire](#9-estimation-budgetaire)
10. [Strategie Go-to-Market](#10-strategie-go-to-market)
11. [KPIs de lancement](#11-kpis-de-lancement)
12. [Conclusion](#12-conclusion)

---

<a name="1-resume-executif"></a>
## 1. Resume executif

**Klik&Go** est une plateforme Click & Collect de type marketplace connectant les consommateurs de viande halal aux boucheries de proximite. Le MVP est fonctionnel a ~75%, construit sur une stack moderne (Next.js 14, PostgreSQL, Clerk, Claude AI).

**L'opportunite** : Le marche de la viande halal en France pese **~3 milliards EUR** (CAGR 6,1%). 10 millions de consommateurs reguliers, dont 65% n'achetent QUE du halal. Le click-and-collect alimentaire est adopte par 41% des Francais. Pourtant, **aucune plateforme ne federe les boucheries halal** dans un marketplace unifie — les concurrents sont soit des sites e-commerce mono-boutique, soit des plateformes generalistes (Uber Eats) avec des commissions ecrasantes (25-35%).

**Le verdict** : Klik&Go occupe un **positionnement unique de premier entrant** sur le creneau "marketplace C&C boucheries halal". Pour etre commercialisable, il faut combler 5 lacunes critiques : paiement en ligne, notifications SMS, conformite legale, onboarding bouchers, et scalabilite technique.

---

<a name="2-audit-produit"></a>
## 2. Audit produit — Etat actuel

### 2.1 Ce qui fonctionne (Acquis solides)

| Fonctionnalite | Statut | Detail |
|---|---|---|
| Parcours client complet | OK | Decouverte → Boutique → Panier → Commande → Suivi → Notation |
| Dashboard boucher | OK | Commandes en temps reel, gestion catalogue, parametres boutique |
| Dashboard admin | OK | KPIs, gestion users/shops, moderation |
| Chat IA (Claude) | OK | Recherche produit conversationnelle, ajout panier automatique |
| Systeme de favoris | OK | Ajout/retrait boutiques favorites |
| QR Code retrait | OK | Generation + scan a la remise |
| Gestion stock | OK | Ruptures, alternatives, grammage variable |
| Notifications email | OK | Via Resend (commande, acceptation, refus, pret) |
| PWA | OK | Manifest, splash screen, mobile-first |
| SEO | OK | Sitemap dynamique, metadata Open Graph, SSR |
| Dark mode | OK | Toggle clair/sombre, palette coherente |
| Auth robuste | OK | Clerk + RBAC base de donnees (5 roles) |
| Comptes PRO (B2B) | Partiel | Tarifs PRO fonctionnels, workflow d'inscription a finaliser |

### 2.2 Ce qui manque (Bloquants commercialisation)

| Lacune | Severite | Impact |
|---|---|---|
| **Paiement en ligne** | CRITIQUE | Pas de Stripe/autre. "Cash only". Impossible de lancer sans. |
| **SMS / WhatsApp** | HAUTE | Stubs Twilio. Le boucher ne recoit qu'un email — insuffisant pour le temps reel. |
| **CGV / Mentions legales** | HAUTE | Aucune page legale. Obligation RGPD, CGV, CGU pour operer. |
| **Certification halal affichee** | MOYENNE | Pas de champ "certification" dans le modele Shop. Facteur de confiance #1. |
| **Offres derniere minute** | MOYENNE | Page /bons-plans avec donnees fictives. Backend non implemente. |
| **Cron jobs** | MOYENNE | Pas d'expiration automatique des commandes, pas de rappels. |
| **OTP telephone** | BASSE | Verification telephone non implementee (stub). |
| **Analytics boucher** | BASSE | Dashboard basique. Pas de graphiques de ventes detailles. |

### 2.3 Stack technique

| Couche | Technologie |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS, shadcn/ui |
| Backend | API Routes Next.js, Prisma ORM |
| Base de donnees | PostgreSQL (Railway) |
| Auth | Clerk (OAuth, email) |
| IA | Anthropic Claude Haiku |
| Email | Resend |
| Hebergement | Railway (full stack) |
| Validation | Zod, TypeScript strict |

**Verdict technique** : Stack solide et moderne, bien architecturee. Scalable horizontalement via Railway. Le passage en production necessite principalement des integrations (paiement, SMS) plutot qu'une refonte.

---

<a name="3-analyse-du-marche"></a>
## 3. Analyse du marche

### 3.1 Taille du marche

| Indicateur | Valeur | Source |
|---|---|---|
| Marche halal total France | 6-7 milliards EUR/an | Toute la Franchise |
| Viande halal specifiquement | **~3 milliards EUR** (2024) | Straits Research |
| Projection 2027 | 3,6 milliards EUR | Straits Research |
| Croissance annuelle (CAGR) | **6,1%** | Straits Research |
| Halal en grande distribution | 524 M EUR (+14,7% en 2025) | Al-Kanz |
| Boucheries halal en France | **2 000 a 3 000** dont ~700 a Paris | Businesscoot |
| Boucheries-charcuteries total | 18 077 (2025, +10% depuis 2020) | CGAD |

### 3.2 Comportement consommateur

| Fait cle | Donnee |
|---|---|
| Musulmans n'achetant QUE du halal | **65%** |
| Foyers achetant regulierement du halal | **12 millions** (42% de penetration) |
| Consommateurs non-musulmans de halal | **3 millions** (attires par qualite/tracabilite) |
| Part du budget alimentaire (musulmans) | **30%** (vs 14% moyenne nationale) |
| Panier moyen boucherie C&C | **40 EUR** (vs 25 EUR pre-COVID) |

### 3.3 Click & Collect alimentaire en France

| Indicateur | Valeur |
|---|---|
| Francais utilisant le C&C alimentaire | **41%** |
| Chiffre d'affaires Drive (2025) | **11 milliards EUR** (+6%) |
| Croissance modeles hybrides (C&C + livraison) | **+28%** (2022-2024) |
| Part du e-commerce alimentaire | **13,3%** des PGC (France #2 en Europe) |
| Projection FoodTech France 2030 | **18,5 milliards EUR** |

### 3.4 Tendances favorables

1. **Renaissance du commerce de proximite** : +5,2% en 2025, les consommateurs privilegient le local
2. **Habitudes post-COVID ancrees** : Le C&C alimentaire est devenu un reflexe permanent
3. **IA et optimisation operationnelle** : L'IA dans le food ordering accelere (Klik&Go a deja un avantage ici)
4. **Boucherie artisanale en croissance** : Le metier attire de jeunes entrepreneurs (+10% de boutiques en 5 ans)
5. **Digitalisation des commerces de bouche** : Le CGAD encourage activement le click-and-collect

### 3.5 Marche adressable (TAM / SAM / SOM)

```
TAM (Total Addressable Market)
= Marche viande halal France
= 3 milliards EUR

SAM (Serviceable Addressable Market)
= Boucheries halal en zones urbaines avec potentiel C&C
= ~1 500 boutiques × panier moyen 40 EUR × 15 commandes/jour × 300 jours
= ~270 millions EUR de GMV potentielle

SOM (Serviceable Obtainable Market) — Annee 1
= 30 boucheries × 10 commandes/jour × 40 EUR × 300 jours
= 3,6 millions EUR de GMV
= A 8% de commission → 288 000 EUR de CA plateforme
```

---

<a name="4-paysage-concurrentiel"></a>
## 4. Paysage concurrentiel

### 4.1 Concurrents directs — Plateformes halal en ligne

| Plateforme | Modele | Zone | Limites |
|---|---|---|---|
| Le Garcon Boucher | E-commerce mono-enseigne | National (5 pts de vente) | Pas un marketplace, une seule marque |
| Halal chez vous | Multi-boucher C&C | Annemasse | Tres local, pas scalable |
| Les Comptoirs Halal | E-commerce + C&C | Saint-Etienne | Mono-boutique |
| Hal'Butche | "Hal'Drive" C&C | Saint-Etienne | Concept interessant, execution locale |
| Halalcourses | Livraison epicerie + viande | IDF | Epicerie generaliste, pas specialise boucher |
| Mahalle | E-commerce halal | National | Charcuterie online, pas de C&C local |

**Constat critique** : Tous les concurrents directs sont soit des **sites mono-boutique**, soit des **services locaux non scalables**. Il n'existe **aucun marketplace aggregateur** de boucheries halal a l'echelle nationale.

### 4.2 Concurrents indirects

| Plateforme | Commission | Probleme pour les bouchers |
|---|---|---|
| Uber Eats | 25-35% | Commissions insoutenables, pas d'achat au poids |
| Deliveroo | 20-30% | Meme probleme, UX non adaptee a la boucherie |
| Epicery | ~15% | Generaliste, pas de specialisation halal |
| Pourdebon | Marketplace | Positionne premium/artisanal, pas halal |

### 4.3 Positionnement differenciant de Klik&Go

```
                    Specialise halal
                         ^
                         |
     Klik&Go ★           |          (vide)
     Marketplace         |
     Multi-boucher       |
     Commission basse    |
                         |
  ←————————————————————————————————————→
  Mono-boutique                    Marketplace
                         |
     Halal chez vous     |     Uber Eats / Deliveroo
     Les Comptoirs       |     Commission 25-35%
     Hal'Butche          |     Non specialise
                         |
                         v
                    Generaliste
```

**Klik&Go est le seul acteur dans le quadrant superieur droit** : marketplace multi-boucher specialise halal. C'est un avantage de premier entrant significatif.

---

<a name="5-analyse-swot"></a>
## 5. Analyse SWOT

### Forces
- **Premier marketplace halal C&C en France** — positionnement unique
- **MVP fonctionnel a 75%** — flux commande complet, dashboard boucher, admin
- **Chat IA integre** — differenciateur fort (aucun concurrent n'a ca)
- **Stack moderne et scalable** — Next.js/Railway permet une montee en charge progressive
- **UX soignee** — dark mode, PWA, responsive, design premium
- **Cout de developpement faible** — un seul dev, pas de dette technique massive

### Faiblesses
- **Pas de paiement en ligne** — bloquant #1 pour la commercialisation
- **Pas de notifications temps reel** (SMS/push) — critique pour les bouchers
- **Zero utilisateurs reels** — aucune validation marche concrete
- **Equipe de 1 personne** — limite la capacite d'execution
- **Localise Chambery** — marche test tres petit (population musulmane limitee)
- **Pas de conformite legale** — CGV, RGPD, mentions legales absentes

### Opportunites
- **Marche de 3 Mds EUR en croissance de 6%/an** — vent favorable structurel
- **Aucun marketplace concurrent** — blue ocean pour le premier entrant
- **Bouchers en quete de digitalisation** — CGAD encourage le C&C activement
- **Post-COVID** — habitudes C&C ancrees, 41% d'adoption
- **B2B (restaurateurs, traiteurs)** — segment pro a forte valeur (deja amorce)
- **Ramadan** — pic saisonnier majeur (+50% de ventes halal) = moment de lancement ideal

### Menaces
- **Uber Eats / Deliveroo** — pourraient creer une verticale "boucherie" a tout moment
- **Resistance au digital des bouchers** — adoption lente, besoin de convaincre un par un
- **Fragmentation certification halal** — source de debats communautaires (AVS vs Mosquee de Paris)
- **Reglementation** — le cadre legal de l'intermediation alimentaire pourrait se durcir
- **Concurrent bien finance** — un acteur avec du capital pourrait copier et executer plus vite

---

<a name="6-cible-et-personas"></a>
## 6. Cible et personas

### Persona 1 — Consommateur principal : "Samira, 28 ans"

| Attribut | Detail |
|---|---|
| Profil | Jeune active, urbaine, couple sans enfants |
| Budget alimentaire | ~240 EUR/mois |
| Comportement | Commande deja sur Uber Eats, fait ses courses en supermarche, achete la viande chez le boucher halal du quartier |
| Frustration | File d'attente le samedi, pas de visibilite sur les horaires, doit se deplacer pour rien si rupture |
| Attente | Commander depuis son telephone, retirer en 20 min, payer en ligne |
| Frequence cible | 2-3 commandes/mois, panier moyen 35 EUR |

### Persona 2 — Famille : "Karim & Fatima, 42 ans"

| Attribut | Detail |
|---|---|
| Profil | Famille avec 3 enfants, banlieue, voiture |
| Budget alimentaire | ~400 EUR/mois dont ~120 EUR en viande |
| Comportement | Fideles a 1-2 boucheries, achat au poids, grosses quantites le week-end |
| Frustration | Temps d'attente en boutique, pas de commande a l'avance, difficulte a comparer les prix |
| Attente | Commander la veille, retirer le matin sans attendre, prix clairs, tracabilite |
| Frequence cible | 1-2 commandes/semaine, panier moyen 55 EUR |

### Persona 3 — Professionnel : "Mehdi, 35 ans, restaurateur"

| Attribut | Detail |
|---|---|
| Profil | Gerant d'un restaurant/snack halal, commande en gros |
| Budget viande | ~2 000 EUR/mois |
| Comportement | Commande par telephone, negocie les prix, livraison ou retrait |
| Frustration | Pas de visibilite sur les stocks, delais de confirmation, facturation papier |
| Attente | Compte PRO, tarifs dedies, historique de commandes, facturation |
| Frequence cible | 3-5 commandes/semaine, panier moyen 200 EUR |

### Persona 4 — Boucher partenaire : "Rachid, 45 ans"

| Attribut | Detail |
|---|---|
| Profil | Boucher independant, 1 boutique, 2 employes |
| CA annuel | ~300 000 EUR |
| Frustration | Concurrence des supermarches, difficulte a toucher les jeunes, pas de presence en ligne |
| Attente | Plus de clients sans investissement lourd, outil simple a utiliser, commission raisonnable |
| Sensibilite prix | Refuse Uber Eats a 30% de commission. Accepterait 5-10%. |

### Priorite geographique

| Priorite | Zone | Population musulmane | Boucheries halal |
|---|---|---|---|
| 1 | Ile-de-France | ~1,5 million | ~700 |
| 2 | Lyon metropole | ~250 000 | ~150 |
| 3 | Marseille / PACA | ~300 000 | ~200 |
| 4 | Chambery (test actuel) | ~5 000 | ~10 |

**Recommandation** : Chambery est trop petit comme marche de lancement. Le produit doit etre teste en IDF (Seine-Saint-Denis, Val-d'Oise) ou a Lyon pour avoir une masse critique.

---

<a name="7-modele-economique-recommande"></a>
## 7. Modele economique recommande

### 7.1 Revenus

| Source | Montant | Detail |
|---|---|---|
| **Commission par commande** | **8%** du montant HT | Competitif vs Uber Eats (30%). Le boucher garde 92%. |
| **Abonnement Premium boucher** | 49 EUR/mois (optionnel) | Mise en avant, analytics avances, badge "Premium" |
| **Frais de service client** | 0,99 EUR / commande | Facture au consommateur (comme Uber Eats) |
| **Publicite native** (Phase 2) | CPM / CPC | Mise en avant de produits dans le chat IA et la page decouvrir |

### 7.2 Projection financiere — Annee 1

| Hypothese | Valeur |
|---|---|
| Bouchers partenaires (fin A1) | 30 |
| Commandes/jour/boucher | 8 (moyenne) |
| Panier moyen | 40 EUR |
| Jours d'operation/an | 300 |

```
GMV annuelle = 30 × 8 × 40 × 300 = 2 880 000 EUR

Revenus :
- Commission 8%     = 230 400 EUR
- Frais service     =  71 280 EUR (0,99 × 72 000 commandes)
- Abonnements (10)  =   5 880 EUR
                      ─────────
Total CA Annee 1    ≈ 307 560 EUR
```

### 7.3 Couts estimes — Annee 1

| Poste | Mensuel | Annuel |
|---|---|---|
| Hebergement (Railway) | 100 EUR | 1 200 EUR |
| Clerk (auth) | 25 EUR | 300 EUR |
| Anthropic API (chat) | 100 EUR | 1 200 EUR |
| Resend (email) | 20 EUR | 240 EUR |
| Twilio (SMS) | 150 EUR | 1 800 EUR |
| Stripe (2,9% + 0,25 EUR/tx) | ~7 000 EUR | 84 000 EUR |
| Nom de domaine + divers | 20 EUR | 240 EUR |
| **Infra total** | | **~89 000 EUR** |
| Marketing digital | 1 500 EUR | 18 000 EUR |
| Juridique (CGV, RGPD, statuts) | — | 3 000 EUR |
| Comptabilite | 150 EUR | 1 800 EUR |
| **Total couts A1** | | **~112 000 EUR** |

```
Resultat net estime Annee 1 ≈ 307 560 - 112 000 = +195 560 EUR (marge ~64%)
```

> Note : Ce calcul suppose un fondateur non salarie. Avec un salaire fondateur (40 000 EUR) et un developpeur (45 000 EUR), le resultat serait ~110 000 EUR.

---

<a name="8-feuille-de-route"></a>
## 8. Feuille de route vers la commercialisation

### Phase 0 — Pre-requis legaux et techniques (4-6 semaines)

| Action | Priorite | Detail |
|---|---|---|
| Integration Stripe | CRITIQUE | Paiement par carte, Apple Pay, Google Pay. Stripe Connect pour verser aux bouchers. |
| Notifications SMS | CRITIQUE | Twilio : notification boucher sur nouvelle commande, notification client sur statut. |
| Pages legales | CRITIQUE | CGV, CGU, Mentions legales, Politique de confidentialite (RGPD). Faire valider par un avocat. |
| Champ certification halal | HAUTE | Ajouter `halalCert` (enum: AVS, MOSQUEE_PARIS, ARGML, AUTRE) au modele Shop. Afficher sur la fiche. |
| Cron jobs | HAUTE | Expiration commandes non acceptees (30 min), rappels de retrait, nettoyage. |
| Tests end-to-end | HAUTE | Playwright : flux complet commande → paiement → retrait. |
| Conditions boucher | HAUTE | Contrat type partenaire (commission, obligations, resiliation). |

### Phase 1 — Lancement beta (Mois 2-3)

| Action | Detail |
|---|---|
| Recruter 5-10 bouchers pilotes | Demarchage terrain en IDF (93, 95) ou Lyon. Offrir 3 mois sans commission. |
| Landing page d'acquisition | Page dediee boucher avec formulaire d'inscription, arguments cles. |
| Onboarding boucher automatise | Wizard : creer compte → ajouter boutique → importer catalogue → configurer horaires. |
| Notifications push (PWA) | Web Push API pour alerter les bouchers en temps reel. |
| Tableau de bord boucher enrichi | Graphiques de ventes, produits les plus vendus, heures de pointe. |

### Phase 2 — Croissance (Mois 4-8)

| Action | Detail |
|---|---|
| Programme de parrainage | Boucher parraine boucher = 1 mois gratuit. Client parraine client = 5 EUR de reduction. |
| Livraison (optionnelle) | Partenariat avec Stuart ou Coursier.fr pour la livraison dernier kilometre. |
| Offres derniere minute | Backend pour les fins de journee / produits a ecouler (anti-gaspi). |
| Application mobile native | React Native ou Expo wrapping pour iOS/Android (la PWA peut suffire en phase 1). |
| Multi-langue | Arabe, turc, anglais (communautes non francophones). |
| Programme fidelite | Points cumules → reductions. Engagement long terme. |

### Phase 3 — Scalabilite (Mois 9-12)

| Action | Detail |
|---|---|
| Expansion geographique | Lyon → Marseille → Toulouse → Strasbourg → Lille |
| API ouverte | Permettre aux bouchers d'integrer Klik&Go dans leur propre site. |
| Facturation PRO | Paiement a 30 jours, export comptable, SIRET valide. |
| Analytics avances (admin) | Revenue par ville, par boucher, cohortes, retention, LTV. |
| Certification qualite | Demarche pour un label "Boucherie Klik&Go Verifiee". |

---

<a name="9-estimation-budgetaire"></a>
## 9. Estimation budgetaire pour le lancement

### Scenario 1 — Bootstrap (fondateur solo)

| Poste | Cout |
|---|---|
| Developpement Phase 0 (6 semaines) | 0 EUR (fondateur) |
| Avocat (CGV, RGPD, contrat boucher) | 2 000 - 3 000 EUR |
| Stripe activation | 0 EUR (pas de frais fixes) |
| Twilio (credits initiaux) | 50 EUR |
| Marketing lancement (flyers, Facebook Ads) | 1 000 EUR |
| **Total lancement** | **~4 000 EUR** |

### Scenario 2 — Avec levee seed / pre-seed

| Poste | Budget 12 mois |
|---|---|
| Salaire fondateur | 36 000 EUR |
| Developpeur senior (freelance ou CDI) | 45 000 EUR |
| Commercial terrain (mi-temps) | 18 000 EUR |
| Marketing digital | 24 000 EUR |
| Juridique + comptabilite | 5 000 EUR |
| Infra technique | 12 000 EUR |
| **Total** | **~140 000 EUR** |

> Une levee pre-seed de 150 000 - 200 000 EUR permettrait 12-18 mois de piste avec une equipe de 3.

---

<a name="10-strategie-go-to-market"></a>
## 10. Strategie Go-to-Market

### 10.1 Acquisition bouchers (offre)

1. **Demarchage terrain** : Visiter les boucheries une par une. Montrer l'app sur tablette. Argument : "Vos clients commandent deja sur Uber Eats. Ici c'est 8% au lieu de 30%, et c'est concu pour la boucherie."
2. **3 mois sans commission** pour les early adopters : reduit le risque percu.
3. **Onboarding cle en main** : Importer le catalogue, prendre les photos, configurer ensemble en 1h sur place.
4. **Flyer/QR code pour la vitrine** : Chaque boucher recoit du materiel pour rediriger ses clients existants.

### 10.2 Acquisition clients (demande)

1. **Bouche a oreille via le boucher** : Le boucher dit a chaque client "Commandez a l'avance sur Klik&Go, evitez la file".
2. **QR code sur chaque sachet/ticket** : A chaque achat en boutique, un QR code pousse vers l'app.
3. **Facebook / Instagram Ads** : Ciblage geographique autour de chaque boucherie partenaire (rayon 5 km). Budget : 10-15 EUR/jour/boucher au lancement.
4. **TikTok / Reels** : Contenu video : "Commander sa viande en 30 secondes" — format viral.
5. **Partenariats mosquees** : Affichage / flyers dans les mosquees locales, surtout avant Ramadan.
6. **Ramadan = moment de lancement ideal** : Les ventes de viande halal explosent (+50%). Lancer la beta 2-3 semaines avant le Ramadan.

### 10.3 Calendrier de lancement suggere

```
Mars 2026    : Phase 0 complete (paiement, SMS, legal)
Avril 2026   : Demarchage terrain, recrutement 5-10 bouchers
Mai 2026     : Beta fermee avec clients invites
Juin 2026    : Lancement public (idealement caler sur un evenement communautaire)
              OU
Fevrier 2027 : Lancement 2-3 semaines avant Ramadan (pic maximal)
```

---

<a name="11-kpis-de-lancement"></a>
## 11. KPIs de lancement

### Mois 1-3 (Beta)

| KPI | Objectif |
|---|---|
| Bouchers actifs | 5-10 |
| Commandes/semaine | 50+ |
| Panier moyen | > 35 EUR |
| Taux de completion commande | > 80% |
| NPS client | > 40 |
| NPS boucher | > 30 |

### Mois 4-6 (Croissance)

| KPI | Objectif |
|---|---|
| Bouchers actifs | 15-25 |
| Commandes/semaine | 200+ |
| GMV mensuelle | > 40 000 EUR |
| Taux de reachat (M+1) | > 40% |
| CAC (cout acquisition client) | < 8 EUR |
| LTV client (12 mois) | > 150 EUR |

### Mois 7-12 (Scalabilite)

| KPI | Objectif |
|---|---|
| Bouchers actifs | 30-50 |
| Commandes/jour | 100+ |
| GMV mensuelle | > 120 000 EUR |
| CA plateforme mensuel | > 15 000 EUR |
| Marge nette | > 50% |

---

<a name="12-conclusion"></a>
## 12. Conclusion et recommandations

### Le marche existe et il est massif
3 milliards EUR de viande halal, 10 millions de consommateurs, 41% de C&C alimentaire. La demande est la.

### Le produit est prometteur mais incomplet
Le MVP Klik&Go est impressionnant pour un projet solo : flux complet, chat IA, multi-role, PWA. Mais il lui manque les fondamentaux commerciaux (paiement, legal, SMS).

### Le timing est ideal
Aucun marketplace concurrent, bouchers en quete de digitalisation, habitudes C&C ancrees post-COVID, IA comme differenciateur.

### Les 5 actions prioritaires

| # | Action | Delai | Cout |
|---|---|---|---|
| 1 | **Integrer Stripe Connect** (paiement en ligne + versement bouchers) | 2 semaines | 0 EUR (commission Stripe sur transactions) |
| 2 | **Integrer Twilio** (SMS boucher + client) | 1 semaine | ~50 EUR/mois |
| 3 | **Faire rediger CGV/CGU/RGPD** par un avocat | 2 semaines | 2 000 EUR |
| 4 | **Ajouter la certification halal** au profil boutique | 2 jours | 0 EUR |
| 5 | **Deplacer le marche test vers Lyon ou IDF** | Immediat | 0 EUR (100% digital) |

### Le choix strategique

Deux voies possibles :

**Option A — Bootstrap** : Completer les 5 actions, lancer en beta avec 5-10 bouchers en IDF ou Lyon, atteindre la rentabilite rapidement (possible avec ~300 EUR/mois de couts fixes + commissions Stripe). Croissance organique. Risque : un concurrent finance arrive avant vous.

**Option B — Lever des fonds** : Pre-seed de 150-200K EUR, recruter 1 dev + 1 commercial terrain, executer vite sur 2-3 villes, verrouiller le marche avant la concurrence. La proposition de valeur (marketplace halal C&C + IA) est "pitchable" aupres de VCs specialises food tech ou impact.

**Recommandation** : Commencer par l'option A pour valider le product-market fit avec de vrais bouchers et de vrais clients. Si les metriques (retention, NPS, GMV) sont bonnes apres 3 mois, lever pour accelerer.

---

*Rapport genere le 8 fevrier 2026.*
*Donnees marche : Straits Research, FEVAD, Al-Kanz, CGAD, Toute la Franchise, Businesscoot.*
