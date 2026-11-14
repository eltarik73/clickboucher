# ISR et revalidation à la demande

Identifiants `[S…]`/`[L…]` : voir [sources.md](sources.md).

## 1. Comment l'ISR se comporte réellement

1. La page est rendue au build (ou à la première visite pour un chemin non prégénéré) et mise en
   cache [S5].
2. Tant que la fenêtre `revalidate` n'est pas écoulée, le CDN répond sans exécuter de fonction [S22].
3. Après la fenêtre, **la première requête reçoit encore l'ancienne page** et déclenche une
   régénération en arrière-plan ; la suivante reçoit la nouvelle [S2][S5].
4. Si la régénération lève une erreur, **la dernière version valide reste servie** et Next réessaie
   à la requête suivante [S5] ; sur Vercel le contenu périmé reçoit un TTL de 30 s avant nouvel
   essai [S22].
5. Sur Vercel, le cache ISR est **propre à chaque déploiement** : après un déploiement, tout chemin
   non prégénéré au build est rendu à sa première visite [S22].

Conséquences à garder en tête :

- **Le premier visiteur après une période calme voit la version précédente.** C'est inhérent au
  modèle ; ne pas « corriger » en raccourcissant la fenêtre.
- **Chaque régénération est une exécution de fonction facturée** [S5][S22]. Avec un trafic de bots
  clairsemé, une fenêtre plus courte que l'intervalle entre deux visites coûte une régénération par
  visite [L10]. La doc recommande des fenêtres longues et la revalidation à la demande pour la
  précision [S5].

## 2. `generateStaticParams` : obligatoire sur un segment dynamique

Sans `generateStaticParams`, une route à segment dynamique est rendue **à chaque requête**, quel que
soit `revalidate` [S4b][L4] (retour terrain identique : [S27]). Trois formes :

| Forme | Effet | Usage ici |
| --- | --- | --- |
| Liste complète | chaque chemin prérendu au build | `/boucherie-halal/[ville]` (`SEO_CITIES`) |
| Sous-ensemble | les chemins listés au build, les autres à la première visite (`dynamicParams` vaut `true` par défaut) [S3][S4] | `/produits/[produit]/[ville]`, `/occasions/[occasion]/[ville]` (combinaisons prioritaires) |
| `return []` | rien au build, tout à la première visite puis en cache | `/recettes/[slug]`, `/sign-in`, `/sign-up` |

- `generateStaticParams` **n'est pas rappelée pendant une revalidation** [S4] : une ville ajoutée à
  `SEO_CITIES` n'est prégénérée qu'au build suivant.
- Une route à liste vide n'est **pas rendue au build** : une API de requête introduite dans son
  arbre ne sera découverte qu'en production, sous forme de 500 [S14][L3]. Tester ces routes sur la
  preview (`/sign-in`, `/sign-in/factor-one`, `/sign-up`, une recette).
- Avec `dynamicParams = true`, un slug inconnu exécute la page, appelle `notFound()` et le résultat
  est mis en cache avec son statut [L10]. Passer à `dynamicParams = false` est une décision
  d'indexation : voir « Points à arbitrer » dans `SKILL.md`.

## 3. Choisir la fenêtre

| Contenu de la page | Fenêtre en place | Pourquoi |
| --- | --- | --- |
| Éditorial + compteurs (`/a-propos`, `/presse`, `/devenir-boucher-partenaire/[ville]`) | 86 400 s | rien de sensible au temps |
| Listes de boutiques avec badge de statut (`/boucherie-halal/[ville]`, quartiers, dimanche, département, produits, occasions) | 3 600 s | un badge « Fermé » périmé d'une heure au plus ; **ne pas monter à 86 400 sans revalidation à la demande complète** (§ 5) |
| Accueil et bons plans | 300 s | la liste est rafraîchie côté client (`NearbyShops`) |
| Sitemap | 3 600 s | une boutique validée y apparaît en moins d'une heure |

Toujours un **littéral numérique** [S3]. Toute nouvelle page publique reprend une de ces classes ;
une fenêtre inférieure à 300 s doit être justifiée par écrit dans le fichier.

## 4. Erreurs pendant le rendu : laisser lever

Sous ISR, un rendu qui **réussit** est mis en cache, même s'il affiche une liste vide. Une erreur
avalée par `try/catch` devient donc une page dégradée servie à tout le monde pendant la fenêtre —
et, sur les pages qui calculent `robots` à partir d'un compteur
(`produits/[produit]/[ville]/page.tsx`, quartiers, dimanche), un `noindex` figé dans le cache.

- Requêtes Prisma des pages publiques : **pas de `try/catch` à valeur par défaut**. Modèles en
  place : `src/app/sitemap.ts` (aucun `try/catch`), `src/app/(client)/page.tsx` (relance en
  production, repli en développement seulement).
- Corollaire : **`next build` exige une base joignable** (≈ 290 pages prérendues interrogent
  Prisma). Un build sans base doit échouer ; c'est le comportement sûr.
- Ne pas convertir une erreur technique en `notFound()` : un incident base de données deviendrait
  un 404 + `noindex` [S8b]. `notFound()` est réservé au « n'existe pas ».

## 5. Revalidation à la demande

État actuel : **aucun appel** à `revalidatePath`/`revalidateTag` dans `src/` [L13]. Toute fraîcheur
repose sur les fenêtres. Quand une équipe l'introduit :

### API (Next 14.2.35) [S6][L1]

```ts
import { revalidatePath } from "next/cache";

revalidatePath("/boucherie-halal/chambery");            // une URL précise
revalidatePath("/boucherie-halal/[ville]", "page");      // toutes les URL de ce fichier page
revalidatePath("/(client)/recettes/[slug]", "page");     // avec route group : le groupe fait partie du chemin
revalidatePath("/", "layout");                           // tout ce qui est sous le layout racine
```

- L'invalidation n'est effective **qu'à la prochaine visite** du chemin : aucun rendu n'est
  déclenché sur le moment [S6]. Il n'existe pas de régénération « immédiate » en App Router [S5].
- Utilisable dans un Route Handler [S6] — c'est notre cas (aucune Server Action dans le dépôt).
  Appelée depuis un Route Handler, elle **ne vide pas le Router Cache** des navigateurs déjà
  ouverts [S2] : un client peut garder l'ancien payload jusqu'à 5 min.
- Sur Vercel, la purge s'applique à tous les déploiements du projet dans le même environnement et
  se propage en moins de 300 ms [S22].
- Le middleware n'est pas exécuté pour une régénération à la demande : revalider le chemin exact,
  pas une URL réécrite [S5].
- Jamais pendant un rendu (erreur à partir de Next 15) [S16] : uniquement après l'écriture, dans le
  handler.

### Où l'appeler

Appeler **après** l'écriture réussie, dans le `try` du handler, via **un seul helper** de
`src/lib/` (ex. `revalidateShopListings()`), pour pouvoir changer de stratégie en un endroit.

Les pages ISR affichent `visible`, `status`, nom, image, horaires, note et nombre d'avis des
boutiques. Les écritures correspondantes sont réparties dans une vingtaine de fichiers [L10][L13] :

- visibilité : `api/admin/shops/[shopId]/validate`, `…/suspend`, `…/route.ts`, `api/boucher/onboarding` ;
- statut : `src/lib/shop-status.ts` (`pauseShop`, `resumeShop`, `setBusyMode`, `endBusyMode`,
  `checkAutoPause`, `setVacationMode`, `endVacationMode`, et l'expiration paresseuse dans
  `getShopStatus`), `api/boucher/shop/status`, `api/shops/[id]/status`, `api/boucher/service`,
  `api/cron/busy-end`, `api/cron/vacation-end` ;
- fiche : `api/shops/[id]/route.ts` ;
- notes : `api/reviews`, `api/orders/[id]/rate`, `api/webmaster/reviews/[id]`.

Règles de décision :

| Écriture | Fréquence | Portée conseillée |
| --- | --- | --- |
| Validation, suspension, visibilité (admin) | rare | `revalidatePath("/", "layout")` : simple, exhaustif, coût = une régénération par page à sa prochaine visite |
| Statut boutique (occupé, pause, congés) | plusieurs fois par jour et par boutique | ciblée : `/`, la page ville et les pages dérivées de cette ville — un `"layout"` global annulerait le bénéfice de l'ISR |
| Catalogue produit | fréquent | rien tant que `/boutique/[slug]` est dynamique |

Une couverture **partielle** est pire que pas de couverture si elle sert de prétexte à allonger une
fenêtre : une boutique fermée par une route oubliée resterait « ouverte » toute la fenêtre [L10].

### `revalidateTag` et `unstable_cache`

Disponibles en 14.2.35 [L1], mais : `unstable_cache` est déclarée instable [S6c] ; `revalidateTag`
prend un seul argument en 14 [S6b], deux obligatoires en Next 16, et l'appel à deux arguments ne
compile pas en 14 [S17][L11]. Par défaut : ISR par page + `revalidatePath`. Si un tag devient
nécessaire, l'encapsuler dans le helper unique.

## 6. `/boutique/[slug]` reste dynamique

Décision actée dans `CLAUDE.md`. La page appelle Upstash (`no-store`) [L7], affiche stock et prix en
direct, et calcule des valeurs dépendantes de l'horloge côté serveur. La convertir en ISR
demanderait **tout** ceci dans un même changement [L10] : retirer la lecture Redis de `getShop`,
revalider depuis chaque écriture boutique/produit/offre, déplacer côté client tout affichage
dépendant de l'heure (`OpeningHoursAccordion`, compteur de commandes de la semaine). Ne pas le faire
« au passage ».

## 7. Vérifier un changement ISR

- [ ] `npm run build` avec une base joignable, puis `node scripts/check-prerender.mjs`.
- [ ] La route apparaît dans `.next/prerender-manifest.json` (`routes` ou `dynamicRoutes`) avec la
      fenêtre attendue.
- [ ] Aucun `try/catch` à valeur par défaut autour d'une requête Prisma de la page.
- [ ] Aucune valeur dépendante de l'horloge ou de l'utilisateur dans le HTML serveur.
- [ ] En local (`next build` puis `next start`) : deux requêtes successives, la seconde en
      `x-nextjs-cache: HIT` [S5]. Hors Vercel, `next.config.mjs` passe en `output: "standalone"` et
      `next start` affiche alors un avertissement qui renvoie vers
      `node .next/standalone/server.js` [L20]. Sur la preview Vercel, contrôler l'en-tête de cache
      du CDN comme décrit dans le skill `vercel-cost-performance`
      (`references/mesure-et-capacite.md`), et que les routes à `generateStaticParams` vide
      répondent 200.
