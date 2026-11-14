---
name: order-lifecycle-realtime
description: Cycle de vie des commandes Klik&Go côté serveur et arrivée en cuisine — machine à états appliquée en base (transition conditionnelle, idempotence, transactions, journal OrderEvent), échéances tenues par le serveur (expiration, commandes programmées, relances) et temps réel économe sur Vercel (sonde de version, SSE, WebSocket, canal géré, Web Push) avec coûts chiffrés. À charger avant de toucher à un changement de statut de commande, à un cron lié aux commandes, au polling du mode cuisine ou à un flux temps réel.
when_to_use: Order.status, canTransition, order-state-machine, accepter / refuser / annuler une commande, double clic, course, race condition, idempotencyKey, $transaction, OrderEvent, audit, expiresAt, AUTO_CANCELLED, auto-cancel, cron de commande, commande programmée, pickupSlotStart, scheduled-notify, use-order-polling, useOrderStream, SSE, EventSource, WebSocket, Pusher, temps réel, nouvelle commande en cuisine, push boucher, DailyCounter, numéro de ticket.
---

# Cycle de vie des commandes et temps réel — Klik&Go

Ce skill dit **comment une commande change d'état sans se corrompre, comment le temps agit sans écran, et comment la cuisine est prévenue sans faire exploser la facture**. Les règles métier du parcours (qui peut commander quoi, quand) sont dans `click-and-collect`.

État du code décrit : commit `161f920` (13/11/2026), revérifié à `32c581f` : aucun fichier cité n'a changé depuis, sauf `vercel.json` (bloc `git` ajouté, `functions` et `crons` identiques). Relire un fichier avant de se fier à un numéro de ligne ; `src/lib/services/orders/create.ts` est aussi modifié par le chantier « prix des commandes » (recalcul serveur des prix et remises) : coordonner tout changement de ce fichier avec lui. Ce chantier (chantier 0, livré avec ce skill) corrige E1, E2, E5, E6, E9 et E14 : les mentions « Non tenu » ci-dessous décrivent l'état d'avant, voir l'encadré de [references/etat-du-code.md](references/etat-du-code.md). Versions : Next.js 14.2.35, Prisma 6.19.2, `web-push` 3.6.7, `@upstash/redis` 1.36.2. **Non installés** : `@vercel/functions`, `@upstash/qstash`, `xstate`, tout SDK de canal temps réel.

Niveau de preuve : les extraits de code compilent (`tsc --noEmit`) et les patrons A, B, C et `claimOnce` ont été **exécutés sur une base PostgreSQL 15 jetable** avec le client Prisma du dépôt (courses comprises) : voir « Vérifications locales » dans [references/sources.md](references/sources.md). Ils ne sont pas encore dans `tests/integration/` : les y porter fait partie du chantier.

## Skills voisins (ne pas dupliquer)

| Sujet | Skill |
|---|---|
| Règles métier du parcours, ajustement de prix, annulation, créneaux, stock | `click-and-collect` |
| Files de tâches, e-mails, modèles de notification, crons hors commandes | `background-jobs-notifications` |
| Coût Vercel, middleware, régions, ISR | `vercel-cost-performance` |
| Schéma, index, migrations, requêtes | `prisma-expert` |
| Forme des routes, erreurs, Zod | `api-route-conventions` |
| Isolation par boutique, propriété d'une commande | `security-multitenant` |
| Session, test mode, `getAuthenticatedBoucher` | `clerk-auth` |
| Webhooks et paiement | `stripe-payment` |
| Tests d'intégration sur base réelle, Playwright | `testing-strategy` |
| Alertes, Sentry, suivi des jobs | `reliability-observability` |

Au 13/11/2026, `background-jobs-notifications`, `reliability-observability` et `conformite-france` ne sont pas encore écrits : s'ils manquent, appliquer les règles d'ici et de CLAUDE.md.

## Carte du code (lire AVANT de coder)

| Rôle | Fichier |
|---|---|
| Table des transitions, libellés, `isCancellable` | `src/lib/order-state-machine.ts` (+ `src/lib/__tests__/order-state-machine.test.ts`) |
| Création (idempotence, prix, numérotation) | `src/lib/services/orders/create.ts`, `src/lib/services/numbering.service.ts` |
| Actions du boucher (route unifiée, 690 lignes) | `src/app/api/boucher/orders/[orderId]/action/route.ts` |
| Actions du client | `src/app/api/orders/[id]/{cancel,choose-alternatives,rate}/route.ts` |
| Ajustement de prix et ses échéances | `src/lib/services/orders/adjust-price.ts`, `src/lib/price-adjustment.ts` |
| Expiration, rappels | `src/app/api/cron/{auto-cancel,ready-reminder}/route.ts`, `vercel.json`, `src/lib/cron-auth.ts` |
| Sonde cuisine | `src/hooks/use-order-polling.ts` → `GET /api/orders` → `src/lib/services/orders/list.ts` |
| Suivi client (lecture légère, sans effet de bord) | `GET /api/orders/[id]/status`, appelé par `suivi/[id]/SuiviClient.tsx` |
| Flux SSE | `src/app/api/boucher/orders/stream/route.ts`, `src/hooks/useOrderStream.ts` (dashboard) |
| Notifications et push | `src/lib/notifications.ts`, `src/lib/push.ts`, `public/sw.js` |
| Statuts écrits par Stripe | `src/app/api/payments/webhook/route.ts` (détail : `stripe-payment`) |
| Modèles | `prisma/schema.prisma` : `Order`, `OrderItem`, `OrderEvent`, `PriceAdjustment`, `DailyCounter` |

Relevé complet des écarts (E1 à E24, avec preuves) : [references/etat-du-code.md](references/etat-du-code.md).

Ordre de chantier conseillé : (1) fonction de transition, puis migration de la route unifiée, de l'annulation client et du retrait par QR (E1, E6, E14) ; (2) création idempotente, avec `click-and-collect` pour l'envoi de la clé (E5) ; (3) notification « nouvelle commande » fiable (E4) ; (4) job d'échéances et garde d'expiration, **ensemble et après l'arbitrage A1** (E2, E3, E12, E13) ; (5) sonde de version et retrait du flux SSE (E9, E10, E11) ; (6) nettoyage (E7, E8, A6).

## Les 10 règles

Chaque règle est suivie de sa raison et de son statut au commit `161f920`.

1. **Une seule fonction écrit `Order.status`.** Elle vérifie la table, écrit sous condition (`WHERE id, périmètre, statut de départ`) et journalise, dans une transaction. *Sans condition dans l'écriture, deux requêtes passent le même test et la dernière gagne* (mesuré : 29 fois sur 30, voir `testing-strategy`, défaut D3). Non tenu : 18 fichiers écrivent le statut, aucun sous condition (E1, E2).
2. **La table décrit tout ce que fait le code.** Transitions, ensembles « terminal » et « actif » viennent de `order-state-machine.ts`, jamais d'une liste recopiée. *Une transition hors table échappe aux tests et aux écrans.* Non tenu (E7, E8, E23).
3. **Rejouer = 200 ; action impossible ou course perdue = 409.** La même action rejouée renvoie l'état courant (`_idempotent`) ; une action que l'état ne permet pas, ou plus, renvoie `CONFLICT` avec le statut courant (même règle dans `api-route-conventions`). *Le réseau rejoue, les doigts aussi.* Partiel : rejeu géré dans la route unifiée ; refus d'état en 400 `VALIDATION_ERROR` ; course non détectée.
4. **Ce qui doit être vrai ensemble est écrit ensemble.** Statut, stock, coupon, récompense, `OrderEvent` : une transaction, uniquement via `tx`, sans appel réseau, bien sous 5 s. *`connection_limit=1` : un `prisma.` dans le callback attend la connexion que la transaction tient, puis tout est annulé à 5 s (mesuré, `P2028`).* Partiel : vrai pour l'acceptation et la création seulement (E6, E14).
5. **Les effets externes partent après validation et ne se perdent pas en silence.** Notification essentielle attendue et vérifiée, ou rattrapée par un job ; un échec d'envoi n'annule jamais une transition. *Deux écritures dans deux systèmes ne sont pas atomiques* [AWS1][U2]. Non tenu (E4).
6. **Une tentative de commande = une clé, arbitrée par la contrainte unique.** Lecture bornée à l'utilisateur, `P2002` sur la clé = rejeu. *Stripe : la clé identifie l'opération, pas l'utilisateur* [S1]. Non tenu (E5).
7. **Le temps est un acteur serveur.** La colonne d'échéance fait foi ; la décision la vérifie ; un job idempotent matérialise et rattrape. Jamais un écran ouvert, jamais un `GET`. *Un cron Vercel peut manquer ou doubler un passage* [V4]. Non tenu (E3, E12, E13).
8. **Ce que la cuisine doit voir modifie la ligne `Order`.** `@updatedAt` est posé par Prisma, pas par la base [PR2] : `updateMany` le pose, le SQL brut et les tables filles ne le touchent pas (vérifié). *C'est le signal de changement de la sonde.* À tenir dès que la sonde de version existe.
9. **Le signal n'est pas la vérité.** Sonde, push ou canal disent « ça a changé » ; l'état se relit par un seul chemin, et un rechargement périodique rattrape un signal perdu [U1]. Partiel : la sonde relit tout à chaque fois (E9), le flux SSE ré-annonce à chaque reconnexion (E10).
10. **Une lecture ne modifie rien et le périmètre est dans le `WHERE` de l'écriture.** `shopId` (boucher) ou `userId` (client, identifiant **Prisma**, pas le `clerkId` de `getServerUserId()`) dans la condition, pas seulement dans un contrôle préalable, et jamais `undefined` (Prisma ignore alors le filtre). Jour et heure via `src/lib/paris-time.ts`. Partiel (E9, E15).

## Patron central : la transition conditionnelle

```ts
// cœur de src/lib/services/orders/transition.ts (à créer) — version complète dans references/machine-a-etats.md
return prisma.$transaction(async (tx) => {
  const { count } = await tx.order.updateMany({
    where: { AND: [{ id: orderId, shopId, status: { in: from } }, guard ?? {}] }, // from = le statut que l'appelant vient de lire
    data: { ...data, status: to },
  });
  if (count === 0) {
    const current = await tx.order.findFirst({ where: { id: orderId, shopId }, select: { status: true } });
    return current
      ? { ok: false as const, reason: "CONFLICT" as const, current: current.status } // 200 si current === to, sinon 409
      : { ok: false as const, reason: "NOT_FOUND" as const };
  }
  await extra?.(tx); // stock, coupon : décidés sur l'état de départ garanti
  await tx.orderEvent.create({ data: { orderId, shopId, type: eventType, actorId, payloadJson: { from, to } } });
  return { ok: true as const };
});
```

Pourquoi cela suffit : en `READ COMMITTED`, PostgreSQL ré-évalue le `WHERE` d'un `UPDATE` après avoir attendu la transaction concurrente [PG1] ; c'est le contrôle optimiste que documente Prisma (`updateMany` puis `count`) [PR1]. Vérifié ici : 70 courses « accepter / annuler », toujours un seul gagnant et un seul `OrderEvent`. Deux limites à connaître :

- **La garde doit être dans le `WHERE` de l'instruction `UPDATE` elle-même.** Ne jamais passer `limit` à `updateMany` / `updateManyAndReturn` sur une écriture gardée : Prisma émet alors `WHERE id IN (SELECT … LIMIT n)` et la condition n'est plus ré-évaluée après l'attente du verrou (reproduit : commande acceptée écrasée 15 fois sur 15). Même danger pour « lire les identifiants puis écrire par identifiants » (E2).
- Préférer `updateMany` à `update({ where: { id, status } })` : pas d'exception `P2025` à reconnaître, et `handleApiError` ne la reconnaît plus (E18).

## Décisions rapides

| Situation | Décision | Raison |
|---|---|---|
| Nouvelle action boucher ou client | Lire, valider, préparer les effets, puis `transitionOrder({ from: [order.status], … })` ; ajouter l'événement à la table et à son test | Règles 1 et 2 |
| Deux acteurs agissent en même temps | Rien de plus : le perdant reçoit 409, l'écran recharge | La base arbitre |
| Restaurer ou décrémenter du stock | Depuis `PENDING`, ne jamais restaurer. Cible proposée (machine-a-etats § 4, à valider avec `click-and-collect`) : stock réservé **si et seulement si** la commande est `ACCEPTED`, `PREPARING` ou `READY` ; décrémenter à l'entrée dans cet ensemble, restaurer à la sortie (sauf vers `PICKED_UP`), dans la transaction, sur le `from` garanti ; toute entrée en `ACCEPTED` passe par la même fonction (création `autoAccept` comprise) | Le statut seul ne dit pas aujourd'hui si le stock a été décrémenté (E6) |
| Invariant sur plusieurs commandes (capacité d'un créneau) | Compteur mis à jour sous condition, ou verrou ; jamais « compter puis insérer » | E17 |
| Nouvelle échéance | Colonne `…At` + garde à la décision (`guard`) + balayage dans le job minute | Règle 7 |
| Échéance sous la minute | Dériver l'état à la lecture sans écrire ; régler par un `POST` idempotent (fin du compte à rebours) et par le job en filet ; file différée seulement après arbitrage A5 | Précision d'un cron : la minute [V3] |
| Effet « une seule fois » (alerte, rappel) | Réclamer par écriture conditionnelle (`claimOnce`), puis envoyer ; tout autre écrivain de `notifSent` passe à l'ajout atomique | E13 |
| Balayage à borner | Pas de `limit` Prisma : SQL brut avec `FOR UPDATE SKIP LOCKED`, ou condition de statut répétée dans le `WHERE` extérieur | Vérifié, voir ci-dessus |
| Message Stripe ou cron | Dédoublonner par identifiant, puis même transition avec `scope: "system"` et `actorId: "system:…"` | Livraison au moins une fois, sans ordre [S3][V4] |
| Champ visible en cuisine sur une table fille, ou SQL brut | Toucher `Order` (ou écrire `updated_at`) dans la même transaction | Règle 8 |
| « Il nous faut du temps réel » | Sonde de version d'abord ; Web Push pour l'onglet caché ; canal poussé seulement aux seuils | Voir ci-dessous |
| Répondre vite puis finir un envoi | `await` l'essentiel ; `waitUntil` exige `@vercel/functions` (A5) ; `after()` n'existe pas en Next 14.2 | [V9] |

Détails et patrons : [references/machine-a-etats.md](references/machine-a-etats.md), [references/transitions-temporelles.md](references/transitions-temporelles.md).

## Temps réel : le choix par défaut

Voir une commande en 5 s suffit (le boucher a 10 min ; Uber Eats ne relance le restaurant qu'après 90 s [U3]). Ce qui compte : ne jamais la manquer, et ne pas payer une requête lourde par sonde.

| Option | Verdict | Pourquoi |
|---|---|---|
| Sonde complète toutes les 5 s (actuel) | À remplacer | 50 commandes avec jointures par sonde, effet de bord dans le `GET` (E9) |
| **Sonde de version + rechargement si changement** | **Défaut** | 1 requête d'agrégat (index `[shopId, updatedAt]` présent), réponse 204 sans corps, aucune dépendance |
| SSE avec boucle de requêtes serveur (actuel, dashboard) | À retirer | Mémoire facturée en continu, coupé au `maxDuration` de 30 s, ré-annonces (E10) |
| SSE ou WebSocket + pub/sub, canal géré | Aux seuils | Seuils proposés : vers 30 tablettes simultanées, ou sonde dans le haut du classement CPU, ou besoin sous 2 s |
| Web Push | Complément obligatoire | Seul à atteindre un onglet caché ou fermé ; `TTL`, `urgency: "high"`, `topic` [W1] |

Repères de coût (`sfo1`, tarifs relus le 13/11/2026 [V2]) : invocation 0,60 $ le million ; CPU actif 0,177 $/h ; mémoire 0,0147 $/Go-h tant qu'une requête est en cours. Une tablette à 5 s, 12 h par jour, fait 259 200 sondes par mois : le plancher est l'invocation (0,16 $) plus le middleware ; un flux tenu ouvert 12 h par jour coûte environ 10,6 $ par mois et par instance occupée, en mémoire seule. Hypothèses, formule, patron de la sonde et règles du hook : [references/temps-reel-cuisine.md](references/temps-reel-cuisine.md). Mesurer avant de décider : Observability > Functions, CPU par invocation et par route [V11].

## Erreurs déjà commises ici (à ne pas reproduire)

1. Tester le statut en mémoire puis écrire sans condition (toutes les transitions, E1).
2. Cron « lire les identifiants puis `updateMany` par identifiants » : annule une commande acceptée entre-temps (E2, reproduit 25 fois sur 25).
3. Planifier une échéance en minutes avec un cron quotidien (E3) ; déclencher une alerte serveur depuis le navigateur d'une tablette (E13).
4. Lancer une notification sans `await` après la réponse, et avaler son échec (E4).
5. Chercher le propriétaire d'une boutique par `clerkId` seul alors que `ownerId` peut être l'identifiant Prisma (E4).
6. Déduire du statut que le stock a été décrémenté, et le restaurer à tort (E6) ; ré-accepter une commande revenue en `PENDING` et décrémenter deux fois.
7. Écrire une transition que la table ne connaît pas ; recopier la liste des statuts terminaux (E7, E8, E23).
8. Faire d'un `GET` sondé toutes les 5 s l'endroit où l'on valide des ajustements de prix (E9, E12).
9. Appeler « flux temps réel » une boucle de requêtes côté serveur ; publier sur un canal Redis que personne n'écoute (E10, E11).
10. Dédoublonner par lecture puis réécriture d'un tableau JSON (E13) ; calculer « aujourd'hui » en UTC (E15) ; reconnaître une erreur Prisma à son texte (E18) ; effacer l'abonnement push à la première erreur d'envoi (E22).

## Checklist avant de livrer

- [ ] Aucune écriture de `status` hors transition conditionnelle, création ou job d'échéances.
- [ ] Le `WHERE` de l'écriture porte l'état de départ **et** le périmètre (`shopId`, ou `userId` Prisma), jamais `undefined`, jamais de `limit`.
- [ ] Action rejouée : 200. Action impossible ou course perdue : 409 `CONFLICT` avec le statut courant, et l'écran recharge.
- [ ] Stock, coupon, récompense et `OrderEvent` dans la même transaction ; uniquement `tx` ; aucun appel réseau dedans.
- [ ] Notification essentielle attendue et son résultat vérifié, ou rattrapée par le job.
- [ ] Échéance : colonne, garde à la décision, balayage idempotent, test « job en retard » et « job doublé ».
- [ ] Cron : `verifyCronAuth`, `force-dynamic`, `try/catch` + `handleApiError`, `logger`, durée bornée (30 s), aucun import d'auth Clerk (route hors middleware).
- [ ] Table des transitions et son test à jour ; aucune liste de statuts écrite à la main.
- [ ] Tout changement visible en cuisine fait bouger `Order.updatedAt` (testé).
- [ ] Sonde : une requête à la fois, ralentie onglet caché, recul sur erreur, pas de `setInterval` nu, rien pour un anonyme (CLAUDE.md).
- [ ] `GET` sans effet de bord, `force-dynamic` (un `GET` de route peut être mis en cache par Next 14 [N1]), `Cache-Control: private, no-store`.
- [ ] Jour et heure via `paris-time.ts` ; route sous 300 lignes, logique dans `src/lib/services/orders/`.

## Définition de terminé

Un travail du domaine est terminé quand : (1) la table et son test unitaire couvrent la transition ; (2) un test d'intégration **sur base réelle** lance les deux acteurs concurrents et constate un seul gagnant, un seul `OrderEvent`, un stock cohérent (une simulation de Prisma ne reproduit pas une course : voir `testing-strategy`) ; (3) le rejeu de l'action est testé ; (4) pour une échéance : tests retard, doublon, passage manqué ; (5) pour la cuisine : test du hook étendu, et CPU par invocation de la route mesuré avant et après, noté dans la PR ; (6) aucune dépendance ajoutée sans arbitrage ; (7) `references/etat-du-code.md` mis à jour (écart fermé ou nouveau) ; (8) `npm run build`, `npm run lint`, `npx tsc --noEmit`, `npm run test` passent.

## Points à arbitrer (propriétaire)

- **A1 — Rendre l'expiration réelle.** Passer `auto-cancel` à la minute applique enfin le délai de 10 min ; aujourd'hui une commande sans réponse reste acceptable jusqu'à 01:00 UTC. À décider avant : délai d'une commande programmée (retrait demain, expiration en 10 min ?), nouveau délai après un retour en `PENDING`, et l'auto-pause après 3 commandes manquées qui deviendra effective.
- **A2 — CLAUDE.md cite `cron/auto-cancel/route.ts` comme modèle de cron** : il contient la course E2 et n'utilise pas `logger`. Proposition : citer le futur job d'échéances. CLAUDE.md dit aussi « commandes programmées auto-acceptées » (liste des fonctionnalités) et « PAS auto-acceptées » (section dédiée).
- **A3 — Alerte à 30 min du retrait.** CLAUDE.md la décrit déclenchée par le mode cuisine, « sans nouveau champ Prisma ». Recommandation : la déclencher par le job serveur. Sans migration, réclamation atomique dans `notif_sent` ; plus propre, une colonne ou une table d'effets. Choix à faire.
- **A4 — Plusieurs appareils par boucher** pour le push : demande une table d'abonnements (migration).
- **A5 — Dépendances.** `@vercel/functions` (`waitUntil`, WebSocket), QStash ou Vercel Queues (bêta), canal géré : aucune n'est installée, chacune ajoute un fournisseur. Vercel annonce le remplacement des crons de `vercel.json` par Schedules (bêta) [V3][V5] : ne pas migrer avant la sortie de bêta.
- **A6 — Code mort.** Routes `/api/orders/[id]/{accept,deny,preparing,ready,picked-up,respond,modify,stock-issue}` et `/api/orders/[id]/stream` sans appelant trouvé ; `src/lib/api/client.ts` vise un `PATCH …/status` et deux routes qui n'existent pas ; `cron.service.ts`, `order-number.service.ts` et `useOrderTracker.ts` ne sont appelés nulle part. Supprimer, après vérification qu'aucun client externe ne les utilise ?
- **A7 — `COMPLETED` n'est atteint que par la notation** (E21). Clôture automatique après quelques jours, ou `PICKED_UP` état final assumé ?
- **A8 — Région.** Fonctions en `sfo1`, clients et cuisines en France, région de la base non vérifiée : chaque sonde paie ce trajet. À traiter avec `vercel-cost-performance`.
- **A9 — Règle « toute requête métier est bornée par `shopId` » (CLAUDE.md).** Un balayage d'échéances traverse toutes les boutiques par nature (le cron actuel le fait déjà). Proposition : écrire l'exception dans CLAUDE.md (job système authentifié par `verifyCronAuth`, chaque effet portant le `shopId` de la ligne). D'ici là, ne créer aucune autre requête transversale.
- **A10 — Coupon et récompense fidélité** d'une commande refusée, annulée ou expirée : aujourd'hui jamais rendus. Les rendre (dans la transaction) ou non est une règle métier, à décider avec `click-and-collect`.
- **A11 — Paiement en ligne.** Le webhook Stripe passe aujourd'hui `PENDING → ACCEPTED` sans acceptation du boucher ni effets d'acceptation, et annule depuis n'importe quel statut (E23). Règle cible à fixer avec `stripe-payment` avant l'activation de Stripe.

## Références

- [references/etat-du-code.md](references/etat-du-code.md) — qui écrit le statut, écarts E1 à E24 avec preuves, ce qui est déjà bien fait.
- [references/machine-a-etats.md](references/machine-a-etats.md) — table cible, patron A (transition), réponses HTTP, règles de transaction, stock, patron C (création idempotente), audit, numérotation.
- [references/transitions-temporelles.md](references/transitions-temporelles.md) — inventaire des échéances, mécanismes disponibles, patron B (expiration), `claimOnce`, commandes programmées.
- [references/temps-reel-cuisine.md](references/temps-reel-cuisine.md) — facturation Vercel, formule de coût, options, patron D (sonde de version), règles du hook, Web Push.
- [references/plateformes.md](references/plateformes.md) — ce que publient Uber, DoorDash, Deliveroo, Uber Eats, Stripe, Shopify, et ce qu'on en retient.
- [references/sources.md](references/sources.md) — toutes les sources, ce qu'elles étayent, crédibilité, date ; vérifications locales exécutées.
