# Mesurer l'usage par route et dimensionner

Identifiants `S…` / `I…` : [sources.md](sources.md). Règle de base : **on ne décide pas d'une
optimisation de coût sans un nombre avant et un nombre après**. L'audit de novembre 2026 n'a pas pu
dire quelle part du CPU venait des API ou des pages, faute de mesure par route en production (I1).

## 1. Avant le déploiement (local et CI, sans accès à Vercel)

Toutes les commandes se lancent depuis la racine du dépôt.

| Vérification | Commande | Ce qu'elle prouve |
| --- | --- | --- |
| Régressions connues | `node .claude/skills/vercel-cost-performance/scripts/cost-audit.mjs` | prop `dynamic`, matcher attrape-tout, Sentry dans le middleware, crons, polling nu, cache public avec auth… (heuristiques : lire les avertissements) |
| Matcher en liste blanche | `npx vitest run src/lib/__tests__/middleware-matcher.test.ts` | toute route gardée est dans le matcher ; aucun handler exclu n'importe un helper d'auth |
| Mode de rendu de chaque route | job CI `build` (`npm run build` demande une base joignable : ne pas le lancer sans elle) | table des routes : `○` statique, `●` prérendu, `ƒ` fonction par requête |
| Pages publiques toujours prérendues | `node scripts/check-prerender.mjs` (après un build) | `/`, `/cgv`, `/a-propos`, une page ville et le sitemap sont dans le manifeste ; au moins 250 routes prérendues |

Référence après correctifs (builds du 2026-11-13, `161f920` puis `2364ef9`) : 210 routes `ƒ` (dont
197 sous `/api/`), 89 `○`, 10 `●`, middleware de 93,1 kB puis 93,6 kB après l'ajout de la
vérification du jeton de test (I4). **Dans une PR, comparer la table des routes à celle de `main`** :
toute page publique qui passe de `○` / `●` à `ƒ` est une régression de coût, même si les tests
passent. Ajouter à `REQUIRED_ROUTES` un chemin par nouvelle famille de pages publiques.

Compter aussi à la main, pour toute page touchée : combien de requêtes part une vue **anonyme**
(onglet Réseau, navigation privée) ? Cible : 0 appel API au montage sur les pages SEO, 2 sur
l'accueil (`/api/geo`, `/api/shops/nearby`).

## 2. Après le déploiement (tableau de bord, gratuit sur tous les plans)

| Question | Où regarder | Limite |
| --- | --- | --- |
| Quel compteur monte, et pour quel projet ? | Usage (équipe) : filtre par projet et par région | les quotas Hobby sont ceux de l'équipe |
| Quelles fonctions sont les plus appelées ? | Observability → Vercel Functions : routes triables par invocations, erreurs, durée | détail par chemin concret et latence : Observability Plus (S21) |
| Le middleware tourne-t-il trop ? | Observability → Middleware (invocations) | répartition par chemin : Observability Plus (S13) |
| Qui frappe le site ? | Firewall (trafic par agent, IP, chemin) ; Observability → CDN Requests et AI Traffic (S47) | rétention plus longue et détail fin : Observability Plus (S21) |
| L'ISR régénère-t-il trop ? | Observability → ISR ; Logs : motif de cache de chaque requête | « Write Utilization » : Observability Plus (S14) |
| Les images coûtent-elles ? | Observability → Image Optimization (transformations, lectures / écritures) | S29 |
| Une réponse sort-elle du cache ? | en-tête `x-vercel-cache` (`MISS`, `HIT`, `STALE`, `PRERENDER`…) avec `curl -sI` | S17 |

Les journaux d'exécution ne sont gardés qu'**une heure sur Hobby**, un jour sur Pro (S3) : sur
Hobby une anomalie de la nuit est invisible le matin. Observability Plus (Pro et Enterprise) coûte
1,20 $ par million d'événements. Une requête servie par le cache compte 1 événement ; une requête
dynamique en compte au moins 3 (CDN, middleware, fonction), **plus un par appel sortant** de la
fonction (Upstash, Clerk, Resend…) (S1, S21). Les projets peuvent être exclus un par un. À activer
ponctuellement pour une enquête, pas en permanence.

En ligne de commande (CLI Vercel ≥ 65.11.0, non installée dans le dépôt ; `npx vercel@latest`, avec
une session `vercel login` du propriétaire et le projet lié ; les commandes ci-dessous ne font que lire) :

```bash
vercel billing usage --breakdown daily            # usage et coût par jour, cycle en cours
vercel billing usage --since 7d --group-by project # qui consomme dans l'équipe
vercel billing budgets inspect                     # dépense à la demande face au budget (Pro)
vercel logs requests --environment production --query 'httpStatus:500' --json
vercel metrics schema                              # la plupart des métriques demandent Observability Plus
```

(S7, S21, S22, S28, S46). Le coût affiché par `vercel billing usage` est avant crédits et remises ;
`--group-by` et `--breakdown` ne se combinent pas (S22).

Routine après tout changement touchant le middleware, le rendu, le cache, le polling ou un cron :
relever CPU actif, invocations et requêtes CDN du projet à J-1, J+1 et J+7, sur des périodes de
trafic comparables (S28), et l'écrire dans la PR ou le compte rendu.

## 3. Modèle de capacité

`scripts/capacity.mjs` additionne les invocations et le CPU par source de trafic et compare aux
quotas Hobby et aux tarifs Pro. C'est un **ordre de grandeur** : ses temps CPU par défaut viennent
des mesures locales de l'audit (I1), pas de la production.

```bash
node .claude/skills/vercel-cost-performance/scripts/capacity.mjs --help
node .claude/skills/vercel-cost-performance/scripts/capacity.mjs shops=10 ordersPerDay=25
```

Formules :

- polling Mode Cuisine : `boutiques × heures × 3600 / 5 × 30` appels par mois, chacun passant par le
  middleware **et** une fonction. Une tablette visible 10 h par jour = 216 000 appels par mois ;
  visible 24 h sur 24 = 518 400 (17 280 par jour). Onglet caché, la boucle ne s'arrête pas : elle
  passe à 15 s (`HIDDEN_INTERVAL_MS`, `src/hooks/use-order-polling.ts`), soit 240 appels par heure
  cachée (paramètre `kitchenHiddenHours`) ;
- suivi de commande : `commandes × minutes de suivi × 12` appels ;
- CPU = `appels × (part à froid × CPU à froid + part à chaud × CPU à chaud)` ;
- mémoire = `appels × durée murale × 2 GB` (majorant : en Fluid, les requêtes simultanées partagent
  une instance, S23) ;
- connexion longue (SSE) : `heures ouvertes × 2 GB`, soit 1 440 GB-h par mois pour un flux ouvert en
  permanence, quatre fois le quota Hobby à lui seul (S2). Sur Vercel, préférer un polling court et
  conscient de la visibilité à un flux tenu ouvert ; arbitrage détaillé dans le skill
  `order-lifecycle-realtime`.

Sorties du modèle (relancées le 2026-11-13 ; les arguments non cités gardent leur valeur par défaut) :

| Scénario | Arguments | CPU actif / mois | Verdict Hobby (4 h, équipe entière) | Pro, calcul seul |
| --- | --- | --- | --- | --- |
| 1 boutique, 20 commandes par jour | aucun | ≈ 4,6 h | dépassé | ≈ 1,8 $ |
| 10 boutiques | `shops=10` | ≈ 24 h | dépassé (× 6) | ≈ 14 $ |
| 50 boutiques, 30 commandes par jour, 60 000 vues | `shops=50 ordersPerDay=30 anonViews=60000` | ≈ 143 h | dépassé (× 36) | ≈ 83 $ |
| 0 boutique, 130 000 hits robots tous sur des routes dynamiques à froid | `shops=0 anonViews=0 crons=0 botHits=130000 dynamicShare=1 coldSparse=1` | ≈ 15 h | dépassé (× 4) | ≈ 3 $ |

Lecture :

- **Le compteur qui lâche en premier est le CPU actif**, pas les invocations ni les requêtes CDN :
  au moment de la panne, ces deux quotas étaient loin d'être atteints (relevés : registre privé du
  programme).
- Le plan Hobby ne tient pas une seule boutique active avec les hypothèses par défaut. En Pro, le
  calcul reste dans le crédit mensuel de 20 $ jusqu'à une dizaine de boutiques (hors autres
  compteurs et autres projets de l'équipe) : une boutique active coûte de l'ordre de 1 à 2 $ par
  mois de calcul.
- Le poste qui grandit avec l'activité est le **polling** (cuisine et suivi), linéaire en boutiques
  et en commandes. Chaque appel de polling évité, ou sorti du matcher, compte double (middleware +
  fonction).
- La dernière ligne est un scénario d'école (requêtes toutes supposées dynamiques et à froid) : sans
  aucun client, des robots suffisent à dépasser plusieurs fois le quota. Ce n'est pas une
  reconstitution de la panne.

Ces verdicts dépendent des temps CPU par invocation. Dès qu'Observability fournit des durées
réelles, relancer le modèle avec `fnWarm=`, `fnCold=`, `coldPoll=` et noter les valeurs retenues ici.

## 4. Seuils d'alerte à tenir

| Signal | Seuil | Action |
| --- | --- | --- |
| CPU actif du mois (Hobby) | 50 % du quota avant le 15 du mois | chercher la route en tête, ne pas attendre |
| Budget à la demande (Pro) | notification à 50 % | relire Usage, comparer au modèle |
| Routes prérendues | moins de 250 (`check-prerender.mjs`) | la CI échoue : ne pas contourner |
| Invocations du middleware | plus du double des invocations de fonctions | un chemin public est sans doute revenu dans le matcher |
| Site injoignable | `x-vercel-error` ou statut ≠ 200 sur `/` et `/sitemap.xml` | `.github/workflows/uptime.yml` + moniteur externe (skill `reliability-observability`) |
