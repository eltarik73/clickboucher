# Points à arbitrer (décision du propriétaire)

Le skill n'outrepasse ni CLAUDE.md ni les règles SEO du propriétaire, ni le contrat d'un autre
skill du programme. Ces points exposent un écart ou un choix ; tant qu'ils ne sont pas tranchés,
on applique CLAUDE.md tel quel.

## A. Section « Monitoring » de CLAUDE.md partiellement fausse pour le SDK installé

Constat (E3, E5) : CLAUDE.md cite `hideSourceMaps: true` et « Sans token → `dryRun: true` ». Ces
options n'existent pas dans `@sentry/nextjs` 10.49.0 : elles sont ignorées. « SDK initialisé si
`SENTRY_DSN` (ou `NEXT_PUBLIC_SENTRY_DSN`) » : côté serveur, `src/instrumentation.ts` n'importe la
config que si `SENTRY_DSN` est défini.
Options : (1) corriger la doc et `next.config.mjs` (retirer les options mortes, `disableLogger` →
`webpack.treeshake.removeDebugLogging`) ; (2) laisser en l'état. Recommandation : (1), sans risque.

## B. Sentry et mode test côté navigateur

Constat (E6) : CLAUDE.md dit Sentry désactivé quand le mode test est actif. Vrai côté serveur.
Côté navigateur, `process.env.TEST_MODE` n'est pas injecté (pas de préfixe `NEXT_PUBLIC_`).
Options : (1) documenter « côté navigateur : ne pas définir `NEXT_PUBLIC_SENTRY_DSN` en local et en
preview », et retirer le test mort ; (2) lire le cookie indice `klikgo-test-activated` dans
`beforeSend` pour jeter l'événement. Recommandation : (1) ; (2) ferait dépendre l'observabilité
d'un cookie sans droit (CLAUDE.md « Test Mode »).

## C. Rate limit qui laisse passer quand Redis tombe (fail-open)

Constat : `checkRateLimit` renvoie `success: true` si Redis est absent, en erreur, ou après le
`timeout` du SDK [S18]. Routes concernées : OTP, commande invité, codes promo ; état en production :
registre privé du programme.
Options : (1) garder fail-open partout (disponibilité) ; (2) fail-closed pour OTP et
`promoValidate` seulement (sécurité), fail-open ailleurs ; (3) repli mémoire par instance.
Coût de (2) : une panne Upstash bloque l'envoi d'OTP. Croiser avec `security-multitenant`.

## D. Configuration manquante en production

Constat (E9, E10) : sans Resend ni VAPID, l'application démarre et prétend envoyer.
Options : (1) démarrer, journaliser `error` une fois, exposer `not_configured` dans le détail de
`/api/health`, réservé à l'appel authentifié (proposé par ce skill) ; (2) refuser le build de production si une variable requise manque
(garde dans la CI ou au démarrage). (2) est plus sûr mais bloque un déploiement d'urgence le jour
où un fournisseur est retiré volontairement.

## E. Région des fonctions

`vercel.json` : `"regions": ["sfo1"]` ; la clientèle est en France et la région de la base Railway
n'est pas documentée ici. Chaque requête Prisma traverse la distance fonction ↔ base.
Sujet de latence, pas de fiabilité au sens strict : décision commune avec
`vercel-cost-performance` § 8 E (« à déplacer avec la base, jamais sans elle »).

## F. Moniteurs de crons : manuel ou automatique

`Sentry.withMonitor` (explicite, un appel par cron, un moniteur seulement là où on le décide)
contre `_experimental.vercelCronsMonitoring` (automatique depuis `vercel.json`, marqué
expérimental, crée un moniteur par chemin : quinze) [S2].
Recommandation : manuel, en commençant par `auto-cancel` ; revoir quand l'option sortira de
l'expérimental et que H sera tranché.

## G. Où faire tourner le dump hors plateforme

Il faut un planificateur qui ne soit ni Vercel (surveillé) ni seulement Railway (la base). Choix
d'hébergeur et de stockage = coût récurrent et compte à créer : décision et création par le
propriétaire.

## H. Plan Sentry et nombre de moniteurs

Constat : tout plan Sentry inclut un moniteur Uptime et un moniteur Cron ; les suivants se paient
sur un budget à la demande que seuls les plans payants proposent (1,00 $ par moniteur Uptime,
0,78 $ par moniteur Cron, pages lues le 2026-11-14) [S26]. Le plan de l'organisation `klikandgo`
n'a pas été relevé.
Options : (1) rester à 1 + 1 : Uptime sur `/api/health`, Cron sur `auto-cancel` — couvre la panne
de novembre (suspension) et l'arrêt de tous les crons, pas l'échec silencieux d'un cron
particulier ; (2) plan payant + budget : second moniteur Uptime sur `/` et un moniteur par cron
(14 de plus ≈ 11 $ par mois au tarif lu, hors prix du plan). Recommandation : (1) tout de suite,
(2) quand les commandes réelles justifient le coût. Dans tous les cas, `uptime.yml` reste.

## I. Code HTTP quand la base est injoignable

Constat : `handleApiError` répond 500 `INTERNAL_ERROR` (« Erreur de connexion a la base de
donnees »), et la conversion par code proposée par `api-route-conventions` (wrapper.md § 4b) garde
ce 500. Un 503 dirait mieux « réessayez plus tard » (et permettrait un `Retry-After`), mais il
change le contrat des réponses d'API et le sens de `SERVICE_DISABLED` (503 déjà utilisé pour
« boutique fermée »).
Options : (1) garder 500 ; (2) nouveau code d'erreur en 503 pour l'indisponibilité de la base.
Ce skill n'exige que l'appel à Sentry sur cette branche (E8), quel que soit le code. Décision à
prendre dans `api-route-conventions`.
