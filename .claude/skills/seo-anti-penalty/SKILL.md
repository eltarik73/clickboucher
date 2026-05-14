---
name: seo-anti-penalty
description: |
  Garde-fou anti-pénalité Google + Bing + FTC pour Klik&Go (et tout marketplace
  similaire). À INVOQUER systématiquement avant : ajout de reviews/ratings,
  création/modification de pages programmatic SEO, génération de contenu, ajout
  de schema.org JSON-LD, soumission GSC/Bing/IndexNow, modif sitemap/robots.
  Consolide les règles 2026 (FTC Reviews Rule août 2024 + Google Mars 2026 Core
  Update + Google Review Policy 2026 + Bing AI Performance) et l'historique des
  erreurs commises sur Klik&Go (mai 2026, 4 jours d'erreurs corrigées).
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Edit
  - WebSearch
---

# SKILL — SEO Anti-Pénalité Klik&Go (2026)

> **Mission** : éviter TOUTE pénalité Google/Bing/FTC sur klikandgo.app et
> garantir une croissance SEO saine sans "scaled thin content" / fake reviews.
>
> **Sources canoniques** :
>
> - [FTC Consumer Reviews and Testimonials Rule (août 2024)](https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers)
> - [Google Review Guidelines 2026 Update](https://searchlabdigital.com/blog/google-review-guidelines-2026-update/)
> - [Google March 2026 Core Update](https://www.clickrank.ai/google-march-2026-core-update/)
> - [SEORAF Programmatic SEO 2026](https://www.seoraf.com/programmatic-seo-template/)
> - [JourneyH Marketplace Playbook 2026](https://www.journeyh.io/blog/marketplace-seo-playbook)

---

## 🚨 RÈGLES ABSOLUES (= si je viole, le user me reprend)

### A. AUCUNE FAKE REVIEW (FTC Rule + Google Policy 2026)

**Sanctions** : jusqu'à **51 744 $/violation** (FTC) + 10% du CA mondial dérivé de pratiques trompeuses + suppression Google Business Profile + delisting.

**INTERDIT — sous toutes formes** :

- ❌ Inventer un "Yacine — Boucherie El Houda" qui n'existe pas (déjà commis, fix `f048ae3`)
- ❌ Reproduire le même testimonial sur 45 villes en variant juste `{city.name}` (Mars 2026 = pénalité scaled)
- ❌ Reviews écrites par employés / fondateur / famille / contractors
- ❌ aggregateRating sans reviews réelles agrégées (= rich snippet "spoofing")
- ❌ Demander aux clients de mentionner un staff name (nouvelle règle 2026)
- ❌ Pressuring clients sur place pour reviewer (nouvelle règle 2026)
- ❌ Reviews incentivisées (réduction, cadeau en échange)
- ❌ Multi-comptes / émulateurs / IA-generated reviews sans disclosure
- ❌ Spike soudain de reviews (pattern unnatural)

**AUTORISÉ** :

- ✅ Rétribution NON liée au contenu (ex : "écrivez une review honnête, vous gagnez 1€" → INTERDIT car incitatif. "Tous les clients reçoivent 1€ peu importe l'avis ou son existence" → OK)
- ✅ Manifeste signé "L'équipe Klik&Go" (pas de fausse identité, message factuel sur le service)
- ✅ Reviews vraies de clients vrais avec leur consentement explicite
- ✅ Hosting passif de reviews (Section 465.2(d) FTC) tant que Klik&Go n'écrit pas / n'achète pas

### B. AUCUN AGGREGATE RATING SANS REVIEWS RÉELLES

**Schema.org Rule** : `aggregateRating` doit refléter **des reviews vérifiables**.

```typescript
// ❌ INTERDIT
const schema = {
  "@type": "Product",
  aggregateRating: { ratingValue: 4.5, reviewCount: 12 }, // ← inventé
};

// ✅ OK : conditionnel sur reviews réelles
if (shop.reviews.length > 0) {
  schema.aggregateRating = {
    ratingValue: shop.avgRating, // calculé depuis prisma.review
    reviewCount: shop.reviews.length,
  };
}
```

**Garde-fou code** : avant tout schema avec `aggregateRating`, faire un `prisma.review.count({ where: { shopId } })`. Si `0`, NE PAS injecter `aggregateRating`.

### C. AUCUN REVIEW SUR ENTITÉ DUPLIQUÉE (Mars 2026)

**Erreur commise mai 2026** (commit `6e52544`) : 20 produits partageaient les mêmes 2 reviews shop → Google a ignoré tous les rich snippets Product.

**Règle correcte** :

- LocalBusiness/Store/FoodEstablishment : reviews **du commerce** (per-shop)
- Product : reviews **du produit spécifique** (per-product) — JAMAIS reviews du shop répétées
- Recipe : reviews **de la recette** (per-recipe)
- Service : reviews **du service** (per-service)

### D. PROGRAMMATIC SEO — AUCUNE PAGE THIN INDEXABLE (Mars 2026)

**Test à appliquer** : "Si l'AI Mode Google peut répondre aussi bien ou mieux que ma page en synthétisant d'autres sources, ma page est à risque."

**🚨 RÈGLE OR — NUANCE SUR LE noindex AUTO 🚨**

❌ **INTERDIT** : appliquer `noindex` automatique à TOUTES les pages programmatic sans réfléchir au contenu.

✅ **AUTORISÉ** : `noindex` ciblé selon la **densité de contenu unique par instance**.

**Le test décisif** (avant tout `if (count === 0) → noindex`) :

> "La page contient-elle ≥ 500 mots de contenu unique par instance (non-template) ?"
>
> - OUI → INDEX, même sans inventaire (page utile pour acquisition + ranking branding)
> - NON → noindex justifié

**Erreur commise 2026-05-10** (commit `4fc4897` revert de `018ba6a`) :
J'ai ajouté `if (shopCount === 0) → noindex` sur `/boucherie-halal/[ville]` qui avait pourtant 700+ mots de contenu unique par ville (`city.localContext` + `city.specialty` + `city.districts` + FAQ dynamique). Résultat : 5/6 villes SEO_CITIES sortent de l'index Google. User retombe sur "je ne trouve plus klikandgo quand je tape boucherie halal aix-les-bains alors qu'avant on trouvait". Coût : -ranking sur 5 mots-clés cibles + perte de confiance utilisateur. **À NE JAMAIS REPRODUIRE**.

**Règles nuancées** :

1. **Pages SEO ciblées BUSINESS-CRITICAL** (villes cibles, master pages, hubs) :
   - **TOUJOURS index**, MÊME si inventaire vide
   - Justification : contenu unique riche + objectif acquisition (boucher, partenaire) + ranking branding
   - Klik&Go : `/boucherie-halal/[ville]`, `/devenir-boucher-partenaire/[ville]`, `/boucheries-halal/[région]` = INDEX par défaut

2. **Pages programmatic "long-tail" sans contenu unique** (combinaisons multiples sans value-add) :
   - `noindex` justifié si l'instance n'ajoute rien aux pages parent
   - Klik&Go : `/produits/[meat]/[ville]/[district]` si vide × 100 combinaisons

3. **Pages avec contenu identique à 95%** entre instances → noindex sauf si ajout d'un bloc unique 200+ mots par instance

4. **Sitemap** : référencer TOUTES les pages indexables (inclure les villes principales même vides). **NE PAS** filter par `populatedSlugs` si la page contient du contenu unique.

5. **Avant tout `noindex` auto, demander au user** : "Cette page fait-elle partie du business-critical SEO ? Si oui je ne mets PAS noindex."

6. **Test obligatoire avant push** : `curl https://klikandgo.app/[page] | grep '<meta name="robots"'` — vérifier le résultat sur les villes principales attendues en index.

### E. AUCUN SOUS-DOMAINE TECHNIQUE INDEXÉ

- Sous-domaines auth (Clerk, Auth0) → `X-Robots-Tag: noindex, nofollow` côté reverse proxy
- Si déjà indexé → GSC > Suppressions > "tout ce qui commence par https://X" (renouveler tous les 6 mois)
- Klik&Go : prochain renouvellement `clerk.klikandgo.app` = **2026-11-08**

### F. SCHEMA.ORG — DONNÉES VÉRIFIABLES UNIQUEMENT

- ❌ `Event` sans `startDate` réel → use `WebPage`
- ❌ `Recipe` avec nutrition inventée → use estimation USDA documentée OU rien
- ❌ `Offer` avec `priceValidUntil` arbitraire → use date promo réelle
- ❌ `LocalBusiness.geo` avec lat/lng inventées (utiliser vraies coords ou ne pas mettre)
- ✅ Préférer un warning Google "champ manquant" à une pénalité fake content

---

## 📋 CHECKLIST avant CHAQUE action SEO

**Cette checklist DOIT être remplie mentalement avant tout commit touchant SEO.**

```
PRÉ-VOL :
[ ] Je viens de relire ce SKILL.md (ou je l'ai lu < 24h)
[ ] J'ai fait 1 WebSearch ciblée 2026 si action sur indexation/sitemap/robots/schemas
[ ] J'ai vérifié project_seo_rules_2026.md pour les règles spécifiques Klik&Go

CONTENU :
[ ] Aucune review/testimonial inventée (vérif grep "Yacine\|fake\|invent" dans le diff)
[ ] Aucun aggregateRating sans données réelles agrégées
[ ] Aucun pattern programmatic identique répété (test : 2 instances montrent-elles 90%+ contenu identique ?)
[ ] Si j'ajoute des pages programmatic : noindex auto si inventory=0 ?

CODE :
[ ] tsc --noEmit propre (hook le fait auto)
[ ] curl https://site/[page] | grep '<meta name="robots"' (vérifier après deploy)
[ ] Si schema modifié : valider sur https://validator.schema.org
[ ] Si reviews/ratings modifiés : test rich-results https://search.google.com/test/rich-results

POST-PUSH :
[ ] Vérifier GSC Coverage 24h après (pas de spike "Détectée non indexée")
[ ] Vérifier Bing Site Scan 7j après (pas de nouveau "thin content")
[ ] Documenter dans project_bing_daily_log.md (date + commit + impact attendu)
```

---

## 🛠️ ACTIONS TYPES — Patterns validés

### Action 1 — Ajouter un témoignage sur une page

```typescript
// ❌ JAMAIS
<blockquote>
  Avant Klik&Go, le samedi matin c'était la queue...
  <cite>Yacine, Boucherie El Houda</cite>  // ← inventé
</blockquote>

// ✅ OK : manifest signé Klik&Go (PAS une review, c'est notre voix)
<blockquote>
  Notre engagement à {city.name} : le samedi matin avec la file qui dépasse...
  <cite>L'équipe Klik&Go</cite>  // ← réel, c'est nous
</blockquote>

// ✅ OK : VRAIE review d'un VRAI partenaire (avec consentement écrit)
{shop.publicTestimonial && (
  <blockquote>
    {shop.publicTestimonial.quote}
    <cite>{shop.publicTestimonial.author}, {shop.name}</cite>
  </blockquote>
)}
```

### Action 2 — Schema review/aggregateRating

```typescript
// ✅ Pattern correct
const reviews = await prisma.review.findMany({ where: { shopId: shop.id } });
const aggregateRating =
  reviews.length > 0
    ? {
        "@type": "AggregateRating",
        ratingValue: (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1),
        reviewCount: reviews.length,
        bestRating: 5,
        worstRating: 1,
      }
    : undefined;

const schema = {
  "@context": "https://schema.org",
  "@type": "Store",
  // ... autres champs
  ...(aggregateRating && { aggregateRating }),
  ...(reviews.length > 0 && {
    review: reviews.slice(0, 5).map((r) => ({
      "@type": "Review",
      reviewRating: { "@type": "Rating", ratingValue: r.rating },
      author: { "@type": "Person", name: r.authorPublicName },
      datePublished: r.createdAt.toISOString().slice(0, 10),
      reviewBody: r.comment,
    })),
  }),
};
```

### Action 3 — Ajouter une page programmatic

```typescript
// generateMetadata
export async function generateMetadata({ params }): Promise<Metadata> {
  const inventoryCount = await prisma.[entity].count({
    where: { /* filter par params */, visible: true },
  });
  const shouldNoIndex = inventoryCount === 0;

  return {
    title: ...,
    description: ...,
    ...(shouldNoIndex && { robots: { index: false, follow: true } }),
  };
}

// sitemap.ts
const populatedSlugs = new Set(
  (await prisma.[entity].groupBy({
    by: ['slug'],
    where: { visible: true },
    _count: true,
  })).map(g => g.slug)
);
const pages = SEO_THINGS
  .filter(t => populatedSlugs.has(t.slug))
  .map(t => ({ url: ..., lastModified: ..., priority: 0.7 }));
```

### Action 4 — Soumission URL à GSC/Bing/IndexNow

```bash
# Avant submission, vérifier qu'on ne soumet pas une page noindex
curl -s https://klikandgo.app/[page] | grep -E '<meta[^>]*name="robots"[^>]*>'

# Si noindex visible → STOP, ne pas soumettre
# Si index/follow → OK, soumettre via :
# - GSC : Inspection URL > Demander indexation (UI manuel ~10/jour)
# - Bing API : POST /SubmitUrlBatch (script bing-daily-audit.ts)
# - IndexNow : POST api.indexnow.org/IndexNow
```

---

## 🧪 AUDIT SCRIPTS UTILES

```bash
# 1. Chercher témoignages fake potentiels (à RUN avant chaque commit qui touche reviews/testimonials)
grep -rn -E "Yacine|Mohamed.*Boucherie|[A-Z][a-z]+ — Boucherie" src/app src/components --include="*.tsx" 2>/dev/null

# 2. Chercher aggregateRating sans condition reviews
grep -rn -B 2 -A 5 "aggregateRating" src/components/seo --include="*.tsx" | grep -v "reviews.length\|reviewCount: 0"

# 3. Chercher pages programmatic sans noindex auto
grep -rln "SEO_CITIES\|SEO_DISTRICTS\|generateStaticParams" src/app --include="*.tsx" | while read f; do
  if ! grep -q "shouldNoIndex\|robots: { index: false" "$f"; then
    echo "⚠️ POTENTIEL programmatic sans noindex auto : $f"
  fi
done

# 4. Vérifier sitemap filter par populated
grep -A 3 "SEO_CITIES\.map\|SEO_DISTRICTS\.map" src/app/sitemap.ts | grep -v "filter\|populated"
```

---

## 📚 LEÇONS DE MES ERREURS PASSÉES (à NE PLUS reproduire)

| Date           | Erreur                                                                                                                                                                                                                          | Coût                                                   | Fix                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 2026-05-02     | Retiré noindex sur villes vides → 247 pages "Détectée non indexée"                                                                                                                                                              | 4 jours bruit thin                                     | commit `90258b6` reverted                                                                          |
| 2026-05-04     | Créé 8 villes programmatic SEO sans inventory → +178 "Détectée non indexée"                                                                                                                                                     | bruit thin domain                                      | commit `1716b9f` rollback partial                                                                  |
| 2026-05-06     | 20 Products partagent mêmes reviews shop → Google ignore tous les Product rich snippets                                                                                                                                         | 100% rich snippets perdus                              | commit `6e52544` reviews migrées vers ShopSchema                                                   |
| 2026-05-09     | Témoignage "Yacine Boucherie El Houda" identique sur 45 pages /devenir-boucher-partenaire/[ville]                                                                                                                               | risque pénalité Mars Core                              | commit `f048ae3` remplacé par "L'équipe Klik&Go" + noindex auto                                    |
| **2026-05-10** | **🚨 noindex auto sur /boucherie-halal/[ville] alors que pages contiennent 700+ mots unique → 5/6 villes SEO_CITIES sortent de l'index Google. User retombe : "je ne trouve plus klikandgo sur boucherie halal aix-les-bains"** | **-ranking 5 mots-clés cibles + perte confiance user** | **commit `4fc4897` REVERT noindex + sitemap inclut toutes SEO_CITIES + règle OR ajoutée au skill** |

**Pattern récurrent** : "ajout sans vérifier les algos 2026". Le hook PreToolUse ne suffit pas si je n'ai pas RELU ce skill avant. **Ce skill DOIT être consulté chaque session SEO.**

---

## 🔁 Renouvellements à programmer

- **2026-05-31** : audit Bing Site Scan post-cleanup (vérifier 0 pages thin)
- **2026-06-01** : bumper Aïd al-Adha eventStart vers 1448 AH
- **2026-08-09** : revue trimestrielle FTC + Google Policy (vérifier nouvelles règles)
- **2026-11-08** : renouveler suppression GSC `clerk.klikandgo.app`

---

## 🚦 Mode d'emploi du skill

1. **À chaque début de session SEO** : lire ce SKILL.md en entier
2. **Avant chaque commit SEO** : remplir mentalement la checklist + run scripts d'audit
3. **Après chaque deploy SEO** : `curl + grep` les pages modifiées + vérifier GSC J+1
4. **Si je détecte une violation** : STOP, fix immédiatement, documenter dans le log Bing daily

**Si je n'ai pas la place mentale pour suivre ce skill : ne pas pusher.** Mieux vaut différer que pénaliser.
