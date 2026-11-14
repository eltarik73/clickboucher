# État du code — tâches planifiées et notifications

Relevé du 14/11/2026 sur l'arbre de travail (HEAD `32c581f`) **avec le chantier
« prix des commandes » non commité** présent dans l'arbre de travail (`src/lib/services/orders/**`,
`notification-recipients.ts`, `notification-policy.ts`, `tests/integration/**`). Chaque constat a été
relu dans le code par un second passage le même jour. Relire le fichier avant de se fier à un numéro de
ligne. Identifiants : `J` = tâche planifiée, `N` = notification, `C` = canal.

## 1. Inventaire des crons (`vercel.json`, heures UTC)

Paris = UTC+1 en hiver, UTC+2 en été : « 07:00 » dans `vercel.json` = 08:00 ou 09:00 à Paris.

| Route | Planif. | Ce qu'elle fait | Écart |
|---|---|---|---|
| `auto-cancel` | `0 1 * * *` | `expireDueOrders` (transition conditionnelle, budget 25 s, lots de 200), puis `checkAutoPause` | J1 |
| `busy-end` | `0 2 * * *` | `updateMany` des boutiques dont `busyModeEndsAt` est passé | J2 |
| `performance-refresh` | `0 3 * * *` | métriques boutiques | — |
| `abandoned-carts` | `0 4 * * *` | marque `abandonedAt` **puis** envoie `CART_ABANDONED` par lots de 50 (e-mail, WhatsApp, push), soit à 05:00 ou 06:00 heure de Paris | J5, C3 |
| `unsnooze` | `0 5 * * *` | remet en vente les produits dont `snoozeEndsAt` est passé | J2 |
| `vacation-end` | `0 6 * * *` | rouvre les boutiques en fin de vacances | J8 |
| `ready-reminder` | `0 7 * * *` | rappelle les commandes `READY` depuis 30 min à 2 h | J3 |
| `recurring-orders` | `0 8 * * *` | rappel des commandes récurrentes, avance `nextRunAt` | J4 |
| `calendar-alerts` | `0 9 * * *` | alerte « événement dans N jours » aux boucheries | J4 |
| `prospect-relances` | `15 9 * * *` | relance 3 jours après le premier e-mail, puis 7 jours après cette relance (`lastEmailAt`), par `sendEmail` direct | J4, C4 |
| `weekly-report` | `30 9 * * 1` | rapport hebdomadaire boucher (`WEEKLY_REPORT`, un envoi par boutique) | J10 |
| `recalc-shop-tiers` | `0 3 1 * *` | paliers des boutiques, `maxDuration = 300` dans la route | J4, J7, J8 |
| `indexnow-fresh`, `bing-daily`, `seo-audit` | quotidiens | SEO : **hors de ce skill**, lire `seo-anti-penalty` avant d'y toucher | — |
| `/api/cron` (racine) | aucune | doublon d'`unsnooze` | J6 |
| `/api/cron/recipes` | aucune | retiré de `vercel.json` (voir CLAUDE.md) | — |

Ce qui est bien fait et à garder : toutes les routes planifiées appellent `verifyCronAuth` et ont
`export const dynamic = "force-dynamic"` (une réponse en cache ne serait pas exécutée ni journalisée [V-CRON1]) ;
`/api/cron/` est exclu du `config.matcher` du middleware (`src/middleware.ts`) ; `auto-cancel` est le bon
modèle actuel (transition conditionnelle, budget de temps sous la durée maximale, `remainingCount`
journalisé, journalisation par `logger`) ; les envois par lots utilisent `Promise.allSettled`.

### Écarts des tâches

- **J1 — Les échéances en minutes sont tenues par des crons quotidiens.** Expiration d'une commande
  (10 min), voir `order-lifecycle-realtime` (A1). Traité là-bas, pas ici.
- **J2 — Minuteurs de boutique et de produit quotidiens.** Le mode occupé automatique dure 30 min
  (`AUTO_BUSY` dans `src/lib/services/orders/announce.ts`) ; un produit « en pause 1 h »
  (`snoozeProduct`, `ONE_HOUR`) reste `inStock: false` jusqu'au prochain passage de 05:00 UTC. La
  remise à zéro paresseuse de `getShopStatus` (`src/lib/shop-status.ts:33`) n'est appelée que par
  `GET /api/boucher/shop/status` : le client, lui, voit la boutique occupée et le produit indisponible
  pendant des heures. Effet produit direct, pas seulement technique.
  **La pause manuelle minutée n'a aucun cron** : `pauseShop({ durationMin })` pose `pauseEndsAt`
  (`shop-status.ts`), que seule cette remise à zéro paresseuse lève. Si la tablette du boucher est
  éteinte (plus de sonde sur `GET /api/boucher/shop/status`), une pause de 30 min dure jusqu'à sa
  prochaine ouverture du mode cuisine. À intégrer au balayage des minuteurs (`jobs-serverless.md` § 6).
- **J3 — `ready-reminder` ne rappelle presque jamais.** Fenêtre « prête depuis 30 min à 2 h » évaluée
  une fois par jour à 07:00 UTC : seules les commandes passées `READY` entre 05:00 et 06:30 UTC sont
  visées, avant l'ouverture de la plupart des boucheries. De plus, le dédoublonnage lit `notifSent` puis
  envoie (pas de réclamation atomique : `order-lifecycle-realtime`, `claimOnce`).
- **J4 — Pas de rattrapage après un passage manqué.** `calendar-alerts` exige `diffDays === alertDaysBefore`,
  `prospect-relances` une fenêtre de 24 h : un passage manqué (Vercel le dit possible [V-CRON1]) perd
  l'envoi. `recurring-orders` et `calendar-alerts` calculent « aujourd'hui » avec `setHours` sur
  l'horloge UTC de la fonction (règle CLAUDE.md : `src/lib/paris-time.ts`). `recurring-orders` avance
  `nextRunAt` d'une seule période : après une longue panne, un rappel part chaque jour jusqu'à rattraper.
  `recalc-shop-tiers` ne calcule que « le mois précédent » (bornes en heure UTC de la fonction, pas de
  Paris) le 1er du mois : un passage manqué laisse les paliers faux un mois entier ; il fait aussi un
  `aggregate` par boutique (N+1, règle CLAUDE.md).
- **J5 — « Au plus une fois » sans le dire.** `abandoned-carts` marque les paniers avant d'envoyer : un
  envoi qui échoue n'est jamais refait. Acceptable pour du marketing, jamais pour une notification de commande.
- **J6 — Route racine `/api/cron` orpheline.** Non planifiée, doublon d'`unsnooze`. Candidate à
  suppression (point à arbitrer B7) ; authentification : voir J9.
- **J7 — Durée.** `vercel.json` fixe `maxDuration: 30` pour `src/app/api/**/*.ts` ; quatre crons
  exportent 60 (`auto-cancel`, `seo-audit`, `bing-daily`, `indexnow-fresh`) et un 300
  (`recalc-shop-tiers`). L'export de la route prime sur `vercel.json` [V-FLUID] ; la valeur déployée se
  lit avec `vercel inspect <url> --json` (champ `timeout`) [V-DUR]. Seul `auto-cancel` porte un budget
  explicite : les autres boucles (`weekly-report`, `calendar-alerts`, `recurring-orders`,
  `abandoned-carts`, `recalc-shop-tiers`) envoient ou écrivent sans borne de temps ni reprise.
- **J8 — `Shop.updatedAt` bougé par la maintenance.** `busy-end`, `vacation-end` (`updateMany`) et
  `recalc-shop-tiers` (`update` de chaque boutique ayant vendu) écrivent sur `Shop` : Prisma pose
  `@updatedAt`, qui alimente le `lastmod` du sitemap (`vercel-cost-performance`, règle « Nouveau cron »).
  Parade déjà en place ailleurs : `refreshShopMetrics(shopId, keepUpdatedAt)`
  (`src/lib/services/performance.ts`) repasse la valeur lue dans `data`. Elle suppose une écriture
  **par ligne** ; un `updateMany` ne peut pas conserver une valeur différente par boutique (lire puis
  écrire boutique par boutique, par lots ; ou une instruction `$executeRaw`, qui ne touche pas
  `updated_at` puisqu'aucun déclencheur ne le pose : `prisma-expert`, `schema-et-types.md` § 3). Pour
  `vacation-end` la boutique redevient visible : le changement de `lastmod` est légitime.
- **J9 — Authentification des crons à aligner sur le patron** de `jobs-serverless.md` § 5
  (comparaison à temps constant, `Authorization: Bearer` seul, le seul en-tête qu'envoie Vercel
  [V-CRON1]) ; état actuel : voir le registre privé du programme.
- **J10 — Limitation horaire appliquée à des envois par boutique.** `WEEKLY_REPORT` et `CALENDAR_ALERT`
  sont en `hourly-per-type` **par utilisateur** (`notification-policy.ts`, `sentWithinLastHour` dans
  `notifications.ts`) alors que `weekly-report` et `calendar-alerts` envoient une fois **par boutique** :
  le propriétaire de deux boutiques ne reçoit que le premier rapport, et deux événements du calendrier le
  même jour n'en donnent qu'un. Les deux crons comptent pourtant l'envoi comme fait (`sentCount++` sans
  lire `{ sent }`).

## 2. Chaîne de notification

`sendNotification(event, data)` (`src/lib/notifications.ts`, 688 lignes, au-dessus de la limite de
300 de CLAUDE.md) : gabarit → destinataire (`resolveNotificationRecipient`, clause `OR` clerkId / id
Prisma, corrigée par le chantier) → limitation (`notificationThrottle` : jamais pour les événements de
commande, une par heure et par type pour le marketing) → e-mail → WhatsApp → push → journal
`Order.notifSent` → ligne `Notification` (in-app). Appelée **après** la validation de la transaction,
avec `await`, par `src/lib/services/orders/commands/*.ts` et `announce.ts`. Test d'intégration existant :
`tests/integration/notifications/order-notifications.test.ts` (transports simulés, base réelle).

Quatre chemins appellent `sendEmail` **sans passer par `sendNotification`**, donc sans sa limitation
ni sa ligne `Notification` ; chacun doit appliquer lui-même les règles de préférence et de consentement
(C3, C7) : la confirmation de commande (`src/lib/emails/order-confirmation.ts`,
depuis `announce.ts`), le reçu au retrait (`src/lib/emails/order-receipt.ts`, depuis
`commands/pickup-receipt.ts`), la prospection (`cron/prospect-relances`,
`api/webmaster/prospects/[id]/send-email`) et les campagnes (`src/lib/marketing/send-campaign.ts`, C7).

Volume : une commande menée jusqu'au retrait déclenche aujourd'hui jusqu'à **7 e-mails** (nouvelle commande
au boucher, confirmation, acceptée, en préparation, prête, retirée, reçu) quand chacun a `notifEmail` à
vrai, plus autant de WhatsApp et de push que de statuts.

- **N1 — Aucun envoi n'est rejoué.** Échec d'un fournisseur, fonction arrêtée par la durée maximale :
  la notification est perdue, `sendNotification` renvoie `{ sent: false }` et personne ne réessaie.
  Pas de table d'envoi (outbox).
- **N2 — Les canaux sont comptés « servis » sans preuve.** `sendEmail` et `sendWhatsAppMessage`
  renvoient `false` sans lever d'exception, mais `notifications.ts` fait `channels.push("email")` /
  `push("whatsapp")` sans lire ce booléen. La ligne `Notification` porte `delivered: true`.
- **N3 — `sendEmail` ignore les erreurs de Resend.** Le SDK `resend` 6.9.1 **renvoie** `{ data, error }`
  au lieu de lever (`node_modules/resend/dist/index.d.mts`, type `Response<T>`) ; `src/lib/email.ts`
  n'examine pas `error` et renvoie `true` (clé invalide, quota, adresse refusée…).
- **N4 — Les bouchons disent « envoyé ».** Sans `RESEND_API_KEY`, sans clés VAPID ou sans Twilio, les
  fonctions journalisent `(stub)` et renvoient `true`, en production comprise : rien ne part et tout est
  journalisé comme servi (configuration réelle de la production : registre privé du programme). Effets
  en chaîne dans ce cas : `prospect-relances` avance `emailsSentCount` et `lastEmailAt` sans rien
  envoyer (les prospects sont « relancés » en base) ; une campagne affiche `sentCount` = tous les
  destinataires.
- **N5 — Abonnement push effacé à la première erreur**, passagère ou non (`notifications.ts:636-639`,
  `push.ts` renvoie `false` pour tout), et un seul abonnement par utilisateur (`User.pushSubscription`).
  Détail et cible multi-appareils : `order-lifecycle-realtime` (E22, A4).
- **N6 — Aucun `TTL`, `urgency` ni `topic`** à l'envoi push : défaut de `web-push` = 4 semaines
  (`DEFAULT_TTL = 2419200`, `node_modules/web-push/src/web-push-lib.js`), urgence `normal`. Un « commande
  prête » peut arriver le lendemain.
- **N7 — Personne ne s'abonne au push.** `src/components/pwa/PushPrompt.tsx` n'est importé nulle part ;
  la cuisine (`use-kitchen-notifications.ts`) demande la permission de notification au montage, sans
  geste, et ne crée pas d'abonnement push. `public/sw.js` sait afficher un push, mais aucun n'arrive.
- **N8 — Journal `notifSent` réécrit en entier** (lecture puis `update`) : course possible avec une
  réclamation concurrente (`order-lifecycle-realtime`, `appendNotifLog`).
- **N9 — Échappement des gabarits e-mail.** Règle : toute valeur interpolée passe par `esc()`
  (`src/lib/email-templates.ts`), test unitaire à l'appui (`email-resend.md` § 5) ; état actuel : voir
  le registre privé du programme.
- **N10 — `Notification.channel` ment.** Le canal enregistré est le « meilleur » canal servi, ou `PUSH`
  quand aucun ne l'a été. `GET /api/notifications` renvoie 30 lignes triées non lues d'abord, sans
  pagination ni compteur dédié.

## 3. Canaux

- **C1 — E-mail.** Expéditeur unique `Klik&Go <noreply@klikandgo.app>` (domaine racine), pas de
  `text`, pas de `replyTo`, pas de clé d'idempotence, pas de `tags`. MX racine `smtp.google.com`
  (messagerie Google). Authentification du domaine d'envoi (DKIM Resend [RS2], SPF, DMARC) : à vérifier
  et compléter avant tout durcissement DMARC (`email-resend.md` § 1) ; relevé DNS : registre privé du
  programme.
- **C2 — Aucun retour d'expérience e-mail.** Pas de webhook Resend : rebonds et plaintes ne coupent
  jamais le canal (`notifEmail` reste vrai). Seule la liste de suppression de Resend protège [RS7].
- **C3 — Consentement marketing.** La CNIL exige le consentement préalable pour la prospection
  électronique d'un particulier, sauf client ayant déjà acheté un produit analogue ; une simple création
  de compte ne suffit pas [CNIL1]. Événements concernés : `CART_ABANDONED`, `PROMO_NEW`, `FLASH_OFFER`.
  Règles : `email-resend.md` § 4 ; état actuel des préférences et des gabarits : voir le registre privé
  du programme.
- **C4 — Prospection B2B** (`prospect-relances`, gabarits `prospect*`) : licite sur intérêt légitime si
  le message concerne la profession, à condition d'informer et d'offrir à chaque envoi un moyen simple de
  s'opposer [CNIL1] (état des gabarits : registre privé du programme). Le pied de page commun dit « merci de ne pas y répondre »
  alors que la relance J+3 demande de répondre « Oui », depuis `noreply@`.
- **C5 — WhatsApp.** `src/lib/whatsapp.ts` envoie un `Body` libre par l'API Twilio. Hors fenêtre de
  service de 24 h ouverte par un message du client, WhatsApp n'accepte que des modèles approuvés
  [TW1][WA1] : ces envois échoueraient (le code renvoie alors `false`, compté servi, N2). Sans les trois
  variables `TWILIO_*` (leur présence en production n'a pas été relevée) : bouchon qui renvoie `true`.
  Pour tout événement sans modèle, `notifications.ts` envoie le texte brut de l'e-mail par
  `sendWhatsAppRaw`, marketing compris. WhatsApp exige un opt-in [WA1] (état de la préférence :
  registre privé du programme).
- **C6 — SMS.** `notifSms` existe dans le schéma ; aucun transport n'est codé.
- **C7 — Campagnes e-mail** (`src/lib/marketing/send-campaign.ts`, lancé par
  `POST /api/dashboard/campaigns/[campaignId]/send`, administrateur). (a) à (c) Audiences, consentement,
  désinscription et échappement du contenu : règles d'`email-resend.md` § 4 et § 5 ; état actuel : voir
  le registre privé du programme. (d) L'envoi se fait dans la requête HTTP, par lots de 10 en
  parallèle, sans budget : une audience longue est coupée par la durée maximale, la campagne reste
  `SENDING`, et un second clic renvoie tout depuis le début (doublons). Le plafond Resend est de
  10 requêtes par seconde pour l'équipe [RS9]. (e) `scheduledAt` est enregistré mais lu par aucun job :
  le bouton « Envoyer » crée la campagne en `SCHEDULED` puis l'envoie aussitôt
  (`CampaignForm.tsx`), quelle que soit la date saisie.

## 4. Hors domaine, signalé

- `public/sw.js` : stratégie de cache des pages connectées à revoir avec `security-multitenant` et
  `web-performance` (état actuel : voir le registre privé du programme).
- Les gabarits de prospection (`prospectInitial`, `prospectRelance3j` dans `email-templates.ts`) affirment
  « +15 à 30 % de chiffre d'affaires en 3 mois » et « Déjà 11 boucheries halal » : aucune donnée du dépôt
  ne les étaye. Ils parlent aussi de « commande livrée », terme que CLAUDE.md proscrit (pas de
  livraison). À faire valider par le propriétaire avant tout envoi réel (`conformite-france` ; même
  esprit que la règle « aucun témoignage inventé » de `seo-anti-penalty`, qui ne vise que les pages).
- `recalc-shop-tiers` renvoie `error.message` dans sa réponse 500 et n'utilise pas `apiError` /
  `handleApiError` (`api-route-conventions`).
