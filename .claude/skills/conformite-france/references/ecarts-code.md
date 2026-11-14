# Écarts relevés dans le code

Audit initial au commit `32c581f` ; chaque ligne a été **revérifiée le 2026-11-14** sur l'arbre de
travail (HEAD `0b69e39`, chantier prix en cours). Constat technique, pas un avis juridique. Avant de
corriger un écart, relire le fichier : le chantier en cours déplace du code.

Priorité : **P1** = exposition réelle aujourd'hui (donnée envoyée, message envoyé, information fausse
affichée) ; **P2** = information ou fonction obligatoire absente ; **P3** = à préparer. Les
identifiants `[..]` renvoient à [sources.md](sources.md), les numéros de règle à SKILL.md.

| ID | P | Où | Constat | Règle / source |
|---|---|---|---|---|
| G1 | P1 | `src/app/layout.tsx` (`<Analytics />`, `<SpeedInsights />`), `sentry.client.config.ts` (Replay 5 % des sessions, 100 % sur erreur, en production) | Chargés pour tout visiteur, absents du bandeau et de la politique ; le bandeau dit « Aucune donnée personnelle n'est collectée » et ne s'affiche que si `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` est défini | 1, 2 `[C1][C2][V1][V1c]` |
| G2 | P1 | `layout.tsx` + routes `/suivi/[id]?guestToken=…`, `/commande/[id]`, `/validation/[id]` | URL avec identifiant de commande et jeton invité envoyées à Vercel Analytics et Speed Insights ; Plausible (si accepté) reçoit le chemin | 3 `[V1][V1c][V2]` |
| G3 | P1 | Campagnes marketing | Destinataires, consentement, exclusions et désinscription à vérifier contre la règle 4 et [rgpd-cnil.md § 5](rgpd-cnil.md) ; état actuel : voir le registre privé du programme | 4 `[C3]` |
| G4 | P1 | Préférences de notification, relance de panier abandonné | Préférence marketing distincte du transactionnel et fausse par défaut, politique alignée sur le code ; état actuel : voir le registre privé du programme | 4 `[C3]` |
| G5 | P1 | Prospection B2B (envoi manuel, relances automatiques, gabarits) | Moyen d'opposition dans chaque message, adresse de réponse réelle, aucun envoi à un prospect opposé, allégations prouvées (« Déjà 11 boucheries », « +15 à 30 % » sont en dur) ; état actuel : voir le registre privé du programme | 4 `[C3]` |
| G6 | P1 | Pages SEO et prompts (liste et commande `grep` : [alimentaire-halal.md § 3](alimentaire-halal.md)) | « Toutes les boucheries partenaires Klik&Go sont halal certifiées », « 100% halal certifié », « éleveurs français », « halal certified » sur toute image générée | 12 `[Q1][L9]` — pages de l'owner : arbitrage n° 4 |
| G7 | P1 | `grep -rn "0,99" src/app` : pages ville, quartier, département, région, produit, occasion, dimanche, `(client)/page.tsx` (meta description), `(client)/a-propos`, `(client)/click-and-collect-halal` | « 0,99 € de frais de service » alors que `serviceFeeCentsFor("ON_PICKUP") = 0` (`src/lib/pricing/totals.ts`) ; « prix de la boucherie, sans surcoût / sans majoration » alors que `computeOnlinePriceCents` (`src/lib/services/stripe/commission.ts`) majore le prix en ligne selon `Shop.commissionMarkupPercent` (défaut 80) ; « payez en ligne » alors que seul le paiement sur place existe | 7 `[L2][L11]` — pages de l'owner : arbitrage n° 4 |
| G8 | P1 | `src/lib/email.ts` + configuration d'envoi en production | Vérifier qu'une confirmation de commande sur support durable part réellement ; état actuel : voir le registre privé du programme | 7 `[L5]` |
| G9 | P2 | `src/app/(client)/cgv/page.tsx`, pied de page | Aucun médiateur ; pas de mention d'absence de rétractation ; paiement en ligne annoncé ; critères de classement absents | 7, 8 `[L2][M1][L1]` |
| G10 | P2 | `src/app/(client)/panier/page.tsx` | Bouton « Confirmer ma commande » ; identité légale de la boucherie non affichée ; bloc « Mode de paiement » réservé au client connecté | 7 `[L4][L2]` |
| G11 | P2 | `src/app/(client)/mentions-legales/page.tsx` | SIRET « en cours d'immatriculation », pas de téléphone, adresse réduite à la ville, hébergeurs incomplets, section cookies fausse | `[S2]` |
| G12 | P2 | `src/app/(client)/politique-de-confidentialite/page.tsx` | Sous-traitants incomplets, transferts non précisés, durée unique, rien sur invités, prospects ni géolocalisation | 5, 6 `[S2][C4]` |
| G13 | P2 | `src/components/AnalyticsConsent.tsx` | Pas de lien permanent pour modifier son choix | 1 `[S2][C2]` |
| G14 | P2 | `src/app/api/users/me/route.ts` (DELETE), `src/app/api/webhooks/clerk/route.ts` | Adresse, ville, coordonnées GPS et préférences conservées ; compte Clerk non supprimé ; webhook `user.deleted` non idempotent ; aucun parcours pour un invité | 5 `[C5]` |
| G15 | P2 | `src/app/api/users/me/export/route.ts`, `src/app/(client)/profil/page.tsx` | Export incomplet (`Order.rating`, favoris, fidélité, support, panier…), erreurs avalées par `.catch(() => [])`, aucun bouton d'export | 5 `[C5]` |
| G16 | P2 | Circuits de notation, `src/components/shop/ReviewList.tsx` | Lien avis ↔ commande retirée à garantir côté serveur (état actuel : voir le registre privé du programme) ; aucune des informations de D111-17 ; pas de date d'expérience ; pas de signalement par le boucher | 9 `[L7][L8][L9]` |
| G17 | P2 | `src/components/product/ProductCard.tsx`, `ProductSheet.tsx` (`price.baseCents`, `antiGaspiOrigPriceCents`, `packOldPriceCents` barrés) | Pas d'historique de prix → prix de référence des 30 jours invérifiable | 10 `[L10]` |
| G18 | P2 | `Product.origin`, `Shop.defaultOrigin` (`@default(FRANCE)`), `Product.freshness` (`@default(FRAIS)`), affichés par `ProductSheet.tsx` | Origine française et « Frais » déclarés par défaut ; nom d'organisme halal affiché sans certificat vérifié | 11, 12 `[A3][L9]` |
| G19 | P2 | `Product`, `ReferenceProduct` | Aucun champ allergènes | 11 `[A2]` |
| G20 | P2 | `src/app/api/admin/shops/[shopId]/suspend/route.ts` | Suspension d'une boutique sans motif obligatoire ni notification au boucher | P2B art. 4 `[E3]` |
| G21 | P2 | `src/hooks/useGeolocation.ts` | Coordonnées GPS envoyées à `nominatim.openstreetmap.org` depuis le navigateur, tiers absent de la politique (appel sans doute bloqué par la CSP en production : à vérifier) | 2, checklist « sous-traitant » |
| G22 | P3 | `Shop.siret`, `Shop.legalName` optionnels | Identité du vendeur non garantie | `[L1][L2]` |
| G23 | P3 | Commission facturée aux boucheries | Facture électronique par une plateforme agréée au plus tard le 1/09/2027 ; réception déjà due | `[F1]` |
| G24 | P3 | `src/lib/email.ts` | Destinataire journalisé en clair quand Resend est absent | `security-multitenant` |
| G25 | P3 | `src/app/layout.tsx` (`preconnect` vers `fonts.googleapis.com` et `fonts.gstatic.com`) | Connexion vers Google pour chaque visiteur, sans utilité avec `next/font/google` | arbitrage n° 8 `[V4]` |
| G26 | P3 | `ChatMessage` (clé de session), `Notification`, `Cart` abandonnés, `Prospect` | Aucune purge programmée : les durées annoncées n'existent pas dans le code | 6 `[C4]` |

Traitement suggéré : G1, G2, G3, G8 d'abord (exposition réelle, correction technique simple ou gel) ;
G6 et G7 passent par l'owner (pages SEO) ; G9 à G12 demandent des données de l'owner (médiateur,
numéro d'immatriculation, téléphone) et une relecture juridique.
