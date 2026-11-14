# Notifications fiables : table d'envoi (outbox), relais, rejeu

Statut : **proposition** (migration à arbitrer, B2). Rien de ce fichier n'existe encore dans `src/`.
En attendant : voir § 6 « Sans l'outbox ».

## 1. Le problème chez nous

Une transition de commande valide la base, puis appelle `sendNotification` (`await`). Deux écritures
dans deux systèmes ne sont pas atomiques [AWS1][MS1] : si Resend répond 500, si le push expire, si la
fonction est arrêtée par sa durée maximale, la notification est perdue et rien ne la rejoue (N1). Pour
un « commande prête » ou un « nouvelle commande », c'est un client qui attend au comptoir ou une
commande que le boucher ne voit pas.

## 2. Le patron retenu : outbox + envoi immédiat + relais

1. **Dans la transaction métier** (paramètre `effects` de `transitionOrder`,
   `src/lib/services/orders/transition.ts`, ou la transaction de création), insérer une ligne par canal
   dans `notification_outbox`, avec une **clé de dédoublonnage** déterministe
   (`ORDER_READY:<orderId>:EMAIL`). La notification existe si et seulement si la transition a été validée [MS1].
2. **Après la validation**, la commande tente l'envoi tout de suite (latence identique à aujourd'hui) en
   réclamant **ses** lignes (`drainOutbox({ orderId })`), sous un budget court.
3. **Le relais** (cron à la minute, `jobs-serverless.md` § 6) réclame les lignes dues (`PENDING` dont
   `next_attempt_at` est passé, ou `SENDING` dont le bail a expiré) et les rejoue avec attente croissante,
   jusqu'à `FAILED` (erreur définitive ou 8 tentatives), alors `logger.error` (Sentry).

Conséquence assumée : **au moins une fois**. Un relais qui meurt entre l'envoi et le marquage renverra
[MS1]. On limite les doublons par la clé d'idempotence du fournisseur quand elle existe (Resend :
`Idempotency-Key`, 24 h [RS4]) et par `topic` pour le push (remplace un message en attente de même
sujet [RFC8030]). Les SMS et WhatsApp n'ont pas de garde équivalente : y préférer l'absence d'envoi au doublon.

La ligne `Notification` (in-app) reste la vérité affichée dans l'application ; elle s'écrit dans la même
transaction que l'outbox, pas après les envois.

Le destinataire se résout **à l'envoi** (`resolveNotificationRecipient(event, payload)` de
`src/lib/notification-recipients.ts`, qui sait retrouver le propriétaire d'une boutique) : la ligne porte
l'événement et des identifiants, pas une adresse.

## 3. Schéma proposé (migration à arbitrer)

```prisma
enum OutboxStatus {
  PENDING
  SENDING
  SENT
  FAILED
  SKIPPED
}

model NotificationOutbox {
  id            String       @id @default(cuid())
  dedupKey      String       @unique @map("dedup_key")
  event         String
  channel       NotifChannel
  userId        String?      @map("user_id")
  orderId       String?      @map("order_id")
  payloadJson   Json         @map("payload_json")
  status        OutboxStatus @default(PENDING)
  attempts      Int          @default(0)
  nextAttemptAt DateTime     @default(now()) @map("next_attempt_at") @db.Timestamptz(3)
  lockedUntil   DateTime?    @map("locked_until") @db.Timestamptz(3)
  lastError     String?      @map("last_error")
  providerId    String?      @map("provider_id")
  sentAt        DateTime?    @map("sent_at") @db.Timestamptz(3)
  createdAt     DateTime     @default(now()) @map("created_at") @db.Timestamptz(3)

  @@index([status, nextAttemptAt])
  @@index([orderId])
  @@map("notification_outbox")
}
```

- Schéma validé par `prisma migrate diff --from-empty --to-schema-datamodel` (Prisma 6.19.2) [L2] : il
  produit deux types `"OutboxStatus"` et `"NotifChannel"` (ce dernier existe déjà) et des colonnes
  `TIMESTAMPTZ(3)`.
- **`Timestamptz` est un écart voulu, à confirmer avec `prisma-expert` (son point A7)** : toutes les
  colonnes existantes sont en `timestamp(3)` sans fuseau, et `prisma-expert` demande de ne pas les
  convertir. Ici les dates ne sont comparées qu'à `now()` en SQL brut : en `timestamptz` la comparaison ne
  dépend pas du fuseau de la session. Si l'arbitrage retient `timestamp(3)` par cohérence, remplacer
  chaque `now()` du § 4 par `(now() AT TIME ZONE 'UTC')` (règle 10 de `prisma-expert`) et rejouer [L2].
- `payloadJson` contient ce qu'il faut pour rendre le message **au moment de l'envoi** (identifiants, pas
  le HTML) : un gabarit corrigé s'applique aux rejeux.
- Migration : `prisma-expert` (`migrate dev` en local, `migrate deploy` en production, jamais l'inverse).
- Purge : lignes `SENT` et `SKIPPED` de plus de 30 jours, par un cron quotidien, par lots.

## 4. Code (compilé contre le dépôt [L1], exécuté par le client Prisma du dépôt [L2])

SQL brut : le relais a besoin de `FOR UPDATE SKIP LOCKED`, que l'API de modèle n'offre pas. L'insertion
peut passer par `tx.notificationOutbox.createMany({ data, skipDuplicates: true })` une fois le client régénéré.

**Piège rencontré en vérifiant ce fichier :** un paramètre de `$executeRaw` / `$queryRaw` part en `text`.
Vers une colonne enum, PostgreSQL répond `42804 column "channel" is of type "NotifChannel" but expression
is of type text`. Il faut un cast explicite (`${x}::"NotifChannel"`). Un littéral SQL (`'PENDING'`) n'a pas
ce problème. Conséquence : un SQL brut ne se valide **pas** dans `psql`, mais par le client Prisma sur une
base créée depuis le schéma Prisma.

```ts
// src/lib/services/notification-outbox.ts (proposé)
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

type Tx = Prisma.TransactionClient;
type OutboxChannel = "EMAIL" | "PUSH" | "SMS" | "WHATSAPP";
export type OutboxRow = { id: string; event: string; channel: OutboxChannel; order_id: string | null; payload_json: unknown; attempts: number };
export type DeliveryResult =
  | { ok: true; providerId?: string }
  | { ok: false; retryable: boolean; reason: string }
  | { skipped: string }; // préférence coupée, message périmé : ni envoi ni échec

const MAX_ATTEMPTS = 8;

/** Dans la transaction métier (`effects` de transitionOrder). Rejouer la transition n'ajoute rien (clé unique). */
export async function enqueueNotification(
  tx: Tx,
  item: { dedupKey: string; event: string; channel: OutboxChannel; orderId?: string; userId?: string; payload: Record<string, unknown> }
): Promise<void> {
  // Un paramètre de $executeRaw part en `text` : sans le cast, PostgreSQL refuse la colonne enum (42804).
  await tx.$executeRaw`
    INSERT INTO notification_outbox (id, dedup_key, event, channel, user_id, order_id, payload_json, status, attempts, next_attempt_at, created_at)
    VALUES (gen_random_uuid()::text, ${item.dedupKey}, ${item.event}, ${item.channel}::"NotifChannel", ${item.userId ?? null}, ${item.orderId ?? null},
            ${JSON.stringify(item.payload)}::jsonb, 'PENDING', 0, now(), now())
    ON CONFLICT (dedup_key) DO NOTHING`;
}

/**
 * Réclame des lignes dues : deux appels simultanés reçoivent des lignes disjointes (SKIP LOCKED) ; une ligne
 * réclamée puis abandonnée (fonction tuée) redevient réclamable à la fin du bail de 2 min.
 * `orderId` : envoi immédiat par la commande qui vient de valider la transition (ses lignes seulement).
 */
export async function claimOutboxBatch(options: { limit?: number; orderId?: string } = {}): Promise<OutboxRow[]> {
  const onlyOrder = options.orderId ? Prisma.sql`AND order_id = ${options.orderId}` : Prisma.empty;
  return prisma.$queryRaw<OutboxRow[]>`
    UPDATE notification_outbox
    SET status = 'SENDING', attempts = attempts + 1, locked_until = now() + interval '2 minutes'
    WHERE id IN (
      SELECT id FROM notification_outbox
      WHERE status IN ('PENDING', 'SENDING')
        AND attempts < ${MAX_ATTEMPTS}
        AND next_attempt_at <= now()
        AND (locked_until IS NULL OR locked_until < now())
        ${onlyOrder}
      ORDER BY next_attempt_at
      LIMIT ${options.limit ?? 20}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, event, channel::text AS channel, order_id, payload_json, attempts`;
}

export async function settleOutboxRow(row: OutboxRow, result: DeliveryResult): Promise<void> {
  if ("skipped" in result) {
    await prisma.$executeRaw`
      UPDATE notification_outbox SET status = 'SKIPPED', last_error = ${result.skipped.slice(0, 500)}, locked_until = NULL WHERE id = ${row.id}`;
    return;
  }
  if (result.ok) {
    await prisma.$executeRaw`
      UPDATE notification_outbox SET status = 'SENT', sent_at = now(), provider_id = ${result.providerId ?? null}, locked_until = NULL
      WHERE id = ${row.id}`;
    return;
  }
  const final = !result.retryable || row.attempts >= MAX_ATTEMPTS;
  const backoffSeconds = Math.min(3600, 30 * 2 ** (row.attempts - 1)); // 30 s, 1 min, 2 min… plafonné à 1 h
  await prisma.$executeRaw`
    UPDATE notification_outbox
    SET status = ${final ? "FAILED" : "PENDING"}::"OutboxStatus", last_error = ${result.reason.slice(0, 500)},
        next_attempt_at = now() + make_interval(secs => ${backoffSeconds}), locked_until = NULL
    WHERE id = ${row.id}`;
  if (final) logger.error("[outbox] Notification abandoned", { id: row.id, event: row.event, channel: row.channel, orderId: row.order_id, reason: result.reason });
}

/** Envoi immédiat (avec orderId) ou relais (sans). `deliver` choisit le transport d'après row.channel et relit les préférences. */
export async function drainOutbox(options: {
  orderId?: string;
  deadline: number; // Date.now() + budget
  deliver: (row: OutboxRow) => Promise<DeliveryResult>;
}): Promise<{ sent: number; retried: number; failed: number; skipped: number }> {
  const stats = { sent: 0, retried: 0, failed: 0, skipped: 0 };
  while (Date.now() < options.deadline) {
    const rows = await claimOutboxBatch({ orderId: options.orderId });
    if (rows.length === 0) break;
    for (const row of rows) {
      if (Date.now() >= options.deadline) return stats; // les lignes restantes redeviennent réclamables à la fin du bail
      let result: DeliveryResult;
      try {
        result = await options.deliver(row);
      } catch (error) {
        result = { ok: false, retryable: true, reason: error instanceof Error ? error.message : "unknown error" };
      }
      await settleOutboxRow(row, result);
      if ("skipped" in result) stats.skipped += 1;
      else if (result.ok) stats.sent += 1;
      else if (result.retryable && row.attempts < MAX_ATTEMPTS) stats.retried += 1;
      else stats.failed += 1;
    }
  }
  return stats;
}

/** Fin de passage du relais : clôt les lignes réclamées MAX_ATTEMPTS fois sans jamais avoir été réglées. */
export async function failExhaustedOutboxRows(): Promise<number> {
  return prisma.$executeRaw`
    UPDATE notification_outbox
    SET status = 'FAILED', last_error = COALESCE(last_error, 'lease expired without settlement'), locked_until = NULL
    WHERE status IN ('PENDING', 'SENDING') AND attempts >= ${MAX_ATTEMPTS}
      AND (locked_until IS NULL OR locked_until < now())`;
}
```

Usage dans une commande (compilé avec le module ci-dessus [L1] ; non exécuté, il lui faut une commande réelle) :

```ts
// ex. src/lib/services/orders/commands/progress.ts — remplace `await sendNotification("ORDER_READY", …)`
import { transitionOrder } from "@/lib/services/orders/transition";
import { drainOutbox, enqueueNotification, type DeliveryResult, type OutboxRow } from "@/lib/services/notification-outbox";

declare function deliverOutboxRow(row: OutboxRow): Promise<DeliveryResult>; // transport selon row.channel, à écrire

export async function markReadyWithOutbox(input: { orderId: string; shopId: string; actorId: string; now: Date }) {
  const outcome = await transitionOrder({
    orderId: input.orderId,
    scope: { shopId: input.shopId },
    from: ["ACCEPTED", "PREPARING"],
    to: "READY",
    data: { actualReady: input.now },
    event: { type: "READY", actorId: input.actorId },
    effects: async (tx, order) => {
      for (const channel of ["EMAIL", "PUSH"] as const) {
        await enqueueNotification(tx, {
          dedupKey: `ORDER_READY:${order.id}:${channel}`,
          event: "ORDER_READY",
          channel,
          orderId: order.id,
          payload: { userId: order.userId, orderId: order.id }, // des identifiants, pas le HTML
        });
      }
    },
  });
  // Après le COMMIT : tentative immédiate, bornée ; ce qui échoue ou reste est repris par le relais.
  if (outcome.ok) await drainOutbox({ orderId: input.orderId, deadline: Date.now() + 5_000, deliver: deliverOutboxRow });
  return outcome;
}
```

Vérifié le 14/11/2026 [L2] (PostgreSQL 15.19 jetable, table créée par le DDL de Prisma, fonctions
appelées par `@prisma/client` 6.19.2) : six insertions dont un doublon de clé = cinq lignes ;
`drainOutbox({ orderId })` ne prend que les lignes de la commande ; succès → `SENT`, échec
passager → `PENDING` à +30 s, exception du transport → rejeu, échec définitif → `FAILED` + `logger.error`,
`{ skipped }` → `SKIPPED` ; rien n'est repris avant l'échéance ; huit échecs → `FAILED` ; une ligne restée
`SENDING` avec huit réclamations n'est plus réclamée et `failExhaustedOutboxRows` la clôt ; deux
réclamations concurrentes (l'une tenant sa transaction 3 s) obtiennent 6 + 4 lignes disjointes sur 10,
sans attendre ; 12 clients Prisma vidant 300 lignes par lots de 7, cinq fois de suite : 300 lignes
réclamées, aucune deux fois. Le `FOR UPDATE` est **dans** la sous-requête : c'est lui qui re-vérifie la
condition sur la ligne verrouillée (à ne pas confondre avec l'`updateMany` + `limit` déconseillé par
`order-lifecycle-realtime`, qui n'a pas ce verrou). **Non reproduit : PgBouncer** (l'instruction est unique et sans état de session ; à
confirmer sur la base réelle). `gen_random_uuid()` fait partie des fonctions du cœur de PostgreSQL
[PG-UUID] et a tourné ici sur 15.19 ; la version de la base Railway n'a pas été relevée (`SELECT
version()` avant la migration ; à défaut, générer l'identifiant côté application).
Les identifiants insérés en SQL brut sont des UUID, ceux du client Prisma des cuid : sans conséquence
(colonne `text`), à savoir.

Règles du relais (`deliver`) :

- Classer chaque échec : **définitif** (adresse refusée, `400`/`422` du fournisseur, abonnement push
  `404`/`410`) → `retryable: false` et, pour le push, suppression de l'abonnement ; **passager** (`429`,
  `5xx`, délai réseau, `concurrent_idempotent_requests`) → `retryable: true`.
- Un message lié à un moment expire : passé un âge maximal (ex. 2 h pour « prête »), `{ skipped }`.
- Relire les préférences (`notifEmail`, `notifPush`…) **au moment de l'envoi** : une désinscription
  entre-temps l'emporte (`{ skipped }`).
- Clé d'idempotence fournisseur = l'`id` de la ligne outbox (stable entre tentatives). Huit tentatives
  tiennent en un peu plus d'une heure : sous les 24 h de rétention de la clé Resend [RS4].
- Le cron relais appelle `drainOutbox({ deadline, deliver })` puis `failExhaustedOutboxRows()`, et
  journalise les compteurs (`logger.info`).

## 5. Ordre de migration conseillé

1. Corriger les mensonges (N2, N3, N4) : chaque transport renvoie un résultat typé, `channels` ne
   contient que les canaux réellement servis, un transport non configuré en production est une erreur
   journalisée. Petit, sans migration, rend la suite mesurable.
2. Push : `TTL`, `urgency`, `topic`, suppression d'abonnement sur `404`/`410` seulement (N5, N6).
3. Table outbox + relais, d'abord pour `ORDER_PENDING` (boucher) et `ORDER_READY` (client), puis tous les
   événements de commande. Le marketing ne passe pas par l'outbox (pas de rejeu, J5 assumé).
4. Découper `notifications.ts` (688 lignes) : gabarits e-mail, charges push, résolution des préférences,
   envoi par canal, chacun sous 300 lignes, et tests unitaires des fonctions pures (`notification-policy`
   en est le modèle).

## 6. Sans l'outbox (état actuel, tant que B2 n'est pas arbitré)

- Garder `await sendNotification(...)` **après** le `COMMIT`, jamais dans la transaction (`prisma-expert`,
  règle 8), et lire son résultat : `{ sent: false }` sur un événement de commande → `logger.error` avec
  `orderId` et l'événement. Ne s'y fier qu'une fois l'étape 1 du § 5 faite (aujourd'hui `sent` ment).
- Filet sans migration pour les deux événements critiques : patron `claimOnce` de
  `order-lifecycle-realtime` (`references/transitions-temporelles.md` § 5 ; `machine-a-etats.md` § 6 pour
  l'ordre « await, filet, file » ; son point A3 pose le même choix « sans migration ou table d'effets »).
- Un échec de notification n'annule jamais une transition validée.
