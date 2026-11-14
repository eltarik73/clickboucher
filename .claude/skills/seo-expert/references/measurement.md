# Mesure SEO

Sources : S5, S18, S19, S20, S21, S28, S29, S31. Journaux existants : mémoires
`project_gsc_indexation_log.md`, `project_bing_daily_log.md`.

## Google Search Console

- **Performance** : le trafic AI Overviews / AI Mode est compté dans le type de recherche « Web »
  (S19). Un rapport dédié existe : « Rapport sur les performances dans l'IA générative
  (Recherche) », qui n'affiche que des **impressions** (liens vers le site montrés dans AI
  Overviews / AI Mode), déployé pour tous les sites depuis le 2026-08-31 ; il n'apparaît pas tant
  que le site y a trop peu d'impressions (S28). Pas de clics propres à l'IA dans ce rapport.
- **Indexation des pages** — libellés exacts de l'interface française (S20) : « Explorée,
  actuellement non indexée », « Détectée, actuellement non indexée », « URL marquée "noindex" »,
  « Bloquée en raison d'un autre problème de type 4xx », « Erreur du serveur (5xx) », « Introuvable
  (404) », « Erreur "soft 404" », « Page en double sans URL canonique sélectionnée par
  l'utilisateur », « Page avec redirection ». Avertissements : « Indexée malgré le blocage par le
  fichier robots.txt », « Page indexée sans contenu ». Après correction : « Valider la
  correction » (environ deux semaines, parfois beaucoup plus). « Explorée, actuellement non
  indexée » n'indique pas forcément un problème : Google n'indexe pas toutes les pages (S20).
- **Inspection d'URL** : vérité sur une URL (canonical retenu, HTML vu par Googlebot). API :
  2 000 requêtes/jour et 600/min par propriété (S21) — suffisant pour inspecter tout le sitemap
  (215 URLs) chaque jour si un script le fait un jour.
- **Statistiques sur l'exploration** (Paramètres de la propriété) : répartition des réponses —
  OK (200) doit rester très majoritaire — et état de l'hôte (S31). À regarder après toute panne.
- **Résultats enrichis** : rapports par type ; FAQ n'apparaît plus dans Search (S5).
- **Actions manuelles** : à regarder après toute modification de JSON-LD d'avis.

## Bing Webmaster Tools

- Sitemap : date de dernière lecture, erreurs. IndexNow : URLs reçues.
- Cron `bing-daily` (les quotas de l'API sont notés dans la mémoire `project_bing_setup.md`).

## Contrôles automatiques déjà en place

- `api/cron/seo-audit` (quotidien) : alerte (Sentry via `logger.error`) si sitemap < 100 URLs,
  robots.txt ou sitemap inaccessibles, accueil en `noindex` ou sans title/canonical, `noindex` ou
  réponse non 200 sur les 10 premières villes, 6 pages Aïd al-Adha, la page partenaire de
  Chambéry. Il ne voit ni les soft-404 (D6) ni les fils d'Ariane cassés (D5).
- `.github/workflows/uptime.yml` : `/` et `/sitemap.xml` en 200 toutes les 6 h.
- CI `check-prerender` : prérendu des pages publiques clés.

## Lire les chiffres sans se tromper

1. Toujours noter une **base avant** changement et comparer à **J+28** au moins (seo-anti-penalty,
   POST-PUSH ; mémoire `project_seo_rules_2026.md` « Ce que je DOIS faire »).
2. Vérifier le tableau des mises à jour Google (S18) avant d'attribuer une variation à un commit :
   core de novembre 2026 en cours depuis le 10/11 (pas de date de fin affichée le 2026-11-14).
3. Comparer des périodes de même durée et mêmes jours de semaine (hypothèse métier à confirmer
   sur nos données : les achats de viande seraient plus marqués en fin de semaine et autour du
   Ramadan et de l'Aïd).
4. Les clics de marque (« klikandgo ») ne mesurent pas le SEO local : filtrer requêtes
   « boucherie halal {ville} » et pages `/boucherie-halal/*` séparément.
5. `llms.txt` : Google Search l'ignore, sans bénéfice ni dommage (S29, S5). Aucune métrique
   Google ne peut lui être attribuée.
