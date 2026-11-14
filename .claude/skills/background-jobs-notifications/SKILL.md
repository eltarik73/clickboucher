---
name: background-jobs-notifications
description: Tâches planifiées et notifications de Klik&Go sur Vercel — crons (vercel.json, verifyCronAuth, idempotence, chevauchement, rattrapage après panne, budget de temps), choix d'une file (QStash, Inngest, Trigger.dev, waitUntil) avec coûts, table d'envoi (outbox) et rejeu, e-mail Resend (sous-domaine, SPF, DKIM, DMARC, rebonds, plaintes, désinscription, consentement CNIL), campagnes e-mail, Web Push (iOS, Android, TTL, urgency, topic, 404/410), notifications in-app, SMS et WhatsApp en France. À charger avant de créer ou modifier un cron, un envoi d'e-mail, de push, de SMS ou de WhatsApp, un gabarit, une préférence de notification ou public/sw.js.
when_to_use: cron, vercel.json crons, /api/cron, CRON_SECRET, verifyCronAuth, job, tâche de fond, rappel, relance, rapport hebdo, panier abandonné, campagne, file d'attente, queue, QStash, Inngest, Trigger.dev, waitUntil, outbox, retry, sendNotification, notifications.ts, sendEmail, Resend, email-templates, send-campaign, délivrabilité, spam, DMARC, DKIM, SPF, rebond, bounce, désinscription, unsubscribe, web push, VAPID, sw.js, PushPrompt, notification in-app, SMS, WhatsApp, Twilio.
---

# Tâches de fond et notifications — Klik&Go

Ce skill dit **comment un travail planifié s'exécute une fois et pas zéro, et comment un message
part, arrive et ne part pas en double ni sans droit**. Les échéances propres à une commande
(expiration, commande programmée, ajustement de prix) sont dans `order-lifecycle-realtime`.

État décrit : arbre de travail du 14/11/2026, HEAD `32c581f`, **plus le chantier « prix des
commandes » non commité** (`src/lib/services/orders/**`, `notification-recipients.ts`,
`notification-policy.ts`, `tests/integration/**`). Versions : Next.js 14.2.35, Prisma 6.19.2,
`resend` 6.9.1, `web-push` 3.6.7, `svix` 1.84.1, `@upstash/redis` 1.36.2. **Non installés** :
`@vercel/functions`, `@upstash/qstash`, `inngest`, `@trigger.dev/sdk`, `twilio`, `react-email`.
Relu et corrigé par un vérificateur indépendant le 14/11/2026 : les blocs de code des références
compilent contre le dépôt, le SQL de l'outbox a été exécuté par le client Prisma du dépôt
([references/sources.md](references/sources.md), L1 et L2).

## Skills voisins (lier, ne pas dupliquer)

| Sujet | Skill |
|---|---|
| Échéances de commande, `claimOnce`, push cuisine, sonde temps réel | `order-lifecycle-realtime` |
| Coût Vercel, plan Hobby / Pro, matcher du middleware, `updatedAt` et sitemap | `vercel-cost-performance` |
| Migration (outbox, abonnements push), index, SQL brut, transactions | `prisma-expert` |
| Forme des routes, fabrique `cronRoute`, `apiError`, Zod, webhooks entrants | `api-route-conventions` |
| Comparaison de secrets, abus des crons et des webhooks | `security-multitenant` |
| Sentry, moniteur de cron, alerte « job muet », runbooks R4 et R5 | `reliability-observability` |
| Consentement, CGU, données personnelles, mentions | `conformite-france` |
| Crons SEO (`indexnow-fresh`, `bing-daily`, `seo-audit`) | `seo-anti-penalty` (obligatoire) et `seo-expert` |
| Tests d'intégration sur base réelle | `testing-strategy` |

Si un skill cité n'existe pas encore dans `.claude/skills/` (`conformite-france` au 14/11/2026),
appliquer CLAUDE.md et ce skill.

## Carte du code

| Rôle | Fichier |
|---|---|
| Planification (UTC) et durée par défaut (`maxDuration: 30`) | `vercel.json` |
| Authentification des crons | `src/lib/cron-auth.ts` (`/api/cron/` est hors `config.matcher`) |
| Routes planifiées | `src/app/api/cron/*/route.ts` ; modèle actuel : `auto-cancel` (budget, lots, `logger`) |
| Orchestrateur des notifications (688 lignes) | `src/lib/notifications.ts` (`sendNotification`, gabarits, charges push) |
| Destinataire, limitation | `src/lib/notification-recipients.ts`, `src/lib/notification-policy.ts` (+ test) |
| Transports | `src/lib/email.ts` (Resend), `src/lib/push.ts` (web-push), `src/lib/whatsapp.ts` (Twilio REST) |
| Gabarits e-mail | `src/lib/email-templates.ts` (`esc()`), `src/lib/emails/order-{confirmation,receipt}.ts` |
| E-mails hors `sendNotification` | confirmation et reçu (ci-dessus), `cron/prospect-relances`, `src/lib/marketing/send-campaign.ts` |
| Qui notifie après une transition | `src/lib/services/orders/commands/*.ts`, `src/lib/services/orders/announce.ts` |
| Minuteurs de boutique et de produit | `src/lib/shop-status.ts`, `src/lib/product-snooze.ts` |
| Push côté client | `public/sw.js`, `src/components/pwa/PushPrompt.tsx` (monté nulle part), `src/hooks/use-kitchen-notifications.ts` |
| Abonnement, in-app | `src/app/api/push/subscribe/route.ts`, `src/app/api/notifications/**` |
| Modèles | `prisma/schema.prisma` : `Notification`, `User.notif*`, `User.pushSubscription`, `NotifChannel`, `Campaign` |
| Test existant | `tests/integration/notifications/order-notifications.test.ts` |

Inventaire des 15 crons et des écarts J1 à J10, N1 à N10, C1 à C7 :
[references/etat-du-code.md](references/etat-du-code.md).

## Ce qu'il faut savoir avant de toucher à quoi que ce soit

1. **Un envoi qui n'a pas eu lieu est journalisé comme fait** : les bouchons renvoient `true` quand un
   transport n'est pas configuré, `sendEmail` ignore l'erreur que le SDK renvoie sans lever,
   `notifications.ts` ignore les booléens (N2, N3, N4). Configuration réelle de la production (clés,
   DNS d'envoi) : voir le registre privé du programme.
2. **Aucun envoi n'est rejoué** : un échec après la transition est perdu (N1).
3. **Plusieurs minuteurs vivent des heures de trop** : pause produit d'1 h et mode occupé de 30 min
   levés par des crons quotidiens, pause manuelle minutée levée par aucun cron (J2), rappel « prête » qui
   ne vise presque aucune commande (J3).
4. **Consentement marketing** : tout envoi marketing exige un consentement vérifié à l'envoi et une
   désinscription (règle 8, point B4) ; état actuel : voir le registre privé du programme.
5. **Personne ne peut s'abonner au push** : le composant d'abonnement n'est monté nulle part (N7).
6. **Une commande = jusqu'à 7 e-mails** : l'offre gratuite de Resend (100 par jour) tient 14 commandes
   par jour ([email-resend.md § 1](references/email-resend.md)).

## Les 10 règles

1. **Un job réconcilie, il ne réagit pas.** Il traite « tout ce qui est dû et pas fait », jamais une
   fenêtre « entre X et Y » ; un passage manqué ou doublé est normal (Vercel le documente) [V-CRON1].
2. **Chaque effet est idempotent** : écriture conditionnelle, clé unique, ou ligne réclamée
   (`FOR UPDATE SKIP LOCKED` + bail). Pas de verrou global tant que cela suffit ; jamais de verrou de
   session PostgreSQL derrière PgBouncer [PGB1], jamais de verrou Redis tant que la présence d'Upstash
   en production n'est pas confirmée (registre privé du programme).
3. **Chaque job est borné** : lots + budget de temps sous la durée maximale de la fonction (30 s par
   `vercel.json` ; un `export const maxDuration` dans la route prime [V-FLUID]), reste journalisé,
   `logger.info` de fin de passage. Modèle : `expireDueOrders`.
4. **Le temps se lit à Paris, se planifie en UTC.** `getParisWallClock` / `parisWallClockToUtc`, jamais
   `setHours` ; une échéance en minutes ne se confie pas à un cron quotidien.
5. **Une notification de commande est écrite avec la transition et rejouée jusqu'au succès** : ligne
   outbox dans la transaction, envoi immédiat, relais à la minute. C'est la cible (B2). **D'ici là** :
   `await sendNotification` après le `COMMIT`, résultat lu et échec journalisé, filet `claimOnce`
   ([outbox-notifications.md § 6](references/outbox-notifications.md)).
6. **Un transport dit la vérité** : résultat typé `{ ok } | { ok: false, retryable }` ; non configuré en
   production = échec journalisé ; un canal n'est compté servi que sur `ok`.
7. **Pas de doublon gratuit** : clé d'idempotence Resend (24 h) [RS4], `topic` push [RFC8030] ; SMS et
   WhatsApp : mieux vaut ne pas envoyer que doubler.
8. **Transactionnel et marketing ne se mélangent pas** : le marketing exige consentement (particulier)
   ou intérêt légitime documenté (boucherie prospectée), désinscription dans chaque message, limitation
   (`notification-policy.ts`), jamais de rejeu, pas d'envoi de nuit (plage à arbitrer, B4) ; le
   transactionnel n'est jamais limité (CLAUDE.md). Tout e-mail passe par le transport commun ; une audience marketing ne se lit
   jamais sur `users` sans le filtre de consentement.
9. **Un abonnement push ne se supprime que sur `404` / `410`** [WD1] ; `429` (`Retry-After`) et `5xx`
   se réessaient.
10. **Toute valeur interpolée dans un e-mail est échappée** ; aucun secret ni `NEXT_PUBLIC_` pour
    Resend, VAPID privé, Twilio, `CRON_SECRET`.

## Décisions rapides

| Situation | Décision |
|---|---|
| Nouveau cron | Une ligne `vercel.json` (UTC), route sous `/api/cron/`, squelette de [jobs-serverless.md § 5](references/jobs-serverless.md) (ou `cronRoute` quand elle existe), logique dans un service, aucun import `server-auth` / `boucher-auth` / `admin-auth`, `force-dynamic`, moniteur Sentry s'il est critique, test d'intégration du service |
| Besoin d'une précision à la minute | Pas un cron de plus : l'ajouter au cron unique à la minute (§ 6 du même fichier), **après** confirmation du plan Pro (`vercel-cost-performance`, point A) |
| Travail de plus de 30 s | Lots repris au passage suivant ; sinon `export const maxDuration` dans la route (plafond 300 s Hobby, 800 s Pro [V-DUR]). Pas d'orchestrateur pour cela |
| Délai à la seconde, flux multi-étapes | Arbitrage : QStash d'abord (délai, retries), Inngest (étapes), Trigger.dev (très long) — tableau et coûts au § 7 |
| Répondre vite puis envoyer | `await` reste la règle ; `waitUntil` exige `@vercel/functions` et ne rejoue rien ; `after()` absent en Next 14.2 [V-FN] |
| Nouvel événement de notification | L'ajouter à `NotifEvent` ; politique dans `notificationThrottle` (le `switch` l'impose) ; s'il vise le boucher, l'ajouter à `SHOP_OWNER_EVENTS` et passer `shopId` ; gabarit e-mail échappé + `text` ; charge push avec `TTL` / `urgency` / `topic` ; test |
| Envoi par boutique à un boucher (rapport, alerte) | Pas d'événement en `hourly-per-type` : la limite est par utilisateur et supprime le second envoi (J10) |
| Nouvel e-mail marketing ou campagne | Consentement vérifié à l'envoi, `List-Unsubscribe` en un clic + lien visible, `category: "marketing"`, règles « Envoi en masse » de [email-resend.md § 4](references/email-resend.md) |
| Rebond ou plainte | Webhook Resend signé → `notifEmail = false` + message dans le profil ([email-resend.md § 3](references/email-resend.md)) |
| Demande de SMS ou WhatsApp | Arbitrage budget + opt-in ; WhatsApp : modèles approuvés seulement ([push-inapp-sms.md § 3](references/push-inapp-sms.md)) |
| Job qui écrit dans `Shop` | Ne pas bouger `updatedAt` sans changement visible (sitemap) : écriture **par ligne** qui repasse la valeur lue, comme `refreshShopMetrics(shopId, keepUpdatedAt)` ; un `updateMany` ne le permet pas (J8) |
| SQL brut (`$executeRaw`, `$queryRaw`) | Cast explicite vers tout enum (`${x}::"NotifChannel"`), validé par le client Prisma sur une base issue du schéma, jamais dans `psql` seul ([outbox-notifications.md § 4](references/outbox-notifications.md)) |

## Patron minimal d'un transport honnête

```ts
// Extrait (non autonome) de deliverEmail — version complète compilée dans references/email-resend.md
export type EmailResult = { ok: true; id: string } | { ok: false; retryable: boolean; reason: string };
// resend.emails.send(...) renvoie { data, error } et NE LÈVE PAS :
const { data, error } = await resendClient.emails.send(payload, { idempotencyKey });
if (error) {
  const s = error.statusCode;
  return { ok: false, retryable: s === null || s === 429 || s >= 500, reason: `${error.name}: ${error.message}` };
}
return { ok: true, id: data.id };
```

Version complète et compilée : [references/email-resend.md § 2](references/email-resend.md). Push
(`WebPushError.statusCode`, `TTL`, `urgency`, `topic`) : [references/push-inapp-sms.md § 1](references/push-inapp-sms.md).
Outbox (schéma, `enqueueNotification`, `drainOutbox`, `settleOutboxRow`) :
[references/outbox-notifications.md](references/outbox-notifications.md).

## Erreurs déjà commises ici (à ne pas reproduire)

1. Fenêtre « prête depuis 30 min à 2 h » évaluée une fois par jour (J3) ; égalité stricte de jours
   (`diffDays === alertDaysBefore`) qui perd l'alerte si un passage manque (J4).
2. Minuteur d'une heure levé par un cron quotidien ; minuteur levé seulement quand la tablette du
   boucher interroge l'API (J2).
3. `try { await client.emails.send() } catch` pour détecter un échec Resend : le SDK ne lève pas (N3).
4. Bouchon qui renvoie `true` en production ; canal compté servi sans lire le résultat ; compteur
   métier avancé sur ce faux succès (`emailsSentCount` des prospects) (N2, N4).
5. Abonnement push effacé à la première erreur ; aucun `TTL` (4 semaines par défaut) (N5, N6).
6. Demander la permission de notification au montage d'une page (N7) ; composant d'abonnement écrit
   puis jamais monté.
7. Activer un canal marketing ou payant sans accord préalable, ou prospecter sans moyen de s'opposer
   (règle 8 ; état actuel : voir le registre privé du programme) ; « ne pas répondre » dans un e-mail
   qui demande une réponse (C4).
8. Texte libre WhatsApp hors fenêtre de 24 h (C5).
9. Interpoler une valeur saisie sans l'échapper dans un e-mail (règle 10 ; état actuel : voir le
   registre privé du programme).
10. Authentifier un cron autrement que par le patron de
    [jobs-serverless.md § 5](references/jobs-serverless.md) (J9) ; route cron non planifiée laissée en
    ligne (J6).
11. Envoi en masse dans la requête HTTP, sans reprise : campagne bloquée en `SENDING`, doublons au
    second clic ; champ `scheduledAt` que rien ne lit (C7).
12. Limitation « une par heure et par utilisateur » posée sur un envoi fait par boutique (J10).
13. SQL brut déclaré « vérifié » sans l'avoir fait tourner par le client Prisma sur le schéma Prisma : le
    premier jet de l'outbox de ce skill y échouait sur les colonnes enum (`42804`).

## Définition de terminé

Un travail du domaine est terminé quand :

- [ ] le job ou l'envoi est **idempotent** et son rejeu est testé (deux passages simultanés, passage
      rejoué, passage en retard) en intégration sur base réelle (`tests/integration/`, transports simulés
      seulement : `@/lib/email`, `@/lib/push`, `@/lib/whatsapp`, `@/lib/emails/*`, jamais Prisma) ;
- [ ] tout cron : `verifyCronAuth`, `force-dynamic`, `try/catch` + `handleApiError`, budget et lots,
      `logger` de fin de passage, heure de Paris via `paris-time.ts`, test du matcher toujours vert
      (`src/lib/__tests__/middleware-matcher.test.ts`), fréquence compatible avec le plan, moniteur
      Sentry pour un cron critique (`reliability-observability`) ;
- [ ] tout transport renvoie un résultat typé ; un canal non configuré en production produit un
      `logger.error`, pas un succès ; `Notification.delivered` / `channels` reflètent les envois réels ;
- [ ] notification de commande : enregistrée avec la transition, rejouée par le relais (une fois l'outbox
      livrée), clé d'idempotence fournisseur posée ;
- [ ] e-mail : valeurs échappées (test unitaire), version `text`, `replyTo` lisible ; marketing : consentement
      vérifié, `List-Unsubscribe` + `List-Unsubscribe-Post`, lien visible, pas d'envoi de nuit ;
- [ ] push : `TTL`, `urgency`, `topic` choisis selon [push-inapp-sms.md](references/push-inapp-sms.md),
      suppression d'abonnement sur `404`/`410` seulement, permission sur geste, testé sur Chrome Android et
      sur un iPhone avec l'application installée ;
- [ ] tout SQL brut a tourné par le client Prisma sur une base créée depuis `schema.prisma` ;
- [ ] aucune dépendance, aucun fournisseur, aucune migration ajoutés sans arbitrage ;
      `references/etat-du-code.md` mis à jour (écart fermé ou nouveau) ;
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run test:integration` et `npm run build` passent.

## Points à arbitrer (propriétaire)

- **B1 — Plan Vercel.** Le cron unique à la minute (minuteurs, relais outbox, échéances de commande)
  suppose Pro ; plan à confirmer (`vercel-cost-performance`, point A) avant tout cron infra-quotidien.
- **B2 — Outbox** : nouvelle table `notification_outbox` (migration ; colonnes `timestamptz` ou
  `timestamp(3)` à trancher avec `prisma-expert`, son point A7) ; en même temps, table d'abonnements
  push multi-appareils (`order-lifecycle-realtime`, A4).
- **B3 — Domaine d'envoi** : sous-domaine (ex. `notifications.klikandgo.app`), offre Resend (100 e-mails par
  jour en gratuit, soit 14 commandes), vérifier SPF et DKIM du courrier Google de la racine, DMARC `p=none` puis
  `quarantine`, boîte `rua`, `replyTo` lu. Actions DNS et Vercel côté propriétaire.
- **B4 — Consentement marketing** (avec `conformite-france`) : préférences marketing en opt-in,
  séparées des préférences transactionnelles, statut de la relance de panier abandonné, lien de
  désinscription, opposition dans les e-mails de prospection, plage horaire des envois marketing,
  audiences des campagnes ; état actuel : voir le registre privé du programme.
- **B5 — WhatsApp et SMS** : désactiver le canal WhatsApp tant que modèles, opt-in et budget ne sont pas
  décidés ; SMS seulement pour un cas précis et chiffré.
- **B6 — CLAUDE.md, section « Variables d'environnement »** : n'énumère ni `RESEND_API_KEY`,
  `CRON_SECRET`, `VAPID_*`, `TWILIO_*`, ni le futur `RESEND_WEBHOOK_SECRET`. Proposition : les ajouter
  (server-only). CLAUDE.md cite `auto-cancel` comme modèle de cron : exact pour sa forme depuis le
  chantier, mais il reste quotidien (`order-lifecycle-realtime`, A1 et A2).
- **B7 — Ménage** : supprimer `/api/cron` (racine) et l'en-tête d'authentification hérité après vérification des
  appelants (`api-route-conventions` propose à l'inverse de garder la route en la passant sur
  `cronRoute` : un seul des deux) ; découper `notifications.ts` (688 lignes, limite CLAUDE.md : 300).
- **B8 — Orchestrateur** (QStash, Inngest, Trigger.dev) : aucun besoin actuel ne le justifie ; à rouvrir
  pour un délai à la seconde ou un flux multi-étapes (remboursements Stripe).
- **B9 — Campagnes e-mail** : conditions préalables à tout envoi (consentement, désinscription : B4).
  Honorer `scheduledAt` par un job, ou retirer le champ. Nombre d'e-mails par commande (7 aujourd'hui).

## Références

- [references/etat-du-code.md](references/etat-du-code.md) — inventaire des crons, chaîne de notification, écarts J/N/C avec preuves.
- [references/jobs-serverless.md](references/jobs-serverless.md) — garanties des crons Vercel, idempotence, verrous, rattrapage, squelette, cron unique, files et orchestrateurs chiffrés.
- [references/outbox-notifications.md](references/outbox-notifications.md) — outbox + envoi immédiat + relais, schéma, code exécuté, ordre de migration, marche à suivre sans outbox.
- [references/email-resend.md](references/email-resend.md) — DNS et DMARC, quotas, envoi honnête, webhook de rebonds, transactionnel / marketing, désinscription, envoi en masse, gabarits.
- [references/push-inapp-sms.md](references/push-inapp-sms.md) — Web Push iOS / Android, en-têtes, codes, client, in-app, SMS et WhatsApp en France.
- [references/sources.md](references/sources.md) — sources, crédibilité, dates, vérifications locales.
