# Amener une commande à l'écran de la cuisine : options, coûts, patrons

## 1. Le besoin réel

- **Délai utile.** Le boucher dispose de `acceptTimeoutMin` (10 min par défaut) pour répondre. Uber Eats relance le restaurant par appel automatique après 90 secondes sans réponse [U3] : l'ordre de grandeur de l'alerte restaurant est la dizaine de secondes, pas la milliseconde. Voir une commande en 5 secondes suffit ; ce qui ne pardonne pas, c'est de ne pas la voir du tout.
- **Conditions.** Tablette posée au comptoir, souvent en veille ou sur un autre onglet, Wi-Fi de boutique, session Clerk qui expire. La fiabilité de l'alerte passe avant la latence.
- **Coût.** Le site est tombé le 05/11/2026 pour dépassement de quota CPU (CLAUDE.md, « Coût CPU Vercel »). Toute sonde est une invocation de fonction précédée du middleware Clerk, facturés tous les deux.

## 2. Ce que facture Vercel (Fluid compute)

Relevé le 13/11/2026, région `sfo1` (celle de `vercel.json`) [V2] : CPU actif 0,177 $ par heure, facturé seulement quand le code s'exécute (pas pendant l'attente de la base) ; mémoire provisionnée 0,0147 $ par Go-heure, facturée tant qu'une requête est en cours sur l'instance, attente comprise ; invocations 0,60 $ le million. Mémoire par défaut : 2 Go [V1]. Une instance sert plusieurs requêtes à la fois : la mémoire se partage, le CPU s'additionne. Le middleware consomme lui aussi du CPU actif [V11].

Formule par tablette et par mois (intervalle `T` secondes, `H` heures d'ouverture par jour, `c` secondes de CPU et `d` secondes de durée par sonde) :

```
sondes       N = 30 × H × 3600 / T
invocations    = N × 0,60 / 1 000 000
CPU            = N × c / 3600 × 0,177
mémoire (max)  = N × d / 3600 × 2 × 0,0147      (borne haute : instance non partagée)
```

Exemples avec `H = 12`. Les valeurs de `c` et `d` sont des **hypothèses** : les mesurer dans Observability > Functions (temps CPU divisé par invocations, par route [V11]) avant toute décision.

| Scénario | N | Hypothèses | Invocations | CPU | Mémoire (max) | Total |
|---|---|---|---|---|---|---|
| Sonde complète actuelle, 5 s | 259 200 | c = 30 ms, d = 150 ms | 0,16 $ | 0,38 $ | 0,32 $ | ≈ 0,86 $ |
| Sonde de version, 5 s | 259 200 | c = 5 ms, d = 40 ms | 0,16 $ | 0,06 $ | 0,08 $ | ≈ 0,30 $ |
| Sonde de version, 15 s (push en déclencheur) | 86 400 | idem | 0,05 $ | 0,02 $ | 0,03 $ | ≈ 0,10 $ |
| Flux ouvert 12 h par jour (SSE ou WebSocket) | 4 320 reconnexions (300 s) | 1 instance occupée | ≈ 0 | celui des requêtes internes | 360 h × 2 Go × 0,0147 = 10,58 $ | ≥ 10,6 $ par instance |

Lecture :

- Pour une sonde légère, **le plancher est l'invocation** (et le middleware, non compté ici). Alléger la requête divise le CPU ; seul l'allongement de l'intervalle réduit le plancher.
- Un flux tenu ouvert coûte d'abord de la **mémoire en continu**. La documentation d'Upstash Realtime dit que Fluid ne facture que le CPU actif [UP5] ; la grille de Vercel dit que la mémoire reste facturée tant qu'une requête est en cours [V2]. C'est Vercel qui fait foi. Le flux ne devient compétitif que lorsque assez de tablettes partagent les mêmes instances : avec les hypothèses ci-dessus, la sonde complète occupe une instance en permanence vers 30 tablettes simultanées (30 × 0,15 s toutes les 5 s).
- À l'échelle actuelle (quelques boutiques), le premier coût de la sonde n'est pas la facture Vercel mais la base : une requête de 50 commandes avec jointures toutes les 5 s par tablette, derrière `connection_limit=1`.

## 3. Les options, sans complaisance

| Option | Délai typique | Onglet caché ou fermé | Coût et limites | Dépendance | Verdict ici |
|---|---|---|---|---|---|
| Sonde complète (actuel, `GET /api/orders`) | ≤ 5 s | ralentie par le navigateur | requête lourde à chaque sonde ; effet de bord dans un `GET` (E9) | aucune | à remplacer |
| **Sonde de version + rechargement si changement** | ≤ 5 s | idem | 1 invocation + 1 requête d'agrégat par sonde | aucune | **défaut** |
| SSE avec boucle de requêtes côté serveur (actuel, dashboard) | ≤ 5 s | idem | mémoire en continu, mêmes requêtes, coupure au `maxDuration` (30 s ici), ré-annonces à la reconnexion (E10) | aucune | à retirer |
| SSE ou WebSocket alimenté par pub/sub | < 1 s | non | mémoire en continu ; connexion épinglée à une instance, fermée au `maxDuration` (300 s par défaut, 800 s max en Pro) [V1][V8] ; diffusion entre instances par un magasin externe avec connexions bloquantes [V7] | `@vercel/functions` ≥ 3.10 + `ws`, client Redis TCP ou `@upstash/realtime` (non installés) | pas maintenant |
| Canal géré (Pusher, Ably…) | < 1 s | non | aucune connexion tenue chez Vercel ; 1 appel HTTP par événement ; Pusher gratuit : 200 000 messages par jour et 100 connexions simultanées, puis 49 $ par mois pour 500 connexions [RT1] ; Ably facture à l'utilisateur actif, gratuit jusqu'à 500 [RT2] | SDK non installés ; nouveau sous-traitant (voir `conformite-france`) | option à seuil (§ 6) |
| Web Push | secondes, sans garantie | **oui** | 1 envoi par événement ; livraison et délai dépendent du service de push | `web-push` 3.6.7 (installé) | complément obligatoire |

Vercel classe lui-même les « mises à jour peu fréquentes » dans la case « requête à la demande ou sondage », et réserve les fournisseurs gérés à la diffusion à grand volume [V7]. Le client DoorDash interroge un point d'accès pour connaître l'issue du traitement de sa commande (« pull model ») [D1] : sonder n'est pas une faute de conception, sonder lourdement en est une.

Ce qu'Uber a retenu de son passage du sondage au push [U1], transposable ici :

1. Le sondage représentait 80 % des requêtes de leur passerelle : c'est un problème d'échelle. Le nôtre est un problème de poids par sonde.
2. Séparer « quand prévenir » de « quoi envoyer » : le signal dit « quelque chose a changé », le contenu vient du même point d'accès de lecture que la sonde. Un seul chemin de lecture à sécuriser et à tester.
3. Livraison « au moins une fois », avec numéro de séquence et accusé : un signal perdu ou doublé ne doit rien casser. Chez nous : recharger est idempotent, et un rechargement complet périodique rattrape un signal perdu.
4. Durée de vie par message : un signal périmé ne doit pas arriver.
5. Battement de cœur et détection de coupure côté client (4 s et 7 s chez eux) : l'écran doit dire quand il n'est plus à jour. Déjà en place (`lastSuccessAt`, pastille de connexion du mode cuisine).

## 4. Patron D — sonde de version

Idée : une valeur qui change dès qu'une commande de la boutique change. Le client la renvoie ; le serveur répond « rien de neuf » sans corps. C'est le mécanisme `ETag` / `If-None-Match` / `304` de HTTP [W4], exprimé par un paramètre pour ne dépendre ni du cache du navigateur ni du CDN.

```ts
// src/app/api/boucher/orders/version/route.ts — à créer
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const agg = await prisma.order.aggregate({
      where: { shopId, updatedAt: { gte: new Date(Date.now() - WINDOW_MS) } },
      _max: { updatedAt: true },
      _count: { _all: true },
    });
    const version = `${agg._max.updatedAt?.getTime() ?? 0}.${agg._count._all}`;

    if (req.nextUrl.searchParams.get("since") === version) {
      return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
    }
    const res = apiSuccess({ version });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (error) {
    return handleApiError(error, "boucher/orders/version");
  }
}
```

```ts
// côté client, dans pollOnce de src/hooks/use-order-polling.ts
export async function probeOrders(
  knownVersion: string | null,
  signal: AbortSignal
): Promise<{ changed: false } | { changed: true; version: string }> {
  const qs = knownVersion ? `?since=${encodeURIComponent(knownVersion)}` : "";
  const res = await fetch(`/api/boucher/orders/version${qs}`, { signal, cache: "no-store" });
  if (res.status === 204) return { changed: false };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json: { data: { version: string } } = await res.json();
  return { changed: true, version: json.data.version };
}
```

Exécuté sur base jetable [L12] : Prisma émet une seule requête (`SELECT MAX("updated_at"), COUNT(*) FROM (SELECT … WHERE "shop_id" = … AND "updated_at" >= …)`), la version change à la création d'une commande et à chaque transition, et vaut `0.0` pour une boutique sans commande. L'index `[shopId, updatedAt]` existe ; le plan réel reste à lire avec `EXPLAIN` sur des volumes de production (sur une table presque vide PostgreSQL en choisit un autre).

Conditions de validité, à tenir et à tester :

1. **Tout changement visible en cuisine modifie `Order.updatedAt`.** Vrai pour `update` et `updateMany` de Prisma sur `Order` ; faux pour le SQL brut et pour une écriture sur une table fille seule (`OrderItem`, `PriceAdjustment`) [PR2] (les trois cas vérifiés [L11]). Règle : la transaction touche aussi la ligne `Order`. Garder un test d'intégration qui le prouve pour chaque action de cuisine.
2. **Filet.** Le client recharge la liste complète quand la version change **et** au moins toutes les 60 secondes, pour couvrir deux écritures dans la même milliseconde, une transaction validée après une autre plus récente, ou une horloge d'instance décalée (`updatedAt` vient de l'horloge de la fonction, pas de la base).
3. **La liste complète devient un point d'accès cuisine dédié** (`GET /api/boucher/orders`, à créer) : commandes actives sélectionnées par statut (et non les 50 dernières par date de création, qui font disparaître une programmée ancienne, E9) avec un plafond de sécurité large et journalisé s'il est atteint, historique borné et paginé (règle CLAUDE.md : pagination au-delà de 50), `select` limité aux champs affichés, aucun effet de bord. `GET /api/orders` reste le point d'accès client.
4. **Jamais de cache partagé** sur ces réponses : `private, no-store`, pas de `apiCached`.
5. **Statut de la boutique** (pause, occupé) : hors de cette version ; il garde sa propre lecture.

Variante `ETag` (non essayée ici) : si l'on préfère l'en-tête, poser soi-même `If-None-Match` côté client. La spécification Fetch bascule alors la requête en mode `no-store` et remet le `304` au script [W3] ; avec `cache: "no-cache"` au contraire, c'est le navigateur qui fait la requête conditionnelle et rend la réponse de son cache quand rien n'a changé [W8] : le script ne voit pas le `304`.

Si un jour l'exactitude stricte compte (aucun filet) : une table `shop_order_feed (shop_id, seq)` incrémentée dans la transaction de chaque écriture donne un compteur monotone. Ne pas mettre ce compteur sur `Shop` via Prisma : `Shop.updatedAt` alimente le `lastmod` du sitemap. Ne pas le mettre dans Redis pour « économiser la base » : à 5 s, une tablette consomme 259 200 commandes par mois, plus de la moitié du quota gratuit Upstash (500 000) et 0,20 $ les 100 000 au-delà [UP4], pour un agrégat PostgreSQL qui ne coûte rien de plus.

## 5. Règles de la sonde côté navigateur

`src/hooks/use-order-polling.ts` est le modèle ; `src/hooks/useVisiblePolling.ts` pour les sondes de fond. Règle CLAUDE.md : jamais de `setInterval` nu.

- Une seule requête à la fois ; le prochain appel se planifie à la fin du précédent.
- Délai d'abandon par requête (10 s aujourd'hui) pour ne pas geler la boucle sur une connexion morte.
- Onglet caché : ralentir. Chrome ne réveille de toute façon les minuteurs enchaînés d'une page cachée et silencieuse depuis plus de 5 minutes qu'une fois par minute [W5] : une tablette dont l'onglet n'est pas au premier plan peut avoir une minute de retard, quel que soit l'intervalle demandé. D'où le push.
- Réveil immédiat sur `visibilitychange`, `focus`, `online`.
- Recul exponentiel sur erreur, distinct pour 401/403 (session expirée : l'écran doit le dire, voir `clerk-auth`).
- Pas d'appel au montage pour un visiteur anonyme (règle CLAUDE.md).
- Suivi client (`/commande/[id]`, `/suivi/[id]`) : la lecture légère existe déjà (`GET /api/orders/[id]/status`, sans effet de bord, utilisée par `SuiviClient.tsx`) ; `/commande/[id]` sonde encore `GET /api/orders/[id]`, qui valide des ajustements de prix au passage (E12). Cible : même principe que la cuisine, par commande (`since` = `updatedAt` connu), arrêt sur état terminal, 10 à 15 s hors phase de préparation. Le moment « prête » est porté par la notification, pas par la sonde. `useOrderTracker.ts` (`setInterval` nu, aucun appelant) n'est pas un modèle.

## 6. Quand passer à un canal poussé

Seuils proposés (jugement d'ingénierie, à réviser sur mesures) : plus d'une trentaine de tablettes connectées en même temps ; ou la sonde dans les trois premières routes par CPU actif [V11] ; ou un besoin produit sous les 2 secondes.

Ordre de préférence alors : (1) canal géré, le serveur publiant après validation un signal sans donnée personnelle (`shop:{id}` + numéro de version) et le client rechargeant par le chemin habituel ; (2) WebSocket sur Vercel Functions, disponible depuis le 20/10/2026 [V8], seulement si l'on accepte de tenir un magasin pub/sub. Dans les deux cas la sonde reste, à intervalle long, comme filet. Le `redis.publish` actuel via l'API REST Upstash n'a aucun abonné (E11) : le supprimer ou le brancher, pas le laisser.

Si un flux SSE est conservé quelque part : pas de boucle de requêtes par connexion ; un identifiant par événement et une reprise (`Last-Event-ID` ou instantané initial) pour ne rien ré-annoncer ; une ligne de commentaire périodique comme maintien de connexion ; reconnexion prévue au `maxDuration` ; au plus 6 connexions par navigateur et par domaine en HTTP/1.1 [W2].

## 7. Web Push pour la cuisine

Rôle : réveiller une tablette dont l'onglet est caché ou fermé. Ce n'est pas un transport fiable : pas d'accusé, délai variable. Il déclenche l'alerte et le rechargement ; il ne porte pas la vérité.

```ts
import webpush from "web-push";

await webpush.sendNotification(subscription, JSON.stringify(payload), {
  TTL: acceptTimeoutMin * 60, // au-delà, la commande a expiré : ne plus livrer
  urgency: "high",            // message sensible au temps
  topic: "new-order",         // un message non livré est remplacé par le suivant
});
```

- `TTL` : durée de rétention par le service de push ; le défaut de la bibliothèque est de 4 semaines (`node_modules/web-push/src/web-push-lib.js`), donc une « nouvelle commande » peut aujourd'hui sonner le lendemain. `urgency: high` est prévu pour les alertes sensibles au temps ; `topic` (32 caractères au plus) remplace un message en attente [W1]. Les trois options sont acceptées par `sendNotification` [W7].
- Abonnement périmé : la RFC prévoit `404` [W1], et les services de push répondent aussi `410`. Aujourd'hui `src/lib/push.ts` renvoie `false` pour **toute** erreur et `notifications.ts:665-674` efface alors l'abonnement : une panne passagère du service de push désabonne le boucher (E22). Cible : effacer sur `404` et `410` seulement, journaliser et garder l'abonnement pour le reste. Et ne plus renvoyer `true` quand les clés VAPID manquent (E4 d).
- Un abonnement par appareil. `User.pushSubscription` n'en stocke qu'un : la tablette et le téléphone du boucher s'écrasent. Changement de schéma : point à arbitrer A4.
- iPad et iPhone : Web Push seulement pour une application ajoutée à l'écran d'accueil, à partir d'iOS 16.4, et la permission doit être demandée en réponse à un geste [W6]. `use-kitchen-notifications.ts` la demande au montage : à déplacer derrière un bouton.
- Retrouver le boucher avec la clause `OR` sur `ownerId` (E4), sinon rien ne part.
- Modèles, préférences, autres canaux : `background-jobs-notifications`.
