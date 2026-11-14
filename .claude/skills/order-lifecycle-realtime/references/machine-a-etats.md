# Machine à états, transactions, idempotence, audit

Versions visées : Prisma 6.19.2, PostgreSQL (Railway, derrière pgbouncer), Next.js 14.2.35. Les extraits de code compilent (`tsc --noEmit`, TypeScript 5.9.3, client Prisma généré de ce dépôt [L1]) et les patrons A et C ont été exécutés sur une base PostgreSQL 15 jetable, courses comprises [L2][L4][L7]. Ce n'était ni la base de production ni un passage par pgbouncer : chaque patron cite le test d'intégration à porter dans `tests/integration/` (voir `testing-strategy`).

## 1. La table des transitions telle qu'elle doit être

Source unique : `src/lib/order-state-machine.ts`. On raisonne en **événements** (ce qui arrive) et non en statut cible : l'appelant dit « le boucher accepte », la machine dit où cela mène et si c'est permis [X1]. Une garde est une fonction pure et synchrone [X2] ; ici la garde est la table.

| Événement | Acteur | Départ | Arrivée | Effets dans la transaction | Effets après validation |
|---|---|---|---|---|---|
| `accept` | boucher | `PENDING`, `PARTIALLY_DENIED` | `ACCEPTED` | `estimatedReady`, `qrCode`, `expiresAt = null`, réservation du stock limité (§ 4) | notifier le client |
| `deny` | boucher | `PENDING`, `ACCEPTED`, `PARTIALLY_DENIED` | `DENIED` | `denyReason` ; libération du stock selon § 4 ; coupon / récompense : A10 | notifier le client |
| `start_preparing` | boucher | `ACCEPTED` | `PREPARING` | `estimatedReady` éventuel | notifier le client |
| `mark_ready` | boucher | `ACCEPTED`, `PREPARING` | `READY` | `actualReady` | notifier le client |
| `confirm_pickup` / `manual_pickup` | boucher | `READY` | `PICKED_UP` | `pickedUpAt`, `qrScannedAt` | reçu par e-mail |
| `cancel_by_shop` | boucher | `PENDING`, `ACCEPTED`, `PREPARING`, `PARTIALLY_DENIED` | `CANCELLED` | comme `deny` | notifier le client |
| `cancel_by_client` | client | `PENDING`, `ACCEPTED` (fenêtre `isCancellable`) | `CANCELLED` | comme `deny` | notifier le **boucher** |
| `expire` | système | `PENDING` avec `expiresAt` dépassé | `AUTO_CANCELLED` | `autoCancelledAt` ; coupon / récompense : A10 | notifier le client, compteur d'auto-pause |
| `item_unavailable` | boucher | `PENDING`, `ACCEPTED` | `PARTIALLY_DENIED`, ou `DENIED` si tout manque | articles `available = false`, total recalculé, libération du stock si départ `ACCEPTED` (§ 4) | notifier le client |
| `client_accept_changes` | client | `PARTIALLY_DENIED` | `PENDING`, ou `DENIED` si tout est retiré | lignes remplacées ou retirées, total, **nouvel `expiresAt`** | notifier le boucher |
| `rate` | client | `PICKED_UP` | `COMPLETED` | note | — |
| paiement reçu, échoué, remboursé | Stripe | voir E23 | à fixer avec `stripe-payment` (A11) | — | — |

À faire dans la table actuelle : ajouter `PARTIALLY_DENIED → PENDING` et `ACCEPTED → PARTIALLY_DENIED` (le code les fait déjà, écart E7), exporter les ensembles `TERMINAL` et `ACTIVE` dérivés de la table et supprimer les six listes écrites à la main (E8). Tout ajout à la table s'accompagne d'un cas dans `src/lib/__tests__/order-state-machine.test.ts`.

**Faut-il XState ?** Non pour l'instant. La machine est plate (10 états, aucune hiérarchie, aucun parallélisme) et ce qui manque n'est pas l'expression des règles mais leur application en base. XState 5 offre des fonctions pures `transition(machine, state, event)` utilisables côté serveur [X1] ; elles deviennent intéressantes si la commande gagne des sous-états (paiement en ligne, litige). La bibliothèque est solide (30 457 étoiles, activité du jour) mais n'est pas installée : ne pas l'ajouter sans décision.

## 2. Patron A — transition conditionnelle

Principe : l'écriture porte elle-même la condition sur l'état de départ. En `READ COMMITTED` (niveau par défaut de PostgreSQL ; Prisma garde celui de la base [PR1]), un `UPDATE` qui rencontre une ligne modifiée par une transaction concurrente attend sa fin puis **ré-évalue son `WHERE`** sur la nouvelle version ; si la ligne ne correspond plus, elle n'est pas modifiée et aucune erreur n'est levée [PG1]. Deux transitions concurrentes : une seule voit `count === 1`.

C'est le patron de contrôle de concurrence optimiste documenté par Prisma : `updateMany` avec la condition dans `where`, puis test de `count` [PR1]. Prisma 6.19.2 émet bien une seule instruction `UPDATE "orders" SET "status" = …, "updated_at" = … WHERE ("id" = … AND "shop_id" = … AND "status" IN (…))` [L3].

```ts
// src/lib/services/orders/transition.ts — à créer
import { Prisma, type OrderStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { canTransition } from "@/lib/order-state-machine";

type TransitionedOrder = { id: string; status: OrderStatus; shopId: string; userId: string; orderNumber: string };

export type TransitionResult =
  | { ok: true; order: TransitionedOrder }
  | { ok: false; reason: "NOT_FOUND" | "ILLEGAL" }
  | { ok: false; reason: "CONFLICT"; current: OrderStatus };

/** Périmètre obligatoire. Jamais de champ optionnel : Prisma ignore un filtre dont la valeur est `undefined`. */
export type TransitionScope =
  | { shopId: string } // boucher : shopId rendu par getAuthenticatedBoucher()
  | { userId: string } // client : User.id Prisma (pas le clerkId rendu par getServerUserId())
  | "system"; // cron, webhook Stripe

export async function transitionOrder(input: {
  orderId: string;
  scope: TransitionScope;
  /** Le ou les statuts que l'appelant vient de lire. */
  from: OrderStatus[];
  to: OrderStatus;
  /** User.id Prisma, ou "system:cron" / "system:stripe". */
  actorId: string;
  eventType: string;
  data?: Prisma.OrderUncheckedUpdateManyInput;
  /** Condition supplémentaire de l'écriture, par exemple notExpiredWhere(now). */
  guard?: Prisma.OrderWhereInput;
  payload?: Prisma.InputJsonObject;
  /** Écritures liées (stock, coupon…) : même transaction, uniquement via `tx`. */
  extra?: (tx: Prisma.TransactionClient) => Promise<void>;
}): Promise<TransitionResult> {
  const from = input.from.filter((s) => canTransition(s, input.to));
  if (from.length === 0) return { ok: false, reason: "ILLEGAL" };

  const scope = input.scope === "system" ? {} : input.scope;
  if (Object.values(scope).some((v) => typeof v !== "string" || v === "")) {
    throw new Error("transitionOrder: périmètre vide");
  }

  return prisma.$transaction(async (tx): Promise<TransitionResult> => {
    const { count } = await tx.order.updateMany({
      where: { AND: [{ id: input.orderId, ...scope, status: { in: from } }, input.guard ?? {}] },
      data: { ...input.data, status: input.to },
    });

    if (count === 0) {
      const current = await tx.order.findFirst({
        where: { id: input.orderId, ...scope },
        select: { status: true },
      });
      if (!current) return { ok: false, reason: "NOT_FOUND" };
      return { ok: false, reason: "CONFLICT", current: current.status };
    }

    await input.extra?.(tx);

    const order = await tx.order.findUniqueOrThrow({
      where: { id: input.orderId },
      select: { id: true, status: true, shopId: true, userId: true, orderNumber: true },
    });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        shopId: order.shopId,
        type: input.eventType,
        actorId: input.actorId,
        payloadJson: { ...input.payload, from, to: input.to },
      },
    });
    return { ok: true, order };
  });
}
```

Traduction en réponse HTTP, une seule fois pour toutes les routes (codes alignés sur `api-route-conventions`) :

```ts
import type { OrderStatus } from "@prisma/client";
import { apiError, apiSuccess } from "@/lib/api/errors";
import type { TransitionResult } from "./transition";

export function respondToTransition(result: TransitionResult, to: OrderStatus, readStatus: OrderStatus) {
  if (result.ok) return apiSuccess(result.order);
  if (result.reason === "NOT_FOUND") return apiError("NOT_FOUND", "Commande introuvable");
  if (result.reason === "CONFLICT" && result.current === to) {
    return apiSuccess({ status: result.current, _idempotent: true }); // rejeu : déjà fait
  }
  const current = result.reason === "CONFLICT" ? result.current : readStatus;
  return apiError("CONFLICT", `Action impossible : la commande est au statut ${current}`);
}
```

Règles d'emploi :

- **`from` = le statut que l'appelant vient de lire**, en général un seul. La route lit la commande pour valider et préparer les effets (stock à réserver, délai), puis appelle `transitionOrder({ from: [order.status], … })`. Si un concurrent a bougé la commande entre la lecture et l'écriture, `count` vaut 0 et rien de ce qui a été calculé sur l'ancienne lecture n'est appliqué.
- **Rejouer = succès, à deux endroits.** (1) À la lecture : si la commande est déjà dans l'état visé ou au-delà (pour `accept` : `ACCEPTED`, `PREPARING`, `READY` ; pour le retrait : `PICKED_UP`, `COMPLETED`), répondre 200 avec `_idempotent: true` sans appeler la transition, comme le fait déjà la route unifiée. Sinon `from: ["ACCEPTED"]` vers `ACCEPTED` renverrait `ILLEGAL`. (2) Après la course : `CONFLICT` avec `current === to` vaut aussi 200.
- **Impossible = 409.** `ILLEGAL` (la table refuse) et `CONFLICT` (l'état a changé, ou le `guard` a refusé : le statut courant est alors encore celui de départ) donnent `apiError("CONFLICT", …)` avec le statut courant, pour que l'écran se rafraîchisse. La route unifiée répond aujourd'hui 400 `VALIDATION_ERROR` : changer le code dans un commit distinct, avec le test (`tests/api/boucher/orders/action.test.ts`) et les écrans qui lisent l'erreur.
- **Le périmètre est dans le `WHERE` de l'écriture.** `scope: { shopId }` remplace le couple « lire puis comparer `order.shopId` » : même si un contrôle manque plus haut, la base refuse d'écrire hors boutique (une autre boutique obtient `NOT_FOUND` [L4]). Côté client, `userId` est l'identifiant Prisma : le résoudre depuis le `clerkId` avant d'appeler (règle « Résolution userId » de CLAUDE.md). `where: { shopId: undefined }` écrit sans filtre [L11] : d'où le type sans champ optionnel et le contrôle à l'exécution. Détails multi-boutique : `security-multitenant`.
- **Pas de `limit`, pas de liste d'identifiants lue avant.** La garde ne vaut que si la condition de statut est dans le `WHERE` de l'`UPDATE` lui-même (voir [transitions-temporelles.md](transitions-temporelles.md) § 4).
- **Une seule fonction écrit `status`.** Après migration des routes, un test statique peut le verrouiller : aucun fichier hors `transition.ts`, `create.ts` et le job d'échéances ne contient `status:` dans un `data` de `order.update*`.

Test d'intégration à porter (déjà exécuté hors dépôt [L4]) : `Promise.all([accept, cancel_by_client])` sur la même commande `PENDING`, 70 fois ; exactement un `ok: true` et un `CONFLICT` ; un seul `OrderEvent` ; une exception dans `extra` annule statut et événement ; un rejeu avec lecture périmée renvoie `CONFLICT` avec `current === to`.

## 3. Règles de transaction

1. **Dedans** : le statut, les champs liés, le stock, la consommation ou la restitution du coupon, l'`OrderEvent`. Ce qui doit être vrai ensemble.
2. **Dehors, après validation** : e-mail, push, WhatsApp, Stripe, Redis, tout appel réseau. La documentation Prisma demande des transactions courtes et sans requête réseau [PR1]. Défauts du client installé : `maxWait` 2 000 ms, `timeout` 5 000 ms (lus dans `node_modules/@prisma/client/runtime/library.js`) ; au-delà, la transaction est annulée.
3. **Dans le callback, uniquement `tx`.** Sur Vercel la chaîne de connexion porte `connection_limit=1` (CLAUDE.md) : un appel à `prisma.` (hors `tx`) à l'intérieur attend la connexion que la transaction détient. Mesuré avec `connection_limit=1` : blocage de 5 s, puis `P2028` « Transaction already closed », écriture annulée [L9]. `Promise.all` de requêtes `tx` ne gagne rien non plus : une transaction n'a qu'une connexion.
4. **`$transaction([...])` n'est pas une garde.** La forme tableau garantit l'atomicité et l'ordre [PR1], pas l'absence de course : si la décision vient d'une lecture antérieure, elle reste périmée (reproduit : `CANCELLED` écrasé par `ACCEPTED` [L4]).
5. **Invariant sur plusieurs lignes = compteur conditionnel ou verrou**, jamais « compter puis insérer » (E17). Trois options, de la plus simple à la plus lourde : (a) ligne compteur mise à jour sous condition (`updateMany({ where: { id, used: { lt: max } }, data: { used: { increment: 1 } } })`, puis `count`) ; (b) `SELECT … FOR UPDATE` de la ligne parente dans la transaction [PG2] ; (c) isolation `Serializable` avec nouvelle tentative sur `P2034` [PR1]. Le stock limité suit déjà (a) sous une autre forme : décrément atomique puis contrôle du signe dans la même transaction.
6. **`@updatedAt` est posé par Prisma, pas par la base** [PR2]. `update` et `updateMany` l'écrivent ; une écriture en SQL brut doit écrire `updated_at` elle-même, et une mise à jour d'une table fille seule (`OrderItem`, `PriceAdjustment`) ne touche pas la ligne `Order` (vérifié pour les trois cas [L11]). Ce que la cuisine doit voir touche donc aussi `Order` dans la même transaction (voir [temps-reel-cuisine.md](temps-reel-cuisine.md)).
7. **Ne pas compter sur le texte des erreurs Prisma.** Tester `err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"` (ou `P2025`, `P2034`).

## 4. Stock limité : réservé pendant `ACCEPTED`, `PREPARING`, `READY`

Constat (E6) : aujourd'hui le statut ne dit pas si le stock anti-gaspi ou vente flash a été décrémenté. Une commande peut être `ACCEPTED` sans décrément (boutique `autoAccept`, webhook Stripe), revenir en `PENDING` après une rupture puis être ré-acceptée (double décrément), ou être refusée depuis `PARTIALLY_DENIED` après avoir été acceptée. Décider « restaurer » sur le seul statut de départ est donc faux, même protégé par `from`.

Règle cible proposée (à valider avec `click-and-collect`, qui tient la règle métier du stock) : faire de « stock réservé » un **invariant du statut**.

- Réservé si et seulement si la commande est `ACCEPTED`, `PREPARING` ou `READY`.
- Entrer dans cet ensemble depuis l'extérieur décrémente ; en sortir restaure, sauf vers `PICKED_UP` (la vente est faite). Donc `item_unavailable` depuis `ACCEPTED` restaure, une ré-acceptation décrémente de nouveau, et un refus depuis `PENDING` ou `PARTIALLY_DENIED` ne restaure rien.
- La décision se prend sur `from` (garanti par l'écriture conditionnelle) et `to`, dans `extra`, donc dans la transaction : elle ne peut pas s'appliquer deux fois.
- Conséquence : **toute** entrée en `ACCEPTED` passe par la même fonction, y compris la création d'une commande `autoAccept` (décrément dans la transaction de création) et l'effet d'un paiement (A11).

Limite à la bascule : les commandes `autoAccept` déjà en cours au déploiement n'ont pas été décrémentées ; leur annulation restaurera une dernière fois à tort. Variante sans cet effet de bord, mais avec migration : une colonne de preuve (`stockReservedAt`) posée et effacée dans les mêmes transactions ; à arbitrer avec `prisma-expert`.

## 5. Idempotence

Définition utile : rejouer la même demande ne produit pas un second effet. Elle se joue à quatre endroits.

### 5.1 Création de commande — patron C

Le client crée une clé par **tentative de commande** (UUID v4 [S1]) et la renvoie telle quelle sur « Réessayer » : voir `click-and-collect`, invariant 3. Côté serveur, c'est la contrainte `@unique` de `Order.idempotencyKey` qui arbitre, pas la lecture préalable (qui reste utile comme raccourci) :

```ts
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

/** La contrainte unique a-t-elle sauté sur la clé d'idempotence (et non sur orderNumber) ? */
export function isIdempotencyKeyCollision(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") return false;
  const target = err.meta?.target;
  return Array.isArray(target) ? target.includes("idempotency_key") : String(target ?? "").includes("idempotency_key");
}

export async function createOnce<T extends { id: string }>(
  idempotencyKey: string | null,
  userId: string,
  create: () => Promise<T>
): Promise<{ order: T | { id: string }; replayed: boolean }> {
  try {
    return { order: await create(), replayed: false };
  } catch (err) {
    if (idempotencyKey && isIdempotencyKeyCollision(err)) {
      // Le perdant de la course relit la ligne du gagnant, bornée à SON utilisateur.
      const existing = await prisma.order.findFirst({ where: { idempotencyKey, userId }, select: { id: true } });
      if (existing) return { order: existing, replayed: true };
    }
    throw err; // autre contrainte unique (orderNumber) : laisser la boucle de numérotation décider
  }
}
```

Exécuté [L7] : 40 doubles envois simultanés donnent une commande et un rejeu ; la clé d'un autre utilisateur ne renvoie aucune commande (le `P2002` est relancé) ; `err.meta.target` vaut `["idempotency_key"]` pour la clé et `["order_number"]` pour le numéro, avec le client et le PostgreSQL utilisés ici.

Trois règles reprises de Stripe : la clé identifie une opération, pas un utilisateur ni un panier ; une même clé avec un contenu différent est une erreur, pas un rejeu (comparer au minimum `shopId` et le total recalculé) ; une clé n'a de sens que pendant la fenêtre de nouvelle tentative : Stripe purge les siennes après 24 h au moins [S1], Shopify parle de « 24 heures ou moins » [SH1]. Le client ne retente qu'avec attente croissante et aléa [S2].

Intégration dans `createOrder` : résoudre l'utilisateur **avant** la lecture par clé, borner cette lecture à `userId`, et dans la boucle de numérotation sortir immédiatement sur une collision de clé (rejeu) au lieu de retenter comme pour une collision d'`orderNumber`. `create.ts` est aussi touché par le chantier « prix des commandes » : faire ce changement avec lui, pas en parallèle.

### 5.2 Transitions

Couvert par le patron A : même transition rejouée = 200, transition devenue impossible = 409.

### 5.3 Messages entrants (webhooks, crons)

Un cron Vercel peut être livré deux fois ou pas du tout [V4] ; un événement Stripe peut être rejoué pendant trois jours et arriver dans le désordre [S3]. Donc : dédoublonner par identifiant d'événement (table `StripeEvent`, déjà là), puis appliquer l'effet par `transitionOrder` avec `scope: "system"` et `actorId: "system:stripe"`. Un événement en retard qui trouve la commande dans un autre état obtient `CONFLICT` et s'arrête sans rien écraser. Détails Stripe : `stripe-payment`.

### 5.4 Effets sortants (notifications)

Un effet « une seule fois » se réclame par une écriture conditionnelle avant l'envoi (patron `claimOnce` de [transitions-temporelles.md](transitions-temporelles.md)), pas par lecture puis réécriture d'un tableau JSON (E13).

## 6. Effets après validation : ne pas les perdre en silence

Deux écritures dans deux systèmes (base puis e-mail ou push) ne sont pas atomiques : c'est le problème de la double écriture [AWS1]. Les grandes plateformes le traitent en enregistrant l'action à faire dans la même transaction que le changement d'état, puis en l'exécutant au moins une fois (Uber : table d'actions différées « LATE » [U2] ; DoorDash : enregistrement « in-progress » relu par un mécanisme de secours [D2]).

Chez nous, par ordre de coût :

1. **Tout de suite (sans dépendance)** : `await` l'effet essentiel avant de répondre quand il conditionne le service (prévenir le boucher d'une nouvelle commande), et vérifier son résultat (`sendNotification` renvoie `{ sent, channels }`). Attention : `sent: true` ne prouve pas l'envoi tant que `push.ts` renvoie `true` sans clés VAPID (E4 d) ; corriger ce retour avant de s'y fier. Un effet secondaire (e-mail de confirmation, auto-busy) peut suivre.
2. **Filet de rattrapage** : le job minute relit les commandes dont l'effet attendu manque (par exemple `PENDING` depuis plus d'une minute sans entrée `ORDER_PENDING` dans `notifSent`) et le rejoue via `claimOnce`. C'est une boîte d'envoi minimale qui réutilise les colonnes existantes.
3. **`waitUntil`** de `@vercel/functions` pour répondre avant la fin de l'effet [V9]. Paquet non installé ; `after()` de Next.js n'existe qu'à partir de la 15.1 [V9] et n'est pas exporté par `next/server` en 14.2.35 (vérifié dans `node_modules`). `waitUntil` ne réessaie pas et s'arrête au `maxDuration` [V6] : il ne remplace pas le filet.
4. **File durable** (Vercel Queues en bêta [V10], QStash) : quand le volume ou les exigences le justifient. Voir `background-jobs-notifications`.

Un échec de notification n'annule jamais une transition validée.

## 7. Journal d'audit (`OrderEvent`)

- Une ligne par transition **et** par action sans changement d'état qui engage quelqu'un (ajout de temps, ajustement, note), écrite dans la transaction qui fait le changement.
- `type` : valeur d'une liste fermée exportée du module de transition (aujourd'hui chaîne libre). `actorId` : identifiant Prisma de l'utilisateur, ou `system:cron`, `system:stripe`.
- `payloadJson` : au minimum `{ from, to }` (écrit par `transitionOrder`), plus le motif. Pas de donnée personnelle autre que des identifiants (durée de conservation et droits : `conformite-france`).
- Ajout seul : jamais d'`update` ni de `delete` sur `OrderEvent`.
- `[shopId, createdAt]` et `[orderId]` sont indexés : l'historique d'une commande et le journal d'une boutique se lisent sans nouvel index.

## 8. Numérotation

- `DailyCounter` : l'`upsert` avec `increment` est émis en une instruction `INSERT … ON CONFLICT DO UPDATE` (24 appels concurrents, 24 numéros distincts [L8]), mais le jour doit être celui de Paris (`src/lib/paris-time.ts`), pas `setHours(0,0,0,0)` en UTC (E15). Les trous dans la numérotation sont acceptables : le compteur est pris hors transaction de création.
- `orderNumber` : remplacer « dernier + 1 puis nouvel essai » par un compteur annuel pris de la même façon (ligne compteur, incrément atomique). À défaut, garder la boucle mais la factoriser pour `reorder`. `src/lib/services/order-number.service.ts` (format `CB-…`) est du code mort : ne pas le réutiliser.
