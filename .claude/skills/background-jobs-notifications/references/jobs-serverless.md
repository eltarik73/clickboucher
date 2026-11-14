# Tâches de fond sur Vercel : crons, idempotence, chevauchement, rattrapage, files

Les échéances propres à une commande (expiration, commande programmée, ajustement de prix) et leurs
patrons (`expirePendingOrders` et `claimOnce` ; le dépôt a aujourd'hui `expireDueOrders`, écrit par le
chantier) sont dans `order-lifecycle-realtime` (`references/transitions-temporelles.md`). Ce fichier
couvre le cadre commun à **tous** les jobs.

## 1. Ce que garantit (et ne garantit pas) un cron Vercel

Relu le 14/11/2026 sur la documentation Vercel [V-CRON1][V-CRON2] :

| Fait | Conséquence chez nous |
|---|---|
| Livraison « best effort » : un passage peut manquer (aucun journal), ou être livré deux fois | Chaque job **réconcilie** tout le travail en retard ; jamais de fenêtre « entre X et Y » |
| Aucune nouvelle tentative si l'appel échoue | L'échec d'un passage est rattrapé par le suivant, donc par la réconciliation |
| Si un passage dure plus que l'intervalle, un second démarre | Écritures conditionnelles ou réclamation par ligne ; verrou seulement s'il reste un effet non idempotent |
| Production seulement ; redirections non suivies ; réponse en cache ni exécutée ni journalisée | Tester en appelant le handler (intégration) ; `force-dynamic` ; si `trailingSlash` est un jour activé dans `next.config.mjs` (absent aujourd'hui), le `path` du cron doit porter la barre finale |
| `CRON_SECRET` (16 caractères au moins) envoyé en `Authorization: Bearer` ; la valeur est figée au build du déploiement | Rotation = modifier la variable **puis redéployer**, vérifier le premier passage (journal 2xx). Un retour arrière (Instant Rollback) remet l'ancien secret **et** les anciens crons |
| Durée = celle de la fonction. Ordre de priorité : `export const maxDuration` de la route, puis `vercel.json`, puis le tableau de bord [V-FLUID] | Chez nous : 30 s (`vercel.json`) sauf export dans la route (`auto-cancel` 60, `recalc-shop-tiers` 300). Budget explicite dans la boucle, **sous** cette valeur. Valeur réellement déployée : `vercel inspect <url> --json`, champ `timeout` [V-DUR] |
| Hobby : 1 fois par jour, à l'heure près ; Pro : à la minute | Aucun cron infra-quotidien avant confirmation du plan Pro |
| Une règle de pare-feu peut bloquer le cron | Exclure `/api/cron/` de toute règle « deny » ou « challenge » |
| Réglage « Disable Cron Jobs » du projet : persiste d'un déploiement à l'autre | Après un incident, vérifier qu'il n'est pas resté activé (`reliability-observability`, runbook R5) |
| Crons « legacy », remplacés à terme par Schedules (fuseaux, cibles privées) | Ne pas migrer avant la sortie de bêta ; voir `order-lifecycle-realtime` A5 |

Toutes les heures de `vercel.json` sont en UTC. Une alerte « 9 h à Paris » doit être planifiée
toutes les heures (Pro) ou calculée : le job lit l'heure de Paris (`getParisWallClock`) et ne fait rien
hors de sa plage.

## 2. Les quatre propriétés d'un job correct

1. **Idempotent.** Le relancer ne change rien : `updateMany` conditionnel (« si pas déjà fait »), clé
   unique (`ON CONFLICT DO NOTHING`), marqueur posé par écriture conditionnelle. Exemple Vercel : « passer
   le statut à actif » est sûr, « créditer 10 » ne l'est pas [V-CRON1].
2. **Réconciliant.** Il sélectionne « tout ce qui est dû et pas encore fait » (`dueAt <= now AND doneAt IS NULL`),
   pas « ce qui est arrivé depuis le dernier passage ». Une fenêtre bornée en bas (`gte: twoHoursAgo`)
   perd ce qu'un passage manqué n'a pas traité. Borne d'âge seulement pour ne pas envoyer un message
   devenu absurde (un rappel « prête » de la veille), et alors marquer `SKIPPED`, pas ignorer.
3. **Borné.** Lots (`take`) **et** budget de temps (`Date.now() < deadline`), compteur de reste
   journalisé (`logger.warn`) ; le passage suivant reprend. Modèle : `expireDueOrders`
   (`src/lib/services/orders/commands/close.ts`). Ne jamais `limit` une écriture gardée dans `updateMany`
   (voir `order-lifecycle-realtime` : la garde n'est plus ré-évaluée).
4. **Observable.** `logger.info` en fin de passage (nombre traité, reste, durée), `logger.error` (Sentry)
   par élément en échec, réponse JSON avec les compteurs. Surveillance d'un job qui ne tourne plus :
   `reliability-observability` (un job muet ne lève pas d'erreur).

## 3. Chevauchement : faut-il un verrou ?

Ordre de préférence :

1. **Aucun verrou** quand chaque effet est une écriture conditionnelle en base (deux passages
   simultanés se partagent ou se marchent dessus sans dommage). C'est le cas de `busy-end`,
   `vacation-end`, `unsnooze` et de l'expiration des commandes (vérifié par `order-lifecycle-realtime`).
2. **Réclamation par ligne** quand l'effet est externe (e-mail, push) : `UPDATE … WHERE id IN (SELECT …
   FOR UPDATE SKIP LOCKED LIMIT n) RETURNING …` avec un bail (`locked_until`). Deux relais simultanés
   reçoivent des lignes disjointes (vérifié ici [L2] : 10 lignes, deux réclamations concurrentes, 6 + 4,
   aucune réclamée deux fois). `SKIP LOCKED` est fait pour les tables consommées comme des files [PG2].
3. **Verrou global** seulement pour un job non découpable. Avec PgBouncer en mode transaction, les
   verrous consultatifs de **session** ne fonctionnent pas [PGB1]. Le verrou consultatif **de
   transaction** (`pg_advisory_xact_lock`) reste le bon outil pour un invariant court (`prisma-expert`,
   `transactions-concurrence.md` § 5), mais **pas pour verrouiller un job entier** : il ne vit que le temps
   de la transaction, donc tout le job devrait tenir dans une transaction interactive (5 s par défaut,
   10 s avec `TRANSACTION_OPTIONS`) où `prisma-expert` interdit tout appel réseau (règle 8). Pour un job
   entier : une ligne de bail dans une table (`job_leases(name, locked_until)`, mise à jour
   conditionnelle), donc une migration. Le verrou Redis conseillé par Vercel [V-CRON1] suppose Upstash
   en production (présence : registre privé du programme) : pas de verrou qui disparaît
   silencieusement quand Redis manque.

## 4. Rattrapage après une panne

La panne du 05 au 13/11/2026 (402) a supprimé huit jours de passages. Un job réconciliant rattrape
seul ; il faut seulement décider, par type d'effet, ce qui est encore utile :

| Effet en retard | Règle |
|---|---|
| Changement d'état (fin de pause, fin de vacances, expiration) | Appliquer, toujours |
| Rappel lié à un moment (« prête », « programmée dans 30 min ») | Ne plus envoyer passé un âge maximal ; marquer `SKIPPED` |
| Récurrence (`recurring-orders`) | Recaler `nextRunAt` sur la prochaine occurrence **future**, un seul rappel |
| Marketing (panier abandonné, promo) | Ne jamais rattraper |
| Rapport (hebdomadaire) | Un seul, le plus récent |

## 5. Squelette d'un cron (compilé contre le dépôt, voir [L1])

La route authentifie, borne et journalise ; la logique métier vit dans un service (`src/lib/services/**`
ou `src/lib/*.ts`), comme `expireDueOrders` appelé par `auto-cancel` : c'est le service qu'on teste en
intégration. L'exemple garde la requête dans la route pour tenir en un bloc. Quand la fabrique
`cronRoute` de `api-route-conventions` (`@/lib/api/route-open`) existera, elle remplace les trois lignes
d'authentification et de `try/catch`. Un cron critique s'enveloppe en plus d'un moniteur Sentry
(`Sentry.withMonitor`, `reliability-observability`, `sante-et-surveillance.md`).

```ts
// src/app/api/cron/<nom>/route.ts — jamais d'import server-auth / boucher-auth / admin-auth ici
import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { verifyCronAuth } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
const BUDGET_MS = 20_000; // sous la durée maximale de la fonction (30 s via vercel.json, faute d'export maxDuration)

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  try {
    if (!verifyCronAuth(req)) return apiError("UNAUTHORIZED", "Invalid cron secret");
    let done = 0;
    let remaining = true;
    while (Date.now() < startedAt + BUDGET_MS) {
      const now = new Date();
      const batch = await prisma.product.findMany({
        where: { snoozeEndsAt: { not: null, lte: now } },
        select: { id: true },
        take: 100,
      });
      if (batch.length === 0) { remaining = false; break; }
      const { count } = await prisma.product.updateMany({
        // la condition est répétée : un produit re-mis en pause entre-temps n'est pas touché
        where: { id: { in: batch.map((p) => p.id) }, snoozeEndsAt: { not: null, lte: now } },
        data: { snoozeType: "NONE", snoozedAt: null, snoozeEndsAt: null, snoozeReason: null, inStock: true },
      });
      done += count;
    }
    const durationMs = Date.now() - startedAt;
    if (remaining) logger.warn("[cron/unsnooze] Work left for the next run", { done, durationMs });
    logger.info("[cron/unsnooze] Run finished", { done, durationMs });
    return apiSuccess({ done, remaining });
  } catch (error) {
    return handleApiError(error, "cron/unsnooze");
  }
}
```

`verifyCronAuth` à comparaison constante, `Authorization: Bearer` seul. `safeEqual` est la
même fonction que dans `security-multitenant` (`secrets-entetes-csp.md`) : la placer une seule fois dans
un module partagé. Le dépôt a déjà une comparaison à temps constant, `secretsMatch`
(`src/lib/auth/test-session-node.ts`, sans dépendance à Clerk), utilisable telle quelle.

```ts
import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`);
}
```

Avant de retirer un en-tête d'authentification hérité : vérifier qu'aucun appelant externe ne
l'envoie (`grep -rn` du nom de l'en-tête dans `.github` et `scripts`) ; un outil hors dépôt
(moniteur, script local) reste possible : demander au propriétaire.

## 6. Un seul cron à la minute

Sur Pro, ne pas multiplier les crons infra-quotidiens : **un** point d'entrée à la minute qui appelle,
dans l'ordre et chacun sous son budget, les balayages dus (échéances des commandes de
`order-lifecycle-realtime`, relais de la table d'envoi, fins de mode occupé et de pause produit). Les
crons quotidiens restent pour les rapports et le SEO. Deux entrées `crons` peuvent viser le même chemin
avec deux planifications : l'en-tête `x-vercel-cron-schedule` dit laquelle a déclenché l'appel [V-CRON1].

Ordre de grandeur (hypothèses de ce skill, à remplacer par la mesure : 43 200 passages par mois, 0,3 s de
CPU actif et 1 s de durée par passage, 2 Go de mémoire, valeur par défaut relevée par
`order-lifecycle-realtime` ; tarifs `sfo1` relus le 14/11/2026 [V-FNPRICE]) : 0,03 $ d'invocations,
environ 0,64 $ de CPU actif (3,6 h × 0,177 $) et 0,35 $ de mémoire (24 Go-h × 0,0147 $), soit environ 1 $
par mois. Sur Hobby ce serait refusé au déploiement [V-CRON2], et 3,6 h consommeraient presque tout le
quota de 4 h de CPU actif (`vercel-cost-performance`). Mesurer après mise en service (Observability, CPU
par invocation).

## 7. File ou orchestrateur : quand et lequel

Aucun n'est installé. À n'envisager que si l'un des besoins suivants est réel : délai à la seconde
(rappel exact), nouvelle tentative avec attente longue sans table maison, flux multi-étapes durable
(remboursement Stripe, intégration d'une boucherie).

Un travail de plus de 30 s n'est **pas** en soi une raison : d'abord le découper en lots repris au
passage suivant (§ 2), puis, si un seul passage doit durer, `export const maxDuration` dans la route. La
plateforme autorise 300 s sur Hobby et 800 s sur Pro [V-DUR] ; le coût suit la durée (mémoire facturée
tant que la requête est en cours [V-FNPRICE]). Un orchestrateur ne se justifie qu'au-delà.

| Option | Modèle | Coût relevé le 14/11/2026 | Pour nous |
|---|---|---|---|
| **Cron Vercel + table en base** (défaut) | réconciliation, lignes réclamées | invocations + CPU de la fonction | Couvre tout le besoin actuel, aucune dépendance |
| `waitUntil` (`@vercel/functions`, non installé) | prolonge la requête après la réponse, même délai que la fonction [V-FN] | celui de la fonction | Rend la réponse plus rapide ; **ne remplace pas** une table d'envoi (rien n'est rejoué si la fonction meurt). `after()` exige Next.js 15.1 [V-FN] |
| Upstash QStash | HTTP poussé vers notre route, retries (3 par défaut, attente `min(86400, e^(2.5n))` s), délai, DLQ [QS2] | gratuit 1 000 messages/jour, délai max 7 jours ; puis 1 $ les 100 000, chaque retry facturé [QS1] | Premier choix si un délai à la seconde devient nécessaire (Upstash est déjà un fournisseur). SDK `upstash/qstash-js` : 271 étoiles, sous le seuil, retenu comme SDK officiel ; vérifier la signature `Upstash-Signature` de chaque appel entrant [QS3] |
| Inngest | fonctions à étapes mémorisées, appelées sur notre route [INN2] | gratuit 50 000 exécutions/mois ; Pro dès 99 $/mois ; exécutions = runs × (étapes + 1) [INN1] | Flux multi-étapes ; reste soumis aux limites de nos fonctions Vercel. Dépôt : 6 035 étoiles, actif |
| Trigger.dev | tâches exécutées sur **son** infrastructure, déployées par sa CLI [TRG2] | gratuit 5 $ de crédit ; Hobby 10 $, Pro 50 $/mois ; 0,000025 $ par run + calcul à la seconde [TRG1] | Travaux plus longs que ce qu'autorise une fonction (imports lourds, génération) ; second déploiement à maintenir. Dépôt : 16 760 étoiles, actif |
| Vercel Queues / Workflows / Schedules | file au moins une fois, flux durables, planifications dynamiques | à l'usage | Bêta pour Queues et Schedules : `order-lifecycle-realtime` A5 |
| `pg-boss` | file dans PostgreSQL, travailleur permanent | — | Exige un processus qui tourne en continu : inadapté aux fonctions. Dépôt : 4 138 étoiles |

Règle de décision : rester sur « cron à la minute + table » tant que le délai d'une minute suffit (c'est
le cas de toutes les notifications actuelles). Toute dépendance de cette liste est un point à arbitrer.
