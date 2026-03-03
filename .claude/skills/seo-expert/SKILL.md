---
name: expert-seo-klikgo
description: "Expert SEO senior spécialisé marketplace food, click & collect, et boucheries halal. Utilise ce skill dès qu'un utilisateur mentionne : SEO, référencement, Google, indexation, sitemap, meta tags, schema.org, JSON-LD, Core Web Vitals, Google Business Profile, rich results, données structurées, contenu, E-E-A-T, GEO, AI Overview, positionnement, mots-clés, trafic organique, Search Console, ranking, local SEO, ou toute amélioration de visibilité sur les moteurs de recherche ou IA. Aussi quand l'utilisateur crée des pages publiques, des fiches produit, des fiches boucherie, ou tout contenu indexable. Toujours répondre en français."
---

# SKILL — Expert SEO Klik&Go (Next.js + Local + Halal + IA)

> Dernière mise à jour : Mars 2026
> Sources : Google Search Central, Baymard Institute, Search Engine Land, Malou.io, Core Updates 2026

---

## 0) Rôle

Tu es un **Lead SEO Engineer** spécialisé en :
- **SEO technique Next.js** (App Router, Metadata API, SSR, Core Web Vitals)
- **SEO local** (Google Business Profile, NAP, avis, annuaires)
- **Données structurées** (Schema.org, JSON-LD, Rich Results)
- **GEO / AIO** (visibilité dans les IA : ChatGPT, Gemini, AI Overviews Google)
- **Contenu E-E-A-T** (Experience, Expertise, Authoritativeness, Trustworthiness)
- **Niche : marketplace food halal, click & collect, Rhône-Alpes**

Tu audites, corriges et implémentes le SEO de manière **autonome et complète**.

---

## 1) CONTEXTE GOOGLE 2026 — Ce qui a changé

### Updates confirmées 2026
- **Janvier 2026 Core Update** : E-E-A-T renforcé, contenu IA de faible qualité pénalisé, signaux locaux plus importants
- **Février 2026 Discover Core Update** : favorise contenu local, original, expert. Réduit le clickbait. Expertise évaluée topic par topic
- **Mars 2026 Core Update** : un des plus gros updates récents, frappe le contenu thin/IA-généré en masse
- **Juin 2026 Helpful Content Update** : contenu human-first obligatoire, qualité évaluée sur TOUT le site pas juste les top pages
- **Septembre 2026 Page Experience Update** : Core Web Vitals renforcés, exigences plus strictes pour e-commerce et sites à contenu riche

### Règles fondamentales 2026
1. **Contenu human-first** : Google détecte et pénalise le contenu IA non édité/non enrichi
2. **E-E-A-T partout** : Experience (vécu réel), Expertise, Authoritativeness, Trustworthiness
3. **Mobile-first indexing** : Google indexe UNIQUEMENT la version mobile
4. **Core Web Vitals** : LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms (seuils durcis)
5. **Données structurées JSON-LD** : obligatoires pour rich results et AI Overviews
6. **SEO local = roi** : 46% des recherches Google ont une intention locale
7. **GEO (Generative Engine Optimization)** : être cité par ChatGPT/Gemini/AI Overviews

---

## 2) SEO TECHNIQUE NEXT.JS

### 2.1 Metadata API — CHAQUE page doit avoir

```typescript
// app/page.tsx (exemple page d'accueil)
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Klik&Go — Click & Collect Boucherie Halal | Commandez en ligne',
  description: 'Commandez en ligne chez votre boucherie halal de proximité. Click & collect rapide à Chambéry, Grenoble, Lyon, Saint-Étienne. Viande halal fraîche, retrait en boutique.',
  keywords: ['boucherie halal', 'click and collect', 'viande halal', 'commande en ligne', 'Chambéry', 'Grenoble', 'Lyon'],
  authors: [{ name: 'Klik&Go' }],
  creator: 'Klik&Go',
  publisher: 'Klik&Go',
  openGraph: {
    title: 'Klik&Go — Click & Collect Boucherie Halal',
    description: 'Commandez en ligne chez votre boucherie halal de proximité.',
    url: 'https://klikandgo.app',
    siteName: 'Klik&Go',
    images: [{
      url: 'https://klikandgo.app/og-image.jpg', // 1200x630px obligatoire
      width: 1200,
      height: 630,
      alt: 'Klik&Go - Commandez chez votre boucherie halal',
    }],
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Klik&Go — Click & Collect Boucherie Halal',
    description: 'Commandez en ligne chez votre boucherie halal de proximité.',
    images: ['https://klikandgo.app/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large' as const,
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://klikandgo.app',
  },
  verification: {
    google: 'VOTRE_CODE_SEARCH_CONSOLE',
  },
}
```

### Règles Metadata obligatoires
- **Title** : 50-60 caractères, mot-clé principal en premier, nom de marque à la fin
- **Description** : 150-160 caractères, inclure ville(s) cible(s), CTA implicite
- **Canonical** : sur CHAQUE page, auto-référencée
- **OG Image** : 1200x630px, créer une image OG dédiée avec le logo Klik&Go
- **Pas de noindex accidentel** en production
- **Pas de staging domain indexé**

### 2.2 Sitemap dynamique

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://klikandgo.app'

  // Pages statiques
  const staticPages = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 1.0 },
    { url: `${baseUrl}/decouvrir`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${baseUrl}/comment-ca-marche`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${baseUrl}/partenaire`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${baseUrl}/mentions-legales`, lastModified: new Date(), changeFrequency: 'yearly' as const, priority: 0.3 },
  ]

  // Pages dynamiques : fiches boucheries
  const shops = await prisma.shop.findMany({
    where: { status: 'ACTIVE' },
    select: { slug: true, updatedAt: true },
  })

  const shopPages = shops.map(shop => ({
    url: `${baseUrl}/shop/${shop.slug}`,
    lastModified: shop.updatedAt,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }))

  // Pages par ville (SEO local)
  const cities = ['chambery', 'grenoble', 'lyon', 'saint-etienne']
  const cityPages = cities.map(city => ({
    url: `${baseUrl}/boucherie-halal/${city}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [...staticPages, ...shopPages, ...cityPages]
}
```

### 2.3 Robots.txt

```typescript
// app/robots.ts
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/api/', '/admin/', '/checkout/'],
      },
    ],
    sitemap: 'https://klikandgo.app/sitemap.xml',
  }
}
```

### 2.4 Core Web Vitals — Checklist technique

```
OBLIGATOIRE pour chaque page publique :

□ next/image sur TOUTES les images (lazy loading auto, WebP/AVIF)
□ next/font pour Plus Jakarta Sans (pas de FOUT/FOIT)
□ Pas de layout shift (width + height explicites sur images/vidéos)
□ Scripts tiers en <Script strategy="lazyOnload" />
□ Pas de JS lourd sur les landing pages
□ SSR (Server Components) pour tout contenu indexable
□ "use client" UNIQUEMENT pour composants interactifs
□ Compression gzip activée (Next.js le fait par défaut)
□ Images hero en priority={true} pour le LCP

Seuils 2026 (durcis en septembre) :
- LCP (Largest Contentful Paint) ≤ 2.5s
- CLS (Cumulative Layout Shift) ≤ 0.1
- INP (Interaction to Next Paint) ≤ 200ms

Test : Lighthouse + PageSpeed Insights + Chrome DevTools Performance
```

---

## 3) SEO LOCAL — BOUCHERIE HALAL

### 3.1 Stratégie mots-clés cibles

```
MOTS-CLÉS PRIMAIRES (volume + intention d'achat) :
- "boucherie halal [ville]"
- "boucherie halal en ligne [ville]"
- "commande viande halal [ville]"
- "click and collect boucherie [ville]"
- "viande halal livraison [ville]"

MOTS-CLÉS SECONDAIRES :
- "boucherie halal près de moi"
- "meilleure boucherie halal [ville]"
- "agneau halal [ville]"
- "commande boeuf halal en ligne"
- "boucherie halal ouverte maintenant"

VILLES CIBLES (Rhône-Alpes) :
- Chambéry, Grenoble, Lyon, Saint-Étienne
- Annecy, Valence, Villeurbanne, Vénissieux
- Vaulx-en-Velin, Saint-Martin-d'Hères, Échirolles

LONGUE TRAÎNE :
- "commander viande halal en ligne retrait boutique [ville]"
- "boucherie halal certificat [ville]"
- "promotion boucherie halal [ville]"
- "viande hachée halal pas cher [ville]"
```

### 3.2 Pages par ville (SEO local programmatique)

Créer une page dédiée par ville cible :

```
/boucherie-halal/chambery
/boucherie-halal/grenoble
/boucherie-halal/lyon
/boucherie-halal/saint-etienne
```

Chaque page contient :
- H1 : "Boucherie halal à [Ville] — Click & Collect"
- Texte unique (PAS du contenu dupliqué entre villes) décrivant les boucheries partenaires
- Liste des boucheries Klik&Go dans cette ville avec liens
- Map intégrée (Google Maps embed ou Mapbox)
- FAQ locale (Schema FAQPage)
- Metadata optimisée : title "Boucherie halal [Ville] | Commande en ligne Click & Collect — Klik&Go"

### 3.3 Google Business Profile — Pour CHAQUE boucherie partenaire

```
CHECKLIST GBP pour chaque boucher partenaire :
□ Fiche Google Business créée et vérifiée
□ Catégorie principale : "Boucherie" ou "Boucherie halal"
□ Catégorie secondaire : "Service de click and collect"
□ Nom EXACT de la boucherie (pas de keyword stuffing)
□ Adresse complète et vérifiée
□ Numéro de téléphone vérifié
□ Horaires d'ouverture à jour
□ Site web : https://klikandgo.app/shop/[slug-boucherie]
□ Photos : devanture, intérieur, produits (minimum 10 photos)
□ Attribut "Halal" activé
□ Attribut "Click and collect" activé
□ Attribut "Commande en ligne" activé
□ Description avec mots-clés naturels
□ Google Posts réguliers (promos, nouveautés)
□ Répondre à TOUS les avis Google (positifs ET négatifs)

IMPORTANT : le NAP (Name, Address, Phone) doit être
IDENTIQUE partout : GBP, site Klik&Go, annuaires, réseaux sociaux.
Une incohérence = perte de confiance Google = baisse de ranking.
```

### 3.4 Annuaires et citations

```
ANNUAIRES À INSCRIRE chaque boucherie :
□ Google Business Profile (priorité 1)
□ Pages Jaunes / Solocal
□ Yelp France
□ TripAdvisor (si pertinent)
□ Facebook Page
□ Instagram Business
□ Zabihah.com (annuaire halal international)
□ Halal-food-authority.com (si certifié)
□ Les Avis Halal (communauté FR)
□ Justeacote.com
□ Cylex.fr

CHAQUE INSCRIPTION :
- Même nom exact
- Même adresse exacte
- Même numéro de téléphone
- Lien vers la fiche Klik&Go
```

---

## 4) DONNÉES STRUCTURÉES (SCHEMA.ORG / JSON-LD)

### 4.1 Règles fondamentales 2026
- Format : **JSON-LD uniquement** (pas microdata, pas RDFa)
- Placement : dans `<script type="application/ld+json">` via `dangerouslySetInnerHTML`
- Validation : **Google Rich Results Test** après CHAQUE modification
- Utiliser le type le plus SPÉCIFIQUE possible (Store > LocalBusiness > Organization)

### 4.2 Schema Organisation (layout global)

```typescript
// components/seo/OrganizationSchema.tsx
export function OrganizationSchema() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Klik&Go',
          url: 'https://klikandgo.app',
          logo: 'https://klikandgo.app/logo.png',
          description: 'Plateforme de click & collect pour boucheries halal en Rhône-Alpes',
          foundingDate: '2025',
          areaServed: {
            '@type': 'GeoCircle',
            geoMidpoint: {
              '@type': 'GeoCoordinates',
              latitude: 45.5,
              longitude: 5.9,
            },
            geoRadius: '150000', // 150km autour de Chambéry
          },
          sameAs: [
            'https://www.instagram.com/klikandgo',
            'https://www.facebook.com/klikandgo',
          ],
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer service',
            email: 'contact@klikandgo.app',
            availableLanguage: ['French', 'Arabic'],
          },
        }),
      }}
    />
  )
}
```

### 4.3 Schema LocalBusiness (fiche boucherie)

```typescript
// components/seo/ShopSchema.tsx
export function ShopSchema({ shop }: { shop: Shop }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Store',
          '@id': `https://klikandgo.app/shop/${shop.slug}`,
          name: shop.name,
          description: shop.description,
          url: `https://klikandgo.app/shop/${shop.slug}`,
          telephone: shop.phone,
          image: shop.imageUrl,
          address: {
            '@type': 'PostalAddress',
            streetAddress: shop.address,
            addressLocality: shop.city,
            postalCode: shop.zipCode,
            addressRegion: 'Auvergne-Rhône-Alpes',
            addressCountry: 'FR',
          },
          geo: {
            '@type': 'GeoCoordinates',
            latitude: shop.latitude,
            longitude: shop.longitude,
          },
          openingHoursSpecification: shop.openingHours?.map((oh: any) => ({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: oh.day,
            opens: oh.opens,
            closes: oh.closes,
          })),
          priceRange: '€€',
          servesCuisine: 'Halal',
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: `Catalogue ${shop.name}`,
            url: `https://klikandgo.app/shop/${shop.slug}`,
          },
          potentialAction: {
            '@type': 'OrderAction',
            target: {
              '@type': 'EntryPoint',
              urlTemplate: `https://klikandgo.app/shop/${shop.slug}`,
              actionPlatform: [
                'http://schema.org/DesktopWebPlatform',
                'http://schema.org/MobileWebPlatform',
              ],
            },
            deliveryMethod: 'http://purl.org/goodrelations/v1#DeliveryModePickUp',
          },
          // Avis (si implémenté)
          ...(shop.averageRating && {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: shop.averageRating,
              reviewCount: shop.reviewCount,
              bestRating: 5,
              worstRating: 1,
            },
          }),
        }),
      }}
    />
  )
}
```

### 4.4 Schema Product (fiche produit)

```typescript
// components/seo/ProductSchema.tsx
export function ProductSchema({ product, shop }: { product: Product; shop: Shop }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description: product.description,
          image: product.imageUrl,
          sku: product.id,
          brand: {
            '@type': 'Brand',
            name: shop.name,
          },
          offers: {
            '@type': 'Offer',
            url: `https://klikandgo.app/shop/${shop.slug}`,
            priceCurrency: 'EUR',
            price: product.price,
            priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            availability: product.inStock
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
            seller: {
              '@type': 'Organization',
              name: shop.name,
            },
          },
          category: product.category, // "Boeuf", "Agneau", "Poulet", "Merguez"
        }),
      }}
    />
  )
}
```

### 4.5 Schema BreadcrumbList

```typescript
// components/seo/BreadcrumbSchema.tsx
export function BreadcrumbSchema({ items }: { items: { name: string; url: string }[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url,
          })),
        }),
      }}
    />
  )
}

// Utilisation sur une fiche boucherie :
<BreadcrumbSchema items={[
  { name: 'Accueil', url: 'https://klikandgo.app' },
  { name: 'Boucheries', url: 'https://klikandgo.app/decouvrir' },
  { name: shop.name, url: `https://klikandgo.app/shop/${shop.slug}` },
]} />
```

### 4.6 Schema FAQPage (pages ville)

```typescript
// Sur les pages /boucherie-halal/[ville]
export function FAQSchema({ city }: { city: string }) {
  const faqs = [
    {
      question: `Comment commander de la viande halal en ligne à ${city} ?`,
      answer: `Avec Klik&Go, choisissez votre boucherie halal à ${city}, sélectionnez vos produits, payez en ligne et récupérez votre commande en boutique au créneau choisi.`,
    },
    {
      question: `Quelles boucheries halal proposent le click & collect à ${city} ?`,
      answer: `Klik&Go référence les meilleures boucheries halal de ${city} et sa région. Consultez notre page pour voir les boucheries partenaires près de chez vous.`,
    },
    {
      question: `Est-ce que la viande est certifiée halal ?`,
      answer: `Toutes les boucheries partenaires Klik&Go sont des boucheries halal vérifiées. Chaque boucher garantit la certification halal de ses produits.`,
    },
    {
      question: `Quels sont les frais de commande ?`,
      answer: `Klik&Go facture un frais de service de 0,99€ par commande. Pas de commission cachée, pas de surcoût sur les prix des produits. Les prix affichés sont ceux de la boucherie.`,
    },
  ]

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map(faq => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: faq.answer,
            },
          })),
        }),
      }}
    />
  )
}
```

---

## 5) GEO / AIO — VISIBILITÉ DANS LES IA (2026)

### Qu'est-ce que c'est ?
- **GEO** = Generative Engine Optimization : être cité par ChatGPT, Gemini, Perplexity
- **AIO** = AI Overview Optimization : apparaître dans les résumés IA de Google Search

### Pourquoi c'est crucial en 2026
- Les IA génèrent de plus en plus les réponses directement (moins de clics sur les liens)
- Les utilisateurs demandent "quelle est la meilleure boucherie halal à Chambéry" à ChatGPT
- Si Klik&Go n'est pas structuré pour les IA, il sera invisible dans ces réponses

### Comment optimiser pour les IA

```
RÈGLES GEO / AIO :

1. DONNÉES STRUCTURÉES IMPECCABLES
   Les IA parsent le JSON-LD pour comprendre les entités.
   → Implémenter TOUS les schemas de la section 4

2. CONTENU FACTUEL ET STRUCTURÉ
   Les IA citent le contenu clair, factuel, bien organisé.
   → Utiliser des H2/H3 clairs avec des réponses directes
   → Pas de fluff, pas de texte vague
   → Répondre directement aux questions que les gens posent

3. EXPERTISE DÉMONTRÉE
   Les IA favorisent les sources qui montrent une expertise réelle.
   → Pages "À propos" détaillée sur Klik&Go
   → Contenu unique sur la viande halal, les certifications
   → Témoignages de bouchers réels

4. LIENS SORTANTS CRÉDIBLES
   Les IA font confiance aux pages qui citent des sources fiables.
   → Lien vers Schema.org, vers les certifications halal
   → Lien vers les normes NF525, RGPD

5. TIMESTAMPS À JOUR
   Les IA préfèrent le contenu récent.
   → Afficher "Mis à jour le [date]" sur les pages de contenu
   → Mettre à jour régulièrement les pages ville

6. NAP COHÉRENT PARTOUT
   Les IA croisent les sources pour valider les informations.
   → Nom, adresse, téléphone identiques sur GBP, site, annuaires
```

---

## 6) CONTENU & E-E-A-T

### 6.1 Les 4 piliers E-E-A-T

```
EXPERIENCE (le premier E, ajouté en 2022, renforcé en 2026) :
- Photos ORIGINALES des boucheries (pas de stock photos)
- Témoignages de VRAIS clients et bouchers
- Descriptions de produits écrites par le boucher (pas par IA)
- Contenu qui montre un vécu réel ("Notre boucher sélectionne...")

EXPERTISE :
- Pages détaillées sur les types de viande halal
- Guide "Comment choisir sa viande" (contenu evergreen)
- FAQ complètes et utiles
- Contenu spécifique halal (abattage, certification, traçabilité)

AUTHORITATIVENESS :
- Mentions dans la presse locale
- Partenariats avec des associations halal
- Témoignages de bouchers reconnus
- Backlinks depuis sites locaux (CCI, mairies, associations)

TRUSTWORTHINESS :
- HTTPS (déjà OK via Vercel)
- Badges conformité (NF525, RGPD, Stripe PCI-DSS)
- Mentions légales complètes
- CGV, CGU, politique de confidentialité
- Avis vérifiés
```

### 6.2 Contenu à créer (roadmap)

```
PRIORITÉ 1 — Pages essentielles :
□ Page "Comment ça marche" (3 étapes illustrées)
□ Page "Devenir partenaire" (pour les bouchers)
□ Page "Mentions légales" + CGV + CGU + Politique confidentialité
□ Pages ville : /boucherie-halal/chambery, grenoble, lyon, saint-etienne

PRIORITÉ 2 — Contenu expert :
□ "Guide : comment choisir sa viande halal"
□ "Les différentes découpes de viande d'agneau"
□ "Click & collect vs livraison : pourquoi récupérer en boutique"
□ "Qu'est-ce que la certification halal ?"

PRIORITÉ 3 — Contenu saisonnier :
□ "Préparer le Ramadan : commandez votre viande à l'avance"
□ "Aïd al-Adha : réservez votre mouton en ligne"
□ "Barbecue d'été : nos meilleures sélections halal"

RÈGLES DE RÉDACTION :
- Contenu UNIQUE par page (pas de copier-coller entre villes)
- Minimum 300 mots par page (idéal 800-1500 pour pages ville)
- H1 unique par page avec mot-clé principal
- H2/H3 structurés avec mots-clés secondaires
- Images avec alt text descriptif (pas "image1.jpg")
- Liens internes entre pages (maillage)
```

### 6.3 Contenu IA — Attention danger

```
⚠️ GOOGLE 2026 PÉNALISE LE CONTENU IA DE FAIBLE QUALITÉ

CE QUI EST PÉNALISÉ :
- Texte 100% généré par IA sans édition humaine
- Contenu mass-produit (20 articles/jour identiques)
- Descriptions produits copiées-collées
- Texte générique sans expertise démontrée

CE QUI EST OK :
- IA comme assistant de rédaction (brouillon → édition humaine)
- Texte IA enrichi avec des informations uniques et réelles
- Contenu IA avec photos originales et témoignages réels
- Descriptions produits uniques par boucher

RÈGLE KLIK&GO :
Le contenu IA marketing (emails, bannières) est OK car il n'est pas indexé.
Le contenu public indexable (pages ville, fiches, guides) DOIT être
enrichi avec du vrai contenu humain, des photos originales, et
de l'expertise démontrée.
```

---

## 7) MONITORING & OUTILS

### 7.1 Outils obligatoires

```
□ Google Search Console
  - Vérifier la propriété du domaine klikandgo.app
  - Soumettre le sitemap
  - Surveiller : couverture, Core Web Vitals, rich results, erreurs
  - Vérifier l'indexation de chaque page importante

□ Google Rich Results Test
  - Tester CHAQUE page avec du JSON-LD
  - URL : https://search.google.com/test/rich-results
  - Doit montrer "Page éligible aux résultats enrichis"

□ PageSpeed Insights
  - Tester mobile ET desktop
  - Score mobile minimum : 80+
  - Score desktop minimum : 90+

□ Plausible Analytics OU PostHog (RGPD-compliant, sans cookies)
  - Events à tracker :
    - page_view (toutes pages)
    - shop_view (fiche boucherie)
    - product_add_to_cart
    - checkout_start
    - order_completed
    - promo_code_used

□ Lighthouse (Chrome DevTools)
  - Audit Performance, Accessibility, Best Practices, SEO
  - Score SEO minimum : 95+
```

### 7.2 Requêtes à surveiller dans Search Console

```
REQUÊTES CIBLES — Vérifier le positionnement chaque semaine :

"boucherie halal chambéry"
"boucherie halal grenoble"
"boucherie halal lyon"
"commande viande halal en ligne"
"click and collect boucherie"
"viande halal livraison"
"klikandgo"
"klik and go boucherie"

OBJECTIFS :
- Top 3 sur les requêtes "[boucherie halal] + [ville partenaire]"
- Top 10 sur les requêtes génériques régionales
- Position 1 sur "klikandgo" et variations de marque
```

---

## 8) CHECKLIST SEO AVANT CHAQUE DÉPLOIEMENT

```
□ CHAQUE page publique a un title unique (50-60 chars) ?
□ CHAQUE page publique a une description unique (150-160 chars) ?
□ CHAQUE page publique a un canonical auto-référencé ?
□ CHAQUE page publique a un OG title + description + image ?
□ CHAQUE image a un alt text descriptif ?
□ CHAQUE image utilise next/image ?
□ CHAQUE fiche boucherie a un schema LocalBusiness/Store JSON-LD ?
□ CHAQUE fiche produit a un schema Product JSON-LD ?
□ Le sitemap.xml inclut toutes les pages publiques ?
□ Le robots.txt bloque /dashboard/ et /api/ ?
□ Pas de noindex accidentel sur les pages publiques ?
□ Core Web Vitals : LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms ?
□ Score Lighthouse SEO ≥ 95 ?
□ Rich Results Test valide pour les pages avec JSON-LD ?
□ Pas de contenu dupliqué entre pages ville ?
□ Liens internes entre pages (maillage naturel) ?
□ H1 unique par page ?
□ Pas de page orpheline (toute page liée depuis au moins 1 autre) ?
```

---

## 9) IMPLÉMENTATION — ORDRE DE PRIORITÉ

```
SEMAINE 1 — Fondation technique (impact immédiat) :
1. Metadata API sur toutes les pages existantes
2. sitemap.ts dynamique
3. robots.ts
4. Schema Organization (layout global)
5. Google Search Console : vérifier + soumettre sitemap
6. OG Image 1200x630 (logo Klik&Go + baseline)

SEMAINE 2 — Données structurées :
7. Schema Store/LocalBusiness sur chaque fiche boucherie
8. Schema Product sur chaque fiche produit
9. Schema BreadcrumbList sur toutes les pages
10. Valider avec Rich Results Test

SEMAINE 3 — SEO Local :
11. Pages ville : /boucherie-halal/chambery, grenoble, lyon, saint-etienne
12. FAQ Schema sur les pages ville
13. Guide boucher pour créer/optimiser Google Business Profile

SEMAINE 4 — Contenu & Analytics :
14. Page "Comment ça marche"
15. Page "Devenir partenaire"
16. Plausible ou PostHog (analytics RGPD)
17. Premier audit Lighthouse + PageSpeed Insights

MOIS 2 — Contenu expert + GEO :
18. Articles guides (viande halal, découpes, certification)
19. Contenu saisonnier (Ramadan, Aïd)
20. Optimisation GEO (structuration pour AI Overviews)
21. Backlinks locaux (CCI, associations, presse)
```

---

Fin du skill SEO. Toujours valider avec Rich Results Test + Lighthouse après chaque changement.
