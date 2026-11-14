# État du code — cycle de vie des commandes (commit `161f920`, 13/11/2026)

> **Photographie antérieure au chantier 0** (prix et intégrité des commandes, livré avec ce skill).
> Corrigés par ce chantier, d'après `CLAUDE.md` § « Commandes » et le code de `src/lib/services/orders/` :
> écriture du statut (E1 : `transition.ts`, `updateMany` conditionnel + `OrderEvent` dans la même
> transaction, donc aussi E14), expiration par commande conditionnelle (E2), création idempotente
> (E5), stock limité et libération de remise dans la transaction de transition (E6), tableau cuisine
> complet sans troncature silencieuse (E9, `kitchen.ts`), routes en double supprimées (table du § 1).
> Les autres constats restent à revérifier dans le code avant de s'y fier.

Relevé fait en lisant le code, relu ligne à ligne par un vérificateur indépendant le même jour. Les fichiers cités sont identiques à `32c581f` (seul `vercel.json` a reçu un bloc `git`). Les numéros de ligne datent de ce commit : relire le fichier avant de s'y fier. Quand une ligne dit « attendu », c'est une déduction à confirmer (logs Vercel). Quand elle dit « reproduit » ou « mesuré », le comportement a été exécuté sur une base PostgreSQL jetable : références `[L…]` dans [sources.md](sources.md).

## 1. Qui écrit `Order.status`

Dix-huit fichiers écrivent le statut (les routes en double comptent chacune). Un seul passe par `canTransition`, un seul écrit `OrderEvent`, aucun ne fait d'écriture conditionnelle.

| Fichier | Transition écrite | `canTransition` | Garde dans le `WHERE` | `OrderEvent` | Appelé par l'UI |
|---|---|---|---|---|---|
| `src/lib/services/orders/create.ts` | création en `PENDING` ou `ACCEPTED` (`autoAccept`) | — | — | non | oui (`/panier`) |
| `src/app/api/orders/reorder/route.ts` | création (copie de la logique, sans `dailyNumber`, sans idempotence) | — | — | non | oui |
| `src/app/api/boucher/orders/[orderId]/action/route.ts` (690 lignes) | accept, deny, preparing, ready, picked-up, cancel, item_unavailable | oui (sauf `item_unavailable`, pickup) | non | oui (hors transaction, sauf accept) | oui (mode cuisine) |
| `src/app/api/boucher/orders/pickup/route.ts` | `READY → PICKED_UP` (QR) | non | non | non | oui (scanner) |
| `src/app/api/orders/[id]/cancel/route.ts` | `→ CANCELLED` (client) | `isCancellable` | non | non | oui (`/commande/[id]`) |
| `src/app/api/orders/[id]/choose-alternatives/route.ts` | `PARTIALLY_DENIED → PENDING` ou `DENIED` | non | non | non | oui |
| `src/app/api/orders/[id]/rate/route.ts` | `PICKED_UP → COMPLETED` | non | non | non | oui |
| `src/app/api/orders/[id]/{accept,deny,preparing,ready,picked-up}/route.ts` | doublons de la route unifiée, sans stock ni audit | non | non | non | aucun appelant trouvé |
| `src/app/api/orders/[id]/{respond,modify,stock-issue}/route.ts` | `PARTIALLY_DENIED → PENDING/CANCELLED`, `→ PARTIALLY_DENIED/DENIED` | non | non | non | aucun appelant trouvé |
| `src/app/api/cron/auto-cancel/route.ts` | `PENDING → AUTO_CANCELLED` | non | non (voir E2) | non | cron quotidien |
| `src/app/api/payments/webhook/route.ts` | `PENDING → ACCEPTED` (paiement reçu, l. 194), `→ CANCELLED` (paiement échoué, l. 288 ; remboursement total, l. 391) | non | non | non | Stripe (non actif), voir E23 |
| `src/lib/services/cron.service.ts` | `PENDING → CANCELLED` après 60 min | non | non | non | exporté, jamais appelé |

`src/lib/api/client.ts:63-68` appelle `PATCH /api/orders/[id]/status`, `/weight` et `/stock-action`. `/weight` et `/stock-action` n'existent pas ; `/status` n'existe qu'en `GET` (lecture légère du suivi client, sans effet de bord, utilisée par `suivi/[id]/SuiviClient.tsx`).

## 2. Écarts, par gravité

### Bloquants (perte ou corruption de commande possible)

**E1 — Lecture puis écriture sans garde (toutes les transitions).** Schéma partout : `findUnique` → test du statut en mémoire → `update({ where: { id } })`. Deux requêtes concurrentes passent toutes les deux le test ; la dernière écriture gagne. Cas concrets : boucher qui accepte pendant que le client annule (`action/route.ts:114-153` contre `cancel/route.ts:43-53`) ; double appui sur « Accepter » depuis deux tablettes (double décrément de stock anti-gaspi) ; acceptation pendant le passage du cron. Mesuré par `testing-strategy` (défaut D3) : accepter et refuser en même temps, 29 fois sur 30 les deux réponses sont 200 et deux `OrderEvent` sont écrits. Correction : patron A de [machine-a-etats.md](machine-a-etats.md).

**E2 — Le cron d'expiration peut annuler une commande acceptée.** `cron/auto-cancel/route.ts:17-30` lit les identifiants expirés puis fait `updateMany({ where: { id: { in } } })` sans `status: "PENDING"`. Une acceptation entre les deux requêtes est écrasée par `AUTO_CANCELLED` (reproduit 25 fois sur 25 [L5]). Aucun `OrderEvent`, aucune notification au client. Correction : patron B de [transitions-temporelles.md](transitions-temporelles.md).

**E3 — Les échéances ne sont pas tenues.** Aucun cron de `vercel.json` ne tourne plus d'une fois par jour : `auto-cancel` à 01:00 UTC, `ready-reminder` à 07:00 UTC. Or `expiresAt = now + acceptTimeoutMin` (10 min par défaut, `create.ts:315`) et le rappel vise les commandes prêtes depuis 30 min à 2 h (`cron/ready-reminder/route.ts:13-19`). Conséquence : une commande sans réponse reste `PENDING` jusqu'à la nuit suivante ; le rappel « prête » ne part que pour les commandes prêtes entre 05:00 et 06:30 UTC. La décision de passer à la minute change le comportement du produit : voir « Points à arbitrer » du SKILL.md.

**E4 — Notification « nouvelle commande » non fiable.** (a) `create.ts:413-450` lance notification, e-mail et auto-busy sans `await` ni `waitUntil` : une fois toutes les requêtes terminées l'instance est mise en pause [V2] et seule `waitUntil` prolonge la vie du traitement [V9] : la promesse peut ne jamais finir. (b) `notifications.ts:557-566` retrouve le boucher par `clerkId: shop.ownerId` uniquement ; si `ownerId` contient l'identifiant Prisma (cas prévu par CLAUDE.md, clause `OR`), aucun destinataire n'est trouvé et rien ne part. (c) `sendNotification` attrape toutes les erreurs et renvoie `{ sent: false }` : l'appelant ne sait pas qu'il a échoué. (d) À l'inverse `sent: true` ne prouve pas l'envoi : sans clés VAPID, `push.ts:49-52` journalise et renvoie `true`, et le canal `push` est compté comme servi.

**E5 — Idempotence de création inopérante.** Le serveur lit `idempotencyKey` (`create.ts:45-56`) mais aucun écran ne l'envoie (`OrderCountdown.tsx:60-68`). Si elle était envoyée : (a) la lecture n'est pas bornée à l'utilisateur, la commande d'un autre peut être renvoyée à qui présente sa clé (corrigé par le chantier « intégrité des commandes » : la commande n'est rendue qu'à son client, sinon `CONFLICT`) ; (b) deux requêtes simultanées passent la lecture, la seconde lève `P2002` sur `idempotency_key`, que `create.ts:386-397` prend pour une collision de `orderNumber` (journal « orderNumber collision »), retente deux fois puis relance l'erreur : `handleApiError` répond **409** « Cette ressource existe déjà » au lieu de renvoyer la commande créée (mesuré par `testing-strategy`, défaut D4 : réponses `[201, 409]`, une ligne en base). Correction : patron C.

**E6 — Stock restauré ou décrémenté sans savoir s'il l'a été.** Le décrément du stock limité (anti-gaspi, vente flash) n'a lieu qu'à l'acceptation par la route unifiée (`action/route.ts:156-197`). Or : (a) `deny` (`246-256`) et `cancel` (`587-597`) ré-incrémentent dès que la transition est permise, y compris depuis `PENDING` où rien n'a été décrémenté ; (b) une boutique en `autoAccept` crée la commande en `ACCEPTED` sans décrément (`create.ts:316`), puis l'annulation restaure : le stock gonfle ; (c) `item_unavailable` depuis `ACCEPTED` (`349-431`) ne restaure rien, puis `choose-alternatives` renvoie la commande en `PENDING` et la seconde acceptation décrémente une deuxième fois ; (d) l'annulation client (`cancel/route.ts`) ne restaure rien, ne rend ni coupon ni récompense fidélité, ne prévient pas le boucher. Le statut seul ne permet donc pas aujourd'hui de savoir si le stock est réservé. Règle cible : [machine-a-etats.md](machine-a-etats.md) § 4.

### Majeurs (incohérence visible, coût, dette)

**E7 — La table ne décrit pas le code.** `order-state-machine.ts:6-17` ignore deux transitions réellement faites : `PARTIALLY_DENIED → PENDING` (`choose-alternatives/route.ts:116`, `respond/route.ts:68-76`, `modify/route.ts:84-91`) et `ACCEPTED → PARTIALLY_DENIED` (`action/route.ts:350-416`). Le retour en `PENDING` ne recalcule pas `expiresAt` : la commande garde l'échéance d'origine, souvent déjà dépassée, ou `null` si elle avait été acceptée (elle n'expire alors plus).

**E8 — « Terminal » défini à sept endroits, avec trois contenus différents.** `isTerminal()` (dérivé de la table : `COMPLETED`, `DENIED`, `CANCELLED`, `AUTO_CANCELLED`) et six listes écrites à la main : la même dans `action/route.ts:614` et `useOrderTracker.ts:113` ; avec `PICKED_UP` en plus dans `orders/[id]/stream/route.ts:93`, `commande/[id]/page.tsx:104`, `suivi/[id]/SuiviClient.tsx:72` ; avec `PICKED_UP` et `PARTIALLY_DENIED` dans `use-order-polling.ts:76`. Une commande `PARTIALLY_DENIED` (qui attend la réponse du client) est rangée dans l'historique de la cuisine.

**E9 — Sonde cuisine lourde et à effet de bord.** `use-order-polling.ts:164` appelle `GET /api/orders` toutes les 5 s : `getOrCreateUser` + auth boucher + `findMany` de 50 commandes avec articles, produit, boutique, client, ajustement (`list.ts:102-107`), sérialisation complète, plus middleware Clerk. Ce même `GET` approuve les ajustements de prix expirés (`list.ts:109-137`). `take: 50` par date de création : une commande programmée ancienne peut sortir de la fenêtre et disparaître de la cuisine.

**E10 — Flux SSE = sondage serveur.** `boucher/orders/stream/route.ts` tient une réponse ouverte et interroge la base toutes les 5 s (`:38-122`) par connexion. Le bloc `functions` de `vercel.json` plafonne les fonctions API à 30 s : coupure attendue toutes les 30 s, puis reconnexion automatique d'`EventSource`. À chaque connexion `lastPendingIds` part de `[]` (`:26`) : toutes les commandes `PENDING` sont ré-annoncées en `NEW_ORDER`, donc son, vibration et toast répétés sur `/boucher/dashboard` (`useOrderStream.ts:59-65`, `dashboard/page.tsx:237-241`). L'événement `SHOP_AUTO_PAUSED` attendu par le hook n'est jamais émis par la route. `orders/[id]/stream/route.ts` (suivi client) n'a aucun consommateur.

**E11 — `redis.publish` sans abonné.** `shop-status.ts:100,127,166,185,219` publie sur `shop:{id}:events` ; aucun `subscribe` dans `src/`. Chaque appel est une commande Upstash facturée pour rien.

**E12 — Échéances d'ajustement de prix évaluées à la lecture, sans garde.** `price-adjustment.ts:57-104` : lecture de l'ajustement, test, puis `update` ; appelé par `GET /api/orders` (`list.ts:128`) et `GET /api/orders/[id]` (`route.ts:79`). Deux lectures simultanées (cuisine et client sondent en même temps) appliquent deux fois et notifient deux fois. Si personne ne lit, rien ne se passe.

**E13 — Alerte « à préparer » déclenchée par la tablette.** La bascule à 30 min du retrait est calculée dans le navigateur (`use-order-polling.ts:194-203`) qui appelle `POST /api/orders/[id]/scheduled-notify` (`commandes/page.tsx:237`). Tablette éteinte ou onglet en veille : le client n'est pas prévenu et la cuisine n'a pas d'alerte. L'anti-doublon lit puis réécrit le tableau JSON `notifSent` (`scheduled-notify/route.ts:61-101`, `notifications.ts:683-696`) : deux onglets envoient deux fois et une écriture peut effacer l'autre (reproduit [L6]).

**E14 — Journal d'audit partiel.** `OrderEvent` n'est écrit que par la route unifiée ; hors acceptation, il est écrit après la mise à jour, hors transaction, et son échec est avalé (`action/route.ts:56-68`). Aucune trace pour l'annulation client, l'expiration, le retrait par QR, le webhook Stripe.

**E23 — Le webhook Stripe écrit trois transitions hors machine** (`payments/webhook/route.ts`, Stripe non actif). Paiement reçu : `PENDING → ACCEPTED` sans QR, sans `estimatedReady`, sans décrément de stock, `expiresAt` conservé (l. 185-196) ; paiement échoué : `→ CANCELLED` depuis tout statut non annulé et non payé (l. 286-292) ; remboursement total : `→ CANCELLED` depuis n'importe quel statut, `PICKED_UP` et `COMPLETED` compris (l. 384-392). Aucune n'est conditionnelle ni journalisée. Règle cible : `stripe-payment` (qui classe la première en erreur) et point A11.

### Mineurs

- **E15 — Compteur du jour en UTC.** `numbering.service.ts:13` : `setHours(0,0,0,0)` dans le fuseau du serveur. Le numéro de ticket repart à 01:00 ou 02:00 heure de Paris, contre la règle « Horaires & fuseau » de CLAUDE.md.
- **E16 — `orderNumber` par `findFirst` + 3 essais** (`create.ts:329-398`), dupliqué sans essai dans `reorder/route.ts:86-96`.
- **E17 — Contrôles de capacité « compter puis insérer »** (`create.ts:114-157`) : deux commandes simultanées passent toutes les deux sous `maxOrdersPerSlot`.
- **E18 — `handleApiError` reconnaît les erreurs Prisma par leur texte** (`api/errors.ts:157-165`). Le client installé (6.19.2) ne produit plus « Record to update not found » : un `P2025` porte « An operation failed because it depends on one or more records that were required but not found. No record was found for an update. » (mesuré [L10]) et finit en 500. « Unique constraint » correspond encore au texte de `P2002`.
- **E19 — `isCancellable` mesure 5 min depuis `createdAt`**, pas depuis l'acceptation (`order-state-machine.ts:60-67`) ; le commentaire du test dit l'inverse.
- **E20 — `checkAutoPause` lit puis écrit `missedOrdersCount`** (`shop-status.ts:190-231`), une fois par boutique et non par commande expirée, via `prisma.shop.update` qui modifie `Shop.updatedAt` (donc le `lastmod` du sitemap). Le dépôt a déjà la parade pour un recalcul technique : passer `updatedAt` explicitement (`src/lib/services/performance.ts:264-284`, paramètre `keepUpdatedAt`).
- **E21 — `COMPLETED` n'est atteint que si le client note** (`rate/route.ts:54-61`). `generateDailyStats` ne compte que `COMPLETED` (`cron.service.ts:41-44`).
- **E22 — Push.** Un seul abonnement par utilisateur (`User.pushSubscription`, JSON). Envoi sans `TTL` ni `urgency` (`push.ts:55-58`, défaut de la bibliothèque : 4 semaines). `sendPushNotification` renvoie `false` pour **toute** erreur (`push.ts:60-69`) et `notifications.ts:665-674` efface alors l'abonnement : une erreur passagère du service de push désabonne le boucher sans le dire. Permission demandée au montage de la page et non sur un geste (`use-kitchen-notifications.ts:28-32`).
- **E24 — Code mort du domaine.** `useOrderTracker.ts` (seul hook encore en `setInterval` nu) et `order-number.service.ts` (format `CB-…`, « compter puis +1 ») n'ont aucun appelant ; avec `cron.service.ts` et les routes en double, ils faussent toute recherche « qui écrit le statut ». Voir A6.

## 3. Ce qui est déjà bien fait (à conserver)

- `use-order-polling.ts` : boucle auto-replanifiée, une seule requête à la fois, ralentie onglet caché, recul sur erreur, réveil sur `visibilitychange` / `focus` / `online`, abandon d'une requête bloquée. Testée (`src/hooks/__tests__/use-order-polling.test.ts`). C'est le modèle pour toute sonde.
- Acceptation : statut + stock + `OrderEvent` dans une seule transaction interactive avec retour arrière sur stock insuffisant (`action/route.ts:143-211`).
- Création : consommation du coupon et création de la commande dans la même transaction (`create.ts:343-384`).
- Réponses « déjà fait » sur rejeu (`_idempotent: true`) dans la route unifiée.
- `StripeEvent` (clé = identifiant d'événement) pour dédoublonner les webhooks.
- `DailyCounter` : l'`upsert` est émis en `INSERT … ON CONFLICT DO UPDATE` (24 appels concurrents, 24 numéros distincts [L8]). Seul le calcul du jour est faux (E15).
- Index présents : `[shopId, status]`, `[shopId, updatedAt]`, `[status, expiresAt]`, `[shopId, pickupSlotStart]`, `PriceAdjustment [status, autoApproveAt]` et `[status, escalateAt]`. Les patrons proposés n'en demandent pas d'autre.
- Tests purs de la table (`src/lib/__tests__/order-state-machine.test.ts`), tests simulés de la route unifiée (`tests/api/boucher/orders/action.test.ts`). Une simulation de Prisma ne reproduit pas une course : voir `testing-strategy`.
