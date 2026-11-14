# Sources

Consultées le **14/11/2026**. Chaque URL de ce fichier (sauf CL1, lue par le `SPEC.md` du programme) a
été **rouverte par le vérificateur indépendant** le même jour, et chaque chiffre repris dans le skill a
été relu sur la page. « Mis à jour » reprend la
date affichée par la page. Chiffres GitHub : `gh api repos/OWNER/REPO` le 14/11/2026 (relancé par le
vérificateur : valeurs identiques). Une affirmation sans renvoi vient de la lecture du code (branche
de travail, HEAD `32c581f` + chantier non commité) ou de `node_modules`. Les pages ont
été lues par un outil de récupération qui résume : un chiffre absent de la page n'est pas repris.

## Vercel (documentation officielle)

| Id | URL | Ce que la source étaye | Crédibilité |
|---|---|---|---|
| V-CRON1 | https://vercel.com/docs/cron-jobs/manage-cron-jobs (canonique : /docs/schedules/cron-jobs/manage-cron-jobs) | Pas de nouvelle tentative ; livraison « best effort » (passage manqué sans journal, ou doublé) ; chevauchement possible et verrou conseillé ; idempotence et réconciliation ; production seulement ; redirections non suivies (`trailingSlash`) ; réponse en cache non journalisée (`force-dynamic`) ; `CRON_SECRET` d'au moins 16 caractères, en `Bearer`, figé au build, rotation par redéploiement, restauré par un retour arrière ; réglage « Disable Cron Jobs » persistant ; pare-feu ; en-tête `x-vercel-cron-schedule` ; crons « legacy » remplacés à terme par Schedules | Doc officielle, mise à jour 11/08/2026 |
| V-CRON2 | https://vercel.com/docs/cron-jobs/usage-and-pricing | 100 crons par projet ; Hobby : une fois par jour, précision ± 59 min, expression plus fréquente refusée au déploiement ; Pro : à la minute ; facturé comme une fonction | Doc officielle, mise à jour 15/07/2026 |
| V-FN | https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package | `waitUntil` : même délai que la fonction, annulé au dépassement ; `after()` recommandé à partir de Next.js 15.1 ; `getDeadline()` | Doc officielle, mise à jour 03/09/2026 |
| V-FNPRICE | https://vercel.com/docs/functions/usage-and-pricing | Invocations 0,60 $ le million ; `sfo1` : CPU actif 0,177 $/h, mémoire 0,0147 $/Go-h, facturée tant qu'une requête est en cours ; Hobby : 4 h de CPU actif incluses | Doc officielle, mise à jour 16/06/2026 |
| V-FLUID | https://vercel.com/docs/fluid-compute | Ordre de priorité des réglages : code de la fonction (`maxDuration`), puis `vercel.json`, puis tableau de bord, puis défauts | Doc officielle, mise à jour 24/08/2026 |
| V-DUR | https://vercel.com/docs/functions/configuring-functions/duration | Durée par défaut 300 s ; maximum 300 s (Hobby), 800 s (Pro, Enterprise) ; `export const maxDuration` dans la route ; `vercel inspect <url> --json` donne la durée déployée (`timeout`) | Doc officielle, mise à jour 24/08/2026 |

## Files et orchestrateurs

| Id | URL | Ce que la source étaye | Crédibilité |
|---|---|---|---|
| QS1 | https://upstash.com/pricing/qstash | Gratuit : 1 000 messages/jour, délai max 7 jours, 10 planifications ; à l'usage : 1 $ les 100 000, délai 1 an ; chaque tentative de livraison est un message facturé | Page tarifaire officielle. SDK `upstash/qstash-js` : 271 étoiles, push 13/11/2026, non archivé (sous le seuil ; SDK officiel d'un fournisseur déjà utilisé) |
| QS2 | https://upstash.com/docs/qstash/features/retry | 3 retries par défaut ; attente `min(86400, e^(2.5n))` s ; tout non-2xx = échec ; arrêt par `489` + `Upstash-NonRetryable-Error` ; file des messages morts | Doc officielle Upstash |
| QS3 | https://upstash.com/docs/qstash/howto/signature | Chaque requête QStash porte un JWT dans l'en-tête `Upstash-Signature`, à vérifier avec les clés de signature courante et suivante | Doc officielle Upstash |
| INN1 | https://www.inngest.com/pricing | Gratuit 50 000 exécutions/mois ; Pro dès 99 $/mois (1 M incluses) ; exécutions = runs × (étapes + 1). La page donne deux tarifs de dépassement non réconciliés (50 $ le million au tableau, dégressif en FAQ) : non repris | Page tarifaire officielle. Dépôt `inngest/inngest` : 6 035 étoiles, push 14/11/2026 |
| INN2 | https://www.inngest.com/docs/learn/how-functions-are-executed | Chaque étape s'exécute dans une requête distincte vers l'application ; résultats d'étapes mémorisés ; seule l'étape en échec est rejouée | Doc officielle |
| TRG1 | https://trigger.dev/pricing | Free 0 $ (5 $ de crédit), Hobby 10 $, Pro 50 $/mois ; 0,000025 $ par run + calcul à la seconde (Small 1x : 0,0000338 $/s) | Page tarifaire officielle. Dépôt `triggerdotdev/trigger.dev` : 16 760 étoiles, push 13/11/2026 |
| TRG2 | https://trigger.dev/docs/how-it-works | Tâches exécutées dans l'environnement Trigger.dev (pas sur le serveur de l'application), déployées par `npx trigger.dev@latest deploy` | Doc officielle |
| MS1 | https://microservices.io/patterns/data/transactional-outbox.html | Outbox : message écrit dans la transaction métier, relais séparé, doublons possibles donc consommateurs idempotents | Chris Richardson, référence du domaine |
| AWS1 | https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html | Problème de la double écriture, table d'envoi dans la même transaction, messages en double donc consommateur idempotent | Guide officiel AWS |
| — | `timgit/pg-boss` | File dans PostgreSQL à travailleur permanent | 4 138 étoiles, push 13/11/2026 (non retenu : exige un processus continu) |

## PostgreSQL et PgBouncer

| Id | URL | Ce que la source étaye | Crédibilité |
|---|---|---|---|
| PG2 | https://www.postgresql.org/docs/current/sql-select.html | `SKIP LOCKED` : saute les lignes verrouillées, vue incohérente, adapté à plusieurs consommateurs d'une table utilisée comme file | Doc officielle (PostgreSQL 18) ; comportement exécuté ici sur 15.19 [L2] |
| PGB1 | https://www.pgbouncer.org/features.html | Mode transaction : `LISTEN`, `SET` et verrous consultatifs de session « Never ». Le verrou consultatif de transaction n'y figure pas | Doc officielle PgBouncer |
| PG-UUID | https://www.postgresql.org/docs/current/functions-uuid.html | `gen_random_uuid()` dans les fonctions du cœur | Doc officielle (PostgreSQL 18) ; exécuté ici sur 15.19 [L2] |

## E-mail

| Id | URL | Ce que la source étaye | Crédibilité |
|---|---|---|---|
| RS1 | https://resend.com/docs/dashboard/domains/introduction | Envoyer depuis des sous-domaines (réputation séparée) ; DMARC et BIMI après vérification ; choix de la région | Doc officielle Resend. SDK `resend/resend-node` : 978 étoiles, push 14/11/2026 (sous le seuil ; SDK officiel) |
| RS2 | https://resend.com/docs/knowledge-base/cloudflare | Enregistrements : MX et TXT SPF sur `send`, TXT DKIM sur `resend._domainkey` (suffixés du sous-domaine) ; valeurs à copier du tableau de bord | Doc officielle Resend |
| RS3 | https://resend.com/docs/dashboard/domains/dmarc | `p=none` + `rua`, puis `quarantine`, puis `reject` ; DMARC passe si SPF ou DKIM passe | Doc officielle Resend |
| RS4 | https://resend.com/docs/dashboard/emails/idempotency-keys | `Idempotency-Key`, 256 caractères, 24 h, même clé + même contenu = réponse d'origine sans renvoi, codes `409 invalid_idempotent_request` / `concurrent_idempotent_requests`, `400 invalid_idempotency_key` ; envoi simple et par lot | Doc officielle Resend ; option `idempotencyKey` confirmée dans `node_modules/resend` |
| RS5 | https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests | En-têtes `svix-id`, `svix-timestamp`, `svix-signature` ; corps brut obligatoire ; `RESEND_WEBHOOK_SECRET` ; vérification par le SDK ou par `svix` | Doc officielle Resend. `svix/svix-webhooks` : 3 480 étoiles, push 13/11/2026 |
| RS6 | https://resend.com/docs/dashboard/webhooks/retries-and-replays | Calendrier de rejeu (immédiat, 5 s, 5 min, 30 min, 2 h, 5 h, 10 h, 10 h ; total ≈ 27 h 35 calculé ici), désactivation automatique d'un point d'accès en échec, rejeu manuel | Doc officielle Resend |
| RS7 | https://resend.com/docs/dashboard/emails/email-suppressions | Suppression sur rebond définitif, plainte (Gmail et Google Workspace ne la signalent pas) ou ajout manuel ; envois ignorés sur tous les domaines de l'équipe ; retrait sans correction = nouvelle suppression | Doc officielle Resend |
| RS8 | https://resend.com/pricing | Gratuit 3 000/mois, 100/jour, 3 domaines ; Pro 20 $ pour 50 000, sans plafond journalier, 0,90 $ les 1 000 en plus | Page tarifaire officielle |
| RS9 | https://resend.com/docs/api-reference/rate-limit | 10 requêtes par seconde pour l'équipe ; `429` avec `retry-after` ; quotas : `429` `daily_quota_exceeded` / `monthly_quota_exceeded` | Doc officielle Resend |
| RS10 | https://resend.com/docs/dashboard/webhooks/event-types | `email.bounced` = rejet permanent ; `email.delivery_delayed` = problème passager ; `email.complained` ; `email.suppressed` | Doc officielle Resend ; types confirmés dans `node_modules/resend` |
| RS11 | https://resend.com/docs/api-reference/emails/send-batch-emails | Jusqu'à 100 e-mails par appel ; pièces jointes non prises en charge ; clé d'idempotence acceptée | Doc officielle Resend ; `resend.batch.send` présent dans `node_modules/resend` |
| G1 | https://support.google.com/a/answer/81126 | Exigences Gmail : tous expéditeurs (SPF ou DKIM, TLS, plaintes < 0,3 %, viser < 0,1 %) ; plus de 5 000/jour (SPF + DKIM + DMARC, `p=none` accepté, alignement, désinscription en un clic pour le marketing + lien visible) | Aide officielle Google Workspace |
| RFC8058 | https://www.rfc-editor.org/rfc/rfc8058.html | Désinscription en un clic : `List-Unsubscribe` avec une URI HTTPS, `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, `POST` sans cookie ni authentification, identifiant opaque difficile à forger dans l'URI, pas de redirection, en-têtes couverts par une signature DKIM valide | RFC IETF |
| — | `resend/react-email` | Gabarits en React | 19 936 étoiles, push 14/11/2026 (non installé) |

## Droit français

| Id | URL | Ce que la source étaye | Crédibilité |
|---|---|---|---|
| CNIL1 | https://www.cnil.fr/fr/la-prospection-commerciale-par-courrier-electronique | E-mail, SMS-MMS, automate : particulier = consentement préalable par action positive (case non pré-cochée ; accepter des CGU ne suffit pas), exception client ayant acheté un produit analogue, création de compte sans achat insuffisante ; professionnel = intérêt légitime si lié à la profession, information et opposition ; adresses génériques (`contact@`, `info@`) hors de ces règles ; à chaque message identité de l'expéditeur et moyen simple de refuser. La page ne parle ni des paniers abandonnés ni des messages de service | CNIL, page datée du 10/06/2026 |

## Web Push

| Id | URL | Ce que la source étaye | Crédibilité |
|---|---|---|---|
| RFC8030 | https://www.rfc-editor.org/rfc/rfc8030.html | `TTL` obligatoire (0 = immédiat ou jamais, réductible par le service), `Urgency` (4 niveaux, `high` pour l'urgent, `very-low` pour la publicité, défaut `normal`), `Topic` (remplacement, 32 caractères base64url, sinon `400`), `201` = accepté et non remis, `404` pour un abonnement expiré (§ 7.3), `429` + `Retry-After` (§ 8.4). Le `410` de la RFC concerne les accusés de réception, pas l'abonnement | RFC IETF |
| WD1 | https://web.dev/articles/push-notifications-common-issues-and-reporting-bugs | Codes du service de push : `404` et `410` → supprimer l'abonnement ; `429` → `Retry-After` ; `400`, `413` | web.dev (Google) |
| MDN1 | https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe | `userVisibleOnly: true` exigé par Chrome et Edge ; abonnement en réponse à un geste ; Firefox ≥ 72 refuse les notifications hors geste | MDN |
| WK1 | https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ | iOS / iPadOS 16.4, ajout à l'écran d'accueil, manifeste `standalone` ou `fullscreen`, permission sur interaction directe, Badging API | Blog WebKit (Apple), 16/02/2023 |
| — | `web-push-libs/web-push` | Bibliothèque serveur installée (3.6.7), options `TTL`, `urgency`, `topic`, `timeout`, classe `WebPushError` (vérifiées dans `node_modules/@types/web-push` 3.6.4), défaut `DEFAULT_TTL = 2419200` et validation du `topic` (lues dans `node_modules/web-push/src/web-push-lib.js`) | 3 572 étoiles, push 10/11/2026, non archivé |

## SMS et WhatsApp

| Id | URL | Ce que la source étaye | Crédibilité |
|---|---|---|---|
| WA1 | https://developers.facebook.com/docs/whatsapp/pricing | Facturation au message depuis le 01/07/2025 ; catégories marketing, utility, authentication (modèles), service et Meta Business Agent (hors modèle) ; « utility » dans la fenêtre : gratuit depuis le 01/07/2025, facturé depuis le 01/10/2026 ; service : 1 000 messages gratuits par mois et par numéro ; fenêtre de 24 h ouverte par l'utilisateur ; hors fenêtre, modèles seulement ; utilisateurs ayant donné leur accord ; France marché distinct (montant non lu sur la page) | Doc développeur officielle Meta |
| TW1 | https://www.twilio.com/docs/whatsapp/key-concepts | Fenêtre de 24 h après le dernier message entrant ; hors fenêtre, modèle approuvé uniquement (Content SID). La page ne traite pas de l'opt-in | Doc officielle Twilio. SDK `twilio/twilio-node` : 1 545 étoiles (non installé : le dépôt appelle l'API REST par `fetch`) |
| TW2 | https://www.twilio.com/en-us/sms/pricing/fr | 0,0798 $ par segment vers la France (expéditeur alphanumérique), frais d'opérateur possibles, 0,001 $ par message en échec | Page tarifaire officielle Twilio |

## Format des skills

| Id | URL | Ce que la source étaye | Crédibilité |
|---|---|---|---|
| CL1 | https://code.claude.com/docs/en/skills.md (via `SPEC.md` du programme, relevé le 13/11/2026) | Frontmatter `name`, `description`, `when_to_use` (1 536 caractères au total), `SKILL.md` sous 500 lignes, fichiers d'appui liés en relatif | Doc officielle Claude Code |

## Vérifications locales (14/11/2026)

| Id | Ce qui a été fait | Résultat |
|---|---|---|
| L1 | Chaque bloc ```ts des fichiers `references/*.md` extrait tel quel et compilé en strict (`tsc` 5.9.3 du dépôt, alias `@/` vers `src/`, types de `node_modules` : Next 14.2.35, Prisma 6.19.2, resend 6.9.1, web-push 3.6.7 / @types 3.6.4, svix 1.84.1). Le bloc d'usage de l'outbox est compilé avec le module qui le précède. Rejoué par le vérificateur après ses corrections | 7 blocs, 0 erreur. L'extrait de `SKILL.md`, marqué non autonome, n'est pas compilé seul |
| L2 | Conteneur PostgreSQL 15.19 jetable ; DDL produit par `prisma migrate diff --from-empty --to-schema-datamodel` sur le schéma du § 3 de `outbox-notifications.md` ; fonctions du § 4 appelées **par `@prisma/client` 6.19.2** : doublon de clé, envoi immédiat par commande, succès, échec passager, exception, échec définitif, `skipped`, échéance, épuisement, balayage, deux réclamations concurrentes (l'une tient 3 s), puis 12 clients concurrents sur 300 lignes, 5 fois | Tout conforme, aucune ligne réclamée deux fois (détail au § 4). Le premier jet de l'auteur (validé d'une façon qu'il ne décrit pas) échouait ici en `42804` sur les deux colonnes enum, à l'insertion et au report d'échéance : corrigé par des casts. PgBouncer non reproduit |
| L3 | `dig +short TXT/MX` sur `klikandgo.app`, `_dmarc.`, `resend._domainkey.`, `send.` (relancé par le vérificateur) | MX racine `smtp.google.com` ; le reste du relevé est au registre privé du programme |
| L4 | Lecture de `node_modules/resend/dist/index.d.mts` et `index.mjs` | `emails.send` renvoie `{ data, error }` (`statusCode: number \| null`, erreur réseau comprise) ; `new Resend()` lève sans clé ; types `WebhookEventPayload`, `email.bounced`, `email.complained`, `email.suppressed` ; `batch.send` |
| L5 | Relecture ligne à ligne des constats de `etat-du-code.md` dans le code (15 crons, transports, `notifications.ts`, `send-campaign.ts`, `shop-status.ts`, `sw.js`, `PushPrompt.tsx`, schéma) | Constats confirmés ; ajouts du vérificateur : pause minutée sans cron (J2), J10, C7, priorité de `maxDuration` (J7), 7 e-mails par commande |

## Écartées ou non vérifiées

- **Documentation Apple** « Sending web push notifications in web apps and browsers » : page rendue en
  JavaScript, contenu non lu. Aucune règle n'en dépend (WK1 et MDN1 suffisent).
- **Reddit, YouTube** : aucun fil ni transcription consultés ; aucune règle n'en dépend.
- **Règles horaires des SMS et du démarchage** (plages, dimanches) : non vérifiées sur une source primaire,
  donc absentes du skill ; la consigne « pas de marketing la nuit » est un choix produit à arbitrer (B4).
- **Statut juridique de la relance de panier abandonné** : non tranché par CNIL1 ; marqué « à confirmer ».
- **Tarif WhatsApp France** : présent dans la grille de Meta (fichier), non lu.
- **Variables d'environnement de production** : relevé du propriétaire, hors dépôt, non revérifiable
  d'ici ; conservé au registre privé du programme.
- **Mémoire par défaut d'une fonction (2 Go)** : reprise de `order-lifecycle-realtime`, non rouverte ; elle
  ne sert qu'à l'ordre de grandeur du coût du cron à la minute.
- **DKIM du courrier Google de la racine** : non relevé (sélecteur inconnu).
- **Durée de vie de l'« interaction directe » iOS après un `await`** : non sourcée ; la consigne
  « demander la permission avant tout `await` » est une précaution.
- **Comportement de `FOR UPDATE SKIP LOCKED` à travers PgBouncer** : non reproduit.
