# Points à arbitrer (décision du propriétaire)

Ce skill ne modifie aucune règle du propriétaire. Chaque point ci-dessous expose un écart constaté
entre ses règles, le code et les sources primaires ; l'équipe applique la règle en vigueur tant que
le propriétaire n'a pas tranché.

## A1 — Ville sans boutique : index ou noindex ?

- Mémoire `project_seo_rules_2026.md` §A : « si shopCount === 0 → noindex + exclude sitemap » ;
  §E : « filtrer systématiquement par populatedCitySlugs » ; §D : pages légales « déjà noindex »
  (elles sont en `index: true` dans le code).
- seo-anti-penalty règle D (règle OR, 2026-05-10) et le code (`4fc4897`) : villes `SEO_CITIES`
  toujours index, toujours au sitemap.
- Constat : la mémoire est antérieure (commit `018ba6a` cité) et a été révoquée par l'incident du
  2026-05-10. **Règle appliquée : seo-anti-penalty.** Proposition : mettre à jour la mémoire.

## A2 — JSON-LD `Event` sur `/occasions/*`

- Code : `Event` organisé par « Klik&Go », lieu = ville, `offers.price = 0`, `validFrom = new Date()`.
- Google : ne pas baliser en événement remises de courte durée, occasions d'achat, coupons ;
  France absente des pays où la fonctionnalité existe (S7). CLAUDE.md : pas de `new Date()` dans
  le rendu ISR.
- seo-anti-penalty F n'interdit `Event` que sans `startDate` réel : ici la date est estimée.
- Proposition : branche `WebPage` pour toutes les occasions.

## A3 — Fiches `/boutique/*`

- Mémoire GSC : interdiction de demander l'indexation des fiches boutique.
- Code : toutes les boutiques `visible` sont au sitemap (9 en production le 2026-11-14,
  priority 0.8) et le cron `indexnow-fresh` en soumet jusqu'à 20 chaque jour à Bing.
- Question : les fiches actuelles doivent-elles être indexées ? Passer une boutique en
  `visible: false` la retire du sitemap, des pages villes et du ping ; la fiche elle-même doit
  aussi cesser d'être indexable (`noindex` ou 404). État actuel et correctif éventuel : voir le
  registre privé du programme.

## A4 — `FAQPage` existants

- Le résultat FAQ n'apparaît plus dans Google Search depuis le 2026-05-07 (S5). Bing/IA : pas de
  source primaire trouvée sur leur usage.
- Options : garder (coût nul, mais le contenu doit être exact → corriger D1) ou retirer.

## A5 — Seuils « 500 mots » et « ≥ 1 inventaire »

- Origine : blogs SEO cités par le propriétaire (SEORAF, JourneyH, Metaflow), non primaires.
- Google parle de pages créées « pour manipuler le classement » sans aider l'utilisateur, sans
  aucun seuil de mots (S3). Le seuil reste une règle interne prudente ; ne pas le présenter comme
  une règle Google.

## A6 — Affirmations commerciales des pages SEO (D1)

- « 0,99 € de frais », « payez en ligne », « Paiement : en ligne (Stripe Connect) » (llms.txt).
- Code : paiement sur place uniquement. Frais : 0,99 € encore affichés au panier sur `main` ; le
  chantier prix en cours (non commité le 2026-11-14) les met à 0 pour `ON_PICKUP` et les réserve
  au mode `ONLINE`, pas encore proposé. Calendrier : corriger les textes avec ce chantier.
- Risque : contenu et balisage inexacts (S12) ; information du consommateur (skill
  conformite-france). Libellé de remplacement à valider par le propriétaire avant tout rechercher-
  remplacer (Stripe « à venir »).

## A7 — `SpeakableSchema`

- Bêta, États-Unis, anglais, réponses d'actualité (S6) : aucun effet pour un site français. Le
  commentaire du composant cite un article secondaire (Search Engine Land) non vérifié ici.
  Garder ou retirer.

## A8 — Contenu unique des pages villes : la prémisse « 700+ mots » ne se vérifie pas

- seo-anti-penalty (règle OR) et les commentaires du code justifient l'indexation des pages
  villes par « 700+ mots de contenu unique par ville (`localContext` + `specialty` + `districts`
  + FAQ dynamique) ». Cette phrase vise les « SEO_CITIES principales » ; le code applique
  l'indexation systématique aux 55 villes.
- Mesure du 2026-11-14 sur les 55 villes : texte propre à la ville (`localContext` +
  `description` + `specialty` + `districts`) = 72 à 369 mots, médiane 112 ; aucune ville
  n'atteint 500. Le reste de la page est du gabarit : étapes, appels à l'action, FAQ où seul le
  nom de ville change. Les villes sans boutique affichent « Klik&Go arrive bientôt à {ville} ».
- Google donne en exemple de doorway des pages ciblant des villes qui mènent à une même
  destination, sans seuil de mots (S3). Le risque n'est pas chiffrable depuis ce skill ; le
  rapport « Indexation des pages » de GSC dira combien de ces 55 pages sont réellement indexées.
- **Règle appliquée : index** (les villes sont business-critical pour le propriétaire). Options à
  lui soumettre : enrichir le texte propre aux villes prioritaires ; ou limiter l'exception
  « toujours index » à la liste de villes cibles (mémoire `project_agglo_chambery_strategy.md`)
  et appliquer la règle des 500 mots / inventaire aux autres. Ne rien basculer en `noindex`
  sans son accord (seo-anti-penalty règle D, point 5).
