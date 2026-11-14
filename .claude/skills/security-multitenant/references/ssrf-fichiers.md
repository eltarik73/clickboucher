# SSRF, requêtes sortantes et fichiers

Sources : [sources.md](sources.md). Blocs de code compilés le 2026-11-13, recompilés le 2026-11-14.

## 1. SSRF (API7:2023, ASVS 1.3.6 et 13.2.4)

Définition OWASP : l'API va chercher une ressource distante à partir d'une URI fournie par
l'utilisateur sans la valider, ce qui permet de lui faire émettre une requête vers une destination
imprévue [S2]. ASVS demande une **liste blanche** de protocoles, domaines, chemins et ports
(1.3.6) et une liste des systèmes externes autorisés (13.2.4) [S1].

### Où notre serveur émet des requêtes vers une URL influencée par un client

| Endroit | Règle à tenir |
|---|---|
| `POST /api/boucher/images/import` | modèle de liste blanche : `isAllowedImportUrl` (`https`, port vide, hôtes Pexels/Unsplash) ; règles 1 à 5 ci-dessous |
| `GET /api/boucher/images/proxy` | hôtes exacts (notre magasin Blob nommé, pas un suffixe générique), type en liste blanche, taille plafonnée, audience minimale ; règles 1 à 5 |
| `POST /api/push/subscribe` puis `webpush.sendNotification` (`src/lib/push.ts`) | `endpoint` restreint aux hôtes des services push des navigateurs (liste à confirmer dans la documentation de chaque navigateur avant de l'écrire) |
| `POST /api/boucher/images/retouch` (`imageUrl`) | transmise à Replicate, qui la télécharge ; ne pas la télécharger nous-mêmes sans liste blanche |
| Optimiseur d'images Next (`/_next/image`) | `images.remotePatterns` (`next.config.mjs`) au plus précis : protocole, sous-domaine exact de notre magasin Blob, chemin |
| Crons SEO (`bing-daily`, `seo-audit`), IndexNow | URL fixes |

État actuel de chacun de ces points (protection en place, écarts) : registre privé du programme.

### Règles (fiche OWASP SSRF, cas « destinations connues ») [S6]

1. **Liste blanche**, pas liste noire : comparer le **nom d'hôte analysé** (`new URL(x).hostname`)
   à un ensemble fermé. Jamais `url.includes("…")` ni `startsWith` sur la chaîne brute (le dépôt en
   contient encore pour reconnaître une URL Blob : `uploads/product-image/route.ts:149`,
   `boucher/images/[id]/route.ts:37` — sans conséquence là où ils sont, à ne pas copier).
2. **`https:` uniquement**, port par défaut, pas d'identifiants dans l'URL.
3. **Ne pas suivre les redirections** : la fiche demande de désactiver le suivi dans le client HTTP,
   sinon un hôte autorisé peut renvoyer vers une cible interne. Avec `fetch` : `redirect: "error"`.
4. **Délai et taille** : `AbortSignal.timeout(…)`, plafond sur `content-length` **et** sur le
   nombre d'octets réellement lus.
5. **Ne rien relayer tel quel** : ni le `Content-Type` amont, ni les en-têtes, ni un corps d'erreur.
6. Une liste blanche de domaines ne protège pas du « DNS rebinding » ; nos hôtes autorisés sont des
   CDN de tiers connus, risque accepté. Si un jour l'URL est libre (webhook sortant vers un
   boucher), c'est le cas n° 2 de la fiche : liste noire d'adresses privées **après** résolution,
   connexion sur l'adresse validée — à concevoir à part, pas à improviser.

```ts
import { z } from "zod";

/** Fabrique un schéma d'URL : https, port par défaut, hôte exact ou suffixe autorisé. */
export function allowlistedUrl(opts: { hosts?: string[]; suffixes?: string[]; max?: number }) {
  const hosts = new Set(opts.hosts ?? []);
  const suffixes = opts.suffixes ?? [];
  return z
    .string()
    .max(opts.max ?? 1000)
    .refine((raw) => {
      try {
        const u = new URL(raw);
        if (u.protocol !== "https:" || u.port !== "" || u.username !== "" || u.password !== "") {
          return false;
        }
        // Comparaison sur le nom d'hôte analysé, jamais sur la chaîne brute (startsWith/includes).
        return hosts.has(u.hostname) || suffixes.some((s) => u.hostname.endsWith(s));
      } catch {
        return false;
      }
    }, "URL non autorisée");
}

// Exemple : images importables par un boucher.
export const importableImageUrl = allowlistedUrl({
  hosts: ["images.pexels.com", "images.unsplash.com", "plus.unsplash.com"],
});
```

```ts
import { parseSafeImageContentType } from "@/lib/image-content-type";

const MAX_BYTES = 5 * 1024 * 1024;

// Fetch sortant : pas de suivi de redirection, délai borné, type vérifié, taille plafonnée
// sur l'en-tête ET sur les octets réellement lus (l'en-tête peut manquer ou mentir).
export async function fetchAllowlisted(url: string) {
  const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(8000) });
  if (!res.ok || !res.body) return null;
  const contentType = parseSafeImageContentType(res.headers.get("content-type"));
  if (!contentType) return null;
  if (Number(res.headers.get("content-length") ?? "0") > MAX_BYTES) return null;

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return { contentType, body: Buffer.concat(chunks) };
}
```

L'URL passée à cette fonction a déjà été validée par `allowlistedUrl` (ou `isAllowedImportUrl`).

`next.config.mjs` est du code de sécurité [S9] : chaque `remotePatterns` doit porter toutes les
restrictions possibles (protocole, hôte exact, chemin) ; ne jamais activer
`images.dangerouslyAllowLocalIP` ; une `destination` de `rewrites` à hôte dynamique est une SSRF
(avis GHSA-p9j2-gv94-2wf4) [S20].

## 2. Fichiers reçus (ASVS V5, fiche OWASP File Upload)

Principes de la fiche [S7] : extensions et types permis en liste blanche ; ne pas faire confiance à
l'en-tête `Content-Type` ; nom de fichier généré par l'application ; taille limitée ; envoi réservé
aux utilisateurs autorisés ; stockage hors de l'origine applicative ; bibliothèques de traitement à
jour.

### Le modèle : `src/app/api/uploads/product-image/route.ts`

| Étape | Ligne | ASVS |
|---|---|---|
| Session puis rôle `BOUCHER`/`ADMIN` lu en base | 23-36 | 8.2.1 |
| `productId` obligatoire, propriété de la boutique vérifiée | 42-83 | 8.2.2 |
| Type déclaré dans une liste (`jpeg`, `png`, `webp`) | 16, 55 | 5.2.2 |
| Taille ≤ 2 Mo | 15, 60 | 5.2.1 |
| Quota : 5 images par produit | 17, 84-89 | 5.2.4 |
| Octets magiques comparés au type déclaré | 95-98, 197-213 | 5.2.2 |
| Ré-encodage (`sharp` → WebP 800 px) | 100-110 | 5.2.2 (réécriture d'image) |
| Nom généré (`products/product-<ts>-<aléa>.webp`), type fixé à `image/webp` | 113-120 | 5.3.2 |

Un fichier qui ne se ré-encode pas n'est pas une image saine : le refuser, ne jamais stocker les
octets d'origine (écarts connus du modèle : registre privé du programme).

### Règles

- **Jamais de SVG** envoyé par un utilisateur : un SVG peut contenir du script (ASVS 1.3.4) [S1].
  `SAFE_IMAGE_CONTENT_TYPES` (`src/lib/image-content-type.ts`) l'exclut volontairement.
- **Un `Content-Type` venu d'ailleurs ne se stocke ni ne se relaie** : passer par
  `parseSafeImageContentType()`. C'est l'incident du proxy d'images (0d6fd80) : du HTML servi
  depuis notre origine sous une CSP permissive.
- **Type déclaré + octets magiques + ré-encodage** : les trois, sur **toute** route qui stocke un
  fichier reçu (upload direct, retouche, import) ; état actuel de chaque route : registre privé du
  programme.
- **Pixels** : plafonner les dimensions avant traitement (ASVS 5.2.6, attaque « pixel flood ») ;
  `sharp` applique une limite de pixels par défaut, ne pas la désactiver.
- **Bibliothèque à jour** : `sharp` (dépendance directe) suit ses avis de sécurité [S21]. Règles :
  (1) ne jamais appeler `sharp` sur des octets non filtrés — le contrôle de type déclaré et
  d'octets magiques (JPEG, PNG, WebP) précède toujours `sharp`, sur toute route ; (2) défense en
  profondeur possible, sans effet sur JPEG/PNG/WebP (essai local [L6]) :
  `sharp.block({ operation: ["VipsForeignLoadNsgif", "VipsForeignLoadTiff", "VipsForeignLoadVips",
  "VipsForeignLoadHeif", "VipsForeignLoadSvg"] })` (réglage global au processus) ; (3) une montée
  de mineure se teste à part (l'objet stocké doit commencer par `RIFF…WEBP`) — décision du
  propriétaire ; exposition détaillée : registre privé du programme.
- **Vercel Blob** : tout est en `access: "public"` (7 appels à `put`). Une URL Blob est donc un
  secret faible : ne rien y stocker de privé (factures, pièces d'identité, exports clients). Chemin
  = `shops/<shopId>/…` pour les objets d'une boutique ; un préfixe range, il n'autorise pas [S3].
- **Suppression** : résoudre l'URL vers l'objet en base, vérifier le propriétaire, puis `del()`
  (`uploads/product-image/route.ts:156-180` est le modèle). Pour supprimer « tout ce qui est à une
  boutique », utiliser le préfixe **avec** la barre finale (`shops/abc/`), sinon `shops/abc`
  attrape aussi `shops/abc-2/` [S3].
- **Téléchargement** d'un fichier fourni par un tiers : `Content-Disposition: attachment` et nom
  de fichier généré (ASVS 5.4.1, 5.4.2) [S1].
