---
name: conformite-france
description: Conformité légale France et UE de Klik&Go (marketplace click & collect de boucheries halal) traduite en règles d'ingénierie — RGPD et CNIL (traceurs, bandeau, politique de confidentialité, droits export et suppression, sous-traitants, transferts hors UE, durées), prospection et consentement marketing, droit de la consommation en ligne (informations précontractuelles, bouton de commande, confirmation, absence de rétractation, médiateur, mentions légales), obligations des places de marché (classement, P2B, DSA), avis en ligne, prix au poids et annonces de réduction, allergènes et origine des viandes, allégations halal et certification, facturation électronique, accessibilité. À charger avant de toucher une page légale, un bandeau ou script d'analyse, une collecte de données, un e-mail marketing, les avis, un prix barré ou une promotion, une fiche produit, une mention halal, le compte utilisateur ou un sous-traitant. Ce n'est pas un avis juridique.
when_to_use: RGPD, CNIL, cookies, traceurs, bandeau, consentement, Plausible, Vercel Analytics, Sentry replay, politique de confidentialité, mentions légales, CGV, CGU, export de données, suppression de compte, droit d'accès, sous-traitant, transfert, prospection, opt-in, désinscription, avis, notes, prix barré, promo, prix au kilo, allergènes, origine, halal, certificat, médiateur, rétractation, DSA, P2B, facture électronique, accessibilité.
---

# Conformité France — Klik&Go

> **Ce skill n'est pas un avis juridique.** Il traduit des textes officiels en règles de code. Tout
> point marqué **[JURISTE]** doit être validé par un avocat ou un juriste avant mise en production ;
> les textes des pages légales (CGV, politique de confidentialité, mentions) sont validés par l'owner
> et, idéalement, un juriste. L'ingénieur ne rédige pas d'engagement juridique « au feeling ».

Sources : identifiants `[C1]`, `[L3]`… → [references/sources.md](references/sources.md), toutes
officielles, relues le 2026-11-14 (ce qui n'a pas pu l'être y est marqué « Extrait »). État du code,
revérifié le même jour sur l'arbre de travail (HEAD `0b69e39`) :
[references/ecarts-code.md](references/ecarts-code.md).

## Qui fait quoi (ne pas dupliquer)

| Sujet | Skill |
|---|---|
| Envoi e-mail/push/WhatsApp, `List-Unsubscribe`, outbox, campagnes (mécanique) | `background-jobs-notifications` |
| Critères WCAG, composants, cadre légal détaillé de l'accessibilité | `accessibility-wcag` |
| Avis et `aggregateRating` dans le JSON-LD, pages SEO | `seo-anti-penalty` (garde-fou owner, prioritaire) |
| Auth, IDOR, secrets, journaux sans donnée personnelle | `security-multitenant`, `clerk-auth` |
| Réglages Sentry (taux, masquage) | `reliability-observability` |
| Parcours panier et commande, ajustement de prix | `click-and-collect`, `order-lifecycle-realtime` |
| Paiement en ligne (Stripe, pas encore actif) | `stripe-payment` |
| Schéma Prisma, migrations | `prisma-expert` |

## Rôles juridiques de Klik&Go (à garder en tête)

- **Place de marché en ligne** : la vente de viande est conclue entre le client et la boucherie
  (CGV art. 1). Klik&Go doit l'information « loyale, claire et transparente » de L111-7 `[L1]` :
  conditions d'utilisation, **modalités de classement**, liens ou rémunérations qui l'influencent,
  qualité du vendeur ; et l'espace où la boucherie communique ses informations précontractuelles.
- **Responsable de traitement** pour les comptes, commandes, avis, notifications, prospects.
  **Sous-traitants et destinataires** réellement appelés par le code : Clerk, Vercel (hébergement,
  Analytics, Speed Insights, Blob), Railway, Resend, Upstash, Sentry, Plausible, Anthropic, Replicate,
  Twilio (WhatsApp, si configuré), services push des navigateurs.
- **Prestataire des boucheries** (commission) : règlement P2B `[E3]`, facturation électronique `[F1]`.
- **Taille** : entrepreneur individuel, moins de 10 personnes. Exemptions qui en dépendent : sections
  3 et 4 du DSA (art. 19 et 29) `[E2]`, réclamations et médiateurs P2B (art. 11, 12) `[E3]`,
  accessibilité des services `[A1]` — **[JURISTE]** pour confirmer ; à revoir dès que l'effectif ou
  le chiffre d'affaires change. La médiation de la consommation, elle, n'a pas de seuil `[M1]`.

## Règles de décision (les 12 qui comptent)

1. **Pas de traceur non exempté sans consentement préalable** (art. 82 de la loi 78-17) `[C2][S1]`.
   Exemptés : authentification, panier, choix de consentement, sécurité, interface attendue ; mesure
   d'audience **seulement** si elle sert le seul éditeur, produit des statistiques anonymes, sans
   recoupement ni suivi sur d'autres sites `[C1]`. Refuser est aussi simple qu'accepter ; le choix se
   modifie à tout moment `[C2][S2]`. Tout nouveau script tiers (`next/script`, SDK, pixel) et tout
   stockage local non fonctionnel passent par la grille de
   [references/rgpd-cnil.md § 1](references/rgpd-cnil.md) **avant** merge.
2. **Une seule vérité sur les traceurs** : le bandeau `src/components/AnalyticsConsent.tsx`,
   `/politique-de-confidentialite` et `/mentions-legales` décrivent exactement ce que
   `src/app/layout.tsx` et `sentry.client.config.ts` chargent. Aujourd'hui ils omettent Vercel
   Analytics, Speed Insights et Sentry Replay (écart G1).
3. **Jamais d'URL portant un identifiant de commande ou un jeton vers un outil d'analyse** :
   `/suivi/[id]?guestToken=…`, `/commande/[id]`, `/validation/[id]`, `?testmode=…`. Vercel Analytics
   et Speed Insights passent par `beforeSend` (pattern compilé :
   [rgpd-cnil.md § 2](references/rgpd-cnil.md)) ; Plausible reçoit le chemin `[V2]`.
4. **Marketing vers un particulier = consentement préalable, spécifique, case non pré-cochée** ;
   accepter les CGU ne vaut pas consentement `[C3]`. Exception « client existant » : seulement après
   un **achat**, pour des produits analogues de la même entreprise ; un compte créé ne suffit pas
   `[C3]`. Chaque message identifie l'expéditeur et offre un moyen simple de refuser `[C3]`.
   Prospects bouchers : information + opposition simple et gratuite, objet lié à la profession ;
   seules les adresses génériques de société y échappent, donc appliquer la règle à tous `[C3]`.
   Transactionnel (statut de commande) ≠ marketing (`PROMO_NEW`, `FLASH_OFFER`, `CART_ABANDONED`,
   campagnes) : deux préférences distinctes, la seconde fausse par défaut.
5. **Les droits RGPD sont des fonctionnalités** : réponse sous 1 mois (+2 mois si complexe, en
   prévenant dans le premier mois) ; pas de pièce d'identité pour une demande faite depuis le compte
   connecté, sauf doute raisonnable `[C5]`. Export (`GET /api/users/me/export`) et suppression
   (`DELETE /api/users/me`) couvrent **toutes** les données, compte Clerk compris, et les invités ont
   un parcours → [rgpd-cnil.md § 4](references/rgpd-cnil.md).
6. **Durées** : client, pendant la relation puis 3 ans ; prospect, 3 ans après la collecte ou son
   dernier contact ; compte inactif, 2 ans recommandés avec avertissement `[C4]` ; documents
   comptables 10 ans, en archive `[K1]`. Une durée sans tâche de purge n'existe pas : elle se code
   (cron, cf. `background-jobs-notifications`). Aucune purge n'existe aujourd'hui (écart G26).
7. **Parcours de commande** `[L2][L4][L5]` : juste avant le bouton, le client voit caractéristiques
   et prix TTC, identité et coordonnées du **vendeur (la boucherie)**, modalités de retrait, moyens
   de paiement acceptés (invités compris), **absence de droit de rétractation** (denrées
   périssables, L221-28 4° `[L6]`) et médiateur. Le bouton porte « Commande avec obligation de
   paiement » ou une formule analogue **dénuée d'ambiguïté** ; « Confirmer ma commande » ne dit rien
   du paiement : le remplacer, formule validée **[JURISTE]**. La confirmation part sur support
   durable (e-mail) au plus tard au retrait et reprend ces informations (L221-13 `[L5]`).
8. **Médiateur obligatoire, quelle que soit la taille** : nom, adresse postale et site d'un
   médiateur référencé par la CECMC, sur le site, dans les CGV et les bons de commande `[M1]`.
   **Aucun lien vers la plateforme européenne RLL/ODR** : supprimée le 20/07/2025 `[E1]`.
9. **Avis** (L111-7-2, D111-16 à D111-19) `[L7][L8]` : à proximité des avis, dire s'ils sont
   contrôlés, afficher date de publication **et** date de l'expérience, et le critère de tri ; en
   rubrique accessible : contrepartie éventuelle, délai maximal de publication et de conservation,
   motifs de refus ; motiver tout refus à l'auteur ; donner au boucher un signalement gratuit et
   motivé. Un avis sans achat n'est pas interdit, mais ne jamais écrire « avis vérifiés » ou « avis
   d'acheteurs » sans vérification réelle (L121-4 27°) ; jamais d'avis rédigé, modifié ou trié pour
   promouvoir (28°) `[L9]`.
10. **Prix barré = prix le plus bas des 30 jours précédant la réduction** (L112-1-1) `[L10]`, sauf
    produits périssables menacés d'altération rapide (périmètre pour la viande : **[JURISTE]**). Le
    code n'a pas d'historique de prix : pas de nouveau prix barré ni de « -X % » sans lui. Tout prix
    affiché est TTC, avec l'unité (« /kg ») pour un produit au poids, avant la commande `[L11]`.
11. **Fiche produit à distance** : pour une denrée non préemballée, les **allergènes** sont
    disponibles avant l'achat et à la remise `[A2]`. Aucune valeur par défaut qui vaut déclaration :
    l'origine (`FRANCE`) et la fraîcheur (`FRAIS`) ne s'affichent que si le boucher les a saisies ;
    pour le bœuf, l'origine est une mention obligatoire en boutique `[A3]`, son affichage en ligne
    **[JURISTE]** → [references/alimentaire-halal.md](references/alimentaire-halal.md).
12. **Halal et certificats** : « halal » n'a pas de définition légale, sa définition relève des
    instances religieuses, mais afficher un certificat ou un label sans l'autorisation nécessaire
    est réputé trompeur (L121-4 2°) `[Q1][L9]`. Le nom d'un organisme certificateur ne s'affiche
    qu'adossé à un certificat en cours (stocké, daté, vérifié) ; Klik&Go n'affirme jamais « toutes
    certifiées ».

## Checklist par type de changement

| Changement | À faire avant merge |
|---|---|
| Nouveau script, SDK, pixel, `localStorage` non fonctionnel | Grille de la règle 1 ; si non exempté : derrière le consentement ; politique + bandeau à jour |
| Nouvelle donnée collectée (champ de formulaire, colonne `User`) | Finalité, base légale, durée ; ajout à l'export **et** à l'anonymisation ; mention à la collecte |
| Nouveau sous-traitant (API externe, appel depuis le navigateur compris) | DPA, localisation, transfert (DPF si certifié, sinon clauses types) `[C6][C7]` ; politique à jour ; CSP |
| E-mail / push / SMS non transactionnel | Règle 4 + `background-jobs-notifications` (point B4) ; filtre consentement **et** `deletedAt: null` |
| Avis, notes, réponses boucher, retrait d'un avis | Règle 9 + `seo-anti-penalty` A à C ; motif enregistré et communiqué |
| Promotion, prix barré, badge « -X % », anti-gaspi | Règle 10 ; prix de référence traçable |
| Fiche produit, catalogue de référence | Règle 11 : allergènes, origine et fraîcheur sans défaut, unité de prix |
| Texte « halal », « certifié », logo d'organisme | Règle 12 ; preuve en base |
| Tri ou mise en avant des boutiques | Publier le critère (L111-7, P2B art. 5) `[L1][E3]` dans la même PR ; mise en avant payée signalée |
| Suspension ou masquage d'une boutique, modification des conditions partenaires | Motif écrit envoyé au boucher au plus tard à la prise d'effet ; préavis de 15 jours pour les conditions (P2B art. 3, 4) `[E3]` |
| Parcours panier, confirmation | Règle 7 ; e-mail de confirmation réellement envoyé (configuration d'envoi en production : voir le registre privé du programme) |
| Page légale | Données fournies par l'owner (numéro RCS/RNE, téléphone, hébergeur avec adresse et téléphone) `[S2]` ; date « Dernière mise à jour » |

Détail : [references/rgpd-cnil.md](references/rgpd-cnil.md),
[references/conso-marketplace.md](references/conso-marketplace.md),
[references/alimentaire-halal.md](references/alimentaire-halal.md),
[references/facturation-accessibilite.md](references/facturation-accessibilite.md).

## Erreurs déjà commises dans ce code (ne pas les refaire)

- Bandeau qui affirme « Aucune donnée personnelle n'est collectée » alors que Vercel Analytics,
  Speed Insights et Sentry Replay tournent hors bandeau ; aucun moyen de revenir sur son choix.
- Envois marketing (campagnes, relances de panier, prospection) : chacun se vérifie contre la
  règle 4 et [references/rgpd-cnil.md § 5](references/rgpd-cnil.md) avant d'y toucher ; état actuel
  et correctifs : voir le registre privé du programme.
- Chiffres en dur dans des gabarits d'e-mail (« Déjà 11 boucheries », « +15 à 30 % »).
- Suppression de compte qui laisse `address`, `city`, `latitude`, `longitude` et le compte Clerk.
- Deux circuits de notation (`reviews` et `orders/[id]/rate`) alimentent la même moyenne
  `Shop.rating` ; le lien entre un avis et une commande retirée se contrôle côté serveur (état
  actuel : voir le registre privé du programme).
- `Product.origin`, `Shop.defaultOrigin` (`FRANCE`) et `Product.freshness` (`FRAIS`) par défaut,
  affichés sur la fiche ; aucun champ allergènes.
- « Toutes les boucheries partenaires Klik&Go sont halal certifiées » dans des pages SEO et le
  prompt du chat, sans vérification par boutique.
- Pages publiques qui annoncent « 0,99 € de frais de service » (0 € en paiement sur place), « payez
  en ligne » (inexistant) et « prix de la boucherie, sans surcoût » (alors que
  `commissionMarkupPercent` majore le prix en ligne).
- Mentions légales « SIRET : en cours d'immatriculation », sans téléphone, hébergeurs incomplets ;
  CGV sans médiateur ni mention d'absence de rétractation.
- Boutique suspendue sans motif obligatoire ni message au boucher.

## Patterns de code (next 14.2.35, @vercel/analytics 2.0.1, @vercel/speed-insights 2.0.0, @clerk/nextjs 6.39.9)

- `beforeSend` de Vercel Analytics et Speed Insights dans un composant client (`Analytics` est
  `"use client"` : une fonction ne lui est pas transmissible depuis `layout.tsx`) + fonction pure
  `redactUrl` testée : [rgpd-cnil.md § 2](references/rgpd-cnil.md).
- Suppression complète : contrôles → `const client = await clerkClient(); await
  client.users.deleteUser(clerkId)` (jamais en mode test : `getTestRole() !== null`) →
  anonymisation Prisma partagée avec le webhook `user.deleted` : [rgpd-cnil.md § 4](references/rgpd-cnil.md).
- Destinataires marketing en Prisma typé, jamais en SQL brut sans filtre (le champ de consentement
  reste à créer) : [rgpd-cnil.md § 5](references/rgpd-cnil.md).
- Bloc d'information « avis » et rubrique dédiée : [conso-marketplace.md § 5](references/conso-marketplace.md).

## Points à arbitrer (owner, et juriste quand indiqué)

Tant qu'un point n'est pas tranché, CLAUDE.md et les règles SEO de l'owner s'appliquent tels quels.

1. **Bandeau** : soit tout l'analytique passe derrière le consentement (Vercel Analytics, Speed
   Insights, Sentry Replay), soit on documente l'exemption de chaque outil selon la grille CNIL
   `[C1]` (Vercel est une société américaine : transfert et réutilisation à vérifier) **[JURISTE]**.
   Recommandation : Replay seulement sur erreur et derrière consentement, Vercel avec `beforeSend`.
   `reliability-observability` garde les réglages Sentry actuels d'ici la décision.
2. **Ajustement de prix au poids** : une hausse validée d'office après 5 min sans réponse (palier 2,
   CLAUDE.md) est-elle opposable au regard de L121-17 `[L3]` ? Encadrer la tolérance dans les CGV
   avant la commande **[JURISTE]** (même sujet : `click-and-collect` A1).
3. **Exception « périssables » au prix de référence des 30 jours** pour la viande fraîche, sous
   vide, surgelée, et pour l'anti-gaspi **[JURISTE]**.
4. **Allégations des pages SEO** et des prompts (halal « certifié », « éleveurs français », frais
   de 0,99 €, « sans surcoût », « payez en ligne » : écarts G6 et G7) : ces pages relèvent des règles
   SEO de l'owner ; ce skill ne les modifie pas. Proposition : « des boucheries halal, chacune
   indiquant son organisme de certification » et des frais décrits tels qu'ils sont facturés
   **[JURISTE]**.
5. **`seo-anti-penalty`** s'appuie sur la règle FTC (États-Unis) pour les avis ; en France les textes
   applicables sont L111-7-2, D111-16 à D111-19 et L121-4 27°/28° : à ajouter en complément, sans
   rien retirer. Sa règle « rétribution non liée au contenu » reste compatible, à condition
   d'indiquer toute contrepartie au dépôt d'avis (D111-17).
6. **Gel des campagnes** e-mail et des relances de panier tant que la règle 4 (consentement,
   désinscription) n'est pas vérifiée dans le code (cf. `background-jobs-notifications`, points B4
   et B9 ; état actuel : voir le registre privé du programme).
7. **DSA** : qualification de Klik&Go (hébergeur, plateforme) et mise en œuvre des obligations sans
   seuil de taille (points de contact, conditions générales sur la modération, notification de
   contenu illicite, motivation des retraits) **[JURISTE]** — liste dans
   [conso-marketplace.md § 4](references/conso-marketplace.md).
8. **`preconnect` vers Google Fonts** dans `layout.tsx` : CLAUDE.md le cite comme optimisation, mais
   `next/font/google` auto-héberge les polices `[V4]` ; il n'apporte qu'une connexion vers Google
   pour chaque visiteur. Proposition : le retirer (avec `web-performance`).
9. **Médiateur** : lequel afficher (celui de chaque boucherie, celui de la plateforme, les deux), et
   sa désignation par l'owner **[JURISTE]**.

## Définition de terminé (travail touchant ce domaine)

- [ ] La règle concernée ci-dessus est respectée et sa source `[ID]` citée dans la PR.
- [ ] Bandeau, politique de confidentialité et mentions décrivent exactement les traceurs et
      sous-traitants réellement chargés (vérifié dans l'onglet Réseau, visiteur non connecté, sans
      choix, puis après refus) ; aucune URL à identifiant ne part vers un outil d'analyse.
- [ ] Toute nouvelle donnée personnelle figure dans l'export **et** est traitée par l'anonymisation ;
      test d'intégration ajouté (`tests/integration/`, jamais de mock Prisma).
- [ ] Aucun envoi non transactionnel sans filtre de consentement, `deletedAt: null` et moyen de refus.
- [ ] Aucun prix barré sans prix de référence traçable ; prix TTC avec unité.
- [ ] Aucune allégation (halal, origine, fraîcheur, « vérifié », chiffre) sans donnée qui la prouve
      en base ; aucune valeur par défaut affichée comme une information.
- [ ] Tout helper pur ajouté dans `src/lib/**` a son test unitaire (CLAUDE.md).
- [ ] Les points **[JURISTE]** touchés sont listés dans la PR et non mis en production sans validation.
- [ ] Pages légales : date « Dernière mise à jour » changée ; règles SEO de l'owner respectées
      (`seo-anti-penalty` ; ne pas ajouter de `noindex`).
