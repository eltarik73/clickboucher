# Constats — état au 2026-11-14 (version publiable)

Relevés par lecture du code de la branche de travail (HEAD 32c581f + chantier « prix des
commandes ») et par la base d'avis GitHub ; relus ligne à ligne par le vérificateur le
2026-11-14. **Daté** : à revérifier avant d'agir, les lignes bougent (le chantier réécrit
`orders/**` et `products/**`). Aucun constat n'a été rejoué contre la production. Gravité estimée
pour notre contexte (marketplace, données de boutiques et de clients), pas un score CVSS.

Le dépôt est public : les constats de sécurité **encore ouverts** (dépendances, en-têtes et CSP,
requêtes sortantes, fichiers reçus, e-mails, jetons, limites de débit, comparaisons de secrets)
sont tenus dans le registre privé du programme, avec fichiers, lignes et correctifs attendus. Ne
pas les recopier ici, dans une PR ou dans un message de commit avant leur correctif ; une fois
corrigés, ils peuvent figurer ci-dessous avec la mention « corrigé » et le commit.

Constats d'authentification (webhook Clerk, `requireAdmin`, invalidation des caches de rôle) :
voir `clerk-auth`, § 8 et `references/roles-et-synchronisation.md`.

| # | Gravité | Constat | Où | État / correctif attendu |
|---|---|---|---|---|
| K2 | Élevée | JSON-LD rendu avec `JSON.stringify` sans échapper `<`, alimenté par des champs saisis par des tiers (boutiques, produits, avis) : XSS stocké possible sur les pages publiques [S12] | composants `src/components/seo/*Schema.tsx` et blocs en ligne des pages SEO | **corrigé** (0b69e39) : `serializeJsonLd()` (`src/lib/seo/jsonld/serialize.ts`) et `<JsonLd>` (`src/components/seo/JsonLd.tsx`) ; garde-fou `src/lib/__tests__/json-ld.test.ts` |
| K4 | Moyenne | `GET /api/orders/[id]` renvoyait `items: { include: { product: true } }` (ligne `Product` entière dont `proPriceCents`) ainsi que `shop.ownerId` et `user.clerkId` | `orders/[id]/route.ts` | **corrigé** (chantier prix) : portée de l'appelant dans le `where`, projection client `src/lib/services/orders/customer-view.ts` |
| K8 | Moyenne | Contrôle de propriété « charger puis comparer » (`findUnique({ id })` puis `if`), écriture non scoppée, 403 au lieu de 404 — correct tant que le `if` existe, mais fragile | `boucher/catalogue/[productId]/route.ts:33-43`, `boucher/images/[id]`, `products/[id]` (`PATCH`), `uploads/product-image` ; `boucher/orders/[orderId]/action` et `orders/[id]` (`GET`) passés à la forme cible par le chantier prix | forme cible à chaque retouche, avec test « mauvais tenant » ; pas de réécriture en masse sans tests |
| K10 | Faible | `handleApiError` reconnaît « introuvable » par un texte que le moteur Prisma 6.19.2 n'émet plus : `update`/`delete` sans correspondance ⇒ 500 + Sentry [L5] | `lib/api/errors.ts:159-162` | détecter `P2025` par code (`isNotFound`) ou `updateMany` + `count` |
| K16 | À vérifier | `Permissions-Policy: camera=()` alors que le mode cuisine scanne des QR codes par la caméra | `next.config.mjs:91-93`, `components/boucher/QRScanner.tsx:56-61` | tester sur tablette ; `camera=(self)` si le scan échoue |
| K17 | À vérifier | Plausible chargé depuis `https://plausible.io` mais absent de `script-src`/`connect-src` | `components/AnalyticsConsent.tsx:65` | ajouter l'hôte si `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` est défini |

Méthode pour clore un constat : branche dédiée, test qui échoue d'abord (mauvais tenant, champ
interdit, chaîne `</script>`), correctif, check-list `checklist-revue-route.md`, puis mise à jour
du registre privé (date, commit) et, une fois le correctif en production, de ce fichier.
