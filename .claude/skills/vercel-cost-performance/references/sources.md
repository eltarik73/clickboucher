# Sources — vercel-cost-performance

Toutes les sources ont été consultées le **2026-11-13**, puis rouvertes une à une le même jour par
un vérificateur indépendant (texte de la page relu, pas un extrait de recherche). Les pages
`vercel.com/docs` exposent une date `last_updated` : elle est reportée. Les prix et quotas
changent : **relire la page citée avant de chiffrer une décision**, ne pas recopier un nombre de ce
dossier dans un commentaire de code. Astuce : ajouter `.md` à une URL `vercel.com/docs/…` renvoie
la page en Markdown brut.

Niveau de preuve : **P** = source primaire (doc officielle, changelog, blog ou base de
connaissances de l'éditeur) · **A** = anecdote de terrain, utilisée seulement si une source P la
corrobore · **I** = mesure ou constat interne au dépôt.

## Vercel — facturation et plans (P, éditeur de la plateforme)

| ID | URL | Ce que la source étaie | Màj |
| --- | --- | --- | --- |
| S1 | https://vercel.com/docs/pricing | Liste des compteurs facturés ; inclus Hobby ; modèle Pro « crédit puis à la demande » ; Web Analytics, Speed Insights, Blob, builds (à partir de 0,0035 $ par minute-CPU), Observability Plus | 2026-09-14 |
| S2 | https://vercel.com/docs/functions/usage-and-pricing | Définition CPU actif (pas facturé pendant l'attente I/O), mémoire provisionnée (facturée jusqu'à la fin de la dernière requête en cours), invocations ; tarifs par région (sfo1, cdg1, fra1, iad1) ; exemple chiffré | 2026-06-16 |
| S3 | https://vercel.com/docs/plans/hobby | Quotas Hobby ; attente de 30 jours « dans la plupart des cas » après dépassement ; logs 1 h ; 3 règles WAF, 10 IP bloquées ; pas de Spend Management ; durée max 300 s | 2026-09-14 |
| S4 | https://vercel.com/docs/plans/pro-plan | 20 $/mois = 1 siège + 20 $ de crédit d'usage non reportable ; Flat Rate CDN inclus ; alerte à 75 % du crédit ; notification de dépense par défaut à 200 $ | 2026-09-15 |
| S5 | https://vercel.com/docs/pricing/regional-pricing et `/cdg1` | Fourchettes de prix par ressource ; grille complète de la région Paris (ISR, images, transfert, limitation de débit) | 2026-09-14 |
| S6 | https://vercel.com/docs/pricing/flat-rate-cdn | Paliers Flat Rate CDN (inclus : 1 M + 1 TB ; 20 $ : 10 M + 50 TB), passage au palier supérieur au cycle suivant | 2026-09-14 |
| S7 | https://vercel.com/docs/spend-management | Budget à la demande, seuils 50/75/100 %, SMS à 100 %, pause de TOUS les projets (`503 DEPLOYMENT_PAUSED`), reprise manuelle par projet, contrôle « toutes les quelques minutes », webhook `budget.reached`, CLI `vercel billing budgets` | 2026-09-18 |
| S8 | https://vercel.com/docs/cron-jobs/usage-and-pricing (redirige vers `/docs/schedules/cron-jobs/usage-and-pricing`) | Crons : 100 par projet ; Hobby 1 fois par jour, précision ± 59 min, déploiement refusé sinon ; Pro à la minute ; fonctionnalité « legacy » | 2026-07-15 |
| S9 | https://vercel.com/docs/schedules/limits | Schedules (bêta) : Hobby toutes les 15 min et 5 000 exécutions par période ; limites susceptibles de changer | bêta |
| S10 | https://vercel.com/docs/limits | L'allocation mensuelle Hobby est attribuée à l'équipe (« Hobby teams get a monthly allotment ») ; fonctions 2 GB / 1 vCPU (Pro : jusqu'à 4 GB / 2 vCPU) ; durée max ; rétention des logs 1 h / 1 jour / 3 jours | 2026-09-16 |
| S11 | https://vercel.com/docs/limits/fair-use-guidelines | Tableau d'usage typique ; tarifs à la demande Pro ; middleware en runtime edge ≤ 50 ms de CPU en moyenne | 2026-09-14 |
| S12 | https://vercel.com/docs/manage-cdn-usage | Définition CDN Requests (ex « Edge Requests »), Fast Data Transfer, Fast Origin Transfer (peut être compté deux fois avec un middleware), CDN Request CPU Duration (tranches de 10 ms) ; le polling cité comme cause | 2026-09-14 |
| S13 | https://vercel.com/docs/routing-middleware | Middleware facturé au modèle Fluid ; il s'exécute avant le cache ; sans matcher il tourne sur chaque requête, fichiers statiques compris ; préférer la configuration statique ; détail par chemin réservé à Observability Plus | 2026-08-14 |
| S14 | https://vercel.com/docs/incremental-static-regeneration/limits-and-pricing | Unités ISR de 8 KB ; cache durable dans la région des fonctions ; pas d'écriture si le contenu est inchangé ; `new Date()` / `Math.random()` provoquent des écritures ; « Write Utilization » réservé à Observability Plus | 2026-08-11 |
| S15 | https://vercel.com/docs/image-optimization/limits-and-pricing | Transformation facturée à chaque MISS et STALE ; sur Hobby les nouvelles images renvoient 402 après dépassement, les anciennes restent servies ; e-mails à l'approche de la limite | 2026-08-11 |
| S24 | https://vercel.com/docs/errors/DEPLOYMENT_DISABLED | Erreur 402 : vérifier les quotas dépassés ou une rétrogradation en Hobby ; « la solution la plus rapide » est de passer en Pro | n. c. |
| S30 | https://vercel.com/changelog/function-invocations-now-billed-per-unit | Invocations Pro facturées à l'unité, 0,0000006 $ soit 0,60 $ par million | 2026-05-29 |
| S31 | https://vercel.com/blog/introducing-active-cpu-pricing-for-fluid-compute | Annonce du modèle « CPU actif » : le CPU n'est facturé que lorsqu'il travaille | 2025-06-25 |
| S40 | https://vercel.com/changelog/spend-management-now-pauses-production-deployments-by-default | La pause de la production est activée par défaut quand le montant fixé est atteint ; les comptes Hobby sont mis en pause en atteignant les limites gratuites | 2024-06-27 |
| S43 | https://vercel.com/docs/speed-insights/limits-and-pricing | Speed Insights gratuit sur tous les plans (10 000 événements sur 30 jours, partagés par l'équipe, collecte suspendue au moins 14 jours au-delà) ; option « Plus » : 10 $ par projet et par mois + 0,65 $ par 10 000 événements ; `sampleRate` | 2026-09-23 |
| S44 | https://vercel.com/docs/analytics/limits-and-pricing | Web Analytics : 50 000 événements inclus sur Hobby (3 jours de grâce puis arrêt de la collecte) ; Pro : rien d'inclus, 0,03 $ par millier | 2026-08-25 |

## Vercel — cache, CDN, calcul (P)

| ID | URL | Ce que la source étaie | Màj |
| --- | --- | --- | --- |
| S16 | https://vercel.com/docs/caching/cache-control-headers | Défaut `public, max-age=0, must-revalidate` ; `s-maxage`, `stale-while-revalidate`, `stale-if-error` ; priorité `Vercel-CDN-Cache-Control` > `CDN-Cache-Control` > `Cache-Control` ; en-tête de fonction > fichier de configuration ; tableau de recommandations | 2026-09-14 |
| S17 | https://vercel.com/docs/caching/cdn-cache | Critères de mise en cache (GET/HEAD, pas d'`Authorization`, statuts admis, pas de `Set-Cookie`, pas de `Vary: *` ni `Vary: Cookie`, ≤ 10 MB) ; `Accept` et `Accept-Encoding` dans la clé ; cache par région et « best effort » ; `x-vercel-cache` | 2026-09-14 |
| S41 | https://vercel.com/docs/caching/cdn-cache/purge | Composition de la clé de cache : méthode, URL (chaîne de requête ignorée pour les fichiers statiques), hôte, URL du déploiement, schéma ; non configurable | 2026-09-03 |
| S23 | https://vercel.com/docs/fluid-compute | Fluid activé par défaut pour les nouveaux projets depuis le 2025-04-23 ; concurrence dans l'instance ; bytecode caching et pré-chauffage en production ; ordre de priorité des réglages (code de la fonction > `vercel.json` > tableau de bord) | 2026-08-24 |
| S26 | https://vercel.com/kb/guide/caching-antipatterns | Cinq anti-patterns issus d'audits Vercel (amplification d'écritures, cache ISR non repris d'un déploiement à l'autre, cardinalité de la clé de cache, cache sans propriétaire) ; points de purge non protégés | 2026-11-02 |
| S27 | https://vercel.com/kb/guide/how-to-reduce-isr-revalidation-costs | « Choisir l'intervalle le plus long compatible avec la fraîcheur » ; revalidation à la demande ; raisons de cache dans les logs ; requêtes `crawler`, brouillon et « prerender bypass » qui sautent le cache ISR | 2026-11-06 |
| S28 | https://vercel.com/kb/guide/optimize-function-invocations | Diagnostic des invocations (Usage, Observability, `vercel metrics`) ; causes : rendu dynamique involontaire, prefetch, robots, polling ; comparer des fenêtres de trafic comparables | 2026-09-08 |
| S29 | https://vercel.com/kb/guide/reduce-image-optimization-costs-on-vercel | Une entrée de cache par largeur × qualité × format ; `minimumCacheTTL` de 31 jours ; AVIF en plus de WebP double les entrées, AVIF étant servi aux navigateurs qui l'acceptent ; `qualities` : valeur hors liste en erreur avant Next 16 ; `unoptimized` au cas par cas | 2026-09-30 |

## Vercel — pare-feu, robots, mesure (P)

| ID | URL | Ce que la source étaie | Màj |
| --- | --- | --- | --- |
| S18 | https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing | Règles personnalisées, blocage IP et anti-DDoS gratuits ; le trafic refusé, mis au défi ou limité n'est pas facturé en requêtes CDN ni en transfert | 2026-06-16 |
| S45 | https://vercel.com/changelog/web-application-firewall-mitigated-traffic-is-free-on-vercel | Annonce de cette gratuité du trafic arrêté par le pare-feu | 2026-05-18 |
| S19 | https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting | Limitation de débit : Hobby 1 règle par projet (dans les 3) et 1 M de requêtes autorisées incluses ; fenêtre fixe de 10 s à 10 min ; clés IP et JA4 ; défaut 100 requêtes par 60 s, action 429 ; compteurs par région | 2026-08-28 |
| S20 | https://vercel.com/docs/bot-management | Jeux de règles gérés « Bot Protection » (log ou challenge) et « AI Bots » (log ou deny), inactifs par défaut, tous plans ; robots vérifiés exemptés (annuaire sur la page) ; `curl` se disant Chrome est mis au défi ; règle `bypass` possible ; ne fonctionne pas derrière un proxy inverse | 2026-09-10 |
| S42 | https://vercel.com/docs/vercel-firewall/vercel-waf/managed-rulesets | Bot Protection et AI Bots disponibles sur tous les plans ; catégories « AI Crawlers » et « AI Assistants » réglables séparément | 2026-09-10 |
| S21 | https://vercel.com/docs/observability | Observability gratuit sur tous les plans ; détail par chemin et latence réservés à Observability Plus (Pro, Enterprise) ; types d'événements suivis, appels externes compris | 2026-09-10 |
| S47 | https://vercel.com/docs/observability/insights | Onglets Vercel Functions, Middleware, CDN Requests, AI Traffic, Image Optimization, ISR | 2026-08-11 |
| S22 | https://vercel.com/docs/cli/usage | `vercel billing usage` (`--since`, `--until`, `--breakdown`, `--group-by`, `--json`), CLI ≥ 65.11.0 ; coût avant crédits et remises | 2026-10-30 |
| S46 | https://vercel.com/docs/cli/logs | `vercel logs requests`, options `--query`, `--environment`, `--json` | 2026-02-10 |
| S25 | https://vercel.com/kb/guide/why-is-my-account-deployment-blocked | Causes de pause ; l'usage commercial sur Hobby (encaisser des paiements, promouvoir des produits…) est une violation de politique ; 503 `DEPLOYMENT_PAUSED` | 2026-10-02 |
| S39 | https://vercel.com/docs/cli/firewall | Commandes `vercel firewall rules …`, `traffic list`, `bot-management`, `publish` ; règles gérées `bot-protection` et `ai-bots` listées à part ; `--category ai-crawlers` | 2026-09-16 |
| S37 | https://vercel.com/legal/terms | Le plan Hobby est réservé à un usage « personal or non-commercial » ; Vercel peut désactiver un projet Hobby sans préavis | n. c. |

## Next.js (P, dépôt officiel `vercel/next.js` : 143 504 étoiles, dernier push 2026-11-13, non archivé)

| ID | URL | Ce que la source étaie |
| --- | --- | --- |
| S32 | https://nextjs.org/docs/14/app/building-your-application/routing/middleware | Sans matcher, le middleware est appelé pour chaque route ; les valeurs du matcher doivent être des constantes, une variable est ignorée ; runtime Edge uniquement en 14 |
| S33 | https://nextjs.org/docs/14/app/api-reference/components/link | `prefetch` vaut `true` par défaut ; tout lien visible est préchargé, en production seulement ; `prefetch={false}` le désactive |
| S34 | https://nextjs.org/docs/app/api-reference/functions/generate-static-params (page courante ; la page `/docs/14/…` ne détaille pas ce cas) | Un tableau vide rend les chemins à la première visite puis les revalide en ISR ; sans tableau renvoyé, la route est rendue dynamiquement. Règle reprise par CLAUDE.md pour notre version |

APIs citées dans ce skill et vérifiées dans `node_modules` (versions installées : next 14.2.35,
@clerk/nextjs 6.39.9, @vercel/speed-insights 2.0.0) : `revalidatePath`, `revalidateTag`,
`unstable_cache` (`next/cache.d.ts`) ; `images.qualities`, `minimumCacheTTL`
(`next/dist/shared/lib/image-config.d.ts`) ; refus d'une qualité hors liste
(`next/dist/shared/lib/image-loader.js`) ; négociation du format d'image
(`next/dist/server/image-optimizer.js`) ; `sampleRate` sur `<SpeedInsights>` ; `useUser`
(`@clerk/nextjs`). Les cinq patrons de SKILL.md compilent (`tsc --noEmit`, sortie 0) à `2364ef9`.

## Anecdotes de terrain (A)

| ID | URL | Usage dans ce skill | Corroboration |
| --- | --- | --- | --- |
| S35 | https://community.vercel.com/t/high-usage-free-plan/44421 | Site Hobby à 359 clics en 28 jours dépassant 1 M de requêtes CDN et le compteur ISR (1 043 180 / 1 000 000) à cause de robots (juin 2026) ; en un jour, requêtes − 80 %, transfert d'origine − 75 %, ISR − 69 % après pages statiques et Bot Protection. Le répondant n'est pas identifié comme employé de Vercel | S14, S18, S20, S27 |
| S36 | https://community.vercel.com/t/sudden-spike-in-function-invocations-edge-middleware-usage/5428 | Pic simultané invocations + middleware sans utilisateurs réels (février 2025) ; fil sans résolution publiée, cité seulement comme symptôme | S12, S13 |

**Reddit** (r/nextjs, r/webdev…) : injoignable depuis l'environnement de recherche le 2026-11-13
(domaine refusé par la recherche web, par la récupération de page et par le navigateur intégré).
**Aucune affirmation de ce skill ne repose sur Reddit.** Si un fil Reddit est apporté plus tard, il
ne devient une règle que si une source P ci-dessus le confirme.

**YouTube / conférences** : aucune source vidéo utilisée (pas de transcription lue).

## GitHub — crédibilité des outils cités (`gh api repos/OWNER/REPO`, relevé puis revérifié le 2026-11-13)

| Dépôt | Étoiles | Dernier push | Archivé | Remarque |
| --- | --- | --- | --- | --- |
| vercel/next.js | 143 504 | 2026-11-13 | non | framework utilisé |
| vercel/vercel | 16 585 | 2026-11-13 | non | CLI et builders |
| getsentry/sentry-javascript | 8 774 | 2026-11-13 | non | SDK utilisé |
| upstash/ratelimit-js | 2 052 | 2026-11-12 | non | sous le seuil de 3 000 : retenu comme dépôt officiel d'un outil installé |
| clerk/javascript | 1 781 | 2026-11-13 | non | idem, dépôt officiel de Clerk |
| upstash/redis-js | 985 | 2026-11-13 | non | idem, dépôt officiel d'Upstash |

## Sources internes (I)

| ID | Source | Contenu |
| --- | --- | --- |
| I1 | Audit multi-agents de novembre 2026 (dossier de session non versionné ; chiffres recopiés dans [panne-2026-11-05.md](panne-2026-11-05.md), relus dans les fichiers de l'audit par le vérificateur) | Part du middleware dans le CPU, volumes, temps mesurés en bac à sable local, classification des 198 routes API |
| I2 | Dépôt à `2364ef9` : `src/middleware.ts`, `vercel.json`, `next.config.mjs`, `scripts/check-prerender.mjs`, `src/lib/__tests__/middleware-matcher.test.ts`, `CLAUDE.md`, `RAPPORT-PERFORMANCE-RAILWAY.md` | État du code après correctifs ; région documentée de la base |
| I3 | Lecture seule du compte Vercel le 2026-11-13 (deux relevés) | Contenu (équipe, plan, pare-feu) au registre privé du programme |
| I4 | Tests locaux du 2026-11-13 | Négociation de format d'image de Next 14.2.35 (voir [points-a-arbitrer.md](points-a-arbitrer.md)) ; exécution des deux scripts du skill ; test `middleware-matcher` (4 tests verts) ; tables de routes des builds à `161f920` et `2364ef9` |

## Ce qui n'a PAS pu être vérifié

- Le plan réel de l'équipe (Hobby ou Pro) et le détail d'usage par route en production.
- Les règles de pare-feu réellement publiées sur le projet (aucune n'est consignée dans le dépôt).
- Si les invocations du middleware consomment le quota « Function Invocations » ou un compteur séparé.
- Le quota ISR d'un compte Hobby : absent des tableaux S1 et S3, visible à 1 000 000 dans S35 (anecdote).
- Le format réellement renvoyé par `klikandgo.app/_next/image` (S29 décrit AVIF pour les navigateurs
  qui l'acceptent ; aucune requête n'a été envoyée à la production).
- Si les requêtes des crons Vercel passent par les règles personnalisées du pare-feu (les webhooks
  Stripe et Svix figurent, eux, dans l'annuaire des robots vérifiés, S20).
- La région réelle de la base Railway (documentée US-West dans le dépôt, non relue dans Railway).
- Les temps CPU par invocation en production : tous les temps cités viennent d'un bac à sable local (I1).
