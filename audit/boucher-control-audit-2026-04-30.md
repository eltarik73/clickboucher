# Audit — Contrôle des bouchers et UX boucher

**Date** : 2026-04-30
**Audit par** : Claude (UX/product strategist)
**Cible** : Klik&Go marketplace click & collect halal — préparation recrutement 50 early adopters
**Périmètre** : `src/app/(boucher)/**`, `src/app/api/boucher/**`, `src/app/api/webmaster/**`, `prisma/schema.prisma`

---

## Section 1 — Ce qui existe aujourd'hui (inventaire concret)

### 1.1 Côté boucher — pages disponibles

| Page | Chemin | Capacités |
|---|---|---|
| Dashboard | `src/app/(boucher)/boucher/dashboard/page.tsx` | KPI temps réel (CA jour, commandes jour, en attente, note) + StatusBar Uber Eats (OPEN/BUSY/PAUSED/AUTO_PAUSED/CLOSED/VACATION) + onboarding checklist + SSE stream. |
| Mode Cuisine | `src/app/(boucher)/boucher/commandes/page.tsx` | 3 colonnes Nouvelles/En cours (split scheduled)/Prêtes + Histo bottom + polling 5s + sons + tickets thermiques. |
| Produits | `src/app/(boucher)/boucher/produits/page.tsx` | CRUD complet, drag & drop ordre, snooze, anti-gaspi, IA images (4 modales : search, generate, retouch, library). |
| Paramètres | `src/app/(boucher)/boucher/parametres/page.tsx` | Status, busy mode, pause, créneaux retrait, modes paiement, prep time, auto-accept, seuil ajustement prix, fidélité, infos boutique, géocodage Nominatim, rayon, notifications (son/flash/vibe). |
| Stripe Connect | `src/app/(boucher)/boucher/parametres/paiement/page.tsx` | Onboarding Stripe Express + statut (active/pending/restricted) + dashboard link + tier de commission Bronze/Silver/Gold/Platine. |
| Finances | `src/app/(boucher)/boucher/dashboard/finances/page.tsx` | Tier en cours, palier suivant, GMV/commission/stripe fee/payout du mois, daily chart, dernières commandes, lien dashboard Stripe. |
| Performance | `src/app/(boucher)/boucher/performance/page.tsx` | Score 0-100, taux d'acceptation, taux d'annulation, temps de réponse, prep moyen, taux de retard, note. Alertes severity warning/critical. |
| Anti-Gaspi | `src/app/(boucher)/boucher/dashboard/anti-gaspi/page.tsx` | Activation par produit avec discount %, stock limité, raison (DLC/surplus/dernier lot/fin journée). |
| Calendrier | `src/app/(boucher)/boucher/dashboard/calendrier/page.tsx` | Événements religieux Ramadan/Aïd 2025-2026 + alertes J-7/J-21 + suggestions produits. |
| Clients | `src/app/(boucher)/boucher/clients/page.tsx` | Liste clients (part./pro), demandes Pro pending, validation/refus, tri orderCount/totalSpent/lastOrder. |
| Stats | `src/app/(boucher)/boucher/dashboard/statistiques/page.tsx` | Recharts CA, panier moyen, top produits, top clients. Export CSV. |
| Export | `src/app/(boucher)/boucher/dashboard/export/page.tsx` | Export CSV commandes par période. |
| Parrainage | `src/app/(boucher)/boucher/dashboard/parrainage/page.tsx` | Code parrain `klikandgo.app/inscription-boucher?ref=` — 1 mois gratuit pour les 2. |
| Abonnement | `src/app/(boucher)/boucher/dashboard/abonnement/page.tsx` | Plans STARTER 49€/PRO 99€/PREMIUM 149€ avec upsell. |
| Support | `src/app/(boucher)/boucher/support/page.tsx` | Tickets support (modèle SupportTicket + SupportMessage). |
| Historique | `src/app/(boucher)/boucher/historique/page.tsx` | Liste commandes terminées, format Prénom.N. |

### 1.2 APIs boucher disponibles (`src/app/api/boucher/`)

`clients`, `referral`, `calendar`, `products` (+ `snooze-bulk` + `[id]/snooze`), `subscription`, `finances` (+ `export`), `service`, `anti-gaspi` (+ `[productId]`), `performance`, `stats`, `onboarding`, `images` (retouch/proxy/gallery/search/generate/enhance-prompt/import/[id]), `shop/status`, `dashboard/stats`, `orders/stream` (SSE) + `orders/pickup` + `orders/[orderId]/action`, `catalogue/[productId]`, `stripe/onboard` + `dashboard-link` + `refresh-status`.

### 1.3 Modèles Prisma — fondations existantes

- **Shop** (`schema.prisma:329`) : `validatedAt`, `suspendedAt`, `suspendReason`, `cachedAcceptanceRate`, `cachedAvgPrepMinutes`, `cachedCancelRate`, `cachedResponseMinutes`, `cachedLateRate`, `cachedAvgRating`, `performanceScore`, `metricsUpdatedAt`, `lastSeenAt`, `halalCertUrl`, `siret`, `legalName`, `vatRate`.
- **ShopMember** (`schema.prisma:513`) : table existante avec rôles `OWNER/MANAGER/STAFF` — non exposée dans l'UI.
- **ShopLog** (`schema.prisma:533`) : audit boutique-spécifique.
- **AuditLog** (`schema.prisma:1330`) : audit global webmaster (suspend/reactivate déjà loggué).
- **ShopAlert** (`schema.prisma:1445`) : alertes performance (warning/critical).
- **Review** (`schema.prisma:960`) : note + commentaire — **PAS de champ `reply` boucher**.
- **AdjustmentStatus** + **PriceAdjustment** : palier 1/2/3 fonctionnel.
- **Offer/OfferProposal/Campaign** : système marketing webmaster-driven.

### 1.4 Côté webmaster (`src/app/webmaster/`)

`/boutiques`, `/boutiques/[shopId]` (validation/suspension/commission/plan), `/performance` (scores tous shops), `/performance/[shopId]` (recalculate), `/audit` (AuditLog viewer), `/finances`, `/facturation`, `/marketing`, `/banners`, `/notifications`, `/reviews`, `/staff`, `/api-keys`, `/capacite`, `/catalogue`, `/catalogue/reference`, `/flags`, `/plans`, `/support`, `/demandes`, `/commandes`, `/stats`, `/analytics`, `/parametres`.

API admin shops : `[shopId]` GET/PATCH, `suspend`, `validate`, `commission`, `plan`, `adjustments`.

### 1.5 Stripe Connect

- Tier auto recalculé mensuellement via cron, GMV stocké `monthlyGmvCents`.
- `commissionMarkupPercent` 0/30/50/80/100 (recommandé 80) injecté dans le calculateur de prix d'affichage.
- `priceRoundingEnabled` arrondi psychologique.
- `earlyAdopterUntil` géré (2 pts de moins pendant 3 mois).
- `refundedPlatformFeeCents` correctement géré sur webhook `charge.refunded` (audit fix C3).

---

## Section 2 — 10 fonctionnalités CRITIQUES manquantes (contrôle Klik&Go)

Classement par impact (1 = priorité absolue avant les 50 onboardings).

### #1 — Onboarding KYC structuré + upload de documents légaux

**Manque** : aucune page d'inscription boucher avec parcours KYC. `halalCertUrl` est un simple champ texte sur le shop, pas de dépôt structuré. Pas de K-bis, RIB hors-Stripe, certificat halal, attestation hygiène, photo identité gérant, justificatif domicile pro.

**Risque** : non-conformité réglementaire (LCB-FT, lutte fraude marketplace), litige client si halal non vérifiable, pas de traçabilité contractuelle CGU. La CGU `legal/cgu-bouchers-partenaires.md:80` exige cumulativement RCS/RM, mais aucun dispositif technique ne le contrôle.

**Solution** : nouveau modèle `ShopDocument { id, shopId, type (KBIS|RIB|HALAL_CERT|HYGIENE|ID|DOMICILE|CGU_SIGNED), url, status (PENDING|APPROVED|REJECTED|EXPIRED), expiresAt, reviewedBy, reviewedAt, rejectReason }`, page `/inscription-boucher` multi-étapes, page `/webmaster/boutiques/[shopId]/documents` pour validation. Bloquer `validatedAt` tant que tous les obligatoires ne sont pas APPROVED.

---

### #2 — Système de sanctions 3-strike + auto-suspension

**Manque** : `suspend` API existe (`src/app/api/admin/shops/[shopId]/suspend/route.ts`) mais déclenchement 100 % manuel. Pas de seuil d'auto-suspension sur cancel rate, late rate, response time. `ShopAlert` produit des alertes, mais aucune action automatique chaînée.

**Solution** : table `ShopStrike { shopId, reason (HIGH_CANCEL|HIGH_LATE|LOW_RATING|HALAL_DISPUTE|NO_RESPONSE|PRICE_GOUGING), severity, createdAt, expiresAt, resolvedAt }`. Cron quotidien : si `cachedCancelRate > 15 %` → strike. À 3 strikes actifs (rolling 30 jours) → suspension auto + email gérant + ticket support escaladé. Webmaster override possible avec note.

---

### #3 — Réponse boucher aux avis clients + modération

**Manque** : `Review` (`schema.prisma:960`) a `rating + comment` mais **pas de champ `reply`**. Aucune route boucher pour répondre publiquement. Aucune possibilité pour le webmaster de masquer/modérer un avis injurieux ou diffamatoire.

**Risque** : le boucher est sans défense face aux 1 étoile injustes, dégrade la confiance plateforme, perd des conversions. C'est la feature #1 demandée par les commerçants Uber Eats / TripAdvisor.

**Solution** : ajouter `reply (String?)`, `replyAt`, `flagged (Boolean)`, `hidden (Boolean)`, `hiddenReason` au modèle Review. Route `PATCH /api/boucher/reviews/[id]` (1 réponse par avis, max 500 chars). Route `PATCH /api/webmaster/reviews/[id]` (modération). Affichage public avec citation de la réponse.

---

### #4 — Messagerie interne webmaster ↔ boucher + acknowledgements obligatoires

**Manque** : `SupportTicket` existe mais c'est **boucher → webmaster uniquement** (assistance). Aucun canal **webmaster → boucher** pour annonces, changements de tarif, alertes urgentes, mise à jour CGU. Pas d'accusé de lecture obligatoire.

**Risque** : impossible de déployer un changement de commission, une nouvelle CGU, un changement de seuil sans email manuel non traçable. Un boucher peut prétendre "je n'ai pas vu" en cas de litige.

**Solution** : modèle `BoucherAnnouncement { id, title, body, severity (INFO|WARNING|CRITICAL), requireAcknowledge, createdBy, audience (ALL|TIER_BRONZE|...|SHOP_IDS), expiresAt }` + `BoucherAnnouncementAck { announcementId, shopId, userId, ackedAt }`. Bandeau bloquant en haut du dashboard tant que `requireAcknowledge=true` non signé. Audit log à la signature.

---

### #5 — Vérification halal (workflow + expiration + alerte)

**Manque** : `halalCertUrl` est juste une URL, pas de date d'expiration, pas d'organisme certificateur stocké normalisé, pas de vérification webmaster, pas d'alerte 60 jours avant expiration. La CGU mentionne l'obligation halal mais le système ne l'enforce pas.

**Risque** : Klik&Go vend "halal" sans pouvoir le prouver → procès consommation, perte de trust, clash communautaire.

**Solution** : modèle `HalalCertification { shopId, organism (AVS|MOSQUEE_LYON|MOSQUEE_PARIS|ACMIF|HALAL_CONTROL|AUTRE), certificateNumber, issuedAt, expiresAt, documentUrl, status, verifiedBy, verifiedAt }`. Cron : alerte boucher J-60, J-30, J-7, blocage de la boutique J+0 si non renouvelé. Badge "Halal vérifié par X" affiché sur la fiche boutique.

---

### #6 — Dispute / litige client structuré (refund flow)

**Manque** : aucune route `/api/admin/orders/[id]/refund` (le commentaire dans `payments/webhook/route.ts:319` le confirme : "à venir"). Aucun workflow de litige avec preuves photo, médiation, remboursement partiel/total côté Klik&Go. Le boucher peut canceler une commande mais pas de système de réclamation client → boucher avec arbitrage Klik&Go.

**Solution** : modèle `OrderDispute { orderId, openedBy (CLIENT|BOUCHER|WEBMASTER), reason, evidence (URL[]), status (OPEN|UNDER_REVIEW|REFUNDED_PARTIAL|REFUNDED_FULL|REJECTED), refundedCents, decision, decisionBy, decidedAt }`. Route admin refund avec `refund_application_fee:true`. UI client `/commandes/[id]/litige`, UI webmaster `/webmaster/litiges`.

---

### #7 — Compte multi-boutique unifié (group account)

**Manque** : `ShopMember` (`schema.prisma:513`) existe avec rôles OWNER/MANAGER/STAFF mais **n'est utilisée nulle part dans l'UI**. Un boucher avec 3 points de vente doit créer 3 comptes Clerk distincts, 3 abonnements, 3 onboardings Stripe. `getAuthenticatedBoucher()` ne gère que `ownerId` direct.

**Risque** : friction massive pour les chaînes (3+ boucheries) → on perd les "gros poissons", justement ceux qui font volume.

**Solution** : exposer ShopMember via UI `/boucher/parametres/equipe` (invite par email avec rôle), implémenter un **shop switcher** dans le header boucher (dropdown avec les shops dont l'user est member), adapter `getAuthenticatedBoucher()` pour résoudre le shop actif via cookie `klikgo-active-shop`. Une seule subscription pour le owner de plusieurs boutiques (pricing dégressif).

---

### #8 — Audit log par boutique (qui a baissé un prix, qui a refundé)

**Manque** : `ShopLog` (`schema.prisma:533`) existe mais peu utilisée. `AuditLog` global webmaster ok mais pas de vue par-shop. Un patron boucherie ne peut pas tracer les actions de ses managers/staff (ex : qui a annulé cette commande à 300€ ?).

**Solution** : généraliser l'écriture dans `ShopLog` à chaque mutation critique (`order.cancel`, `order.refund`, `product.price_change`, `product.delete`, `shop.status_change`, `team.invite`, `team.remove`). Page `/boucher/parametres/journal` (lecture seule, paginée, filtres par utilisateur/action/date). Indispensable dès que ShopMember est exposé (cf. #7).

---

### #9 — Tableau de bord webmaster "Santé partenaires" (cohort + churn)

**Manque** : pages `/webmaster/performance` et `/webmaster/boutiques` listent shops mais aucune vue cohort (recrutés en mars vs avril vs mai), aucun NPS, aucun churn projection, aucune segmentation par tier × ancienneté × ville. Difficile de piloter 50 onboardings sans cela.

**Solution** : page `/webmaster/sante` avec : cohort retention (mois M1/M2/M3 par cohort de recrutement), GMV avg par cohort, % shops actifs (≥1 commande/semaine), top 10 et bottom 10, alerte sur shop en chute (`monthlyGmvCents` -30 % vs M-1), heatmap activité par jour × heure. Ajouter `firstOrderAt`, `lastOrderAt`, `weeklyOrderCount` cachés sur Shop.

---

### #10 — SLA réponse + auto-cancel commande client si pas accepté

**Existe partiellement** : `acceptTimeoutMin` (default 10) et `AUTO_CANCELLED` enum existent. `cachedResponseMinutes` calculé.

**Manque** : pas d'enforcement strict — aucun cron observable qui auto-cancel si > timeout, pas de notif client "votre commande n'a pas été acceptée, remboursement automatique", pas de pénalité strike pour le boucher (cf. #2). C'est le pilier "trust client" sur Uber Eats.

**Solution** : cron `/api/cron/auto-cancel` toutes les 60 s : pour chaque order PENDING avec `createdAt + acceptTimeoutMin × 60s < now`, marquer AUTO_CANCELLED, refund automatique si paid, notif client SMS+email+push, créer un `ShopStrike NO_RESPONSE`. Compteur visible côté boucher "vous avez X minutes pour accepter".

---

## Section 3 — 10 fonctionnalités HIGH manquantes (simplicité boucher)

### H#1 — Import CSV/Excel produits (bulk import)

Aujourd'hui : création produit unitaire via `ProductFormPage.tsx` (1703 lignes). Un boucher avec 200 références passe 4 h à tout ressaisir.

À ajouter : route `POST /api/boucher/products/bulk` acceptant CSV (Papa Parse côté client), template Excel téléchargeable avec colonnes pré-remplies (nom, prix, unité, origine, halalOrg, catégorie). Preview + erreurs ligne par ligne avant validation. Lien vers le catalogue de référence webmaster pour mapping automatique.

### H#2 — Stock réel avec alertes seuil + auto-pause

`stockQty` existe sur Product mais **pas de seuil d'alerte ni d'auto-snooze**. Le boucher snooze manuellement.

À ajouter : champs `stockAlertThreshold` et `autoSnoozeOnStockOut`. Cron qui passe `inStock=false` quand `stockQty <= 0` et envoie notif push au boucher. Widget dashboard "5 produits sous le seuil critique".

### H#3 — App native (PWA → app store)

PWA existe (manifest, ServiceWorker) mais pas de wrapper natif. La tablette de cuisine a besoin de notifications fiables, wake lock permanent, son qui passe le mode silencieux.

À ajouter : wrapper Capacitor (iOS + Android) ou solution simple type [PWABuilder](https://www.pwabuilder.com/) → publication TestFlight + Play Internal Testing pour les 50 early. Coût : ~5 jours dev + 99$/an Apple + 25$ une fois Google.

### H#4 — Caisse / paiement en boutique intégrée

Le client paie sur place mais aucun module pour le boucher d'enregistrer le paiement. Le bouton "Marquer comme retirée" ne distingue pas espèces/CB. Pas de tiroir-caisse, pas de Z de fin de journée, pas d'export pour le comptable.

À ajouter : champs `pickupPaymentMethod` (CASH|CARD|CHECK|PAID_ONLINE) + `pickupAmountCollected` à l'action "marquer retirée". Page `/boucher/caisse` qui liste paiements du jour, total cash vs CB, export X/Z. Pré-requis NF525 si on rentre dans la facturation (cf. skill `anthropic-skills:nf525-isca`).

### H#5 — Pré-commandes Aïd / mariage avec acompte

`pickupSlotStart/End` gère scheduled, mais rien de spécifique pour les commandes 2-4 semaines à l'avance avec acompte (Aïd al-Adha = 80 % du CA annuel pour certaines boucheries).

À ajouter : modèle `BigOrder { shopId, userId, type (AID|MARIAGE|FETE|RAMADAN), expectedDate, depositCents, depositPaidAt, items, status, finalPriceCents }`. Page `/boucher/grosses-commandes` + vue client `/aid` avec catalogue spécial. Calendrier déjà prêt (`dashboard/calendrier/page.tsx`) — il suffit de relier.

### H#6 — Templates de commande récurrente assistés

`RecurringOrder` existe mais l'UI boucher pour créer un template prêt-à-l'emploi pour ses clients fidèles n'existe pas. Le client doit tout reconfigurer. Idéal pour les pros (restaurants, traiteurs).

À ajouter : page `/boucher/abonnements` listant clients avec ≥4 commandes similaires, bouton "Proposer un abonnement hebdo" qui crée un template + envoie SMS+WhatsApp au client.

### H#7 — Messagerie boucher ↔ client par commande

Aujourd'hui : si le client veut préciser une coupe, il met une note. Si le boucher a une question (rupture sur 1 article), il appelle. Aucun fil de discussion attaché à la commande.

À ajouter : `OrderMessage { orderId, senderRole (CLIENT|BOUCHER), text, attachments, createdAt, readAt }`. Bouton "💬 Message" sur chaque card commande, notif push 2 sens. Limite 10 messages/commande pour éviter dérapage.

### H#8 — Tablette mode catalogue (édition produit one-tap)

Le mode Cuisine est tablet-first. La page `/boucher/produits` ne l'est pas (drag handle de 12 px, formulaire 4 steps trop dense). Sur 10" tactile, un boucher galère pour modifier un prix rapidement.

À ajouter : route `/boucher/produits/tablette` avec grille tuiles 200×200, 1 tap = popup "modifier prix" / "rupture" / "snooze 2h". Mode hors-ligne avec sync différée.

### H#9 — Notifs WhatsApp Business pour boucher

Côté client WhatsApp existe (`src/lib/whatsapp.ts`) mais le boucher reçoit pas de WhatsApp pour nouvelle commande / rappel scheduled. Beaucoup de bouchers laissent leur tablette en sourdine et regardent leur téléphone.

À ajouter : opt-in WhatsApp dans paramètres boucher, template approuvé Meta "Nouvelle commande #{num} {prenom}", lien deep link vers `/boucher/commandes`. Cron rappel pour scheduled à T-30 min.

### H#10 — Note vocale comme instruction interne sur produit / commande

Pour des coupes spéciales, dictée vocale est 10× plus rapide que clavier sur tablette grasse de cuisine.

À ajouter : Web Audio API record + upload vers Vercel Blob, lien audio attaché à la commande visible côté boucher uniquement (pas client). Optionnel : transcription Whisper pour recherche.

---

## Section 4 — Quick wins (< 1 jour chacun)

| # | Quick win | Fichier(s) impacté(s) | Estimation |
|---|---|---|---|
| QW1 | Ajouter `reply` au modèle Review + UI boucher 1 textarea | `prisma/schema.prisma:960`, nouveau `app/api/boucher/reviews/[id]/route.ts` | 4 h |
| QW2 | Affichage de `lastSeenAt` côté webmaster avec badge "tablette éteinte depuis 3 j" | `src/app/webmaster/boutiques/page.tsx` | 2 h |
| QW3 | Bouton "imprimer fiche boutique PDF" pour le boucher (CGU + commission + tier signés) | nouveau `/api/boucher/contract/pdf` | 6 h |
| QW4 | Champ `halalExpiresAt` sur Shop + bandeau d'expiration sur dashboard | `prisma/schema.prisma:393`, `dashboard/page.tsx` | 4 h |
| QW5 | Cron auto-cancel PENDING > timeout avec strike + notif client | `app/api/cron/auto-cancel/route.ts` | 6 h |
| QW6 | Renommer "abonnement" → "Plan d'abonnement" + afficher commission tier en parallèle pour clarté | `dashboard/abonnement/page.tsx` | 1 h |
| QW7 | Bouton "WhatsApp moi pour chaque commande" dans paramètres boucher | `parametres/page.tsx` + `notifications.ts` | 6 h |
| QW8 | Export CSV "déclaration TVA" (CA, TVA collectée 5,5 % et 20 %) à côté de l'export commandes | `boucher/finances/export/route.ts` (déjà ok) | 3 h |
| QW9 | Forecast payout fin de mois (extrapolation linéaire `monthlyGmvCents`) sur page Finances | `dashboard/finances/page.tsx` | 3 h |
| QW10 | Page `/boucher/equipe` MVP : juste lister `ShopMember` existants + désactiver l'invite | `app/(boucher)/boucher/equipe/page.tsx` | 6 h |
| QW11 | Modal "guide première commande" pour onboarding (vidéo Loom 90 s) | `components/boucher/OnboardingChecklist.tsx` | 3 h |
| QW12 | Indicateur "tablette en ligne" dans `/webmaster/boutiques` (basé sur `lastSeenAt < 5 min`) | `webmaster/boutiques/page.tsx` | 2 h |

**Total quick wins** : ~46 h soit **6 jours homme** pour un saut de qualité significatif avant le recrutement.

---

## Section 5 — Roadmap stratégique Q2-Q4 2026

### Q2 2026 — "Ready for 50" (mai-juin)

**Mission** : pouvoir onboarder 50 bouchers en sécurité totale.

- Sprint 1 (S18-19) : Quick wins QW1, QW4, QW5, QW9 + Critical #1 (KYC + uploads docs).
- Sprint 2 (S20-21) : Critical #3 (réponse avis), #5 (vérif halal), #6 (refund admin + dispute).
- Sprint 3 (S22-23) : Critical #2 (3-strike + auto-suspend), #10 (SLA enforcement), #4 (annonces webmaster avec ack).
- Sprint 4 (S24-25) : Critical #7 (multi-boutique unifié), QW10, QW11.

**Livrable** : kit "Klik&Go contrat partenaire" auto-généré (CGU signée + RIB + halal + K-bis vérifiés) téléchargeable PDF.

### Q3 2026 — "Operational excellence" (juillet-septembre)

**Mission** : que les 50 bouchers en place soient profitables et churn-free.

- Critical #8 (audit log par shop) + #9 (cohort dashboard webmaster).
- High #1 (import CSV produits), #2 (stock + alertes), #4 (caisse simple), #7 (messagerie order).
- Quick wins restants.
- Beta privée des fonctionnalités Pro : commandes B2B récurrentes (H#6) + grosses commandes Aïd (H#5).
- Mise en place NPS trimestriel boucher (modèle simple `BoucherSurveyResponse`).

### Q4 2026 — "Scale & lock-in" (octobre-décembre)

**Mission** : préparer Aïd al-Adha 2027 (mai 2027) avec un produit qui scale à 200+ shops.

- High #3 (app native iOS+Android via Capacitor).
- High #5 (pré-commandes Aïd structurées) + campagne marketing.
- High #8 (mode tablette catalogue), H#9 (WhatsApp boucher), H#10 (notes vocales).
- Étoffer le webmaster : tableau cohort temps réel, ML scoring boucher (proba churn 30 j), API publique partenaires (`ApiKey` est prête).
- Programme Gold/Platine de fidélisation : invitation événements, accès anticipé features, badge "vétéran" sur fiche.

---

## Section 6 — Comparaison vs marketplaces établies

Légende : O = présent, P = partiel, X = absent.

| Fonctionnalité | Klik&Go | Uber Eats Merchant | Deliveroo Hub | Just Eat Partner |
|---|---|---|---|---|
| Mode Cuisine tablette (3 colonnes) | O | O | O | O |
| Busy mode / pause / vacation | O | O | O | O |
| Auto-pause sur commandes manquées | O | O | O | P |
| Snooze produit (1h, 2h, fin journée, indéfini) | O | O | O | O |
| Commandes programmées + scheduled notify J-30 min | O | O | O | O |
| KYC + upload K-bis/RIB/cert | X | O | O | O |
| **Vérification halal certif + expiration** | X | X | X | X |
| Réponse boucher aux avis | X | O | O | O |
| Modération avis (hide/flag) webmaster | X | O | O | O |
| Système 3-strike + auto-suspension | X | O | O | O |
| Annonces webmaster + acknowledge obligatoire | X | O | O | P |
| Litige / dispute / refund flow client | X | O | O | O |
| Multi-boutique compte unifié + shop switcher | X (DB ok, UI X) | O | O | O |
| Audit log par boutique | P (ShopLog peu utilisée) | O | O | O |
| Cohort santé partenaires webmaster | X | O | O | O |
| SLA accept timeout + auto-cancel + strike | P | O | O | O |
| Performance score boucher | O | O | O | O |
| Tier commission auto (Bronze/Silver/Gold/Platine) | O | O | O | P |
| Stripe Connect Express marketplace | O | (interne) | (interne) | (interne) |
| Anti-gaspi (DLC/surplus) | O | P | P | P |
| Calendrier événements religieux | O | X | X | X |
| Parrainage boucher → boucher | O | O | O | O |
| Programme fidélité client configurable | O | P | O | P |
| Self-serve promotion / promo codes boucher | P (via Offer) | O | O | O |
| Boost / featured listing payant | X | O | O | O |
| Import CSV/Excel produits bulk | X | O | O | O |
| Stock alertes + auto-pause OOS | P | O | O | O |
| Messagerie webmaster ↔ boucher in-app | X | O | O | O |
| Messagerie boucher ↔ client par commande | X | O | O | O |
| WhatsApp/SMS notifs boucher | X (client only) | O | O | O |
| App native iOS/Android | X (PWA only) | O | O | O |
| Caisse intégrée / X-Z journalier | X | P | P | O |
| Export CSV TVA pour comptable | P | O | O | O |
| Forecast payout / projection fin de mois | X | O | O | O |
| Pré-commandes Aïd / événements avec acompte | X | X | X | X |
| Notes vocales sur produit/commande | X | X | X | X |
| Barcode scanning inventaire | X | P | P | P |
| API publique partenaires | P (ApiKey ready) | O | O | O |

**Ratio Klik&Go vs leaders** : 16 O (43 %), 6 P (16 %), 15 X (41 %). Le socle Mode Cuisine est compétitif. Le delta se joue sur **contrôle webmaster (KYC, sanctions, modération, dispute, multi-boutique)** et **simplicité quotidienne (import, caisse, messagerie, app native)**.

**Avantages compétitifs uniques** : calendrier religieux automatisé, vérification halal structurée (à construire mais cible d'or), pré-commandes Aïd avec acompte (#H5).

---

## Synthèse

**Top 3 chantiers à faire AVANT les 50 onboardings** :

1. **KYC + halal + CGU signée numérique** (#C1 + #C5) — sans cela on prend un risque juridique et communautaire majeur.
2. **Réponse boucher aux avis** (#C3) — c'est le 1er reproche merchant universel et un correctif simple (~4 h).
3. **Cron auto-cancel + 3-strike** (#C10 + #C2) — pour que la promesse "tablette qui sonne en 10 min" ait un sens contractuel.

**Top 3 différenciateurs à exploiter Q3-Q4** :

1. **Pré-commandes Aïd avec acompte** (#H5) — viralité communautaire, vrai moat.
2. **Vérification halal structurée + badge** — positionnement de leader trust.
3. **Calendrier religieux + alerte stock** — déjà 70 % fait, valeur perçue énorme.

**Risque principal identifié** : `ShopMember` existe en DB mais zéro UI. Si un early adopter a 2 boutiques, il va créer 2 comptes, 2 abonnements, et basculera vers un concurrent dès qu'on lui parlera de scale. **À traiter avant le recrutement** ou au minimum communiquer "fonctionnalité multi-boutique sur la roadmap Q2".
