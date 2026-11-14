# Entrées et sorties : validation, encodage, injection

Sources : [sources.md](sources.md). Blocs de code compilés le 2026-11-13, recompilés le 2026-11-14
(`tsc` 5.9.3 du dépôt, Zod 3.25.76, Prisma 6.19.2).

## 1. Valider les entrées (ASVS V2, 15.3.3 ; API3, API4)

Principe ASVS 2.2.1 et 2.2.2 : validation **positive** (liste de valeurs, motifs, bornes), faite
dans une couche serveur de confiance ; la validation côté client n'est qu'un confort [S1].

| Entrée | Règle | Exemple |
|---|---|---|
| Corps JSON | `schema.parse(await req.json())` ; l'exception `ZodError` est transformée en 400 par `handleApiError` | toutes les mutations |
| Query string | `schema.parse(Object.fromEntries(req.nextUrl.searchParams))` avec `z.coerce` | bloc ci-dessous |
| Paramètres de chemin | `z.string().cuid()` (ou `.min(1).max(64)` pour un slug) avant toute requête | `params.id` |
| `FormData` | chaque champ extrait puis validé ; `File` : taille et type (voir `ssrf-fichiers.md`) | upload |
| En-têtes | ne jamais y lire une identité ; `x-forwarded-for` uniquement pour le rate limit | — |

Bornes obligatoires (API4:2023, consommation de ressources) [S2] : `max()` sur chaque chaîne,
longueur maximale sur chaque tableau (un panier de 10 000 lignes est une attaque) **contrôlée
avant la validation des éléments** (`boundedArray()` ci-dessous), `int().min().max()` sur chaque
nombre, `perPage ≤ 50` (règle `CLAUDE.md`), et `take` plafonné même quand il vient du code.

```ts
import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { apiPaginated, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

// La query string est une entrée comme une autre : types, bornes, valeurs permises.
const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(["PENDING", "ACCEPTED", "PREPARING", "READY"]).optional(),
  q: z.string().trim().max(100).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const { page, perPage, status, q } = querySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams)
    );

    const where = {
      shopId: auth.shopId,
      ...(status ? { status } : {}),
      ...(q ? { orderNumber: { contains: q } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: { id: true, orderNumber: true, status: true, totalCents: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.order.count({ where }),
    ]);
    return apiPaginated(rows, total, page, perPage);
  } catch (error) {
    return handleApiError(error, "boucher/orders/list");
  }
}
```

Pièges Zod vérifiés avec la 3.25.76 installée [S22][L4][L6] :

- `z.object()` **retire** les clés inconnues sans erreur ; `.strict()` les refuse. Utiliser
  `.strict()` sur les mises à jour pour que les tests voient passer un champ interdit.
- Tableaux : GHSA-mrhx-c7xc-m3w5 (élevé, 2026-10-01) — Zod accumule une erreur par élément
  invalide, sans plafond ni arrêt anticipé ; un grand tableau épuise la mémoire du processus.
  Corrigé seulement en Zod 4.6.6, pas en 3.x [S22]. L'avis parle d'un tableau « sans contrainte de
  longueur », mais **avec Zod 3 `.max(n)` ne suffit pas** : la longueur est signalée, puis
  chaque élément est validé quand même (vérifié le 2026-11-14 [L6]). Parade vérifiée : contrôler
  la longueur **avant** d'appliquer le schéma des éléments (`boundedArray` : une seule erreur,
  rejet immédiat) [L6].
- `z.string().url()` accepte `javascript:alert(1)`, `data:text/html,…`, `file:///etc/passwd` et
  `http://169.254.169.254/` : ce n'est **pas** un contrôle de sécurité. Schémas existants à
  reprendre : registre privé du programme ; tout nouveau schéma d'URL suit le modèle ci-dessous.
- `z.coerce.number()` transforme `""` en `0` : mettre un `min` cohérent.
- `safeParse` + message de la première erreur est acceptable ; ne jamais renvoyer l'objet d'erreur
  Prisma ni une pile d'appels (ASVS 16.5.1) [S1].

Tableau reçu d'un client — à placer dans `src/lib/validators/` et à utiliser à la place de
`z.array(item).max(n)` dans tout schéma d'entrée (le type inféré reste `Item[]`) :

```ts
import { z } from "zod";

/**
 * Tableau borné AVANT la validation de ses éléments (Zod 3 : `z.array(item).max(n)` valide
 * quand même chaque élément d'un tableau trop long). `z.unknown()` ne produit aucune erreur par
 * élément ; `.pipe()` n'applique `item` que si la longueur est acceptée.
 */
export function boundedArray<T extends z.ZodTypeAny>(item: T, max: number, min = 0) {
  return z.array(z.unknown()).min(min).max(max).pipe(z.array(item));
}

export const reorderSchema = z
  .object({ categoryIds: boundedArray(z.string().cuid(), 100, 1) })
  .strict();
export type ReorderInput = z.infer<typeof reorderSchema>; // { categoryIds: string[] }
```

Schéma d'URL sûr (https, sans port, hôtes connus) :

```ts
import { z } from "zod";

// URL d'image fournie par un client : https + hôte en liste blanche.
// Notre magasin Vercel Blob est nommé exactement : un suffixe « .public.blob.vercel-storage.com »
// accepterait le magasin de n'importe qui.
const OUR_BLOB_HOST = "<id-du-magasin>.public.blob.vercel-storage.com";
const IMAGE_HOSTS = new Set(["images.pexels.com", "images.unsplash.com", OUR_BLOB_HOST]);
export const imageUrlSchema = z
  .string()
  .url()
  .max(500)
  .refine((raw) => {
    try {
      const u = new URL(raw);
      return u.protocol === "https:" && u.port === "" && IMAGE_HOSTS.has(u.hostname);
    } catch {
      return false;
    }
  }, "Hôte d'image non autorisé");
```

## 2. Logique métier (ASVS 2.3, API6)

- Étapes dans l'ordre : une commande ne change d'état que selon la table de
  `src/lib/order-state-machine.ts` (ASVS 2.3.1) [S1], et l'état courant est vérifié **dans la même
  écriture** que le changement. Le chantier prix (non commité au 2026-11-14) le fait dans
  `src/lib/services/orders/transition.ts` : un `UPDATE` conditionnel qui porte l'id, la portée de
  l'appelant et le statut de départ ; ne pas réintroduire de route qui écrit `status` elle-même.
- Ressources limitées (créneaux de retrait, stock, plafond de commandes) : contrôle et réservation
  dans une transaction ou une écriture conditionnelle (`updateMany` avec la condition dans le
  `where`), sinon double réservation (ASVS 2.3.4) [S1].
- Montants : recalcul serveur à partir des prix en base, jamais du panier client (`CLAUDE.md`).
- Parcours abusables par automatisation (commande invité, codes promo, avis, tickets de support,
  envoi d'OTP) : rate limit **et** réflexion sur le dommage métier (API6:2023) [S2].

## 3. Injection SQL (ASVS 1.2.4)

Prisma paramètre toutes les requêtes du client généré. Requêtes brutes : 19 occurrences
(2026-11-14), toutes sous la forme sûre `` prisma.$queryRaw`…${valeur}…` `` ou
`` $executeRaw`…` `` (`src/app/api/shops/nearby/route.ts:43`, `src/app/api/health/route.ts:12`,
`src/lib/marketing/send-campaign.ts`, `audience-counts.ts`, `src/lib/services/orders/**`) ;
aucun `…Unsafe`, aucun `Prisma.raw(`.

Règles tirées de la doc Prisma [S16] :

- la forme gabarit étiqueté échappe les variables et envoie une requête préparée ;
- `$queryRawUnsafe` / `$executeRawUnsafe` et `Prisma.raw()` sur une entrée utilisateur sont une
  injection ; **interdits** ici ;
- construire le gabarit par concaténation réintroduit l'injection ; pour composer, `Prisma.sql`,
  `Prisma.join` (listes `IN`), `Prisma.empty` ;
- un identifiant (table, colonne, sens de tri) ne peut pas être une variable : le choisir dans
  une liste blanche en dur (`const ORDER = { recent: "created_at" } as const`).

Détection de « introuvable » sans dépendre du texte du message (à ranger avec
`uniqueViolationFields()` dans `src/lib/prisma-errors.ts`, fichier créé par le chantier prix) :

```ts
import { Prisma } from "@prisma/client";

// P2025 se détecte par code, pas par message.
export function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}
```

## 4. XSS et encodage de sortie (ASVS 1.2.1 à 1.2.3, 1.3.1, 3.2.2)

React échappe tout ce qui passe par `{valeur}`. Les fuites viennent des **autres contextes** :

| Contexte | Risque | Règle | État |
|---|---|---|---|
| `dangerouslySetInnerHTML` avec du HTML | XSS direct | uniquement des constantes du code | 30 usages ; ceux de `recettes/page.tsx:215, 219` rendent des libellés en dur (acceptable) |
| JSON-LD (`<script type="application/ld+json">`) | `</script>` dans une chaîne ferme la balise | `<JsonLd>` / `serializeJsonLd()` (principe ci-dessous) | **corrigé** (0b69e39) : seul composant autorisé, garde-fou `src/lib/__tests__/json-ld.test.ts` |
| E-mail HTML | injection de balises et de liens dans un message envoyé par notre domaine | `esc()` sur chaque champ saisi | modèle : `src/lib/email-templates.ts` (`esc` y est privé : l'exporter) ; état des autres gabarits : registre privé du programme |
| Ticket imprimé (iframe) | idem | `escapeHtml()` | fait (`src/components/boucher/OrderTicket.tsx:331`) |
| Attribut `href` / `src` | `javascript:` | URL validée (https + hôte) ou chemin relatif | schémas existants à reprendre : registre privé (§ 1) |
| Réponse d'un proxy ou d'un fichier | HTML ou SVG servi depuis notre origine | type de contenu en liste blanche, jamais relayé | fait (`image-content-type.ts`) |
| Journal | injection de lignes | `logger` structuré (JSON en production), valeurs en contexte, pas dans le message | — |

JSON-LD : la doc Next.js prévient que `JSON.stringify` « ne nettoie pas les chaînes malveillantes »
et montre le remplacement de `<` par `\u003c` [S12]. Le JSON reste identique pour un moteur de
recherche (vérifié : `JSON.parse` rend la chaîne d'origine). Dans le dépôt depuis 0b69e39 :
`serializeJsonLd()` (`src/lib/seo/jsonld/serialize.ts`) échappe `<`, `>`, `&`, U+2028 et U+2029, et
`<JsonLd>` (`src/components/seo/JsonLd.tsx`) est le seul composant autorisé à écrire un bloc
JSON-LD. Le bloc ci-dessous montre le principe ; dans le code, utiliser le composant.

```ts
// JSON-LD : JSON.stringify n'échappe pas « < ». Un nom de boutique « </script><script>… »
// fermerait la balise. On neutralise le caractère, comme le recommande la doc Next.js.
export function jsonLd(schema: unknown): string {
  return JSON.stringify(schema).replace(/</g, "\\u003c");
}

// Usage dans un composant serveur :
//   <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
```

Pourquoi c'est un vrai sujet chez nous : nom de boutique, description, noms de produits et avis
sont **saisis par des tiers** (bouchers, clients) et rendus dans les pages publiques de la
marketplace. Toute retouche de ces composants SEO se fait **sans changer la structure des
schémas**, après relecture de `seo-anti-penalty`.

Contenu riche : si un jour un champ accepte du HTML (description de boutique mise en forme), il
faudra une bibliothèque d'assainissement reconnue (ASVS 1.3.1) [S1] ; aucune n'est installée
aujourd'hui (`dompurify` a été retiré car inutilisé). Tant que ce n'est pas le cas : texte brut.

## 5. Redirections et URL construites (ASVS 1.2.2, 3.7.2)

- Redirection automatique vers un autre domaine uniquement s'il est dans une liste blanche [S1].
  Nos redirections sont des chemins relatifs en dur (`/sign-in?redirect_url=/panier`) : garder cette
  forme ; ne jamais faire `redirect(searchParams.get("next"))`.
- Construire une URL avec une donnée : `encodeURIComponent` pour un segment ou un paramètre ;
  `new URL()` puis `searchParams.set()` plutôt que la concaténation.
- `next.config.mjs` : ne jamais former l'hôte d'une `destination` de `rewrites`/`redirects` à
  partir d'un segment ou d'un paramètre de requête (avis GHSA-p9j2-gv94-2wf4 : SSRF / redirection
  ouverte, corrigé seulement en 15.5.21 et 16.2.11) [S20]. Nos règles actuelles ont toutes un hôte
  fixe.

## 6. Données sensibles dans les URL, les caches et les journaux (ASVS 14.2.1, 14.2.2, 14.3.2, 16.2.5)

- Pas de secret ni de jeton en query string : elle finit dans les journaux, l'historique et
  l'en-tête `Referer`. Exceptions existantes, à ne pas multiplier : `?guestToken=` (suivi invité),
  `?testmode=` / `?secret=` (activation du mode test).
- Réponse privée : `Cache-Control: private` ou `no-store` ; `export const dynamic = "force-dynamic"`
  sur le handler.
- Journaux : jamais de corps de requête entier, de jeton, de secret, d'e-mail en clair hors besoin
  (`[cart/add]` journalise des ids, pas des personnes : bon modèle). Les exigences RGPD associées
  sont dans `conformite-france`.
