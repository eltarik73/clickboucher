# Transitions temporelles : expiration, commandes programmées, relances

Le temps est un acteur comme le boucher ou le client. Il n'a pas d'écran : s'il n'agit que lorsque quelqu'un regarde, il n'agit pas.

## 1. Inventaire des échéances liées à une commande

| Échéance | Colonne qui fait foi | Effet attendu | Mécanisme au commit `161f920` | Problème |
|---|---|---|---|---|
| Boucher sans réponse | `Order.expiresAt` (`now + Shop.acceptTimeoutMin`, 10 min par défaut) | `PENDING → AUTO_CANCELLED`, prévenir le client, compter pour l'auto-pause | cron `auto-cancel`, une fois par jour à 01:00 UTC | E2, E3 |
| Retrait programmé dans 30 min | `Order.pickupSlotStart` | alerter la cuisine, prévenir le client | calcul dans le navigateur de la tablette + `POST scheduled-notify` | E13 |
| Commande prête non retirée | `Order.actualReady` + 30 min | rappeler le client | cron `ready-reminder`, une fois par jour à 07:00 UTC | E3 |
| Ajustement de prix palier 2 | `PriceAdjustment.autoApproveAt` (30 s par défaut dans le code) | valider d'office, mettre à jour le total | à la lecture (`GET /api/orders`, `GET /api/orders/[id]`) | E12 |
| Ajustement de prix palier 3 | `PriceAdjustment.escalateAt` (10 min) | escalader au webmaster | à la lecture | E12 |
| Retour en `PENDING` après choix du client | `Order.expiresAt` | repartir pour un délai complet | non recalculé (échéance d'origine, ou `null` après une première acceptation) | E7 |

Les échéances de boutique (fin de pause, fin du mode occupé, fin de snooze produit) relèvent de `background-jobs-notifications`.

Ce que publient les plateformes sur ce délai : Deliveroo refuse automatiquement une commande ni acceptée ni refusée au bout de 10 minutes (valeur par défaut, variable selon la région) [DL1] ; Uber Eats exige une acceptation ou un refus dans les 11,5 minutes, sinon la commande est annulée, et, pour les restaurants où l'appel automatique est activé, le déclenche après 90 secondes sans réponse [U3]. Deliveroo recommande aussi de ne pas afficher ni imprimer une commande programmée avant son heure de début de préparation, et de ne pas gonfler les temps de préparation par des délais artificiels [DL1].

## 2. Quatre principes

1. **La colonne fait foi, pas le passage du job.** Une commande est expirée dès que `status = PENDING` et `expiresAt <= now`. Le job ne fait que matérialiser. Toute décision (accepter, afficher) évalue l'échéance elle-même.
2. **Garde à la décision.** L'acceptation ajoute la condition d'échéance à son `WHERE` (`guard: notExpiredWhere(now)`) : une commande expirée ne peut pas être acceptée même si le job a une minute de retard. Attention à l'ordre de livraison : garde et job minute s'activent **ensemble**, après l'arbitrage A1. La garde seule, avec le cron quotidien actuel, rendrait inacceptable toute commande de plus de 10 minutes tout en la laissant affichée en `PENDING`.
3. **Le job réconcilie, il ne « déclenche » pas.** Il traite tout ce qui est en retard depuis toujours, pas « ce qui vient d'arriver ». Un passage manqué est rattrapé au suivant. Vercel prévient que la livraison des crons est « best effort » : un passage peut manquer, ou être livré deux fois, et deux passages peuvent se chevaucher [V4].
4. **Idempotent par construction.** Une instruction `UPDATE` conditionnelle fait le travail ; la relancer ne change rien. Les effets externes se réclament une fois (patron `claimOnce`).

## 3. Les mécanismes disponibles sur notre pile

| Mécanisme | Précision | Coût | Dépendance | État | Usage conseillé |
|---|---|---|---|---|---|
| Cron Vercel à la minute | la minute planifiée (Pro) [V3][V4] | 1 invocation par minute, soit environ 43 200 par mois ; 0,60 $ le million [V2] | aucune | les crons existent, aucun ne tourne plus d'une fois par jour | défaut pour toutes les échéances d'une minute et plus |
| Évaluation à l'écriture (garde) | exacte | nulle | aucune | absent | toujours, en complément |
| État dérivé à la lecture + `POST` de règlement idempotent | à la seconde si un écran est ouvert | nulle | aucune | aujourd'hui : écriture dans un `GET`, non atomique (E12) | seulement pour les échéances de moins d'une minute, avec le cron en filet |
| Message différé QStash | à la seconde ; délai maximal 7 jours (gratuit), 1 an (à l'usage) [UP1][UP2] | 1 000 messages par jour gratuits, puis 1 $ les 100 000 [UP2] | `@upstash/qstash` (non installé), signature à vérifier [UP3] | — | si une échéance à la seconde devient nécessaire |
| Vercel Queues (délai) | délai jusqu'à 7 jours [V6] | à l'opération | `@vercel/queue` (non installé) | bêta publique [V6][V10] | pas avant la sortie de bêta |
| Vercel Workflows (`sleep`) | sans limite de durée [V6] | à l'événement | paquet non installé | disponible depuis avril 2026 [V6] | flux multi-étapes (remboursement), pas une simple échéance |
| Vercel Schedules dynamiques | fenêtre de 1 à 15 min [V5] | celui de la cible (un sujet de file uniquement) | `@vercel/schedules` (non installé) | bêta ; remplace à terme les crons de `vercel.json` [V5] | ne pas migrer avant la sortie de bêta |

Ce qu'il ne faut pas utiliser : `setTimeout` dans une fonction (l'instance est mise en pause une fois les requêtes en cours terminées [V2]) ; un minuteur dans le navigateur d'un boucher (E13) ; `LISTEN/NOTIFY` de PostgreSQL et les verrous consultatifs de session : pgbouncer en mode transaction (mode exigé par Prisma [PR3]) ne les prend pas en charge [PGB1]. Un verrou consultatif n'est utilisable que sous sa forme transactionnelle (`pg_advisory_xact_lock`), dans une transaction.

Règles propres aux crons Vercel [V4] : uniquement sur le déploiement de production ; pas de nouvelle tentative en cas d'échec ; les redirections ne sont pas suivies ; `Authorization: Bearer ${CRON_SECRET}` (helper `verifyCronAuth` de `src/lib/cron-auth.ts`) ; garder `export const dynamic = "force-dynamic"` ; chemin `/api/cron/...` déjà exclu du middleware (`src/middleware.ts`), donc ne jamais y importer `server-auth`, `boucher-auth` ou `admin-auth` (règle CLAUDE.md). Vercel conseille un verrou quand un passage peut durer plus que l'intervalle [V4] : ici chaque balayage est une instruction conditionnelle, deux passages qui se chevauchent ne se gênent pas (vérifié [L5]) ; aucun verrou à ajouter tant que cela reste vrai.

## 4. Patron B — un seul job « échéances des commandes »

Un cron à la minute (`/api/cron/order-deadlines`, à créer) plutôt qu'un par échéance : une invocation, plusieurs balayages, chacun idempotent.

```ts
// src/lib/services/orders/deadlines.ts — à créer
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function expirePendingOrders(now: Date) {
  return prisma.$transaction(async (tx) => {
    // Une seule instruction UPDATE … RETURNING, sans `limit` : PostgreSQL ré-évalue le WHERE après
    // l'attente du verrou (READ COMMITTED) ; une commande acceptée entre-temps n'est ni modifiée ni renvoyée.
    const expired = await tx.order.updateManyAndReturn({
      where: { status: "PENDING", expiresAt: { not: null, lte: now } },
      data: { status: "AUTO_CANCELLED", autoCancelledAt: now },
      select: { id: true, shopId: true, userId: true, orderNumber: true },
    });
    if (expired.length === 0) return [];

    await tx.orderEvent.createMany({
      data: expired.map((o) => ({
        orderId: o.id,
        shopId: o.shopId,
        type: "AUTO_CANCELLED",
        actorId: "system:cron",
        payloadJson: { from: "PENDING", to: "AUTO_CANCELLED" },
      })),
    });
    return expired; // l'appelant notifie les clients et met à jour l'auto-pause, hors transaction
  });
}

/** `guard` de l'acceptation : pas d'acceptation après l'échéance, même si le job n'est pas passé. */
export function notExpiredWhere(now: Date): Prisma.OrderWhereInput {
  return { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}
```

Exécuté sur base jetable [L5] : une acceptation qui tient le verrou pendant le balayage est respectée (15 sur 15) et la commande voisine expire ; deux passages simultanés n'expirent chaque commande qu'une fois, avec un seul `OrderEvent` ; un passage en retard rattrape tout, un passage rejoué ne fait rien ; l'acceptation gardée d'une commande expirée renvoie `CONFLICT`. `updateManyAndReturn` émet bien un seul `UPDATE … RETURNING` avec le client 6.19.2 [L3].

Remarques :

- **Ne jamais borner ce balayage avec `limit`.** Avec `limit`, Prisma émet `UPDATE … WHERE id IN (SELECT id … LIMIT n)` : la condition de statut passe dans la sous-requête et n'est plus ré-évaluée après l'attente du verrou. Reproduit : la commande acceptée pendant le balayage finit `AUTO_CANCELLED`, 15 fois sur 15, et de même en SQL direct [L5]. Si un jour il faut borner : SQL brut avec `FOR UPDATE SKIP LOCKED` dans la sous-requête (prévu pour les tables consommées comme des files [PG2]), ou condition de statut répétée dans le `WHERE` extérieur ; les deux formes ont été vérifiées en SQL direct [L5]. Inutile à notre échelle : le nombre de commandes `PENDING` expirées à un instant donné est petit.
- Ce balayage traverse toutes les boutiques : c'est un job système, authentifié par `verifyCronAuth`, et chaque effet qui suit (événement, notification, auto-pause) porte le `shopId` de la commande. CLAUDE.md pose pourtant « toute requête métier est bornée par `shopId` » sans exception écrite : point A9 du SKILL.md.
- Auto-pause : incrémenter `missedOrdersCount` du nombre de commandes expirées de la boutique, par incrément atomique, sans modifier `Shop.updatedAt` (E20 ; ce champ alimente le `lastmod` du sitemap). Le dépôt a déjà la parade : passer `updatedAt` explicitement dans `data` (`src/lib/services/performance.ts`, paramètre `keepUpdatedAt`).
- Journaliser avec `logger` (`src/lib/logger.ts`) : nombre traité, durée, et une erreur Sentry si un passage dépasse l'intervalle. Durée bornée par `maxDuration: 30` (`vercel.json`). Surveillance : `reliability-observability`.

Tests d'intégration à porter dans le dépôt : (1) commande acceptée pendant le passage : reste `ACCEPTED` ; (2) deux passages simultanés : un seul `OrderEvent` par commande ; (3) passage manqué puis repris : tout le retard est traité ; (4) acceptation refusée (409) une seconde après `expiresAt` sans que le job soit passé.

## 5. « Une seule fois » sans migration — patron `claimOnce`

Pour les effets externes liés à une échéance (alerte à 30 min, rappel « prête ») on réclame l'effet par une écriture conditionnelle, puis on envoie seulement si la réclamation a réussi. Sans nouveau champ, la colonne JSON `notif_sent` suffit :

```ts
export async function claimOnce(orderId: string, event: string, now: Date): Promise<boolean> {
  const entry = JSON.stringify([{ event, at: now.toISOString() }]);
  const marker = JSON.stringify([{ event }]);
  const claimed = await prisma.$executeRaw`
    UPDATE orders
    SET notif_sent = COALESCE(notif_sent, '[]'::jsonb) || ${entry}::jsonb,
        updated_at = (now() AT TIME ZONE 'utc')
    WHERE id = ${orderId}
      AND NOT (COALESCE(notif_sent, '[]'::jsonb) @> ${marker}::jsonb)`;
  return claimed === 1;
}

/** Ajout atomique au journal notif_sent (remplace la lecture-puis-réécriture du tableau). */
export async function appendNotifLog(orderId: string, entry: { event: string; channels: string[]; at: string }) {
  const json = JSON.stringify([entry]);
  await prisma.$executeRaw`
    UPDATE orders SET notif_sent = COALESCE(notif_sent, '[]'::jsonb) || ${json}::jsonb WHERE id = ${orderId}`;
}
```

Exécuté [L6] : sur 20 doubles appels simultanés, un seul `true` ; une entrée déjà écrite par `sendNotification` (`{ event, channels, at }`) est reconnue. `notif_sent` est bien en `jsonb` et `updated_at` en `timestamp(3)` sans fuseau, que Prisma lit comme de l'UTC.

**Condition d'emploi, sinon le patron ne tient pas :** tant qu'un autre code lit `notifSent` puis réécrit le tableau entier (`notifications.ts:683-696`, `scheduled-notify/route.ts:91-99`), une réclamation posée entre sa lecture et son écriture est effacée, et l'effet peut repartir (reproduit [L6]). Dans le même chantier, remplacer ces deux réécritures par `appendNotifLog` (avec lui, aucune entrée perdue sur 20 essais concurrents).

Réclamer avant d'envoyer donne « au plus une fois » : si l'envoi échoue après la réclamation, le client n'est pas prévenu. Pour un effet qui doit absolument partir, il faut un état (à envoyer, envoyé) que le job puisse rejouer : une colonne dédiée ou une table d'effets, donc une migration (point A3 du SKILL.md).

## 6. Commandes programmées

Cible : le serveur décide de la bascule, la tablette l'affiche.

- Le job minute sélectionne `status = ACCEPTED`, `pickupSlotStart <= now + 30 min`, non encore réclamées (`claimOnce(id, "SCHEDULED_PREPARE", now)`, nom d'événement déjà utilisé par `scheduled-notify`), puis envoie le push au boucher et la notification au client. Index `[shopId, pickupSlotStart]` déjà présent ; pour un balayage toutes boutiques, mesurer avec `EXPLAIN` et ajouter un index partiel si nécessaire (voir `prisma-expert`).
- La cuisine continue de calculer la section d'affichage (« à préparer maintenant » contre « programmées ») à partir de `pickupSlotStart` : c'est du rendu, pas une décision. L'appel `scheduled-notify` depuis le navigateur disparaît quand le job existe (CLAUDE.md décrit le mécanisme actuel : point A3).
- Une commande programmée en `PENDING` porte aujourd'hui le même `expiresAt` qu'une commande immédiate. Faut-il la laisser expirer en 10 minutes ? Point à arbitrer A1.
- Toutes les heures affichées ou comparées à « aujourd'hui » passent par `src/lib/paris-time.ts` (règle CLAUDE.md).

## 7. Ajustements de prix

Tant que le délai du palier 2 est inférieur à la minute, le cron ne suffit pas, et un `GET` ne doit rien écrire (règle 10). Trois pièces :

1. **Dériver sans écrire.** Les lectures calculent l'état effectif (`PENDING` dont `autoApproveAt` est passé = validé d'office) pour l'affichage. Fonction pure, testable dans `src/lib/__tests__/`.
2. **Régler par un `POST` idempotent** (par exemple `POST /api/orders/[id]/adjustment/settle`, à créer), appelé par l'écran du client quand son compte à rebours arrive à zéro. Il réclame : `priceAdjustment.updateMany({ where: { id, status: "PENDING", tier: 2, autoApproveAt: { lte: now } }, data: { status: "AUTO_VALIDATED", respondedAt: now } })`. Si `count === 1` seulement : appliquer le total et les lignes dans la même transaction, toucher `Order` (pour la cuisine), écrire un `OrderEvent`, puis notifier. Sinon : ne rien faire et renvoyer l'état courant.
3. **Le job minute fait le même règlement en filet** pour les commandes que personne ne regarde, et traite l'escalade du palier 3.

La règle métier elle-même (30 s ou 5 min, validation tacite ou accord explicite) est le point A1 de `click-and-collect` : ne pas coder ce règlement avant sa réponse.

## 8. Pièges

- **Aucun cron de `vercel.json` ne tourne plus d'une fois par jour.** C'est le plafond de l'offre Hobby (une fois par jour, à l'heure près [V3]) ; en Pro la minute est permise [V3]. Changer la fréquence d'`auto-cancel` change le produit (A1).
- **Fuseau.** `vercel.json` planifie en UTC ; « 9 h » en été et en hiver ne tombent pas au même moment à Paris.
- **Lecture qui écrit.** Un `GET` ne doit rien modifier : il est rejoué par les sondes, les préchargements et les nouvelles tentatives.
- **Durée.** `vercel.json` fixe `maxDuration: 30` pour `src/app/api/**` ; un balayage doit finir bien avant.
- **Promesses Prisma paresseuses.** Une requête Prisma ne part que lorsqu'elle est attendue (`await`, `.then`, `Promise.all`). Dans un test de course, `const p = prisma.order.updateMany(…)` sans `await` n'a encore rien envoyé : lancer les deux acteurs par `Promise.all`, sinon le test passe sans rien prouver (piège rencontré pendant la vérification de ce skill).
- **Pas d'aperçu en ligne.** Les crons ne tournent que sur le déploiement de production [V4], et `vercel.json` désactive les déploiements de preview des branches `claude/**` et `dependabot/**` : un job se teste en appelant son handler en test d'intégration, ou en local avec le secret.
