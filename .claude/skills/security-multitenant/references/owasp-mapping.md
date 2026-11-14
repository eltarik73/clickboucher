# Correspondance OWASP ↔ code Klik&Go

Pour savoir, devant une exigence ou un risque OWASP, **où** il se joue chez nous et **quel geste**
le couvre. Sources : [sources.md](sources.md) (S1 = ASVS 5.0.0, S2 = API Top 10 2023). Niveau ASVS
visé : **L2** pour tout ce qui touche aux données des boutiques et des clients (marketplace
multi-tenant avec données personnelles) ; les exigences L3 sont signalées comme telles.

## 1. OWASP API Security Top 10 2023

| Risque | Où chez nous | Geste | Section |
|---|---|---|---|
| API1 Broken Object Level Authorization | toute route à `[id]`, `[orderId]`, `[productId]` ; listes filtrées | tenant / propriétaire dans le `where`, 404 sinon | `autorisation-par-construction.md` § 3 |
| API2 Broken Authentication | helpers Clerk, mode test, crons, webhooks, invités | helper en première ligne ; secrets fermés par défaut ; jeton de test signé et interdit en production | skill `clerk-auth`, `abus-webhooks-crons.md` |
| API3 Broken Object Property Level Authorization | `proPriceCents`, `guestToken`, `clerkId`, `ownerId` ; schémas de mise à jour | `select` par audience ; schéma Zod liste blanche + `.strict()` | `autorisation-par-construction.md` § 4 |
| API4 Unrestricted Resource Consumption | tableaux Zod (validés élément par élément même avec `.max()`), pagination, IA, upload | `boundedArray()`, bornes partout, `take ≤ 50`, rate limit avant validation, taille de fichier | `entrees-sorties.md` § 1 |
| API5 Broken Function Level Authorization | `/api/admin/**`, `/api/webmaster/**`, changements de rôle | `requireAdmin()` ; routes séparées ; rôle lu en base | skill `clerk-auth` § 3 |
| API6 Unrestricted Access to Sensitive Business Flows | commande invité, codes promo, OTP, avis, IA | rate limit + contrôle métier (usage unique, plafond) | `abus-webhooks-crons.md` § 4 |
| API7 Server Side Request Forgery | import et proxy d'images, abonnement push, `remotePatterns` | liste blanche d'hôtes, pas de redirection suivie | `ssrf-fichiers.md` § 1 |
| API8 Security Misconfiguration | CSP, en-têtes, Next 14 non supporté, `sharp` 0.34.5 | en-têtes `next.config.mjs`, plan CSP, montées de version | `secrets-entetes-csp.md` |
| API9 Improper Inventory Management | 188 handlers, routes de test, préprod | audience en tête de fichier ; routes mortes supprimées ; mode test hors prod | `checklist-revue-route.md` A1 |
| API10 Unsafe Consumption of APIs | webhooks Stripe/Clerk, réponses Replicate, Pexels, Unsplash, Google Places | signature avant lecture ; réponses tierces validées et typées, jamais relayées | `abus-webhooks-crons.md` § 2 |

## 2. ASVS 5.0 — exigences qui structurent nos règles

| Exigence (niveau) | Résumé | Règle du skill | État |
|---|---|---|---|
| 8.2.1 (L1) | accès aux fonctions restreint | 3 | helpers en place (169/188 handlers) |
| 8.2.2 (L1) | accès aux données par objet (IDOR/BOLA) | 2 | forme « charger puis comparer » dominante — correcte mais fragile ; forme cible déjà en place dans les commandes du chantier prix |
| 8.2.3 (L2) | accès par champ (BOPLA) | 5 | listes blanches (`public-projections.ts`, `customer-view.ts`) ; fuite du détail de commande corrigée par le chantier prix ; le reste à vérifier route par route |
| 8.3.1 (L1) | autorisation dans une couche serveur de confiance | 3 | oui (API) ; les coquilles de back-office n'ont pas de garde serveur (`clerk-auth` § 10) |
| 8.3.2 (L3) | changements d'autorisation appliqués immédiatement | `clerk-auth` § 5 | fenêtre ≤ 60 s assumée |
| 8.4.1 (L2) | contrôles trans-tenant | 1, 2 | applicatif uniquement (pas de RLS) |
| 7.4.2 (L1) | fin des sessions d'un compte désactivé | `clerk-auth` | via bannissement Clerk + rétrogradation en base |
| 15.3.1 (L1) | ne renvoyer que les champs nécessaires | 5 | partiel |
| 15.3.3 (L2) | protection contre le mass assignment | 4 | Zod partout ; `.strict()` rare |
| 15.4.2 (L3) | vérification et action atomiques (TOCTOU) | 2 | `updateMany` scoppé dans les nouvelles routes ; `services/orders/transition.ts` (chantier prix) pour les statuts |
| 2.2.1 / 2.2.2 (L1) | validation positive côté serveur | 4 | Zod |
| 2.3.1 (L1) / 2.3.4 (L2) | ordre des étapes ; pas de double réservation | 6 | table `order-state-machine.ts` ; écriture conditionnelle du chantier prix |
| 2.4.1 (L2) | anti-automatisation | 12 | limiteur ouvert en cas de panne |
| 1.2.1 / 1.2.3 (L1) | encodage de sortie selon le contexte (HTML, JSON) | 10 | JSON-LD corrigé (0b69e39) ; autres contextes : registre privé du programme |
| 1.2.4 (L1) | requêtes paramétrées | `entrees-sorties.md` § 3 | `$queryRaw` gabarit uniquement, aucun `…Unsafe` |
| 1.3.4 (L2) | SVG utilisateur | 9 | SVG refusé |
| 1.3.6 (L2) / 13.2.4 (L2) | SSRF : liste blanche | 8 | listes blanches en place ; écarts : registre privé du programme |
| 3.4.1 (L1), 3.4.4, 3.4.5 (L2) | HSTS, nosniff, Referrer-Policy | — | conformes |
| 3.4.3 (L2) | CSP avec `object-src 'none'` et `base-uri 'none'` | `secrets-entetes-csp.md` § 3 | à durcir (registre privé du programme) |
| 3.4.6 (L2) | `frame-ancestors` | idem | XFO `DENY` présent (jugé obsolète par l'ASVS) ; `frame-ancestors` à poser avec le durcissement CSP |
| 5.2.1, 5.2.2 (L1) | taille et contenu des fichiers | 9 | conforme dans `uploads/product-image` |
| 5.2.6 (L3) | pixel flood | 9 | limite par défaut de `sharp` |
| 13.3.1 (L2) / 13.3.2 (L2) | gestion des secrets, moindre privilège | 11 | à confirmer avec le propriétaire (registre privé du programme) |
| 14.2.1 (L1) | pas de donnée sensible dans l'URL | 11 | exceptions : `?guestToken=`, `GET /api/test-mode/activate?secret=` |
| 15.1.1 (L1) | délais de correction des dépendances documentés | — | **à définir** avec le propriétaire |
| 16.5.1 (L2) | message d'erreur générique | — | `handleApiError` conforme |
