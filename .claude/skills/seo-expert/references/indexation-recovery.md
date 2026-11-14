# Reprise d'indexation après une panne

Cas réel : du 2026-11-05 au 2026-11-13, tout le domaine a répondu **402
`DEPLOYMENT_DISABLED`** (quota CPU Vercel, voir CLAUDE.md « Coût CPU Vercel » et la mémoire
`project_outage_2026_11_vercel_cpu.md`). Le 2026-11-14, l'accueil et le sitemap répondent 200.
Sources : S1, S2, S11, S17, S18, S20, S22, S27, S31.

## Ce que dit Google (et pourquoi c'est grave ici)

- Un 4xx autre que 429 : Google n'utilise pas le contenu, et une URL déjà indexée qui renvoie un
  4xx est **retirée** de l'index (S1). Le 402 n'est pas nommé par la doc : il tombe dans « tous
  les 4xx sauf 429 ».
- Un 5xx ou un 429 ralentit le crawl ; les URLs indexées restent d'abord, puis tombent si l'erreur
  persiste (S1).
- Pour une coupure voulue de 1-2 jours : 503 + `Retry-After`, robots.txt jamais en 503 ; pour une
  fermeture longue, garder un accueil indexable en 200. Il n'existe **pas de délai fixe** pour
  récupérer d'un retrait complet et aucun moyen de l'accélérer (S17).
- Huit jours de 402 = scénario le plus défavorable : on doit s'attendre à des pages sorties de
  l'index et à un crawl ralenti. L'ampleur réelle se lit dans GSC, pas dans ce document.
- Une mise à jour cœur a démarré le 2026-11-10 (S18) : en novembre, baisse de positions et baisse
  d'indexation se superposent.

## Procédure (à exécuter une fois le site de nouveau en 200)

1. **Vérifier les codes réels** sur toutes les URLs du sitemap (lecture seule) :
   ```bash
   curl -s https://klikandgo.app/sitemap.xml | grep -o '<loc>[^<]*' | sed 's/<loc>//' \
     | while read u; do printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$u")" "$u"; done \
     | grep -v '^200' || echo "toutes en 200"
   curl -sI https://klikandgo.app/robots.txt | head -1
   ```
2. **Vérifier `noindex`/canonical** sur un échantillon par gabarit (villes, occasions, hubs) : le
   cron `seo-audit` ne contrôle chaque jour que les 10 premières villes, 6 pages Aïd et une page
   partenaire ; pour le reste, lancer la commande de seo-anti-penalty (action 4) à la main.
3. **Search Console** (action humaine, le propriétaire) :
   - Sitemaps → resoumettre `https://klikandgo.app/sitemap.xml` et noter « dernière lecture » (S2).
   - Inspection d'URL → « Demander une indexation » pour **un petit lot** prioritaire : accueil,
     villes P1 (Chambéry d'abord, cf. stratégie agglo), hub régional, départements Savoie /
     Haute-Savoie, Aïd al-Adha × Chambéry/Aix. S17 : Search Console pour un nombre limité de
     pages, le sitemap pour le grand nombre. Ne pas resoumettre ce qui a été demandé il y a moins
     de 14 jours ; jamais `/boutique/*` (mémoire `project_gsc_indexation_strategy.md`).
   - Indexation des pages → motifs « Bloquée en raison d'un autre problème de type 4xx » (là où
     un 402 devrait apparaître : déduction, la page d'aide ne cite pas ce code) et « Erreur du
     serveur (5xx) » : une fois les URLs en 200, cliquer « Valider la correction » ; la
     validation prend en général deux semaines environ, parfois beaucoup plus (S20).
   - Paramètres → « Statistiques sur l'exploration » : OK (200) doit redevenir très majoritaire ;
     regarder aussi l'état de l'hôte (S31).
4. **Bing / IndexNow** : une soumission unique des URLs du sitemap (≤ 10 000 par POST, S22) via
   `POST /api/seo/indexnow` (session admin Clerk réelle : le mode test n'existe pas en
   production), sans la répéter — cas non prévu par le protocole, voir sitemap-indexnow.md
   règle 5 ; exclure les `/boutique/*` tant que A3 n'est pas tranché ; puis vérifier la relecture
   du sitemap dans Bing Webmaster Tools (S11).
5. **Ne rien changer d'autre** pendant la reprise : pas de nouvelle famille de pages, pas de
   bascule `noindex`, pas de refonte de titres. Sinon impossible d'attribuer les variations.
6. **Journal** : consigner date, URLs soumises, chiffres GSC de référence dans la mémoire
   (`project_gsc_indexation_log.md`).
7. **Suivi** : J+7 (indexation des P1), J+28 (Performance) ; comparer à la période avant le
   2026-11-05 en tenant compte de la mise à jour cœur de novembre.
8. **Action annexe en retard** : renouveler la suppression GSC de `clerk.klikandgo.app`, échue le
   2026-11-08 (seo-anti-penalty règle E et mémoire `project_seo_rules_2026.md`).

## Prévenir la prochaine fois

- La cause était un coût CPU, pas le SEO : respecter CLAUDE.md « Coût CPU Vercel » (pages SEO en
  ISR avec `generateStaticParams`, middleware en liste blanche, `prefetch={false}` sur les liens
  en masse — dette D7) et garder `check-prerender` en CI.
- Une pause imposée par l'hébergeur renvoie 402 : on ne choisit pas le code. Seule parade : ne pas
  atteindre le quota, et être alerté tôt (`.github/workflows/uptime.yml` + moniteur externe sur
  `https://klikandgo.app/`, CLAUDE.md « Uptime »).
- Coupure volontaire (maintenance) : page statique en 503 + `Retry-After`, robots.txt en 200,
  jamais 403/404/410/`noindex` (S17).
