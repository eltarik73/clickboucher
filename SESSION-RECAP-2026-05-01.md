# Session recap — 1er mai 2026

> Document de continuité contextuelle pour Tarik (eltarik73) et futures conversations Claude.
> Snapshot complet de la grosse session du 1er mai 2026.

---

## TL;DR

**17 commits poussés sur main**, ~10 000 lignes nettes ajoutées. Score code 8.5 → 9.5/10. PSI Desktop SEO 100/100. Drop complet du modèle subscription, passage commission-only. Pipeline acquisition boucheries A→E livré (CRM + scraper + parrainage + 12 SEO pages + email automation). SEO/GEO 2026 complet (Bing, IndexNow, llms.txt, AI crawlers).

---

## Commits (du plus ancien au plus récent)

| #   | SHA       | Description                                                         |
| --- | --------- | ------------------------------------------------------------------- |
| 1   | `98a123d` | fix(api): /api/shops?owned=true test mode boucher (BUG #17)         |
| 2   | `d6d1589` | fix(api): test mode boucher ownership checks (BUG #18-21, 6 routes) |
| 3   | `d0fcce5` | feat(business): remove subscription tiers — commission-only         |
| 4   | `ae4b072` | feat(db): drop subscriptions + plan_features tables                 |
| 5   | `0abb57b` | feat(boucher): aperçu items sur card PENDING (Mode Cuisine)         |
| 6   | `d57d6c1` | chore(audit): cleanup business model incoherences (32 files)        |
| 7   | `9ed655d` | feat(design): premium dark pricing card on /espace-boucher          |
| 8   | `4328030` | docs(infra): clarify Railway = DB only, Vercel = frontend           |
| 9   | `3c2c54a` | feat(seo): round HIGH — fix audit findings #1-#11                   |
| 10  | `415fc26` | feat(seo): round GEO/AIO 2026 — IndexNow + llms.txt + AI crawlers   |
| 11  | `e3ee7de` | feat(seo): Bing/Google/Yandex site verification env vars            |
| 12  | `6e068fb` | feat(seo): add BingSiteAuth.xml                                     |
| 13  | `4e04061` | feat(growth): pipeline acquisition boucheries — 5 livrables A→E     |
| 14  | `7fee7d1` | feat(quality): tests + CI + monitoring + docs (8.5 → 9.5/10)        |

(+ 3 commits techniques de batch en début de journée)

---

## Décisions business majeures

### 1. Drop complet du modèle subscription

**Avant :** forfaits Essentiel/Premium/Entreprise (49€/99€/199€/mois).
**Après :** commission-only via Stripe Connect + 0,99€ frais de service côté client.
**Why :** les forfaits contredisaient le vrai modèle Stripe Connect. Source de confusion partout (UI, copy, DB).
**Impact :**

- Drop tables Prisma `Subscription` + `PlanFeature` (migration `20260501123952_add_prospects` + drop précédent)
- Cleanup 32 fichiers (commit `d57d6c1`)
- Refonte complète `/espace-boucher` (carte premium dark)
- Refonte `/inscription-boucher` (suppression forfait hardcodés)

### 2. Pipeline acquisition boucheries (passage 11 → 50)

**Why :** Tarik est solo founder. TAM 5500 boucheries halal France / 600 Rhône-Alpes. Le projet bloque sur l'acquisition. Besoin d'outillage scalable.

**Livrables A→E :**

- **A.** Script scraper Google Places (`scripts/prospect-scraper.ts`, 461 lignes)
- **B.** CRM `/webmaster/prospects` (UI + 4 routes API)
- **C.** Programme parrainage boucher (existant, formalisé)
- **D.** 12 pages SEO acquisition `/devenir-boucher-partenaire/[ville]`
- **E.** Email automation Resend + cron quotidien 9h UTC

Détails complets dans la mémoire `project_growth_pipeline.md`.

### 3. Suppression service Railway obsolète

Tarik ne tournait plus sur Railway pour le frontend (migré sur Vercel) mais le service `clickboucher` Railway envoyait toujours des emails de build failed et facturait pour rien.
**Action :** suppression service Railway `clickboucher` (Next.js). Conservation Railway = DB PostgreSQL UNIQUEMENT.

---

## Quality push (8.5 → 9.5/10)

Commit `7fee7d1` — réponse à l'audit VC initial qui notait "pas de tests automatisés" comme red flag #1.

### Tests

- Vitest 4 setup (`vitest.config.ts`)
- 270 tests passent dans 12 fichiers (`src/lib/__tests__/`)
- Coverage v8 (text + html + lcov)
- Helpers extraits : `src/lib/format-kitchen.ts`

### CI/CD

- GitHub Actions `.github/workflows/ci.yml` (3 jobs parallèles : lint, type-check, tests)
- Husky pre-commit + commit-msg (Conventional Commits enforced)
- Prettier config

### Monitoring

- Sentry 3 environnements (client, server, edge)
- Source maps uploadées au build

### Docs

- `ARCHITECTURE.md` (264 lignes) — architecture complète
- `CONTRIBUTING.md` (180 lignes) — guidelines contribution
- `CLAUDE.md` mis à jour avec sections Tests, CI/CD, Monitoring, GEO/AIO

---

## SEO/GEO 2026

### Round HIGH (commit `3c2c54a`)

- Sitemap nettoyé (4 doublons www supprimés)
- Title template global, metadataBase, canonical auto
- noindex sur pages privées
- 6 pages ville `/boucherie-halal/[ville]` avec FAQPage schema
- ProductSchema + ShopSchema + BreadcrumbSchema + OrganizationSchema

### Round GEO/AIO (commit `415fc26`)

- `public/llms.txt` — description site pour LLMs
- IndexNow protocol — clé `b358f6bef780cfa8abcef149668adb3e68c093e8b6e586fc1f9d4347455a64e2`
- Helper `src/lib/indexnow.ts` (pingIndexNow, pingIndexNowBatch)
- LastUpdated component (signal fraîcheur)
- 9 règles AI crawlers explicitement autorisées dans robots.ts (GPTBot, ClaudeBot, Google-Extended, Perplexity, etc.)

### Bing Webmaster (commits `e3ee7de` + `6e068fb`)

- Compte créé sous `contact@klikandgo.app`
- Verification XML : `BingSiteAuth.xml` content `A55E1CAA7926E5B5EB0AF52A163E48CB`
- Sitemap soumis OK
- Env vars `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`, `YANDEX_VERIFICATION` dans `layout.tsx`

### Scores PSI

- **Desktop :** Performances 89, Accessibilité 100, Bonnes pratiques 100, **SEO 100/100**
- **Mobile :** Performances 85 (LCP 4.2s à fix — 207 Kio JS unused + 520ms CSS bloquant)

### État GSC

- 6 → 10 pages indexées (4 nouvelles dans la journée du 1er mai)
- 60 pages "Détectées non indexées" — site jeune, vont s'indexer progressivement
- Indexation manuelle quotidienne ~5-7 URLs/jour

---

## UX

### Mode Cuisine (`0abb57b`)

- Aperçu items sur card PENDING (avant : il fallait cliquer pour voir)
- Format : 3 premiers items + "...et X autres"

### Pricing card `/espace-boucher` (`9ed655d`)

- Refonte complète, style premium dark
- Référence design : carte glass-morphism

---

## Bugs corrigés (test mode)

Pattern récurrent : routes utilisant `auth()` Clerk au lieu de `getServerUserId()` cassent le test mode. Et ownership checks sans OR clause `clerkId | dbUser.id` cassent aussi.

- BUG #17 : `/api/shops?owned=true`
- BUG #18-21 : `/api/orders/[id]`, `[id]/status`, `products/reorder`, `pro-requests`, `support/ai-respond`, `uploads/product-image`

Tous corrigés avec helpers `getBoucherOwnerUserId()` ajoutés.

---

## Reste à faire (next session priorité)

1. **Fix LCP mobile** (PSI Mobile 85 → 95+) — code-split JS bundle, defer non-critical CSS
2. **Indexation manuelle GSC** — continuer ~5-7/jour pour couvrir les 60 pages détectées
3. **Yandex Webmaster** — env var prête, ajouter verification
4. **Tester scraper Google Places en réel** — `npm run prospect -- --city="Lyon" --radius=15` (besoin clé `GOOGLE_PLACES_API_KEY`)
5. **Setup cron Vercel** — vérifier que `/api/cron/prospect-relances` fire bien à 9h UTC

---

## Stats projet (au 1er mai 2026)

- **92K+ lignes de code** (3 mois calendaires, 39 jours actifs)
- **560+ commits** sur main
- **Équivalent agence :** ~500K€ (estimation)
- **Note globale (audit VC) :** 9.5/10 (vs 6.4/10 initial)
- **Tests :** 270 passing
- **CI :** GitHub Actions verte

---

## Comptes / accès

- **GitHub :** `eltarik73` (commit author = `contact@klikphone.com`)
- **Vercel :** `contact@klikandgo.app` (auto-deploy push main)
- **Railway :** DB PostgreSQL only
- **Bing Webmaster :** `contact@klikandgo.app`
- **GSC :** `contact@bativio.fr` (multi-comptes Tarik), propriété sc-domain
- **IndexNow key :** `b358f6bef780cfa8abcef149668adb3e68c093e8b6e586fc1f9d4347455a64e2`
- **Bing site auth :** `A55E1CAA7926E5B5EB0AF52A163E48CB`

---

## Ressources persistées

- **Mémoire locale Claude Code :** `~/.claude/projects/-Users-macbook-Desktop-clickboucher/memory/` — 14 fichiers + index
- **Ce fichier :** repo root pour reprise contexte par futur Claude
- **Audit migrations :** `audit/migrations.md`
- **CLAUDE.md :** instructions repo (vérité technique)
