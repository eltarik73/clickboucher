# Points à arbitrer (décisions du propriétaire)

Chaque point oppose une règle ou un choix existant à ce que la recherche indique. **Un agent
n'applique aucune de ces options de sa propre initiative** : il présente le coût, le risque et
l'option recommandée, puis attend la décision. Identifiants `S…` / `I…` : [sources.md](sources.md).

## A. Plan Vercel : Hobby ou Pro ?

- **Constat.** Plan réel à confirmer dans Settings → Billing ; indices relevés : registre privé du
  programme.
- **Enjeu.** Sur Hobby : coupure sèche jusqu'à 30 jours au dépassement, aucun budget paramétrable,
  journaux gardés 1 heure, 3 règles de pare-feu, crons quotidiens seulement, et **usage commercial
  interdit** (S25, S37 ; S25 range « encaisser des paiements » et « promouvoir des produits »
  dans l'usage commercial). Klik&Go prélève une commission : un compte Hobby peut être suspendu
  pour ce seul motif. Le modèle de capacité montre qu'une seule boutique active dépasse les 4 h de
  CPU ([mesure-et-capacite.md](mesure-et-capacite.md) § 3).
- **Recommandation.** Vérifier dans Settings → Billing. Si Hobby : passer en Pro (20 $ par mois,
  dont 20 $ de crédit d'usage) **avant** d'embarquer la première boucherie payante, puis configurer
  Spend Management le jour même (point B).

## B. Budget, pause automatique et équipe partagée

- **Constat.** Sur Hobby, les quotas sont ceux de l'équipe (S10) : un autre projet de l'équipe peut
  épuiser le CPU de Klik&Go (inventaire de l'équipe : registre privé du programme). Sur Pro, la pause automatique de Spend
  Management coupe la production de **tous** les projets de l'équipe et la reprise est manuelle,
  projet par projet (S7).
- **Options.** (1) Budget avec notifications seules (50, 75, 100 %) : pas de coupure, risque de
  facture. (2) Budget avec pause : facture plafonnée, mais une attaque ou un bug coupe tous les sites de l'équipe.
  (3) Isoler Klik&Go dans sa propre équipe : quotas et pause indépendants, au prix d'un second
  abonnement Pro.
- **Recommandation.** Démarrer avec l'option 1 et un budget bas (par exemple 30 $), SMS activé à
  100 %, plus un webhook `budget.reached` vers un canal lu ; passer à l'option 2 avec un budget
  plus haut seulement quand la règle de limitation de débit et Bot Protection sont en place.
  Étudier l'option 3 quand le site encaisse des paiements.
- **Piège.** Un changelog de 2024 annonce que la pause est activée par défaut à la création d'un
  budget (S40). Pour l'option 1, désactiver explicitement « Pause Production Deployments » et
  relire le réglage après l'enregistrement, sinon tous les projets de l'équipe seront coupés à 100 %.

## C. Robots d'IA : coût contre visibilité

- **Règle existante.** `src/app/robots.ts` et CLAUDE.md (§ GEO / AIO) autorisent GPTBot, ClaudeBot,
  PerplexityBot, etc. pour que Klik&Go soit cité par les assistants.
- **Ce que la recherche indique.** Le jeu de règles « AI Bots » de Vercel peut les refuser
  gratuitement et sans code (S20) ; un site Hobby a vu ses requêtes CDN baisser d'environ 80 % en
  un jour après avoir combiné pages statiques, Bot Protection et blocage des robots d'IA (S35,
  anecdote : l'effet propre de chaque mesure n'est pas isolé).
- **Recommandation.** Garder « Allow ». Mettre le jeu en mode `log` pour mesurer leur part réelle,
  et ne rouvrir la question que si elle pèse sur la facture. Un compromis existe : refuser la
  catégorie des robots d'entraînement (`--category ai-crawlers`, S39) et garder celle des
  assistants, les deux se réglant séparément (S42) ; il modifie la stratégie GEO, donc décision du
  propriétaire, après lecture de `seo-anti-penalty`.

## D. Formats d'image : « WebP d'abord, AVIF en secours »

- **Règle existante.** CLAUDE.md : WebP d'abord, jamais AVIF en premier ; `next.config.mjs` déclare
  `formats: ["image/webp", "image/avif"]`.
- **Ce que le test local montre (I4).** Avec Next 14.2.35, la négociation choisit `image/avif` dès
  que le navigateur l'accepte, quel que soit l'ordre du tableau :

  ```bash
  node -e "const a=require('next/dist/compiled/@hapi/accept');console.log(a.mediaType('image/avif,image/webp,image/*,*/*;q=0.8',['image/webp','image/avif']))"
  # → image/avif
  ```

  Ce test porte sur l'optimiseur de Next (auto-hébergement). En production, c'est le service
  d'images de Vercel qui répond ; le guide Vercel sur le coût des images décrit le même
  comportement : quand les deux formats sont déclarés, la variante AVIF va aux navigateurs qui
  l'acceptent et la variante WebP aux autres (S29). La réponse réelle de klikandgo.app n'a pas été
  relevée.
  Par ailleurs deux formats déclarés doublent les transformations et les entrées de cache (S29).
- **À mesurer avant de décider.** `curl -sI -H "Accept: image/avif,image/webp,*/*" "https://klikandgo.app/_next/image?url=…&w=640&q=60" | grep -i content-type`.
- **Recommandation.** Si la réponse est `image/avif`, la règle du propriétaire n'est pas respectée
  par la configuration actuelle : passer à `formats: ["image/webp"]`, qui l'applique à coup sûr et
  divise par deux les variantes possibles. Si la réponse est `image/webp`, ne rien changer.

## E. Région des fonctions

- **Constat.** Fonctions en `sfo1`, base Railway documentée en US-West
  (`RAPPORT-PERFORMANCE-RAILWAY.md`, à confirmer dans le tableau de bord Railway), clients en
  Savoie et en Isère. Le CPU coûte le même prix à Paris et à San Francisco, la mémoire 0,0001 $ de
  moins par GB-h à Paris (S2) : aucun gain de coût à déménager.
- **Recommandation.** Sujet de latence, pas de coût. Si la base passe en Europe, changer
  `regions` pour `cdg1` ou `fra1` **dans la même version**, vérifier la région Upstash, puis
  relever le CPU actif (une fonction qui attend moins longtemps sa base libère plus vite sa
  mémoire provisionnée).

## F. `/boutique/[slug]` rendu à chaque requête

- **Constat.** Gabarit public le plus visité, une fonction par vue, robots compris
  ([cache-cdn-isr.md](cache-cdn-isr.md) § 6). C'est le premier poste restant après les correctifs.
- **Options.** (1) Statu quo, protégé par le pare-feu et la limitation de débit. (2) ISR à la
  demande (`generateStaticParams` renvoyant `[]`) après avoir sorti la lecture Upstash du rendu
  (statut lu côté client, ou donnée mise en cache par `unstable_cache`), avec revalidation à la
  demande sur chaque mutation de boutique, de produit et de stock. (3) Coquille statique et données
  vivantes (stock, statut, promotions) chargées par des GET publics en cache court.
- **Risque.** Les options 2 et 3 peuvent afficher une boutique en pause comme ouverte ou un produit
  épuisé comme disponible si une mutation oublie d'invalider. La création de commande revalide déjà
  statut, capacité et stock côté serveur (`src/lib/services/orders/create.ts` : `SERVICE_DISABLED`,
  `CAPACITY_EXCEEDED`, `STOCK_INSUFFICIENT`, constaté à `2364ef9`), donc le risque est d'affichage,
  pas de commande erronée. À revérifier quand le chantier de tarification des commandes, en cours,
  aura modifié ce service.
- **Recommandation.** Option 1 tant que le trafic est faible ; mesurer la part de cette route dans
  le CPU ; lancer l'option 3 comme un projet à part entière (skills `nextjs-app-router` et
  `architecture-conventions`) quand elle dépasse le tiers du CPU du projet.

## G. `indexnow-fresh` quotidien

- **Constat.** Le cron soumet chaque jour 112 à 132 URL, changées ou non, ce qui sollicite un
  recrawl quotidien (jusqu'à environ 130 requêtes par jour) (I1). C'est une routine SEO choisie par
  le propriétaire (CLAUDE.md § Automation).
- **Recommandation.** Ne soumettre que les URL réellement modifiées, ou passer en hebdomadaire
  (`11 3 * * 1`). Gain de coût faible, gain de crédibilité du signal IndexNow réel. Décision SEO :
  passer par `seo-anti-penalty` et `seo-expert`.

## H. Web Analytics, Speed Insights et Plausible en parallèle

- **Constat.** `src/app/layout.tsx` monte `<Analytics />` et `<SpeedInsights />` sur chaque page, en
  plus de Plausible (chargé après consentement). Web Analytics : 50 000 événements par mois inclus
  sur Hobby ; sur Pro, rien d'inclus, 0,03 $ le millier dès le premier événement (S1, S44). Speed
  Insights : gratuit sur tous les plans dans la limite de 10 000 événements sur 30 jours glissants
  pour toute l'équipe, collecte suspendue au moins 14 jours au-delà ; l'option « Plus » coûte 10 $
  par projet et par mois plus 0,65 $ par 10 000 événements (S43).
- **Recommandation.** Garder Speed Insights (mesure des Core Web Vitals utile au SEO) en version
  gratuite, avec un échantillonnage (`<SpeedInsights sampleRate={0.5} />`, prop présente en 2.0.0)
  pour rester sous le plafond partagé par les projets de l'équipe ; ne pas activer « Plus » sans décision.
  Choisir **un seul** outil d'audience entre Vercel Web Analytics et Plausible. Les conditions de
  consentement relèvent du skill `conformite-france`.

## I. Cadence du polling (Mode Cuisine et suivi de commande)

- **Règle existante.** CLAUDE.md : le Mode Cuisine interroge l'API toutes les 5 s. Le suivi client
  (`/commande/[id]`) fait de même dans le code (`ORDER_POLL_MS`, `src/hooks/useVisiblePolling.ts`).
- **Ce que le modèle indique.** Le polling est le poste qui grandit avec l'activité : 216 000 appels
  par mois pour une tablette ouverte 10 h par jour, chacun payant le middleware et une fonction
  ([mesure-et-capacite.md](mesure-et-capacite.md) § 3).
- **Recommandation.** Ne pas toucher à la cadence sans décision produit : elle fixe le délai de
  l'alerte « nouvelle commande ». Pistes à chiffrer dans le skill `order-lifecycle-realtime` :
  réponse minimale quand rien n'a changé, cadence plus lente hors des heures d'ouverture, arrêt du
  suivi client dès l'état final.
